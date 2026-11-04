const test = require('node:test');
const assert = require('node:assert');
const { readMood } = require('../src/core/mood-reader');
const emo = (message, title = 'Team', o) => { const r = readMood({ title, message }, o); return r && r.emotion; };

test('Mood reader: emoji', () => {
  assert.strictEqual(emo('Ban D: 😁'), 'happy');
  assert.strictEqual(emo('Ban C: 🎉🎉 release rồi'), 'excited');
  assert.strictEqual(emo('Ban B: ❤️ cảm ơn bạn'), 'love');
  assert.strictEqual(emo('Ban A: 😭😭'), 'sad');
  assert.strictEqual(emo('Ban G: 😡'), 'angry');
  assert.strictEqual(emo('Ban F: 🤔'), 'thinking');
});

test('Mood reader: Vietnamese words with or without accents, English', () => {
  assert.strictEqual(emo('Ban A: app gãy rồi'), 'sad');
  assert.strictEqual(emo('Ban A: app gay roi'), 'sad');
  assert.strictEqual(emo('Ban B: prod toang rồi anh ơi'), 'sad');
  assert.strictEqual(emo('Ban C: cảm ơn anh nhiều nha'), 'love');
  assert.strictEqual(emo('Ban E: deploy thành công rồi'), 'happy');
  assert.strictEqual(emo('Sếp: task này quá hạn rồi, gấp lên'), 'angry');
  assert.strictEqual(emo('Ban C: anh xem giúp em PR này được không?'), 'thinking');
  assert.strictEqual(emo('Alex: great job on the release, thanks!'), 'love');
});

test('Mood reader: negation, intensity, neutral text', () => {
  assert.strictEqual(emo('Ban E: build không thành công'), 'sad');
  assert.strictEqual(emo('Ban E: chưa ổn đâu, chưa được'), 'sad');
  assert.strictEqual(emo('Sếp: SAO LẠI LỖI NỮA RỒI!!!'), 'angry');
  assert.strictEqual(emo('Ban C: tin vui!!! mình lên version mới'), 'excited');
  assert.strictEqual(readMood({ title: 'Team', message: 'Ban A: họp lúc 3h ở phòng B' }), null, 'neutral → no guess');
  // Sender names before ":" are not read as words ("Vui: …" is a name).
  assert.strictEqual(readMood({ title: 'Team', message: 'Vui: gửi file nhé' }), null);
});

test('Mood reader: sensitivity', () => {
  assert.strictEqual(readMood({ message: 'Ban E: xong' }, { sensitivity: 'low' }), null, 'one weak word is not enough when sensitivity is low');
  assert.strictEqual(emo('Ban E: xong', 'Team', { sensitivity: 'medium' }), null);
  assert.strictEqual(emo('Ban E: xong rồi nha', 'Team', { sensitivity: 'high' }), 'happy');
});
