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

const TOK = 'tok-0123456789abcdef';

test('server: host check, token auth, no CORS on api, webhook secret', async () => {
  const port = 37000 + Math.floor(Math.random() * 1000);
  let secret = null;
  const ingested = [];
  const server = await startNotificationServer({
    port, apiToken: TOK, userPetsDir: os.tmpdir(),
    getState: () => ({ ok: true }),
    ingest: (p) => { ingested.push(p); return { accepted: true, item: { id: 'n1', emotion: 'happy', matchedBy: 'default' } }; },
    webhookEnabled: () => true, getWebhookSecret: () => secret,
    onEvent: () => {}, adapters: {}
  });
  try {
    assert.strictEqual((await req(port, { headers: { Host: 'evil.com:3721' } })).status, 421);
    assert.strictEqual((await req(port, { path: '/api/state' })).status, 401);
    const ok = await req(port, { path: '/api/state', headers: { 'X-Pet-Token': TOK, Origin: 'https://evil.com' } });
    assert.strictEqual(ok.status, 200);
    assert.strictEqual(ok.headers['access-control-allow-origin'], undefined);
    // The page carrying the token needs the session cookie from a single-use launch link.
    const anon = await req(port, { path: '/' });
    assert.strictEqual(anon.status, 401);
    assert.doesNotMatch(anon.body, new RegExp(TOK));
    const launch = new URL(server.launchUrl('#inbox'));
    const hop = await req(port, { path: launch.pathname + launch.search });
    assert.strictEqual(hop.status, 302);
    const cookie = String(hop.headers['set-cookie']).split(';')[0];
    assert.match(String(hop.headers['set-cookie']), /HttpOnly/);
    assert.strictEqual((await req(port, { path: launch.pathname + launch.search })).status, 401, 'tickets are single-use');
    const home = await req(port, { path: '/', headers: { Cookie: cookie } });
    assert.match(home.body, new RegExp(`content="${TOK}"`));
    // Websites can't post to /notify or probe /health.
    assert.strictEqual((await req(port, { method: 'POST', path: '/notify', headers: { Origin: 'https://evil.com', 'Content-Type': 'text/plain' }, body: '{"title":"x"}' })).status, 403);
    assert.strictEqual((await req(port, { path: '/health', headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
    assert.strictEqual((await req(port, { path: '/health' })).headers['access-control-allow-origin'], undefined);
    // Only known pets may receive a model upload; bad escapes and oversize bodies are clean errors.
    assert.strictEqual((await req(port, { method: 'POST', path: '/api/pets/evil_dir/model', headers: { 'X-Pet-Token': TOK }, body: 'x' })).status, 404);
    assert.strictEqual((await req(port, { path: '/assets/%E0%A4%A' })).status, 404);
    assert.strictEqual((await req(port, { method: 'POST', path: '/notify', headers: { 'Content-Type': 'application/json' }, body: 'x'.repeat(70 * 1024) })).status, 413);
    assert.strictEqual((await req(port, { method: 'POST', path: '/notify', headers: { 'Content-Type': 'application/json' }, body: '[1,2]' })).status, 400);
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

test('server: falls back to the next port when the preferred one cannot be bound (Windows reserve / in use)', async () => {
  // Hold a port, as another program (or a Windows reservation) would.
  const blocker = http.createServer();
  await new Promise(r => blocker.listen(0, '127.0.0.1', r));
  const taken = blocker.address().port;
  const host = { apiToken: TOK, userPetsDir: os.tmpdir(), getState: () => ({ ok: true }), ingest: () => ({ accepted: true, item: { id: 'n', emotion: 'happy', matchedBy: 'default' } }), webhookEnabled: () => true, getWebhookSecret: () => null, onEvent: () => {}, adapters: {} };
  const server = await startNotificationServer({ ...host, ports: [taken, 0] });
  try {
    assert.notStrictEqual(server.port, taken);
    assert.ok(server.port > 0);
    assert.deepStrictEqual(server.tried, [{ port: taken, code: 'EADDRINUSE' }]);
    // Host check and launch links follow the port actually bound.
    assert.strictEqual((await req(server.port, { path: '/health' })).status, 200);
    assert.strictEqual((await req(server.port, { path: '/health', headers: { Host: `127.0.0.1:${taken}` } })).status, 421);
    assert.ok(server.launchUrl().startsWith(`http://127.0.0.1:${server.port}/?launch=`));
  } finally { server.close(); }
  // Nothing left to try → the bind error is reported, with what was tried.
  await assert.rejects(startNotificationServer({ ...host, ports: [taken] }), (e) => e.code === 'EADDRINUSE' && e.tried.length === 1);
  blocker.close();
});
