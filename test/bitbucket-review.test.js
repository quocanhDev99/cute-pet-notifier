const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { SettingsStore } = require('../src/core/settings-store');
const { IntegrationsManager } = require('../src/integrations');

class MemSecrets { constructor() { this.m = {}; } set(k, v) { if (!v) delete this.m[k]; else this.m[k] = v; return true; } get(k) { return this.m[k] || null; } has(k) { return !!this.m[k]; } }
const ME = '{me-uuid}';

function fakeMcp(state) {
  const sse = (result) => ({ ok: true, status: 200, text: async () => `event: message\ndata: ${JSON.stringify({ jsonrpc: '2.0', id: 1, result })}\n\n` });
  const tool = (obj) => sse({ content: [{ type: 'text', text: JSON.stringify(obj) }] });
  const proxyOk = (data, status = 200) => tool({ successful: true, data: { status, data } });
  return async (url, init) => {
    const body = JSON.parse(init.body);
    if (body.method === 'tools/list') return sse({ tools: [{ name: 'COMPOSIO_MANAGE_CONNECTIONS' }] });
    const { name, arguments: a } = body.params;
    if (name === 'COMPOSIO_MANAGE_CONNECTIONS') return tool({ successful: true, data: { results: { bitbucket: { accounts: [{ id: 'bb1', status: 'active' }] } } } });
    if (name !== 'COMPOSIO_PROXY_EXECUTE') throw new Error(name);
    state.calls.push(`${a.method} ${a.endpoint}`);
    if (a.endpoint === '/user') return proxyOk({ uuid: ME });
    if (a.endpoint === '/user/workspaces') return proxyOk({ values: [{ workspace: { slug: 'acme' } }] });
    if (a.endpoint === '/repositories/acme') return proxyOk({ values: [{ slug: 'web' }, { slug: 'api' }] });
    const m = a.endpoint.match(/^\/repositories\/acme\/(web|api)\/pullrequests$/);
    if (m) {
      const q = a.parameters.find(p => p.name === 'q').value;
      assert.ok(q.includes(`reviewers.uuid="${ME}"`) && q.includes('state="OPEN"'));
      return proxyOk({ values: state.prs.filter(p => p.repo === m[1]) });
    }
    const ap = a.endpoint.match(/^\/repositories\/acme\/(web|api)\/pullrequests\/(\d+)\/approve$/);
    if (ap && a.method === 'POST') { state.approved.push(`${ap[1]}#${ap[2]}`); return proxyOk({ approved: true }); }
    return proxyOk({ error: { message: 'nope' } }, 404);
  };
}

test('Bitbucket: summary first, then one card per new review request, approve via main-side target', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-bb-'));
  const settings = new SettingsStore(dir);
  const state = { calls: [], approved: [], prs: [
    { repo: 'web', id: 1, title: 'Fix login', author: { display_name: 'Ban A' }, links: { html: { href: 'https://bitbucket.org/acme/web/pull-requests/1' } }, participants: [] },
    { repo: 'api', id: 7, title: 'Add cache', author: { display_name: 'Ban B' }, participants: [] },
    { repo: 'api', id: 8, title: 'Already approved', participants: [{ user: { uuid: ME }, approved: true }] }
  ] };
  const ig = new IntegrationsManager({ settings, secrets: new MemSecrets(), fetch: fakeMcp(state), pollSeconds: () => 120 });
  const got = [];
  ig.on('notification', (n) => got.push(n));
  await ig.setKey('ck_valid_key_123'); ig.stop();
  settings.update({ integrations: { apps: [{ provider: 'composio', toolkit: 'bitbucket', name: 'Bitbucket', status: 'active', connectedAccountId: 'bb1', triggers: [{ slug: 'BITBUCKET' }] }] } });

  assert.strictEqual(await ig.connect_.pollOnce(), 2);
  assert.strictEqual(got.length, 1, 'first poll → one card listing the PRs');
  assert.match(got[0].title, /2 PR/);
  assert.deepStrictEqual(got[0].items.map(r => [r.title, r.subtitle, r.actions]), [['Fix login', 'web #1 · Ban A', ['approve']], ['Add cache', 'api #7 · Ban B', ['approve']]]);
  assert.deepStrictEqual(await ig.approvePullRequest(got[0].items[1].key), { ok: true }, 'approve a row of the list card');

  state.prs.push({ repo: 'web', id: 9, title: 'New feature', author: { display_name: 'Ban C' }, links: { html: { href: 'https://bitbucket.org/acme/web/pull-requests/9' } }, participants: [] });
  assert.strictEqual(await ig.connect_.pollOnce(), 1);
  const card = got[1];
  assert.match(card.title, /New feature/);
  assert.deepStrictEqual(card.actions, ['approve']);
  assert.strictEqual(card.priority, 'important');
  assert.strictEqual(await ig.connect_.pollOnce(), 0, 'no duplicates');

  assert.deepStrictEqual(await ig.approvePullRequest(card.sourceEventId), { ok: true });
  assert.deepStrictEqual(state.approved, ['api#7', 'web#9']);
  assert.strictEqual((await ig.approvePullRequest('composio:bitbucket:forged')).ok, false, 'unknown ids are refused');
});
