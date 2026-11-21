/**
 * Semantic mapping for production GLB characters (Animation Guide §A2, Blender Guide §5–7).
 * The core engine never depends on hard-coded bone names: each character's pet.json may
 * provide `semanticMap`, `clipAliases` and `morphMap`; these defaults are only heuristics.
 */

export const DEFAULT_SEMANTIC_MAP = {
  root: ['root', 'armature', 'rig'],
  body: ['spine', 'body', 'chest', 'torso', 'hips'],
  head: ['head'],
  neck: ['neck'],
  limbs_front: ['arm_l', 'arm_r', 'shoulder_l', 'shoulder_r', 'paw_l', 'paw_r', 'flipper_l', 'flipper_r', 'wing_l', 'wing_r'],
  limbs_hind: ['leg_l', 'leg_r', 'foot_l', 'foot_r', 'thigh_l', 'thigh_r'],
  ears: ['ear_l', 'ear_r', 'ear'],
  tail: ['tail_01', 'tail', 'tail_1'],
  accessories: ['accessory_bell', 'bell', 'bow', 'beanie', 'hat', 'bandana', 'pompom']
};

/**
 * Runtime state → accepted clip names. Includes the production clip names of
 * docs/character-production/07 + 03 (`idle_breathing`, `emotion_happy`, `interaction_pet`,
 * `sleep_loop`…), so a GLB authored to that spec plays without a per-character clipAliases.
 * Spec clips with no runtime state yet (idle_look_around, idle_slow_blink, idle_head_tilt,
 * idle_weight_shift, sleep_enter, sleep_wakeup) are listed in 00_AUDIT_AND_TASKS.md (CP-06/CP-07).
 */
export const DEFAULT_CLIP_ALIASES = {
  idle: ['idle', 'Idle', 'idle_breathing', 'idle_breathe', 'breathe', 'stand'],
  sleeping: ['sleeping', '08_sleeping', 'emotion_sleeping', 'sleep_loop', 'sleep'],
  happy: ['happy', '01_happy', 'emotion_happy'],
  excited: ['excited', '02_excited', 'emotion_excited'],
  love: ['love', '03_love', 'emotion_love'],
  surprised: ['surprised', '04_surprised', 'emotion_surprised', 'startle'],
  angry: ['angry', '05_angry', 'emotion_angry'],
  sad: ['sad', '06_sad', 'emotion_sad'],
  thinking: ['thinking', '07_thinking', 'emotion_thinking', 'think'],
  hold_card: ['hold_card', 'holdcard', 'billboard', 'hug'],
  peeker: ['peeker', 'peek'],
  cling: ['cling', 'notification_attach', 'peeker', 'peek'],
  resting: ['resting', 'chin_rest', 'notification_rest', 'peeker', 'peek'],
  courierRun: ['courier', 'run'],
  courierPresent: ['courier_present', 'present', 'hold_card'],
  pet: ['pet', 'interaction_pet', 'interaction_head_rub', 'petted', 'purr'],
  reject: ['reject', 'dodge'],
  kick: ['kick'],
  wave: ['wave'],
  grabbed: ['grabbed', 'interaction_pickup', 'grab', 'held', 'dangle'],
  land: ['land', 'interaction_release', 'landing'],
  feed: ['feed'],
  transition: ['transition']
};

/** Facial shape-key weights per state (Blender Guide §6.1). */
export const DEFAULT_MORPH_MAP = {
  idle: {},
  happy: { eye_happy: 1, mouth_smile: 1 },
  excited: { eye_wide: 0.6, mouth_smile: 1 },
  love: { eye_happy: 1, mouth_smile: 0.6, cheek_puff: 0.3 },
  surprised: { eye_wide: 1, mouth_open: 1 },
  angry: { eye_squint: 1, mouth_pout: 1, cheek_puff: 1 },
  sad: { eye_squint: 0.3, mouth_pout: 0.4 },
  thinking: { eye_squint: 0.25 },
  sleeping: { eye_blink: 1 },
  grabbed: { eye_wide: 1, mouth_open: 1 },
  pet: { eye_happy: 1, mouth_smile: 1, cheek_puff: 0.4 }
};

const EMOTION_ORDER = ['happy', 'excited', 'love', 'surprised', 'angry', 'sad', 'thinking', 'sleeping'];

export function normalizeName(n) {
  return String(n || '').toLowerCase().replace(/^(mixamorig:|def[-_]|org[-_]|mch[-_])/, '').replace(/\.\d+$/, '').replace(/[\s.]/g, '_');
}

/** Resolve semantic groups → first matching node (bones preferred). Missing groups map to null. */
export function resolveSemanticBones(scene, semanticMap = {}) {
  const map = { ...DEFAULT_SEMANTIC_MAP, ...(semanticMap || {}) };
  const nodes = [];
  scene.traverse(o => { if (o.name) nodes.push(o); });
  nodes.sort((a, b) => (b.isBone ? 1 : 0) - (a.isBone ? 1 : 0));
  const out = {};
  for (const [group, candidates] of Object.entries(map)) {
    const cands = (Array.isArray(candidates) ? candidates : [candidates]).map(normalizeName);
    let found = null;
    for (const c of cands) { found = nodes.find(n => normalizeName(n.name) === c); if (found) break; }
    if (!found) for (const c of cands) { found = nodes.find(n => normalizeName(n.name).startsWith(c)); if (found) break; }
    out[group] = found || null;
  }
  return out;
}

/** Find the GLB clip for a runtime state via aliases (case-insensitive). */
export function resolveClip(clips, state, aliases = {}) {
  if (!clips || !clips.length || !state) return null;
  const list = [...((aliases || {})[state] || []), ...(DEFAULT_CLIP_ALIASES[state] || []), state].map(normalizeName);
  for (const a of list) { const c = clips.find(x => normalizeName(x.name) === a); if (c) return c; }
  return null;
}

/** Morph target weights for a state, or null if the map has nothing for it. */
export function morphWeightsFor(state, morphMap = {}) {
  const map = { ...DEFAULT_MORPH_MAP, ...(morphMap || {}) };
  const w = { ...(map[state] || {}) };
  // Also drive shape keys named after the emotion itself ("happy" or "01_happy").
  const idx = EMOTION_ORDER.indexOf(state);
  if (idx >= 0) { w[state] = 1; w[`0${idx + 1}_${state}`] = 1; }
  return Object.keys(w).length ? w : null;
}
