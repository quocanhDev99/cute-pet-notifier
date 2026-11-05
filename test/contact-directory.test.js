const test = require('node:test');
const assert = require('node:assert');
const { ContactDirectory, conversationOf } = require('../src/core/contact-directory');

const mk = (settings = {}) => new ContactDirectory(null, { getSettings: () => ({ privacy: { displayMode: 'full_content', hiddenApps: [], ...settings } }) });

test('learns 1-1 chats, group chats and their members — names only', () => {
  const d = mk();
  d.learn({ app: 'zalo', title: 'Mai Phạm', message: 'tối nay ăn gì' });
  d.learn({ app: 'zalo', title: 'Nhóm Dự Án', message: 'Bạn A: ok nhé' });
  d.learn({ app: 'zalo', title: 'Nhóm Dự Án', message: 'Sếp Lan: họp lúc 3h' });
  d.learn({ app: 'zalo', title: 'Nhom Du An', message: 'Bạn A: rồi' });
  const [zalo] = d.list().apps;
  assert.strictEqual(zalo.app, 'zalo');
  const mai = zalo.chats.find(c => c.title === 'Mai Phạm');
  const grp = zalo.chats.find(c => c.title === 'Nhóm Dự Án');
  assert.strictEqual(mai.direct, true);
  assert.strictEqual(grp.direct, false);
  assert.strictEqual(grp.count, 3, 'accent-insensitive conversation key');
  assert.deepStrictEqual(grp.members.map(m => [m.name, m.count]), [['Bạn A', 2], ['Sếp Lan', 1]]);
  assert.strictEqual(grp.week, 3);
  assert.ok(!JSON.stringify(d.chats).includes('họp lúc'), 'never stores message text');
});

test('does not learn when hidden by privacy, disabled, or not a chat', () => {
  assert.strictEqual(mk({ hiddenApps: ['zalo'] }).learn({ app: 'zalo', title: 'Mai', message: 'hi' }), false);
  assert.strictEqual(mk({ displayMode: 'masked' }).learn({ app: 'zalo', title: 'Mai', message: 'hi' }), false);
  assert.strictEqual(mk({ learnContacts: false }).learn({ app: 'zalo', title: 'Mai', message: 'hi' }), false);
  assert.strictEqual(mk().learn({ app: 'github', title: 'PR merged', message: 'x' }), false);
  assert.strictEqual(mk().learn({ app: 'zalo', title: 'Thông báo mới', message: 'x' }), false);
});

test('macOS "Group — Sender" titles split into chat + member', () => {
  assert.deepStrictEqual(conversationOf({ app: 'messages', title: 'Gia đình — Bố', message: 'về ăn cơm' }), { chat: 'Gia đình', direct: false, sender: 'Bố' });
});

test('chat sources: Teams via Microsoft Graph (names only), honest states when unavailable', async () => {
  const { ChatSources } = require('../src/integrations/chat-sources');
  const calls = [];
  const connect_ = {
    async proxy(tk, url, { query = {}, method = 'GET', body } = {}) {
      calls.push([url, query, method]);
      if (url.endsWith('/me')) return { status: 200, data: { id: 'me', displayName: 'Tôi' } };
      if (url.endsWith('/$batch')) {
        return { status: 200, data: { responses: body.requests.map(q => ({ id: q.id, status: 200, body: { value: q.url.includes('c1') ? [{ userId: 'me', displayName: 'Tôi' }, { userId: 'u1', displayName: 'Mai Phạm' }] : [] } })) } };
      }
      if (/\/chats\/c2\/members$/.test(url)) return { status: 200, data: { value: [{ userId: 'me', displayName: 'Tôi' }, { userId: 'u2', displayName: 'Minh' }, { userId: 'u3', displayName: 'Lan' }] } };
      if (url.endsWith('/me/chats') && !query.$skiptoken) {
        return { status: 200, data: { value: [
          { id: 'c1', chatType: 'oneOnOne', topic: null, lastUpdatedDateTime: '2026-11-05T09:00:00Z' },
          { id: 'c2', chatType: 'group', topic: 'Eo Gi Bi Ti', lastUpdatedDateTime: '2026-11-05T10:00:00Z' }
        ], '@odata.nextLink': 'https://graph.microsoft.com/v1.0/me/chats?$top=50&$skiptoken=abc' } };
      }
      if (url.endsWith('/me/chats') && query.$skiptoken === 'abc') return { status: 200, data: { value: [{ id: 'c3', chatType: 'meeting', topic: 'Daily', lastUpdatedDateTime: '2026-11-01T10:00:00Z' }] } };
      return { status: 404, data: {} };
    }
  };
  let apps = [{ provider: 'composio', toolkit: 'microsoft_teams', status: 'active' }];
  const integrations = { connect_, get active() { return connect_; } };
  const src = new ChatSources({ integrations, secrets: { get: () => null }, settings: { get: () => ({ integrations: { apps } }) } });
  const r = await src.chats('teams');
  assert.strictEqual(r.state, 'ready');
  assert.deepStrictEqual(r.chats.map(c => [c.title, c.direct, !!c.meeting]), [['Eo Gi Bi Ti', false, false], ['Mai Phạm', true, false], ['Daily', false, true]]);
  assert.ok(calls.every(([u, q]) => !JSON.stringify(q).includes('lastMessagePreview') && !/messages/.test(u)), 'never asks for messages or previews');
  const m = await src.members('teams', 'c2');
  assert.deepStrictEqual(m.members.map(x => x.name), ['Minh', 'Lan'], 'members load on demand; yourself is not listed');
  assert.strictEqual(src.list().find(s => s.id === 'slack').state, 'not_connected');
  apps = [];
  assert.strictEqual((await src.chats('teams', { refresh: true })).state, 'not_connected');
});

