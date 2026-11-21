/**
 * Mode A / Mode B (Blueprint V4.1 §0, §2):
 *   notifications.bannerMode is the source of truth; the adapters' legacy suppress flags follow it;
 *   settings files from before bannerMode keep the user's behaviour; Mode B keeps the pet quiet only
 *   for events that also have a system banner; switching modes never loses queued events.
 */
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SettingsStore, DEFAULT_SETTINGS } = require('../src/core/settings-store');
const { NotificationPipeline } = require('../src/core/notification-pipeline');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-banner-'));
const writeLegacy = (dir, adapters) => {
  const legacy = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  delete legacy.notifications.bannerMode;
  delete legacy.notifications.companionSound;
  legacy.adapters = { ...legacy.adapters, ...adapters };
  fs.writeFileSync(path.join(dir, 'settings.json'), JSON.stringify(legacy));
};

test('fresh install: Mode B (companion) and the adapters do not suppress banners', () => {
  const v = new SettingsStore(tmp()).get();
  assert.strictEqual(v.notifications.bannerMode, 'companion');
  assert.strictEqual(v.notifications.companionSound, false);
  assert.strictEqual(v.adapters.windows_nc.suppressNativeToast, false);
  assert.strictEqual(v.adapters.macos_nc.suppressNativeBanner, false);
});

test('migration: an existing Windows user who replaced toasts stays in Mode A, and it is saved', () => {
  const dir = tmp();
  writeLegacy(dir, { windows_nc: { enabled: true, suppressNativeToast: true, skipSystemUpdates: false } });
  const v = new SettingsStore(dir, { platform: 'win32' }).get();
  assert.strictEqual(v.notifications.bannerMode, 'replace');
  assert.strictEqual(v.adapters.windows_nc.suppressNativeToast, true);
  const saved = JSON.parse(fs.readFileSync(path.join(dir, 'settings.json'), 'utf8'));
  assert.strictEqual(saved.notifications.bannerMode, 'replace');
});

test('migration: a user who had turned suppression off becomes Mode B; the platform flag decides', () => {
  const dir = tmp();
  writeLegacy(dir, {
    windows_nc: { enabled: true, suppressNativeToast: false, skipSystemUpdates: false },
    macos_nc: { enabled: true, suppressNativeBanner: true, skipConnectedSlack: true, skipAppleSystem: true }
  });
  assert.strictEqual(new SettingsStore(dir, { platform: 'win32' }).get().notifications.bannerMode, 'companion');
  const dir2 = tmp();
  writeLegacy(dir2, {
    windows_nc: { enabled: true, suppressNativeToast: false, skipSystemUpdates: false },
    macos_nc: { enabled: true, suppressNativeBanner: true, skipConnectedSlack: true, skipAppleSystem: true }
  });
  assert.strictEqual(new SettingsStore(dir2, { platform: 'darwin' }).get().notifications.bannerMode, 'replace');
});

test('bannerMode and the legacy suppress flags stay in agreement, whichever side changes', () => {
  const s = new SettingsStore(tmp());
  let v = s.update({ notifications: { bannerMode: 'replace' } });
  assert.strictEqual(v.adapters.windows_nc.suppressNativeToast, true);
  assert.strictEqual(v.adapters.macos_nc.suppressNativeBanner, true);
  // The adapter's own toggle (Control Center adapter card) switches the mode too.
  v = s.update({ adapters: { windows_nc: { suppressNativeToast: false } } });
  assert.strictEqual(v.notifications.bannerMode, 'companion');
  assert.strictEqual(v.adapters.macos_nc.suppressNativeBanner, false);
  // bannerMode wins when both are in one patch; unknown values are rejected.
  v = s.update({ notifications: { bannerMode: 'replace' }, adapters: { windows_nc: { suppressNativeToast: false } } });
  assert.strictEqual(v.notifications.bannerMode, 'replace');
  assert.strictEqual(v.adapters.windows_nc.suppressNativeToast, true);
  v = s.update({ notifications: { bannerMode: 'overlay' } });
  assert.strictEqual(v.notifications.bannerMode, 'replace');
  // Unrelated patches don't touch the mode.
  v = s.update({ adapters: { windows_nc: { skipSystemUpdates: true } } });
  assert.strictEqual(v.notifications.bannerMode, 'replace');
});

const mkPipeline = (notifications) => {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  Object.assign(s.notifications, notifications);
  const p = new NotificationPipeline({ getSettings: () => s });
  const shown = [];
  p.on('display', (i) => shown.push(i));
  return { p, s, shown };
};

test('Mode B: the pet is quiet for events that also have a system banner, not for others', () => {
  const { p, shown } = mkPipeline({ bannerMode: 'companion', companionSound: false });
  p.ingest({ title: 'Toast', app: 'zalo' }, 'windows_nc');
  assert.strictEqual(shown[0].silent, true);
  p.finished(shown[0].id);
  const r = p.ingest({ title: 'Mail', app: 'gmail' }, 'composio');
  assert.strictEqual(r.item.silent, false);
  const r2 = p.ingest({ title: 'Banner', app: 'teams' }, 'macos_nc');
  assert.strictEqual(r2.item.silent, true);
});

test('Mode B with companionSound on, and Mode A: the pet keeps its sound', () => {
  const b = mkPipeline({ bannerMode: 'companion', companionSound: true });
  assert.strictEqual(b.p.ingest({ title: 'Toast', app: 'zalo' }, 'windows_nc').item.silent, false);
  const a = mkPipeline({ bannerMode: 'replace' });
  assert.strictEqual(a.p.ingest({ title: 'Toast', app: 'zalo' }, 'windows_nc').item.silent, false);
});

test('switching A ↔ B mid-stream loses and duplicates nothing', () => {
  const { p, s, shown } = mkPipeline({ bannerMode: 'replace' });
  for (let i = 0; i < 3; i++) p.ingest({ title: `m${i}`, app: `app${i}`, sourceEventId: `e${i}` }, 'windows_nc');
  s.notifications.bannerMode = 'companion';
  for (let i = 3; i < 6; i++) p.ingest({ title: `m${i}`, app: `app${i}`, sourceEventId: `e${i}` }, 'windows_nc');
  // A provider retry after the switch is still recognised as a duplicate.
  assert.strictEqual(p.ingest({ title: 'm0', app: 'app0', sourceEventId: 'e0' }, 'windows_nc').reason, 'duplicate_event');
  while (p.current) p.finished(p.current.id) || p.pump();
  const seen = new Set([...shown.map(i => i.title), ...p.queue.map(i => i.title)]);
  assert.strictEqual(seen.size, 6);
  assert.strictEqual(p.stats.received, 7);
  assert.strictEqual(p.stats.deduped, 1);
});
