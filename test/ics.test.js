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

const cal = (...events) => ['BEGIN:VCALENDAR', ...events.flatMap(e => ['BEGIN:VEVENT', ...e, 'END:VEVENT']), 'END:VCALENDAR'].join('\r\n');
const iso = (ts) => new Date(ts).toISOString();

test('monthly/yearly RRULE: BYDAY ordinals, BYMONTHDAY, BYMONTH', () => {
  const events = parseICS(cal(
    ['UID:m2tu', 'DTSTART:20260113T090000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU', 'SUMMARY:2nd Tuesday'],
    ['UID:mlast', 'DTSTART:20260130T090000Z', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=-1', 'SUMMARY:Last day'],
    ['UID:ybm', 'DTSTART:20260310T090000Z', 'RRULE:FREQ=YEARLY;BYMONTH=3,11;BYMONTHDAY=10', 'SUMMARY:Twice a year']
  ));
  const occ = upcomingOccurrences(events, Date.UTC(2026, 10, 1), Date.UTC(2026, 11, 1));
  const by = (uid) => occ.filter(o => o.uid === uid).map(o => iso(o.start));
  assert.deepStrictEqual(by('m2tu'), ['2026-11-10T09:00:00.000Z']);
  assert.deepStrictEqual(by('mlast'), ['2026-11-30T09:00:00.000Z']);
  assert.deepStrictEqual(by('ybm'), ['2026-11-10T09:00:00.000Z']);
});

test('RRULE with bad INTERVAL/COUNT is not silently empty or endless; COUNT spans the past', () => {
  const events = parseICS(cal(
    ['UID:nan', 'DTSTART:20261101T090000Z', 'RRULE:FREQ=DAILY;INTERVAL=abc;COUNT=xyz', 'SUMMARY:Bad numbers'],
    ['UID:count', 'DTSTART:20200101T090000Z', 'RRULE:FREQ=DAILY;COUNT=3', 'SUMMARY:Only three'],
    ['UID:old', 'DTSTART;TZID=Asia/Ho_Chi_Minh:20200106T090000', 'RRULE:FREQ=DAILY', 'SUMMARY:Since 2020']
  ));
  const occ = upcomingOccurrences(events, Date.UTC(2026, 10, 3), Date.UTC(2026, 10, 5));
  assert.strictEqual(occ.filter(o => o.uid === 'nan').length, 2);
  assert.strictEqual(occ.filter(o => o.uid === 'count').length, 0);
  assert.deepStrictEqual(occ.filter(o => o.uid === 'old').map(o => iso(o.start)), ['2026-11-03T02:00:00.000Z', '2026-11-04T02:00:00.000Z']);
});
