import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CANONICAL_EMOTIONS } from '../../shared/emotion-constants.js';

/**
 * 3D Chibi Pet Companion — Pilot Character: MÈO MOCHI (Scottish Fold)
 * Visual Identity:
 * - Distinctive folded ears (tai cụp sát đầu)
 * - Cream & pastel orange fur
 * - Pink paw pads
 * - Red ribbon collar with dangling gold bell
 * - 8 Canonical Emotions & Physical Card Interaction
 */
export class Pet3DCompanion {
  constructor(container, options = {}) {
    this.container = container;
    this.petType = options.pet || 'cat_mochi';
    this.mood = options.mood || CANONICAL_EMOTIONS.HAPPY;
    this.presentationMode = options.presentationMode || 'billboard'; // 'billboard' | 'peeker'
    this.clock = new THREE.Clock();

    this.width = container.clientWidth || 145;
    this.height = container.clientHeight || 140;

    // Interaction states
    this.isAnnoying = [CANONICAL_EMOTIONS.ANGRY, CANONICAL_EMOTIONS.SLEEPING, 'side-eye'].includes(this.mood);
    this.isRejected = false;
    this.isPetted = false;
    this.rejectionTimer = 0;
    this.petSquashTimer = 0;
    this.evasion = new THREE.Vector3(0, 0, 0);

    this.initScene();
    this.buildLighting();
    this.loadOrBuildModel();
    this.initInteractions();

    this.animate = this.animate.bind(this);
    this.isRunning = true;
    requestAnimationFrame(this.animate);
  }

  initScene() {
    this.scene = new THREE.Scene();

    this.camera = new THREE.PerspectiveCamera(36, this.width / this.height, 0.1, 50);
    this.camera.position.set(0, 0.55, 4.2);
    this.camera.lookAt(0, 0.15, 0);

    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.width, this.height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;

    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.display = 'block';
    this.container.appendChild(this.renderer.domElement);
  }

  buildLighting() {
    // Soft pastel ambient light (avoids harsh plastic shine)
    const hemiLight = new THREE.HemisphereLight(0xfff7ed, 0xb0bec5, 1.45);
    this.scene.add(hemiLight);

    // Warm key light
    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.9);
    keyLight.position.set(3.5, 6, 4);
    this.scene.add(keyLight);

    // Soft cool rim light (art toy edge definition)
    const rimLight = new THREE.DirectionalLight(0xc7d2fe, 0.95);
    rimLight.position.set(-4, 3, -3);
    this.scene.add(rimLight);

