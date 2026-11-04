/**
 * Windows UserNotificationListener adapter (WinRT).
 * Captures real-time notifications from any Windows app and replaces the native toast:
 *  - per-app "Show notification banners" and "Play a sound" are switched off (ShowBanner=0,
 *    SoundFile='', plus the global notification-sound switch) so Windows neither pops a banner nor
 *    plays a sound, while notifications still land in Action Center where the listener reads them;
 *  - the captured toast is then removed from Action Center (no duplicates).
 * Original values are backed up and restored on disable / quit / next start.
 */
const path = require('path');
const fs = require('fs');
const { spawn, execFile, execFileSync } = require('child_process');
const readline = require('readline');
const { ApplicationAdapter, STATUS } = require('./base-adapter');

class WindowsNotificationAdapter extends ApplicationAdapter {
  constructor(ctx, platform = process.platform) {
    super(ctx, {
      id: 'windows_nc',
      name: 'Windows Toast Listener (thay thế thông báo hệ thống)',
      icon: '🪟',
      description: 'Bắt thông báo của MỌI ứng dụng trên Windows (Zalo, Teams, Outlook, Chrome, Telegram…) qua WinRT và để thú cưng mang tới thay cho toast mặc định.',
      help: 'Sử dụng Windows.UI.Notifications.Management.UserNotificationListener để đọc thông báo, tắt banner gốc của từng ứng dụng và tự động đóng toast. Hoàn toàn cục bộ, không gửi dữ liệu ra ngoài máy.',
      deliveryMode: 'native_os',
      provider: 'windows',
      fields: [
        { key: 'suppressNativeToast', label: 'Thay thế hoàn toàn thông báo của Windows: tắt banner và âm thanh gốc, chỉ dùng của thú cưng', type: 'boolean', default: true },
        { key: 'skipSystemUpdates', label: 'Bỏ qua thông báo Windows Update / Bảo mật', type: 'boolean', default: false }
      ],
      actions: [
        { id: 'open-notification-settings', label: '⚙️ Mở Cài đặt Thông báo của Windows' },
        { id: 'open-privacy-settings', label: '🔐 Mở Cài đặt Quyền riêng tư Thông báo' },
        { id: 'restore-banners', label: '↺ Bật lại banner & âm thanh gốc của Windows' }
      ]
    });

    this.platform = platform;
    this.process = null;
    this.rl = null;
    this.seenIds = new Set();

    if (platform !== 'win32') {
      this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên Windows 10 (bản 1607 trở lên) và Windows 11.');
    } else {
      // A crash can leave banners switched off; if the listener isn't started shortly, put them back.
      const t = setTimeout(() => { if (!this.process) this.restoreBanners(); }, 8000);
      if (t.unref) t.unref();
    }
  }

  /** In a packaged build the script is unpacked next to app.asar (see build.asarUnpack);
   *  powershell.exe cannot read files that live inside the asar archive. */
  scriptPath() {
    const rootDir = path.resolve(__dirname, '../..').replace(/app\.asar(?=$|[\\/])/, 'app.asar.unpacked');
    return path.join(rootDir, 'src', 'native', 'windows', 'NotificationListener.ps1');
  }

  /** Original per-app ShowBanner values, written by the listener before it changes any. */
  bannerBackupPath() { return this.ctx.dataDir ? path.join(this.ctx.dataDir, 'windows-banners.json') : ''; }

  /** Turn Windows banners back on exactly as they were. `sync` is used while the app is quitting. */
  restoreBanners({ sync = false } = {}) {
    const backup = this.bannerBackupPath();
    if (this.platform !== 'win32' || !backup || !fs.existsSync(backup)) return;
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', this.scriptPath(), '-BannerBackup', backup, '-RestoreBanners'];
    try {
      if (sync) execFileSync('powershell.exe', args, { windowsHide: true, timeout: 8000 });
      else {
        this.pendingRestore = new Promise((resolve) => execFile('powershell.exe', args, { windowsHide: true, timeout: 15000 }, (err) => {
          if (err) this.ctx.log(`[windows_nc] restore banners failed: ${err.message}`);
          this.pendingRestore = null;
          resolve();
        }));
      }
    } catch (err) { this.ctx.log(`[windows_nc] restore banners failed: ${err.message}`); }
  }

  killListener() {
    if (this.rl) { this.rl.close(); this.rl = null; }
    if (this.process) {
      const p = this.process;
      this.process = null;
      p.removeAllListeners('close');
      try { p.kill(); } catch {}
    }
  }

