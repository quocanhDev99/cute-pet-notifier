import * as THREE from 'three';
import { heartGeometry } from './character-builder.js';

/** Emotion particle / overlay effects. Each effect fades in/out smoothly. */

function textSprite(text, { color = '#ffffff', stroke = 'rgba(60,30,50,0.55)', size = 96, font = '900' } = {}) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.font = `${font} ${size}px "SF Pro Rounded", "Nunito", "Arial Rounded MT Bold", system-ui, sans-serif`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineJoin = 'round'; g.lineWidth = 14; g.strokeStyle = stroke;
  g.strokeText(text, 64, 68);
  g.fillStyle = color;
  g.fillText(text, 64, 68);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  const s = new THREE.Sprite(mat);
  s.renderOrder = 10;
  return s;
}

const rand = (a, b) => a + Math.random() * (b - a);

export class EffectsSystem {
  constructor(rig) {
    this.rig = rig;
    this.group = new THREE.Group();
    rig.root.add(this.group);
    this.weights = {};
    this.effects = {};
    this.burstTime = -1;
    const hc = rig.headCenter;
    const top = rig.headTopY;
    this.hc = hc;
    this.top = top;

    // Hearts (also used for the petting burst)
    const hg = heartGeometry(1.25, 0.35);
    this.hearts = Array.from({ length: 5 }, (_, i) => {
      const m = new THREE.Mesh(hg, new THREE.MeshPhysicalMaterial({ color: i % 2 ? 0xFF5C8A : 0xFF2E63, roughness: 0.2, clearcoat: 1, transparent: true, emissive: 0xff2050, emissiveIntensity: 0.18 }));
      m.userData = { phase: i / 5, x: (i % 2 ? 1 : -1) * rand(0.45, 0.7), z: rand(0.1, 0.4) };
      m.renderOrder = 5;
      this.group.add(m);
      return m;
    });

    // Sparkles & stars
    const mk = (txt, color, n) => Array.from({ length: n }, (_, i) => {
      const s = textSprite(txt, { color, stroke: 'rgba(255,255,255,0.0)', size: 104 });
      const a = (i / n) * Math.PI * 2;
      s.userData = { a, r: rand(0.62, 0.85), y: hc.y + rand(-0.3, 0.45), ph: rand(0, 6) };
      this.group.add(s);
      return s;
    });
    this.sparkles = mk('✦', '#FFE27A', 6);
    this.stars = mk('★', '#FFC93C', 5);

    // Anger vein 💢
    this.vein = new THREE.Group();
    const veinMat = new THREE.MeshStandardMaterial({ color: 0xE5243B, emissive: 0xff2a2a, emissiveIntensity: 0.5, roughness: 0.3, transparent: true });
    for (let i = 0; i < 4; i++) {
      const arc = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.017, 8, 16, Math.PI / 2), veinMat);
      arc.rotation.z = i * Math.PI / 2;
      const off = 0.07;
      arc.position.set(i === 0 || i === 3 ? off : -off, i < 2 ? off : -off, 0);
      this.vein.add(arc);
    }
    this.vein.position.set(0.42, top - 0.1, 0.32);
    this.group.add(this.vein);

    // Steam puffs
    const puffMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.8, depthWrite: false });
    this.steam = Array.from({ length: 6 }, (_, i) => {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.07, 2), puffMat.clone());
      m.userData = { side: i % 2 ? 1 : -1, ph: i / 6 };
      this.group.add(m);
      return m;
    });

    // Tears (attached to the eye sockets so they follow the head)
    const tearGeo = new THREE.SphereGeometry(0.03, 12, 10);
    tearGeo.scale(0.8, 1.25, 0.8);
    this.tears = [];
    for (const key of ['L', 'R']) {
      const socket = rig.eyes[key].socket;
      for (let i = 0; i < 2; i++) {
        const d = new THREE.Mesh(tearGeo, rig.materials.tear.clone());
        d.userData = { ph: i * 0.5 + (key === 'L' ? 0.25 : 0) };
        socket.add(d);
        this.tears.push(d);
      }
    }

    // Zzz
    this.zzz = [0, 1, 2].map(i => {
      const s = textSprite('Z', { color: '#B9C7FF', stroke: 'rgba(70,80,160,0.6)', size: 100 });
      s.userData = { ph: i / 3 };
      this.group.add(s);
      return s;
    });

    // Thinking ? + dots
    this.question = textSprite('?', { color: '#FFFFFF', stroke: 'rgba(90,70,160,0.75)', size: 110 });
    this.group.add(this.question);
    this.dots = [0, 1, 2].map(i => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.03 + i * 0.012, 12, 10), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4, transparent: true }));
      m.position.set(0.42 + i * 0.09, top - 0.1 + i * 0.1, 0.25);
      this.group.add(m);
      return m;
    });

    // Sweat & exclaim
    this.sweat = new THREE.Mesh(tearGeo, rig.materials.tear.clone());
    this.sweat.scale.setScalar(1.6);
    this.sweat.position.set(-0.55, hc.y + 0.2, 0.25);
    this.group.add(this.sweat);
    this.exclaim = textSprite('!', { color: '#FFD33D', stroke: 'rgba(160,60,20,0.8)', size: 118 });
    this.group.add(this.exclaim);

    this.groups = {
      hearts: this.hearts, sparkles: this.sparkles, stars: this.stars, vein: [this.vein], steam: this.steam,
      tears: this.tears, zzz: this.zzz, question: [this.question, ...this.dots], sweat: [this.sweat], exclaim: [this.exclaim]
    };
    for (const k of Object.keys(this.groups)) { this.weights[k] = 0; this.setVisible(k, false); }
    this.active = new Set();
  }

  setVisible(key, v) { for (const o of this.groups[key]) o.visible = v; }

  setActive(list) { this.active = new Set(list || []); }

  burstHearts() { this.burstTime = 0; }

  setOpacity(obj, a) {
    if (obj.isGroup) { obj.children.forEach(c => this.setOpacity(c, a)); return; }
    if (obj.material) obj.material.opacity = a;
  }

  get busy() {
    return Object.values(this.weights).some(w => w > 0.01) || this.burstTime >= 0;
  }

  update(t, dt) {
    const k = 1 - Math.exp(-dt * 6);
    for (const key of Object.keys(this.groups)) {
      const target = this.active.has(key) || (key === 'hearts' && this.burstTime >= 0) ? 1 : 0;
      this.weights[key] += (target - this.weights[key]) * k;
      if (this.weights[key] < 0.01 && target === 0) { this.weights[key] = 0; this.setVisible(key, false); }
      else this.setVisible(key, true);
    }
    const W = this.weights;
    const hc = this.hc, top = this.top;

    if (W.hearts > 0) {
      const burst = this.burstTime >= 0;
      if (burst) { this.burstTime += dt; if (this.burstTime > 1.4) this.burstTime = -1; }
      this.hearts.forEach((h, i) => {
        const u = h.userData;
        let p;
        if (burst && !this.active.has('hearts')) p = Math.min(1, this.burstTime / 1.3 + i * 0.04);
        else p = (t * 0.45 + u.phase) % 1;
        h.position.set(u.x * (0.75 + p * 0.5), hc.y - 0.1 + p * 1.0, u.z + 0.15);
        const pop = Math.min(1, p * 6);
        h.scale.setScalar(0.85 * pop * (1 - p * 0.3));
        h.rotation.set(0, Math.sin(t * 2 + i) * 0.6, Math.sin(t * 3 + i) * 0.2);
        this.setOpacity(h, W.hearts * (1 - p) * 1.2);
      });
    }

    for (const [key, list] of [['sparkles', this.sparkles], ['stars', this.stars]]) {
      if (W[key] <= 0) continue;
      list.forEach((s) => {
        const u = s.userData;
        const a = u.a + t * 0.6;
        s.position.set(Math.cos(a) * u.r, u.y + Math.sin(t * 2 + u.ph) * 0.05, 0.25 + Math.sin(a) * 0.2);
        const tw = 0.5 + 0.5 * Math.sin(t * 6 + u.ph);
        s.scale.setScalar((0.12 + tw * 0.1) * (key === 'stars' ? 1.25 : 1));
        s.material.opacity = W[key] * (0.4 + tw * 0.6);
      });
    }

    if (W.vein > 0) {
      const pulse = 1 + Math.max(0, Math.sin(t * 9)) * 0.28;
      this.vein.scale.setScalar(W.vein * pulse);
      this.setOpacity(this.vein, W.vein);
    }

    if (W.steam > 0) {
      this.steam.forEach((m) => {
        const u = m.userData;
        const p = (t * 0.9 + u.ph) % 1;
        m.position.set(u.side * (0.55 + p * 0.25), top - 0.25 + p * 0.55, 0.1);
        m.scale.setScalar(0.6 + p * 1.4);
        m.material.opacity = W.steam * 0.75 * (1 - p);
      });
    }

    if (W.tears > 0) {
      this.tears.forEach((d) => {
        const p = (t * 0.7 + d.userData.ph) % 1;
        d.position.set(0.02, -0.07 - p * 0.32, 0.03 + p * 0.06);
        d.scale.setScalar(0.6 + p * 0.6);
        d.material.opacity = W.tears * (p < 0.85 ? 0.9 : (1 - p) * 6);
      });
    }

    if (W.zzz > 0) {
      this.zzz.forEach((s) => {
        const p = (t * 0.28 + s.userData.ph) % 1;
        s.position.set(0.35 + p * 0.5, top - 0.1 + p * 0.65, 0.2);
        s.scale.setScalar(0.14 + p * 0.22);
        s.material.rotation = Math.sin(t + s.userData.ph * 5) * 0.25;
        s.material.opacity = W.zzz * Math.sin(p * Math.PI);
      });
    }

    if (W.question > 0) {
      this.question.position.set(0.62, top + 0.18 + Math.sin(t * 2.4) * 0.04, 0.2);
      this.question.material.rotation = Math.sin(t * 1.7) * 0.18;
      this.question.scale.setScalar(0.34 * W.question);
      this.question.material.opacity = W.question;
      this.dots.forEach((d, i) => { d.material.opacity = W.question * (0.5 + 0.5 * Math.sin(t * 4 - i)); });
    }

    if (W.sweat > 0) {
      const p = (t * 0.6) % 1;
      this.sweat.position.set(-0.55, hc.y + 0.25 - p * 0.18, 0.25);
      this.sweat.material.opacity = W.sweat * (1 - p * 0.6);
    }
    if (W.exclaim > 0) {
      this.exclaim.position.set(-0.5, top + 0.12, 0.2);
      this.exclaim.scale.setScalar((0.3 + Math.max(0, Math.sin(t * 8)) * 0.06) * W.exclaim);
      this.exclaim.material.opacity = W.exclaim;
    }
  }

  dispose() {
    this.group.traverse(o => {
      if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); }
      if (o.geometry) o.geometry.dispose();
    });
  }
}
