// High quality SVG vector sprites with rich emotions (Grumpy, Sleepy, Side-eye, Happy, Curious)
// and Holding Paws for Cat and Dog.

const Sprites = {
  /**
   * Cat Sprite Generator with Moods
   */
  getCatSvg: function(mood = 'curious') {
    let eyesSvg = '';
    let extraSvg = '';
    let mouthSvg = '<path d="M74 35 Q 76 37 78 35" fill="none" stroke="#78281F" stroke-width="1.2" stroke-linecap="round" />';

    if (mood === 'grumpy') {
      // Cáu kỉnh, bốc khói, nhíu mày tức giận
      eyesSvg = `
        <!-- Angry Eyebrows -->
        <path d="M69 24 L 75 27" stroke="#78281F" stroke-width="2" stroke-linecap="round" />
        <path d="M83 24 L 77 27" stroke="#78281F" stroke-width="2" stroke-linecap="round" />
        <!-- Sharp Angry Eyes -->
        <circle cx="72" cy="28" r="2.2" fill="#78281F" />
        <circle cx="80" cy="28" r="2.2" fill="#78281F" />
      `;
      mouthSvg = '<path d="M74 36 Q 76 33 78 36" fill="none" stroke="#78281F" stroke-width="1.5" stroke-linecap="round" />';
      extraSvg = `
        <!-- Anime Angry Vein 💢 -->
        <g class="angry-vein" transform="translate(86, 12) scale(0.65)">
          <path d="M2 7 C2 2 7 2 7 7 C7 12 2 12 2 7 Z" fill="none" stroke="#E74C3C" stroke-width="2.5" />
          <path d="M7 2 C12 2 12 7 7 7" fill="none" stroke="#E74C3C" stroke-width="2.5" />
          <path d="M7 12 C12 12 12 7 7 7" fill="none" stroke="#E74C3C" stroke-width="2.5" />
        </g>
      `;
    } else if (mood === 'sleepy') {
      // Mắt híp lờ đờ, ngáp ngủ
      eyesSvg = `
        <!-- Droopy Sleepy Eyes -->
        <path d="M69 28 Q 72 31 75 28" fill="none" stroke="#2C3E50" stroke-width="2" stroke-linecap="round" />
        <path d="M77 28 Q 80 31 83 28" fill="none" stroke="#2C3E50" stroke-width="2" stroke-linecap="round" />
      `;
      // Yawn open mouth
      mouthSvg = '<ellipse cx="76" cy="35" rx="3" ry="4" fill="#C0392B" /><ellipse cx="76" cy="36" rx="2" ry="1.5" fill="#F1948A" />';
      extraSvg = `
        <!-- Floating Zzz -->
        <g class="sleepy-zzz">
          <text x="84" y="16" font-size="9" font-weight="bold" fill="#8E44AD" opacity="0.9">Z</text>
          <text x="90" y="11" font-size="7" font-weight="bold" fill="#9B59B6" opacity="0.8">z</text>
        </g>
      `;
    } else if (mood === 'side-eye') {
      // Lườm liếc xéo khinh bỉ sang một bên
      eyesSvg = `
        <!-- Suspicious Side-eye -->
        <ellipse cx="72" cy="27" rx="3.5" ry="2" fill="#FFFFFF" stroke="#2C3E50" stroke-width="0.8" />
        <ellipse cx="80" cy="27" rx="3.5" ry="2" fill="#FFFFFF" stroke="#2C3E50" stroke-width="0.8" />
        <!-- Pupils shifted far left looking suspiciously at the card -->
        <circle cx="70" cy="27" r="1.6" fill="#1A252F" />
        <circle cx="78" cy="27" r="1.6" fill="#1A252F" />
        <!-- Raised disdainful eyebrow -->
        <path d="M69 23 Q 72 21 75 24" fill="none" stroke="#78281F" stroke-width="1.2" stroke-linecap="round" />
        <path d="M77 24 Q 80 23 83 24" fill="none" stroke="#78281F" stroke-width="1.2" stroke-linecap="round" />
      `;
      mouthSvg = '<path d="M74 34 L 79 36" fill="none" stroke="#78281F" stroke-width="1.5" stroke-linecap="round" />';
    } else if (mood === 'happy') {
      // Mắt cười tít hình trăng khuyết, má hồng đậm
      eyesSvg = `
        <path d="M69 28 Q 72 23 75 28" fill="none" stroke="#2C3E50" stroke-width="2.2" stroke-linecap="round" />
        <path d="M77 28 Q 80 23 83 28" fill="none" stroke="#2C3E50" stroke-width="2.2" stroke-linecap="round" />
      `;
      mouthSvg = '<path d="M73 34 Q 76 38 79 34" fill="#C0392B" stroke="#78281F" stroke-width="1" stroke-linecap="round" />';
      extraSvg = `
        <!-- Floating hearts -->
        <g class="happy-hearts">
          <path d="M85 18 C85 15, 88 15, 88 17 C88 19, 85 22, 85 22 C85 22, 82 19, 82 17 C82 15, 85 15, 85 18 Z" fill="#E74C3C" />
        </g>
      `;
    } else {
      // Curious / Default cute
      eyesSvg = `
        <circle class="cat-eye" cx="72" cy="28" r="2.8" fill="#2C3E50" />
        <circle class="cat-eye" cx="80" cy="28" r="2.8" fill="#2C3E50" />
        <circle cx="71.2" cy="26.8" r="1" fill="#FFFFFF" />
        <circle cx="79.2" cy="26.8" r="1" fill="#FFFFFF" />
      `;
    }

    return `
      <svg class="pet-svg cat-svg mood-${mood}" viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="catHeadShade" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#FFA726" />
            <stop offset="100%" stop-color="#E65100" />
          </radialGradient>
        </defs>

        <!-- Tail -->
        <path class="cat-tail" d="M22 52 C 12 48, 8 32, 14 26 C 18 22, 22 28, 18 36 C 16 40, 20 46, 24 50" fill="none" stroke="#E67E22" stroke-width="6.5" stroke-linecap="round" />
        
        <!-- Back Paws -->
        <ellipse class="cat-back-paw-left" cx="30" cy="62" rx="7" ry="5" fill="#D35400" />
        <ellipse class="cat-back-paw-right" cx="38" cy="64" rx="7" ry="5" fill="#E67E22" />

        <!-- Chubby 3D Body -->
        <ellipse cx="44" cy="48" rx="22" ry="16" fill="url(#catHeadShade)" />
        <ellipse cx="46" cy="50" rx="16" ry="11" fill="#FFF3E0" />

        <!-- Front Paw Left (Holding card) -->
        <ellipse class="cat-holding-paw left-paw" cx="64" cy="58" rx="6" ry="5.5" fill="#E67E22" stroke="#BF360C" stroke-width="0.8" />
        
        <!-- Head Container -->
        <g class="cat-head">
          <!-- Ears -->
          <polygon points="62,24 67,8 75,20" fill="#E65100" />
          <polygon points="64,22 68,12 73,19" fill="#FFCDD2" />
          <polygon points="77,22 86,10 88,24" fill="#E65100" />
          <polygon points="79,21 84,14 86,23" fill="#FFCDD2" />
          
          <!-- Face Base (3D Sphere Gradient) -->
          <circle cx="76" cy="30" r="16.5" fill="url(#catHeadShade)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
          
          <!-- Cheeks Múp Míp -->
          <circle cx="70" cy="35" r="4.5" fill="#FFF3E0" />
          <circle cx="82" cy="35" r="4.5" fill="#FFF3E0" />
          
          <!-- Blush -->
          <circle class="blush" cx="68" cy="33" r="3.2" fill="#F06292" opacity="${mood === 'happy' ? '0.85' : '0.5'}" />
          <circle class="blush" cx="84" cy="33" r="3.2" fill="#F06292" opacity="${mood === 'happy' ? '0.85' : '0.5'}" />
          
          <!-- Eyes -->
          ${eyesSvg}

          <!-- Nose -->
          <polygon points="75,32.5 77,32.5 76,34" fill="#E91E63" />
          <!-- Mouth -->
          ${mouthSvg}
          
          <!-- Whiskers -->
          <line x1="62" y1="32" x2="68" y2="33" stroke="#8D6E63" stroke-width="0.9" />
          <line x1="61" y1="36" x2="68" y2="35" stroke="#8D6E63" stroke-width="0.9" />
          <line x1="84" y1="33" x2="90" y2="32" stroke="#8D6E63" stroke-width="0.9" />
          <line x1="84" y1="35" x2="91" y2="36" stroke="#8D6E63" stroke-width="0.9" />

          <!-- Extra Mood Overlays -->
          ${extraSvg}
        </g>

        <!-- Front Paw Right (Foreground - Holding card tightly) -->
        <ellipse class="cat-holding-paw right-paw" cx="74" cy="62" rx="6.5" ry="5.5" fill="#FFA726" stroke="#E65100" stroke-width="1" />
      </svg>
    `;
  },

  /**
   * Dog Sprite Generator with Moods
   */
  getDogSvg: function(mood = 'curious') {
    let eyesSvg = '';
    let extraSvg = '';
    let mouthSvg = `
      <path d="M74 34 Q 76 37 78 34" fill="#C0392B" stroke="#78281F" stroke-width="0.8" />
      <ellipse cx="76" cy="36" rx="2" ry="2" fill="#F1948A" />
    `;

    if (mood === 'grumpy') {
      eyesSvg = `
        <path d="M68 23 L 74 26" stroke="#5D4037" stroke-width="2" stroke-linecap="round" />
        <path d="M84 23 L 78 26" stroke="#5D4037" stroke-width="2" stroke-linecap="round" />
        <circle cx="71" cy="27" r="2.2" fill="#3E2723" />
        <circle cx="81" cy="27" r="2.2" fill="#3E2723" />
      `;
      mouthSvg = '<path d="M73 36 Q 76 33 79 36" fill="none" stroke="#5D4037" stroke-width="1.6" stroke-linecap="round" />';
      extraSvg = `
        <g class="angry-vein" transform="translate(85, 12) scale(0.65)">
          <path d="M2 7 C2 2 7 2 7 7 C7 12 2 12 2 7 Z" fill="none" stroke="#E74C3C" stroke-width="2.5" />
          <path d="M7 2 C12 2 12 7 7 7" fill="none" stroke="#E74C3C" stroke-width="2.5" />
        </g>
      `;
    } else if (mood === 'sleepy') {
      eyesSvg = `
        <path d="M68 27 Q 71 30 74 27" fill="none" stroke="#3E2723" stroke-width="2" stroke-linecap="round" />
        <path d="M78 27 Q 81 30 84 27" fill="none" stroke="#3E2723" stroke-width="2" stroke-linecap="round" />
      `;
      mouthSvg = '<ellipse cx="76" cy="35" rx="3.5" ry="4.5" fill="#C0392B" />';
      extraSvg = `
        <g class="sleepy-zzz">
          <text x="84" y="15" font-size="9" font-weight="bold" fill="#7E57C2">Z</text>
          <text x="90" y="10" font-size="7" font-weight="bold" fill="#9575CD">z</text>
        </g>
      `;
    } else if (mood === 'side-eye') {
      eyesSvg = `
        <ellipse cx="71" cy="26" rx="3.5" ry="2" fill="#FFFFFF" stroke="#3E2723" stroke-width="0.8" />
        <ellipse cx="81" cy="26" rx="3.5" ry="2" fill="#FFFFFF" stroke="#3E2723" stroke-width="0.8" />
        <circle cx="69" cy="26" r="1.6" fill="#1A252F" />
        <circle cx="79" cy="26" r="1.6" fill="#1A252F" />
        <path d="M68 22 Q 71 20 74 23" fill="none" stroke="#5D4037" stroke-width="1.2" stroke-linecap="round" />
      `;
      mouthSvg = '<path d="M74 34 L 79 36" fill="none" stroke="#5D4037" stroke-width="1.4" stroke-linecap="round" />';
    } else if (mood === 'happy') {
      eyesSvg = `
        <path d="M68 27 Q 71 22 74 27" fill="none" stroke="#3E2723" stroke-width="2.2" stroke-linecap="round" />
        <path d="M78 27 Q 81 22 84 27" fill="none" stroke="#3E2723" stroke-width="2.2" stroke-linecap="round" />
      `;
      extraSvg = `
        <g class="happy-hearts">
          <path d="M85 18 C85 15, 88 15, 88 17 C88 19, 85 22, 85 22 C85 22, 82 19, 82 17 C82 15, 85 15, 85 18 Z" fill="#E74C3C" />
        </g>
      `;
    } else {
      eyesSvg = `
        <circle class="dog-eye" cx="71" cy="27" r="2.8" fill="#2C3E50" />
        <circle class="dog-eye" cx="81" cy="27" r="2.8" fill="#2C3E50" />
        <circle cx="70.2" cy="25.8" r="1" fill="#FFFFFF" />
        <circle cx="80.2" cy="25.8" r="1" fill="#FFFFFF" />
      `;
    }

    return `
      <svg class="pet-svg dog-svg mood-${mood}" viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="dogShade" cx="40%" cy="40%" r="60%">
            <stop offset="0%" stop-color="#FFA726" />
            <stop offset="100%" stop-color="#D84315" />
          </radialGradient>
        </defs>

        <!-- Tail -->
        <path class="dog-tail" d="M18 48 C 10 38, 12 24, 24 24 C 28 24, 30 28, 26 32 C 22 36, 18 42, 22 48" fill="#E65100" stroke="#BF360C" stroke-width="1.8" />
        
        <!-- Back Paws -->
        <ellipse class="dog-back-paw-left" cx="28" cy="62" rx="7" ry="5" fill="#D84315" />
        <ellipse class="dog-back-paw-right" cx="36" cy="64" rx="7" ry="5" fill="#E65100" />
        
        <!-- Chubby Body -->
        <ellipse cx="44" cy="48" rx="23" ry="16" fill="url(#dogShade)" />
        <ellipse cx="45" cy="51" rx="15" ry="11" fill="#FFF3E0" />
        
        <!-- Left Paw holding card -->
        <ellipse class="dog-holding-paw left-paw" cx="64" cy="58" rx="6" ry="5.5" fill="#E65100" stroke="#BF360C" stroke-width="0.8" />

        <!-- Head -->
        <g class="dog-head">
          <!-- Dog Ears -->
          <polygon points="60,20 66,4 74,18" fill="#D84315" />
          <polygon points="63,18 67,9 72,17" fill="#FFCDD2" />
          <polygon points="76,18 84,4 90,20" fill="#D84315" />
          <polygon points="78,17 83,9 87,18" fill="#FFCDD2" />
          
          <!-- Face base -->
          <circle cx="76" cy="30" r="16.5" fill="url(#dogShade)" filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))" />
          <!-- White snout patch -->
          <ellipse cx="76" cy="34" rx="10" ry="8" fill="#FFF8E1" />
          
          <!-- Cute Shiba Eyebrow dots -->
          <circle cx="70" cy="21" r="2.2" fill="#FFF8E1" />
          <circle cx="82" cy="21" r="2.2" fill="#FFF8E1" />
          
          <!-- Eyes -->
          ${eyesSvg}

          <!-- Nose -->
          <ellipse cx="76" cy="31" rx="2.5" ry="1.8" fill="#2C3E50" />
          <!-- Mouth -->
          ${mouthSvg}
          
          <!-- Cheeks -->
          <circle class="blush" cx="67" cy="33" r="3" fill="#F06292" opacity="${mood === 'happy' ? '0.8' : '0.5'}" />
          <circle class="blush" cx="85" cy="33" r="3" fill="#F06292" opacity="${mood === 'happy' ? '0.8' : '0.5'}" />

          <!-- Extra Mood Overlays -->
          ${extraSvg}
        </g>

        <!-- Right Paw holding card -->
        <ellipse class="dog-holding-paw right-paw" cx="74" cy="62" rx="6.5" ry="5.5" fill="#FFA726" stroke="#D84315" stroke-width="1" />
      </svg>
    `;
  }
};

window.PetSprites = Sprites;
