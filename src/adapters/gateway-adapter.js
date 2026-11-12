/**
 * Cloud Integration Gateway adapter (Blueprint V3.2 §6.4).
 * The desktop opens an authenticated OUTBOUND Server-Sent Events stream to the user's
 * own HTTPS gateway (see /gateway). No inbound port is opened on this machine and no
 * Composio/Slack secret is stored in the desktop app — only the gateway URL and a
 * desktop bearer token (in the OS keychain).
 *
 * Reliability: persisted cursor (Last-Event-ID) → events missed while offline/hidden are
 * replayed on reconnect; exponential backoff; idempotency happens again in the pipeline.
 */
const fs = require('fs');
const path = require('path');
const { ApplicationAdapter, STATUS } = require('./base-adapter');

function parseSse(buffer, onEvent) {
  // Returns the unconsumed remainder. SSE lines may end in CRLF, LF or CR: normalise to LF first.
  // A CR at the very end is kept as is — its LF may still be in the next chunk.
  buffer = buffer.replace(/\r\n/g, '\n').replace(/\r(?!$)/g, '\n');
  let idx;
  while ((idx = buffer.indexOf('\n\n')) !== -1) {
    const frame = buffer.slice(0, idx);
    buffer = buffer.slice(idx + 2);
    const ev = { event: 'message', data: '', id: null };
    for (const line of frame.split('\n')) {
      if (!line || line.startsWith(':')) continue;
      const c = line.indexOf(':');
      const field = c === -1 ? line : line.slice(0, c);
      const value = c === -1 ? '' : line.slice(c + 1).replace(/^ /, '');
      if (field === 'event') ev.event = value;
      else if (field === 'data') ev.data += (ev.data ? '\n' : '') + value;
      else if (field === 'id') ev.id = value;
    }
    onEvent(ev);
  }
  return buffer;
}

function validGatewayUrl(raw) {
  try {
    const u = new URL(raw);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(u.hostname);
    if (u.protocol === 'https:' || (u.protocol === 'http:' && local)) return u.toString().replace(/\/$/, '');
  } catch { /* invalid */ }
  return null;
}

class GatewayAdapter extends ApplicationAdapter {
  constructor(ctx, fetchImpl = globalThis.fetch) {
    super(ctx, {
      id: 'gateway',
      name: 'Cloud Integration Gateway (Composio · Slack Events · HMAC)',
      icon: '☁️',
      description: 'Nhận sự kiện realtime từ Composio triggers, Slack Events API hoặc webhook có chữ ký qua Gateway HTTPS của riêng bạn. Desktop chủ động kết nối ra ngoài — không mở cổng.',
      help: 'Triển khai thư mục gateway/ lên máy chủ HTTPS (xem gateway/README.md), đặt DESKTOP_TOKEN và secret của nhà cung cấp trên gateway. Dán URL gateway + DESKTOP_TOKEN vào đây. Nhãn delivery mode được lấy theo từng sự kiện (Gmail/Calendar qua Composio là polling).',
      deliveryMode: 'realtime_push',
      provider: 'gateway',
      processing: 'cloud',
      fields: [
        { key: 'url', label: 'URL Gateway (https://…)', type: 'text', placeholder: 'https://pet-gateway.example.com' },
        { key: 'token', label: 'DESKTOP_TOKEN', type: 'secret', placeholder: '≥ 24 ký tự ngẫu nhiên' }
      ]
    });
    this.fetch = fetchImpl;
    this.abort = null;
    this.retry = 0;
    this.stopped = true;
    this.gen = 0;
    this.cursorFile = ctx.dataDir ? path.join(ctx.dataDir, 'gateway-cursor.json') : null;
    this.cursor = 0;
    try { if (this.cursorFile && fs.existsSync(this.cursorFile)) this.cursor = JSON.parse(fs.readFileSync(this.cursorFile, 'utf8')).lastSeq || 0; } catch { this.cursor = 0; }
  }

  saveCursor() {
    if (!this.cursorFile) return;
    try { fs.writeFileSync(this.cursorFile, JSON.stringify({ lastSeq: this.cursor }), { mode: 0o600 }); } catch { /* ignore */ }
  }

