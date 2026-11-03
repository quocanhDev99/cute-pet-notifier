/**
 * Application Integration Hub — owns every adapter, starts the enabled ones,
 * applies configuration (secrets → OS credential storage, options → settings)
 * and routes notification actions back to the originating adapter.
 */
const { EventEmitter } = require('events');
const { GitHubAdapter } = require('./github-adapter');
const { CalendarAdapter } = require('./calendar-adapter');
const { SlackAdapter } = require('./slack-adapter');
const { GatewayAdapter } = require('./gateway-adapter');
const { MacNotificationCenterAdapter } = require('./macos-nc-adapter');
const { WindowsNotificationAdapter } = require('./windows-nc-adapter');
const { SystemEventsAdapter, WebhookAdapter, unsupportedAdapters } = require('./system-adapters');
const { STATUS } = require('./base-adapter');

class AdapterHub extends EventEmitter {
  constructor(ctx, { port, powerMonitor, platform }) {
    super();
    this.ctx = ctx;
    this.list = [
      new WebhookAdapter(ctx, port),
      new MacNotificationCenterAdapter(ctx, platform),
      new WindowsNotificationAdapter(ctx, platform),
      new SystemEventsAdapter(ctx, powerMonitor),
      new GitHubAdapter(ctx),
      new CalendarAdapter(ctx),
      new SlackAdapter(ctx),
      new GatewayAdapter(ctx),
      ...unsupportedAdapters(ctx, platform)
    ];
    this.byId = new Map(this.list.map(a => [a.id, a]));
    for (const a of this.list) {
      a.on('status', (d) => this.emit('status', d));
      a.subscribeNotifications((payload, source, meta) => this.emit('notification', payload, source, meta));
    }
  }

  get(id) { return this.byId.get(id); }

  async startEnabled() {
    const cfg = this.ctx.settings.get().adapters;
    await Promise.all(this.list.map(async (a) => {
      if (cfg[a.id] && cfg[a.id].enabled) {
        try { await a.connect(); } catch (err) { a.setStatus(STATUS.ERROR, err.message); }
      }
    }));
  }

  /** Persist config. `values` may contain secrets (by field type) and plain options. */
  configure(id, values = {}) {
    const a = this.get(id);
    if (!a) throw new Error('Unknown adapter');
    const plain = {};
    for (const f of a.fields) {
      if (!(f.key in values)) continue;
      const v = values[f.key];
      if (f.type === 'secret') {
        if (typeof v === 'string' && v.trim() !== '') this.ctx.secrets.set(`${id}.${f.key}`, v.trim().slice(0, 4000));
        else if (v === null) this.ctx.secrets.set(`${id}.${f.key}`, null);
      } else {
        plain[f.key] = v;
      }
    }
    if (Object.keys(plain).length) this.ctx.settings.update({ adapters: { [id]: plain } });
    return a.describe();
  }

  async connect(id) {
    const a = this.get(id);
    if (!a) throw new Error('Unknown adapter');
    await a.disconnect().catch(() => {});
    const ok = await a.connect();
    this.ctx.settings.update({ adapters: { [id]: { enabled: ok || a.status === STATUS.LIMITED } } });
    return a.describe();
  }

  async disconnect(id) {
    const a = this.get(id);
    if (!a) throw new Error('Unknown adapter');
    await a.disconnect();
    this.ctx.settings.update({ adapters: { [id]: { enabled: false } } });
    return a.describe();
  }

  async handleAction(source, action, externalId) {
    const a = this.get(source);
    if (a) await a.handleNotificationAction(action, externalId).catch(() => {});
  }

  async runAction(id, action) {
    const a = this.get(id);
    if (!a) throw new Error('Unknown adapter');
    return a.runAction(String(action || ''));
  }

  describeAll() { return this.list.map(a => a.describe()); }

  async stopAll() { await Promise.all(this.list.map(a => a.disconnect().catch(() => {}))); }
}

module.exports = { AdapterHub };
