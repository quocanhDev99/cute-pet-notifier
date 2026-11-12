import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { buildCharacter, disposeObject } from './character-builder.js';
import { getSpecies } from './species.js';
import { AnimationController } from './animation-controller.js';
import { resolveSemanticBones, resolveClip, morphWeightsFor } from './semantic-map.js';
import { EffectsSystem } from './fx.js';

const HEAD_R = 0.58; // procedural head radius (character-builder)
const _anchor = new THREE.Vector3();

/** Frame rate while the pet only holds a resting mood (no card, no interaction). */
// 30 divides 60 / 120 Hz refresh evenly: 24 fps gave uneven 33/50 ms frame steps (visible judder).
const MOOD_FPS = 30;

const EYE_TYPES = ['open', 'arcHappy', 'arcClosed', 'star', 'heart'];

/**
 * PetStage — one WebGL stage hosting one character.
 *  • All poses come from a single AnimationController (layers, cross-fades, priorities)
 *  • Procedural parametric rig (fallback) or a production GLB (assets/pets/{id}/model.glb)
 *    driven through a per-character semantic map + clip aliases from pet.json
 *  • Render-on-demand: the loop stops entirely when nothing moves (0% CPU hibernation),
 *    and pause() stops it unconditionally for Hidden / Gaming presence.
 */
export class PetStage {
  constructor(container, opts = {}) {
    this.container = container;
    this.opts = { interactive: true, ambient: true, assetBase: './assets/', ...opts };
    this.onEvent = opts.onEvent || (() => {});
    this.anim = new AnimationController({ onEvent: (type, d) => this.onAnimEvent(type, d) });
    this.holdMode = null;
    this.holdSide = 'left';
    this.annoying = false;
    this.preset = { motionSpeed: 1, evasionSensitivity: 0.5 };
    this.intensity = 1;
    this.petSensitivity = 1;
    this.awakeUntil = 0;
    this.holds = new Set();
    this.running = false;
    this.paused = false;
    this.look = new THREE.Vector2();
    this.lookTarget = new THREE.Vector2();
    this.evade = new THREE.Vector3();
    this.evadeTarget = new THREE.Vector3();
    this.blink = { next: 2, t: -1 };
    this.pettingScore = 0;
    this.lastPointer = null;
    this.grabVelocity = { x: 0, y: 0 };
    // Carry physics (screen px for the pointer, scene units for the body).
    this.drag = {
      held: false, ptr: null, prev: null, vx: 0, vy: 0, // pointer + smoothed velocity (px/s)
      ang: 0, angV: 0,       // pendulum swing around the grab point (rad)
      pin: 0,                // 1 = hanging from the grab point, 0 = standing on the feet
      h: 0, hv: 0,           // height above the floor + vertical speed
      sy: 1, syV: 0,         // vertical squash/stretch spring
      dizzy: 0               // post-shake wobble amplitude
    };
    this.disposed = false;
    this.faceShown = {};
    this.frameTimes = [];

    this.initRenderer();
    this.initScene();
    if (this.opts.interactive) this.initPointer();
    this.loop = this.loop.bind(this);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(container);
    this.onVisibility = () => { this.lastFrame = performance.now(); };
    document.addEventListener('visibilitychange', this.onVisibility);
    this.setSpecies(opts.species || 'cat_mochi');
    if (this.opts.ambient) this.scheduleAmbient();
  }

  /* ------------------------------------------------------------ setup */

  initRenderer() {
    const r = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance', premultipliedAlpha: true });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 1.0;
    r.setClearColor(0x000000, 0);
    r.domElement.className = 'pet-canvas';
    r.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:none';
    this.container.appendChild(r.domElement);
    this.renderer = r;
    this.resize(false);
  }

  initScene() {
    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    this.scene.environment = this.envTex;
    this.scene.environmentIntensity = 0.4;

    this.camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camera.position.set(0, 1.05, 5.5);
    this.camera.lookAt(0, 0.95, 0);

    this.scene.add(new THREE.HemisphereLight(0xFFF4EA, 0xC9D3FF, 1.0));
    const key = new THREE.DirectionalLight(0xFFF1E0, 2.3);
    key.position.set(2.6, 4.2, 4.5);
    const rim = new THREE.DirectionalLight(0xCFE0FF, 1.6);
    rim.position.set(-3.2, 2.8, -3.4);
    const rimWarm = new THREE.DirectionalLight(0xFFD6E8, 0.9);
    rimWarm.position.set(3.4, 1.2, -2.6);
    const fill = new THREE.PointLight(0xFFE7D1, 0.6, 9);
    fill.position.set(-1.4, 0.4, 3.2);
    this.scene.add(key, rim, rimWarm, fill);

    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const g = c.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 4, 64, 64, 62);
    grad.addColorStop(0, 'rgba(70,40,60,0.55)');
    grad.addColorStop(0.55, 'rgba(70,40,60,0.18)');
    grad.addColorStop(1, 'rgba(70,40,60,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.003;

    this.pivot = new THREE.Group();
    this.pivot.add(this.shadow);
    // The pet itself lives in `body`: it swings / lifts / falls while the shadow stays on the floor.
    this.body = new THREE.Group();
    this.pivot.add(this.body);
    this.scene.add(this.pivot);
  }

  resize(render = true) {
    const w = Math.max(1, this.container.clientWidth || 240);
    const h = Math.max(1, this.container.clientHeight || 240);
    this.renderer.setSize(w, h, false);
    if (this.camera) { this.camera.aspect = w / h; this.camera.updateProjectionMatrix(); }
    this.size = { w, h };
    if (render && this.rig) this.wake(300);
  }

