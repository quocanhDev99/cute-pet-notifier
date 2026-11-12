/**
 * Runs REAL PetStage frames (procedural rig, no WebGL) for every pet and interaction state.
 * The render loop swallows per-frame errors so the app keeps running — which also means a broken
 * update() shows up only as an invisible pet. This test makes such errors fail loudly instead.
 */
import test from 'node:test';
import assert from 'node:assert';
import * as THREE from 'three';

// Minimal canvas stub: 2D drawing calls are accepted and ignored (textures for shadow / faces / fx).
const ctx2d = new Proxy({}, {
  get: (_t, k) => (k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}),
  set: () => true
});
globalThis.document = globalThis.document || {
  createElement: () => ({ width: 0, height: 0, style: {}, getContext: () => ctx2d }),
  addEventListener() {}, removeEventListener() {}
};

const { PetStage } = await import('../src/renderer/js/pet/pet-stage.js');
const { SPECIES } = await import('../src/renderer/js/pet/species.js');
const { EMOTION_SCHEMA } = await import('../src/shared/emotion-constants.js');

function headlessStage(species) {
  const s = Object.create(PetStage.prototype);
  Object.assign(s, {
    opts: { assetBase: '/', onFrame: () => {} }, onEvent: () => {}, holds: new Set(), awakeUntil: 0,
    lookTarget: new THREE.Vector2(), look: new THREE.Vector2(), evade: new THREE.Vector3(), evadeTarget: new THREE.Vector3(),
    blink: { next: 2, t: -1 }, pettingScore: 0, grabVelocity: { x: 0, y: 0 }, faceShown: {}, frameTimes: [],
    preset: { motionSpeed: 1, evasionSensitivity: 0.5 }, intensity: 1, petSensitivity: 1,
    renderer: { domElement: { clientWidth: 220, clientHeight: 240 }, render() {} },
    wake() {}, start() {} // frames are driven by the test, not requestAnimationFrame
  });
  assert.ok(PetStage.toString().includes('this.drag = {'), 'carry-physics state exists');
  s.drag = { held: false, ptr: null, prev: null, vx: 0, vy: 0, ang: 0, angV: 0, pin: 0, h: 0, hv: 0, sy: 1, syV: 0, dizzy: 0 };
  // Same graph as initScene() (which needs WebGL for its environment map): camera, pivot with the
  // floor shadow, and the `body` group the pet lives in.
  s.scene = new THREE.Scene();
  s.camera = new THREE.PerspectiveCamera(30, 220 / 240, 0.1, 50);
  s.camera.position.set(0, 1.05, 5.5);
  s.camera.lookAt(0, 0.95, 0);
  s.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), new THREE.MeshBasicMaterial({ transparent: true }));
  s.pivot = new THREE.Group();
  s.pivot.add(s.shadow);
  s.body = new THREE.Group();
  s.pivot.add(s.body);
  s.scene.add(s.pivot);
  return s;
}

test('PetStage.update runs real frames for every pet, emotion, action and drag state', async () => {
  const { AnimationController } = await import('../src/renderer/js/pet/animation-controller.js');
  for (const id of Object.keys(SPECIES)) {
    const s = headlessStage(id);
    s.anim = new AnimationController({ onEvent: () => {} });
    s.useProcedural(id);
    const frames = (n, fn) => { for (let i = 0; i < n; i++) { if (fn) fn(i); s.update(1 / 60); } };
    frames(30);
    for (const e of EMOTION_SCHEMA) { s.setEmotion(e.id); frames(20); }
    for (const a of ['wave', 'pet', 'kick', 'reject']) { s.play(a); frames(40); }
    // Carry: pick up, drag fast, shake, release (fall + bounce), dizzy wobble.
    s.setGrabbed(true);
    frames(60, (i) => s.dragPointer(400 + i * 25 * (i % 10 < 5 ? 1 : -1), 300 - i));
    s.setDizzy();
    s.setGrabbed(false);
    frames(180);
    assert.ok(s.dragSettled(), `${id}: carry physics settles after landing`);
    const head = s.headAnchor();
    assert.ok(head && Number.isFinite(head.x) && Number.isFinite(head.y), `${id}: head anchor is a screen point`);
    s.body.updateMatrixWorld(true);
    assert.ok([s.body.position.x, s.body.position.y, s.body.rotation.z].every(Number.isFinite), `${id}: body transform is finite`);
  }
});
