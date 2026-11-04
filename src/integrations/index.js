/**
 * Integrations manager — one entry point for the Control Center, two Composio back-ends:
 *   ck_…  Composio Connect key  → MCP + polling     (ComposioConnectProvider)
 *   ak_…  Composio project key  → REST v3.1 + triggers via Gateway (ComposioProvider)
 * The key type decides; both store the key encrypted under the same secret slot.
 */
const { EventEmitter } = require('events');
const { ComposioProvider } = require('./composio-provider');
const { ComposioConnectProvider } = require('./composio-connect-provider');

class IntegrationsManager extends EventEmitter {
  constructor(ctx) {
    super();
    this.ctx = ctx;
    this.rest = new ComposioProvider(ctx);
    this.connect_ = new ComposioConnectProvider(ctx);
    this.connect_.on('notification', (n) => this.emit('notification', n));
  }

  get active() {
    const k = this.ctx.secrets.get('composio.apiKey');
    return ComposioConnectProvider.isConsumerKey(k) ? this.connect_ : this.rest;
  }

  start() { if (this.active === this.connect_) this.connect_.start(); }
  stop() { this.connect_.stop(); }

  status() { return this.active.status(); }

  async setKey(key) {
    const k = String(key || '').trim();
    if (!k) { this.connect_.stop(); return this.rest.setKey(''); }
    if (ComposioConnectProvider.isConsumerKey(k)) return this.connect_.setKey(k);
    this.connect_.stop();
    return this.rest.setKey(k);
  }

  catalog(o) { return this.active.catalog(o); }
  connect(o) { return this.active.connect(o); }
  refresh() { return this.active.refresh(); }
  triggerTypes(t) { return this.active.triggerTypes(t); }
  setTrigger(o) { return this.active.setTrigger(o); }
  remove(t) { return this.active.remove(t); }
  approvePullRequest(sid) { return this.connect_.approvePullRequest(sid); }
  async pollNow() { if (this.active !== this.connect_) return { emitted: 0, supported: false }; const emitted = await this.connect_.pollOnce(); return { emitted, supported: true, status: this.connect_.status() }; }
}

module.exports = { IntegrationsManager };