  /* ------------------------------------------------------------ character */

  async setSpecies(id) {
    this.speciesId = id;
    const token = (this.loadToken = (this.loadToken || 0) + 1);
    this.clearCharacter();
    this.useProcedural(id);
    this.wake(1500);
    // Character package config (semantic map, clip aliases, morph map) is optional.
    this.petConfig = {};
    try {
      const res = await fetch(`${this.opts.assetBase}pets/${id}/pet.json`, { cache: 'no-store' });
      if (res.ok && token === this.loadToken) this.petConfig = await res.json();
    } catch { /* optional */ }
    const url = `${this.opts.assetBase}pets/${id}/model.glb`;
    try {
      const head = await fetch(url, { method: 'HEAD', cache: 'no-store' });
      if (!head.ok || token !== this.loadToken) return;
      const t0 = performance.now();
      const gltf = await new GLTFLoader().loadAsync(url);
      // Superseded or disposed while loading: free the GPU resources nobody will ever show.
      if (token !== this.loadToken || this.disposed) { if (gltf && gltf.scene) disposeObject(gltf.scene); return; }
      this.useGltf(gltf);
      this.onEvent('model', { id, source: 'glb', loadMs: Math.round(performance.now() - t0), bytes: Number(head.headers.get('content-length')) || null });
    } catch (err) {
      this.onEvent('model', { id, source: 'procedural', error: err && err.message });
    }
  }

  reloadModel() { this.setSpecies(this.speciesId); }

  clearCharacter() {
    if (this.rig) {
      this.body.remove(this.rig.root);
      if (this.fx) this.fx.dispose();
      disposeObject(this.rig.root);
    }
    if (this.gltfScene) { this.body.remove(this.gltfScene); disposeObject(this.gltfScene); }
    if (this.mixer) this.mixer.stopAllAction();
    this.rig = null; this.fx = null; this.gltfScene = null; this.mixer = null; this.gltf = null;
    this.faceShown = {};
  }

  useProcedural(id) {
    this.rig = buildCharacter(getSpecies(id));
    this.body.add(this.rig.root);
    this.fx = new EffectsSystem(this.rig);
    this.source = 'procedural';
  }

  useGltf(gltf) {
    const sceneObj = gltf.scene;
    // Normalise: feet at origin, 1.85 units tall, facing +Z.
    const box = new THREE.Box3().setFromObject(sceneObj);
    const size = box.getSize(new THREE.Vector3());
    sceneObj.scale.setScalar(1.85 / Math.max(0.001, size.y));
    const box2 = new THREE.Box3().setFromObject(sceneObj);
    const center = box2.getCenter(new THREE.Vector3());
    sceneObj.position.set(-center.x, -box2.min.y, -center.z);

    const bones = resolveSemanticBones(sceneObj, this.petConfig.semanticMap);
    const morphMeshes = [];
    let triangles = 0;
    sceneObj.traverse(o => {
      if (o.isMesh) {
        if (o.morphTargetDictionary) morphMeshes.push(o);
        const g = o.geometry;
        triangles += g.index ? g.index.count / 3 : (g.attributes.position ? g.attributes.position.count / 3 : 0);
      }
    });
    // Keep the procedural rig for FX anchors, hide its meshes.
    this.rig.root.traverse(o => { if (o.isMesh) o.visible = false; });
    this.body.add(sceneObj);
    this.gltfScene = sceneObj;
    const base = {};
    for (const [k, b] of Object.entries(bones)) if (b) base[k] = b.quaternion.clone();
    this.gltf = { bones, base, morphMeshes, clips: gltf.animations || [], triangles: Math.round(triangles) };
    this.mixer = this.gltf.clips.length ? new THREE.AnimationMixer(sceneObj) : null;
    this.currentClip = null;
    this.source = 'glb';
    this.syncClip();
    this.onEvent('glb-info', { bones: Object.fromEntries(Object.entries(bones).map(([k, v]) => [k, v ? v.name : null])), clips: this.gltf.clips.map(c => c.name), morphs: [...new Set(morphMeshes.flatMap(m => Object.keys(m.morphTargetDictionary)))], triangles: this.gltf.triangles });
    this.wake(1500);
  }

  /** Pick the GLB clip for the current state via aliases; report fallbacks (guide §A4.5). */
  syncClip() {
    if (!this.mixer) return;
    const a = this.anim.actions;
    const want = this.anim.grabbed ? 'grabbed' : a.kick ? 'kick' : a.reject ? 'reject' : a.pet ? 'pet' : a.land ? 'land'
      : this.anim.reaction || (this.holdMode === 'billboard' ? 'hold_card' : this.holdMode) || this.anim.base;
    let clip = resolveClip(this.gltf.clips, want, this.petConfig.clipAliases);
    if (!clip) {
      const usingMorph = morphWeightsFor(want, this.petConfig.morphMap) && this.gltf.morphMeshes.length;
      this.onEvent('fallback', { state: want, using: usingMorph ? 'morph+procedural' : 'procedural', clip: null });
      clip = resolveClip(this.gltf.clips, this.anim.base, this.petConfig.clipAliases) || resolveClip(this.gltf.clips, 'idle', this.petConfig.clipAliases);
    }
    if (!clip || clip === this.currentClip) return;
    const fade = (this.anim.lastProfile && this.anim.lastProfile.duration) || 0.28;
    const next = this.mixer.clipAction(clip);
    const oneShot = ['kick', 'reject', 'pet', 'land', 'surprised', 'excited'].includes(want);
    next.setLoop(oneShot ? THREE.LoopOnce : THREE.LoopRepeat, oneShot ? 1 : Infinity);
    next.clampWhenFinished = oneShot;
    next.reset().setEffectiveWeight(1).fadeIn(fade).play();
    if (this.currentAction && this.currentAction !== next) this.currentAction.fadeOut(fade);
    this.currentAction = next;
    this.currentClip = clip;
  }

