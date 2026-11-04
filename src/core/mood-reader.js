/**
 * Mood reader — guesses the emotion of a message from its content, fully on-device.
 *
 * Signals (each adds points to an emotion):
 *   • emoji            😁🎉 happy/excited · ❤️🙏 love · 😡 angry · 😭 sad · 😮 surprised · 🤔 thinking
 *   • words & phrases  Vietnamese (with or without accents) + English
 *   • negation         "không ổn", "chưa được", "not good" → sad instead of happy
 *   • intensity        "!!!" / ALL-CAPS amplify; "??" → thinking / surprised
 * The highest score wins if it clears the sensitivity threshold; otherwise `null`
 * (the engine then falls back to app defaults / personality as before).
 */
/** Fold accents char-by-char so indexes stay aligned with the original text (for readable reasons). */
const foldAligned = (s) => s.split('').map((c) => { const f = fold(c); return f.length === 1 ? f : (f[0] || ' '); }).join('');
const fold = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

const EMOJI = {
  happy: ['😀', '😃', '😄', '😁', '😆', '😊', '🙂', '☺', '😌', '👍', '👌', '✅', '😂', '🤣', '😹', '😸', '🆗', '💯'],
  excited: ['🎉', '🥳', '🔥', '🚀', '🤩', '✨', '🎊', '⚡', '🙌', '💪', '😎'],
  love: ['😍', '🥰', '😘', '❤', '💕', '💖', '💗', '💓', '💞', '💝', '🫶', '🙏', '🤗', '😻', '💐', '🌹'],
  surprised: ['😮', '😯', '😲', '😱', '🙀', '😳', '‼', '⁉', '🚨', '⚠', '🤯'],
  angry: ['😡', '😠', '🤬', '💢', '👿', '😤', '😾', '🖕', '🙄'],
  sad: ['😢', '😭', '😞', '😔', '😟', '🥺', '😩', '😫', '💔', '😿', '☹', '🙁', '😥', '😓'],
  thinking: ['🤔', '🧐', '❓', '❔', '🤨', '👀'],
  sleeping: ['😴', '💤', '🥱', '😪']
};

// [phrase (folded, i.e. without accents), points]
const WORDS = {
  love: [['cam on', 2], ['thank', 2], ['thanks', 2], ['tks', 1.5], ['yeu', 1.5], ['thuong', 1.2], ['tuyet voi', 1.5], ['xuat sac', 2], ['gioi qua', 2], ['great job', 2], ['well done', 2], ['awesome', 1.5], ['amazing', 1.5], ['love', 1.5], ['appreciate', 2], ['kudos', 2], ['luong ve', 2.5], ['thuong tet', 2], ['bonus', 1.5], ['chuc mung', 2], ['congrat', 2]],
  happy: [['xong roi', 1.5], ['xong', 1], ['on roi', 1.5], ['ok', 0.8], ['oke', 0.8], ['duoc roi', 1.5], ['thanh cong', 2], ['success', 1.5], ['passed', 1.5], ['done', 1], ['merged', 1.5], ['vui', 1.5], ['haha', 1.5], ['hihi', 1.5], ['hehe', 1.2], ['lol', 1], ['ngon', 1], [':)', 1], [':d', 1.5], ['resolved', 1.5], ['fixed', 1.2], ['da sua', 1.2]],
  excited: [['wow', 1.5], ['qua dinh', 2], ['dinh qua', 2], ['dinh that', 2], ['yeah', 1.5], ['yay', 1.5], ['let\'s go', 1.5], ['lets go', 1.5], ['hype', 1.5], ['sap ra mat', 1.5], ['launch', 1], ['moi ra', 1], ['tin vui', 2], ['keo', 0.8], ['party', 1.5]],
  angry: [['buc', 1.5], ['buc minh', 2.5], ['tuc', 1.2], ['dien', 1.2], ['vai', 1], ['wtf', 2], ['sao lai', 1.5], ['lai nua', 1.5], ['nua roi', 1.5], ['gap', 1.5], ['deadline', 1.5], ['qua han', 2], ['overdue', 2], ['tre han', 2], ['asap', 1.5], ['urgent', 1.5], ['chua xong', 1.5], ['ai lam', 1.5], ['ai merge', 1.5], ['sep', 1], ['again', 1], ['annoying', 2], ['kho chiu', 2]],
  sad: [['buon', 2], ['tiec', 1.5], ['xin loi', 1.5], ['sorry', 1.5], ['hong', 1.2], ['loi', 1], ['error', 1.2], ['fail', 1.5], ['failed', 1.5], ['gay', 1.5], ['gay roi', 2.5], ['sap', 1.2], ['toang', 2.5], ['khong duoc', 1.5], ['chua duoc', 1.5], ['chua on', 2], ['khong on', 2], ['khong chay', 1.5], ['bi tu choi', 2], ['rejected', 1.5], ['crash', 1.5], ['down roi', 2], ['mat du lieu', 2.5], ['huhu', 2], ['chan', 1.2], ['met', 1.2]],
  surprised: [['ha?', 1.5], ['that a', 1.5], ['that sao', 1.5], ['really', 1.2], ['omg', 2], ['troi oi', 2], ['khan', 1.5], ['canh bao', 1.5], ['warning', 1.2], ['alert', 1.2], ['bat ngo', 2], ['khong the tin', 2], ['what?', 1.5]],
  thinking: [['xem giup', 1.5], ['check giup', 1.5], ['review', 1.2], ['nghi sao', 1.5], ['y kien', 1.5], ['thac mac', 1.5], ['hoi chut', 1.5], ['lam sao', 1.5], ['tai sao', 1.2], ['how', 0.8], ['why', 0.8], ['co the', 0.6], ['duoc khong', 1.2], ['dang xu ly', 1.2], ['processing', 1], ['pending', 1]],
  sleeping: [['di ngu', 2], ['ngu ngon', 2], ['good night', 2], ['buon ngu', 2], ['mai tinh', 1.2], ['nghi phep', 1.5], ['off hom nay', 1.5]]
};
const NEGATORS = ['khong', 'chua', 'chang', 'cha', 'deo', 'ko', 'k', 'not', "n't", 'no', 'never'];
const POSITIVE = new Set(['love', 'happy', 'excited']);
const THRESHOLD = { low: 3, medium: 2, high: 1.2 };

