/**
 * "Replace all" — switch every app's macOS notification style to "None" so native banners
 * never appear and the pet is the only notification UI.
 *
 * ⚠️ Undocumented: edits com.apple.ncprefs. Only the alert-style bits are touched
 * (community-documented: bit 3 = Banners, bit 4 = Alerts, both clear = None; verified on this
 * machine: Calendar → Alerts, Mail → Banners). Every other bit (incl. "Show in Notification
 * Center", which the pet needs) is preserved. A full backup is kept and Restore puts back the
 * original style of exactly the apps that were changed.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { parseBplist } = require('./bplist');

// NOTE: flags can exceed 2^32 (seen: 9437708310) — JS bitwise operators are 32-bit and would
// silently drop the high bits, so all bit math here is arithmetic (exact up to 2^53).
const STYLE_MASK = 0b11 << 3;
const STYLE = { none: 0, banners: 1 << 3, alerts: 1 << 4 };
const styleBits = (flags) => Math.floor(flags / 8) % 4 * 8;           // value of bits 3–4
const withStyle = (flags, bits) => flags - styleBits(flags) + bits;   // replace bits 3–4 only
const SKIP = [/^_SYSTEM_CENTER_/, /^com\.cutepet\.companion$/i, /^com\.github\.electron$/i];

const run = (cmd, args) => new Promise((resolve, reject) => execFile(cmd, args, { timeout: 15000 }, (err, stdout, stderr) => (err ? reject(Object.assign(err, { stderr })) : resolve(stdout))));

function styleOf(flags) {
  const s = styleBits(flags);
  return s === STYLE.banners ? 'banners' : s === STYLE.alerts ? 'alerts' : s === 0 ? 'none' : 'unknown';
}

class NcPrefs {
  constructor(dataDir, { domain = 'com.apple.ncprefs', restartDaemons = true } = {}) {
    this.domain = domain;
    this.restartDaemons = restartDaemons;
    this.dir = dataDir || os.tmpdir();
    this.backupFile = path.join(this.dir, 'ncprefs-backup.plist');
    this.changesFile = path.join(this.dir, 'ncprefs-changes.json');
  }

  async exportXml() {
    // Random suffix: two exports in the same millisecond must not share (and delete) one file.
    const xml = path.join(os.tmpdir(), `cpc-ncprefs-${process.pid}-${Date.now()}-${crypto.randomBytes(6).toString('hex')}.plist`);
    await run('/usr/bin/defaults', ['export', this.domain, xml]);
    return xml;
  }

  async readApps(xml) {
    const bin = `${xml}.bin`;
    await run('/usr/bin/plutil', ['-convert', 'binary1', '-o', bin, xml]);
    const plist = parseBplist(fs.readFileSync(bin));
    fs.rmSync(bin, { force: true });
    return (plist.apps || []).map((a, index) => ({ index, bundleId: String(a['bundle-id'] || ''), flags: Number(a.flags) || 0 }));
  }

  changes() {
    try { return JSON.parse(fs.readFileSync(this.changesFile, 'utf8')); } catch { return { active: false, apps: {} }; }
  }

  async status() {
    const xml = await this.exportXml();
    try {
      const apps = await this.readApps(xml);
      const counts = { banners: 0, alerts: 0, none: 0, unknown: 0 };
      for (const a of apps) if (!SKIP.some(r => r.test(a.bundleId))) counts[styleOf(a.flags)]++;
      const ch = this.changes();
      return { ...counts, total: apps.length, replaced: !!ch.active, changedApps: Object.keys(ch.apps || {}).length, hasBackup: fs.existsSync(this.backupFile) };
    } finally { fs.rmSync(xml, { force: true }); }
  }

  async apply(setFlags) {
    const xml = await this.exportXml();
    try {
      const apps = await this.readApps(xml);
      const edits = [];
      for (const a of apps) {
        const next = setFlags(a);
        if (next !== null && next !== a.flags) edits.push(['-c', `Set :apps:${a.index}:flags ${next}`, a, next]);
      }
      for (const [flag, cmd] of edits) await run('/usr/libexec/PlistBuddy', [flag, cmd, xml]);
      if (edits.length) {
        if (this.restartDaemons) {
          // usernoted keeps the prefs of running apps in memory and writes them back when it exits,
          // so stop it BEFORE importing, import, then restart it (launchd relaunches it on demand).
          await run('/usr/bin/killall', ['usernoted']).catch(() => {});
          await new Promise(r => setTimeout(r, 300));
        }
        await run('/usr/bin/defaults', ['import', this.domain, xml]);
        if (this.restartDaemons) {
          await run('/usr/bin/killall', ['usernoted']).catch(() => {});
          await run('/usr/bin/killall', ['NotificationCenter']).catch(() => {});
        }
      }
      return edits.map(([, , a, next]) => ({ bundleId: a.bundleId, from: a.flags, to: next }));
    } finally { fs.rmSync(xml, { force: true }); }
  }

  /** Turn native banners/alerts off for every app (except system entries and ourselves). */
  async replaceAll() {
    if (!fs.existsSync(this.backupFile)) {
      fs.mkdirSync(this.dir, { recursive: true });
      await run('/usr/bin/defaults', ['export', this.domain, this.backupFile]);
    }
    const ch = this.changes();
    const pick = (a) => {
      if (SKIP.some(r => r.test(a.bundleId))) return null;
      const st = styleOf(a.flags);
      if (st === 'none' || st === 'unknown') return null;
      if (!ch.apps[a.bundleId]) ch.apps[a.bundleId] = { style: st };
      return withStyle(a.flags, STYLE.none);
    };
    const save = () => {
      ch.at = Date.now();
      fs.mkdirSync(this.dir, { recursive: true });
      fs.writeFileSync(this.changesFile, JSON.stringify(ch, null, 2), { mode: 0o600 });
    };
    let changed = [];
    let stubborn = [];
    try {
      changed = await this.apply(pick);
      ch.active = true;
      save(); // record what we changed right away: Restore must work even if a retry below fails
      // Verify after the daemons restarted; retry apps that were written back (running apps).
      for (let attempt = 0; attempt < 3; attempt++) {
        await new Promise(r => setTimeout(r, 1500));
        const xml = await this.exportXml();
        try { stubborn = (await this.readApps(xml)).filter(a => pick(a) !== null).map(a => a.bundleId); } finally { fs.rmSync(xml, { force: true }); }
        if (!stubborn.length) break;
        await this.apply(pick);
      }
    } finally {
      if (Object.keys(ch.apps).length) { ch.active = true; ch.stubborn = stubborn; save(); }
    }
    return { changed: changed.length, stubborn };
  }

  /** Put back the original style of the apps we changed (other bits keep their current value). */
  async restore() {
    const ch = this.changes();
    const changed = await this.apply((a) => {
      const orig = ch.apps[a.bundleId];
      if (!orig || styleOf(a.flags) !== 'none') return null; // user changed it since → leave it
      return withStyle(a.flags, STYLE[orig.style] || 0);
    });
    fs.writeFileSync(this.changesFile, JSON.stringify({ active: false, apps: {}, restoredAt: Date.now() }, null, 2), { mode: 0o600 });
    return { restored: changed.length };
  }
}

module.exports = { NcPrefs, styleOf, styleBits, withStyle, STYLE, STYLE_MASK };
