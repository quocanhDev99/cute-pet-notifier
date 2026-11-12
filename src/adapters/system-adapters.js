/**
 * OS-level adapters.
 *  - SystemEventsAdapter: real OS events through Electron `powerMonitor` + Chromium Battery API.
 *  - WebhookAdapter: the local HTTP endpoint (status mirrors the actual listening server).
 *  - UnsupportedAdapter: channels the blueprint targets that have NO sanctioned API on this
 *    platform. They report `Unsupported` with the real reason instead of a fake toggle.
 */
const { ApplicationAdapter, STATUS } = require('./base-adapter');

// Short names the pet uses for itself; custom pets fall back to a neutral word.
const PET_NAMES = { cat_mochi: 'Mochi', dog_boba: 'Boba', bunny_cloud: 'Cloud', penguin_pip: 'Pip' };

class SystemEventsAdapter extends ApplicationAdapter {
  constructor(ctx, powerMonitor) {
    super(ctx, {
      id: 'system',
      name: 'Hệ thống (macOS / Windows)',
      icon: '🖥️',
      description: 'Sự kiện thật từ hệ điều hành: pin yếu, cắm/rút sạc, mở khóa màn hình, máy quá nhiệt.',
      help: 'Dùng Electron powerMonitor và Battery API của Chromium — không cần quyền đặc biệt.',
      deliveryMode: 'native_os',
      fields: [
        { key: 'battery', label: 'Cảnh báo pin (≤20%, ≤10%) & sạc', type: 'boolean' },
        { key: 'lockScreen', label: 'Chào khi mở khóa màn hình', type: 'boolean' },
        { key: 'thermal', label: 'Cảnh báo máy quá nhiệt', type: 'boolean' }
      ]
    });
    this.pm = powerMonitor;
    this.handlers = {};
    this.lockedAt = null;
    this.batteryState = { level: null, charging: null, warned: new Set() };
  }

  async connect() {
    if (!this.pm) { this.setStatus(STATUS.UNSUPPORTED, 'powerMonitor không khả dụng'); return false; }
    this.detachAll();
    const on = (ev, fn) => { this.handlers[ev] = fn; this.pm.on(ev, fn); };
    on('lock-screen', () => { this.lockedAt = Date.now(); });
    on('unlock-screen', () => {
      if (!this.config.lockScreen) return;
      const away = this.lockedAt ? Math.round((Date.now() - this.lockedAt) / 60000) : 0;
      this.lockedAt = null;
      if (away >= 5) this.publish({ kind: 'unlock', away });
    });
    on('thermal-state-change', (state) => {
      const s = typeof state === 'string' ? state : state && state.state;
      if (this.config.thermal && (s === 'serious' || s === 'critical')) this.publish({ kind: 'thermal', state: s });
    });
    on('resume', () => { if (this.config.lockScreen) this.publish({ kind: 'resume' }); });
    this.setStatus(STATUS.CONNECTED, 'Đang lắng nghe sự kiện nguồn & màn hình');
    return true;
  }

  detachAll() {
    for (const [ev, fn] of Object.entries(this.handlers)) this.pm.removeListener(ev, fn);
    this.handlers = {};
  }

  async disconnect() {
    if (this.pm) this.detachAll();
    this.setStatus(STATUS.DISCONNECTED, '');
    return true;
  }

  /** Battery updates are reported by the overlay renderer (navigator.getBattery). */
  reportBattery({ level, charging }) {
    if (this.status !== STATUS.CONNECTED || !this.config.battery) return;
    if (typeof level !== 'number') return;
    const pct = Math.round(level * 100);
    const prev = this.batteryState;
    if (prev.charging !== null && charging !== prev.charging) {
      this.publish({ kind: charging ? 'charging' : 'unplugged', pct });
    }
    if (charging) prev.warned.clear();
    if (!charging) {
      // A big drop (25% → 8%) crosses several thresholds at once: warn once, mark them all.
      const crossed = [20, 10].filter(th => pct <= th && !prev.warned.has(th));
      if (crossed.length) {
        crossed.forEach(th => prev.warned.add(th));
        this.publish({ kind: 'battery', pct });
      }
    }
    prev.level = pct;
    prev.charging = charging;
  }

