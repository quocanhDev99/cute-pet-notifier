/**
 * Chat notification mode (Settings → chat.mode):
 *   all       — every chat message shows a card (default).
 *   mentions  — only messages that mention you by name, @all/@everyone/@channel/@here, or that
 *               the app itself marks as a mention ("mentioned you", "đã nhắc đến bạn"…);
 *               1-1 direct messages also show (chat.includeDirect, on by default).
 * Everything else goes to the Inbox (reason "not_mentioned") — nothing is lost.
 *
 * Name matching is accent/case-insensitive. Multi-word names ("Mai Pham") match as a phrase;
 * single-word names must be written with "@" ("@Mai") because short Vietnamese names are also
 * everyday words ("mai" = tomorrow, "anh", "em"…) and would otherwise fire constantly.
 */
const CHAT_APPS = new Set(['teams', 'slack', 'zalo', 'messenger', 'messages', 'telegram', 'discord', 'whatsapp', 'viber', 'line', 'skype', 'signal', 'wechat', 'kakaotalk', 'googlechat', 'chat', 'mattermost', 'rocketchat', 'lark', 'larksuite']);

const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const ALL_RE = /(^|[\s(,.;:!?])@(all|everyone|channel|here|team|tat ca|moi nguoi|ca nhom)(?=$|[\s),.;:!?])/;
const APP_MENTION_RE = /\b(mentioned you|mentioned everyone|tagged you|replied to you|reacted to your|da nhac den ban|nhac den ban|da nhac ban|da gan the ban|da tra loi ban|tra loi tin nhan cua ban)\b/;
// "Sender: text" bodies are typical for group conversations in OS notifications.
const SENDER_PREFIX_RE = /^([^:\n]{1,40}):\s/;
// Prefixes that look like "Label: …" inside a 1-1 message, not a sender name.
const LABEL_WORDS = new Set(['note', 'notes', 'fyi', 'ps', 're', 'fw', 'fwd', 'update', 'todo', 'link', 'url', 'error', 'warning', 'info', 'tip', 'q', 'a', 'luu y', 'chu y', 'nhac', 'nhac nho', 'cap nhat', 'ghi chu', 'tom tat', 'ket qua', 'loi', 'van de', 'cau hoi', 'tra loi', 'vi du', 'gio', 'dia chi', 'thoi gian', 'deadline', 'task', 'bug', 'pr']);
// Titles that name a channel / group rather than a person.
const GROUP_TITLE_RE = /(^#|\s(in|trong)\s#|\bgroup\b|\bnhom\b|\bchannel\b|\bkenh\b|\(\d+\)$)/;
// Apps' own 1-1 markers ("sent you a message", "đã gửi cho bạn"…).
const DIRECT_HINT_RE = /\b(sent you|messaged you|direct message|tin nhan rieng|da gui cho ban|gui cho ban|nhan tin cho ban|new message from)\b/;

/** "Khanh: hi" → "Khanh" when the prefix looks like a person's name, else null. */
function senderPrefix(message) {
  const m = SENDER_PREFIX_RE.exec(String(message || ''));
  if (!m) return null;
  const raw = m[1].trim();
  const f = fold(raw);
  if (!raw || LABEL_WORDS.has(f) || /https?$|\d{2,}|[\/\\@#]/.test(f)) return null;
  const words = raw.split(/\s+/);
  if (words.length > 5) return null;
  return raw;
}

function isChat(item) { return item.category === 'chat' || CHAT_APPS.has(String(item.app || '').toLowerCase()); }

/** Did this message mention the user (by one of their names, @all…, or the app's own marker)? */
function mentionInfo(item, names = []) {
  const text = fold(`${item.title || ''}\n${item.message || ''}`);
  if (item.chatMention === true) return { mentioned: true, by: 'app' };
  if (ALL_RE.test(text)) return { mentioned: true, by: 'all' };
  if (APP_MENTION_RE.test(text)) return { mentioned: true, by: 'app' };
  for (const raw of names) {
    const n = fold(raw).replace(/^@+/, '').trim();
    if (!n) continue;
    const multi = /\s/.test(n);
    const re = multi
      ? new RegExp(`(^|[^a-z0-9])@?${esc(n).replace(/\s+/g, '\\s+')}(?=$|[^a-z0-9])`)
      : new RegExp(`(^|[^a-z0-9])@${esc(n)}(?=$|[^a-z0-9])`);
    if (re.test(text)) return { mentioned: true, by: 'name' };
  }
  return { mentioned: false, by: null };
}

/**
 * Is this a 1-1 (direct) conversation? Exact when the source says so (Slack), otherwise a
 * best-effort guess from the shape of OS notifications:
 *   1-1   → title = the person, body = the text            ("Ban A" / "rảnh không?")
 *   group → title = the group, body = "Sender: text"        ("Nhom Du An" / "Ban A: …")
 *           or "Group — Sender" titles, "#channel" titles.
 */
function isDirect(item) {
  if (typeof item.chatDirect === 'boolean') return item.chatDirect;
  const title = String(item.title || '');
  const ft = fold(title);
  if (DIRECT_HINT_RE.test(fold(`${title}\n${item.message || ''}`))) return true;
  if (/ — /.test(title)) return false; // "Group — subtitle" from Notification Center
  if (GROUP_TITLE_RE.test(ft)) return false;
  const sender = senderPrefix(item.message);
  // "Ban A" / "Ban A: hi" — some apps repeat the sender's name in a 1-1 chat.
  if (sender) return fold(sender) === ft;
  return true;
}

/**
 * @returns {{ chat: boolean, show: boolean, mentioned: boolean, by: string|null, direct: boolean, reason: string|null }}
 */
function chatDecision(item, settings) {
  const cfg = (settings && settings.chat) || {};
  if (!isChat(item)) return { chat: false, show: true, mentioned: false, by: null, direct: false, reason: null };
  const m = mentionInfo(item, cfg.names || []);
  const direct = isDirect(item);
  if (cfg.mode !== 'mentions') return { chat: true, show: true, ...m, direct, reason: null };
  // "Only when it's about me": mentions, and 1-1 messages (someone is talking to you directly).
  const show = m.mentioned || (cfg.includeDirect !== false && direct);
  return { chat: true, show, ...m, direct, reason: show ? null : 'not_mentioned' };
}

module.exports = { chatDecision, mentionInfo, isDirect, isChat, fold, CHAT_APPS };