test('chat sources: Graph 403 → permission state with a clear message', async () => {
  const { ChatSources } = require('../src/integrations/chat-sources');
  const connect_ = { async proxy(tk, url) { return url.endsWith('/me') ? { status: 200, data: { id: 'me' } } : { status: 403, data: {} }; } };
  const src = new ChatSources({ integrations: { connect_, active: connect_ }, secrets: { get: () => null }, settings: { get: () => ({ integrations: { apps: [{ provider: 'composio', toolkit: 'microsoft_teams', status: 'active' }] } }) } });
  const r = await src.chats('teams');
  assert.strictEqual(r.state, 'permission');
  assert.match(r.detail, /chưa cho xem danh sách chat/);
});

test('activity titles ("X @mentioned you") are not chats: chat = body prefix, X = member; old data is migrated', () => {
  const d = mk();
  d.learn({ app: 'teams', title: 'Nhuc Nguyen @mentioned you', message: 'Eo Gi Bi Ti: xem giúp PR nhé' });
  d.learn({ app: 'teams', title: '😆 Tuyen Bui reacted to your message', message: 'Eo Gi Bi Ti: 👍' });
  d.learn({ app: 'teams', title: 'Phuong Dong forwarded a message', message: 'hello' });
  const titles = d.list().apps[0].chats.map(c => [c.title, c.direct, c.members.map(m => m.name)]);
  assert.deepStrictEqual(titles.sort(), [['Eo Gi Bi Ti', false, ['Nhuc Nguyen', 'Tuyen Bui']], ['Phuong Dong', true, []]].sort());
  const fs = require('fs'); const os = require('os'); const path = require('path');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-'));
  fs.writeFileSync(path.join(dir, 'contact-directory.json'), JSON.stringify([
    { app: 'teams', title: 'Nhuc Nguyen @mentioned you', direct: false, count: 2, important: 0, lastSeen: 5, days: { '2026-11-05': 2 }, members: [{ name: 'Eo Gi Bi Ti', count: 2, lastSeen: 5, days: { '2026-11-05': 2 } }] },
    { app: 'teams', title: 'Eo Gi Bi Ti', direct: false, count: 1, important: 0, lastSeen: 3, days: { '2026-11-05': 1 }, members: [{ name: 'Dieu', count: 1, lastSeen: 3, days: {} }] }
  ]));
  const m = new ContactDirectory(dir, { getSettings: () => ({ privacy: {} }) });
  assert.deepStrictEqual(m.chats.map(c => [c.title, c.count, c.members.map(x => x.name).sort()]), [['Eo Gi Bi Ti', 3, ['Dieu', 'Nhuc Nguyen']]]);
});

test('a group-chat rule also matches activity notifications from that chat', () => {
  const { contactOf } = require('../src/core/chat-filter');
  const c = contactOf({ app: 'teams', title: 'Nhuc Nguyen @mentioned you', message: 'Eo Gi Bi Ti: xem PR' }, [{ name: 'Eo Gi Bi Ti', kind: 'chat', group: 'colleagues', app: 'teams' }]);
  assert.strictEqual(c && c.name, 'Eo Gi Bi Ti');
  const p = contactOf({ app: 'teams', title: 'Nhuc Nguyen @mentioned you', message: 'Eo Gi Bi Ti: xem PR' }, [{ name: 'Nhuc Nguyen', group: 'manager' }]);
  assert.strictEqual(p && p.name, 'Nhuc Nguyen');
});