  normalizeNotification(e) {
    const base = this.systemPayload(e);
    if (!base) return null;
    return { ...base, deliveryMode: 'native_os', category: 'system', sourceCreatedAt: e.at || Date.now(), sourceEventId: `${e.kind}:${e.at || Date.now()}` };
  }

  publish(e) { super.publish({ ...e, at: Date.now() }); }

  /** The active pet's name and the UI language (the messages are the pet talking). */
  voice() {
    let s = {};
    try { s = (this.ctx && this.ctx.settings && this.ctx.settings.get()) || {}; } catch { s = {}; }
    const en = !!(s.appearance && s.appearance.language === 'en');
    const name = PET_NAMES[s.activePet] || (en ? 'your pet' : 'bé');
    return { en, name, Name: name.charAt(0).toUpperCase() + name.slice(1) };
  }

  systemPayload(e) {
    const { en, name, Name } = this.voice();
    switch (e.kind) {
      case 'battery': return { app: 'system', title: en ? `🔋 Battery low: ${e.pct}% left` : `🔋 Pin yếu: còn ${e.pct}%`, message: en ? `Plug in the charger, ${name} is running out of energy!` : `Cắm sạc đi sen ơi, ${name} sắp hết năng lượng rồi!`, priority: e.pct <= 10 ? 'critical' : 'important', forceEmotion: e.pct <= 10 ? 'surprised' : 'sad' };
      case 'charging': return { app: 'system', title: en ? '⚡ Charging' : '⚡ Đang sạc pin', message: en ? `Battery ${e.pct}% — ${name} is recharging!` : `Pin ${e.pct}% — ${name} được nạp năng lượng rồi!`, forceEmotion: 'happy' };
      case 'unplugged': return { app: 'system', title: en ? '🔌 Charger unplugged' : '🔌 Đã rút sạc', message: en ? `Running on battery (${e.pct}%).` : `Đang dùng pin (${e.pct}%).`, forceEmotion: 'thinking' };
      case 'unlock': return { app: 'system', title: en ? '👋 Welcome back!' : '👋 Chào mừng trở lại!', message: en ? `You were away for ${e.away} min, ${name} missed you!` : `Sen đi đâu mất ${e.away} phút, ${name} nhớ ghê!`, forceEmotion: 'love' };
      case 'resume': return { app: 'system', title: en ? '☀️ Your computer just woke up' : '☀️ Máy vừa thức dậy', message: en ? `${Name} just woke up too, let's get back to work!` : `${Name} cũng vừa ngủ dậy nè, làm việc tiếp thôi!`, forceEmotion: 'happy' };
      case 'thermal': return { app: 'system', title: en ? '🔥 Your computer is overheating' : '🔥 Máy đang quá nóng', message: en ? `Thermal state: ${e.state}. Close some heavy apps!` : `Trạng thái nhiệt: ${e.state}. Đóng bớt ứng dụng nặng nhé!`, priority: 'critical', forceEmotion: 'surprised' };
      default: return null;
    }
  }
}

