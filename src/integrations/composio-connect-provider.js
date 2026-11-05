/**
 * Composio Connect provider — for "consumer" keys (ck_…) from dashboard.composio.dev → Connect.
 *
 * These keys cannot call the REST API (toolkits / triggers return 401), but they do work with the
 * Composio Connect MCP server (https://connect.composio.dev/mcp, header x-consumer-api-key).
 * Through its meta-tools the app can:
 *   - search apps            COMPOSIO_SEARCH_TOOLS          → toolkit_connection_statuses
 *   - connect / list / remove COMPOSIO_MANAGE_CONNECTIONS   → redirect_url, accounts[].status
 *   - read new items          COMPOSIO_MULTI_EXECUTE_TOOL   → results[].response.data
 *
 * Consumer keys have no triggers, so new items are found by POLLING a few verified "list recent"
 * tools on a schedule. Everything from here is labelled near_realtime_poll — never realtime.
 * The first poll of each app only records what already exists (no flood of old items).
 */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const MCP_URL = 'https://connect.composio.dev/mcp';
const KEY = 'composio.apiKey';
const logoOf = (slug) => `https://logos.composio.dev/api/${encodeURIComponent(slug)}`;
const slugOf = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_-]/g, '').slice(0, 60);
const pick = (o, ...keys) => { for (const k of keys) { const v = k.split('.').reduce((x, p) => (x == null ? x : x[p]), o); if (v != null && v !== '') return v; } return undefined; };
const arrAt = (o, ...keys) => { for (const k of keys) { const v = pick(o, k); if (Array.isArray(v)) return v; } return Array.isArray(o) ? o : []; };
/** Jira status → colour tone for the card (by status category, refined by name). */
const jiraTone = (name, cat) => {
  const n = String(name || '').toLowerCase();
  if (/block|reject|fail|cancel|hủy|huỷ/.test(n)) return 'danger';
  if (/review|qa|test|verify|uat|kiểm/.test(n)) return 'review';
  const c = String(cat || '').toLowerCase();
  if (c === 'done' || /done|closed|resolved|xong|hoàn/.test(n)) return 'done';
  if (c === 'indeterminate' || /progress|doing|đang/.test(n)) return 'progress';
  return 'todo';
};
/** Card details shared by every Jira card. */
const jiraMeta = (o) => ({
  kind: 'jira', key: o.key, type: o.type || null, status: o.status || null, statusTone: o.status ? jiraTone(o.status, o.statusCat) : null,
  priority: o.priority || null, labels: Array.isArray(o.labels) ? o.labels.slice(0, 5) : [], people: o.people || [], event: o.event || null
});

/** Plain text of an Atlassian Document Format body (comments); mentions become "@Name". */
const adfText = (n) => {
  if (!n || typeof n !== 'object') return typeof n === 'string' ? n : '';
  if (n.type === 'text') return String(n.text || '');
  if (n.type === 'mention') return String((n.attrs && n.attrs.text) || '@…');
  const inner = Array.isArray(n.content) ? n.content.map(adfText).join(n.type === 'doc' ? ' ' : '') : '';
  return inner.replace(/\s+/g, ' ').trim();
};
const toTime = (v) => { if (v == null || v === '') return null; const n = Number(v); const t = Number.isFinite(n) && n > 1e11 ? n : Number.isFinite(n) && n > 1e9 ? n * 1000 : Date.parse(v); return Number.isFinite(t) ? t : null; };

/**
 * Verified tool slugs (from COMPOSIO_SEARCH_TOOLS schemas, 04/11/2026). Each recipe returns
 * normalized items: { id, title, message, url, at }.
 */