  onAnimEvent(type, d) {
    if (type === 'transition' || type === 'state' || type === 'action-done') this.syncClip();
    if (type === 'transition') this.onEvent('transition', d);
  }

  /* ------------------------------------------------------------ public API */

  /** Back-compat: idle/sleeping set the base layer; others set the reaction layer. */
  setEmotion(emotion) {
    if (!emotion || emotion === 'idle') { this.anim.setReaction(null); this.anim.setBase('idle'); }
    else if (emotion === 'sleeping' && !this.holdMode) { this.anim.setReaction(null); this.anim.setBase('sleeping'); }
    else this.anim.setReaction(emotion);
    this.wake(2500);
  }
  setBase(state) { this.anim.setBase(state); this.wake(2000); }
  setReaction(emotion) { this.anim.setReaction(emotion); this.wake(2500); }

  setHold(mode, side = 'left') {
    this.holdMode = mode;
    this.holdSide = side;
    this.anim.setHold(mode, side);
    this.wake(1500);
  }

  setAnnoying(v) { this.annoying = !!v; }
  setPreset(p) {
    if (!p) return;
    this.preset = { motionSpeed: p.motionSpeed || 1, evasionSensitivity: p.evasionSensitivity ?? 0.5 };
    this.anim.setMotionSpeed(this.preset.motionSpeed);
  }
  setIntensity(v) { this.intensity = Math.max(0.3, Math.min(2, v || 1)); }
  setPetSensitivity(v) { this.petSensitivity = Math.max(0.3, Math.min(3, v || 1)); }
  setReducedMotion(on) { this.anim.setReducedMotion(on); this.wake(600); }

  setGrabbed(isGrabbed, velocity) {
    if (velocity) this.grabVelocity = velocity;
    const d = this.drag;
    if (isGrabbed && !d.held) {
      d.sy = 0.84; d.syV = 0; // anticipation: a quick squash, then the spring pops it up
      d.ptr = d.prev = null; d.vx = d.vy = 0;
    }
    if (!isGrabbed && d.held) d.hv = Math.max(d.hv, 0.4); // let go: a tiny upward toss, then gravity
    d.held = !!isGrabbed;
    this.anim.setGrabbed(isGrabbed);
    this.wake(isGrabbed ? 1200 : 1600);
  }

  /** Pointer (or thrown dock) position in screen px while carried: drives the swing. */
  dragPointer(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.drag.ptr = { x, y };
    this.wake(400);
  }

  /** Shaken hard while held: wobble a while after landing. */
  setDizzy() { this.drag.dizzy = 1; this.wake(1800); }

  /**
   * Carry physics — springs, not keyframes, so every drag looks different:
   *  • the body hangs from the grab point (top of the head) and swings like a damped pendulum,
   *    leaning back against the drag direction and overshooting when the hand stops;
   *  • moving up stretches it, moving down squashes it; picking up starts with a squash;
   *  • it is lifted off the floor (the shadow stays down there), and on release it falls with
   *    gravity, squashes on impact and bounces once — 'landed' reports the impact.
   */
  stepDrag(dt) {
    const d = this.drag;
    if (dt <= 0) return;
    const reduced = this.anim.reducedMotion;
    // Pointer velocity from per-frame displacement: zero as soon as the pointer stops.
    let vx = 0, vy = 0;
    if (d.ptr && d.prev) { vx = (d.ptr.x - d.prev.x) / dt; vy = (d.ptr.y - d.prev.y) / dt; }
    if (d.ptr) d.prev = { ...d.ptr };
    const k = 1 - Math.exp(-dt * 14);
    d.vx += (Math.max(-4000, Math.min(4000, vx)) - d.vx) * k;
    d.vy += (Math.max(-4000, Math.min(4000, vy)) - d.vy) * k;

    // Pendulum: target lean from the (air-dragged) velocity, underdamped spring toward it.
    const target = reduced ? 0 : Math.max(-0.42, Math.min(0.42, -d.vx * 0.0003));
    const K = 55, C = 7.5;
    d.angV += (K * (target - d.ang) - C * d.angV) * dt;
    d.ang += d.angV * dt;
    if (reduced) { d.ang = 0; d.angV = 0; }

    // Hanging point blends in / out (smooth hand-over between head pivot and feet pivot).
    d.pin += ((d.held ? 1 : 0) - d.pin) * (1 - Math.exp(-dt * 8));

    // Height: lifted while held; free fall + one bounce after release.
    if (d.held) {
      d.h += (0.18 - d.h) * (1 - Math.exp(-dt * 10)); // on top of the grab pose's own lift
      d.hv = 0;
    } else if (d.h > 0 || d.hv > 0) {
      d.hv -= 11 * dt;
      d.h += d.hv * dt;
      if (d.h <= 0) {
        const impact = -d.hv;
        d.h = 0;
        if (impact > 0.9 && !reduced) {
          d.hv = impact * 0.28;                      // one small bounce
          d.sy = 1 - Math.min(0.28, impact * 0.11);  // squash on impact
          d.syV = 0;
        } else d.hv = 0;
        if (impact > 0.4) this.onEvent('landed', { impact });
      }
    }

    // Squash & stretch spring (vertical speed while carried stretches / squashes).
    const syTarget = 1 + (reduced ? 0 : Math.max(-0.07, Math.min(0.12, -d.vy * 0.00007)) * d.pin);
    d.syV += (190 * (syTarget - d.sy) - 13 * d.syV) * dt;
    d.sy += d.syV * dt;

    d.dizzy = Math.max(0, d.dizzy - dt * 0.7);
  }

