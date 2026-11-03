const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { createGateway } = require('../gateway/server');
const { GatewayAdapter, parseSse, validGatewayUrl } = require('../src/adapters/gateway-adapter');

const TOKEN = 'desk_' + 'x'.repeat(30);
const COMPOSIO = 'whsec_test_composio';
const SLACK = 'slack_signing_test';

async function startGw(extra = {}) {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-gw-'));
  const gw = createGateway({ desktopToken: TOKEN, composioSecret: COMPOSIO, slackSecret: SLACK, dataDir, log: () => {}, ...extra });
  const port = await gw.listen(0, '127.0.0.1');
  return { gw, port, dataDir, base: `http://127.0.0.1:${port}` };
}

function composioSigned(body, { id = 'msg_' + crypto.randomBytes(4).toString('hex'), ts = Math.floor(Date.now() / 1000), secret = COMPOSIO } = {}) {
  const raw = JSON.stringify(body);
  const sig = crypto.createHmac('sha256', secret).update(`${id}.${ts}.${raw}`).digest('base64');
  return { raw, headers: { 'content-type': 'application/json', 'webhook-id': id, 'webhook-timestamp': String(ts), 'webhook-signature': `v1,${sig}` } };
}

const v3 = (slug, data) => ({ id: 'msg_' + crypto.randomBytes(3).toString('hex'), type: 'composio.trigger.message', metadata: { trigger_slug: slug, trigger_id: 'ti_1', connected_account_id: 'ca_1' }, data, timestamp: new Date().toISOString() });

test('Composio: valid signature accepted, invalid / replayed / old rejected, duplicates idempotent', async () => {
  const { gw, base } = await startGw();
  try {
    const body = v3('SLACK_RECEIVE_MESSAGE', { text: 'hello team', user_name: 'An', ts: String(Date.now() / 1000) });
    const ok = composioSigned(body, { id: 'msg_fixed' });
    let r = await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: ok.headers, body: ok.raw });
    assert.strictEqual(r.status, 200);
    assert.strictEqual((await r.json()).seq, 1);
    // same webhook-id again (provider retry) → duplicate, no new seq
    r = await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: ok.headers, body: ok.raw });
    assert.strictEqual((await r.json()).duplicate, true);
    // tampered body
    r = await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: ok.headers, body: ok.raw.replace('hello', 'HELLO') });
    assert.strictEqual(r.status, 401);
    // wrong secret
    const bad = composioSigned(body, { secret: 'nope' });
    assert.strictEqual((await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: bad.headers, body: bad.raw })).status, 401);
    // timestamp outside tolerance (replay)
    const old = composioSigned(body, { ts: Math.floor(Date.now() / 1000) - 3600 });
    const ro = await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: old.headers, body: old.raw });
    assert.strictEqual(ro.status, 401);
    assert.strictEqual((await ro.json()).error, 'timestamp_out_of_tolerance');
    assert.strictEqual(gw.stats().seq, 1);
  } finally { await gw.close(); }
});

test('SSE: auth required, replay since Last-Event-ID, live push', async () => {
  const { gw, base } = await startGw();
  try {
    for (const slug of ['GMAIL_NEW_GMAIL_MESSAGE', 'SLACK_RECEIVE_MESSAGE', 'TRELLO_NEW_CARD']) {
      const s = composioSigned(v3(slug, { subject: `Subject ${slug}`, sender: 'boss@corp.vn' }));
      await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: s.headers, body: s.raw });
    }
    assert.strictEqual((await fetch(`${base}/events`)).status, 401);
    const ctl = new AbortController();
    const res = await fetch(`${base}/events`, { headers: { Authorization: `Bearer ${TOKEN}`, 'Last-Event-ID': '1' }, signal: ctl.signal });
    const got = [];
    const reader = res.body.getReader();
    let buf = '';
    const dec = new TextDecoder();
    while (got.length < 2) {
      const { value } = await reader.read();
      buf = parseSse(buf + dec.decode(value, { stream: true }), (ev) => { if (ev.event === 'notification') got.push({ id: ev.id, data: JSON.parse(ev.data) }); });
    }
    assert.deepStrictEqual(got.map(g => g.id), ['2', '3']); // event 1 not replayed
    assert.strictEqual(got[0].data.deliveryMode, 'realtime_push'); // SLACK_
    assert.strictEqual(got[1].data.deliveryMode, 'near_realtime_poll'); // unknown → conservative
    ctl.abort();
  } finally { await gw.close(); }
});

