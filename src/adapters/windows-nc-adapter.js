/**
 * Windows UserNotificationListener adapter (WinRT).
 * Captures real-time notifications from any Windows app and suppresses
 * native toasts via listener.RemoveNotification() so user gets no duplicate banners.
 */
const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');
const readline = require('readline');
const { ApplicationAdapter, STATUS } = require('./base-adapter');

class WindowsNotificationAdapter extends ApplicationAdapter {
  constructor(ctx, platform = process.platform) {
    super(ctx, {
      id: 'windows_toast',
      name: 'Windows Toast Listener (thay thế thông báo hệ thống)',
      icon: '🪟',
      description: 'Bắt thông báo của MỌI ứng dụng trên Windows (Zalo, Teams, Outlook, Chrome, Telegram…) qua WinRT và để thú cưng mang tới thay cho toast mặc định.',
      help: 'Sử dụng Windows.UI.Notifications.Management.UserNotificationListener để đọc và tự động đóng toast gốc của Windows. Hoàn toàn cục bộ, không gửi dữ liệu ra ngoài máy.',
      deliveryMode: 'native_os',
      provider: 'windows',
      fields: [
        { key: 'suppressNativeToast', label: 'Tự động đóng toast gốc của Windows (tránh trùng lặp)', type: 'boolean', default: true },
        { key: 'skipSystemUpdates', label: 'Bỏ qua thông báo Windows Update / Bảo mật', type: 'boolean', default: false }
      ],
      actions: [
        { id: 'open-notification-settings', label: '⚙️ Mở Cài đặt Thông báo của Windows' },
        { id: 'open-privacy-settings', label: '🔐 Mở Cài đặt Quyền riêng tư Thông báo' }
      ]
    });

    this.platform = platform;
    this.process = null;
    this.rl = null;
    this.seenIds = new Set();

    if (platform !== 'win32') {
      this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên Windows 10 (bản 1607 trở lên) và Windows 11.');
    }
  }

  async connect() {
    if (this.platform !== 'win32') {
      this.setStatus(STATUS.UNSUPPORTED, 'Chỉ có trên Windows 10/11.');
      return false;
    }

    this.disconnect();

    const rootDir = path.resolve(__dirname, '../..');
    const exePath = path.join(rootDir, 'bin', 'windows-listener.exe');
    const psScript = path.join(rootDir, 'src', 'native', 'windows', 'NotificationListener.ps1');

    let cmd = 'powershell.exe';
    let args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', psScript];

    if (fs.existsSync(exePath)) {
      cmd = exePath;
      args = [];
    } else if (!fs.existsSync(psScript)) {
      this.setStatus(STATUS.ERROR, 'Không tìm thấy script lắng nghe thông báo Windows.');
      return false;
    }

    try {
      this.process = spawn(cmd, args, {
        windowsHide: true,
        stdio: ['pipe', 'pipe', 'pipe']
      });

      this.rl = readline.createInterface({ input: this.process.stdout });

      this.rl.on('line', (line) => {
        const trimmed = line.trim();
        if (!trimmed.startsWith('{')) return;
        try {
          const ev = JSON.parse(trimmed);
          this.handleEvent(ev);
        } catch { /* ignore non-json lines */ }
      });

      this.process.stderr.on('data', (data) => {
        const msg = data.toString().trim();
        if (msg) this.ctx.log(`[windows_toast] stderr: ${msg}`);
      });

      this.process.on('close', (code) => {
        this.ctx.log(`[windows_toast] process exited with code ${code}`);
        if (this.status === STATUS.CONNECTED) {
          this.setStatus(STATUS.DISCONNECTED, `Tiến trình đã dừng (mã thoát ${code})`);
        }
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
      if (this.seenIds.size > 500) {
        this.seenIds.delete(this.seenIds.keys().next().value);
      }

      const cfg = this.config;
      if (cfg.skipSystemUpdates && /windows update|security/i.test(`${ev.appName} ${ev.title}`)) {
        return;
      }

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
    if (this.process) {
      try {
        this.process.stdin.write(JSON.stringify({ action: 'quit' }) + '\n');
      } catch {}
      setTimeout(() => {
        if (this.process) this.process.kill();
        this.process = null;
      }, 500);
    }
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }
    this.setStatus(this.platform === 'win32' ? STATUS.DISCONNECTED : STATUS.UNSUPPORTED, this.platform === 'win32' ? '' : 'Chỉ có trên Windows 10/11.');
    return true;
  }
}

module.exports = { WindowsNotificationAdapter };