  /** Apply the carry physics to the body group (rotation about the grab point when held). */
  applyDrag(t) {
    const d = this.drag, b = this.body;
    const wobble = d.dizzy > 0 ? Math.sin(t * 13) * 0.22 * d.dizzy * d.dizzy : 0;
    const ang = d.ang * Math.max(d.pin, 0.35) + wobble;
    const py = 1.9 * d.pin; // grab point: top of the head while held, the feet when standing
    b.rotation.z = ang;
    b.position.x = py * Math.sin(ang);
    b.position.y = d.h + py * (1 - Math.cos(ang));
    const sy = Math.max(0.6, d.sy);
    b.scale.set(1 / Math.sqrt(sy), sy, 1 / Math.sqrt(sy));
  }

  /** Carry physics at rest (nothing left to animate). */
  dragSettled() {
    const d = this.drag;
    return !d.held && d.h <= 0 && d.hv === 0 && Math.abs(d.ang) < 0.003 && Math.abs(d.angV) < 0.02 &&
      Math.abs(d.sy - 1) < 0.003 && Math.abs(d.syV) < 0.02 && d.pin < 0.01 && d.dizzy <= 0 &&
      Math.abs(d.vx) < 1 && Math.abs(d.vy) < 1;
  }

  play(action) {
    if (action === 'kick') { this.kickFired = false; this.kickStart = this.anim.time; }
    if (!this.anim.trigger(action)) return;
    if (action === 'pet' && this.fx) this.fx.burstHearts();
    this.syncClip();
    this.wake(1600);
  }

  hold(reason) { this.holds.add(reason); this.start(); }
  release(reason) { this.holds.delete(reason); this.wake(800); }

  /** Hidden / Gaming presence: stop rendering entirely (0% GPU/CPU) until resume(). */
  pause() { this.paused = true; this.running = false; }
  resume() { if (!this.paused) return; this.paused = false; this.lastFrame = performance.now(); this.wake(1200); }

  /**
   * Screen point just above-right of the pet's head (canvas CSS px), for UI that must sit NEXT to
   * the head (unread badge) instead of on it. Follows hops, stretches and the grab camera.
   * The procedural rig keeps animating under a GLB model (FX anchors), so it works for both.
   */
  headAnchor() {
    const head = this.rig && this.rig.head;
    if (!head) return null;
    head.updateWorldMatrix(true, false);
    _anchor.set(HEAD_R * 0.62, HEAD_R * 0.78, 0).applyMatrix4(head.matrixWorld).project(this.camera);
    const el = this.renderer.domElement;
    const w = el.clientWidth, h = el.clientHeight;
    if (!w || !h || !Number.isFinite(_anchor.x)) return null;
    return { x: (_anchor.x + 1) / 2 * w, y: (1 - _anchor.y) / 2 * h };
  }

  /** Eased motions (look-at, evade) have arrived at their targets. */
  motionSettled() {
    return this.look.distanceToSquared(this.lookTarget) < 1e-4 && this.evade.distanceToSquared(this.evadeTarget) < 1e-5 && this.dragSettled();
  }

  wake(ms = 1000) {
    this.awakeUntil = Math.max(this.awakeUntil, performance.now() + ms);
    this.start();
  }

  start() {
    if (this.running || this.disposed || this.paused) return;
    this.running = true;
    this.lastFrame = performance.now();
    requestAnimationFrame(this.loop);
  }

  /* ------------------------------------------------------------ pointer */

  /** addEventListener that dispose() undoes (the overlay listens on `document`, which outlives us). */
  listen(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    (this.listeners || (this.listeners = [])).push([target, type, fn, opts]);
  }

