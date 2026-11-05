/**
 * Privacy Display Mode — ONE place that decides what of a notification may be shown or kept.
 *
 *   full_content           source + title + body (+ rows/actions)
 *   masked                 source + title with each word reduced to its first letter; body hidden
 *   source_only            "New message from Teams" — no title, body, sender, rows or actions
 *   anonymous_source_only  "You have a new notification" — not even the app
 *
 * Policy: the stricter of the global mode and the per-app rule wins, so a per-app setting can
 * never reveal content while a strict global mode is on. The projection runs inside the pipeline
 * BEFORE the item reaches the overlay, the Control Center (SSE), history or the persisted Inbox,
 * so hidden content is never rendered, stored, or logged. Inline actions (Approve) are removed
 * whenever content is hidden: you can't verify what you would approve.
 */
const MODES = ['full_content', 'masked', 'source_only', 'anonymous_source_only'];
const RANK = { full_content: 0, masked: 1, source_only: 2, anonymous_source_only: 3 };
const CHATTY = new Set(['teams', 'slack', 'zalo', 'messenger', 'messages', 'telegram', 'discord', 'whatsapp', 'viber', 'line', 'skype', 'signal', 'wechat']);

const T = {
  vi: { hidden: '🔒 Nội dung đã ẩn', newMsg: (a) => `Tin nhắn mới từ ${a}`, newNote: (a) => `Thông báo mới từ ${a}`, anon: 'Bạn có thông báo mới', many: (n, a) => `${n} thông báo mới từ ${a}`, manyAnon: (n) => `${n} thông báo mới` },
  en: { hidden: '🔒 Content hidden', newMsg: (a) => `New message from ${a}`, newNote: (a) => `New notification from ${a}`, anon: 'You have a new notification', many: (n, a) => `${n} new notifications from ${a}`, manyAnon: (n) => `${n} new notifications` }
};

/** Stricter of global mode and per-app rule. */
function effectiveMode(item, settings) {
  const p = (settings && settings.privacy) || {};
  const global = MODES.includes(p.displayMode) ? p.displayMode : 'full_content';
  const app = String(item.app || '').toLowerCase();
  const perApp = (p.hiddenApps || []).map(x => String(x).toLowerCase()).includes(app) ? 'source_only' : 'full_content';
  return RANK[perApp] > RANK[global] ? perApp : global;
}

/** "Sprint review tomorrow" → "S••• r••• t•••" (keeps emoji/numbers' shape, hides words). */
function mask(text) {
  return String(text || '').split(/(\s+)/).map((w) => (/\s/.test(w) || !w ? w : `${Array.from(w)[0]}•••`)).join('');
}

/**
 * @returns {object} a NEW item safe to display/store under `mode` (the input is not modified).
 */
function project(item, mode, lang = 'vi') {
  if (!mode || mode === 'full_content') return item;
  const t = T[lang === 'en' ? 'en' : 'vi'];
  const appLabel = item.appName || (item.app && item.app !== 'default' ? item.app : '') || (lang === 'en' ? 'an app' : 'ứng dụng');
  const count = item.group && Array.isArray(item.members) ? item.members.length : 0;
  const out = {
    ...item,
    privacy: mode,
    message: '',
    items: [],
    moreCount: 0,
    actions: [],
    meta: null, // ticket key / status / labels are content too
    rule: 'hidden', reasons: undefined, // classification details may quote the message
    members: Array.isArray(item.members) ? item.members.map(m => project(m, mode, lang)) : item.members
  };
  if (mode === 'masked') {
    out.title = mask(item.title);
    out.message = item.message ? t.hidden : '';
  } else if (mode === 'source_only') {
    out.title = count ? t.many(count, appLabel) : CHATTY.has(String(item.app)) ? t.newMsg(appLabel) : t.newNote(appLabel);
  } else { // anonymous_source_only
    out.title = count ? t.manyAnon(count) : t.anon;
    out.app = 'default';
    out.appName = null;
    out.sourceApplication = 'default';
    out.url = null; // the URL can reveal the app (and sometimes the content)
  }
  return out;
}

module.exports = { effectiveMode, project, mask, MODES, RANK };
