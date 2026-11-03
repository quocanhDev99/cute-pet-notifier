/**
 * Minimal, dependency-free iCalendar (RFC 5545) parser for meeting reminders.
 * Supports: line unfolding, TZID / UTC / floating times, all-day detection,
 * RRULE (DAILY / WEEKLY+BYDAY / MONTHLY / YEARLY, INTERVAL, COUNT, UNTIL),
 * EXDATE, RECURRENCE-ID overrides and STATUS:CANCELLED.
 */

const WINDOWS_TZ = {
  'SE Asia Standard Time': 'Asia/Bangkok',
  'UTC': 'UTC',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Pacific Standard Time': 'America/Los_Angeles',
  'Mountain Standard Time': 'America/Denver',
  'Central Standard Time': 'America/Chicago',
  'Eastern Standard Time': 'America/New_York',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'Korea Standard Time': 'Asia/Seoul',
  'China Standard Time': 'Asia/Shanghai',
  'Singapore Standard Time': 'Asia/Singapore',
  'India Standard Time': 'Asia/Kolkata',
  'AUS Eastern Standard Time': 'Australia/Sydney'
};

const DAY_CODES = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

function unfold(text) {
  return String(text).replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

function parseLine(line) {
  // Split NAME;PARAMS:VALUE respecting quoted params.
  let inQuote = false;
  let colon = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ':' && !inQuote) { colon = i; break; }
  }
  if (colon === -1) return null;
  const head = line.slice(0, colon);
  const value = line.slice(colon + 1);
  const parts = head.split(';');
  const name = parts.shift().toUpperCase();
  const params = {};
  for (const p of parts) {
    const eq = p.indexOf('=');
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
  }
  return { name, params, value };
}

function unescapeText(v) {
  return String(v || '').replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
}

function tzOffsetMs(ts, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const p = {};
  for (const { type, value } of fmt.formatToParts(new Date(ts))) p[type] = value;
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - ts;
}

/** Convert wall-clock components in `tz` to a UTC timestamp. */
function wallToUtc(w, tz) {
  const guess = Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s);
  if (tz === 'UTC') return guess;
  if (!tz) return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s).getTime(); // floating → local
  try {
    let ts = guess - tzOffsetMs(guess, tz);
    ts = guess - tzOffsetMs(ts, tz); // second pass for DST edges
    return ts;
  } catch {
    return new Date(w.y, w.mo, w.d, w.h, w.mi, w.s).getTime();
  }
}

function resolveTz(tzid) {
  if (!tzid) return null;
  const mapped = WINDOWS_TZ[tzid] || tzid;
  try { new Intl.DateTimeFormat('en-US', { timeZone: mapped }); return mapped; } catch { return null; }
}

/** Parse an ICS date/date-time property into { wall, tz, allDay, ts }. */
function parseDate(prop) {
  if (!prop) return null;
  const v = prop.value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const wall = { y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0) };
  const allDay = prop.params.VALUE === 'DATE' || !m[4];
  const tz = m[7] ? 'UTC' : resolveTz(prop.params.TZID);
  return { wall, tz, allDay, ts: wallToUtc(wall, tz) };
}

function parseRRule(value) {
  const out = {};
  for (const part of String(value).split(';')) {
    const [k, v] = part.split('=');
    if (k && v) out[k.toUpperCase()] = v;
  }
  return out;
}

function addDaysWall(w, n) {
  const t = new Date(Date.UTC(w.y, w.mo, w.d + n, w.h, w.mi, w.s));
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: t.getUTCDate(), h: w.h, mi: w.mi, s: w.s };
}

function addMonthsWall(w, n) {
  const t = new Date(Date.UTC(w.y, w.mo + n, 1));
  const daysIn = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate();
  if (w.d > daysIn) return null; // RFC: skip invalid dates (e.g. Feb 30)
  return { y: t.getUTCFullYear(), mo: t.getUTCMonth(), d: w.d, h: w.h, mi: w.mi, s: w.s };
}

function weekdayOf(w) { return new Date(Date.UTC(w.y, w.mo, w.d)).getUTCDay(); }

