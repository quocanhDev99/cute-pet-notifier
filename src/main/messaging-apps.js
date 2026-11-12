/**
 * Messaging apps on THIS computer — for step ① of "👥 Người quen": which chat apps are installed and
 * which are running right now, with their real icons. Only app names/paths and process names are
 * read (the same info as Activity Monitor / Task Manager); nothing inside the apps is touched.
 *
 * Keys match the notification adapters (macos-nc-adapter KNOWN_APPS / windows-nc-adapter), so a
 * detected app lines up with the chats the pet learned from its notifications.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFile } = require('child_process');

const CACHE_MS = 30 * 1000;

/** key → mac bundle names, mac process-name test, windows exe names, label. */
const CATALOG = [
  { app: 'teams', label: 'Microsoft Teams', mac: ['Microsoft Teams.app', 'Microsoft Teams (work or school).app', 'Microsoft Teams classic.app'], macProc: /^(MSTeams|Microsoft Teams)$/, win: ['ms-teams.exe', 'teams.exe'] },
  { app: 'zalo', label: 'Zalo', mac: ['Zalo.app'], macProc: /^Zalo$/, win: ['zalo.exe'] },
  { app: 'messenger', label: 'Messenger', mac: ['Messenger.app'], macProc: /^Messenger$/, win: ['messenger.exe'] },
  { app: 'slack', label: 'Slack', mac: ['Slack.app'], macProc: /^Slack$/, win: ['slack.exe'] },
  { app: 'telegram', label: 'Telegram', mac: ['Telegram.app', 'Telegram Desktop.app'], macProc: /^Telegram$/, win: ['telegram.exe'] },
  { app: 'discord', label: 'Discord', mac: ['Discord.app'], macProc: /^Discord$/, win: ['discord.exe'] },
  { app: 'whatsapp', label: 'WhatsApp', mac: ['WhatsApp.app'], macProc: /^WhatsApp$/, win: ['whatsapp.exe', 'whatsapp.root.exe'] },
  { app: 'messages', label: 'Tin nhắn', mac: ['/System/Applications/Messages.app'], macProc: /^Messages$/, win: [] },
  { app: 'viber', label: 'Viber', mac: ['Viber.app'], macProc: /^Viber$/, win: ['viber.exe'] },
  { app: 'line', label: 'LINE', mac: ['LINE.app'], macProc: /^LINE$/, win: ['line.exe'] },
  { app: 'skype', label: 'Skype', mac: ['Skype.app'], macProc: /^Skype$/, win: ['skype.exe'] },
  { app: 'signal', label: 'Signal', mac: ['Signal.app'], macProc: /^Signal$/, win: ['signal.exe'] },
  { app: 'wechat', label: 'WeChat', mac: ['WeChat.app'], macProc: /^WeChat$/, win: ['wechat.exe', 'weixin.exe'] },
  { app: 'lark', label: 'Lark', mac: ['Lark.app', 'Feishu.app'], macProc: /^(Lark|Feishu)$/, win: ['lark.exe', 'feishu.exe'] }
];

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 4000, maxBuffer: 8 * 1024 * 1024, windowsHide: true }, (err, out) => resolve(err ? '' : String(out || '')));
  });
}

class MessagingApps {
  /** @param {{ platform?: string, getIcon?: (p: string) => Promise<string|null>, exists?: (p: string) => boolean, exec?: typeof run, home?: string }} [opts] */
  constructor(opts = {}) {
    this.platform = opts.platform || process.platform;
    this.getIcon = opts.getIcon || (async () => null);
    this.exists = opts.exists || ((p) => { try { return fs.existsSync(p); } catch { return false; } });
    this.exec = opts.exec || run;
    this.home = opts.home || os.homedir();
    this.env = opts.env || null;
    this.readdir = opts.readdir || null;
    this.cache = null;
    this.icons = new Map();
  }

  macPath(name) {
    if (name.startsWith('/')) return this.exists(name) ? name : null;
    for (const dir of ['/Applications', path.posix.join(this.home, 'Applications')]) {
      const p = path.posix.join(dir, name);
      if (this.exists(p)) return p;
    }
    return null;
  }

  winPath(exe) {
    const env = this.env || process.env;
    const local = env.LOCALAPPDATA || path.join(this.home, 'AppData', 'Local');
    const base = exe.replace(/\.exe$/i, '');
    const programFiles = [env.ProgramFiles || 'C:\\Program Files', env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', env.ProgramW6432].filter(Boolean);
    const guesses = [
      path.join(local, base, exe),
      path.join(local, 'Programs', base, exe),
      path.join(local, 'Microsoft', 'WindowsApps', exe),
      ...programFiles.map(pf => path.join(pf, base, exe))
    ];
    const hit = guesses.find(p => this.exists(p));
    if (hit) return hit;
    // Squirrel installs (Discord, Slack, Teams classic…): %LOCALAPPDATA%\<App>\app-<version>\<exe>
    for (const root of [path.join(local, base), ...programFiles.map(pf => path.join(pf, base))]) {
      let dirs = [];
      try { dirs = (this.readdir ? this.readdir(root) : fs.readdirSync(root)).filter(d => /^app-\d/.test(d)); } catch { continue; }
      dirs.sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
      for (const d of dirs) { const p = path.join(root, d, exe); if (this.exists(p)) return p; }
    }
    return null;
  }

  async running() {
    if (this.platform === 'darwin') {
      const out = await this.exec('ps', ['-axo', 'comm=']);
      // ".../Zalo.app/Contents/MacOS/Zalo" → "Zalo" (main executables only, not helpers)
      return new Set(out.split('\n').map(l => (/\.app\/Contents\/MacOS\/([^/]+)$/.exec(l.trim()) || [])[1]).filter(Boolean));
    }
    if (this.platform === 'win32') {
      const out = await this.exec('tasklist', ['/fo', 'csv', '/nh']);
      return new Set(out.split('\n').map(l => (/^"([^"]+)"/.exec(l.trim()) || [])[1]).filter(Boolean).map(s => s.toLowerCase()));
    }
    return new Set();
  }

  async icon(p) {
    if (!p) return null;
    if (this.icons.has(p)) return this.icons.get(p);
    const icon = await this.getIcon(p).catch(() => null);
    if (icon) this.icons.set(p, icon); // a failed read is retried next time, not cached as "no icon"
    return icon;
  }

  /** @returns {Promise<Array<{ app: string, label: string, installed: boolean, running: boolean, icon: string|null }>>} */
  async detect({ refresh = false } = {}) {
    if (!refresh && this.cache && Date.now() - this.cache.at < CACHE_MS) return this.cache.list;
    const procs = await this.running();
    const list = [];
    for (const c of CATALOG) {
      let installedAt = null;
      let isRunning = false;
      if (this.platform === 'darwin') {
        installedAt = c.mac.map(n => this.macPath(n)).find(Boolean) || null;
        isRunning = [...procs].some(p => c.macProc.test(p));
      } else if (this.platform === 'win32') {
        isRunning = c.win.some(e => procs.has(e));
        installedAt = c.win.map(e => this.winPath(e)).find(Boolean) || null;
      }
      if (!installedAt && !isRunning) continue;
      list.push({ app: c.app, label: c.label, installed: !!installedAt || isRunning, running: isRunning, icon: await this.icon(installedAt) });
    }
    list.sort((a, b) => Number(b.running) - Number(a.running));
    this.cache = { at: Date.now(), list };
    return list;
  }
}

module.exports = { MessagingApps, CATALOG };