/** Strip a leading "Sender: " (chat notifications) so names don't count as words. */
function bodyOf(item) {
  const msg = String(item.message || '').replace(/^[^:\n]{1,40}:\s+/, '');
  return `${item.title || ''}\n${msg}`;
}

/**
 * @param {{title?:string, message?:string}} item
 * @param {{sensitivity?: 'low'|'medium'|'high'}} opts
 * @returns {{ emotion: string, score: number, reasons: string[] } | null}
 */
function readMood(item, { sensitivity = 'medium' } = {}) {
  const raw = bodyOf(item).slice(0, 2000).normalize('NFC');
  const text = ` ${foldAligned(raw).replace(/[“”"]/g, ' ')} `;
  const orig = ` ${raw} `;
  const quote = (i, len) => `"${orig.slice(i, i + len).trim()}"`;
  const scores = {};
  const reasons = {};
  const add = (emo, pts, why) => { scores[emo] = (scores[emo] || 0) + pts; (reasons[emo] = reasons[emo] || []).push(why); };

  for (const [emo, list] of Object.entries(EMOJI)) {
    for (const e of list) {
      const n = raw.split(e).length - 1;
      if (n) add(emo, Math.min(n, 3) * 2, e);
    }
  }
  for (const [emo, list] of Object.entries(WORDS)) {
    for (const [phrase, pts] of list) {
      const re = new RegExp(`(^|[^a-z0-9])${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^a-z0-9])`, 'g');
      let m;
      while ((m = re.exec(text))) {
        // Negation: "khong on", "chua duoc", "not good" → sad instead of a positive emotion.
        const start = m.index + m[1].length;
        const before = text.slice(Math.max(0, start - 14), start).trim().split(/\s+/).slice(-2);
        const neg = POSITIVE.has(emo) ? before.reverse().find(w => NEGATORS.includes(w)) : null;
        if (neg) { const negAt = text.lastIndexOf(neg, start); add('sad', pts, quote(negAt, start - negAt + phrase.length)); }
        else add(emo, pts, quote(start, phrase.length));
        if (re.lastIndex === m.index) re.lastIndex++;
      }
    }
  }
  // Intensity
  const bangs = (raw.match(/!/g) || []).length;
  const caps = (raw.match(/\b[A-ZĐ]{4,}\b/g) || []).length;
  if (bangs >= 2 || caps) {
    const top = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
    const target = top && (top[0] === 'angry' || top[0] === 'excited' || top[0] === 'surprised') ? top[0] : (scores.angry ? 'angry' : 'excited');
    add(target, 1 + Math.min(bangs, 4) * 0.25 + caps * 0.5, bangs >= 2 ? '"!!"' : '"CHỮ HOA"');
  }
  if (/\?\s*\?|\?{2,}/.test(raw)) add(scores.angry ? 'angry' : 'surprised', 1, '"??"');
  else if (/\?\s*$/.test(raw.trim())) add('thinking', 1, '"?"');

  const best = Object.entries(scores).sort((a, b) => b[1] - a[1])[0];
  if (!best || best[1] < (THRESHOLD[sensitivity] || THRESHOLD.medium)) return null;
  // Readable reasons: original words, without ones contained in a longer reason ("gãy" ⊂ "gãy rồi").
  const uniq = [...new Set(reasons[best[0]])];
  const clean = uniq.filter(r => !uniq.some(o => o !== r && o.toLowerCase().includes(r.replace(/"/g, '').toLowerCase())));
  return { emotion: best[0], score: Math.round(best[1] * 10) / 10, reasons: clean.slice(0, 3) };
}

module.exports = { readMood, fold, THRESHOLD };
