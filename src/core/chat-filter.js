/**
 * Chat notification mode (Settings → chat.mode):
 *   all       — every chat message shows a card (default).
 *   mentions  — only messages that mention you by name, @all/@everyone/@channel/@here, or that
 *               the app itself marks as a mention ("mentioned you", "đã nhắc đến bạn"…);
 *               1-1 direct messages still show when chat.includeDirect is on.
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
const GROUP_BODY_RE = /^[^:\n]{1,40}:\s/;

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

/** true / false when known; for OS notifications a best-effort guess. */
function isDirect(item) {
  if (typeof item.chatDirect === 'boolean') return item.chatDirect;
  if (GROUP_BODY_RE.test(String(item.message || ''))) return false;
  if (/ — /.test(String(item.title || ''))) return false; // "Group — subtitle" from Notification Center
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
  const show = m.mentioned || (cfg.includeDirect !== false && direct);
  return { chat: true, show, ...m, direct, reason: show ? null : 'not_mentioned' };
}

module.exports = { chatDecision, mentionInfo, isDirect, isChat, fold, CHAT_APPS };
