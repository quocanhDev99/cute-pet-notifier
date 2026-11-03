const test = require('node:test');
const assert = require('node:assert');
const { parseICS, upcomingOccurrences } = require('../src/adapters/ics-parser');

const ICS = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:one',
  'DTSTART:20261103T020000Z',
  'DTEND:20261103T030000Z',
  'SUMMARY:Standup\\, daily',
  'DESCRIPTION:Join https://meet.google.com/abc-defg-hij now',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly',
  'DTSTART;TZID=Asia/Ho_Chi_Minh:20261005T090000',
  'DTEND;TZID=Asia/Ho_Chi_Minh:20261005T100000',
  'RRULE:FREQ=WEEKLY;BYDAY=MO,WE',
  'EXDATE;TZID=Asia/Ho_Chi_Minh:20261104T090000',
  'SUMMARY:Sprint sync',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly',
  'RECURRENCE-ID;TZID=Asia/Ho_Chi_Minh:20261109T090000',
  'DTSTART;TZID=Asia/Ho_Chi_Minh:20261109T140000',
  'SUMMARY:Sprint sync (moved)',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:allday',
  'DTSTART;VALUE=DATE:20261103',
  'SUMMARY:Holiday',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:cancel',
  'DTSTART:20261103T050000Z',
  'STATUS:CANCELLED',
  'SUMMARY:Cancelled',
  'END:VEVENT',
  'END:VCALENDAR'
].join('\r\n');

test('parses events, unescapes text, extracts meet link', () => {
  const ev = parseICS(ICS);
  const one = ev.find(e => e.uid === 'one');
  assert.strictEqual(one.summary, 'Standup, daily');
  assert.strictEqual(one.url, 'https://meet.google.com/abc-defg-hij');
  assert.strictEqual(one.start.ts, Date.UTC(2026, 10, 3, 2, 0));
});

test('TZID conversion, weekly BYDAY, EXDATE, overrides, all-day & cancelled skipped', () => {
  const ev = parseICS(ICS);
  const from = Date.UTC(2026, 10, 2, 0, 0); // Mon 2 Nov 2026
  const to = Date.UTC(2026, 10, 10, 0, 0);
  const occ = upcomingOccurrences(ev, from, to);
  const sync = occ.filter(o => o.uid === 'weekly');
  // Mon 2 Nov 09:00 ICT = 02:00Z ; Wed 4 Nov excluded ; Mon 9 Nov moved to 14:00 ICT = 07:00Z
  assert.deepStrictEqual(sync.map(o => new Date(o.start).toISOString()), ['2026-11-02T02:00:00.000Z', '2026-11-09T07:00:00.000Z']);
  assert.ok(!occ.some(o => o.uid === 'allday'));
  assert.ok(!occ.some(o => o.uid === 'cancel'));
});
