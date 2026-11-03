/**
 * Character identity sheets — invariant look for every character.
 * The parametric builder turns these into a rig with the blueprint bone names
 * (root, spine, chest, neck, head, arm_L/R, paw_L/R, leg_L/R, foot_L/R, tail_01, ear_L/R),
 * so the Emotion Animator works for every character without core changes.
 */
export const SPECIES = {
  cat_mochi: {
    id: 'cat_mochi',
    name: 'Mèo Mochi',
    sound: 'meow',
    colors: {
      fur: 0xF6A35E,      // pastel orange
      furDark: 0xE07F3C,  // stripes
      cream: 0xFFF1DC,
      pink: 0xFF9FB0,
      nose: 0xF2788F,
      blush: 0xFF8FA3,
      accent: 0xE23B55,   // red ribbon
      accent2: 0xF5C542   // gold bell
    },
    body: { width: 1.0, height: 1.0, legLength: 1.0 },
    head: { width: 1.14, height: 0.96 },
    ears: 'fold',
    tail: 'cat',
    muzzle: true,
    stripes: true,
    accessory: 'collar_bell',
    arms: 'paws'
  },
  dog_boba: {
    id: 'dog_boba',
    name: 'Chó Boba',
    sound: 'woof',
    colors: {
      fur: 0xEDAA4C,      // golden honey
      furDark: 0xD48E33,
      cream: 0xFFFDF8,    // snow white
      pink: 0xFFB3B8,
      nose: 0x3B2A26,
      blush: 0xFF9DA8,
      accent: 0x8FD3F5,   // light blue bandana
      accent2: 0xFFFFFF
    },
    body: { width: 1.12, height: 0.92, legLength: 0.7 },
    head: { width: 1.1, height: 0.95 },
    ears: 'pointy',
    tail: 'stub',
    muzzle: true,
    beanBrows: true,
    accessory: 'bandana',
    arms: 'paws'
  },
  bunny_cloud: {
    id: 'bunny_cloud',
    name: 'Thỏ Cloud',
    sound: 'squeak',
    colors: {
      fur: 0xFFFCFA,
      furDark: 0xF3ECEA,
      cream: 0xFFFFFF,
      pink: 0xFFC1B0,     // peach ear tips
      nose: 0xFF9AA8,
      blush: 0xFF9DB0,
      accent: 0x7BC96F,   // sprout
      accent2: 0x4FA548
    },
    body: { width: 1.04, height: 1.0, legLength: 0.85 },
    head: { width: 1.06, height: 1.0 },
    ears: 'long',
    tail: 'puff',
    muzzle: false,
    accessory: 'sprout',
    arms: 'paws',
    blushStrength: 1.0
  },
  penguin_pip: {
    id: 'penguin_pip',
    name: 'Penguin Pip',
    sound: 'chirp',
    colors: {
      fur: 0x7F95B5,      // pastel slate-blue
      furDark: 0x6A7F9E,
      cream: 0xFFFFFF,    // belly
      pink: 0xFFB0B8,
      nose: 0xFF9A3D,     // beak / feet orange
      blush: 0xFF9DB0,
      accent: 0xF7C948,   // yellow beanie
      accent2: 0xFFE08A
    },
    body: { width: 1.06, height: 1.1, legLength: 0.6 },
    head: { width: 1.0, height: 1.0 },
    ears: 'none',
    tail: 'none',
    muzzle: false,
    beak: true,
    faceMask: true,
    accessory: 'beanie',
    arms: 'flippers'
  }
};

export function getSpecies(id) {
  return SPECIES[id] || SPECIES.cat_mochi;
}
