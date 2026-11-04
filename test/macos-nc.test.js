const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { parseBplist } = require('../src/adapters/bplist');
const { MacNotificationCenterAdapter } = require('../src/adapters/macos-nc-adapter');

const isMac = process.platform === 'darwin' && fs.existsSync('/usr/bin/plutil') && fs.existsSync('/usr/bin/sqlite3');

function makeBplist(dir, obj) {
  const json = path.join(dir, `p${Math.random().toString(36).slice(2)}.json`);
  fs.writeFileSync(json, JSON.stringify(obj));
  execFileSync('/usr/bin/plutil', ['-convert', 'binary1', json]);
  return fs.readFileSync(json);
}

test('bplist parser: dict / unicode strings / numbers / nested', { skip: !isMac }, () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-bp-'));
  const buf = makeBplist(dir, { app: 'com.vng.zalo', date: 783000000.5, req: { titl: 'Mẹ 💕', body: 'Con ăn cơm chưa?', n: 42 }, list: [1, 'a', true] });
  const o = parseBplist(buf);
  assert.strictEqual(o.app, 'com.vng.zalo');
  assert.strictEqual(o.req.titl, 'Mẹ 💕');
  assert.strictEqual(o.req.body, 'Con ăn cơm chưa?');
  assert.strictEqual(o.req.n, 42);
  assert.deepStrictEqual(o.list, [1, 'a', true]);
  assert.throws(() => parseBplist(Buffer.from('nope')));
});

test('macOS NC adapter: only NEW records, read-only, maps app, skips own app, event-driven', { skip: !isMac }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-nc-'));
  const db = path.join(dir, 'db');
  const sql = (q) => execFileSync('/usr/bin/sqlite3', [db, q], { encoding: 'utf8' });
  sql('PRAGMA journal_mode=WAL; CREATE TABLE app (app_id INTEGER PRIMARY KEY, identifier VARCHAR, badge INTEGER); CREATE TABLE record (rec_id INTEGER PRIMARY KEY, app_id INTEGER, uuid BLOB, data BLOB, request_date REAL, request_last_date REAL, delivered_date REAL, presented Bool, style INTEGER, snooze_fire_date REAL);');
  sql("INSERT INTO app VALUES (1,'com.vng.zalo',0),(2,'com.github.Electron',0);");
  const insert = (id, appId, obj) => sql(`INSERT INTO record (rec_id, app_id, data, delivered_date) VALUES (${id}, ${appId}, X'${makeBplist(dir, obj).toString('hex')}', ${(Date.now() - 978307200000) / 1000});`);
  insert(1, 1, { app: 'com.vng.zalo', req: { titl: 'OLD', body: 'old message' } }); // existed before connect → must be ignored

  const settings = { get: () => ({ adapters: { macos_nc: { enabled: true }, slack: { enabled: false } } }) };
  const a = new MacNotificationCenterAdapter({ settings, secrets: { has: () => false }, log: () => {}, ncDbPath: db, ncBridgePath: '/nonexistent' }, 'darwin');
  const got = [];
  a.subscribeNotifications((p, source, meta) => got.push({ p, source, meta }));
  try {
    assert.strictEqual(await a.connect(), true);
    insert(2, 2, { app: 'com.github.Electron', req: { titl: 'self', body: 'own app' } });            // skipped
    insert(3, 1, { app: 'com.vng.zalo', req: { titl: 'Ban C', subt: 'Nhóm Dev', body: 'Họp lúc 3h nhé' } });
    for (let i = 0; i < 100 && !got.length; i++) await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(got.length, 1);
    const n = got[0].p;
    assert.strictEqual(n.app, 'zalo');
    assert.strictEqual(n.appName, 'Zalo');
    assert.strictEqual(n.title, 'Ban C — Nhóm Dev');
    assert.strictEqual(n.message, 'Họp lúc 3h nhé');
    assert.strictEqual(n.deliveryMode, 'native_os');
    assert.strictEqual(n.sourceEventId, 'nc:3:com.vng.zalo');
    assert.ok(Math.abs(n.sourceCreatedAt - Date.now()) < 10000);
    assert.strictEqual(got[0].meta.deliveryMode, 'native_os');
  } finally { await a.disconnect(); }
});

test('macOS NC adapter is Unsupported on other platforms', async () => {
  const a = new MacNotificationCenterAdapter({ settings: { get: () => ({ adapters: {} }) }, secrets: { has: () => false }, log: () => {} }, 'win32');
  assert.strictEqual(a.getConnectionStatus(), 'Unsupported');
  assert.strictEqual(await a.connect(), false);
});

