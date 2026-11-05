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
const os = require('os');
const { ApplicationAdapter, STATUS } = require('./base-adapter');

const firstLine = (s, max) => String(s || '').split(/\r?\n/)[0].slice(0, max);

/** "10.0.19045" → Windows 10, "10.0.22631" → Windows 11 (build ≥ 22000). */
function windowsName(release = os.release()) {
  const build = Number(String(release).split('.')[2]) || 0;
  return { release, build, name: build >= 22000 ? 'Windows 11' : 'Windows 10' };
}

/** Settings path for notification access differs between Windows 10 and 11. */
function accessHint(build) {
  return build >= 22000
    ? 'Cài đặt → Quyền riêng tư & bảo mật → Thông báo → bật "Truy cập thông báo"'
    : 'Cài đặt → Quyền riêng tư → Thông báo → bật "Cho phép truy cập thông báo trên thiết bị này" và "Cho phép ứng dụng truy cập thông báo"';
}

/** A test toast sent as Windows PowerShell (an AUMID every Windows 10/11 has registered). ASCII only. */
const TEST_TOAST_PS = [
  "[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null",
  "$xml = [Windows.UI.Notifications.ToastNotificationManager]::GetTemplateContent([Windows.UI.Notifications.ToastTemplateType]::ToastText02)",
  "$t = $xml.GetElementsByTagName('text')",
  "$null = $t.Item(0).AppendChild($xml.CreateTextNode('Cute Pet - test'))",
  "$null = $t.Item(1).AppendChild($xml.CreateTextNode('Neu be hien the nay la da doc duoc thong bao cua Windows'))",
  "[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe').Show([Windows.UI.Notifications.ToastNotification]::new($xml))"
].join('; ');

/** AUMIDs look like "com.vng.zalo", "MSTeams_8wekyb3d8bbwe!MSTeams" or "{GUID}\Path\app.exe".
 *  Allowlist the characters so nothing else can reach explorer.exe's command line. */