  initPointer() {
    this.raycaster = new THREE.Raycaster();
    const el = this.renderer.domElement;
    const ndc = new THREE.Vector2();
    // Overlay mode (opts.pointerTarget = document): the canvas never takes the mouse itself
    // (pointer-events: none), so it can't steal clicks from the card it overlaps. Instead we listen on
    // the page and decide by ray-casting the 3D pet — the ONE source of truth for "is the cursor on
    // the pet". Elsewhere (Control Center preview) the canvas listens directly, as before.
    const target = this.opts.pointerTarget || el;
    const routed = target !== el;
    const cursorEl = routed ? document.documentElement : el;
    const ignore = (e) => routed && this.opts.ignorePointer && this.opts.ignorePointer(e);
    const insideCanvas = (e) => {
      const r = el.getBoundingClientRect();
      return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
    };

    const hitTest = this.hitTest = (e) => {
      if (routed && !insideCanvas(e)) return { over: false, head: false };
      const r = el.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      this.raycaster.setFromCamera(ndc, this.camera);
      const target = this.gltfScene || (this.rig && this.rig.root);
      if (!target) return { over: false, head: false };
      const hits = this.raycaster.intersectObject(target, true).filter(h => h.object.visible || this.gltfScene);
      if (!hits.length) return { over: false, head: false };
      let o = hits[0].object, head = false;
      while (o) { if (o === (this.rig && this.rig.head)) { head = true; break; } o = o.parent; }
      if (this.gltfScene) head = hits[0].point.y - this.pivot.position.y > 1.0;
      return { over: true, head };
    };

    const leave = () => {
      this.pointerInside = false;
      this.lookTarget.set(0, 0);
      this.evadeTarget.set(0, 0, 0);
      this.pettingScore = 0;
      this.lastPointer = null;
      cursorEl.style.cursor = '';
      this.wake(800);
    };

    this.listen(target, 'pointermove', (e) => {
      if (routed && (!insideCanvas(e) || ignore(e))) { if (this.pointerInside) leave(); return; }
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width) * 2 - 1;
      const ny = -((e.clientY - r.top) / r.height) * 2 + 1;
      const hit = hitTest(e);
      cursorEl.style.cursor = hit.over ? (this.annoying ? 'not-allowed' : 'grab') : (routed ? '' : 'default');
      this.pointerInside = true;

      if (this.annoying) {
        const sens = 0.4 + this.preset.evasionSensitivity;
        this.evadeTarget.set(-nx * 0.35 * sens, 0, -0.35 * sens);
        this.lookTarget.set(-nx * 1.2, -0.3);
      } else {
        this.evadeTarget.set(0, 0, 0);
        this.lookTarget.set(nx, ny);
      }

      const now = performance.now();
      if (this.lastPointer && hit.head && !this.anim.grabbed) {
        const dt = Math.max(1, now - this.lastPointer.t) / 1000;
        const speed = Math.hypot(e.clientX - this.lastPointer.x, e.clientY - this.lastPointer.y) / dt;
        if (speed > 220) this.pettingScore += Math.min(speed, 2500) * dt * this.petSensitivity;
        if (this.pettingScore > 650) { this.pettingScore = 0; this.touch(); }
      }
      this.lastPointer = { x: e.clientX, y: e.clientY, t: now };
      this.wake(1500);
    });

    // Leaving the canvas (direct mode) or the whole window (routed mode).
    this.listen(routed ? document.documentElement : el, 'pointerleave', leave);

