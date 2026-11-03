/**
 * Shared Emotion Schema — the ONE canonical emotion schema used by main process,
 * overlay renderer and Control Center. CommonJS so it can be `require`d by the
 * main process and bundled by esbuild for the renderers.
 */

const CANONICAL_EMOTIONS = Object.freeze({
  HAPPY: 'happy',
  EXCITED: 'excited',
  LOVE: 'love',
  SURPRISED: 'surprised',
  ANGRY: 'angry',
  SAD: 'sad',
  THINKING: 'thinking',
  SLEEPING: 'sleeping'
});

const EMOTION_IDS = Object.freeze(Object.values(CANONICAL_EMOTIONS));

const EMOTION_SCHEMA = Object.freeze([
  { assetKey: '01_happy', id: 'happy', label: 'Vui vẻ', emoji: '😸', meaning: 'Hoàn thành tác vụ' },
  { assetKey: '02_excited', id: 'excited', label: 'Hào hứng', emoji: '🤩', meaning: 'Tin nhắn mới' },
  { assetKey: '03_love', id: 'love', label: 'Yêu thương', emoji: '💖', meaning: 'Khen ngợi / Lương về' },
  { assetKey: '04_surprised', id: 'surprised', label: 'Bất ngờ', emoji: '😲', meaning: 'Cảnh báo gấp' },
  { assetKey: '05_angry', id: 'angry', label: 'Cáu kỉnh', emoji: '😾', meaning: 'Deadline sát nút' },
  { assetKey: '06_sad', id: 'sad', label: 'Buồn bã', emoji: '😿', meaning: 'Lỗi hệ thống' },
  { assetKey: '07_thinking', id: 'thinking', label: 'Suy tư', emoji: '🤔', meaning: 'Đang xử lý' },
  { assetKey: '08_sleeping', id: 'sleeping', label: 'Ngủ say', emoji: '😴', meaning: 'Họp / Không làm phiền' }
]);

const NOTIFICATION_EVENT_MAPPINGS = Object.freeze({
  TASK_DONE: 'happy',
  NEW_PING: 'excited',
  KUDOS: 'love',
  WARNING: 'surprised',
  OVERDUE: 'angry',
  ERROR: 'sad',
  LOADING: 'thinking',
  IDLE_DND: 'sleeping'
});

const PRESENTATION_MODES = Object.freeze(['billboard', 'peeker', 'courier']);

const POSITIONS = Object.freeze([
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right'
]);

function isEmotion(id) {
  return EMOTION_IDS.includes(id);
}

module.exports = {
  CANONICAL_EMOTIONS,
  EMOTION_IDS,
  EMOTION_SCHEMA,
  NOTIFICATION_EVENT_MAPPINGS,
  PRESENTATION_MODES,
  POSITIONS,
  isEmotion
};