test('deep links: Teams chat/meeting message, Slack, generic safe URL, unsafe rejected', () => {
  const { deepLinkFor, safeUrl } = require('../src/adapters/nc-deeplink');
  const archive = (obj) => {
    // minimal NSKeyedArchiver-shaped object (already parsed form)
    const objects = ['$null'];
    const add = (v) => { objects.push(v); return { uid: objects.length - 1 }; };
    const keys = [], vals = [];
    for (const [k, v] of Object.entries(obj)) { keys.push(add(k)); vals.push(add(v)); }
    const root = add({ 'NS.keys': keys, 'NS.objects': vals });
    return { $archiver: 'NSKeyedArchiver', $top: { root }, $objects: objects };
  };
  const conv = '19:meeting_ABCdefGHIjkl12@thread.v2';
  const teams = deepLinkFor('com.microsoft.teams2', { usda: archive({ default_id: conv, default_options: JSON.stringify({ actionType: 'open', messageId: '1793690000000' }) }) });
  assert.strictEqual(teams.url, `msteams:/l/message/${conv}/1793690000000?context=${encodeURIComponent('{"contextType":"chat"}')}`);
  assert.strictEqual(teams.kind, 'message');
  const slack = deepLinkFor('com.tinyspeck.slackmacgap', { usda: archive({ team: 'T123', channel: 'C456', ts: '1712345678.000100' }) });
  assert.strictEqual(slack.url, 'slack://channel?team=T123&id=C456&message=1712345678.000100');
  assert.strictEqual(deepLinkFor('com.apple.mail', { usda: archive({ url: 'message://%3Cabc@x%3E' }) }).url, 'message://%3Cabc@x%3E');
  assert.strictEqual(deepLinkFor('com.evil', { usda: archive({ url: 'file:///etc/passwd' }) }).url, null);
  assert.strictEqual(safeUrl('javascript:alert(1)'), null);
  assert.strictEqual(deepLinkFor('com.vng.zalo', {}).url, null);
});

test('AX layer + DB layer: one card per notification, click presses the hidden banner', { skip: !isMac }, async () => {
  const { MacNotificationCenterAdapter: A } = require('../src/adapters/macos-nc-adapter');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-ax-'));
  const db = path.join(dir, 'db');
  const sql = (q) => execFileSync('/usr/bin/sqlite3', [db, q], { encoding: 'utf8' });
  sql('PRAGMA journal_mode=WAL; CREATE TABLE app (app_id INTEGER PRIMARY KEY, identifier VARCHAR, badge INTEGER); CREATE TABLE record (rec_id INTEGER PRIMARY KEY, app_id INTEGER, uuid BLOB, data BLOB, request_date REAL, request_last_date REAL, delivered_date REAL, presented Bool, style INTEGER, snooze_fire_date REAL);');
  sql("INSERT INTO app VALUES (1,'com.microsoft.teams2',0);");
  const settings = { get: () => ({ adapters: { macos_nc: { enabled: true, suppressNativeBanner: true }, slack: { enabled: false } } }) };
  const a = new A({ settings, secrets: { has: () => false }, log: () => {}, ncDbPath: db, ncBridgePath: '/nonexistent', dataDir: dir }, 'darwin');
  const got = [];
  a.subscribeNotifications((p) => got.push(p));
  try {
    assert.strictEqual(await a.connect(), true);
    // fake bridge process capturing commands
    const sent = [];
    a.interceptorProc = { stdin: { write: (l) => { const c = JSON.parse(l); sent.push(c); setImmediate(() => a.handleInterceptorEvent({ type: 'result', cmd: c.cmd, id: c.id, ok: true })); }, end() {} }, kill() {} };
    a.handleInterceptorEvent({ type: 'ready', trusted: true });
    a.handleInterceptorEvent({ type: 'banner', id: '4242', app: 'Microsoft Teams', title: 'Ban C', subtitle: '', body: 'Họp lúc 3h nhé', t: Date.now() });
    assert.strictEqual(got.length, 1);
    assert.strictEqual(got[0].app, 'teams');
    assert.strictEqual(got[0].appName, 'Microsoft Teams');
    assert.strictEqual(got[0].openLabel, 'chat');
    // same notification arrives in the DB ~5 s later → no second card
    sql(`INSERT INTO record (rec_id, app_id, data, delivered_date) VALUES (1, 1, X'${makeBplist(dir, { app: 'com.microsoft.teams2', req: { titl: 'Ban C', body: 'Họp lúc 3h nhé' } }).toString('hex')}', ${(Date.now() - 978307200000) / 1000});`);
    await a.readNew();
    assert.strictEqual(got.length, 1);
    // clicking the card presses the real banner
    await a.handleNotificationAction('open', 'ax:4242');
    assert.deepStrictEqual(sent.find(c => c.cmd === 'press'), { cmd: 'press', id: '4242' });
    // card dismissed → hidden banner closed
    a.handleNotificationAction('dismiss', 'ax:4242');
    assert.ok(sent.some(c => c.cmd === 'close' && c.id === '4242'));
  } finally { a.interceptorProc = null; await a.disconnect(); }
});
