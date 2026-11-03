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