function isSafeAumid(id) {
  return typeof id === 'string' && id.length > 0 && id.length <= 260 && /^[A-Za-z0-9._!{}\\ ()-]+$/.test(id) && !id.includes('..');
}

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
    this.appIds = new Map(); // notification id → sender's AppUserModelID (for "Mở app")
    this.win = windowsName();
    // Self-diagnostics shown in Control Center (no notification content, only counts and app names).
    this.diag = { os: `${this.win.name} (${this.win.release})`, access: null, inCenter: null, captured: 0, lastApp: null, lastAt: null };

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
    clearTimeout(this.watchdog);
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
        if (!msg) return;
        this.lastStderr = msg.slice(-400);
        this.ctx.log(`[windows_nc] stderr: ${msg}`);
      });

      proc.on('close', (code) => {
        this.ctx.log(`[windows_nc] process exited with code ${code}`);
        clearTimeout(this.watchdog);
        if (this.process !== proc) return; // replaced or stopped on purpose
        this.process = null;
        const why = this.lastStderr ? ` — ${firstLine(this.lastStderr, 200)}` : '';
        this.setStatus(STATUS.ERROR, `Trình đọc thông báo đã dừng (mã ${code})${why}. Thường do PowerShell bị chặn bởi chính sách công ty hoặc phần mềm diệt virus.`);
      });

      // Not "Connected" until the listener has really read Action Center once (see handleEvent).
      this.ready = false;
      this.setStatus(STATUS.LIMITED, 'Đang khởi động trình đọc thông báo…');
      clearTimeout(this.watchdog);
      this.watchdog = setTimeout(() => {
        if (this.ready || this.process !== proc) return;
        // Still waiting for the user to allow notification access: keep that guidance on screen.
        if (this.accessStatus && this.accessStatus !== 'Allowed') return;
        this.setStatus(STATUS.ERROR, `Trình đọc thông báo không phản hồi sau 25 giây${this.lastStderr ? ` (${firstLine(this.lastStderr, 160)})` : ''}.`);
      }, 25000);
      if (this.watchdog.unref) this.watchdog.unref();
      return true;
    } catch (err) {
      this.setStatus(STATUS.ERROR, `Không thể khởi động: ${err.message}`);
      return false;
    }
  }

  handleEvent(ev) {
    if (ev.type === 'status') {
      this.accessStatus = ev.status;
      this.diag.access = ev.status;
      if (ev.status === 'Allowed') {
        this.setStatus(STATUS.LIMITED, 'Đã có quyền, đang đọc Trung tâm thông báo…');
      } else {
        this.setStatus(STATUS.LIMITED, `Windows chưa cho phép đọc thông báo (${ev.status}). ${accessHint(this.win.build)}. Bé tự nhận ra khi bạn bật.`);
      }
    } else if (ev.type === 'ready') {
      this.ready = true;
      if (Number.isInteger(ev.initialCount)) this.diag.inCenter = ev.initialCount;
      clearTimeout(this.watchdog);
      this.setStatus(STATUS.CONNECTED, '⚡ Đang chặn & thay thế thông báo Windows tức thì');
    } else if (ev.type === 'heartbeat') {
      if (ev.inCenter !== this.diag.inCenter) { this.diag.inCenter = ev.inCenter; this.emit('status', this.describe()); }
    } else if (ev.type === 'log') {
      this.ctx.log(`[windows_nc] ${String(ev.message || '').slice(0, 300)}`);
    } else if (ev.type === 'notification') {
      if (this.seenIds.has(ev.id)) return;
      this.seenIds.add(ev.id);
      if (this.seenIds.size > 500) this.seenIds.delete(this.seenIds.keys().next().value);
      this.diag.captured++;
      this.diag.lastApp = String(ev.appName || 'Windows').slice(0, 60);
      this.diag.lastAt = Date.now();

      if (this.config.skipSystemUpdates && /windows update|security/i.test(`${ev.appName} ${ev.title}`)) return;

      if (process.env.CPC_TRACE) this.ctx.log(`[windows_nc] capture→node +${Date.now() - (ev.timestamp || Date.now())}ms`);
      // Remember which app sent it, so "Mở app" on the card can bring that app to the front.
      if (isSafeAumid(ev.aumid)) {
        this.appIds.set(ev.id, ev.aumid);
        if (this.appIds.size > 500) this.appIds.delete(this.appIds.keys().next().value);
      }
      this.publish(ev);
    } else if (ev.type === 'error') {
      const msg = String(ev.message || '');
      this.ctx.log(`[windows_nc] error: ${msg.slice(0, 300)}`);
      this.ready = false;
      this.setStatus(STATUS.ERROR, msg.startsWith('read_failed')
        ? `Không đọc được Trung tâm thông báo (${msg.slice(13, 160)}). Kiểm tra Cài đặt → Quyền riêng tư & bảo mật → Thông báo.`
        : msg.slice(0, 200));
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

  /**
   * Card "Mở app": bring the sending app to the front via its AppUserModelID
   * (`shell:AppsFolder\<AUMID>` launches it, or focuses the running window).
   * Windows offers no API for a third party to activate someone else's toast, so the exact
   * conversation can't be opened — the app opens where the user left it.
   */
  async handleNotificationAction(action, externalId) {
    if (this.platform !== 'win32' || action !== 'open') return;
    const aumid = this.appIds.get(String(externalId || ''));
    if (!aumid) return;
    execFile('explorer.exe', [`shell:AppsFolder\\${aumid}`], { windowsHide: true }, () => {});
  }

  async runAction(id) {
    if (this.platform !== 'win32') return { ok: false, error: 'Chỉ hỗ trợ Windows' };
    if (id === 'restore-banners') {
      this.killListener();
      this.restoreBanners({ sync: true });
      this.setStatus(STATUS.DISCONNECTED, 'Đã bật lại banner & âm thanh gốc của Windows.');
      return { ok: true };
    }
    if (id === 'test-toast') {
      const encoded = Buffer.from(TEST_TOAST_PS, 'utf16le').toString('base64');
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded], { windowsHide: true, timeout: 15000 }, (err) => {
        if (err) this.ctx.log(`[windows_nc] test toast failed: ${err.message}`);
      });
      return { ok: true, before: this.diag.captured };
    }
    if (id === 'probe-popups') {
      // Read-only diagnostics: watch 60 s for apps that draw their OWN popups (not Windows
      // notifications) and check whether their text is readable. Text is masked in the report.
      if (!this.ctx.dataDir) return { ok: false, error: 'Không có thư mục dữ liệu' };
      if (this.probing) return { ok: false, error: 'Đang dò rồi, chờ chút nhé' };
      const out = path.join(this.ctx.dataDir, 'logs', 'popup-probe.txt');
      const script = path.join(path.dirname(this.scriptPath()), 'ProbePopups.ps1');
      this.probing = true;
      execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-Seconds', '60', '-Out', out, '-ExcludePid', String(process.pid)],
        { windowsHide: true, timeout: 90000 }, (err) => {
          this.probing = false;
          if (err) this.ctx.log(`[windows_nc] popup probe failed: ${err.message}`);
          else execFile('explorer.exe', [`/select,${out}`], () => {});
        });
      return { ok: true, seconds: 60, out };
    }
    if (id === 'open-logs') {
      if (!this.ctx.dataDir) return { ok: false, error: 'Không có thư mục dữ liệu' };
      const dir = path.join(this.ctx.dataDir, 'logs');
      fs.mkdirSync(dir, { recursive: true });
      execFile('explorer.exe', [dir], () => {});
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

  describe() {
    const d = super.describe();
    d.extra = { ...this.diag, accessHint: accessHint(this.win.build) };
    return d;
  }

  /** Called from app 'before-quit': banners must be back before the process exits. */
  shutdownSync() {
    this.killListener();
    this.restoreBanners({ sync: true });
  }
}

module.exports = { WindowsNotificationAdapter, isSafeAumid, windowsName };
