/**
 * Composio provider — dynamic app connections (1000+ toolkits) instead of hard-coded adapters.
 *
 * Runs ONLY in the main process. The user's own Composio API key is kept encrypted by the OS
 * (SecretStore → Keychain / DPAPI) and is never sent to the renderer or shipped in the binary.
 *
 * Flow:  search catalog → connect (Composio hosted OAuth page in the browser) → pick events
 *        (trigger types) → Composio delivers each event to the project webhook (the user's
 *        Gateway, see /gateway) → Gateway → this app over SSE. No inbound port on this machine.
 *
 * Endpoints: Composio REST v3.1 (https://docs.composio.dev). Response shapes are parsed
 * tolerantly (items | data | array) because only the request shapes are documented precisely.
 */
const crypto = require('crypto');

const BASE = 'https://backend.composio.dev';
const KEY = 'composio.apiKey';

const arr = (j) => (Array.isArray(j) ? j : Array.isArray(j && j.items) ? j.items : Array.isArray(j && j.data) ? j.data : []);
const pick = (o, ...keys) => { for (const k of keys) { const v = k.split('.').reduce((x, p) => (x == null ? x : x[p]), o); if (v != null && v !== '') return v; } return undefined; };
const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);

class ComposioError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

class ComposioProvider {
  /**
   * @param {{ settings: import('../core/settings-store').SettingsStore, secrets: any, openExternal?: (url:string)=>void, fetch?: typeof fetch, log?: Function }} ctx
   */
  constructor(ctx) {
    this.ctx = ctx;
    this.fetch = ctx.fetch || globalThis.fetch;
    this.sessionId = null;
    this.catalogCache = new Map(); // query → { at, items }
  }

  get id() { return 'composio'; }
  hasKey() { return this.ctx.secrets.has(KEY); }

  userId() {
    let uid = this.ctx.settings.get().integrations.composioUserId;
    if (!uid) {
      // Random, anonymous id — never the user's email.
      uid = `cpc-${crypto.randomBytes(8).toString('hex')}`;
      this.ctx.settings.update({ integrations: { composioUserId: uid } });
    }
    return uid;
  }

