const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { NotificationPipeline } = require('../src/core/notification-pipeline');
const { InboxStore } = require('../src/core/inbox-store');
const { DEFAULT_SETTINGS } = require('../src/core/settings-store');
const { project, effectiveMode, mask } = require('../src/core/privacy');

const SECRET = 'ZEBRA-7731-SECRET';
const mk = (privacyOver = {}, extra = {}) => {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  Object.assign(s.privacy, privacyOver);
  Object.assign(s, extra);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-priv-'));
  const inbox = new InboxStore(dir, { getSettings: () => s });
  const p = new NotificationPipeline({ getSettings: () => s, inbox });
  const seen = [];
  for (const ev of ['display', 'inbox', 'history']) p.on(ev, (x) => seen.push(JSON.stringify(x)));
  return { p, s, inbox, dir, seen };
};
const leaks = (str) => String(str).includes(SECRET);

test('Privacy: source_only — marker never reaches overlay, SSE events, history or the persisted Inbox', () => {
  const { p, s, inbox, dir, seen } = mk({ displayMode: 'source_only' });
  s.attention.lowToInbox = true;
  p.ingest({ title: `Lương ${SECRET}`, message: `${SECRET} body`, app: 'teams', appName: 'Teams' }, 'macos_nc');
  p.ingest({ title: `Promo ${SECRET}`, message: SECRET, app: 'shop', priority: 'low' }, 'webhook');
  p.ingest({ title: `PR ${SECRET}`, message: '', app: 'bitbucket', actions: ['approve'], items: [{ key: 'k', title: SECRET, actions: ['approve'] }] }, 'composio');
  assert.ok(seen.length >= 3);
  assert.ok(!seen.some(leaks), 'no event payload contains the marker');
  assert.ok(!leaks(JSON.stringify(p.history)), 'history clean');
  assert.ok(!leaks(JSON.stringify(inbox.list(100))), 'inbox clean');
  const onDisk = fs.readdirSync(dir).map(f => fs.readFileSync(path.join(dir, f), 'utf8')).join('');
  assert.ok(!leaks(onDisk), 'nothing persisted with the marker');
  const shown = p.history.find(h => h.app === 'teams');
  assert.strictEqual(shown.title, 'Tin nhắn mới từ Teams');
  const pr = p.history.find(h => h.app === 'bitbucket');
  assert.deepStrictEqual([pr.actions, pr.items], [[], []], 'no Approve on a redacted card');
});

test('Privacy: anonymous hides the app too; masked keeps first letters only', () => {
  const a = project({ title: `Hi ${SECRET}`, message: SECRET, app: 'zalo', appName: 'Zalo', url: 'https://chat.zalo.me/x' }, 'anonymous_source_only');
  assert.deepStrictEqual([a.title, a.app, a.appName, a.url, a.message], ['Bạn có thông báo mới', 'default', null, null, '']);
  const m = project({ title: 'Sprint review tomorrow', message: SECRET, app: 'teams' }, 'masked');
  assert.strictEqual(m.title, 'S••• r••• t•••');
  assert.ok(!leaks(JSON.stringify(m)));
  assert.strictEqual(mask('Họp 3h'), 'H••• 3•••');
});

test('Privacy: per-app rule is stricter-only; strict global cannot be relaxed', () => {
  const s = { privacy: { displayMode: 'full_content', hiddenApps: ['zalo'] } };
  assert.strictEqual(effectiveMode({ app: 'zalo' }, s), 'source_only');
  assert.strictEqual(effectiveMode({ app: 'teams' }, s), 'full_content');
  const strict = { privacy: { displayMode: 'anonymous_source_only', hiddenApps: ['zalo'] } };
  assert.strictEqual(effectiveMode({ app: 'zalo' }, strict), 'anonymous_source_only');
  assert.strictEqual(effectiveMode({ app: 'teams' }, strict), 'anonymous_source_only');
});

test('Privacy: full_content keeps everything (default)', () => {
  const { p } = mk();
  const r = p.ingest({ title: `T ${SECRET}`, message: 'm', app: 'teams' }, 'macos_nc');
  assert.ok(r.item.title.includes(SECRET));
});