  async connect() {
    if (this.platform !== 'win32') {
      this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên Windows 10/11.');
      return false;
    }

    this.killListener();
    if (this.pendingRestore) await this.pendingRestore; // never suppress while a restore is still running

    const psScript = this.scriptPath();
    if (!fs.existsSync(psScript)) {
      this.setStatus(STATUS.ERROR, 'Không tìm thấy script lắng nghe thông báo Windows.');
      return false;
    }

    const suppress = this.config.suppressNativeToast !== false;
    if (!suppress) this.restoreBanners({ sync: true }); // user wants native toasts back
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript,
      '-Suppress', suppress ? '1' : '0', '-ParentPid', String(process.pid)];
    if (suppress && this.bannerBackupPath()) args.push('-BannerBackup', this.bannerBackupPath());

    try {
      const proc = spawn('powershell.exe', args, { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
      this.process = proc;
      this.rl = readline.createInterface({ input: proc.stdout });

      this.rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) return;
        try { this.handleEvent(JSON.parse(trimmed)); } catch { /* ignore non-json lines */ }
      });

      proc.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) this.ctx.log(`[windows_nc] stderr: ${msg}`);
      });

      proc.on('close', (code) => {
        this.ctx.log(`[windows_nc] process exited with code ${code}`);
        if (this.process === proc) this.process = null;
        if (this.status === STATUS.CONNECTED) this.setStatus(STATUS.DISCONNECTED, `Tiến trình đã dừng (mã thoát ${code})`);
      });

      this.setStatus(STATUS.CONNECTED, 'Đang kết nối tới Windows Notification Listener...');
      return true;
    } catch (err) {
      this.setStatus(STATUS.ERROR, `Không thể khởi động: ${err.message}`);
      return false;
    }
  }

  handleEvent(ev) {
    if (ev.type === 'status') {
      if (ev.status === 'Allowed') {
        this.setStatus(STATUS.CONNECTED, '⚡ Đang chặn & thay thế thông báo Windows tức thì');
      } else if (ev.status === 'Denied') {
        this.setStatus(STATUS.LIMITED, 'Windows chặn quyền đọc thông báo. Hãy cấp quyền trong Settings > Privacy > Notifications.');
      } else {
        this.setStatus(STATUS.LIMITED, `Trạng thái quyền: ${ev.status}`);
      }
    } else if (ev.type === 'notification') {
      if (this.seenIds.has(ev.id)) return;
      this.seenIds.add(ev.id);
      if (this.seenIds.size > 500) this.seenIds.delete(this.seenIds.keys().next().value);

      if (this.config.skipSystemUpdates && /windows update|security/i.test(`${ev.appName} ${ev.title}`)) return;

      if (process.env.CPC_TRACE) this.ctx.log(`[windows_nc] capture→node +${Date.now() - (ev.timestamp || Date.now())}ms`);
      this.publish(ev);
    } else if (ev.type === 'error') {
      this.setStatus(STATUS.ERROR, ev.message);
    }
  }

  normalizeNotification(n) {
    const appKey = (n.appName || 'windows').toLowerCase().replace(/[^a-z0-9_.-]/g, '');
    return {
      app: appKey || 'windows',
      appName: n.appName || 'Windows Notification',
      title: n.title || n.appName || 'Thông báo',
      message: n.body || '',
      category: /system|bảo mật|cập nhật/i.test(n.appName || '') ? 'system' : undefined,
      deliveryMode: 'native_os',
      provider: 'windows',
      sourceEventId: n.id,
      openLabel: 'app',
      sourceCreatedAt: n.timestamp || Date.now()
    };
  }

  async runAction(id) {
    if (this.platform !== 'win32') return { ok: false, error: 'Chỉ hỗ trợ Windows' };
    if (id === 'restore-banners') {
      this.killListener();
      this.restoreBanners({ sync: true });
      this.setStatus(STATUS.DISCONNECTED, 'Đã bật lại banner & âm thanh gốc của Windows.');
      return { ok: true };
    }
    const cmds = {
      'open-notification-settings': 'ms-settings:notifications',
      'open-privacy-settings': 'ms-settings:privacy-notifications'
    };
    const uri = cmds[id];
    if (!uri) throw new Error('Unknown action');
    execFile('explorer.exe', [uri], () => {});
    return { ok: true };
  }

  async disconnect() {
    this.killListener();
    this.restoreBanners();
    this.setStatus(this.platform === 'win32' ? STATUS.DISCONNECTED : STATUS.UNSUPPORTED, this.platform === 'win32' ? '' : 'Chỉ có trên Windows 10/11.');
    return true;
  }

  /** Called from app 'before-quit': banners must be back before the process exits. */
  shutdownSync() {
    this.killListener();
    this.restoreBanners({ sync: true });
  }
}

module.exports = { WindowsNotificationAdapter };
