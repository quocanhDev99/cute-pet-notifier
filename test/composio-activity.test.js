const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { ComposioConnectProvider } = require('../src/integrations/composio-connect-provider');

const ctx = (dataDir) => ({ dataDir, settings: { get: () => ({ integrations: { apps: [] } }) }, secrets: { get: () => null, has: () => false } });

test('Bitbucket: approvals / change requests / comments by others on MY PRs become cards; my own are ignored', async () => {
  const p = new ComposioConnectProvider(ctx(null));
  p.bb = { me: '{me}', repos: [{ ws: 'acme', slug: 'web' }], reposAt: Date.now(), workspaces: ['acme'] };
  let state = { c: 1, approved: false, cr: false, lastBy: '{me}' };
  p.proxy = async (tk, url) => {
    if (url.startsWith('/workspaces/acme/pullrequests/')) {
      return { status: 200, data: { values: [{ id: 7, title: 'Fix login', comment_count: state.c, links: { html: { href: 'https://bitbucket.org/acme/web/pull-requests/7' } },
        destination: { repository: { full_name: 'acme/web' } },
        participants: [{ user: { uuid: '{me}', display_name: 'Tôi' } }, { user: { uuid: '{lan}', display_name: 'Lan' }, approved: state.approved, state: state.cr ? 'changes_requested' : null }] }] } };
    }
    if (url.endsWith('/comments')) return { status: 200, data: { values: [{ user: { uuid: state.lastBy, display_name: state.lastBy === '{me}' ? 'Tôi' : 'Lan' }, content: { raw: 'nhớ thêm test nhé' } }] } };
    return { status: 404 };
  };
  const cards = [];
  p.on('notification', (n) => cards.push(n.meta.event));
  assert.strictEqual(await p.pollBitbucketMine(), 0, 'first run = baseline');
  state = { ...state, c: 2, lastBy: '{me}' };
  assert.strictEqual(await p.pollBitbucketMine(), 0, 'my own comment → nothing');
  state = { ...state, c: 3, approved: true, lastBy: '{lan}' };
  await p.pollBitbucketMine();
  assert.deepStrictEqual(cards, ['✅ Lan đã approve PR của bạn', '💬 Lan bình luận PR của bạn']);
});

test('Jira: a new comment by someone else (mention → important) becomes a card; seen state survives a restart', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-'));
  const mk = () => {
    const p = new ComposioConnectProvider(ctx(dir));
    p.jiraBase = async () => ({ base: 'https://api.atlassian.com/ex/jira/x', me: 'acc-me' });
    p.jiraSiteUrl = async () => 'https://acme.atlassian.net';
    return p;
  };
  let updated = '2026-11-05T09:00:00.000+0700';
  let comments = [];
  const proxy = async (tk, url) => {
    if (/search/.test(url)) return { status: 200, data: { issues: [{ key: 'WB-12', fields: { summary: 'Login lỗi', updated, assignee: { accountId: 'acc-other' } } }] } };
    if (/comment$/.test(url)) return { status: 200, data: { comments } };
    return { status: 200, data: { values: [] } };
  };
  const a = mk(); a.proxy = proxy;
  await a.pollJiraActivity(); a.saveState(); // baseline
  const b = mk(); b.proxy = proxy; // "restart"
  const cards = [];
  b.on('notification', (n) => cards.push(n));
  updated = '2026-11-05T10:00:00.000+0700';
  comments = [{ id: '9', created: '2026-11-05T09:59:00.000+0700', author: { accountId: 'acc-lan', displayName: 'Lan' },
    body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'mention', attrs: { id: 'acc-me', text: '@Anh' } }, { type: 'text', text: ' xem giúp nhé' }] }] } }];
  assert.strictEqual(await b.pollJiraActivity(), 1, 'not swallowed by a re-baseline after restart');
  assert.strictEqual(cards[0].meta.event, '📣 Lan nhắc bạn');
  assert.strictEqual(cards[0].title, 'WB-12 Login lỗi');
  assert.strictEqual(cards[0].priority, 'important');
  assert.match(cards[0].message, /@Anh xem giúp nhé/);
  assert.strictEqual(cards[0].url, 'https://acme.atlassian.net/browse/WB-12');
});
