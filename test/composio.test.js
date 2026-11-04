const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SettingsStore } = require('../src/core/settings-store');
const { ComposioProvider } = require('../src/integrations/composio-provider');

class MemSecrets {
  constructor() { this.m = {}; }
  set(k, v) { if (!v) delete this.m[k]; else this.m[k] = v; return true; }
  get(k) { return this.m[k] || null; }
  has(k) { return !!this.m[k]; }
}

function setup(routes) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-composio-'));
  const settings = new SettingsStore(dir);
  const secrets = new MemSecrets();
  const calls = [];
  const opened = [];
  const fetch = async (url, init) => {
    const u = new URL(url);
    calls.push({ method: init.method, path: u.pathname, query: Object.fromEntries(u.searchParams), body: init.body ? JSON.parse(init.body) : undefined, key: init.headers['x-api-key'] });
    const h = routes[`${init.method} ${u.pathname}`];
    const [status, json] = h ? h(u, init) : [404, { error: { message: 'nope' } }];
    return { ok: status < 300, status, text: async () => JSON.stringify(json) };
  };
  const p = new ComposioProvider({ settings, secrets, fetch, openExternal: (x) => opened.push(x) });
  return { p, settings, secrets, calls, opened };
}

test('Composio: invalid key is rejected and not kept', async () => {
  const { p, secrets } = setup({ 'GET /api/v3.1/toolkits': () => [401, { error: { message: 'Invalid API key' } }] });
  await assert.rejects(p.setKey('ak_bad_key_123456'), /từ chối khóa: Invalid API key/);
  await assert.rejects(p.setKey('uak_user_key_123456'), /khóa dự án/);
  assert.strictEqual(secrets.has('composio.apiKey'), false);
});

test('Composio: catalog → connect → refresh → trigger on/off → remove', async () => {
  const { p, settings, calls, opened } = setup({
    'GET /api/v3.1/toolkits': () => [200, { items: [{ slug: 'gmail', name: 'Gmail', meta: { logo: 'https://logos.composio.dev/gmail.png', description: 'Email', categories: [{ name: 'email' }] } }, { slug: 'notion', name: 'Notion', meta: { logo: 'javascript:alert(1)' } }] }],
    'POST /api/v3.1/tool_router/session': () => [200, { session_id: 'trs_1' }],
    'POST /api/v3.1/tool_router/session/trs_1/link': () => [200, { redirect_url: 'https://connect.composio.dev/link/abc' }],
    'GET /api/v3.1/connected_accounts': () => [200, { items: [{ id: 'ca_1', status: 'ACTIVE', toolkit: { slug: 'gmail' } }] }],
    'GET /api/v3.1/trigger_instances/active': () => [200, { items: [] }],
    'GET /api/v3.1/triggers_types': () => [200, { items: [{ slug: 'GMAIL_NEW_GMAIL_MESSAGE', name: 'New Gmail Message', type: 'poll' }] }],
    'POST /api/v3.1/trigger_instances/GMAIL_NEW_GMAIL_MESSAGE/upsert': () => [200, { trigger_id: 'ti_9' }],
    'DELETE /api/v3.1/trigger_instances/manage/ti_9': () => [200, {}],
    'DELETE /api/v3.1/connected_accounts/ca_1': () => [200, {}]
  });
  await p.setKey('ak_good_key_123456');
  const items = await p.catalog({ q: 'mail' });
  assert.deepStrictEqual(items.map(i => i.toolkit), ['gmail', 'notion']);
  assert.strictEqual(items[1].logo, '', 'non-https logos are dropped');
  assert.strictEqual(calls.find(c => c.path === '/api/v3.1/toolkits' && c.query.search).query.search, 'mail');
  assert.ok(calls.every(c => c.key === 'ak_good_key_123456'));

  const r = await p.connect({ toolkit: 'gmail', name: 'Gmail' });
  assert.strictEqual(r.opened, true);
  assert.deepStrictEqual(opened, ['https://connect.composio.dev/link/abc']);
  const uid = settings.get().integrations.composioUserId;
  assert.match(uid, /^cpc-[0-9a-f]{16}$/, 'anonymous user id, never the email');
  assert.strictEqual(calls.find(c => c.path === '/api/v3.1/tool_router/session').body.user_id, uid);
  assert.strictEqual(p.apps()[0].status, 'pending');

  await p.refresh();
  assert.strictEqual(p.apps()[0].status, 'active');
  assert.strictEqual(p.apps()[0].connectedAccountId, 'ca_1');

  const types = await p.triggerTypes('gmail');
  assert.strictEqual(types[0].slug, 'GMAIL_NEW_GMAIL_MESSAGE');
  await p.setTrigger({ toolkit: 'gmail', slug: 'GMAIL_NEW_GMAIL_MESSAGE', enabled: true });
  const up = calls.find(c => c.path.endsWith('/upsert'));
  assert.deepStrictEqual(up.body, { user_id: uid, trigger_config: {}, connected_account_id: 'ca_1' });
  assert.deepStrictEqual(p.apps()[0].triggers.map(t => t.instanceId), ['ti_9']);
  await p.setTrigger({ toolkit: 'gmail', slug: 'GMAIL_NEW_GMAIL_MESSAGE', enabled: false });
  assert.strictEqual(p.apps()[0].triggers.length, 0);

  await p.remove('gmail');
  assert.ok(calls.some(c => c.method === 'DELETE' && c.path === '/api/v3.1/connected_accounts/ca_1'));
  assert.strictEqual(p.apps().length, 0);
});

test('Composio: enabling events before sign-in is refused', async () => {
  const { p } = setup({
    'GET /api/v3.1/toolkits': () => [200, { items: [] }],
    'POST /api/v3.1/tool_router/session': () => [200, { session_id: 's' }],
    'POST /api/v3.1/tool_router/session/s/link': () => [200, { redirect_url: 'https://x.example/y' }]
  });
  await p.setKey('ak_good_key_123456');
  await p.connect({ toolkit: 'slack' });
  await assert.rejects(p.setTrigger({ toolkit: 'slack', slug: 'SLACK_RECEIVE_MESSAGE', enabled: true }), /đăng nhập/);
});
