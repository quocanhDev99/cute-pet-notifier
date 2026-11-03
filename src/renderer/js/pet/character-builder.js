import * as THREE from 'three';

/**
 * Parametric chibi "art toy" character builder.
 * Conventions match the Blender export standard: origin at the feet (0,0,0),
 * facing +Z, ≈1.85 units tall. L = character's left (+X).
 */

const HEAD_R = 0.58;
const HEAD_Y = 0.42; // head mesh centre relative to the neck pivot
const NECK_Y = 0.88;

function furMat(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.62,
    metalness: 0,
    sheen: 0.3,
    sheenRoughness: 0.6,
    sheenColor: new THREE.Color(0xffffff),
    clearcoat: 0.06,
    clearcoatRoughness: 0.7,
    ...opts
  });
}

function glossMat(color, opts = {}) {
  return new THREE.MeshPhysicalMaterial({ color, roughness: 0.12, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, ...opts });
}

function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

function heartShape(s = 1) {
  const sh = new THREE.Shape();
  sh.moveTo(0, -0.09 * s);
  sh.bezierCurveTo(-0.02 * s, -0.06 * s, -0.11 * s, -0.01 * s, -0.11 * s, 0.04 * s);
  sh.bezierCurveTo(-0.11 * s, 0.09 * s, -0.05 * s, 0.11 * s, 0, 0.065 * s);
  sh.bezierCurveTo(0.05 * s, 0.11 * s, 0.11 * s, 0.09 * s, 0.11 * s, 0.04 * s);
  sh.bezierCurveTo(0.11 * s, -0.01 * s, 0.02 * s, -0.06 * s, 0, -0.09 * s);
  return sh;
}

export function heartGeometry(scale = 1, depth = 0.04) {
  const g = new THREE.ExtrudeGeometry(heartShape(scale), { depth: depth * scale, bevelEnabled: true, bevelSegments: 3, bevelSize: 0.012 * scale, bevelThickness: 0.012 * scale, curveSegments: 16 });
  g.center();
  return g;
}

function starShape(outer, inner, points = 5) {
  const sh = new THREE.Shape();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / (points * 2)) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r, y = Math.sin(a) * r;
    if (i === 0) sh.moveTo(x, y); else sh.lineTo(x, y);
  }
  sh.closePath();
  return sh;
}

