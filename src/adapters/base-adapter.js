/**
 * ApplicationAdapter base class (blueprint §10).
 *
 *   connect(): Promise<boolean>
 *   disconnect(): Promise<boolean>
 *   getConnectionStatus(): 'Connected' | 'Disconnected' | 'Requires Authorization'
 *                          | 'Permission Limited' | 'Unsupported' | 'Error'
 *   subscribeNotifications(cb)
 *   normalizeNotification(raw): NormalizedNotification-like payload
 *   handleNotificationAction(action, externalId): Promise<void>
 */
const { EventEmitter } = require('events');

const STATUS = Object.freeze({
  CONNECTED: 'Connected',
  DISCONNECTED: 'Disconnected',
  AUTH: 'Requires Authorization',
  LIMITED: 'Permission Limited',
  UNSUPPORTED: 'Unsupported',
  ERROR: 'Error'
});

class ApplicationAdapter extends EventEmitter {
  constructor(ctx, meta) {
    super();
    this.ctx = ctx; // { settings: SettingsStore, secrets: SecretStore, log }
    this.id = meta.id;
    this.name = meta.name;
    this.icon = meta.icon || '🔌';
    this.description = meta.description || '';
    this.help = meta.help || '';
    this.fields = meta.fields || []; // [{key, label, type: 'secret'|'number'|'select'|'boolean', options?, placeholder?}]
    // Truthful delivery labelling (guide §B1): realtime_push | near_realtime_poll | scheduled_sync | native_os | manual
    this.deliveryMode = meta.deliveryMode || null;
    this.provider = meta.provider || meta.id;
    this.processing = meta.processing || 'local'; // 'local' | 'cloud' (data-flow transparency, principle 14)
    this.actions = meta.actions || []; // [{id, label}] extra buttons shown in the Control Center
    this.status = STATUS.DISCONNECTED;
    this.detail = '';
    this.lastEventAt = null;
    this.eventCount = 0;
    this.callbacks = [];
  }

  get config() { return (this.ctx.settings.get().adapters || {})[this.id] || {}; }

  async connect() { return false; }
  async disconnect() { this.setStatus(STATUS.DISCONNECTED, ''); return true; }
  getConnectionStatus() { return this.status; }
  subscribeNotifications(cb) { this.callbacks.push(cb); }
  normalizeNotification(raw) { return raw; }
  async handleNotificationAction(_action, _externalId) {}
  async runAction(_id) { throw new Error('Unknown action'); }

  setStatus(status, detail = '') {
    this.status = status;
    this.detail = detail;
    this.emit('status', this.describe());
  }

  /** Seconds between checks for polling/scheduled adapters (null for push). */
  intervalSeconds() { return null; }

  publish(raw) {
    const payload = this.normalizeNotification(raw);
    if (!payload) return;
    this.lastEventAt = Date.now();
    this.eventCount++;
    const meta = { deliveryMode: payload.deliveryMode || this.deliveryMode || 'manual', provider: this.provider };
    for (const cb of this.callbacks) {
      try { cb(payload, this.id, meta); } catch (err) { this.ctx.log(`[${this.id}] subscriber error: ${err.message}`); }
    }
  }

  describe() {
    const cfg = this.config;
    return {
      id: this.id,
      name: this.name,
      icon: this.icon,
      description: this.description,
      help: this.help,
      status: this.status,
      detail: this.detail,
      enabled: !!cfg.enabled,
      lastEventAt: this.lastEventAt,
      deliveryMode: this.deliveryMode,
      intervalSeconds: this.intervalSeconds(),
      provider: this.provider,
      processing: this.processing,
      actions: this.actions,
      eventCount: this.eventCount,
      fields: this.fields.map(f => ({
        ...f,
        value: f.type === 'secret' ? undefined : cfg[f.key],
        isSet: f.type === 'secret' ? this.ctx.secrets.has(`${this.id}.${f.key}`) : undefined
      }))
    };
  }
}

module.exports = { ApplicationAdapter, STATUS };