class WebhookAdapter extends ApplicationAdapter {
  constructor(ctx, port) {
    super(ctx, {
      id: 'webhook',
      name: 'Webhook nội bộ',
      icon: '🪝',
      description: `Mọi script, CI, Zapier-local, Shortcuts, n8n… có thể POST tới http://127.0.0.1:${port}/notify`,
      help: 'Payload JSON: {"title","message","app","url","priority":"critical|important|normal|low","category","sourceEventId","sourceCreatedAt"}. Nếu bật secret, gửi header "X-Pet-Secret". Người gửi chủ động đẩy (push) tới máy này.',
      deliveryMode: 'realtime_push',
      fields: [
        { key: 'secret', label: 'Webhook secret (tùy chọn)', type: 'secret', placeholder: 'để trống = không yêu cầu' }
      ]
    });
    this.port = port;
  }
  /** The server may end up on a fallback port (3721 reserved / taken) — show the real address. */
  setPort(port) {
    this.port = port;
    this.description = `Mọi script, CI, Zapier-local, Shortcuts, n8n… có thể POST tới http://127.0.0.1:${port}/notify`;
    if (this.status === STATUS.CONNECTED) this.setStatus(STATUS.CONNECTED, `Lắng nghe 127.0.0.1:${port}`);
  }
  async connect() { this.setStatus(STATUS.CONNECTED, `Lắng nghe 127.0.0.1:${this.port}`); return true; }
  async disconnect() { this.setStatus(STATUS.DISCONNECTED, 'Đang từ chối POST /notify'); return true; }
  get enabledForIngest() { return this.status === STATUS.CONNECTED; }
  markServerError(msg) { this.setStatus(STATUS.ERROR, msg); }
}

class UnsupportedAdapter extends ApplicationAdapter {
  constructor(ctx, meta) {
    super(ctx, meta);
    this.setStatus(STATUS.UNSUPPORTED, meta.reason);
  }
  async connect() { return false; }
  async disconnect() { return true; }
}

function unsupportedAdapters(ctx, platform) {
  return [
    new UnsupportedAdapter(ctx, {
      id: 'gmail', name: 'Gmail', icon: '✉️',
      description: 'Thư mới trong Gmail.',
      reason: 'Kết nối trực tiếp chưa triển khai: Gmail push cần Google Cloud Pub/Sub + public HTTPS + History API. Thay thế: trigger Gmail của Composio qua Cloud Gateway — lưu ý đó là POLLING (Composio managed OAuth tối thiểu 15 phút), sẽ được gắn nhãn near_realtime_poll, không phải realtime.'
    }),
    new UnsupportedAdapter(ctx, {
      id: 'outlook', name: 'Microsoft Outlook', icon: '📨',
      description: 'Mail/Lịch Outlook qua Microsoft Graph change notifications.',
      reason: 'Kết nối Graph trực tiếp chưa triển khai (cần Azure AD app, public HTTPS, gia hạn subscription). Thay thế: trigger Outlook của Composio qua Cloud Gateway, hoặc link lịch ICS ở mục Calendar.'
    }),
    new UnsupportedAdapter(ctx, {
      id: 'teams', name: 'Microsoft Teams', icon: '👥',
      description: 'Tin nhắn Teams qua Microsoft Graph.',
      reason: 'Chưa hỗ trợ: Graph change notifications cho chat Teams cần quyền resource riêng và public HTTPS endpoint; không suy diễn từ Outlook. Có thể đẩy sự kiện qua Gateway /webhooks/generic từ một luồng Power Automate/Graph của bạn.'
    }),
    new UnsupportedAdapter(ctx, {
      id: 'notion', name: 'Notion', icon: '📝',
      description: 'Sự kiện trang/cơ sở dữ liệu Notion.',
      reason: 'Kết nối trực tiếp chưa triển khai. Dùng Notion trigger của Composio (được Composio mô tả là realtime) qua Cloud Gateway; cần kiểm thử end-to-end trước khi coi là realtime.'
    }),
    new UnsupportedAdapter(ctx, {
      id: 'discord', name: 'Discord', icon: '🎮',
      description: 'Tin nhắn trong server Discord.',
      reason: 'Chưa triển khai: cần Discord bot + Gateway WebSocket với intents phù hợp; chỉ nhận được tin trong server bot có mặt, không đọc được thông báo cá nhân.'
    }),
    new UnsupportedAdapter(ctx, {
      id: 'zalo', name: 'Zalo', icon: '🔵',
      description: 'Tin nhắn Zalo cá nhân.',
      reason: 'Zalo không cung cấp API đọc tin nhắn tài khoản cá nhân (Zalo OA API chỉ dành cho Official Account). Không hỗ trợ để tránh screen-scraping.'
    })
  ];
}

module.exports = { SystemEventsAdapter, WebhookAdapter, UnsupportedAdapter, unsupportedAdapters };