  async request(method, path, body) {
    const key = this.ctx.secrets.get(KEY);
    if (!key) throw new ComposioError('Chưa nhập khóa Composio', 401);
    let res;
    try {
      res = await this.fetch(`${BASE}${path}`, {
        method,
        headers: { 'x-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(15000)
      });
    } catch (err) {
      throw new ComposioError(`Không kết nối được Composio (${err.name === 'TimeoutError' ? 'quá thời gian' : 'mạng'})`, 0);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    if (!res.ok) {
      const msg = pick(json || {}, 'error.message', 'message', 'error') || `HTTP ${res.status}`;
      if (res.status === 401 || res.status === 403) {
        const hint = /^ak_/i.test(key) ? '' : ' — cần khóa dự án bắt đầu bằng ak_ (Project → Settings → API Keys)';
        throw new ComposioError(`Composio từ chối khóa: ${String(msg).slice(0, 120)}${hint}`, res.status);
      }
      throw new ComposioError(String(msg).slice(0, 200), res.status);
    }
    return json;
  }

  /** Save + validate the user's key. Pass '' to remove it. */
  async setKey(key) {
    const k = String(key || '').trim();
    if (!k) { this.ctx.secrets.set(KEY, null); this.sessionId = null; return this.status(); }
    if (k.length < 10 || k.length > 400) throw new ComposioError('Khóa không đúng định dạng', 400);
    if (/^uak_/i.test(k)) throw new ComposioError('Đây là khóa người dùng (uak_…). Hãy dùng khóa dự án (ak_…): composio.dev → mở Project → Settings → API Keys', 400);
    const prev = this.ctx.secrets.get(KEY);
    this.ctx.secrets.set(KEY, k);
    try {
      await this.request('GET', '/api/v3.1/toolkits?limit=1');
    } catch (err) {
      this.ctx.secrets.set(KEY, prev || null);
      throw err;
    }
    this.sessionId = null;
    this.catalogCache.clear();
    return this.status();
  }

  status() {
    return { provider: 'composio', name: 'Composio', keySet: this.hasKey(), apps: this.apps() };
  }

  apps() { return this.ctx.settings.get().integrations.apps.filter(a => a.provider === 'composio'); }

  saveApps(apps) { this.ctx.settings.update({ integrations: { apps } }); }

  upsertApp(toolkit, patch) {
    const apps = this.ctx.settings.get().integrations.apps;
    const i = apps.findIndex(a => a.provider === 'composio' && a.toolkit === toolkit);
    if (i >= 0) apps[i] = { ...apps[i], ...patch };
    else apps.push({ provider: 'composio', toolkit, name: toolkit, logo: '', connectedAccountId: '', status: 'pending', triggers: [], addedAt: Date.now(), ...patch });
    this.saveApps(apps);
    return this.apps().find(a => a.toolkit === toolkit);
  }

  static mapToolkit(t) {
    const slug = slugOf(pick(t, 'slug', 'key', 'name'));
    const logo = String(pick(t, 'meta.logo', 'logo', 'meta.icon') || '');
    return {
      provider: 'composio',
      toolkit: slug,
      name: String(pick(t, 'name', 'display_name', 'slug') || slug).slice(0, 80),
      description: String(pick(t, 'meta.description', 'description') || '').slice(0, 240),
      logo: /^https:\/\//.test(logo) ? logo : '',
      categories: arr(pick(t, 'meta.categories', 'categories') || []).map(c => String(typeof c === 'string' ? c : pick(c, 'name', 'slug') || '')).filter(Boolean).slice(0, 4),
      triggersCount: Number(pick(t, 'meta.triggers_count', 'triggers_count')) || 0
    };
  }

  /** Search the Composio toolkit catalog. */
  async catalog({ q = '', category = '', limit = 40 } = {}) {
    const query = String(q).trim().slice(0, 60);
    const cat = slugOf(category);
    const ck = `${query}|${cat}|${limit}`;
    const hit = this.catalogCache.get(ck);
    if (hit && Date.now() - hit.at < 10 * 60 * 1000) return hit.items;
    const params = new URLSearchParams({ limit: String(Math.min(100, Math.max(1, limit))) });
    if (query) params.set('search', query);
    if (cat) params.set('category', cat);
    const json = await this.request('GET', `/api/v3.1/toolkits?${params}`);
    const items = arr(json).map(ComposioProvider.mapToolkit).filter(t => t.toolkit);
    this.catalogCache.set(ck, { at: Date.now(), items });
    return items;
  }

  async session() {
    if (this.sessionId) return this.sessionId;
    const json = await this.request('POST', '/api/v3.1/tool_router/session', { user_id: this.userId() });
    this.sessionId = pick(json || {}, 'session_id', 'id', 'session.id');
    if (!this.sessionId) throw new ComposioError('Composio không trả về phiên kết nối', 502);
    return this.sessionId;
  }

  /** Start connecting an app: opens Composio's hosted sign-in page in the user's browser. */
  async connect({ toolkit, name, logo }) {
    const slug = slugOf(toolkit);
    if (!slug) throw new ComposioError('Thiếu tên ứng dụng', 400);
    const sid = await this.session();
    const json = await this.request('POST', `/api/v3.1/tool_router/session/${encodeURIComponent(sid)}/link`, { toolkit: slug });
    const url = pick(json || {}, 'redirect_url', 'redirectUrl', 'url', 'link');
    this.upsertApp(slug, { name: String(name || slug).slice(0, 80), logo: /^https:\/\//.test(String(logo || '')) ? logo : '', status: 'pending' });
    if (url && /^https:\/\//.test(url) && this.ctx.openExternal) this.ctx.openExternal(url);
    return { ok: true, opened: !!url };
  }

  /** Pull connection state from Composio and update the local "my apps" list. */
  async refresh() {
    const params = new URLSearchParams({ user_ids: this.userId(), limit: '100' });
    const json = await this.request('GET', `/api/v3.1/connected_accounts?${params}`);
    const accounts = arr(json);
    const apps = this.ctx.settings.get().integrations.apps;
    for (const acc of accounts) {
      const slug = slugOf(pick(acc, 'toolkit.slug', 'toolkit_slug', 'appName', 'toolkit'));
      if (!slug) continue;
      const raw = String(pick(acc, 'status') || '').toUpperCase();
      const status = raw === 'ACTIVE' ? 'active' : raw === 'EXPIRED' ? 'expired' : raw === 'FAILED' || raw === 'INACTIVE' ? 'error' : 'pending';
      const id = String(pick(acc, 'id', 'nanoid') || '');
      const cur = apps.find(a => a.provider === 'composio' && a.toolkit === slug);
      if (cur) {
        // Prefer an active account when there are several for the same toolkit.
        if (cur.status !== 'active' || status === 'active') Object.assign(cur, { status, connectedAccountId: id });
      } else {
        apps.push({ provider: 'composio', toolkit: slug, name: slug, logo: '', connectedAccountId: id, status, triggers: [], addedAt: Date.now() });
      }
    }
    this.saveApps(apps);
    await this.refreshTriggers().catch(() => {});
    return this.status();
  }

  async refreshTriggers() {
    const params = new URLSearchParams({ user_ids: this.userId(), limit: '200' });
    const json = await this.request('GET', `/api/v3.1/trigger_instances/active?${params}`);
    const active = arr(json);
    const apps = this.ctx.settings.get().integrations.apps;
    for (const a of apps) {
      if (a.provider !== 'composio') continue;
      const mine = active.filter(t => {
        const acc = String(pick(t, 'connected_account_id', 'connectedAccountId', 'connected_account.id') || '');
        const tk = slugOf(pick(t, 'toolkit.slug', 'toolkit_slug') || '');
        return (a.connectedAccountId && acc === a.connectedAccountId) || tk === a.toolkit;
      });
      if (mine.length || active.length) {
        a.triggers = mine.map(t => ({ slug: String(pick(t, 'trigger_name', 'trigger_slug', 'slug', 'triggerName') || '').toUpperCase(), instanceId: String(pick(t, 'id', 'trigger_id', 'nanoid') || ''), name: '' })).filter(t => t.slug);
      }
    }
    this.saveApps(apps);
  }

  /** Events an app can send (e.g. "New message", "PR opened"). */
  async triggerTypes(toolkit) {
    const params = new URLSearchParams({ toolkit_slugs: slugOf(toolkit), limit: '50' });
    const json = await this.request('GET', `/api/v3.1/triggers_types?${params}`);
    return arr(json).map(t => ({
      slug: String(pick(t, 'slug', 'name', 'enum') || '').toUpperCase(),
      name: String(pick(t, 'name', 'display_name', 'slug') || '').slice(0, 120),
      description: String(pick(t, 'description', 'instructions') || '').slice(0, 240),
      type: String(pick(t, 'type') || '').toLowerCase() // 'webhook' (push) | 'poll'
    })).filter(t => t.slug);
  }

  /** Turn an event on/off for a connected app. */
  async setTrigger({ toolkit, slug, name, enabled }) {
    const tk = slugOf(toolkit);
    const s = String(slug || '').toUpperCase().replace(/[^A-Z0-9_]/g, '');
    const app = this.apps().find(a => a.toolkit === tk);
    if (!app) throw new ComposioError('Ứng dụng chưa được thêm', 404);
    const triggers = [...app.triggers];
    if (enabled) {
      if (app.status !== 'active') throw new ComposioError('Hãy hoàn tất đăng nhập ứng dụng trước', 409);
      const body = { user_id: this.userId(), trigger_config: {} };
      if (app.connectedAccountId) body.connected_account_id = app.connectedAccountId;
      const json = await this.request('POST', `/api/v3.1/trigger_instances/${encodeURIComponent(s)}/upsert`, body);
      const instanceId = String(pick(json || {}, 'trigger_id', 'id', 'triggerId', 'nanoid') || '');
      const i = triggers.findIndex(t => t.slug === s);
      const entry = { slug: s, instanceId, name: String(name || '').slice(0, 120) };
      if (i >= 0) triggers[i] = entry; else triggers.push(entry);
    } else {
      const t = triggers.find(x => x.slug === s);
      if (t && t.instanceId) await this.request('DELETE', `/api/v3.1/trigger_instances/manage/${encodeURIComponent(t.instanceId)}`);
      triggers.splice(triggers.findIndex(x => x.slug === s), 1);
    }
    return this.upsertApp(tk, { triggers });
  }

  /** Remove an app: disables its events and deletes the connection at Composio. */
  async remove(toolkit) {
    const tk = slugOf(toolkit);
    const app = this.apps().find(a => a.toolkit === tk);
    if (!app) return this.status();
    if (this.hasKey()) {
      for (const t of app.triggers) if (t.instanceId) await this.request('DELETE', `/api/v3.1/trigger_instances/manage/${encodeURIComponent(t.instanceId)}`).catch(() => {});
      if (app.connectedAccountId) await this.request('DELETE', `/api/v3.1/connected_accounts/${encodeURIComponent(app.connectedAccountId)}`).catch(() => {});
    }
    this.saveApps(this.ctx.settings.get().integrations.apps.filter(a => !(a.provider === 'composio' && a.toolkit === tk)));
    return this.status();
  }
}

module.exports = { ComposioProvider, ComposioError };
