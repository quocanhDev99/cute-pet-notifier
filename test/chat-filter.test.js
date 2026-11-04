const test = require('node:test');
const assert = require('node:assert');
const { chatDecision, mentionInfo } = require('../src/core/chat-filter');

const S = (over = {}) => ({ chat: { mode: 'mentions', names: ['Mai Pham', '@Mai', 'mai.pham'], includeDirect: true, ...over } });

test('Chat filter: "all" mode shows every chat message', () => {
  const d = chatDecision({ app: 'teams', title: 'Nhom Du An', message: 'Ban A: app gãy rồi' }, S({ mode: 'all' }));
  assert.strictEqual(d.show, true);
  assert.strictEqual(d.chat, true);
});

test('Chat filter: mentions by name, @all and the app’s own marker', () => {
  const s = S().chat.names;
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban A: @Mai review giúp PR này' }, s).by, 'name');
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban B: mai phạm ơi check log' }, s).by, 'name', 'accent-insensitive full name');
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban C: cc @mai.pham' }, s).by, 'name');
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban C: @all họp 3h nhé' }, s).by, 'all');
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban C: @Tất cả nghỉ trưa' }, s).by, 'all');
  assert.strictEqual(mentionInfo({ title: 'Ban A mentioned you in #web', message: 'xem giúp' }, s).by, 'app');
  assert.strictEqual(mentionInfo({ title: 'Zalo', message: 'Ban B đã nhắc đến bạn trong nhóm' }, s).by, 'app');
  // Everyday word "mai" (= tomorrow) without @ must NOT count as a mention of "@Mai".
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban A: mai deploy tiếp nhé' }, s).mentioned, false);
  // Email-like text is not a mention of "@Mai".
  assert.strictEqual(mentionInfo({ title: 'Team', message: 'Ban A: gửi về thumai@corp.com' }, s).mentioned, false);
});

test('Chat filter: mentions mode → others go to inbox, DMs still show', () => {
  const group = chatDecision({ app: 'teams', title: 'Nhom Du An', message: 'Ban A: app gãy rồi' }, S());
  assert.deepStrictEqual([group.show, group.reason, group.direct], [false, 'not_mentioned', false]);
  const dm = chatDecision({ app: 'teams', title: 'Ban A', message: 'rảnh không?' }, S());
  assert.strictEqual(dm.show, true, '1-1 message still shows');
  const dmOff = chatDecision({ app: 'teams', title: 'Ban A', message: 'rảnh không?' }, S({ includeDirect: false }));
  assert.strictEqual(dmOff.show, false);
  const slackChannel = chatDecision({ app: 'slack', title: '💬 Ban B trong #dev', message: 'deploy?', chatDirect: false, chatMention: false }, S());
  assert.strictEqual(slackChannel.show, false);
  const slackMention = chatDecision({ app: 'slack', title: '📣 Ban B trong #dev', message: 'xem giúp', chatDirect: false, chatMention: true }, S());
  assert.strictEqual(slackMention.show, true);
  const notChat = chatDecision({ app: 'github', title: 'PR merged', message: 'x' }, S());
  assert.strictEqual(notChat.show, true);
});
