/**
 * Slack adapter — official Socket Mode (WebSocket) connection. No public URL needed.
 *
 * Requirements (Slack app at api.slack.com/apps):
 *   • Socket Mode ON → App-Level Token (xapp-…) with `connections:write`
 *   • Event Subscriptions → bot events: app_mention, message.im
 *     (optional "events on behalf of users": message.im / message.channels for your own DMs)
 *   • Bot Token (xoxb-…) with users:read, channels:read, im:read  (to show names instead of IDs)
 */
const WebSocket = require('ws');
const { ApplicationAdapter, STATUS } = require('./base-adapter');

class SlackAdapter extends ApplicationAdapter {
  constructor(ctx, fetchImpl = globalThis.fetch) {
    super(ctx, {
      id: 'slack',
      name: 'Slack',
      icon: '💬',
      description: 'Tin nhắn trực tiếp & @mention qua Slack Socket Mode (WebSocket chính thức).',
      help: 'api.slack.com/apps → Create App → bật Socket Mode (tạo App-Level Token scope connections:write) → Event Subscriptions: app_mention, message.im → Install vào workspace → copy Bot Token. Socket Mode là kênh push chính thức của Slack (không cần public URL).',
      deliveryMode: 'realtime_push',
      fields: [
        { key: 'appToken', label: 'App-Level Token', type: 'secret', placeholder: 'xapp-…' },
        { key: 'botToken', label: 'Bot User OAuth Token', type: 'secret', placeholder: 'xoxb-…' },
        { key: 'notifyOn', label: 'Báo khi', type: 'select', options: [
          { value: 'mentions', label: '@mention + tin nhắn trực tiếp' },
          { value: 'dm', label: 'Chỉ tin nhắn trực tiếp' },
          { value: 'all', label: 'Mọi tin nhắn bot nhìn thấy' }
        ] }
      ]
    });
    this.fetch = fetchImpl;
    this.ws = null;
    this.names = new Map();
    this.stopped = true;
    this.retry = 0;
    this.reconnectTimer = null;
    this.team = '';
    this.gen = 0; // bumped by disconnect(): async work started before it must not restart anything
    this.deferred = new Map(); // channel:ts → timer (channel "message" waiting for its app_mention)
  }