  async connect() {
    const gen = ++this.gen; // a disconnect() (or newer connect) while we await makes this one stale
    const url = validGatewayUrl(this.config.url || '');
    const token = this.ctx.secrets.get('gateway.token');
    if (!url) { this.setStatus(STATUS.ERROR, 'URL phải là https:// (http chỉ cho phép với localhost khi phát triển)'); return false; }
    if (!token) { this.setStatus(STATUS.AUTH, 'Chưa có DESKTOP_TOKEN'); return false; }
    try {
      const h = await this.fetch(`${url}/health`, { headers: { 'User-Agent': 'CutePetCompanion' } });
      if (gen !== this.gen) return false;
      if (!h.ok) { this.setStatus(STATUS.ERROR, `Gateway /health trả về ${h.status}`); return false; }
      const health = await h.json();
      if (gen !== this.gen) return false;
      this.providers = Object.entries((health && health.providers) || {}).filter(([, v]) => v).map(([k]) => k);
    } catch (err) {
      if (gen === this.gen) this.setStatus(STATUS.ERROR, `Không kết nối được gateway: ${err.message}`);
      return false;
    }
    this.stopped = false;
    this.url = url;
    return this.openStream(token);
  }

  async openStream(token) {
    if (this.stopped) return false;
    if (this.abort) { try { this.abort.abort(); } catch { /* ignore */ } } // one stream at a time
    const ctl = new AbortController();
    this.abort = ctl;
    const live = () => !this.stopped && this.abort === ctl;
    let res;
    try {
      res = await this.fetch(`${this.url}/events`, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'Last-Event-ID': String(this.cursor) },
        signal: ctl.signal
      });
    } catch (err) {
      if (live()) { this.setStatus(STATUS.ERROR, `Mất kết nối: ${err.message}`); this.scheduleReconnect(); }
      return false;
    }
    if (!live()) { try { ctl.abort(); } catch { /* ignore */ } return false; } // disconnected meanwhile
    if (res.status === 401) { this.setStatus(STATUS.AUTH, 'DESKTOP_TOKEN bị gateway từ chối'); return false; }
    if (!res.ok || !res.body) { this.setStatus(STATUS.ERROR, `Gateway /events trả về ${res.status}`); this.scheduleReconnect(); return false; }

    this.retry = 0;
    this.setStatus(STATUS.CONNECTED, `SSE đang mở · providers: ${(this.providers || []).join(', ') || 'chưa cấu hình'} · cursor ${this.cursor}`);
    this.pump(res.body, live).catch(() => {}).finally(() => {
      if (live()) { this.setStatus(STATUS.ERROR, 'Luồng SSE bị đóng, đang kết nối lại…'); this.scheduleReconnect(); }
    });
    return true;
  }

  async pump(body, live = () => true) {
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of body) {
      if (!live()) return;
      buf += decoder.decode(chunk, { stream: true });
      buf = parseSse(buf, (ev) => {
        if (ev.event !== 'notification') return;
        let data;
        try { data = JSON.parse(ev.data); } catch { return; }
        this.publish(data);
        const seq = Number(ev.id);
        if (Number.isFinite(seq) && seq > this.cursor) { this.cursor = seq; this.saveCursor(); }
        this.detail = `SSE đang mở · cursor ${this.cursor}`;
      });
    }
  }

  scheduleReconnect() {
    if (this.stopped) return;
    clearTimeout(this.reconnectTimer);
    const delay = Math.min(60000, 1000 * 2 ** this.retry++);
    this.reconnectTimer = setTimeout(() => {
      const token = this.ctx.secrets.get('gateway.token');
      if (token && !this.stopped) this.openStream(token);
    }, delay);
    if (this.reconnectTimer.unref) this.reconnectTimer.unref();
  }

  async disconnect() {
    this.stopped = true;
    this.gen++;
    clearTimeout(this.reconnectTimer);
    if (this.abort) { try { this.abort.abort(); } catch { /* ignore */ } this.abort = null; }
    this.setStatus(STATUS.DISCONNECTED, '');
    return true;
  }

  normalizeNotification(e) {
    // Gateway already normalized + verified; pass the contract through.
    return { ...e, deliveryMode: e.deliveryMode || 'realtime_push' };
  }
}

module.exports = { GatewayAdapter, parseSse, validGatewayUrl };