export function buildCharacter(sp) {
  const C = sp.colors;
  const M = {
    fur: furMat(C.fur),
    furDark: furMat(C.furDark),
    cream: furMat(C.cream),
    pink: furMat(C.pink, { roughness: 0.5 }),
    nose: glossMat(C.nose, { roughness: 0.25 }),
    eye: glossMat(0x1B1420),
    white: new THREE.MeshBasicMaterial({ color: 0xffffff }),
    blush: new THREE.MeshBasicMaterial({ color: C.blush, transparent: true, opacity: 0.5, depthWrite: false }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x7A3442, roughness: 0.5 }),
    mouthInner: new THREE.MeshStandardMaterial({ color: 0x9E2F45, roughness: 0.6 }),
    tongue: furMat(0xFF8597, { roughness: 0.45 }),
    accent: furMat(C.accent, { roughness: 0.45, sheen: 0.8 }),
    accent2: new THREE.MeshPhysicalMaterial({ color: C.accent2, roughness: 0.22, metalness: 0.85, clearcoat: 0.6 }),
    starEye: glossMat(0xFFC93C, { emissive: 0xFFB000, emissiveIntensity: 0.35 }),
    heartEye: glossMat(0xFF3D6E, { emissive: 0xFF2D5E, emissiveIntensity: 0.3 }),
    tear: new THREE.MeshPhysicalMaterial({ color: 0x9FD8FF, roughness: 0.05, transmission: 0.2, transparent: true, opacity: 0.85, clearcoat: 1 }),
    brow: furMat(sp.beanBrows ? C.cream : C.furDark)
  };

  const hw = sp.head.width, hh = sp.head.height;
  const ea = HEAD_R * hw, eb = HEAD_R * hh, ec = HEAD_R * 0.94;

  // Place a feature on the head ellipsoid surface, oriented along the normal.
  const onHead = (obj, x, y, lift = 0) => {
    const k = 1 - (x / ea) ** 2 - (y / eb) ** 2;
    const z = ec * Math.sqrt(Math.max(0.0001, k));
    const n = new THREE.Vector3(x / (ea * ea), y / (eb * eb), z / (ec * ec)).normalize();
    obj.position.set(x, HEAD_Y + y, z).addScaledVector(n, lift);
    obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    return obj;
  };

  const rig = { species: sp, materials: M, bones: {}, eyes: {}, mouths: {}, fx: {} };
  const root = new THREE.Group(); root.name = 'root';
  const spine = new THREE.Group(); spine.name = 'spine';
  root.add(spine);
  rig.root = root; rig.spine = spine;

  /* ---------------- Body ---------------- */
  const bw = sp.body.width, bh = sp.body.height;
  const bodyGeo = new THREE.SphereGeometry(0.5, 48, 40);
  bodyGeo.scale(bw, bh, 0.92 * bw);
  const body = new THREE.Mesh(bodyGeo, M.fur);
  body.position.y = 0.5 * bh + 0.02;
  spine.add(body);
  rig.body = body;

  const bellyGeo = new THREE.SphereGeometry(0.4, 40, 32);
  const penguin = sp.arms === 'flippers';
  bellyGeo.scale(penguin ? 0.98 * bw : 0.82 * bw, penguin ? 1.05 * bh : 0.88 * bh, 0.55);
  const belly = new THREE.Mesh(bellyGeo, M.cream);
  belly.position.set(0, body.position.y - 0.04, 0.5 * 0.92 * bw - (penguin ? 0.17 : 0.2));
  spine.add(belly);

  const chest = new THREE.Group(); chest.name = 'chest';
  chest.position.y = NECK_Y - 0.02;
  spine.add(chest);
  rig.chest = chest;

  /* ---------------- Head ---------------- */
  const neck = new THREE.Group(); neck.name = 'neck';
  neck.position.y = NECK_Y;
  spine.add(neck);
  const head = new THREE.Group(); head.name = 'head';
  neck.add(head);
  rig.neck = neck; rig.head = head;

  const headGeo = new THREE.SphereGeometry(HEAD_R, 56, 44);
  headGeo.scale(hw, hh, 0.94);
  const headMesh = new THREE.Mesh(headGeo, M.fur);
  headMesh.position.y = HEAD_Y;
  head.add(headMesh);
  rig.headMesh = headMesh;

  if (sp.faceMask) {
    const maskGeo = new THREE.SphereGeometry(HEAD_R * 0.98, 40, 32);
    maskGeo.scale(hw * 0.82, hh * 0.72, 0.6);
    const mask = new THREE.Mesh(maskGeo, M.cream);
    mask.position.set(0, HEAD_Y - 0.06, ec - HEAD_R * 0.6 * 0.98 + 0.012);
    head.add(mask);
  }

  if (sp.stripes) {
    const sGeo = new THREE.CapsuleGeometry(0.022, 0.1, 4, 8);
    [-0.09, 0, 0.09].forEach((x, i) => {
      const s = new THREE.Mesh(sGeo, M.furDark);
      onHead(s, x, 0.38 - Math.abs(x) * 0.4, -0.012);
      s.rotateX(Math.PI / 2);
      s.scale.set(1, i === 1 ? 1.15 : 0.9, 0.5);
      head.add(s);
    });
  }

  // Muzzle, nose, beak
  let mouthAnchorY = -0.2;
  if (sp.muzzle) {
    const big = sp.id === 'dog_boba';
    const mz = new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), M.cream);
    mz.scale.set(big ? 1.55 : 1.4, big ? 0.95 : 0.82, big ? 0.95 : 0.6);
    onHead(mz, 0, -0.16, big ? -0.05 : -0.06);
    head.add(mz);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(big ? 0.06 : 0.042, 20, 16), M.nose);
    nose.scale.set(1.35, 0.85, 0.8);
    onHead(nose, 0, -0.09, big ? 0.09 : 0.045);
    head.add(nose);
    mouthAnchorY = -0.2;
  } else if (!sp.beak) {
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.nose);
    nose.scale.set(1.3, 0.9, 0.7);
    onHead(nose, 0, -0.12, 0.005);
    head.add(nose);
    mouthAnchorY = -0.19;
  }
  if (sp.beak) {
    const beakMat = furMat(C.nose, { roughness: 0.4 });
    const beak = new THREE.Group();
    onHead(beak, 0, -0.12, -0.02);
    const upper = new THREE.Mesh(new THREE.ConeGeometry(0.085, 0.16, 24), beakMat);
    upper.rotation.x = Math.PI / 2; upper.scale.set(1.25, 1, 0.55); upper.position.z = 0.07;
    const lowerPivot = new THREE.Group();
    const lower = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.12, 24), beakMat);
    lower.rotation.x = Math.PI / 2; lower.scale.set(1.15, 1, 0.45); lower.position.set(0, -0.03, 0.05);
    lowerPivot.add(lower);
    beak.add(upper, lowerPivot);
    head.add(beak);
    rig.beakLower = lowerPivot;
  }

  // Blush
  const blushGeo = new THREE.CircleGeometry(0.075, 24);
  rig.blush = [-1, 1].map(s => {
    const b = new THREE.Mesh(blushGeo, M.blush);
    onHead(b, s * 0.36 * hw, -0.13, 0.006);
    b.scale.set(1.35, 0.85, 1);
    head.add(b);
    return b;
  });

  /* ---------------- Eyes (all variants) ---------------- */
  const eyeX = 0.215 * hw, eyeY = -0.03;
  const openGeo = new THREE.SphereGeometry(0.092, 28, 22);
  openGeo.scale(0.88, 1.12, 0.5);
  const hl1 = new THREE.SphereGeometry(0.03, 12, 10);
  const hl2 = new THREE.SphereGeometry(0.015, 10, 8);
  const arcGeo = new THREE.TorusGeometry(0.06, 0.017, 10, 24, Math.PI);
  const starGeo = new THREE.ExtrudeGeometry(starShape(0.1, 0.045), { depth: 0.02, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2 });
  starGeo.center();
  const hEyeGeo = heartGeometry(0.95, 0.25);
  const poolGeo = new THREE.SphereGeometry(0.07, 18, 12);
  poolGeo.scale(1.05, 0.45, 0.35);

  rig.eyeSockets = [];
  for (const side of [-1, 1]) {
    const key = side < 0 ? 'R' : 'L'; // viewer-left eye is the character's right
    const socket = new THREE.Group();
    onHead(socket, side * eyeX, eyeY, 0.0);
    head.add(socket);
    rig.eyeSockets.push(socket);

    const open = new THREE.Group();
    const ball = new THREE.Mesh(openGeo, M.eye);
    const a = new THREE.Mesh(hl1, M.white); a.position.set(-0.026, 0.04, 0.045);
    const b = new THREE.Mesh(hl2, M.white); b.position.set(0.026, -0.04, 0.042);
    const c = new THREE.Mesh(hl2, M.white); c.position.set(-0.03, -0.01, 0.044); c.visible = false;
    open.add(ball, a, b, c);
    open.userData.extraHighlight = c;

    const arcHappy = new THREE.Mesh(arcGeo, M.eye); arcHappy.position.z = 0.012; arcHappy.position.y = -0.02;
    const arcClosed = new THREE.Mesh(arcGeo, M.eye); arcClosed.rotation.z = Math.PI; arcClosed.position.set(0, 0.015, 0.012);
    const star = new THREE.Mesh(starGeo, M.starEye); star.position.z = 0.02;
    const heart = new THREE.Mesh(hEyeGeo, M.heartEye); heart.position.z = 0.02; heart.scale.setScalar(0.95);
    const pool = new THREE.Mesh(poolGeo, M.tear); pool.position.set(0, -0.055, 0.03);

    socket.add(open, arcHappy, arcClosed, star, heart, pool);
    rig.eyes[key] = { socket, open, arcHappy, arcClosed, star, heart, pool };
  }

  // Brows
  const browGeo = new THREE.CapsuleGeometry(sp.beanBrows ? 0.03 : 0.016, sp.beanBrows ? 0.045 : 0.075, 4, 10);
  browGeo.rotateZ(Math.PI / 2);
  rig.brows = [-1, 1].map(side => {
    const g = new THREE.Group();
    onHead(g, side * eyeX, eyeY + 0.15, 0.006);
    const m = new THREE.Mesh(browGeo, M.brow);
    if (sp.beanBrows) m.scale.set(1, 1, 0.45);
    g.add(m);
    g.userData.side = side;
    head.add(g);
    return g;
  });

  /* ---------------- Mouths (all variants) ---------------- */
  const mouth = new THREE.Group();
  onHead(mouth, 0, mouthAnchorY, sp.id === 'dog_boba' ? 0.11 : 0.035);
  head.add(mouth);
  rig.mouth = mouth;
  const tube = (pts, r = 0.0105) => new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], 0))), 24, r, 8, false), M.mouth);
  rig.mouths.w = tube([[-0.075, 0.012], [-0.04, -0.024], [0, 0.002], [0.04, -0.024], [0.075, 0.012]]);
  rig.mouths.flat = tube([[-0.03, -0.008], [0.015, -0.002], [0.05, 0.006]]);
  rig.mouths.pout = tube([[-0.04, -0.022], [0, 0.008], [0.04, -0.022]]);
  rig.mouths.wavy = tube([[-0.07, -0.01], [-0.035, 0.008], [0, -0.012], [0.035, 0.008], [0.07, -0.01]]);
  const smile = new THREE.Group();
  const smileGeo = new THREE.CircleGeometry(0.065, 24, Math.PI, Math.PI);
  const smileMesh = new THREE.Mesh(smileGeo, M.mouthInner);
  smileMesh.scale.set(1.1, 0.95, 1);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), M.tongue);
  tongue.scale.set(1.2, 0.7, 0.35); tongue.position.set(0, -0.04, 0.004);
  smile.add(smileMesh, tongue);
  smile.position.y = 0.012;
  rig.mouths.smile = smile;
  const oMesh = new THREE.Mesh(new THREE.CircleGeometry(0.042, 24), M.mouthInner);
  oMesh.scale.set(0.9, 1.2, 1); oMesh.position.y = -0.02;
  rig.mouths.o = oMesh;
  const small = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), M.mouthInner);
  small.position.y = -0.008;
  rig.mouths.small = small;
  for (const m of Object.values(rig.mouths)) { m.visible = false; mouth.add(m); }
  if (sp.beak) mouth.visible = false;

  /* ---------------- Ears ---------------- */
  const ear = (side) => {
    const g = new THREE.Group();
    g.name = side > 0 ? 'ear_L' : 'ear_R';
    const inner = new THREE.Group();
    g.add(inner);
    if (sp.ears === 'fold') {
      onHead(g, side * 0.3 * hw, 0.38 * hh, -0.07);
      const outer = new THREE.Mesh(new THREE.SphereGeometry(0.12, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), M.fur);
      outer.scale.set(1.3, 0.9, 0.45);
      const pinkM = new THREE.Mesh(new THREE.SphereGeometry(0.085, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), M.pink);
      pinkM.scale.set(1.2, 0.9, 0.5); pinkM.position.set(0, 0.01, 0.025);
      inner.add(outer, pinkM);
      inner.rotation.x = 1.45; // folded forward, flat against the head
      inner.rotation.z = -side * 0.3;
      g.userData.base = { x: 1.45, z: -side * 0.3 };
    } else if (sp.ears === 'pointy') {
      onHead(g, side * 0.33 * hw, 0.36 * hh, -0.05);
      const outer = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.42, 4, 1), M.fur);
      outer.scale.set(1, 1, 0.42); outer.position.y = 0.19; outer.rotation.y = Math.PI / 4;
      const pinkM = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.28, 4, 1), M.pink);
      pinkM.scale.set(1, 1, 0.3); pinkM.position.set(0, 0.16, 0.035); pinkM.rotation.y = Math.PI / 4;
      inner.add(outer, pinkM);
      inner.rotation.z = -side * 0.32;
      inner.rotation.x = -0.15;
      g.userData.base = { x: -0.15, z: -side * 0.32 };
    } else if (sp.ears === 'long') {
      // Netherland Dwarf: short, round, close-set ears (Blueprint V3.2 §2.3)
      onHead(g, side * 0.17 * hw, 0.47 * hh, -0.06);
      const outer = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.26, 8, 20), M.fur);
      outer.scale.set(1, 1, 0.6); outer.position.y = 0.21;
      const tip = new THREE.Mesh(new THREE.SphereGeometry(0.108, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), M.pink);
      tip.scale.set(1.0, 0.75, 0.62); tip.position.y = 0.34;
      const pinkM = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.2, 6, 12), M.pink);
      pinkM.scale.set(1, 1, 0.3); pinkM.position.set(0, 0.2, 0.045);
      inner.add(outer, tip, pinkM);
      inner.rotation.z = -side * 0.08;
      g.userData.base = { x: 0, z: -side * 0.08 };
      g.userData.tip = tip;
    } else {
      g.userData.base = { x: 0, z: 0 };
    }
    // Align the ear group upright (onHead orients along the normal) — keep yaw only.
    g.quaternion.identity();
    g.userData.inner = inner;
    g.userData.side = side;
    head.add(g);
    return g;
  };
  rig.ears = [ear(1), ear(-1)];
  rig.bones.ear_L = rig.ears[0];
  rig.bones.ear_R = rig.ears[1];

  /* ---------------- Arms ---------------- */
  const arm = (side) => {
    const g = new THREE.Group();
    g.name = side > 0 ? 'arm_L' : 'arm_R';
    if (sp.arms === 'flippers') {
      g.position.set(side * 0.47 * bw, 0.68 * bh, 0.0);
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.32, 8, 16), M.fur);
      f.scale.set(1, 1, 0.38); f.position.y = -0.2;
      g.add(f);
    } else {
      g.position.set(side * 0.34 * bw, 0.7 * bh, 0.16);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.095, 0.16, 8, 16), M.fur);
      a.position.y = -0.13;
      const paw = new THREE.Group(); paw.name = side > 0 ? 'paw_L' : 'paw_R';
      paw.position.y = -0.27;
      const pm = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 18), M.cream);
      pm.scale.set(1, 0.92, 1.05);
      const pad = new THREE.Mesh(new THREE.CircleGeometry(0.045, 18), M.pink);
      pad.position.set(0, -0.02, 0.105);
      const beans = [-0.045, 0, 0.045].map((x) => {
        const bean = new THREE.Mesh(new THREE.CircleGeometry(0.017, 12), M.pink);
        bean.position.set(x, 0.045, 0.098 - Math.abs(x) * 0.25);
        return bean;
      });
      paw.add(pm, pad, ...beans);
      g.add(a, paw);
    }
    g.userData.side = side;
    spine.add(g);
    return g;
  };
  rig.arms = [arm(1), arm(-1)];
  rig.bones.arm_L = rig.arms[0];
  rig.bones.arm_R = rig.arms[1];

  /* ---------------- Legs / feet ---------------- */
  const footMat = sp.beak ? furMat(C.nose, { roughness: 0.45 }) : M.cream;
  rig.legs = [1, -1].map(side => {
    const leg = new THREE.Group();
    leg.name = side > 0 ? 'leg_L' : 'leg_R';
    leg.position.set(side * 0.24 * bw, 0.2, 0.05);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.135, 24, 18), footMat);
    foot.name = side > 0 ? 'foot_L' : 'foot_R';
    foot.scale.set(1, 0.6 * (sp.body.legLength * 0.4 + 0.6), 1.35);
    foot.position.set(0, -0.13, 0.13);
    leg.add(foot);
    root.add(leg);
    return leg;
  });

  /* ---------------- Tail ---------------- */
  const tail = new THREE.Group(); tail.name = 'tail_01';
  tail.position.set(0, 0.28, -0.38 * bw);
  spine.add(tail);
  rig.tail = tail;
  if (sp.tail === 'cat') {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.12, -0.22), new THREE.Vector3(0.08, 0.38, -0.3),
      new THREE.Vector3(0.18, 0.62, -0.2), new THREE.Vector3(0.24, 0.74, -0.06)
    ]);
    tail.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.07, 14, false), M.fur));
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), M.cream);
    tip.position.copy(curve.getPoint(1));
    tail.add(tip);
  } else if (sp.tail === 'stub') {
    const t = new THREE.Mesh(new THREE.SphereGeometry(0.12, 20, 16), M.fur);
    t.scale.set(1, 0.85, 1.1); t.position.set(0, 0.06, -0.04);
    tail.add(t);
  } else if (sp.tail === 'puff') {
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 3), M.cream);
    t.position.set(0, 0.02, -0.02);
    tail.add(t);
  }

  /* ---------------- Accessories ---------------- */
  if (sp.accessory === 'collar_bell') {
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.37 * bw, 0.05, 14, 48), M.accent);
    collar.rotation.x = Math.PI / 2 + 0.12;
    collar.scale.set(1, 0.92, 1);
    chest.add(collar);
    const bow = new THREE.Group();
    bow.position.set(0, -0.07, 0.4 * bw);
    const loopGeo = new THREE.SphereGeometry(0.07, 18, 14);
    loopGeo.scale(1.3, 0.85, 0.5);
    const l1 = new THREE.Mesh(loopGeo, M.accent); l1.position.x = -0.085; l1.rotation.z = 0.35;
    const l2 = new THREE.Mesh(loopGeo, M.accent); l2.position.x = 0.085; l2.rotation.z = -0.35;
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.038, 14, 10), M.accent);
    bow.add(l1, l2, knot);
    chest.add(bow);
    const bellPivot = new THREE.Group();
    bellPivot.position.set(0, -0.1, 0.42 * bw);
    const bell = new THREE.Mesh(new THREE.SphereGeometry(0.062, 24, 18), M.accent2);
    bell.position.y = -0.065;
    const slit = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 20), new THREE.MeshStandardMaterial({ color: 0x8a6510, metalness: 0.6, roughness: 0.4 }));
    slit.rotation.x = Math.PI / 2; slit.position.y = -0.085;
    bellPivot.add(bell, slit);
    chest.add(bellPivot);
    rig.bell = bellPivot;
  } else if (sp.accessory === 'bandana') {
    const tex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#8FD3F5'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#ffffff';
      for (let y = 16; y < h; y += 40) for (let x = (y / 40) % 2 ? 36 : 16; x < w; x += 40) { g.beginPath(); g.arc(x, y, 7, 0, Math.PI * 2); g.fill(); }
    });
    const clothMat = furMat(0xffffff, { map: tex, roughness: 0.7, sheen: 0.9 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.34 * bw, 0.05, 12, 48), clothMat);
    band.rotation.x = Math.PI / 2 + 0.12;
    chest.add(band);
    const tri = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.3, 3, 1), clothMat);
    tri.rotation.set(Math.PI + 0.25, Math.PI, 0); tri.scale.set(1.2, 1, 0.3);
    tri.position.set(0, -0.12, 0.3 * bw);
    chest.add(tri);
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), clothMat);
    knot.position.set(0, 0.01, -0.33 * bw);
    chest.add(knot);
  } else if (sp.accessory === 'sprout') {
    const earL = rig.ears[0].userData.inner;
    const clip = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.08, 4, 10), furMat(0xFFFFFF, { color: 0xF6E6A8 }));
    clip.rotation.z = Math.PI / 2; clip.position.set(0, 0.16, 0.07);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.12, 8), M.accent2);
    stem.position.set(0, 0.23, 0.08);
    const leafGeo = new THREE.SphereGeometry(0.055, 16, 10);
    leafGeo.scale(1.4, 0.55, 0.35);
    const lf1 = new THREE.Mesh(leafGeo, M.accent); lf1.position.set(-0.055, 0.3, 0.08); lf1.rotation.z = 0.5;
    const lf2 = new THREE.Mesh(leafGeo, M.accent); lf2.position.set(0.055, 0.31, 0.08); lf2.rotation.z = -0.5;
    earL.add(clip, stem, lf1, lf2);
  } else if (sp.accessory === 'beanie') {
    const knit = canvasTexture(256, 128, (g, w, h) => {
      g.fillStyle = '#F7C948'; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? 'rgba(180,120,0,0.18)' : 'rgba(255,255,255,0.18)'; g.fillRect(x, 0, 4, h); }
    });
    knit.wrapS = THREE.RepeatWrapping; knit.repeat.set(3, 1);
    const knitMat = furMat(0xffffff, { map: knit, roughness: 0.85, sheen: 1, sheenColor: new THREE.Color(0xFFF1B8) });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(HEAD_R * 1.04, 48, 24, 0, Math.PI * 2, 0, Math.PI * 0.42), knitMat);
    cap.scale.set(hw, hh * 1.05, 0.98);
    cap.position.y = HEAD_Y + 0.04;
    cap.rotation.x = -0.12;
    head.add(cap);
    const rib = new THREE.Mesh(new THREE.TorusGeometry(HEAD_R * 0.98 * hw * 0.85, 0.05, 12, 48), knitMat);
    rib.rotation.x = Math.PI / 2 - 0.12; rib.position.y = HEAD_Y + 0.26; rib.position.z = -0.02;
    rib.scale.set(1, 0.95, 1);
    head.add(rib);
    const pom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 3), furMat(C.accent2, { roughness: 0.95, sheen: 1 }));
    pom.position.set(0, HEAD_Y + HEAD_R * hh + 0.07, -0.06);
    head.add(pom);
    rig.pompom = pom;
  }

  /* ---------------- Envelope prop (Courier / Excited) ---------------- */
  const envelope = new THREE.Group();
  const envBody = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.24, 0.025), furMat(0xFFFDF8, { roughness: 0.5 }));
  const flapGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.18, 0.12, 0.014), new THREE.Vector3(0.18, 0.12, 0.014), new THREE.Vector3(0, -0.02, 0.014)]);
  flapGeo.computeVertexNormals();
  const flap = new THREE.Mesh(flapGeo, furMat(0xFFD6DE, { side: THREE.DoubleSide }));
  const seal = new THREE.Mesh(heartGeometry(0.42, 0.1), glossMat(0xFF4F7B));
  seal.position.set(0, -0.015, 0.024);
  envelope.add(envBody, flap, seal);
  envelope.position.set(0, 0.52, 0.5 * bw);
  envelope.visible = false;
  spine.add(envelope);
  rig.envelope = envelope;

  rig.bones = { ...rig.bones, root, spine, chest, neck, head, tail_01: tail, leg_L: rig.legs[0], leg_R: rig.legs[1] };
  rig.headCenter = new THREE.Vector3(0, NECK_Y + HEAD_Y, 0);
  rig.headTopY = NECK_Y + HEAD_Y + HEAD_R * hh;

  root.traverse(o => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; } });
  return rig;
}

export function disposeObject(obj) {
  obj.traverse(o => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) {
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        for (const k of ['map', 'normalMap', 'roughnessMap', 'emissiveMap']) if (m[k]) m[k].dispose();
        m.dispose();
      }
    }
  });
}
