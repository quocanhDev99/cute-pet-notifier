/**
 * Chat sources — the user's chat list read through an app's OFFICIAL API, for the "👥 Người quen"
 * picker. Only names/ids of chats and members are read; never message bodies or previews.
 *
 *   teams  Microsoft Graph  GET /me/chats?$expand=members   (via Composio Connect, user's own OAuth;
 *          needs a work/school Microsoft 365 account — personal Teams has no Graph chat API)
 *   slack  Slack Web API    conversations.list / conversations.members / users.info  (bot token —
 *          lists only what the bot can see: channels it's in, and its own DMs)
 *
 * Everything else (Zalo, Messenger, iMessage…) has no public chat-list API: the picker falls back to
 * the names learned from notifications + manual entry, and says so.
 */
const CACHE_MS = 5 * 60 * 1000;
const TEAMS_TOOLKIT = 'microsoft_teams';

const STATE = Object.freeze({
  ready: 'ready', // connected, list available
  notConnected: 'not_connected', // app not linked yet
  unsupported: 'unsupported', // the current key/provider can't read it
  permission: 'permission', // linked but the account/scopes don't allow it
  error: 'error'
});

class ChatSources {
  /** @param {{ integrations: import('./index').IntegrationsManager, hub: any, secrets: any, settings: any, fetch?: Function }} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.fetch = ctx.fetch || globalThis.fetch;
    this.cache = new Map(); // id → { at, chats }
    this.inflight = new Map(); // id → Promise (one fetch at a time per source)
    // Names-only copy on disk so the picker opens instantly; refreshed in the background.
    this.file = ctx.dir ? require('path').join(ctx.dir, 'chat-sources-cache.json') : null;
    if (this.file) {
      try { for (const [k, v] of Object.entries(JSON.parse(require('fs').readFileSync(this.file, 'utf8')) || {})) if (v && Array.isArray(v.chats)) this.cache.set(k, v); } catch { /* none yet */ }
    }
  }

  saveCache() {
    if (!this.file) return;
    try { require('fs').writeFileSync(this.file, JSON.stringify(Object.fromEntries(this.cache))); } catch { /* ignore */ }
  }

  /** Forget cached chat lists (e.g. "Quên danh sách đã gặp" / disconnect). */
  clearCache() { this.cache.clear(); this.saveCache(); }

  /* ------------------------------------------------------------------ status */

  teamsApp() {
    const apps = (this.ctx.settings.get().integrations || {}).apps || [];
    return apps.find(a => a.provider === 'composio' && (a.toolkit === TEAMS_TOOLKIT || a.toolkit === 'microsoftteams' || a.toolkit === 'teams')) || null;
  }

  teamsStatus() {
    const app = this.teamsApp();
    const connectMode = this.ctx.integrations && this.ctx.integrations.active === this.ctx.integrations.connect_;
    if (!connectMode) return { state: STATE.unsupported, detail: 'Thêm khóa Composio ở tab 🔌 Kết nối để bé thấy đủ danh sách chat Teams.' };
    if (!app) return { state: STATE.notConnected, canConnect: true, toolkit: TEAMS_TOOLKIT, detail: 'Đăng nhập Teams (tài khoản công ty hoặc trường học) để bé thấy đủ danh sách chat.' };
    if (app.status !== 'active') return { state: STATE.notConnected, canConnect: true, toolkit: TEAMS_TOOLKIT, detail: 'Teams chưa đăng nhập xong — bấm Kết nối để thử lại.' };
    return { state: STATE.ready, detail: 'Đã kết nối Teams.' };
  }

  slackStatus() {
    const bot = this.ctx.secrets.get('slack.botToken');
    if (!bot) return { state: STATE.notConnected, detail: 'Kết nối Slack ở tab 🔌 Kết nối để bé thấy danh sách kênh và tin nhắn riêng.' };
    return { state: STATE.ready, detail: 'Đã kết nối Slack.' };
  }

  list() {
    return [
      { id: 'teams', app: 'teams', label: 'Microsoft Teams', icon: '👥', api: 'Teams', ...this.teamsStatus() },
      { id: 'slack', app: 'slack', label: 'Slack', icon: '💬', api: 'Slack', ...this.slackStatus() }
    ];
  }

  /* ------------------------------------------------------------------ chats */

  /**
   * @returns {Promise<{ state: string, detail?: string, chats: Array<{ id: string, title: string, direct: boolean,
   *   memberCount: number|null, lastActivity: number|null, members: Array<{ id: string, name: string }>|null }> }>}
   */
  async chats(id, { refresh = false } = {}) {
    const src = this.list().find(s => s.id === id);
    if (!src) return { state: STATE.error, detail: 'Nguồn không hỗ trợ', chats: [] };
    if (src.state !== STATE.ready) return { state: src.state, detail: src.detail, chats: [] };
    const hit = this.cache.get(id);
    const load = () => {
      if (!this.inflight.has(id)) {
        this.inflight.set(id, (async () => {
          try {
            const chats = id === 'teams' ? await this.teamsChats() : await this.slackChats();
            this.cache.set(id, { at: Date.now(), chats, partial: !!this.partial });
            this.saveCache();
            return { state: STATE.ready, chats, cachedAt: Date.now(), ...(this.partial ? { partial: true } : {}) };
          } catch (err) {
            return { state: err.state || STATE.error, detail: err.message, chats: [] };
          } finally { this.inflight.delete(id); }
        })());
      }
      return this.inflight.get(id);
    };
    if (!refresh && hit) {
      // Stale-while-revalidate: answer from the cache now, refresh in the background when old.
      if (Date.now() - hit.at > CACHE_MS) load();
      return { state: STATE.ready, chats: hit.chats, cachedAt: hit.at, ...(hit.partial ? { partial: true } : {}), ...(this.inflight.has(id) ? { refreshing: true } : {}) };
    }
    return load();
  }

  /** Members of one chat (Slack lists them lazily; Teams already returned them with the chat). */
  async members(id, chatId) {
    const res = await this.chats(id);
    const chat = res.chats.find(c => c.id === chatId);
    if (!chat) return { state: res.state, detail: res.detail || 'Không thấy cuộc chat', members: [] };
    if (chat.members) return { state: STATE.ready, members: chat.members };
    try {
      const members = id === 'teams' ? await this.teamsMembers(chatId) : await this.slackMembers(chatId);
      chat.members = members;
      chat.memberCount = members.length;
      return { state: STATE.ready, members };
    } catch (err) {
      return { state: err.state || STATE.error, detail: err.message, members: [] };
    }
  }

  /**
   * Graph call through Composio. Toolkits differ in how they join the endpoint to their base URL, so
   * try the forms in order (full URL, "/path", "/v1.0/path") and remember the one that works.
   * Diagnostics keep only status codes and Graph error codes — never response bodies.
   */
  async graph(path, query = {}, { method = 'GET', body } = {}) {
    const provider = this.ctx.integrations.connect_;
    const opts = { query, method, ...(body !== undefined ? { body } : {}) };
    if (/^https:/.test(path)) return provider.proxy(TEAMS_TOOLKIT, path, opts);
    const forms = [(p) => `https://graph.microsoft.com/v1.0${p}`, (p) => p, (p) => `/v1.0${p}`];
    const order = this.graphForm != null ? [this.graphForm, ...[0, 1, 2].filter(i => i !== this.graphForm)] : [0, 1, 2];
    const tried = [];
    let last = null;
    for (const i of order) {
      const r = await provider.proxy(TEAMS_TOOLKIT, forms[i](path), opts);
      if (r.status >= 200 && r.status < 300) { this.graphForm = i; return r; }
      const code = r.data && r.data.error && (r.data.error.code || r.data.error.message) ? String(r.data.error.code || r.data.error.message).slice(0, 60) : '';
      tried.push(`${['url', 'path', 'v1.0'][i]}:${r.status || '?'}${code ? `(${code})` : r.error ? `(${r.error.replace(/\s+/g, ' ').slice(0, 100)})` : ''}`);
      last = r;
      if (r.status === 401 || r.status === 403) break; // auth problem, not the URL form
    }
    return { ...last, tried: tried.join(' ') };
  }

  async teamsChats() {
    const me = await this.graph('/me', { $select: 'id,displayName' });
    if (me.status !== 200 && me.status !== 401 && me.status !== 403) throw new Error(`Teams chưa phản hồi (mã ${me.status || '?'}). Thử lại sau ít phút.`);
    if (me.status === 401 || me.status === 403) throw Object.assign(new Error('Teams cần đăng nhập lại — bấm Kết nối.'), { state: STATE.permission });
    const myId = me.data && me.data.id;
    const myName = me.data && me.data.displayName;
    this.me = me.data || {};
    this.partial = false;
    // 1) The chat list WITHOUT members: chat objects are small, so pages come back whole. (With
    //    $expand=members the reply is so big that Composio only returns a truncated preview.)
    const raw = [];
    let url = '/me/chats';
    let query = { $top: '50' };
    for (let page = 0, guard = 0; page < 20 && url && guard < 30; guard++) {
      const r = await this.graph(url, query);
      if (r.status === 200 && r.preview) {
        const top = Number(query.$top) || 50;
        if (top > 5) { query = { ...query, $top: String(Math.max(5, Math.floor(top / 2))) }; continue; }
        this.partial = true;
      }
      if (r.status === 401 || r.status === 403) {
        throw Object.assign(new Error('Tài khoản Teams này chưa cho xem danh sách chat (tài khoản cá nhân không hỗ trợ). Bạn vẫn có thể chọn từ các chat bé đã gặp hoặc nhập tên.'), { state: STATE.permission });
      }
      if (r.status !== 200 || !r.data) {
        const code = r.data && r.data.error && r.data.error.code ? ` ${String(r.data.error.code).slice(0, 60)}` : '';
        if (raw.length) { this.partial = true; break; } // keep what we have rather than nothing
        throw new Error(`Teams chưa trả về danh sách (mã ${r.status || '?'}${code}). Thử lại sau ít phút.`);
      }
      page++;
      for (const c of Array.isArray(r.data.value) ? r.data.value : []) {
        if (c && c.id) raw.push({ id: String(c.id), topic: c.topic ? String(c.topic).slice(0, 120) : '', type: String(c.chatType || ''), at: Date.parse(c.lastUpdatedDateTime) || null });
      }
      // nextLink is a full URL with its own query ($skiptoken…): split it so the proxy gets path + params.
      const next = r.data['@odata.nextLink'];
      url = null;
      if (next) {
        try { const u = new URL(next); url = u.pathname.replace(/^\/v1\.0/, ''); query = Object.fromEntries(u.searchParams.entries()); } catch { url = null; }
      }
    }
    raw.sort((a, b) => (b.at || 0) - (a.at || 0));

    // 2) Names for chats without a topic (every 1-1 chat, some small groups): member names via $batch.
    const names = await this.teamsMemberNames(raw.filter(c => !c.topic).slice(0, 200).map(c => c.id), myId, myName);
    const out = [];
    for (const c of raw) {
      const direct = c.type === 'oneOnOne';
      const members = names.get(c.id) || null;
      const title = c.topic || (members && members.length ? (direct ? members[0].name : members.map(m => m.name).slice(0, 3).join(', ')) : '');
      if (!title) continue;
      out.push({ id: c.id, title, direct, meeting: c.type === 'meeting', memberCount: members ? members.length + 1 : null, lastActivity: c.at, members: direct ? [] : members });
    }
    return out;
  }

  /** chatId → [{ id, name }] (yourself excluded) for up to `ids.length` chats, 10 per Graph $batch call. */
  async teamsMemberNames(ids, myId, myName) {
    const out = new Map();
    let size = 10;
    for (let i = 0; i < ids.length;) {
      const chunk = ids.slice(i, i + size);
      const r = await this.graph('/$batch', {}, { method: 'POST', body: { requests: chunk.map((id, k) => ({ id: String(k), method: 'GET', url: `/chats/${encodeURIComponent(id)}/members` })) } });
      if (r.status === 200 && r.preview && size > 2) { size = Math.max(2, Math.floor(size / 2)); continue; }
      if (r.status !== 200 || !r.data || !Array.isArray(r.data.responses)) { this.partial = true; break; }
      for (const res of r.data.responses) {
        const id = chunk[Number(res.id)];
        if (!id || res.status !== 200 || !res.body || !Array.isArray(res.body.value)) continue;
        out.set(id, this.memberList(res.body.value, myId, myName));
      }
      i += chunk.length;
    }
    return out;
  }

  memberList(value, myId, myName) {
    return value
      .filter(m => m && m.displayName && m.userId !== myId && !(myName && !m.userId && m.displayName === myName))
      .map(m => ({ id: String(m.userId || m.id || m.displayName), name: String(m.displayName).slice(0, 80) }));
  }

  async teamsMembers(chatId) {
    if (!this.me) {
      const me = await this.graph('/me', { $select: 'id,displayName' });
      this.me = me.status === 200 && me.data ? me.data : {};
    }
    const r = await this.graph(`/chats/${encodeURIComponent(chatId)}/members`, {});
    if (r.status === 401 || r.status === 403) throw Object.assign(new Error('Không có quyền xem thành viên nhóm này.'), { state: STATE.permission });
    if (r.status !== 200 || !r.data || !Array.isArray(r.data.value)) throw new Error('Chưa lấy được thành viên nhóm này — thử lại sau.');
    return this.memberList(r.data.value, this.me.id, this.me.displayName);
  }

  async slackApi(method, params = {}) {
    const bot = this.ctx.secrets.get('slack.botToken');
    const res = await this.fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bot}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });
    const j = await res.json();
    if (!j.ok) {
      const perm = ['missing_scope', 'not_allowed_token_type', 'invalid_auth', 'not_authed', 'token_revoked'].includes(j.error);
      throw Object.assign(new Error(perm ? `Slack: bot thiếu quyền (${j.error}) — cần channels:read, groups:read, im:read, mpim:read, users:read.` : `Slack: ${j.error}`), { state: perm ? STATE.permission : STATE.error });
    }
    return j;
  }

  async slackUser(id) {
    this.slackNames = this.slackNames || new Map();
    if (this.slackNames.has(id)) return this.slackNames.get(id);
    let name = null;
    try { const r = await this.slackApi('users.info', { user: id }); name = (r && r.user && (r.user.profile.display_name || r.user.real_name || r.user.name)) || null; } catch { /* retry next time */ }
    if (!name) return id; // a failed lookup must not pin the raw id as the name forever
    this.slackNames.set(id, name);
    return name;
  }

  async slackChats() {
    const out = [];
    let cursor = '';
    for (let page = 0; page < 5; page++) {
      const r = await this.slackApi('conversations.list', { types: 'public_channel,private_channel,im,mpim', exclude_archived: 'true', limit: '200', ...(cursor ? { cursor } : {}) });
      for (const c of r.channels || []) {
        if (c.is_im) out.push({ id: c.id, title: await this.slackUser(c.user), direct: true, memberCount: 2, lastActivity: (c.updated || c.created || 0) * 1000 || null, members: [] });
        else out.push({ id: c.id, title: c.is_mpim ? String(c.purpose && c.purpose.value || c.name) : `#${c.name}`, direct: false, memberCount: Number.isFinite(c.num_members) ? c.num_members : null, lastActivity: (c.updated || c.created || 0) * 1000 || null, members: null });
      }
      cursor = r.response_metadata && r.response_metadata.next_cursor;
      if (!cursor) break;
    }
    return out.sort((a, b) => (b.lastActivity || 0) - (a.lastActivity || 0));
  }

  async slackMembers(chatId) {
    const r = await this.slackApi('conversations.members', { channel: chatId, limit: '200' });
    const ids = (r.members || []).slice(0, 200);
    const out = [];
    for (const id of ids) out.push({ id, name: await this.slackUser(id) });
    return out;
  }
}

module.exports = { ChatSources, STATE };
