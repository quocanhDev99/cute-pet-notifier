const test = require('node:test');
const assert = require('node:assert');
const { classify, PERSONALITY_PRESETS } = require('../src/core/emotion-engine');

test('keyword rules map Vietnamese + English text', () => {
  assert.strictEqual(classify({ title: 'LƯƠNG ĐÃ VỀ', message: '+30tr' }).emotion, 'love');
  assert.strictEqual(classify({ title: 'Deadline 17h', app: 'webhook' }).emotion, 'angry');
  assert.strictEqual(classify({ title: 'Build failed', app: 'webhook' }).emotion, 'sad');
  assert.strictEqual(classify({ title: 'Deploy thành công', app: 'webhook' }).emotion, 'happy');
});

test('short numeric keywords match whole words only', () => {
  assert.strictEqual(classify({ title: 'Error 500' }).matchedBy, 'keyword');
  assert.notStrictEqual(classify({ title: 'Đơn hàng 1500k' }).emotion, 'sad');
});

test('hierarchy: custom > app > keyword > metadata > default', () => {
  const cfg = { customRules: [{ pattern: 'sếp', field: 'any', match: 'contains', emotion: 'surprised', enabled: true }] };
  const r1 = classify({ title: 'Sếp nhắn', app: 'slack' }, cfg);
  assert.deepStrictEqual([r1.emotion, r1.matchedBy], ['surprised', 'custom']);
  const r2 = classify({ title: 'deadline', app: 'slack' });
  assert.deepStrictEqual([r2.emotion, r2.matchedBy], ['excited', 'app']);
  const r3 = classify({ title: 'hello', app: 'x', priority: 'urgent' });
  assert.deepStrictEqual([r3.emotion, r3.matchedBy], ['surprised', 'metadata']);
  const r4 = classify({ title: 'hello', app: 'x', event: 'TASK_DONE' });
  assert.strictEqual(r4.emotion, 'happy');
  const r5 = classify({ title: 'hello', app: 'x' }, { personality: 'energetic_playful' });
  assert.deepStrictEqual([r5.emotion, r5.matchedBy], ['excited', 'default']);
});

test('personality remaps and annoyance', () => {
  const r = classify({ title: 'Họp sprint', app: 'x' }, { personality: 'grumpy_dramatic' });
  assert.strictEqual(r.baseEmotion, 'sleeping');
  assert.strictEqual(r.emotion, 'angry');
  assert.strictEqual(r.annoying, true);
  const calm = classify({ title: 'deadline', app: 'x' }, { personality: 'calm_gentle' });
  assert.strictEqual(calm.emotion, 'thinking');
  assert.strictEqual(calm.annoying, false);
});

test('custom rule is never remapped by personality; forceEmotion bypasses all', () => {
  const cfg = { personality: 'grumpy_dramatic', customRules: [{ pattern: 'standup', emotion: 'sleeping' }] };
  assert.strictEqual(classify({ title: 'standup' }, cfg).emotion, 'sleeping');
  assert.strictEqual(classify({ title: 'deadline', forceEmotion: 'love' }, cfg).emotion, 'love');
});

test('regex rules are guarded', () => {
  const cfg = { customRules: [{ pattern: '(a+)+$', match: 'regex', emotion: 'sad' }, { pattern: '^\\[prod\\]', match: 'regex', field: 'title', emotion: 'surprised' }] };
  assert.strictEqual(classify({ title: '[PROD] down', app: 'x' }, cfg).emotion, 'surprised');
  assert.notStrictEqual(classify({ title: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa!', app: 'x' }, cfg).matchedBy, 'custom');
});

test('5 presets exist', () => assert.strictEqual(Object.keys(PERSONALITY_PRESETS).length, 5));

test('followAttitude: every notification reacts with the chosen attitude', () => {
  const mood = { followAttitude: true, enabled: true };
  const grumpy = classify({ title: 'Lương về rồi 🎉', message: 'thưởng tết', app: 'zalo' }, { personality: 'grumpy_dramatic', mood });
  assert.strictEqual(grumpy.emotion, PERSONALITY_PRESETS.grumpy_dramatic.reactEmotion);
  assert.strictEqual(grumpy.matchedBy, 'attitude');
  assert.strictEqual(grumpy.annoying, true, 'a grumpy reaction also dodges petting');
  const sweet = classify({ title: 'deadline gấp', message: 'server lỗi' }, { personality: 'sweet_friendly', mood });
  assert.strictEqual(sweet.emotion, PERSONALITY_PRESETS.sweet_friendly.reactEmotion);
  for (const p of Object.values(PERSONALITY_PRESETS)) {
    assert.strictEqual(classify({ title: 'x' }, { personality: p.id, mood }).emotion, p.reactEmotion, p.id);
  }
});

test('followAttitude: the user\'s own rules and forceEmotion still win', () => {
  const mood = { followAttitude: true };
  const custom = classify({ title: 'Mẹ gọi' }, { personality: 'grumpy_dramatic', mood, customRules: [{ field: 'title', match: 'contains', pattern: 'Mẹ', emotion: 'love' }] });
  assert.strictEqual(custom.emotion, 'love');
  assert.strictEqual(classify({ title: 'x', forceEmotion: 'sad' }, { personality: 'grumpy_dramatic', mood }).emotion, 'sad');
});

test('followAttitude off: content still decides (old behaviour)', () => {
  const c = classify({ title: 'deadline gấp' }, { personality: 'sweet_friendly', mood: { followAttitude: false } });
  assert.strictEqual(c.emotion, 'angry');
});

test('contact groups: the user names people, the group decides the reaction (beats the attitude)', () => {
  const cfg = { personality: 'grumpy_dramatic', mood: { followAttitude: true }, contacts: [
    { name: 'Mai Phạm', group: 'partner' }, { name: 'Anh Hùng', group: 'manager' }, { name: 'Bố', group: 'family', emotion: 'excited' }
  ] };
  const dm = classify({ title: 'Mai Pham', message: 'tối nay ăn gì', app: 'zalo' }, cfg); // accent-insensitive
  assert.strictEqual(dm.emotion, 'love');
  assert.strictEqual(dm.matchedBy, 'contact');
  assert.strictEqual(dm.contactGroup, 'partner');
  const group = classify({ title: 'Nhóm dự án', message: 'Anh Hùng: họp lúc 3h nhé', app: 'teams' }, cfg); // "Name: …" prefix
  assert.strictEqual(group.contactGroup, 'manager');
  assert.strictEqual(classify({ title: 'Bố', message: 'về ăn cơm', app: 'zalo' }, cfg).emotion, 'excited', "a contact's own emotion wins over the group's");
  const stranger = classify({ title: 'Người lạ', message: 'hi', app: 'zalo' }, cfg);
  assert.strictEqual(stranger.matchedBy, 'attitude', 'never guessed for people not in the list');
  assert.strictEqual(classify({ title: 'Mai', message: 'hi', app: 'zalo' }, cfg).contactGroup, null, 'partial names do not match');
});
