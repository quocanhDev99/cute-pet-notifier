const test = require('node:test');
const assert = require('node:assert');
const { contactPolicy } = require('../src/core/contact-rules');
const { ContactDirectory } = require('../src/core/contact-directory');
const { NotificationPipeline } = require('../src/core/notification-pipeline');
const { DEFAULT_SETTINGS, mergeValidated } = require('../src/core/settings-store');

const base = () => JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
const at = (h, m = 0) => { const d = new Date(2026, 10, 5, h, m); return d; };

test('rule priority: person > group chat > relationship', () => {
  const s = base();
  s.contacts = [
    { name: 'Team Dev', kind: 'chat', app: 'teams', group: 'colleagues', attention: 'auto' },
    { name: 'Chị Lan', kind: 'person', app: 'teams', group: 'manager', attention: 'auto' }
  ];
  s.relationships = { colleagues: { quietEnabled: true, quietStart: '18:00', quietEnd: '08:00' } };
  const evening = at(20);
  const boss = contactPolicy({ app: 'teams', title: 'Team Dev', message: 'Chị Lan: gửi chị báo cáo nhé' }, s, { date: evening });
  assert.strictEqual(boss.layer, 'person');
  assert.strictEqual(boss.priority, 'important');
  assert.ok(!boss.inbox, 'the boss is not caught by the colleagues group chat hours');
  const mate = contactPolicy({ app: 'teams', title: 'Team Dev', message: 'Minh: ăn tối chưa' }, s, { date: evening });
  assert.deepStrictEqual([mate.layer, mate.inbox, mate.reason], ['chat', true, 'relationship_hours']);
  const morning = contactPolicy({ app: 'teams', title: 'Team Dev', message: 'Minh: chào cả nhà' }, s, { date: at(10) });
  assert.ok(!morning.inbox, 'inside working hours it shows');
});

test("a person's own behaviour beats the relationship's hours/digest; disabled rules are skipped", () => {
  const s = base();
  s.relationships = { colleagues: { digest: true } };
  s.contacts = [
    { name: 'Minh', group: 'colleagues', attention: 'important' },
    { name: 'Hoa', group: 'colleagues', attention: 'auto' },
    { name: 'Tú', group: 'colleagues', attention: 'auto', enabled: false },
    { name: 'Spam', group: 'friends', attention: 'inbox' }
  ];
  const minh = contactPolicy({ app: 'zalo', title: 'Minh', message: 'hi' }, s);
  assert.deepStrictEqual([minh.priority, !!minh.inbox, minh.afterHours], ['important', false, true]);
  assert.strictEqual(contactPolicy({ app: 'zalo', title: 'Hoa', message: 'hi' }, s).reason, 'relationship_digest');
  assert.strictEqual(contactPolicy({ app: 'zalo', title: 'Tú', message: 'hi' }, s), null);
  assert.strictEqual(contactPolicy({ app: 'zalo', title: 'Spam', message: 'hi' }, s).reason, 'contact_inbox');
});

test('relationship "afterHours" shows during the global quiet hours; others go to the Inbox', () => {
  const s = base();
  s.dnd.quietHoursEnabled = true; s.dnd.quietStart = '00:00'; s.dnd.quietEnd = '23:59';
  s.contacts = [{ name: 'Em yêu', group: 'partner' }, { name: 'Bạn A', group: 'friends' }];
  s.relationships = { partner: { afterHours: true } };
  const p = new NotificationPipeline({ getSettings: () => s, inbox: { add() {} } });
  assert.strictEqual(p.ingest({ app: 'zalo', title: 'Em yêu', message: 'ngủ chưa' }).inboxed, undefined);
  assert.strictEqual(p.ingest({ app: 'zalo', title: 'Bạn A', message: 'ngủ chưa' }).inboxed, true);
});

test('a familiar contact still shows in "only when it is about me" chat mode', () => {
  const s = base();
  s.chat.mode = 'mentions';
  s.contacts = [{ name: 'Chị Lan', group: 'manager', app: 'zalo' }];
  const p = new NotificationPipeline({ getSettings: () => s, inbox: { add() {} } });
  const boss = p.ingest({ app: 'zalo', title: 'Nhóm Dự Án', message: 'Chị Lan: họp lúc 3h' });
  assert.ok(!boss.inboxed);
  assert.strictEqual(boss.item.priority, 'important');
  assert.strictEqual(p.ingest({ app: 'zalo', title: 'Nhóm Dự Án', message: 'Minh: ok' }).reason, 'not_mentioned');
  assert.strictEqual(boss.item.contactPolicy, undefined, 'policy (with names) never leaves the pipeline');
});

test('adaptive memory: an often-important sender gets priority; can be turned off; explicit rules win', () => {
  const s = base();
  let now = at(10).getTime();
  const dir = new ContactDirectory(null, { getSettings: () => s, now: () => now });
  for (let i = 0; i < 6; i++) dir.learn({ app: 'slack', title: 'Ops', message: `Bot Alert: lỗi ${i}` }, now, { important: true });
  const item = { app: 'slack', title: 'Ops', message: 'Bot Alert: lại lỗi' };
  assert.deepStrictEqual([contactPolicy(item, s, { directory: dir }).layer, contactPolicy(item, s, { directory: dir }).priority], ['memory', 'important']);
  assert.ok(dir.insights().some(x => x.name === 'Bot Alert' && x.note === 'important_sender'));
  s.privacy.adaptiveMemory = false;
  assert.strictEqual(contactPolicy(item, s, { directory: dir }), null);
  s.privacy.adaptiveMemory = true;
  s.contacts = [{ name: 'Bot Alert', group: 'friends', attention: 'normal' }];
  assert.strictEqual(contactPolicy(item, s, { directory: dir }).priority, 'normal');
});

