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

const FMT_CACHE = new Map(); // building an Intl.DateTimeFormat is the expensive part: one per zone
function tzOffsetMs(ts, timeZone) {
  let fmt = FMT_CACHE.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
    if (FMT_CACHE.size > 64) FMT_CACHE.clear();
    FMT_CACHE.set(timeZone, fmt);
  }
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

function weekdayOf(w) { return new Date(Date.UTC(w.y, w.mo, w.d)).getUTCDay(); }

const posInt = (v, d) => { const n = parseInt(v, 10); return Number.isFinite(n) && n > 0 ? n : d; };
// Any zone is within ±14 h of UTC: "wall time read as UTC" brackets the real instant. Lets the loops
// skip the (Intl-based) exact conversion for occurrences nowhere near the window.
const ZONE_SLACK = 15 * 3600 * 1000;
const approxUtc = (w) => Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s);

/** "2TU" → { ord: 2, day: 2 }, "FR" → { ord: 0, day: 5 }, "-1SU" → { ord: -1, day: 0 }. */
function parseByDay(list) {
  return String(list).split(',').map((x) => {
    const m = /^([+-]?\d{1,2})?([A-Z]{2})$/.exec(x.trim().toUpperCase());
    if (!m) return null;
    const day = DAY_CODES.indexOf(m[2]);
    return day < 0 ? null : { ord: m[1] ? parseInt(m[1], 10) : 0, day };
  }).filter(Boolean);
}

/** Days of month y/mo (0-based mo) matching BYDAY / BYMONTHDAY, or the start's day. Sorted. */
function monthDays(y, mo, startDay, byDay, byMonthDay) {
  const daysIn = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  let days = null;
  if (byMonthDay && byMonthDay.length) {
    days = byMonthDay.map(d => (d < 0 ? daysIn + 1 + d : d)).filter(d => d >= 1 && d <= daysIn);
  }
  if (byDay && byDay.length) {
    const first = new Date(Date.UTC(y, mo, 1)).getUTCDay();
    const set = new Set();
    for (const { ord, day } of byDay) {
      const firstHit = 1 + ((day - first + 7) % 7);
      const hits = [];
      for (let d = firstHit; d <= daysIn; d += 7) hits.push(d);
      if (!ord) hits.forEach(d => set.add(d));
      else { const d = ord > 0 ? hits[ord - 1] : hits[hits.length + ord]; if (d) set.add(d); }
    }
    days = days ? days.filter(d => set.has(d)) : [...set];
  }
  if (!days) days = startDay <= daysIn ? [startDay] : []; // RFC: skip invalid dates (e.g. Feb 30)
  return [...new Set(days)].sort((a, b) => a - b);
}

/** Expand occurrences of a (possibly recurring) event between [from, to]. */
function expand(ev, from, to) {
  const dur = Math.max(0, ev.end ? ev.end.ts - ev.start.ts : 0);
  const out = [];
  const push = (ts) => {
    if (ev.exdates.has(ts)) return;
    if (ts + dur >= from && ts <= to) out.push(ts);
  };
  if (!ev.rrule) { push(ev.start.ts); return out; }

  const r = parseRRule(ev.rrule);
  const interval = posInt(r.INTERVAL, 1);
  const count = r.COUNT ? posInt(r.COUNT, Infinity) : Infinity;
  const untilTs = r.UNTIL ? (parseDate({ value: r.UNTIL, params: {} }) || {}).ts : undefined;
  const until = Number.isFinite(untilTs) ? untilTs : Infinity;
  const byDayRaw = r.BYDAY ? parseByDay(r.BYDAY) : null;
  const byDay = byDayRaw && byDayRaw.length ? byDayRaw : null;
  const byMonthDay = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(x => parseInt(x, 10)).filter(n => Number.isFinite(n) && n !== 0 && Math.abs(n) <= 31) : null;
  const byMonth = r.BYMONTH ? r.BYMONTH.split(',').map(x => parseInt(x, 10) - 1).filter(n => n >= 0 && n <= 11) : null;
  const tz = ev.start.tz;
  let n = 0;
  const MAX_ITER = 40000;

  /** One candidate occurrence; returns false once the rule (or the window) is exhausted. */
  const startApprox = approxUtc(ev.start.wall);
  const visit = (w) => {
    if (n >= count) return false;
    const approx = approxUtc(w);
    if (approx < startApprox) return true; // same zone: wall order = time order; not an occurrence yet
    if (approx - ZONE_SLACK > to || approx - ZONE_SLACK > until) return false;
    n++; // COUNT counts every occurrence since DTSTART, also those before the window
    if (approx + ZONE_SLACK + dur < from) return true; // far before the window: no exact conversion needed
    const ts = wallToUtc(w, tz);
    if (ts > until || ts > to) return false;
    push(ts);
    return true;
  };

  if (r.FREQ === 'DAILY' || r.FREQ === 'WEEKLY') {
    const days = r.FREQ === 'WEEKLY' ? (byDay ? byDay.map(b => b.day) : [weekdayOf(ev.start.wall)]) : null;
    const startOffset = (weekdayOf(ev.start.wall) + 6) % 7; // WKST=MO
    for (let i = 0; i < MAX_ITER; i++) {
      const w = addDaysWall(ev.start.wall, i);
      let include;
      if (r.FREQ === 'DAILY') include = i % interval === 0 && (!byDay || byDay.some(b => b.day === weekdayOf(w))) && (!byMonth || byMonth.includes(w.mo));
      else {
        const weekIdx = Math.floor((i + startOffset) / 7);
        include = weekIdx % interval === 0 && days.includes(weekdayOf(w));
      }
      if (!include) continue;
      if (!visit(w)) break;
    }
  } else if (r.FREQ === 'MONTHLY' || r.FREQ === 'YEARLY') {
    const s0 = ev.start.wall;
    const monthly = r.FREQ === 'MONTHLY';
    outer:
    for (let i = 0; i < MAX_ITER / 10; i++) {
      // MONTHLY: every INTERVAL months (optionally limited to BYMONTH);
      // YEARLY: every INTERVAL years, in the BYMONTH months (default: DTSTART's month).
      const months = [];
      if (monthly) {
        const t = new Date(Date.UTC(s0.y, s0.mo + i * interval, 1));
        if (!byMonth || byMonth.includes(t.getUTCMonth())) months.push([t.getUTCFullYear(), t.getUTCMonth()]);
      } else {
        const y = s0.y + i * interval;
        for (const mo of (byMonth || [s0.mo]).slice().sort((a, b) => a - b)) months.push([y, mo]);
      }
      for (const [y, mo] of months) {
        // A Feb 1st meeting must not stop the month loop: check the window per month.
        if (approxUtc({ y, mo, d: 1, h: 0, mi: 0, s: 0 }) - ZONE_SLACK > Math.min(to, until)) break outer;
        for (const d of monthDays(y, mo, s0.d, byDay, byMonthDay)) {
          if (!visit({ y, mo, d, h: s0.h, mi: s0.mi, s: s0.s })) break outer;
        }
      }
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