/** Expand occurrences of a (possibly recurring) event between [from, to]. */
function expand(ev, from, to) {
  const dur = ev.end ? ev.end.ts - ev.start.ts : 0;
  const out = [];
  const push = (ts) => {
    if (ev.exdates.has(ts)) return;
    if (ts + Math.max(dur, 0) >= from && ts <= to) out.push(ts);
  };
  if (!ev.rrule) { push(ev.start.ts); return out; }

  const r = parseRRule(ev.rrule);
  const interval = Math.max(1, parseInt(r.INTERVAL || '1', 10));
  const count = r.COUNT ? parseInt(r.COUNT, 10) : Infinity;
  const until = r.UNTIL ? (parseDate({ value: r.UNTIL, params: {} }) || {}).ts : Infinity;
  const byDay = r.BYDAY ? r.BYDAY.split(',').map(d => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, ''))).filter(d => d >= 0) : null;
  const tz = ev.start.tz;
  let n = 0;
  const MAX_ITER = 40000;

  if (r.FREQ === 'DAILY' || (r.FREQ === 'WEEKLY')) {
    const days = r.FREQ === 'WEEKLY' ? (byDay && byDay.length ? byDay : [weekdayOf(ev.start.wall)]) : null;
    const startOffset = (weekdayOf(ev.start.wall) + 6) % 7; // WKST=MO
    for (let i = 0; i < MAX_ITER; i++) {
      const w = addDaysWall(ev.start.wall, i);
      let include;
      if (r.FREQ === 'DAILY') include = i % interval === 0 && (!byDay || byDay.includes(weekdayOf(w)));
      else {
        const weekIdx = Math.floor((i + startOffset) / 7);
        include = weekIdx % interval === 0 && days.includes(weekdayOf(w));
      }
      if (!include) continue;
      const ts = wallToUtc(w, tz);
      if (ts > until || n >= count || ts > to) break;
      n++;
      push(ts);
    }
  } else if (r.FREQ === 'MONTHLY' || r.FREQ === 'YEARLY') {
    const step = r.FREQ === 'MONTHLY' ? interval : interval * 12;
    for (let i = 0; i < MAX_ITER / 10; i++) {
      const w = addMonthsWall(ev.start.wall, i * step);
      if (!w) continue;
      const ts = wallToUtc(w, tz);
      if (ts > until || n >= count || ts > to) break;
      n++;
      push(ts);
    }
  } else {
    push(ev.start.ts);
  }
  return out;
}

function parseICS(text) {
  const lines = unfold(text);
  const events = [];
  let cur = null;
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === 'BEGIN:VEVENT') { cur = { props: {}, exdates: [] }; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const p = parseLine(line);
    if (!p) continue;
    if (p.name === 'EXDATE') {
      for (const v of p.value.split(',')) cur.exdates.push({ value: v, params: p.params });
    } else if (!cur.props[p.name]) {
      cur.props[p.name] = p;
    }
  }

  return events.map(e => {
    const start = parseDate(e.props.DTSTART);
    if (!start) return null;
    const desc = unescapeText(e.props.DESCRIPTION && e.props.DESCRIPTION.value);
    const meetLink = (desc.match(/https:\/\/(?:meet\.google\.com|[\w.-]*zoom\.us|teams\.microsoft\.com)\/[^\s<>"]+/) || [])[0] || null;
    return {
      uid: e.props.UID ? e.props.UID.value : `${start.ts}`,
      summary: unescapeText(e.props.SUMMARY && e.props.SUMMARY.value) || '(Không tiêu đề)',
      location: unescapeText(e.props.LOCATION && e.props.LOCATION.value),
      url: (e.props.URL && e.props.URL.value) || meetLink,
      status: e.props.STATUS ? e.props.STATUS.value.toUpperCase() : 'CONFIRMED',
      start,
      end: parseDate(e.props.DTEND),
      rrule: e.props.RRULE ? e.props.RRULE.value : null,
      recurrenceId: parseDate(e.props['RECURRENCE-ID']),
      exdates: new Set(e.exdates.map(x => (parseDate(x) || {}).ts).filter(Boolean))
    };
  }).filter(Boolean);
}

/** Return concrete, non-cancelled, timed occurrences in [from, to], sorted. */
function upcomingOccurrences(events, from, to) {
  const overrides = new Map(); // uid -> Set(recurrence ts)
  for (const e of events) {
    if (e.recurrenceId) {
      if (!overrides.has(e.uid)) overrides.set(e.uid, new Set());
      overrides.get(e.uid).add(e.recurrenceId.ts);
    }
  }
  const out = [];
  for (const e of events) {
    if (e.start.allDay) continue;
    const skip = !e.recurrenceId && overrides.get(e.uid);
    for (const ts of expand(e, from, to)) {
      if (skip && skip.has(ts)) continue;
      if (e.status === 'CANCELLED') continue;
      out.push({ uid: e.uid, start: ts, summary: e.summary, location: e.location, url: e.url });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

module.exports = { parseICS, upcomingOccurrences, wallToUtc, unfold };