    // Subtle front bounce
    const fillLight = new THREE.PointLight(0xfef3c7, 0.45, 6);
    fillLight.position.set(0, -0.6, 2.8);
    this.scene.add(fillLight);
  }

  loadOrBuildModel() {
    // If a Blender model is provided in assets/pets/{id}/model.glb
    const gltfPath = `./assets/pets/${this.petType}/model.glb`;
    const loader = new GLTFLoader();

    loader.load(
      gltfPath,
      (gltf) => {
        this.model = gltf.scene;
        this.model.scale.set(1, 1, 1);
        this.model.position.set(0, -0.4, 0);
        this.scene.add(this.model);
        this.isCustomModel = true;
      },
      undefined,
      () => {
        // Fallback to our procedural Mèo Mochi (Scottish Fold)
        this.buildProceduralMochi();
      }
    );
  }

  buildMaterials() {
    // Mèo Mochi: Soft cream & pastel orange matte vinyl
    this.orangeFurMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B, // Pastel orange
      roughness: 0.55,
      metalness: 0.02
    });

    this.creamFurMat = new THREE.MeshStandardMaterial({
      color: 0xFFFBEB, // Cream white
      roughness: 0.6,
      metalness: 0.01
    });

    // Scottish Fold Ear interiors & Blushing cheeks
    this.pinkMat = new THREE.MeshStandardMaterial({
      color: 0xFB7185,
      roughness: 0.5,
      metalness: 0.02
    });

    // Red Ribbon Collar
    this.redRibbonMat = new THREE.MeshStandardMaterial({
      color: 0xE11D48,
      roughness: 0.4,
      metalness: 0.1
    });

    // Gold Bell (Shiny metallic gold)
    this.goldBellMat = new THREE.MeshStandardMaterial({
      color: 0xF59E0B,
      roughness: 0.2,
      metalness: 0.75
    });

    // Shiny Obsidian Cartoon Eyes
    this.eyeMat = new THREE.MeshStandardMaterial({
      color: 0x0F172A,
      roughness: 0.06,
      metalness: 0.15
    });

    this.sparkleMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });

    // Nose
    this.noseMat = new THREE.MeshStandardMaterial({
      color: 0xE11D48, // Cute pinkish red nose
      roughness: 0.3
    });

    // Emotion particles
    this.heartMat = new THREE.MeshStandardMaterial({
      color: 0xFF1493,
      emissive: 0xFF1493,
      emissiveIntensity: 0.5,
      roughness: 0.2
    });

    this.angryVeinMat = new THREE.MeshStandardMaterial({
      color: 0xDC2626,
      emissive: 0xEF4444,
      emissiveIntensity: 0.6,
      roughness: 0.2
    });
  }

  buildProceduralMochi() {
    this.buildMaterials();
    this.root = new THREE.Group();
    this.root.position.set(0.05, -0.32, 0);
    this.scene.add(this.root);

    // 1. Chubby Body (Round Mochi shape)
    const bodyGeo = new THREE.SphereGeometry(0.8, 32, 28);
    bodyGeo.scale(1.0, 1.05, 0.95);
    this.body = new THREE.Mesh(bodyGeo, this.orangeFurMat);
    this.root.add(this.body);

    // Cream tummy oval
    const bellyGeo = new THREE.SphereGeometry(0.64, 26, 22);
    bellyGeo.scale(0.85, 0.95, 0.35);
    this.belly = new THREE.Mesh(bellyGeo, this.creamFurMat);
    this.belly.position.set(0, -0.04, 0.68);
    this.root.add(this.belly);

    // 2. Chibi Scottish Fold Head
    this.head = new THREE.Group();
    this.head.position.set(0, 0.92, 0.08);
    this.root.add(this.head);

    const headGeo = new THREE.SphereGeometry(0.9, 36, 32);
    headGeo.scale(1.12, 0.98, 1.02);
    this.headMesh = new THREE.Mesh(headGeo, this.orangeFurMat);
    this.head.add(this.headMesh);

    // Cream Muzzle & Chubby Cheeks
    const muzzleGeo = new THREE.SphereGeometry(0.38, 24, 20);
    muzzleGeo.scale(1.15, 0.72, 0.85);
    this.muzzle = new THREE.Mesh(muzzleGeo, this.creamFurMat);
    this.muzzle.position.set(0, -0.22, 0.75);
    this.head.add(this.muzzle);

    // Rosy Blush Discs
    const blushGeo = new THREE.CylinderGeometry(0.14, 0.14, 0.04, 16);
    blushGeo.rotateX(Math.PI / 2);
    this.leftBlush = new THREE.Mesh(blushGeo, this.pinkMat);
    this.leftBlush.position.set(-0.52, -0.15, 0.86);
    this.head.add(this.leftBlush);

    this.rightBlush = this.leftBlush.clone();
    this.rightBlush.position.x = 0.52;
    this.head.add(this.rightBlush);

    // Cute Little Pink Nose
    const noseGeo = new THREE.SphereGeometry(0.075, 14, 12);
    noseGeo.scale(1.1, 0.8, 0.7);
    this.nose = new THREE.Mesh(noseGeo, this.noseMat);
    this.nose.position.set(0, -0.14, 1.08);
    this.head.add(this.nose);

    // 3. Scottish Fold Folded Ears (Đặc trưng tai gập cụp sát đầu!)
    this.buildScottishFoldEars();

    // 4. Red Ribbon Collar & Gold Bell
    this.buildCollarAndBell();

    // 5. Anime Eyes with 8 Emotion Blendshapes
    this.buildEyes();

    // 6. Holding Paws (Pink Paw Pads)
    this.buildHoldingPaws();

    // 7. Feet & Tail
    this.buildFeetAndTail();

    // 8. Emotion Overlays
    this.buildEmotionOverlays();

    this.applyMood(this.mood);
  }

  buildScottishFoldEars() {
    // Scottish Fold ears are distinctly folded down and forward against the head
    const foldEarGeo = new THREE.ConeGeometry(0.28, 0.42, 16);
    foldEarGeo.scale(1.1, 0.7, 0.5);

    const innerFoldGeo = new THREE.ConeGeometry(0.18, 0.3, 16);
    innerFoldGeo.scale(1.0, 0.6, 0.4);

    // Left Folded Ear
    this.leftEar = new THREE.Group();
    const lEarMesh = new THREE.Mesh(foldEarGeo, this.orangeFurMat);
    const lInner = new THREE.Mesh(innerFoldGeo, this.pinkMat);
    lInner.position.set(0, -0.04, 0.06);
    this.leftEar.add(lEarMesh, lInner);
    this.leftEar.position.set(-0.55, 0.65, 0.35);
    this.leftEar.rotation.set(0.65, -0.25, -0.4); // Folded forward & down!
    this.head.add(this.leftEar);

    // Right Folded Ear
    this.rightEar = new THREE.Group();
    const rEarMesh = new THREE.Mesh(foldEarGeo, this.orangeFurMat);
    const rInner = new THREE.Mesh(innerFoldGeo, this.pinkMat);
    rInner.position.set(0, -0.04, 0.06);
    this.rightEar.add(rEarMesh, rInner);
    this.rightEar.position.set(0.55, 0.65, 0.35);
    this.rightEar.rotation.set(0.65, 0.25, 0.4); // Folded forward & down!
    this.head.add(this.rightEar);
  }

  buildCollarAndBell() {
    // Red Ribbon Collar
    const collarGeo = new THREE.TorusGeometry(0.62, 0.06, 12, 32);
    collarGeo.rotateX(Math.PI / 2);
    this.collar = new THREE.Mesh(collarGeo, this.redRibbonMat);
    this.collar.position.set(0, 0.36, 0.05);
    this.root.add(this.collar);

    // Golden Bell
    this.bellGroup = new THREE.Group();
    this.bellGroup.position.set(0, 0.32, 0.68);

    const bellSphereGeo = new THREE.SphereGeometry(0.11, 16, 14);
    const bellMesh = new THREE.Mesh(bellSphereGeo, this.goldBellMat);

    const bellRimGeo = new THREE.TorusGeometry(0.09, 0.02, 8, 20);
    bellRimGeo.rotateX(Math.PI / 2);
    const bellRim = new THREE.Mesh(bellRimGeo, this.goldBellMat);
    bellRim.position.y = -0.03;

    this.bellGroup.add(bellMesh, bellRim);
    this.root.add(this.bellGroup);
  }

  buildEyes() {
    this.eyeGroup = new THREE.Group();
    this.head.add(this.eyeGroup);

    const eyeGeo = new THREE.SphereGeometry(0.145, 22, 18);
    eyeGeo.scale(0.9, 1.15, 0.7);

    const sparkleGeo = new THREE.SphereGeometry(0.05, 12, 10);
    const miniSparkleGeo = new THREE.SphereGeometry(0.026, 10, 8);

    // Left Eye
    this.leftEye = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.leftEye.position.set(-0.35, 0.02, 0.88);

    const lSparkle = new THREE.Mesh(sparkleGeo, this.sparkleMat);
    lSparkle.position.set(-0.03, 0.05, 0.1);
    const lMini = new THREE.Mesh(miniSparkleGeo, this.sparkleMat);
    lMini.position.set(0.03, -0.04, 0.09);
    this.leftEye.add(lSparkle, lMini);

    // Right Eye
    this.rightEye = new THREE.Mesh(eyeGeo, this.eyeMat);
    this.rightEye.position.set(0.35, 0.02, 0.88);

    const rSparkle = new THREE.Mesh(sparkleGeo, this.sparkleMat);
    rSparkle.position.set(-0.03, 0.05, 0.1);
    const rMini = new THREE.Mesh(miniSparkleGeo, this.sparkleMat);
    rMini.position.set(0.03, -0.04, 0.09);
    this.rightEye.add(rSparkle, rMini);

    this.eyeGroup.add(this.leftEye, this.rightEye);
  }

  buildHoldingPaws() {
    this.holdingPawsGroup = new THREE.Group();
    this.root.add(this.holdingPawsGroup);

    const armGeo = new THREE.CylinderGeometry(0.16, 0.2, 0.48, 16);
    armGeo.rotateX(Math.PI / 2.6);

    const pawGeo = new THREE.SphereGeometry(0.18, 16, 14);
    pawGeo.scale(1.1, 0.8, 1.2);

    // Pink paw pad disc
    const padGeo = new THREE.CylinderGeometry(0.09, 0.09, 0.02, 12);
    padGeo.rotateX(Math.PI / 2);

    // Left Arm & Paw
    this.leftArm = new THREE.Group();
    const lArmMesh = new THREE.Mesh(armGeo, this.orangeFurMat);
    const lPawMesh = new THREE.Mesh(pawGeo, this.creamFurMat);
    const lPad = new THREE.Mesh(padGeo, this.pinkMat);
    lPad.position.set(0, 0.2, 0.48);
    lPawMesh.position.set(0, 0.18, 0.38);
    this.leftArm.add(lArmMesh, lPawMesh, lPad);
    this.leftArm.position.set(-0.48, 0.15, 0.6);
    this.leftArm.rotation.set(0.15, 0.25, -0.15);

    // Right Arm & Paw
    this.rightArm = new THREE.Group();
    const rArmMesh = new THREE.Mesh(armGeo, this.orangeFurMat);
    const rPawMesh = new THREE.Mesh(pawGeo, this.creamFurMat);
    const rPad = new THREE.Mesh(padGeo, this.pinkMat);
    rPad.position.set(0, 0.2, 0.48);
    rPawMesh.position.set(0, 0.18, 0.38);
    this.rightArm.add(rArmMesh, rPawMesh, rPad);
    this.rightArm.position.set(0.48, 0.15, 0.6);
    this.rightArm.rotation.set(0.15, -0.25, 0.15);

    this.holdingPawsGroup.add(this.leftArm, this.rightArm);
  }

  buildFeetAndTail() {
    const footGeo = new THREE.SphereGeometry(0.24, 16, 14);
    footGeo.scale(1.0, 0.65, 1.3);

    this.leftFoot = new THREE.Mesh(footGeo, this.creamFurMat);
    this.leftFoot.position.set(-0.45, -0.68, 0.42);

    this.rightFoot = new THREE.Mesh(footGeo, this.creamFurMat);
    this.rightFoot.position.set(0.45, -0.68, 0.42);
    this.root.add(this.leftFoot, this.rightFoot);

    // S-curved Mochi Tail
    this.tail = new THREE.Group();
    this.tail.position.set(0, -0.3, -0.65);
    this.root.add(this.tail);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, 0.25, -0.3),
      new THREE.Vector3(0.12, 0.55, -0.25),
      new THREE.Vector3(0.2, 0.85, -0.05)
    ]);
    const tailGeo = new THREE.TubeGeometry(curve, 18, 0.09, 12, false);
    this.tailMesh = new THREE.Mesh(tailGeo, this.orangeFurMat);
    this.tail.add(this.tailMesh);
  }

  buildEmotionOverlays() {
    this.emotionGroup = new THREE.Group();
    this.head.add(this.emotionGroup);

    // Floating 3D Hearts for Love / Happy / Petting
    this.hearts = [];
    const heartShape = new THREE.Shape();
    heartShape.moveTo(0, 0);
    heartShape.bezierCurveTo(0, 0.12, -0.16, 0.2, -0.2, 0.1);
    heartShape.bezierCurveTo(-0.25, -0.04, -0.12, -0.16, 0, -0.26);
    heartShape.bezierCurveTo(0.12, -0.16, 0.25, -0.04, 0.2, 0.1);
    heartShape.bezierCurveTo(0.16, 0.2, 0, 0.12, 0, 0);

    const extrudeSettings = { depth: 0.06, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: 0.02, bevelThickness: 0.02 };
    const heartGeo = new THREE.ExtrudeGeometry(heartShape, extrudeSettings);
    heartGeo.scale(0.8, 0.8, 0.8);
    heartGeo.rotateZ(Math.PI);

    for (let i = 0; i < 3; i++) {
      const heart = new THREE.Mesh(heartGeo, this.heartMat);
      heart.visible = false;
      heart.position.set(0.25 + i * 0.2, 0.65 + i * 0.25, 0.2);
      this.emotionGroup.add(heart);
      this.hearts.push(heart);
    }

    // 3D Angry Cross Vein 💢
    this.angryVein = new THREE.Group();
    const barGeo = new THREE.BoxGeometry(0.12, 0.04, 0.04);
    const b1 = new THREE.Mesh(barGeo, this.angryVeinMat);
    const b2 = new THREE.Mesh(barGeo, this.angryVeinMat);
    b2.rotation.z = Math.PI / 2;
    this.angryVein.add(b1, b2);
    this.angryVein.position.set(0.48, 0.68, 0.45);
    this.angryVein.visible = false;
    this.emotionGroup.add(this.angryVein);
  }

  applyMood(mood) {
    this.mood = mood;
    this.isAnnoying = [CANONICAL_EMOTIONS.ANGRY, CANONICAL_EMOTIONS.SLEEPING, 'side-eye'].includes(mood);
    if (!this.head) return;

    // Reset base eye transforms
    this.leftEye.scale.set(0.9, 1.15, 0.7);
    this.rightEye.scale.set(0.9, 1.15, 0.7);
    this.leftEye.rotation.set(0, 0, 0);
    this.rightEye.rotation.set(0, 0, 0);
    this.leftEye.position.set(-0.35, 0.02, 0.88);
    this.rightEye.position.set(0.35, 0.02, 0.88);
    this.head.rotation.set(0, 0, 0);
    this.angryVein.visible = false;
    this.hearts.forEach(h => { h.visible = false; });

    // 8 Standard Emotion States
    switch (mood) {
      case CANONICAL_EMOTIONS.HAPPY:
        // Curved smiling eyes + happy raised paws
        this.leftEye.scale.set(1.1, 0.45, 0.7);
        this.rightEye.scale.set(1.1, 0.45, 0.7);
        this.leftEye.rotation.z = 0.15;
        this.rightEye.rotation.z = -0.15;
        this.hearts.forEach(h => { h.visible = true; });
        break;

      case CANONICAL_EMOTIONS.EXCITED:
        // Wide open sparkling eyes, chồm người tới
        this.leftEye.scale.set(1.1, 1.25, 0.8);
        this.rightEye.scale.set(1.1, 1.25, 0.8);
        this.head.position.z = 0.2;
        break;

      case CANONICAL_EMOTIONS.LOVE:
        // Blushing pink cheeks, hearts floating
        this.leftEye.scale.set(1.15, 0.4, 0.7);
        this.rightEye.scale.set(1.15, 0.4, 0.7);
        this.leftEye.rotation.z = 0.2;
        this.rightEye.rotation.z = -0.2;
        this.hearts.forEach(h => { h.visible = true; });
        break;

      case CANONICAL_EMOTIONS.SURPRISED:
        // Wide circular startled eyes
        this.leftEye.scale.set(1.2, 1.3, 0.9);
        this.rightEye.scale.set(1.2, 1.3, 0.9);
        this.head.position.y = 1.0;
        break;

      case CANONICAL_EMOTIONS.ANGRY:
        // Slanted angry eyes + angry vein 💢
        this.leftEye.scale.set(0.85, 0.5, 0.7);
        this.rightEye.scale.set(0.85, 0.5, 0.7);
        this.leftEye.rotation.z = -0.35;
        this.rightEye.rotation.z = 0.35;
        this.angryVein.visible = true;
        break;

      case CANONICAL_EMOTIONS.SAD:
        // Watery lowered eyes, head drooping gently
        this.leftEye.scale.set(0.85, 0.8, 0.7);
        this.rightEye.scale.set(0.85, 0.8, 0.7);
        this.leftEye.rotation.z = 0.2;
        this.rightEye.rotation.z = -0.2;
        this.head.rotation.x = 0.15;
        break;

      case CANONICAL_EMOTIONS.THINKING:
        // Tilted head 30 deg, looking upward
        this.head.rotation.z = 0.22;
        this.head.rotation.x = -0.15;
        this.leftEye.position.y = 0.06;
        this.rightEye.position.y = 0.06;
        break;

      case CANONICAL_EMOTIONS.SLEEPING:
        // Half-closed droopy eyes, resting
        this.leftEye.scale.set(1.0, 0.25, 0.7);
        this.rightEye.scale.set(1.0, 0.25, 0.7);
        this.head.rotation.x = 0.22;
        break;

      default:
        // Curious normal state
        break;
    }
  }

  initInteractions() {
    this.mouse = new THREE.Vector2(0, 0);
    this.targetHeadRot = new THREE.Vector2(0, 0);
    this.pettingScore = 0;
    this.lastX = 0;

    const el = this.renderer.domElement;

    el.addEventListener('mousemove', (e) => {
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (this.isAnnoying) {
        // EVASION PHYSICS: "Tránh xa ra, đừng vuốt ve tôi!"
        this.evasion.x = -this.mouse.x * 0.45;
        this.evasion.z = -Math.abs(this.mouse.x) * 0.35;
        this.targetHeadRot.y = -this.mouse.x * 0.5; // turns face away
        this.targetHeadRot.x = 0.15;
      } else {
        // Friendly tracking
        this.evasion.set(0, 0, 0);
        this.targetHeadRot.y = this.mouse.x * 0.35;
        this.targetHeadRot.x = -this.mouse.y * 0.25;
      }

      // Check petting motion
      const deltaX = Math.abs(e.clientX - this.lastX);
      this.lastX = e.clientX;

      if (deltaX > 4) {
        this.pettingScore += 1;
      }

      if (this.pettingScore > 8) {
        this.pettingScore = 0;
        this.handleTouchAttempt();
      }
    });

    el.addEventListener('click', () => {
      this.handleTouchAttempt();
    });

    el.addEventListener('mouseleave', () => {
      this.targetHeadRot.set(0, 0);
      this.evasion.set(0, 0, 0);
      this.pettingScore = 0;
    });
  }

  handleTouchAttempt() {
    if (this.isAnnoying) {
      // REJECT TOUCH! "Tránh xa ra, đừng vuốt ve tui!"
      this.isRejected = true;
      this.rejectionTimer = 0.8;
      this.angryVein.visible = true;

      const rejectLines = [
        '😤 Tránh xa ra, đừng có vuốt ve tui!',
        '😾 Mèo Mochi đang quạu, cấm sờ!',
        '❌ Không cho vuốt đâu! Tự làm việc đi!',
        '😒 Hứ! Đừng có chạm vào Mochi!'
      ];
      const randomLine = rejectLines[Math.floor(Math.random() * rejectLines.length)];

      const event = new CustomEvent('pet:rejected', { bubbles: true, detail: { line: randomLine, pet: this.petType } });
      this.container.dispatchEvent(event);
    } else {
      // ACCEPT PETTING! Mochi squash & hearts
      this.isPetted = true;
      this.petSquashTimer = 0.6;
      this.hearts.forEach(h => { h.visible = true; });

      const event = new CustomEvent('pet:petted', { bubbles: true, detail: { pet: this.petType } });
      this.container.dispatchEvent(event);
    }
  }

  animate() {
    if (!this.isRunning) return;
    requestAnimationFrame(this.animate);

    const delta = this.clock.getDelta();
    const time = this.clock.getElapsedTime();

    // 1. Bell Dangling Physics (Chimes slightly with breath)
    if (this.bellGroup) {
      this.bellGroup.rotation.z = Math.sin(time * 6) * 0.12;
      this.bellGroup.rotation.x = Math.cos(time * 4) * 0.08;
    }

    // 2. Tail Wagging (Dynamic speed by emotion)
    let tailSpeed = 5;
    if (this.mood === CANONICAL_EMOTIONS.ANGRY) tailSpeed = 15;
    if (this.mood === CANONICAL_EMOTIONS.SLEEPING) tailSpeed = 2;
    if (this.mood === CANONICAL_EMOTIONS.HAPPY || this.mood === CANONICAL_EMOTIONS.LOVE || this.isPetted) tailSpeed = 16;

    if (this.tail) {
      this.tail.rotation.y = Math.sin(time * tailSpeed) * 0.3;
      this.tail.rotation.z = Math.cos(time * (tailSpeed * 0.5)) * 0.12;
    }

    // 3. Soft Breathing
    if (this.body) {
      this.body.scale.y = 1.05 + Math.sin(time * 3) * 0.02;
    }

    // 4. Head & Evasion Mechanics
    if (this.head) {
      this.head.position.x += (this.evasion.x - this.head.position.x) * 0.15;
      this.head.position.z += (0.08 + this.evasion.z - this.head.position.z) * 0.15;

      this.head.rotation.y += (this.targetHeadRot.y - this.head.rotation.y) * 0.12;
      this.head.rotation.x += (this.targetHeadRot.x - this.head.rotation.x) * 0.12;

      // Rejection Shaking Animation
      if (this.rejectionTimer > 0) {
        this.rejectionTimer -= delta;
        this.head.rotation.y = Math.sin(time * 28) * 0.35; // Shakes head "NO!"
        this.head.position.z = -0.25;
        if (this.angryVein) {
          this.angryVein.scale.setScalar(1 + Math.sin(time * 20) * 0.3);
        }
      } else if (this.petSquashTimer > 0) {
        // Petting Mochi Squash & Purr
        this.petSquashTimer -= delta;
        const prog = this.petSquashTimer / 0.6;
        this.head.scale.set(1.15 + Math.sin(prog * Math.PI) * 0.12, 0.88 - Math.sin(prog * Math.PI) * 0.12, 1.1);
        this.head.rotation.z = Math.sin(time * 12) * 0.06;
      } else {
        this.head.scale.set(1, 1, 1);
        if (this.mood !== CANONICAL_EMOTIONS.HAPPY && this.mood !== CANONICAL_EMOTIONS.LOVE) {
          this.hearts.forEach(h => { h.visible = false; });
        }
      }

      // Foot stomping for angry
      if (this.mood === CANONICAL_EMOTIONS.ANGRY) {
        if (this.leftFoot) this.leftFoot.position.y = -0.68 + Math.abs(Math.sin(time * 12)) * 0.07;
      } else if (this.mood === CANONICAL_EMOTIONS.HAPPY || this.mood === CANONICAL_EMOTIONS.EXCITED) {
        this.root.position.y = -0.32 + Math.abs(Math.sin(time * 8)) * 0.12;
      }
    }

    // 5. Floating Hearts
    if (this.hearts.length > 0) {
      this.hearts.forEach((h, i) => {
        if (h.visible) {
          h.position.y = 0.65 + ((time * 0.6 + i * 0.35) % 0.7);
          h.rotation.y = time * 2 + i;
        }
      });
    }

    this.renderer.render(this.scene, this.camera);
  }

  destroy() {
    this.isRunning = false;
    if (this.renderer && this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
