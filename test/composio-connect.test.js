const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SettingsStore } = require('../src/core/settings-store');
const { IntegrationsManager } = require('../src/integrations');

class MemSecrets { constructor() { this.m = {}; } set(k, v) { if (!v) delete this.m[k]; else this.m[k] = v; return true; } get(k) { return this.m[k] || null; } has(k) { return !!this.m[k]; } }

// Fake Composio Connect MCP server (SSE-framed replies, like the real one).
function fakeMcp(state) {
  const sse = (result) => ({ ok: true, status: 200, text: async () => `: connected\n\nevent: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\n` });
  const toolText = (obj) => sse({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  return async (url, init) => {
    assert.strictEqual(url, 'https://connect.composio.dev/mcp');
    if (init.headers['x-consumer-api-key'] !== 'ck_valid_key_123') return { ok: false, status: 401, text: async () => 'unauthorized' };
    const body = JSON.parse(init.body);
    state.calls.push(body);
    if (body.method === 'tools/list') return sse({ tools: [{ name: 'COMPOSIO_MANAGE_CONNECTIONS' }, { name: 'COMPOSIO_MULTI_EXECUTE_TOOL' }] });
    const { name, arguments: a } = body.params;
    if (name === 'COMPOSIO_MANAGE_CONNECTIONS') {
      const t = a.toolkits[0];
      if (t.action === 'add') return toolText({ successful: true, data: { results: { [t.name]: { status: 'initiated', redirect_url: 'https://connect.composio.dev/link/x', accounts: [{ id: 'acc1', status: 'initiated' }] } } } });
      if (t.action === 'list') return toolText({ successful: true, data: { results: Object.fromEntries(a.toolkits.map(k => [k.name, { accounts: [{ id: 'acc1', status: state.active ? 'ACTIVE' : 'initializing' }] }])) } });
      return toolText({ successful: true, data: {} });
    }
    if (name === 'COMPOSIO_MULTI_EXECUTE_TOOL') {
      assert.strictEqual(a.tools[0].tool_slug, 'GMAIL_FETCH_EMAILS');
      return toolText({ successful: true, data: { results: [{ index: 0, tool_slug: 'GMAIL_FETCH_EMAILS', response: { successful: true, data: { messages: state.mail } } }] } });
    }
    if (name === 'COMPOSIO_SEARCH_TOOLS') return toolText({ successful: true, data: { toolkit_connection_statuses: [{ toolkit: 'notion', description: 'Notes' }] } });
    throw new Error(`unexpected ${name}`);
  };
}

test('Composio Connect (ck_ key): connect → active → poll only NEW mail as near-realtime', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-ck-'));
  const settings = new SettingsStore(dir);
  const state = { calls: [], active: false, mail: [{ messageId: 'm1', subject: 'Old', sender: 'a@x', threadId: 't1' }] };
  const opened = [];
  const ig = new IntegrationsManager({ settings, secrets: new MemSecrets(), fetch: fakeMcp(state), openExternal: (u) => opened.push(u), pollSeconds: () => 120 });
  const got = [];
  ig.on('notification', (n) => got.push(n));

  await assert.rejects(ig.setKey('ck_wrong_key_123'), /từ chối/);
  const st = await ig.setKey('ck_valid_key_123');
  ig.stop();
  assert.strictEqual(st.mode, 'connect');

  assert.deepStrictEqual((await ig.catalog({ q: 'notion' })).map(x => x.toolkit), ['notion']);
  assert.ok((await ig.catalog({})).some(x => x.toolkit === 'gmail' && x.hasEvents));

  await ig.connect({ toolkit: 'gmail' });
  assert.deepStrictEqual(opened, ['https://connect.composio.dev/link/x']);
  assert.strictEqual(ig.status().apps[0].status, 'pending');
  assert.strictEqual(await ig.connect_.pollOnce(), 0, 'nothing polled before sign-in');

  state.active = true;
  assert.strictEqual(await ig.connect_.pollOnce(), 0, 'first poll is a baseline');
  assert.strictEqual(ig.status().apps[0].status, 'active');
  state.mail.unshift({ messageId: 'm2', subject: 'New one', sender: 'b@x', threadId: 't2' });
  assert.strictEqual(await ig.connect_.pollOnce(), 1);
  assert.strictEqual(got[0].title, 'New one');
  assert.strictEqual(got[0].app, 'gmail');
  assert.match(got[0].url, /^https:\/\/mail\.google\.com\//);
  assert.strictEqual(await ig.connect_.pollOnce(), 0, 'no duplicates');

  await ig.setTrigger({ toolkit: 'gmail', enabled: false });
  state.mail.unshift({ messageId: 'm3', subject: 'Muted', threadId: 't3' });
  assert.strictEqual(await ig.connect_.pollOnce(), 0, 'events off → not polled');
  await ig.remove('gmail');
  assert.strictEqual(ig.status().apps.length, 0);
});