test('the memory learns from content priority, not from its own decisions', () => {
  const s = base();
  const dir = new ContactDirectory(null, { getSettings: () => s });
  const p = new NotificationPipeline({ getSettings: () => s, inbox: { add() {} }, directory: dir });
  s.contacts = [{ name: 'Sếp', group: 'manager' }];
  for (let i = 0; i < 6; i++) p.ingest({ app: 'zalo', title: 'Sếp', message: `chào em ${i}` });
  const c = dir.find('zalo', 'Sếp');
  assert.strictEqual(c.count, 6);
  assert.strictEqual(c.important, 0, 'manager → important is a RULE, not something the memory should learn');
});

test('"Hay nhắn nhất" suggests frequent, unclassified people and chats only', () => {
  const s = base();
  const dir = new ContactDirectory(null, { getSettings: () => s });
  for (let i = 0; i < 5; i++) dir.learn({ app: 'zalo', title: 'Mai Phạm', message: 'hi' });
  for (let i = 0; i < 3; i++) dir.learn({ app: 'zalo', title: 'Nhóm Lớp', message: `Tuấn: ${i}` });
  dir.learn({ app: 'zalo', title: 'Bố', message: 'về chưa' });
  const sg = dir.suggestions([{ name: 'Bố', group: 'family' }]);
  assert.deepStrictEqual(sg.map(x => [x.kind, x.name]), [['person', 'Mai Phạm'], ['chat', 'Nhóm Lớp'], ['person', 'Tuấn']]);
  assert.ok(!sg.some(x => x.name === 'Bố'), 'already classified (any app) → not suggested');
});

test('settings: contact rules are sanitized, deduplicated (later wins) and keep ids', () => {
  const out = mergeValidated(base(), {
    contacts: [
      { name: 'Mai', group: 'friends', app: 'Zalo!', attention: 'weird', emotion: 'nope' },
      { name: 'Mai', group: 'partner', app: 'zalo', kind: 'person', id: 'keep_me_1' },
      { name: 'X', group: 'not-a-group' },
      { name: 'Khác', group: 'other', label: 'Hàng xóm' }
    ],
    relationships: { colleagues: { quietEnabled: true, quietStart: '25:00', quietEnd: '07:30' }, bogus: { digest: true } }
  }, DEFAULT_SETTINGS);
  assert.strictEqual(out.contacts.length, 2);
  const mai = out.contacts.find(c => c.name === 'Mai');
  assert.deepStrictEqual([mai.group, mai.app, mai.id, mai.attention, mai.enabled], ['partner', 'zalo', 'keep_me_1', 'auto', true]);
  assert.strictEqual(out.contacts.find(c => c.name === 'Khác').label, 'Hàng xóm');
  assert.deepStrictEqual(out.relationships.colleagues, { quietEnabled: true, quietStart: '18:00', quietEnd: '07:30', afterHours: false, digest: false });
  assert.ok(!out.relationships.bogus);
});

test('"only when it is about me": a group chat with a relationship stays filtered; ⭐/Sếp passes', () => {
  const s = base();
  s.chat.mode = 'mentions';
  s.contacts = [
    { name: 'Badi Châu Báu', kind: 'chat', app: 'teams', group: 'colleagues', attention: 'normal' },
    { name: 'Nhóm Sếp', kind: 'chat', app: 'teams', group: 'colleagues', attention: 'important' }
  ];
  const p = new NotificationPipeline({ getSettings: () => s, inbox: { add() {} } });
  assert.strictEqual(p.ingest({ app: 'teams', title: 'Badi Châu Báu', message: 'Minh: ăn trưa không' }).reason, 'not_mentioned');
  assert.ok(!p.ingest({ app: 'teams', title: 'Nhóm Sếp', message: 'Minh: họp gấp' }).inboxed);
  assert.ok(!p.ingest({ app: 'teams', title: 'Badi Châu Báu', message: 'Minh: @all họp nhé' }).inboxed, '@all still shows');
});

test('a chat the pet knows is a group is not mistaken for 1-1 when a message has no "Name:" prefix', () => {
  const s = base();
  s.chat.mode = 'mentions';
  const dir = new ContactDirectory(null, { getSettings: () => s });
  const p = new NotificationPipeline({ getSettings: () => s, inbox: { add() {} }, directory: dir });
  p.ingest({ app: 'zalo', title: 'Nhà Mình', message: 'Bố: về ăn cơm' });
  assert.strictEqual(p.ingest({ app: 'zalo', title: 'Nhà Mình', message: '[Hình ảnh]' }).reason, 'not_mentioned');
  assert.ok(!p.ingest({ app: 'zalo', title: 'Mai Phạm', message: 'tối nay rảnh không' }).inboxed, 'real 1-1 still shows');
});