const RECIPES = {
  gmail: {
    name: 'Gmail', event: 'Thư mới chưa đọc', app: 'gmail',
    tool: () => ({ tool_slug: 'GMAIL_FETCH_EMAILS', arguments: { query: 'is:unread newer_than:1d', max_results: 10, verbose: false, include_payload: false } }),
    items: (d) => arrAt(d, 'messages', 'data.messages').map(m => ({
      id: pick(m, 'messageId', 'id'), title: pick(m, 'subject') || '(Không có tiêu đề)', message: String(pick(m, 'sender', 'from') || ''),
      url: `https://mail.google.com/mail/u/0/#inbox/${encodeURIComponent(pick(m, 'threadId', 'messageId', 'id') || '')}`, at: toTime(pick(m, 'messageTimestamp', 'internalDate', 'date'))
    }))
  },
  outlook: {
    name: 'Outlook', event: 'Thư mới chưa đọc', app: 'outlook',
    tool: () => ({ tool_slug: 'OUTLOOK_QUERY_EMAILS', arguments: { top: 10, folder: 'inbox', filter: 'isRead eq false' } }),
    items: (d) => arrAt(d, 'value', 'data.value', 'messages').map(m => ({
      id: pick(m, 'id'), title: pick(m, 'subject') || '(Không có tiêu đề)', message: String(pick(m, 'from.emailAddress.name', 'from.emailAddress.address') || ''),
      url: pick(m, 'webLink'), at: toTime(pick(m, 'receivedDateTime'))
    }))
  },
  github: {
    name: 'GitHub', event: 'Thông báo mới (PR, issue, nhắc tên)', app: 'github',
    tool: () => ({ tool_slug: 'GITHUB_LIST_NOTIFICATIONS', arguments: { all: false, per_page: 20 } }),
    items: (d) => arrAt(d, 'notifications', 'details', 'data', 'items').map(n => ({
      id: `${pick(n, 'id')}@${pick(n, 'updated_at') || ''}`, title: pick(n, 'subject.title') || 'Thông báo GitHub', message: String(pick(n, 'repository.full_name') || ''),
      url: 'https://github.com/notifications', at: toTime(pick(n, 'updated_at'))
    }))
  },
  googlecalendar: {
    name: 'Google Calendar', event: 'Nhắc trước cuộc họp 5 phút', app: 'calendar',
    tool: () => ({ tool_slug: 'GOOGLECALENDAR_EVENTS_LIST', arguments: { calendarId: 'primary', timeMin: new Date().toISOString(), timeMax: new Date(Date.now() + 6 * 60000).toISOString(), maxResults: 10, singleEvents: true, orderBy: 'startTime' } }),
    items: (d) => arrAt(d, 'items', 'events', 'data.items').map(e => ({
      id: `${pick(e, 'id')}@${pick(e, 'start.dateTime', 'start.date') || ''}`, title: `Sắp họp: ${pick(e, 'summary') || 'Sự kiện'}`, message: String(pick(e, 'location') || ''),
      url: pick(e, 'htmlLink'), at: toTime(pick(e, 'start.dateTime', 'start.date'))
    })),
    notifyExisting: true // a meeting that is about to start is news even on the first poll
  },
  jira: {
    name: 'Jira', event: 'Việc mới giao cho bạn, đổi trạng thái, bình luận & @nhắc tên', app: 'jira',
    // Open issues assigned to me. Item id = key@status → a card only for a NEW assignment or a
    // STATUS change, not for every edit (comments, own edits…).
    tool: () => ({ tool_slug: 'JIRA_SEARCH_FOR_ISSUES_USING_JQL_GET', arguments: { jql: 'assignee = currentUser() AND statusCategory != Done ORDER BY updated DESC', max_results: 20, fields: ['summary', 'updated', 'status', 'priority', 'reporter', 'labels', 'issuetype'] } }),
    items: (d) => arrAt(d, 'issues', 'data.issues').map(i => {
      // Composio returns flattened issues (summary, status{name}, browser_url…); raw Jira uses fields.*.
      const key = String(pick(i, 'key') || '');
      const browser = String(pick(i, 'browser_url') || '');
      const self = String(pick(i, 'self') || '');
      const site = (self.match(/^(https:\/\/[a-z0-9-]+\.atlassian\.net)\//i) || [])[1];
      const url = /^https:\/\/[a-z0-9-]+\.atlassian\.net\/browse\//i.test(browser) ? browser : site && key ? `${site}/browse/${encodeURIComponent(key)}` : undefined;
      const status = String(pick(i, 'status.name', 'fields.status.name') || (typeof i.status === 'string' ? i.status : ''));
      const reporter = String(pick(i, 'reporter.display_name', 'reporter.displayName', 'fields.reporter.displayName') || '');
      const prioName = String(pick(i, 'priority.name', 'fields.priority.name') || '');
      const prio = prioName.toLowerCase();
      const summary = String(pick(i, 'summary', 'fields.summary') || '');
      const labels = (Array.isArray(pick(i, 'labels')) ? pick(i, 'labels') : Array.isArray(pick(i, 'fields.labels')) ? pick(i, 'fields.labels') : []).map(String);
      const type = String(pick(i, 'issuetype.name', 'issue_type.name', 'fields.issuetype.name') || (typeof i.issuetype === 'string' ? i.issuetype : ''));
      const statusCat = pick(i, 'status.statusCategory.key', 'status.status_category.key', 'fields.status.statusCategory.key');
      return {
        id: `${key}@${status}`, title: `${key} ${summary}`.trim(), message: '',
        url, at: toTime(pick(i, 'updated', 'fields.updated')),
        priority: /highest|critical|blocker/.test(prio) ? 'critical' : /high/.test(prio) ? 'important' : 'normal',
        key, summary, status, reporter,
        meta: jiraMeta({ key, type, status, statusCat, priority: prioName, labels, people: reporter ? [{ label: 'Người tạo', value: reporter }] : [] })
      };
    }),
    async enrich(provider, it, { isChange }) {
      if (isChange) {
        it.meta.event = `🔄 Chuyển sang ${it.status || 'trạng thái mới'}`;
        return;
      }
      it.meta.event = '🧩 Việc mới giao cho bạn';
      const by = await provider.jiraAssignedBy(it.key);
      it.meta.people = [{ label: 'Giao bởi', value: by || 'không có thông tin' }, ...(it.reporter ? [{ label: 'Người tạo', value: it.reporter }] : [])];
    }
  }
};
// Bitbucket: Composio's list tool has no reviewer filter and its responses get truncated, so
// this one uses COMPOSIO_PROXY_EXECUTE with Bitbucket's own query language instead.
RECIPES.bitbucket = { name: 'Bitbucket', event: 'PR cần bạn review (có nút Approve) · approve / yêu cầu sửa / bình luận trên PR của bạn', app: 'bitbucket', custom: true };
const BB_REPO_LIMIT = 25;
const BB_REPO_REFRESH_MS = 30 * 60 * 1000;
const BB_FIELDS = 'values.id,values.title,values.updated_on,values.links.html.href,values.author.display_name,values.participants.user.uuid,values.participants.approved,values.destination.repository.full_name,values.source.branch.name,values.destination.branch.name';
const bbBranch = (pr) => { const a = pick(pr, 'source.branch.name'), b = pick(pr, 'destination.branch.name'); return a && b ? `${a} → ${b}` : null; };
const bbSafe = (s) => /^[A-Za-z0-9_.-]{1,100}$/.test(String(s || ''));

const POPULAR = ['gmail', 'outlook', 'googlecalendar', 'github', 'jira', 'notion', 'slack', 'microsoft_teams', 'trello', 'linear', 'asana', 'discord', 'hubspot', 'googledrive', 'bitbucket', 'clickup'];

class ComposioConnectProvider extends EventEmitter {
  /** @param {{ settings, secrets, openExternal?, fetch?, log?, pollSeconds?: () => number }} ctx */
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.fetch = ctx.fetch || globalThis.fetch;
    this.seen = new Map();   // toolkit → Set(item ids)
    // What was already seen survives restarts (otherwise every restart re-baselines and anything that
    // happened meanwhile is swallowed). Ids/timestamps/counters only — no content.
    this.stateFile = ctx.dataDir ? require('path').join(ctx.dataDir, 'composio-seen.json') : null;
    this.snap = { bbMine: {}, jiraAct: {} };
    if (this.stateFile) {
      try {
        const st = JSON.parse(require('fs').readFileSync(this.stateFile, 'utf8')) || {};
        for (const [k, v] of Object.entries(st.seen || {})) if (Array.isArray(v)) this.seen.set(k, new Set(v));
        this.snap = { bbMine: st.bbMine || {}, jiraAct: st.jiraAct || {}, bbMineInit: !!st.bbMineInit, jiraActInit: !!st.jiraActInit };
      } catch { /* first run */ }
    }
    this.timer = null;
    this.polling = false;
    this.lastPollAt = null;
    this.lastError = '';
    this.rpcId = 0;
    this.bb = { me: null, repos: [], reposAt: 0 };
    this.prTargets = new Map(); // sourceEventId → { ws, repo, id } (kept in main only)
  }

  get id() { return 'composio'; }
  static isConsumerKey(k) { return /^ck_/i.test(String(k || '')); }
  hasKey() { return this.ctx.secrets.has(KEY); }

  async mcp(method, params, key = this.ctx.secrets.get(KEY)) {
    if (!key) throw Object.assign(new Error('Chưa nhập khóa Composio'), { status: 401 });
    let res;
    try {
      res = await this.fetch(MCP_URL, {
        method: 'POST',
        headers: { 'x-consumer-api-key': key, 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: ++this.rpcId, method, params }),
        signal: AbortSignal.timeout(60000)
      });
    } catch (err) {
      throw Object.assign(new Error(`Không kết nối được Composio (${err.name === 'TimeoutError' ? 'quá thời gian' : 'mạng'})`), { status: 0 });
    }
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw Object.assign(new Error('Composio từ chối khóa Connect (ck_…) — hãy tạo khóa mới trong Connect → Sessions & API Key'), { status: res.status });
    if (!res.ok) throw Object.assign(new Error(`Composio lỗi HTTP ${res.status}`), { status: res.status });
    // Streamable HTTP: either plain JSON or an SSE stream whose last "data:" line is the reply.
    const lines = text.split('\n').filter(l => l.startsWith('data:'));
    let msg;
    try { msg = JSON.parse(lines.length ? lines[lines.length - 1].slice(5) : text); } catch { throw Object.assign(new Error('Phản hồi Composio không đọc được'), { status: 502 }); }
    if (msg.error) throw Object.assign(new Error(String(msg.error.message || 'Lỗi Composio').slice(0, 200)), { status: 502 });
    return msg.result;
  }

  /** Call a meta-tool and return its parsed JSON payload. */
  async tool(name, args, key) {
    const r = await this.mcp('tools/call', { name, arguments: args }, key);
    const text = r && Array.isArray(r.content) ? r.content.filter(c => c.type === 'text').map(c => c.text).join('') : '';
    let j;
    try { j = JSON.parse(text); } catch { j = { successful: !r.isError, data: text }; }
    if (r.isError && !j.data) throw Object.assign(new Error(String(text).slice(0, 200) || 'Lỗi Composio'), { status: 502 });
    return j;
  }

  /** Raw API call to a connected app, authenticated by Composio with the user's account. */
  async proxy(toolkit, endpoint, { method = 'GET', query = {}, body } = {}) {
    const parameters = Object.entries(query).map(([name, value]) => ({ name, value: String(value), type: 'query' }));
    const j = await this.tool('COMPOSIO_PROXY_EXECUTE', { toolkit_slug: toolkit, endpoint, method, ...(parameters.length ? { parameters } : {}), ...(body !== undefined ? { body } : {}) });
    // Two reply shapes: { data: { status, data } } or, for large replies,
    // { data: { results: [{ response: { data | data_preview: { status, data, headers } } }] } }.
    const top = j && j.data && typeof j.data === 'object' ? j.data : {};
    const res0 = Array.isArray(top.results) && top.results[0] && top.results[0].response;
    const d = res0 ? (res0.data && typeof res0.data === 'object' && 'status' in res0.data ? res0.data : res0.data_preview || {}) : top;
    const status = Number(d.status) || 0;
    const error = !status ? String((j && j.error) || (res0 && res0.error) || (typeof j.data === 'string' ? j.data : '') || 'phản hồi Composio không có mã HTTP').slice(0, 160) : '';
    // data_preview = Composio truncated a large reply (the full one stays in their sandbox): callers
    // must not treat it as complete — ask for less (fewer fields / smaller page) instead.
    return { status, data: d.data, ...(res0 && !res0.data && res0.data_preview ? { preview: true } : {}), ...(error ? { error } : {}) };
  }

  async bitbucketRepos() {
    if (this.bb.me && this.bb.repos.length && Date.now() - this.bb.reposAt < BB_REPO_REFRESH_MS) return this.bb.repos;
    const me = await this.proxy('bitbucket', '/user');
    if (me.status !== 200 || !me.data || !me.data.uuid) throw new Error(`Bitbucket: không đọc được tài khoản (HTTP ${me.status})`);
    this.bb.me = String(me.data.uuid);
    const ws = await this.proxy('bitbucket', '/user/workspaces', { query: { pagelen: 50 } });
    const slugs = arrAt(ws.data, 'values').map(v => pick(v, 'workspace.slug', 'slug')).filter(bbSafe);
    this.bb.workspaces = slugs;
    const repos = [];
    for (const w of slugs) {
      const r = await this.proxy('bitbucket', `/repositories/${w}`, { query: { sort: '-updated_on', pagelen: BB_REPO_LIMIT, fields: 'values.slug' } });
      for (const v of arrAt(r.data, 'values')) if (bbSafe(v.slug)) repos.push({ ws: w, slug: v.slug });
    }
    this.bb.repos = repos.slice(0, BB_REPO_LIMIT);
    this.bb.reposAt = Date.now();
    return this.bb.repos;
  }

  /** Open PRs (recently updated repos) where the signed-in user is a reviewer and hasn't approved. */
  async bitbucketReviewItems() {
    const repos = await this.bitbucketRepos();
    const me = this.bb.me;
    const q = `state="OPEN" AND reviewers.uuid="${me.replace(/[^{}A-Za-z0-9-]/g, '')}"`;
    const out = [];
    for (let i = 0; i < repos.length; i += 5) { // 5 requests at a time
      const batch = await Promise.all(repos.slice(i, i + 5).map(r => this.proxy('bitbucket', `/repositories/${r.ws}/${r.slug}/pullrequests`, { query: { q, fields: BB_FIELDS, pagelen: 20 } }).then(x => ({ r, x })).catch(() => null)));
      for (const b of batch) {
        if (!b || b.x.status !== 200) continue;
        for (const pr of arrAt(b.x.data, 'values')) {
          const approved = arrAt(pr, 'participants').some(p => pick(p, 'user.uuid') === me && p.approved);
          if (approved || !Number.isInteger(pr.id)) continue;
          out.push({
            key: `${b.r.ws}/${b.r.slug}#${pr.id}`, ws: b.r.ws, repo: b.r.slug, id: pr.id,
            title: String(pr.title || `PR #${pr.id}`), author: String(pick(pr, 'author.display_name') || ''),
            url: pick(pr, 'links.html.href'), at: toTime(pr.updated_on), branch: bbBranch(pr)
          });
        }
      }
    }
    return out;
  }

  async pollBitbucket() {
    const items = await this.bitbucketReviewItems();
    (this.lastCounts = this.lastCounts || {}).bitbucket = { items: items.length, repos: this.bb.repos.length, baseline: !this.seen.has('bitbucket') };
    const first = !this.seen.has('bitbucket');
    const seen = this.seen.get('bitbucket') || new Set();
    const fresh = items.filter(it => !seen.has(it.key));
    items.forEach(it => seen.add(it.key));
    this.seen.set('bitbucket', seen);
    const sidOf = (it) => `composio:bitbucket:${crypto.createHash('sha1').update(it.key).digest('hex').slice(0, 16)}`;
    for (const it of fresh) {
      this.prTargets.set(sidOf(it), { ws: it.ws, repo: it.repo, id: it.id });
      if (this.prTargets.size > 300) this.prTargets.delete(this.prTargets.keys().next().value);
    }
    if (fresh.length > 1) {
      // Several at once (e.g. at start-up): ONE card listing every PR, each row with its own Approve.
      const rows = fresh.slice(0, 6);
      this.emit('notification', {
        title: `🔍 ${fresh.length} PR đang chờ bạn review`, message: '', app: 'bitbucket',
        url: 'https://bitbucket.org/dashboard/pullrequests', priority: 'important', duration: 60000,
        items: rows.map(it => ({ key: sidOf(it), title: it.title, subtitle: `${it.repo} #${it.id}${it.author ? ` · ${it.author}` : ''}${it.branch ? ` · ${it.branch}` : ''}`, url: it.url && /^https:\/\/bitbucket\.org\//.test(it.url) ? it.url : undefined, actions: ['approve'] })),
        moreCount: fresh.length - rows.length,
        sourceEventId: `composio:bitbucket:batch:${Date.now()}`
      });
      return fresh.length;
    }
    for (const it of fresh) {
      const sid = sidOf(it);
      this.emit('notification', {
        title: it.title.slice(0, 200), message: '', app: 'bitbucket',
        meta: { kind: 'bitbucket', event: '🔍 Cần bạn review', key: `#${it.id}`, status: 'Chờ review', statusTone: 'review', repo: it.repo, branch: it.branch, people: it.author ? [{ label: 'Tác giả', value: it.author }] : [] },
        url: it.url && /^https:\/\/bitbucket\.org\//.test(it.url) ? it.url : undefined, priority: 'important', duration: 30000,
        actions: ['approve'], sourceEventId: sid, sourceCreatedAt: it.at || undefined
      });
    }
    return fresh.length;
  }

  /** Jira REST through Composio needs the Atlassian cloud gateway URL: api.atlassian.com/ex/jira/{cloudId}. */
  async jiraBase() {
    if (this.jira && Date.now() - this.jira.at < 6 * 3600 * 1000) return this.jira;
    const r = await this.proxy('jira', 'https://api.atlassian.com/oauth/token/accessible-resources');
    const site = Array.isArray(r.data) ? r.data.find(x => /^[0-9a-f-]{36}$/i.test(String(x.id || ''))) : null;
    if (!site) throw new Error('Jira: không tìm thấy site');
    const base = `https://api.atlassian.com/ex/jira/${site.id}`;
    const me = await this.proxy('jira', `${base}/rest/api/3/myself`);
    if (me.status !== 200 || !me.data || !me.data.accountId) throw new Error(`Jira: không đọc được tài khoản (HTTP ${me.status})`);
    this.jira = { base, me: String(me.data.accountId), at: Date.now() };
    return this.jira;
  }

  /**
   * Who assigned this issue to me: the author of the latest changelog entry whose assignee
   * change points TO my account. Never inferred from the reporter. null when not recorded
   * (issue created already assigned) or not permitted.
   */
  async jiraAssignedBy(key) {
    if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(String(key || ''))) return null;
    const { base, me } = await this.jiraBase();
    const cl = await this.proxy('jira', `${base}/rest/api/3/issue/${encodeURIComponent(key)}/changelog`, { query: { maxResults: 100 } });
    if (cl.status !== 200) return null;
    const hit = arrAt(cl.data, 'values').filter(v => arrAt(v, 'items').some(x => (x.fieldId === 'assignee' || x.field === 'assignee') && x.to === me)).pop();
    if (!hit || !hit.author) return null;
    return hit.author.accountId === me ? 'chính bạn' : String(hit.author.displayName || '').slice(0, 80) || null;
  }

  /**
   * Activity on MY open PRs (one call: /pullrequests/{me}): someone approved, requested changes, or
   * commented. Compared with the last snapshot (counters + participant states, persisted). Changes
   * made by me are ignored.
   */
  async pollBitbucketMine() {
    if (!this.bb.me) await this.bitbucketRepos();
    const me = this.bb.me;
    const fields = 'values.id,values.title,values.comment_count,values.links.html.href,values.destination.repository.full_name,values.source.branch.name,values.destination.branch.name,values.participants.user.uuid,values.participants.user.display_name,values.participants.approved,values.participants.state';
    if (!this.bb.workspaces) { this.bb.reposAt = 0; await this.bitbucketRepos(); }
    // /pullrequests/{user} was retired; the per-workspace "PRs by user" endpoint replaces it.
    const values = [];
    let ok = 0, lastStatus = 0;
    for (const w of this.bb.workspaces || []) {
      const r = await this.proxy('bitbucket', `/workspaces/${w}/pullrequests/${encodeURIComponent(me)}`, { query: { state: 'OPEN', pagelen: 30, fields } });
      lastStatus = r.status;
      if (r.status !== 200) continue;
      ok++;
      values.push(...arrAt(r.data, 'values'));
    }
    if (!ok && (this.bb.workspaces || []).length) throw new Error(`HTTP ${lastStatus || '?'}`);
    const r = { data: { values } };
    const prev = this.snap.bbMine;
    const first = !this.snap.bbMineInit;
    const next = {};
    let emitted = 0;
    for (const pr of arrAt(r.data, 'values')) {
      const full = String(pick(pr, 'destination.repository.full_name') || '');
      const [ws, repo] = full.split('/');
      if (!bbSafe(ws) || !bbSafe(repo) || !Number.isInteger(pr.id)) continue;
      const key = `${full}#${pr.id}`;
      const others = arrAt(pr, 'participants').filter(p => pick(p, 'user.uuid') && pick(p, 'user.uuid') !== me);
      const cur = {
        c: Number(pr.comment_count) || 0,
        ok: others.filter(p => p.approved).map(p => pick(p, 'user.uuid')),
        cr: others.filter(p => p.state === 'changes_requested').map(p => pick(p, 'user.uuid'))
      };
      next[key] = cur;
      const was = prev[key];
      if (first || !was) continue; // baseline / a PR I just opened
      const nameOf = (uuid) => String(pick(others.find(p => pick(p, 'user.uuid') === uuid) || {}, 'user.display_name') || 'Ai đó');
      const url = pick(pr, 'links.html.href');
      const base = { app: 'bitbucket', url: url && /^https:\/\/bitbucket\.org\//.test(url) ? url : undefined };
      const title = String(pr.title || `PR #${pr.id}`);
      const meta = (event, status, statusTone, who) => ({ kind: 'bitbucket', event, key: `#${pr.id}`, status, statusTone, repo, branch: bbBranch(pr), people: who ? [{ label: 'Bởi', value: who }] : [] });
      for (const u of cur.ok.filter(x => !was.ok.includes(x))) {
        this.emit('notification', { ...base, title, message: '', meta: meta(`✅ ${nameOf(u)} đã approve PR của bạn`, 'Đã approve', 'done', nameOf(u)), sourceEventId: `composio:bitbucket:ok:${key}:${u}:${Date.now()}` }); emitted++;
      }
      for (const u of cur.cr.filter(x => !was.cr.includes(x))) {
        this.emit('notification', { ...base, title, message: '', meta: meta(`⛔ ${nameOf(u)} yêu cầu sửa PR của bạn`, 'Cần sửa', 'danger', nameOf(u)), priority: 'important', sourceEventId: `composio:bitbucket:cr:${key}:${u}:${Date.now()}` }); emitted++;
      }
      if (cur.c > was.c) {
        const n = cur.c - was.c;
        const last = await this.proxy('bitbucket', `/repositories/${ws}/${repo}/pullrequests/${pr.id}/comments`, { query: { sort: '-created_on', pagelen: 5, fields: 'values.user.uuid,values.user.display_name,values.content.raw,values.deleted' } }).catch(() => null);
        const fromOthers = last && last.status === 200 ? arrAt(last.data, 'values').filter(c => !c.deleted && pick(c, 'user.uuid') !== me) : [];
        if (last && last.status === 200 && !fromOthers.length) continue; // only my own comments
        const c0 = fromOthers[0];
        this.emit('notification', {
          ...base,
          title,
          message: c0 ? String(pick(c0, 'content.raw') || '').replace(/\s+/g, ' ').slice(0, 200) : '',
          meta: meta(c0 ? `💬 ${pick(c0, 'user.display_name') || 'Ai đó'} bình luận PR của bạn` : `💬 ${n} bình luận mới trên PR của bạn`, 'Bình luận mới', 'progress', c0 ? pick(c0, 'user.display_name') : null),
          sourceEventId: `composio:bitbucket:c:${key}:${cur.c}`
        });
        emitted++;
      }
    }
    this.snap.bbMine = next;
    this.snap.bbMineInit = true;
    (this.lastCounts = this.lastCounts || {})['bitbucket-mine'] = { items: Object.keys(next).length, baseline: first };
    return emitted;
  }

  /**
   * Jira comments / @mentions / others' updates on issues I'm assigned to, reported, or watch —
   * roughly what the Jira bell shows (its own notifications API isn't public). One JQL search per
   * poll; per changed issue one comment lookup (+ changelog when no new comment). My own changes,
   * and status/assignee changes on my assigned issues (the main Jira recipe reports those), are skipped.
   */
  async pollJiraActivity() {
    const { base, me } = await this.jiraBase();
    const jql = '(assignee = currentUser() OR reporter = currentUser() OR watcher = currentUser()) AND updated >= -3d ORDER BY updated DESC';
    const fl = 'summary,updated,assignee,status,labels,issuetype,priority';
    let r = await this.proxy('jira', `${base}/rest/api/3/search/jql`, { query: { jql, maxResults: 30, fields: fl } });
    if (r.status === 404 || r.status === 410) r = await this.proxy('jira', `${base}/rest/api/3/search`, { query: { jql, maxResults: 30, fields: fl } });
    if (r.status !== 200) throw new Error(`HTTP ${r.status || '?'}`);
    const site = (this.jiraSite = this.jiraSite || await this.jiraSiteUrl().catch(() => null));
    const prev = this.snap.jiraAct;
    const first = !this.snap.jiraActInit;
    let emitted = 0;
    for (const is of arrAt(r.data, 'issues')) {
      const key = String(is.key || '');
      if (!/^[A-Z][A-Z0-9_]+-\d+$/.test(key)) continue;
      const updated = toTime(pick(is, 'fields.updated')) || 0;
      const was = prev[key];
      prev[key] = updated;
      if (first || !was || updated <= was) continue;
      const summary = String(pick(is, 'fields.summary') || '');
      const mine = pick(is, 'fields.assignee.accountId') === me;
      const url = site ? `${site}/browse/${key}` : undefined;
      const f = is.fields || {};
      const metaOf = (event, who) => jiraMeta({ key, type: pick(f, 'issuetype.name'), status: pick(f, 'status.name'), statusCat: pick(f, 'status.statusCategory.key'), priority: pick(f, 'priority.name'), labels: Array.isArray(f.labels) ? f.labels.map(String) : [], event, people: who ? [{ label: 'Bởi', value: who }] : [] });
      // Newest comment after the last time we looked, by someone else?
      const cm = await this.proxy('jira', `${base}/rest/api/3/issue/${key}/comment`, { query: { orderBy: '-created', maxResults: 3 } }).catch(() => null);
      const fresh = cm && cm.status === 200 ? arrAt(cm.data, 'comments').filter(c => (toTime(c.created) || 0) > was && pick(c, 'author.accountId') !== me) : [];
      if (fresh.length) {
        const c = fresh[0];
        const mention = JSON.stringify(c.body || {}).includes(`"id":"${me}"`);
        this.emit('notification', {
          app: 'jira', url,
          title: `${key} ${summary}`.trim(),
          message: adfText(c.body).slice(0, 220),
          meta: metaOf(mention ? `📣 ${pick(c, 'author.displayName') || 'Ai đó'} nhắc bạn` : `💬 ${pick(c, 'author.displayName') || 'Ai đó'} bình luận`, null),
          ...(mention ? { priority: 'important' } : {}),
          sourceEventId: `composio:jira:c:${key}:${c.id}`
        });
        emitted++;
        continue;
      }
      // No new comment: what else changed, and by whom (skip my own edits).
      const cl = await this.proxy('jira', `${base}/rest/api/3/issue/${key}/changelog`, { query: { maxResults: 100 } }).catch(() => null);
      const entries = cl && cl.status === 200 ? arrAt(cl.data, 'values').filter(v => (toTime(v.created) || 0) > was && pick(v, 'author.accountId') !== me) : [];
      const h = entries[entries.length - 1];
      if (!h) continue;
      const items = arrAt(h, 'items').filter(x => !(mine && ['status', 'assignee'].includes(x.fieldId || x.field)));
      if (!items.length) continue;
      const what = items.slice(0, 2).map(x => `${x.field}${x.toString ? ` → ${String(x.toString).slice(0, 40)}` : ''}`).join(', ');
      this.emit('notification', {
        app: 'jira', url,
        title: `${key} ${summary}`.trim(),
        message: what,
        meta: metaOf(`✏️ ${pick(h, 'author.displayName') || 'Ai đó'} cập nhật`, null),
        sourceEventId: `composio:jira:u:${key}:${h.id}`
      });
      emitted++;
    }
    for (const k of Object.keys(prev)) if (Object.keys(prev).length > 300) delete prev[k]; else break;
    this.snap.jiraActInit = true;
    (this.lastCounts = this.lastCounts || {})['jira-activity'] = { items: arrAt(r.data, 'issues').length, baseline: first };
    return emitted;
  }

  async jiraSiteUrl() {
    const r = await this.proxy('jira', 'https://api.atlassian.com/oauth/token/accessible-resources');
    const site = Array.isArray(r.data) ? r.data.find(x => /^https:\/\/[a-z0-9-]+\.atlassian\.net$/i.test(String(x.url || ''))) : null;
    return site ? site.url : null;
  }

  /** Approve a PR shown in a card. Target comes from our own map, never from the renderer. */
  async approvePullRequest(sourceEventId) {
    const t = this.prTargets.get(String(sourceEventId || ''));
    if (!t || !bbSafe(t.ws) || !bbSafe(t.repo) || !Number.isInteger(t.id)) return { ok: false, error: 'Không tìm thấy PR này nữa' };
    const r = await this.proxy('bitbucket', `/repositories/${t.ws}/${t.repo}/pullrequests/${t.id}/approve`, { method: 'POST' });
    if (r.status === 200 || r.status === 201) return { ok: true };
    if (r.status === 409) return { ok: true, already: true };
    const msg = pick(r.data || {}, 'error.message') || `HTTP ${r.status}`;
    return { ok: false, error: `Bitbucket từ chối: ${String(msg).slice(0, 120)}` };
  }

  async setKey(key) {
    const k = String(key || '').trim();
    if (!k) { this.ctx.secrets.set(KEY, null); this.stop(); return this.status(); }
    const r = await this.mcp('tools/list', {}, k); // validates the key
    if (!r || !Array.isArray(r.tools) || !r.tools.some(t => t.name === 'COMPOSIO_MANAGE_CONNECTIONS')) throw Object.assign(new Error('Khóa này không mở được Composio Connect'), { status: 400 });
    this.ctx.secrets.set(KEY, k);
    this.start();
    return this.status();
  }

  apps() { return this.ctx.settings.get().integrations.apps.filter(a => a.provider === 'composio'); }
  saveApps(apps) { this.ctx.settings.update({ integrations: { apps } }); }
  upsertApp(toolkit, patch) {
    const apps = this.ctx.settings.get().integrations.apps;
    const i = apps.findIndex(a => a.provider === 'composio' && a.toolkit === toolkit);
    if (i >= 0) apps[i] = { ...apps[i], ...patch };
    else apps.push({ provider: 'composio', toolkit, name: (RECIPES[toolkit] || {}).name || toolkit, logo: logoOf(toolkit), connectedAccountId: '', status: 'pending', triggers: [], addedAt: Date.now(), ...patch });
    this.saveApps(apps);
    return this.apps().find(a => a.toolkit === toolkit);
  }

  status() {
    return {
      provider: 'composio', mode: 'connect', name: 'Composio Connect', keySet: this.hasKey(), apps: this.apps(),
      polling: { intervalSeconds: this.interval(), lastPollAt: this.lastPollAt, lastError: this.lastError, counts: this.lastCounts || {} }
    };
  }

  static entry(slug, description = '') {
    const r = RECIPES[slug];
    return { provider: 'composio', toolkit: slug, name: r ? r.name : slug.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), description: r ? `Báo khi có: ${r.event.toLowerCase()}` : String(description).slice(0, 200), logo: logoOf(slug), hasEvents: !!r };
  }

  async catalog({ q = '' } = {}) {
    const query = String(q).trim().slice(0, 80);
    if (!query) return POPULAR.map(s => ComposioConnectProvider.entry(s));
    const direct = POPULAR.filter(s => s.includes(slugOf(query).replace(/-/g, '_')) || (RECIPES[s] && RECIPES[s].name.toLowerCase().includes(query.toLowerCase())));
    let found = [];
    try {
      const j = await this.tool('COMPOSIO_SEARCH_TOOLS', { queries: [{ use_case: `${query} app` }], session: { generate_id: true } });
      found = arrAt(j, 'data.toolkit_connection_statuses').map(t => ComposioConnectProvider.entry(slugOf(t.toolkit), t.description));
    } catch (err) { if (!direct.length) throw err; }
    const out = new Map();
    for (const e of [...direct.map(s => ComposioConnectProvider.entry(s)), ...found]) if (e.toolkit && !out.has(e.toolkit)) out.set(e.toolkit, e);
    return [...out.values()];
  }

  async connect({ toolkit }) {
    const slug = slugOf(toolkit);
    if (!slug) throw Object.assign(new Error('Thiếu tên ứng dụng'), { status: 400 });
    const j = await this.tool('COMPOSIO_MANAGE_CONNECTIONS', { toolkits: [{ name: slug, action: 'add' }] });
    const r = pick(j, `data.results.${slug}`) || {};
    if (!j.successful && !r.redirect_url) throw Object.assign(new Error(String(j.error || 'Không tạo được liên kết đăng nhập').slice(0, 200)), { status: 502 });
    const url = r.redirect_url;
    // Polling recipe on by default — the user added the app to be notified about it.
    const triggers = RECIPES[slug] ? [{ slug: slug.toUpperCase(), instanceId: '', name: RECIPES[slug].event }] : [];
    this.upsertApp(slug, { status: 'pending', triggers });
    if (url && /^https:\/\//.test(url) && this.ctx.openExternal) this.ctx.openExternal(url);
    return { ok: true, opened: !!url };
  }

  async refresh() {
    const apps = this.apps();
    if (!apps.length) return this.status();
    const j = await this.tool('COMPOSIO_MANAGE_CONNECTIONS', { toolkits: apps.map(a => ({ name: a.toolkit, action: 'list' })) });
    const results = pick(j, 'data.results') || {};
    const all = this.ctx.settings.get().integrations.apps;
    for (const a of all) {
      if (a.provider !== 'composio' || !results[a.toolkit]) continue;
      const accounts = arrAt(results[a.toolkit], 'accounts');
      const active = accounts.find(x => String(x.status).toUpperCase() === 'ACTIVE');
      const failed = accounts.length && accounts.every(x => /FAIL|EXPIRED/i.test(String(x.status)));
      a.status = active ? 'active' : failed ? 'expired' : 'pending';
      a.connectedAccountId = active ? String(active.id || '') : '';
    }
    this.saveApps(all);
    return this.status();
  }

  async triggerTypes(toolkit) {
    const r = RECIPES[slugOf(toolkit)];
    return r ? [{ slug: slugOf(toolkit).toUpperCase(), name: r.event, description: `Kiểm tra mỗi ${Math.round(this.interval() / 60)} phút qua Composio Connect.`, type: 'poll' }] : [];
  }

  async setTrigger({ toolkit, slug, enabled }) {
    const tk = slugOf(toolkit);
    const r = RECIPES[tk];
    if (!r) throw Object.assign(new Error('Ứng dụng này chưa có sự kiện tự động'), { status: 404 });
    if (!this.apps().some(a => a.toolkit === tk)) throw Object.assign(new Error('Ứng dụng chưa được thêm'), { status: 404 });
    if (!enabled) this.seen.delete(tk);
    return this.upsertApp(tk, { triggers: enabled ? [{ slug: String(slug || tk).toUpperCase(), instanceId: '', name: r.event }] : [] });
  }

  async remove(toolkit) {
    const tk = slugOf(toolkit);
    const app = this.apps().find(a => a.toolkit === tk);
    if (app && app.connectedAccountId && this.hasKey()) {
      await this.tool('COMPOSIO_MANAGE_CONNECTIONS', { toolkits: [{ name: tk, action: 'remove', account_id: app.connectedAccountId }] }).catch(() => {});
    }
    this.seen.delete(tk);
    this.saveApps(this.ctx.settings.get().integrations.apps.filter(a => !(a.provider === 'composio' && a.toolkit === tk)));
    return this.status();
  }

  /* -------------------------------------------------------------- polling */

  interval() { return Math.max(60, Number(this.ctx.pollSeconds ? this.ctx.pollSeconds() : 120) || 120); }

  start() {
    this.stop();
    if (!this.hasKey()) return;
    const tick = async () => {
      await this.pollOnce().catch(() => {});
      this.timer = setTimeout(tick, this.interval() * 1000);
      if (this.timer.unref) this.timer.unref();
    };
    this.timer = setTimeout(tick, 3000);
    if (this.timer.unref) this.timer.unref();
  }

  stop() { clearTimeout(this.timer); this.timer = null; }

  saveState() {
    if (!this.stateFile) return;
    try {
      const seen = Object.fromEntries([...this.seen].map(([k, v]) => [k, [...v].slice(-500)]));
      require('fs').writeFileSync(this.stateFile, JSON.stringify({ seen, ...this.snap }));
    } catch { /* read-only disk: keep in memory */ }
  }

  async pollOnce() {
    if (this.polling || !this.hasKey()) return 0;
    this.polling = true;
    let emitted = 0;
    try {
      if (this.apps().some(a => a.status !== 'active')) await this.refresh().catch(() => {});
      const enabled = this.apps().filter(a => a.status === 'active' && a.triggers.length && RECIPES[a.toolkit]);
      const errors = [];
      for (const a of enabled.filter(x => RECIPES[x.toolkit].custom)) {
        try { if (a.toolkit === 'bitbucket') emitted += await this.pollBitbucket(); } catch (err) { errors.push(err.message); }
        try { if (a.toolkit === 'bitbucket') emitted += await this.pollBitbucketMine(); } catch (err) { errors.push(`Bitbucket (PR của bạn): ${err.message}`); }
      }
      if (enabled.some(a => a.toolkit === 'jira')) {
        try { emitted += await this.pollJiraActivity(); } catch (err) { errors.push(`Jira (bình luận/nhắc tên): ${err.message}`); }
      }
      const targets = enabled.filter(a => !RECIPES[a.toolkit].custom);
      if (!targets.length) { this.lastError = errors.join(' · '); return emitted; }
      const j = await this.tool('COMPOSIO_MULTI_EXECUTE_TOOL', {
        tools: targets.map(a => ({ ...RECIPES[a.toolkit].tool(), ...(a.connectedAccountId ? { account: a.connectedAccountId } : {}) })),
        sync_response_to_workbench: false,
        thought: 'Check for new items to show as desktop notifications.'
      });
      const results = arrAt(j, 'data.results');
      for (const [idx, a] of targets.entries()) {
        const res = results.find(x => Number(x.index) === idx) || results[idx];
        if (!res || res.error) { errors.push(`${RECIPES[a.toolkit].name}: ${String((res && res.error) || 'không có phản hồi').slice(0, 140)}`); continue; }
        const resp = res.response || res;
        const data = pick(resp, 'data') || pick(resp, 'data_preview') || resp;
        const recipe = RECIPES[a.toolkit];
        const items = recipe.items(data).filter(x => x.id);
        (this.lastCounts = this.lastCounts || {})[a.toolkit] = { items: items.length, preview: !pick(resp, 'data') && !!pick(resp, 'data_preview'), baseline: !this.seen.has(a.toolkit) };
        const first = !this.seen.has(a.toolkit);
        const seen = this.seen.get(a.toolkit) || new Set();
        for (const it of items) {
          if (seen.has(it.id)) continue;
          // Same task, new state (e.g. Jira "KEY@In Review") → a "changed" card instead of "new".
          const key = it.id.split('@')[0];
          const isChange = it.id.includes('@') && [...seen].some(x => x.split('@')[0] === key);
          seen.add(it.id);
          if (first && !recipe.notifyExisting) continue; // baseline — don't replay old items
          if (recipe.enrich) { try { await recipe.enrich(this, it, { isChange }); } catch { /* keep the card without extras */ } }
          emitted++;
          this.emit('notification', {
            title: String(it.title).slice(0, 200), message: String(it.message || '').slice(0, 400), app: recipe.app,
            url: it.url && /^https:\/\//.test(it.url) ? it.url : undefined,
            ...(it.priority ? { priority: it.priority } : {}),
            ...(it.meta ? { meta: it.meta } : {}),
            sourceEventId: `composio:${a.toolkit}:${crypto.createHash('sha1').update(String(it.id)).digest('hex').slice(0, 16)}`,
            sourceCreatedAt: it.at || undefined
          });
        }
        if (seen.size > 500) this.seen.set(a.toolkit, new Set([...seen].slice(-300))); else this.seen.set(a.toolkit, seen);
      }
      this.lastError = errors.join(' · ');
    } catch (err) {
      this.lastError = err.message;
    } finally {
      this.lastPollAt = Date.now();
      this.polling = false;
      this.saveState();
    }
    return emitted;
  }
}

module.exports = { ComposioConnectProvider, RECIPES };