    // Capture phase in routed mode: clicks on card buttons or inside notification cards must always
    // pass through to the card elements directly, never intercepted by the pet's body/double-tap.
    this.listen(target, 'click', (e) => {
      if (ignore(e) || (e.target && e.target.closest && (e.target.closest('.card') || e.target.closest('.card-slot')))) return;
      if (this.suppressClick) { this.suppressClick = false; if (routed && hitTest(e).over) { e.stopPropagation(); e.preventDefault(); } return; }
      const hit = hitTest(e);
      if (!hit.over) return;
      e.stopPropagation(); if (routed) e.preventDefault();
      // Head = petting (a tap or a rub, never anything else). Body = one tap waves, a DOUBLE tap
      // asks the host to open the Control Center ('body-double'). The single tap waits a moment
      // so a double tap doesn't also wave.
      if (hit.head) { this.touch(); return; }
      const now = performance.now();
      if (this.bodyTapAt && now - this.bodyTapAt < 320) {
        clearTimeout(this.bodyTapTimer);
        this.bodyTapAt = 0;
        this.onEvent('body-double', {});
        return;
      }
      this.bodyTapAt = now;
      clearTimeout(this.bodyTapTimer);
      this.bodyTapTimer = setTimeout(() => {
        this.bodyTapAt = 0;
        if (this.anim.grabbed || this.disposed) return;
        this.play('wave');
        this.onEvent('body-tap', {});
      }, 320);
    }, routed ? { capture: true } : false);
  }

  lookAtScreenPoint(clientX, clientY) {
    if (this.pointerInside || this.paused) return;
    const r = this.renderer.domElement.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height * 0.35;
    const dx = (clientX - cx) / (window.innerWidth * 0.5);
    const dy = -(clientY - cy) / (window.innerHeight * 0.5);
    if (this.annoying) this.lookTarget.set(-Math.sign(dx) * 0.8, -0.2);
    else this.lookTarget.set(Math.max(-1, Math.min(1, dx * 1.6)), Math.max(-1, Math.min(1, dy * 1.6)));
    this.wake(600);
  }

  touch() {
    if (this.anim.grabbed) return;
    if (this.annoying) { this.play('reject'); this.onEvent('rejected', {}); }
    else { this.play('pet'); this.onEvent('petted', {}); }
  }

  scheduleAmbient() {
    clearTimeout(this.ambientTimer);
    this.ambientTimer = setTimeout(() => {
      if (this.disposed) return;
      if (!this.running && !this.paused && this.opts.ambient) {
        if (Math.random() < 0.35 && this.anim.base === 'idle' && !this.anim.reaction && !this.anim.reducedMotion) this.play('wave');
        this.blink.next = 0.2;
        this.wake(1400);
      }
      this.scheduleAmbient();
    }, 25000 + Math.random() * 20000);
  }

  /* ------------------------------------------------------------ frame */

  loop(now) {
    if (this.disposed || this.paused) { this.running = false; return; }
    // A resting mood (angry puffs, sparkles, zzz…) keeps animating, but at a gentle frame rate so a
    // pet that just sits there doesn't cost a full-speed render loop. Skipped frames don't advance
    // lastFrame, so the animation keeps real-time speed.
    // Half a refresh of tolerance so frames land on every 2nd vsync instead of drifting.
    if (this.holds.size === 1 && this.holds.has('mood') && now - this.lastFrame < 1000 / MOOD_FPS - 4 && now > this.awakeUntil && !this.anim.busy && this.motionSettled()) {
      requestAnimationFrame(this.loop);
      return;
    }
    const rawDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    // Never stop mid-motion: a head turn / evade still easing toward its target used to freeze
    // half-way when the wake window ran out, then jump on the next wake.
    const settled = !this.holds.size && now > this.awakeUntil && !this.anim.busy && !(this.fx && (this.fx.busy || this.fx.active.size > 0)) && this.motionSettled();
    if (settled) { this.running = false; return; }
    try {
      const t0 = performance.now();
      this.update(rawDt);
      this.renderer.render(this.scene, this.camera);
      if (this.opts.measure) this.recordFrame(rawDt * 1000, performance.now() - t0);
    } catch (err) {
      // Animation errors must never kill the render loop (guide §A1).
      if (!this.lastError || now - this.lastError > 5000) { console.error('[PetStage] frame error:', err && err.message); this.lastError = now; }
    }
    requestAnimationFrame(this.loop);
  }

  recordFrame(intervalMs, cpuMs) {
    this.frameTimes.push({ intervalMs, cpuMs });
    if (this.frameTimes.length > 3000) this.frameTimes.shift();
  }

  /** Real frame statistics collected while `opts.measure` is on. */
  frameStats() {
    const f = this.frameTimes.filter(x => x.intervalMs > 0 && x.intervalMs < 250);
    const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.ceil(p / 100 * s.length) - 1)] : null; };
    const iv = f.map(x => x.intervalMs), cpu = f.map(x => x.cpuMs);
    const avg = iv.reduce((a, b) => a + b, 0) / (iv.length || 1);
    return {
      frames: f.length,
      fpsAvg: iv.length ? +(1000 / avg).toFixed(1) : null,
      frameTimeP50: pct(iv, 50) && +pct(iv, 50).toFixed(2),
      frameTimeP95: pct(iv, 95) && +pct(iv, 95).toFixed(2),
      fps1Low: iv.length ? +(1000 / pct(iv, 99)).toFixed(1) : null,
      cpuP50: pct(cpu, 50) && +pct(cpu, 50).toFixed(2),
      cpuP95: pct(cpu, 95) && +pct(cpu, 95).toFixed(2),
      drawCalls: this.renderer.info.render.calls,
      triangles: this.renderer.info.render.triangles
    };
  }

  applyFace(face, blinkFactor) {
    const rig = this.rig;
    const s = this.faceShown;
    if (s.eyes !== face.eyes || s.tears !== face.tears) {
      for (const key of ['L', 'R']) {
        const e = rig.eyes[key];
        for (const t of EYE_TYPES) e[t].visible = t === face.eyes;
        e.pool.visible = !!face.tears;
        e.open.userData.extraHighlight.visible = !!face.tears;
      }
    }
    if (s.mouth !== face.mouth) for (const [name, m] of Object.entries(rig.mouths)) m.visible = name === face.mouth;
    if (s.envelope !== face.envelope) rig.envelope.visible = !!face.envelope && !this.gltfScene;
    this.faceShown = { ...face };
    // Face swaps are hidden behind the blink factor (1 = open, ~0.08 = closed)
    rig.mouth.scale.setScalar(0.25 + 0.75 * blinkFactor);
    return blinkFactor;
  }

  update(rawDt) {
    if (!this.rig) return;
    const F = this.anim.update(rawDt);
    const { dt, time: t, pose: p, face } = F;
    const I = this.intensity;
    const A = this.anim;
    const grab = F.grab;

    // Picked up, the pet stretches (squash 1.18) and lifts (+0.5): its head + ears reach y≈3.0,
    // above the normal frame top (≈2.3), so the head got cut off. Reframe while held: raise
    // the camera and step back a little so the whole stretched pet stays inside the canvas.
    if (this.camGrab !== grab) {
      this.camGrab = grab;
      this.camera.position.set(0, 1.05 + 0.8 * grab, 5.5 + 1.1 * grab);
      this.camera.lookAt(0, 0.95 + 0.8 * grab, 0);
    }

    this.look.lerp(this.lookTarget, 1 - Math.exp(-dt * 8));
    this.evade.lerp(this.evadeTarget, 1 - Math.exp(-dt * 6));

    // Natural blink
    this.blink.next -= dt;
    let blinkScale = 1;
    if (this.blink.next <= 0) {
      if (this.blink.t < 0) this.blink.t = 0;
      this.blink.t += dt;
      blinkScale = Math.max(0.08, Math.abs(Math.cos(this.blink.t / 0.14 * Math.PI)));
      if (this.blink.t > 0.14) { this.blink.t = -1; this.blink.next = 2.5 + Math.random() * 3.5; blinkScale = 1; }
    }
    blinkScale = Math.min(blinkScale, F.faceBlink);
    this.applyFace(face, F.faceBlink);

    const rig = this.rig;
    const bounce = Math.abs(Math.sin(t * p.bounceFreq)) * p.bounce * I;
    let lift = p.lift + bounce;
    lift += A.envelope('jolt') * 0.22 * I;
    const breath = 1 + Math.sin(t * p.breathFreq * 2) * p.breath;
    let squashY = p.squash * breath;
    let squashX = 1 / Math.sqrt(squashY);
    const pop = A.envelope('pop');
    squashY *= 1 - pop * 0.06; squashX *= 1 + pop * 0.05;
    const land = A.envelope('land');
    squashY *= 1 - land * 0.18; squashX *= 1 + land * 0.15;

    // Framing per hold mode (peeker shows head + paws over the card edge)
    const peek = this.holdMode === 'peeker';
    this.pivot.position.y += ((peek ? -0.52 : 0) - this.pivot.position.y) * (1 - Math.exp(-dt * 6));

    // Grab: the swing itself is the body's pendulum (stepDrag); the spine only adds a little lag.
    this.stepDrag(dt);
    this.applyDrag(t);
    const swayFromDrag = Math.max(-0.25, Math.min(0.25, this.drag.angV * -0.03)) * grab;

    rig.root.position.set(this.evade.x * (1 - grab), lift, this.evade.z * (1 - grab));
    this.pivot.rotation.y = p.bodyYaw + Math.sin(t * p.swayFreq) * p.sway * 0.6;
    rig.spine.rotation.x = p.lean + (this.annoying ? -this.evade.z * 0.5 : 0) - A.envelope('reject') * 0.22;
    rig.spine.rotation.z = Math.sin(t * p.swayFreq) * p.sway + swayFromDrag;
    rig.spine.scale.set(squashX, squashY, squashX);

    // Kick: 360° spin kick (Blueprint §9.3)
    const kick = A.action('kick');
    if (kick !== null) {
      const dir = this.holdSide === 'left' ? -1 : 1;
      const spin = kick < 0.15 ? 0 : kick > 0.8 ? 1 : (kick - 0.15) / 0.65;
      const e = spin < 0.5 ? 2 * spin * spin : 1 - Math.pow(-2 * spin + 2, 2) / 2;
      this.pivot.rotation.y += dir * e * Math.PI * 2;
      rig.root.position.y += Math.sin(Math.min(1, kick / 0.8) * Math.PI) * 0.18;
      if (!this.kickFired && kick > 0.45) { this.kickFired = true; this.onEvent('kick-impact', {}); }
    }

    // Head
    const rejectShake = A.action('reject') !== null ? Math.sin(t * 30) * 0.4 * A.envelope('reject') : 0;
    const petWiggle = A.action('pet') !== null ? Math.sin(t * 14) * 0.07 : 0;
    rig.head.rotation.set(
      p.pitch - this.look.y * 0.22 * (1 - grab),
      p.yaw + this.look.x * 0.42 * (1 - grab) + Math.sin(t * 16) * p.shake * I + rejectShake,
      p.tilt + petWiggle + Math.sin(t * 1.3) * 0.02 + Math.sin(t * 9) * 0.12 * grab
    );
    const petQ = A.envelope('pet');
    rig.head.scale.set(1 + p.cheek * 0.04 + petQ * 0.15, 1 - petQ * 0.12, 1 + petQ * 0.1);

    // Eyes
    for (const key of ['L', 'R']) {
      const e = rig.eyes[key];
      e.open.position.set(this.look.x * 0.018 * (1 - grab), p.lookY + this.look.y * 0.014, 0);
      e.open.scale.set(p.eyeScale, p.eyeScale * p.eyeSquint * blinkScale, 1);
      const arcS = 0.2 + 0.8 * F.faceBlink;
      e.arcHappy.scale.set(1, arcS, 1); e.arcClosed.scale.set(1, arcS, 1);
      e.star.rotation.z = Math.sin(t * 3) * 0.2;
      e.star.scale.setScalar((1 + Math.sin(t * 8) * 0.08) * (0.3 + 0.7 * F.faceBlink));
      e.heart.scale.setScalar((0.95 + Math.max(0, Math.sin(t * 7)) * 0.15) * (0.3 + 0.7 * F.faceBlink));
    }
    for (const b of rig.brows) {
      const side = b.userData.side;
      if (b.userData.baseY === undefined) b.userData.baseY = b.position.y;
      b.rotation.z = -side * p.browAngle;
      b.position.y = b.userData.baseY + p.browY;
      const vis = rig.species.beanBrows ? 1 : p.brow;
      b.visible = vis > 0.05;
      b.scale.setScalar(Math.max(0.05, vis));
    }
    for (const bl of rig.blush) { bl.material.opacity = Math.min(1, p.blush * 0.75); bl.scale.set(1.35 + p.cheek * 0.3, 0.85 + p.cheek * 0.15, 1); }
    if (rig.beakLower) rig.beakLower.rotation.x = p.beakOpen * 0.4 + petQ * 0.2 + grab * 0.35;

    // Ears (secondary motion)
    for (const ear of rig.ears) {
      const inner = ear.userData.inner, base = ear.userData.base, side = ear.userData.side;
      const L = p.earLift;
      const flutter = Math.sin(t * 18 + side) * 0.12 * grab;
      if (rig.species.ears === 'fold') {
        inner.rotation.x = base.x - L * 0.45 + flutter;
        inner.rotation.z = base.z - side * Math.min(0, L) * 0.4;
      } else if (rig.species.ears === 'pointy') {
        inner.rotation.x = base.x - Math.min(0, L) * 0.9 + flutter;
        inner.rotation.z = base.z - side * Math.min(0, L) * 0.6 + side * Math.max(0, L) * 0.12;
      } else if (rig.species.ears === 'long') {
        const droop = Math.max(0, -L);
        inner.rotation.x = base.x + droop * 1.1 + Math.sin(t * 2 + side) * 0.03 + flutter;
        inner.rotation.z = base.z - side * droop * 0.9 + side * Math.max(0, L) * 0.08;
      }
    }

    // Arms (+ paw flailing while grabbed, + wave action)
    const wave = Math.sin(t * 10) * p.armWave * I;
    const [armL, armR] = rig.arms;
    const flail = Math.sin(t * 16) * 0.45 * grab;
    const waveQ = A.envelope('wave');
    armL.rotation.set(
      p.armLx + wave + flail + waveQ * (-2.6 - p.armLx + Math.sin(t * 12) * 0.25),
      0,
      p.armLz + waveQ * (0.4 + Math.sin(t * 12) * 0.35) + Math.sin(t * 16) * 0.3 * grab
    );
    armR.rotation.set(p.armRx - wave - flail, 0, -p.armRz - Math.sin(t * 16) * 0.3 * grab);

    // Legs: dangling (grab) · running (courier) · stomping (angry) · kick swing
    const [legL, legR] = rig.legs;
    let llx = 0, lrx = 0;
    if (this.holdMode === 'courierRun') { llx = Math.sin(t * 16) * 0.8; lrx = -llx; }
    else if (p.stomp > 0.05) {
      llx = -Math.max(0, Math.sin(t * 11)) * 0.55 * p.stomp * I;
      lrx = -Math.max(0, Math.sin(t * 11 + Math.PI)) * 0.55 * p.stomp * I;
    }
    const dangle = Math.sin(t * 7) * 0.4 + this.drag.vx * 0.0004; // legs trail the drag
    llx = llx * (1 - grab) + dangle * grab;
    lrx = lrx * (1 - grab) - dangle * grab * 0.8;
    if (kick !== null) {
      const swing = kick < 0.3 ? kick / 0.3 * 0.5 : kick < 0.55 ? -1.8 : -1.8 * (1 - (kick - 0.55) / 0.45);
      if (this.holdSide === 'left') lrx = swing; else llx = swing;
    }
    legL.rotation.x = llx; legR.rotation.x = lrx;

    // Tail
    rig.tail.rotation.y = Math.sin(t * p.tailSpeed) * p.tailAmp * I;
    rig.tail.rotation.x = -p.tailLift * 0.6 + Math.cos(t * p.tailSpeed * 0.5) * 0.05;

    // Accessories (secondary motion responds to bounce / drag)
    if (rig.bell) {
      const shakeAmt = 0.1 + bounce * 2.2 + grab * 0.5;
      rig.bell.rotation.z = Math.sin(t * (7 + grab * 19)) * shakeAmt;
      rig.bell.rotation.x = Math.cos(t * (5 + grab * 17)) * (0.08 + grab * 0.27);
    }
    if (rig.pompom) rig.pompom.position.x = Math.sin(t * 5) * 0.015 * (1 + bounce * 8 + grab * 6);
    if (rig.envelope.visible) rig.envelope.rotation.z = Math.sin(t * 3) * 0.06;

    // Shadow shrinks when lifted
    const sh = Math.max(0.3, 1 - Math.max(0, rig.root.position.y + this.body.position.y) * 1.4);
    this.shadow.scale.set(sh, sh, 1);
    this.shadow.position.x = this.body.position.x; // under the feet, but on the floor
    this.shadow.material.opacity = 0.9 * sh;
    this.shadow.visible = !peek;

    if (this.fx) {
      const fxList = [...(F.fx || [])];
      if (A.action('reject') !== null) fxList.push('vein');
      if (grab > 0.5) fxList.push('sweat', 'exclaim');
      const key = fxList.join(',');
      if (key !== this.lastFxKey) { this.fx.setActive(fxList); this.lastFxKey = key; }
      this.fx.update(t, dt);
    }

    if (this.gltfScene) this.updateGltf(dt, p, grab);
    if (this.opts.onFrame) this.opts.onFrame({ t, breath, lift, head: this.headAnchor() });
  }

  updateGltf(dt, p, grab) {
    if (this.mixer) this.mixer.update(dt * this.preset.motionSpeed);
    const { bones, base, morphMeshes } = this.gltf;
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const additive = (name, x, y, z) => {
      const b = bones[name];
      if (!b || !base[name]) return;
      if (!this.mixer) b.quaternion.copy(base[name]);
      b.quaternion.multiply(q.setFromEuler(e.set(x, y, z)));
    };
    // Procedural layers on top of clips: look-at, breathing, ears/tail when clips are missing.
    additive('head', -this.look.y * 0.22 * (1 - grab), this.look.x * 0.42 * (1 - grab), 0);
    if (!this.mixer) {
      additive('head', p.pitch, p.yaw, p.tilt);
      additive('body', p.lean, 0, 0);
      additive('tail', 0, Math.sin(this.anim.time * p.tailSpeed) * p.tailAmp, 0);
    }
    const weights = morphWeightsFor(this.anim.grabbed ? 'grabbed' : this.anim.actions.pet ? 'pet' : (this.anim.reaction || this.anim.base), this.petConfig.morphMap) || {};
    const k = 1 - Math.exp(-dt * 10); // weight lerp — never jumps
    for (const m of morphMeshes) {
      for (const [name, idx] of Object.entries(m.morphTargetDictionary)) {
        const want = weights[name] ?? 0;
        m.morphTargetInfluences[idx] += (want - m.morphTargetInfluences[idx]) * k;
      }
    }
  }

  snapshot() {
    this.update(0.016);
    this.renderer.render(this.scene, this.camera);
    return this.renderer.domElement.toDataURL('image/png');
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.ambientTimer);
    clearTimeout(this.bodyTapTimer);
    document.removeEventListener('visibilitychange', this.onVisibility);
    for (const [target, type, fn, opts] of this.listeners || []) target.removeEventListener(type, fn, opts);
    this.listeners = [];
    this.ro.disconnect();
    this.clearCharacter();
    if (this.shadow) {
      if (this.shadow.parent) this.shadow.parent.remove(this.shadow);
      disposeObject(this.shadow);
      this.shadow = null;
    }
    this.envTex.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