test('Slack Events API: url_verification + signature', async () => {
  const { gw, base } = await startGw();
  try {
    const sign = (raw, ts = Math.floor(Date.now() / 1000)) => ({ 'x-slack-request-timestamp': String(ts), 'x-slack-signature': 'v0=' + crypto.createHmac('sha256', SLACK).update(`v0:${ts}:${raw}`).digest('hex'), 'content-type': 'application/json' });
    const ch = JSON.stringify({ type: 'url_verification', challenge: 'abc123' });
    const r = await fetch(`${base}/webhooks/slack`, { method: 'POST', headers: sign(ch), body: ch });
    assert.strictEqual((await r.json()).challenge, 'abc123');
    const ev = JSON.stringify({ type: 'event_callback', event_id: 'Ev1', team_id: 'T1', event_time: Math.floor(Date.now() / 1000), event: { type: 'message', channel_type: 'im', channel: 'D1', ts: String(Date.now() / 1000), text: 'ping' } });
    const r2 = await fetch(`${base}/webhooks/slack`, { method: 'POST', headers: sign(ev), body: ev });
    assert.strictEqual((await r2.json()).seq, 1);
    const r3 = await fetch(`${base}/webhooks/slack`, { method: 'POST', headers: { ...sign(ev), 'x-slack-signature': 'v0=bad' }, body: ev });
    assert.strictEqual(r3.status, 401);
  } finally { await gw.close(); }
});

test('Durable queue survives a gateway restart (resume after crash)', async () => {
  const a = await startGw();
  const s = composioSigned(v3('NOTION_PAGE_UPDATED', { title: 'Spec v2' }), { id: 'msg_persist' });
  await fetch(`${a.base}/webhooks/composio`, { method: 'POST', headers: s.headers, body: s.raw });
  await a.gw.close();
  const b = createGateway({ desktopToken: TOKEN, composioSecret: COMPOSIO, dataDir: a.dataDir, log: () => {} });
  const port = await b.listen(0, '127.0.0.1');
  try {
    assert.strictEqual(b.stats().seq, 1);
    const r = await fetch(`http://127.0.0.1:${port}/webhooks/composio`, { method: 'POST', headers: s.headers, body: s.raw });
    assert.strictEqual((await r.json()).duplicate, true); // idempotency persisted
  } finally { await b.close(); }
});

test('Desktop GatewayAdapter end-to-end: webhook → gateway → SSE → adapter publish, cursor persisted', async () => {
  const { gw, base } = await startGw();
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-desk-'));
  const secrets = { get: (k) => (k === 'gateway.token' ? TOKEN : null), has: () => true };
  const settings = { get: () => ({ adapters: { gateway: { enabled: true, url: base } } }) };
  const adapter = new GatewayAdapter({ settings, secrets, log: () => {}, dataDir });
  const received = [];
  adapter.subscribeNotifications((p, source, meta) => received.push({ p, source, meta }));
  try {
    assert.strictEqual(await adapter.connect(), true);
    const t0 = Date.now();
    const s = composioSigned(v3('SLACK_RECEIVE_MESSAGE', { text: 'deploy xong rồi', user_name: 'Linh', ts: String(t0 / 1000) }));
    await fetch(`${base}/webhooks/composio`, { method: 'POST', headers: s.headers, body: s.raw });
    for (let i = 0; i < 50 && !received.length; i++) await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(received.length, 1);
    const ev = received[0].p;
    assert.strictEqual(ev.provider, 'composio');
    assert.strictEqual(ev.sourceApplication, 'slack');
    assert.strictEqual(ev.deliveryMode, 'realtime_push');
    assert.ok(ev.gatewayReceivedAt >= t0);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dataDir, 'gateway-cursor.json'), 'utf8')).lastSeq, 1);
  } finally { await adapter.disconnect(); await gw.close(); }
});

test('Gateway URL policy: https only (http only for localhost dev)', () => {
  assert.ok(validGatewayUrl('https://gw.example.com'));
  assert.ok(validGatewayUrl('http://127.0.0.1:8787'));
  assert.strictEqual(validGatewayUrl('http://gw.example.com'), null);
  assert.strictEqual(validGatewayUrl('ftp://x'), null);
});