  async api(method, token, params = {}) {
    const res = await this.fetch(`https://slack.com/api/${method}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });
    return res.json();
  }

  async connect() {
    const appToken = this.ctx.secrets.get('slack.appToken');
    if (!appToken) { this.setStatus(STATUS.AUTH, 'Chưa có App-Level Token (xapp-)'); return false; }
    if (!appToken.startsWith('xapp-')) { this.setStatus(STATUS.AUTH, 'App-Level Token phải bắt đầu bằng xapp-'); return false; }
    this.stopped = false;
    const gen = ++this.gen;
    const botToken = this.ctx.secrets.get('slack.botToken');
    if (botToken) {
      try {
        const auth = await this.api('auth.test', botToken);
        if (auth.ok) { this.team = auth.team; this.botUserId = auth.user_id; }
      } catch { /* names are optional */ }
    }
    if (gen !== this.gen || this.stopped) return false;
    return this.openSocket(appToken);
  }

  async openSocket(appToken) {
    const gen = this.gen;
    const stale = () => this.stopped || gen !== this.gen;
    if (stale()) return false;
    let ws = null;
    try {
      const r = await this.api('apps.connections.open', appToken);
      if (stale()) return false;
      if (!r.ok) {
        const authErr = ['invalid_auth', 'not_authed', 'token_revoked', 'not_allowed_token_type'].includes(r.error);
        this.setStatus(authErr ? STATUS.AUTH : STATUS.ERROR, `Slack: ${r.error}`);
        return false;
      }
      await new Promise((resolve, reject) => {
        ws = new WebSocket(r.url);
        this.connecting = ws;
        const timeout = setTimeout(() => reject(new Error('timeout')), 15000);
        ws.on('message', (data) => this.onMessage(ws, data));
        ws.on('open', () => { clearTimeout(timeout); resolve(); });
        ws.on('error', (err) => { clearTimeout(timeout); reject(err); });
        // Only a socket that was really open reconnects on close; a failed open is retried once,
        // by the catch below (not twice: error + close used to double the backoff).
        ws.on('close', () => { clearTimeout(timeout); if (this.ws === ws) { this.ws = null; this.scheduleReconnect(); } else reject(new Error('closed')); });
      });
      if (this.connecting === ws) this.connecting = null;
      if (stale()) { try { ws.close(); } catch { /* ignore */ } return false; }
      if (this.ws && this.ws !== ws) { const old = this.ws; this.ws = null; try { old.close(); } catch { /* ignore */ } }
      this.ws = ws;
      this.retry = 0;
      const hasBot = !!this.ctx.secrets.get('slack.botToken');
      this.setStatus(hasBot ? STATUS.CONNECTED : STATUS.LIMITED,
        hasBot ? `Socket Mode đang lắng nghe${this.team ? ` · ${this.team}` : ''}` : 'Đã kết nối — thiếu Bot Token nên chỉ hiện ID người gửi');
      return true;
    } catch (err) {
      if (ws) {
        if (this.connecting === ws) this.connecting = null;
        try { ws.terminate(); } catch { /* ignore */ } // e.g. the 15 s timeout: don't leave it half-open
      }
      if (stale()) return false;
      this.setStatus(STATUS.ERROR, `Không mở được WebSocket: ${err.message}`);
      this.scheduleReconnect();
      return false;
    }
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(60000, 2000 * 2 ** this.retry++);
    this.detail = `Mất kết nối, thử lại sau ${Math.round(delay / 1000)}s`;
    const gen = this.gen;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      const t = this.ctx.secrets.get('slack.appToken');
      if (t && !this.stopped && gen === this.gen) this.openSocket(t);
    }, delay);
    if (this.reconnectTimer.unref) this.reconnectTimer.unref();
  }

  async disconnect() {
    this.stopped = true;
    this.gen++;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    for (const t of this.deferred.values()) clearTimeout(t);
    this.deferred.clear();
    if (this.connecting) { const ws = this.connecting; this.connecting = null; try { ws.terminate(); } catch { /* ignore */ } }
    if (this.ws) { const ws = this.ws; this.ws = null; try { ws.close(); } catch { /* ignore */ } }
    this.setStatus(STATUS.DISCONNECTED, '');
    return true;
  }

  onMessage(ws, data) {
    let msg;
    try { msg = JSON.parse(String(data)); } catch { return; }
    if (msg.envelope_id) ws.send(JSON.stringify({ envelope_id: msg.envelope_id }));
    if (msg.type === 'disconnect') { try { ws.close(); } catch { /* reconnect via close */ } return; }
    if (msg.type !== 'events_api') return;
    const ev = msg.payload && msg.payload.event;
    if (!ev || ev.bot_id || ev.subtype) return; // ignore bots, edits, joins…
    if (ev.user && ev.user === this.botUserId) return;
    const mode = this.config.notifyOn || 'mentions';
    const isDm = ev.channel_type === 'im';
    const isMention = ev.type === 'app_mention';
    if (mode === 'dm' && !isDm) return;
    if (mode === 'mentions' && !isDm && !isMention) return;
    // app_mention + message events can both fire for the same post
    if (ev.type === 'message' && !isDm && mode !== 'all') return;
    const full = { ...ev, _eventId: msg.payload.event_id, _eventTime: msg.payload.event_time };
    const key = `${ev.channel}:${ev.ts}`;
    if (isMention) {
      // The mention wins over a plain "message" copy of the same post, whichever arrived first.
      clearTimeout(this.deferred.get(key));
      this.deferred.delete(key);
    } else if (ev.type === 'message' && !isDm) {
      if (this.botUserId && String(ev.text || '').includes(`<@${this.botUserId}>`)) return; // its app_mention follows
      // Without the bot id we can't tell: give a possible app_mention a moment to arrive first.
      clearTimeout(this.deferred.get(key));
      this.deferred.set(key, setTimeout(() => {
        this.deferred.delete(key);
        if (!this.stopped) this.enrichAndPublish(full, isDm, false);
      }, 1500));
      return;
    }
    this.enrichAndPublish(full, isDm, isMention);
  }

  async name(kind, id) {
    if (!id) return '';
    const key = `${kind}:${id}`;
    if (this.names.has(key)) return this.names.get(key);
    const bot = this.ctx.secrets.get('slack.botToken');
    if (!bot) return id; // nothing to look up with (not cached: a bot token may be added later)
    let label = null;
    try {
      if (kind === 'user') {
        const r = await this.api('users.info', bot, { user: id });
        if (r.ok) label = r.user.profile.display_name || r.user.real_name || r.user.name || null;
      } else {
        const r = await this.api('conversations.info', bot, { channel: id });
        if (r.ok && r.channel.name) label = `#${r.channel.name}`;
      }
    } catch { /* network error: try again next time */ }
    if (!label) return id; // never cache the raw id as if it were the name
    this.names.set(key, label);
    if (this.names.size > 2000) this.names.delete(this.names.keys().next().value);
    return label;
  }

  async enrichAndPublish(ev, isDm, isMention) {
    const user = await this.name('user', ev.user);
    let text = String(ev.text || '');
    const ids = [...new Set([...text.matchAll(/<@([A-Z0-9]+)>/g)].map(m => m[1]))];
    for (const id of ids) text = text.split(`<@${id}>`).join('@' + await this.name('user', id));
    text = text.replace(/<(https?:[^|>]+)\|([^>]+)>/g, '$2').replace(/<(https?:[^>]+)>/g, '$1').replace(/<#[A-Z0-9]+\|([^>]+)>/g, '#$1');
    const channel = isDm ? 'tin nhắn riêng' : await this.name('channel', ev.channel);
    this.publish({ user, channel, text, isDm, isMention, ev });
  }

  normalizeNotification({ user, channel, text, isDm, isMention, ev }) {
    return {
      app: 'slack',
      title: isDm ? `💬 ${user} nhắn riêng cho bạn` : `${isMention ? '📣' : '💬'} ${user} trong ${channel}`,
      message: text,
      url: ev.channel ? `https://slack.com/app_redirect?channel=${encodeURIComponent(ev.channel)}` : null,
      priority: isDm || isMention ? 'important' : 'normal',
      category: 'chat',
      chatDirect: !!isDm,
      chatMention: !!isMention,
      deliveryMode: 'realtime_push',
      // app_mention + message events share channel:ts → idempotent across both
      sourceEventId: `${ev.channel}:${ev.ts}`,
      sourceCreatedAt: ev.ts ? Math.round(Number(ev.ts) * 1000) : (ev._eventTime ? ev._eventTime * 1000 : null)
    };
  }
}

module.exports = { SlackAdapter };
