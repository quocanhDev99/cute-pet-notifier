const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { SettingsStore } = require('../src/core/settings-store');
const { startNotificationServer } = require('../src/main/server');

test('settings validate types, enums and ranges; persist to disk', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-'));
  const s = new SettingsStore(dir);
  s.update({ notifications: { duration: 999999, theme: 'neon', presentationMode: 'peeker' }, appearance: { position: 'nowhere' }, bogus: 1, personality: 'calm_gentle' });
  const v = s.get();
  assert.strictEqual(v.notifications.duration, 60000);
  assert.strictEqual(v.notifications.theme, 'pastel');
  assert.strictEqual(v.notifications.presentationMode, 'peeker');
  assert.strictEqual(v.appearance.position, 'bottom-right');
  assert.strictEqual(v.bogus, undefined);
  assert.strictEqual(new SettingsStore(dir).get().personality, 'calm_gentle');

  s.update({
    notifications: { theme: 'minimal' },
    appearance: { dragEnabled: true, customPosition: { x: 250.4, y: 400.9 }, language: 'en' },
    system: { focusMode: 'meeting', presence: 'minimal' }
  });
  const v2 = s.get();
  assert.strictEqual(v2.notifications.theme, 'minimal');
  assert.strictEqual(v2.appearance.customPosition.x, 250);
  assert.strictEqual(v2.appearance.customPosition.y, 401);
  assert.strictEqual(v2.appearance.language, 'en');
  assert.strictEqual(v2.system.focusMode, 'meeting');
  assert.strictEqual(v2.system.presence, 'minimal');
});

function req(port, { method = 'GET', path: p = '/', headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const r = http.request({ host: '127.0.0.1', port, method, path: p, headers: { Host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: d }));
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

test('server: host check, token auth, no CORS on api, webhook secret', async () => {
  const port = 37000 + Math.floor(Math.random() * 1000);
  let secret = null;
  const ingested = [];
  const server = await startNotificationServer({
    port, apiToken: 'tok', userPetsDir: os.tmpdir(),
    getState: () => ({ ok: true }),
    ingest: (p) => { ingested.push(p); return { accepted: true, item: { id: 'n1', emotion: 'happy', matchedBy: 'default' } }; },
    webhookEnabled: () => true, getWebhookSecret: () => secret,
    onEvent: () => {}, adapters: {}
  });
  try {
    assert.strictEqual((await req(port, { headers: { Host: 'evil.com:3721' } })).status, 421);
    assert.strictEqual((await req(port, { path: '/api/state' })).status, 401);
    const ok = await req(port, { path: '/api/state', headers: { 'X-Pet-Token': 'tok', Origin: 'https://evil.com' } });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.headers['access-control-allow-origin'], undefined);
    const home = await req(port, { path: '/' });
    assert.match(home.body, /content="tok"/);
    const n = await req(port, { method: 'POST', path: '/notify', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'hi' }) });
    assert.strictEqual(n.status, 200);
    assert.strictEqual(ingested[0].title, 'hi');
    secret = 's3cret';
    assert.strictEqual((await req(port, { method: 'POST', path: '/notify', body: '{}' })).status, 401);
    assert.strictEqual((await req(port, { method: 'POST', path: '/notify', headers: { 'X-Pet-Secret': 's3cret' }, body: '{}' })).status, 200);
    assert.strictEqual((await req(port, { method: 'POST', path: '/notify', headers: { 'X-Pet-Secret': 's3cret' }, body: '{bad' })).status, 400);
    assert.strictEqual((await req(port, { path: '/assets/..%2f..%2fpackage.json' })).status, 404);
  } finally { server.closeAllConnections(); server.close(); }
});
