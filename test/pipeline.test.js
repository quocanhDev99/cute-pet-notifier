const test = require('node:test');
const assert = require('node:assert');
const { NotificationPipeline, inQuietHours, normalize } = require('../src/core/notification-pipeline');
const { DEFAULT_SETTINGS } = require('../src/core/settings-store');

const mk = (over = {}) => {
  const s = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  Object.assign(s.notifications, over.notifications || {});
  Object.assign(s.dnd, over.dnd || {});
  const p = new NotificationPipeline({ getSettings: () => s });
  const shown = [];
  p.on('display', (i) => shown.push(i));
  return { p, s, shown };
};

test('normalize sanitizes untrusted input', () => {
  const n = normalize({ title: 'a\u0000b‮c'.padEnd(500, 'x'), url: 'javascript:alert(1)', app: '<Slack>', duration: 1 });
  assert.ok(!/[\u0000‮]/.test(n.title));
  assert.strictEqual(n.title.length, 140);
  assert.strictEqual(n.url, null);
  assert.strictEqual(n.app, 'slack');
  assert.strictEqual(n.duration, 3000);
  assert.strictEqual(normalize({ url: 'https://x.dev/a' }).url, 'https://x.dev/a');
});

test('displays one at a time and advances on finished()', async () => {
  const { p, shown } = mk();
  p.ingest({ title: 'one', app: 'a' });
  p.ingest({ title: 'two', app: 'b' });
  assert.strictEqual(shown.length, 1);
  p.finished(shown[0].id);
  await new Promise(r => setTimeout(r, 300));
  assert.strictEqual(shown.length, 2);
  assert.strictEqual(shown[1].title, 'two');
});

test('dedupes identical notifications', () => {
  const { p } = mk();
  assert.strictEqual(p.ingest({ title: 'same', message: 'x' }).accepted, true);
  const r = p.ingest({ title: 'same', message: 'x' });
  assert.strictEqual(r.accepted, false);
  assert.strictEqual(r.reason, 'duplicate');
  assert.strictEqual(p.ingest({ title: 'same', message: 'x' }, 'webhook', { bypassDedupe: true }).accepted, true);
});

test('higher priority jumps the queue; bursts are grouped', () => {
  const { p } = mk({ notifications: { groupThreshold: 3 } });
  p.ingest({ title: 'first', app: 'z' }); // displayed
  p.ingest({ title: 'calm', app: 'a' });
  p.ingest({ title: 'deadline gấp', app: 'b' });
  assert.strictEqual(p.queue[0].emotion, 'angry');
  p.ingest({ title: 's1', app: 'slack' });
  p.ingest({ title: 's2', app: 'slack' });
  p.ingest({ title: 's3', app: 'slack' });
  const g = p.queue.find(q => q.group);
  assert.ok(g);
  assert.strictEqual(g.members.length, 3);
  assert.match(g.title, /3 thông báo mới từ slack/);
});

test('queue overflow drops oldest non-urgent', () => {
  const { p } = mk({ notifications: { maxQueue: 2, groupThreshold: 50 } });
  ['x0', 'x1', 'x2', 'x3'].forEach((t, i) => p.ingest({ title: t, app: 'a' + i }));
  assert.strictEqual(p.queue.length, 2);
  assert.strictEqual(p.stats.dropped, 1);
});

test('DND sends normal notifications to the Inbox (nothing lost)', () => {
  const { p, shown } = mk({ dnd: { enabled: true } });
  const r = p.ingest({ title: 'shh' });
  assert.strictEqual(r.inboxed, true);
  assert.strictEqual(shown.length, 0);
  assert.strictEqual(p.history[0].status, 'inbox');
});

test('idempotency: same provider event ID never shows twice; latency measured on render', () => {
  const { p, shown } = mk();
  const ev = { title: 'PR merged', app: 'github', provider: 'github', sourceEventId: 'evt-1', sourceCreatedAt: Date.now() - 1500 };
  assert.strictEqual(p.ingest(ev).accepted, true);
  const dup = p.ingest(ev);
  assert.strictEqual(dup.accepted, false);
  assert.strictEqual(dup.reason, 'duplicate_event');
  const r = p.markRendered(shown[0].id, Date.now());
  assert.ok(r.endToEnd >= 1500 && r.endToEnd < 5000);
  assert.strictEqual(p.latency.stats('webhook:end_to_end').count, 1);
});

test('event contract fields are normalized', () => {
  const n = normalize({ title: 't', sourceApplication: 'Slack', bodyPreview: 'hello', priority: 'urgent', deliveryMode: 'realtime_push', sourceUrl: 'https://x.dev', sourceCreatedAt: '2026-11-03T08:00:00Z' }, 'gateway');
  assert.strictEqual(n.app, 'slack');
  assert.strictEqual(n.message, 'hello');
  assert.strictEqual(n.priority, 'critical');
  assert.strictEqual(n.deliveryMode, 'realtime_push');
  assert.strictEqual(n.url, 'https://x.dev/');
  assert.strictEqual(n.sourceCreatedAt, Date.parse('2026-11-03T08:00:00Z'));
  assert.strictEqual(normalize({ deliveryMode: 'instant' }).deliveryMode, 'manual');
});

test('quiet hours across midnight', () => {
  const dnd = { quietHoursEnabled: true, quietStart: '22:00', quietEnd: '07:00' };
  assert.strictEqual(inQuietHours(dnd, new Date(2026, 0, 1, 23, 30)), true);
  assert.strictEqual(inQuietHours(dnd, new Date(2026, 0, 1, 6, 59)), true);
  assert.strictEqual(inQuietHours(dnd, new Date(2026, 0, 1, 12, 0)), false);
});

test('Pipeline keeps allowlisted rows/actions only', () => {
  const { normalize } = require('../src/core/notification-pipeline');
  if (typeof normalize !== 'function') return;
  const n = normalize({ title: 'x', actions: ['approve', 'merge'], items: [{ key: 'k1', title: 'PR', url: 'javascript:alert(1)', actions: ['approve', 'delete'] }, { title: 'no key' }] }, 'composio');
  assert.deepStrictEqual(n.actions, ['approve']);
  assert.strictEqual(n.items.length, 1);
  assert.deepStrictEqual(n.items[0].actions, ['approve']);
  assert.ok(!n.items[0].url, 'non-http url dropped');
});

test('Chat "mentions" mode: group chatter → Inbox, mentions & DMs → card', () => {
  const { p, s, shown } = mk();
  s.chat = { mode: 'mentions', names: ['Mai Pham', '@Mai'], includeDirect: true };
  const r1 = p.ingest({ title: 'Nhom Du An', message: 'Ban A: app gãy rồi', app: 'teams' }, 'macos_nc');
  assert.strictEqual(r1.inboxed, true);
  assert.strictEqual(r1.reason, 'not_mentioned');
  const r2 = p.ingest({ title: 'Nhom Du An', message: 'Ban A: @Mai xem giúp', app: 'teams' }, 'macos_nc');
  assert.ok(!r2.inboxed);
  assert.strictEqual(r2.item.priority, 'important');
  const r3 = p.ingest({ title: 'Ban A', message: 'rảnh không?', app: 'zalo' }, 'macos_nc');
  assert.ok(!r3.inboxed, 'direct message still shows');
  s.chat.mode = 'all';
  const r4 = p.ingest({ title: 'Nhom Ha Tang', message: 'Ban B: build xanh', app: 'teams' }, 'macos_nc');
  assert.ok(!r4.inboxed);
  assert.ok(shown.length >= 1);
});
