/**
 * Deep links for macOS Notification Center records: turn the userInfo payload that the
 * source app attached to its notification (`req.usda`, an NSKeyedArchiver plist) into a URL
 * that opens the exact conversation/message — instead of just bringing the app forward.
 *
 * Only allow-listed URL schemes are ever returned (no file:, javascript:, shell…).
 */
const { parseBplist } = require('./bplist');

const SAFE_SCHEMES = ['https', 'http', 'msteams', 'slack', 'tg', 'discord', 'whatsapp', 'zoommtg', 'message', 'notion', 'spotify', 'ms-outlook', 'zalo', 'fb-messenger'];

/** Decode an NSKeyedArchiver bplist (dictionaries, arrays, strings, numbers) into plain JS. */
function unarchive(buf) {
  let arch;
  try { arch = Buffer.isBuffer(buf) ? parseBplist(buf) : buf; } catch { return null; }
  if (!arch || !arch.$objects || !arch.$top) return arch && typeof arch === 'object' ? arch : null;
  const objs = arch.$objects;
  const resolve = (u, depth = 0) => {
    if (depth > 16) return null;
    const o = u && typeof u === 'object' && 'uid' in u ? objs[u.uid] : u;
    if (o === '$null') return null;
    if (o && typeof o === 'object' && !Buffer.isBuffer(o)) {
      if (Array.isArray(o['NS.keys'])) {
        const out = {};
        o['NS.keys'].forEach((k, i) => { out[String(resolve(k, depth + 1))] = resolve(o['NS.objects'][i], depth + 1); });
        return out;
      }
      if (Array.isArray(o['NS.objects'])) return o['NS.objects'].map(x => resolve(x, depth + 1));
      if (o['NS.string'] !== undefined) return o['NS.string'];
      if (o['NS.relative'] !== undefined) return resolve(o['NS.relative'], depth + 1); // NSURL
    }
    return o;
  };
  const top = arch.$top.root || Object.values(arch.$top)[0];
  return resolve(top);
}

function safeUrl(u) {
  if (typeof u !== 'string' || u.length > 2000) return null;
  const m = u.match(/^([a-z][a-z0-9+.-]*):/i);
  if (!m || !SAFE_SCHEMES.includes(m[1].toLowerCase())) return null;
  if (/[\s"'`<>\\]/.test(u)) return null;
  return u;
}

/** Flatten userInfo, expanding JSON-encoded string values (Teams stores options as JSON). */
function flatten(obj, out = {}, prefix = '', depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 6) return out;
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string' && /^\s*[{[]/.test(v)) {
      try { flatten(JSON.parse(v), out, key, depth + 1); continue; } catch { /* plain string */ }
    }
    if (v && typeof v === 'object' && !Buffer.isBuffer(v)) flatten(v, out, key, depth + 1);
    else out[key] = v;
  }
  return out;
}

const pick = (flat, re) => { for (const [k, v] of Object.entries(flat)) if (re.test(k) && v !== null && v !== undefined && v !== '') return String(v); return null; };

function teamsLink(flat) {
  const conv = pick(flat, /(^|\.)(convId|default_id|threadId|conversationId)$/i);
  const msg = pick(flat, /(^|\.)(messageId|default_options\.messageId)$/i);
  if (!conv || !/^[\w:@.\-=]+$/.test(conv)) return null;
  const isChannel = /@thread\.(tacv2|skype)$/i.test(conv);
  const context = encodeURIComponent(JSON.stringify({ contextType: isChannel ? 'channel' : 'chat' }));
  if (msg && /^\d+$/.test(msg)) return `msteams:/l/message/${conv}/${msg}?context=${context}`;
  return `msteams:/l/chat/0/0?conversationId=${encodeURIComponent(conv)}`;
}

function slackLink(flat) {
  const team = pick(flat, /(^|\.)(team|team_id|teamId)$/i);
  const channel = pick(flat, /(^|\.)(channel|channel_id|channelId)$/i);
  const ts = pick(flat, /(^|\.)(thread_ts|ts|message_ts)$/i);
  if (!team || !channel || !/^[A-Z0-9]+$/.test(team) || !/^[A-Z0-9]+$/.test(channel)) return null;
  return `slack://channel?team=${team}&id=${channel}${ts && /^\d+\.\d+$/.test(ts) ? `&message=${ts}` : ''}`;
}

/**
 * @param {string} bundleId
 * @param {object} req  record.req from the Notification Center plist
 * @returns {{url: string|null, kind: 'message'|'link'|null}}
 */
function deepLinkFor(bundleId, req = {}) {
  const info = req.usda ? unarchive(req.usda) : null;
  const flat = flatten(info || {});
  let url = null;
  if (/microsoft\.teams/i.test(bundleId)) url = teamsLink(flat);
  else if (/slack/i.test(bundleId)) url = slackLink(flat);
  if (!url) {
    // Generic: an explicit URL the app attached (e.g. Mail "message://", Chrome web push https URL).
    for (const v of Object.values(flat)) { const u = safeUrl(v); if (u) { url = u; break; } }
  }
  if (!url && typeof req.durl === 'string') url = safeUrl(req.durl);
  return { url: safeUrl(url), kind: url ? (/msteams|slack|tg|discord|whatsapp|message:/.test(url) ? 'message' : 'link') : null };
}

module.exports = { deepLinkFor, unarchive, flatten, safeUrl, SAFE_SCHEMES };
