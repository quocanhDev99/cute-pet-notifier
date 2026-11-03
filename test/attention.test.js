const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AttentionEngine, derivePriority, effectiveMode } = require('../src/core/attention-engine');
const { InboxStore } = require('../src/core/inbox-store');
const { DEFAULT_SETTINGS } = require('../src/core/settings-store');

const settings = (patch = {}) => {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  for (const [k, v] of Object.entries(patch)) Object.assign(s[k], v);
  return s;
};

test('priority derivation', () => {
  assert.strictEqual(derivePriority({ priority: 'urgent' }), 'critical');
  assert.strictEqual(derivePriority({ priority: 'high' }), 'important');
  assert.strictEqual(derivePriority({ title: 'Khuyến mãi 50%' }), 'low');
  assert.strictEqual(derivePriority({ app: 'calendar' }), 'important');
  assert.strictEqual(derivePriority({ app: 'x', title: 'build ok' }), 'normal');
});

test('low priority → Inbox; normal → show', () => {
  const s = settings();
  const a = new AttentionEngine({ getSettings: () => s });
  assert.strictEqual(a.decide({ app: 'x', title: 'newsletter tuần này' }).action, 'inbox');
  assert.strictEqual(a.decide({ app: 'x', title: 'ok' }).action, 'show');
});

test('per-app cooldown: 3 per 10s, critical bypasses', () => {
  let now = 1_000_000;
  const s = settings();
  const a = new AttentionEngine({ getSettings: () => s, now: () => now });
  const r = [1, 2, 3, 4].map(() => a.decide({ app: 'slack', title: 'msg' }).action);
  assert.deepStrictEqual(r, ['show', 'show', 'show', 'inbox']);
  assert.strictEqual(a.decide({ app: 'slack', priority: 'critical' }).action, 'show');
  now += 11_000;
  assert.strictEqual(a.decide({ app: 'slack', title: 'msg' }).action, 'show');
});

test('focus modes gate by minimum priority and category; manual mode wins', () => {
  const meeting = settings({ system: { focusMode: 'meeting' } });
  const a = new AttentionEngine({ getSettings: () => meeting });
  assert.strictEqual(a.decide({ app: 'x', title: 'ok' }).action, 'inbox');
  const imp = a.decide({ app: 'calendar', title: 'Họp' });
  assert.strictEqual(imp.action, 'show');
  assert.strictEqual(imp.silent, true);
  const work = new AttentionEngine({ getSettings: () => settings({ system: { focusMode: 'work' } }) });
  assert.match(work.decide({ app: 'youtube', title: 'new video' }).reason, /blocks_entertainment/);
  // Manual focus mode beats DND/quiet hours
  const both = settings({ system: { focusMode: 'relax' }, dnd: { enabled: true } });
  assert.strictEqual(effectiveMode(both).id, 'relax');
});

test('hidden presence & gaming keep events in Inbox but critical still shows', () => {
  for (const s of [settings({ system: { presence: 'hidden' } }), settings({ system: { focusMode: 'gaming' } })]) {
    const a = new AttentionEngine({ getSettings: () => s });
    assert.strictEqual(a.decide({ app: 'x', title: 'hi' }).action, 'inbox');
    assert.strictEqual(a.decide({ app: 'system', priority: 'critical' }).action, 'show');
  }
});

test('muted apps', () => {
  const s = settings({ attention: { mutedApps: ['slack'] } });
  const a = new AttentionEngine({ getSettings: () => s });
  assert.strictEqual(a.decide({ app: 'slack', title: 'x' }).reason, 'app_muted');
});

test('inbox persists, digests and respects persistInbox=false', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-inbox-'));
  const s = settings();
  const ib = new InboxStore(dir, { getSettings: () => s });
  ib.add({ id: 'a', app: 'slack', title: 'x', priority: 'important', emotion: 'excited' });
  ib.add({ id: 'b', app: 'gmail', title: 'y', priority: 'low', emotion: 'thinking' });
  assert.strictEqual(new InboxStore(dir, { getSettings: () => s }).unreadCount(), 2);
  const d = ib.digest();
  assert.strictEqual(d.total, 2);
  assert.strictEqual(d.byPriority.important, 1);
  ib.markRead('a');
  assert.strictEqual(ib.unreadCount(), 1);
  s.attention.persistInbox = false;
  ib.persist();
  assert.strictEqual(fs.existsSync(path.join(dir, 'inbox.json')), false);
});
