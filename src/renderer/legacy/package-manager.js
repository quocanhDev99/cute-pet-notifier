/**
 * Character Package Manager
 * Discovers character packages, validates manifest, and manages runtime character metadata.
 */

export class CharacterPackageManager {
  constructor() {
    this.manifest = null;
    this.activeCharacterId = 'cat_mochi';
    this.characterCache = new Map();
  }

  async init() {
    try {
      const res = await fetch('./assets/pet-manifest.json');
      if (res.ok) {
        this.manifest = await res.json();
      }
    } catch (err) {
      console.warn('[PackageManager] Could not load pet-manifest.json, using fallback registry:', err.message);
      this.manifest = {
        characters: [
          { id: 'cat_mochi', name: 'Mèo Mochi', species: 'scottish_fold', status: 'pilot', productionReady: true },
          { id: 'dog_boba', name: 'Chó Boba', species: 'corgi', status: 'planned', productionReady: false },
          { id: 'bunny_cloud', name: 'Thỏ Cloud', species: 'netherland_dwarf', status: 'planned', productionReady: false },
          { id: 'penguin_pip', name: 'Chim cánh cụt Pip', species: 'baby_penguin', status: 'planned', productionReady: false }
        ]
      };
    }
  }

  getCharacters() {
    return this.manifest ? this.manifest.characters : [];
  }

  getActiveCharacter() {
    const list = this.getCharacters();
    return list.find(c => c.id === this.activeCharacterId) || list[0];
  }

  setActiveCharacter(id) {
    this.activeCharacterId = id;
  }
}

