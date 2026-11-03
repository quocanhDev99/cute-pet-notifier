import { PetStage } from '../../src/renderer/js/pet/pet-stage.js';

/** Render the pet at 1024 px and composite it on a macOS-style pastel squircle. */
window.renderIcon = async function (emotion = 'happy', opts = {}) {
  const S = 1024;
  const host = document.createElement('div');
  host.style.cssText = `position:fixed;left:-5000px;top:0;width:${S}px;height:${S}px`;
  document.body.appendChild(host);
  const stage = new PetStage(host, { species: opts.species || 'cat_mochi', ambient: false, interactive: false, assetBase: '/assets/' });
  stage.renderer.setPixelRatio(1);
  stage.resize(false);
  // Closer, slightly high framing: head + upper body fill the icon.
  stage.camera.fov = opts.fov || 24;
  stage.camera.position.set(0, opts.camY ?? 1.1, opts.camZ ?? 6.6);
  stage.camera.lookAt(0, opts.lookY || 0.95, 0);
  stage.camera.updateProjectionMatrix();
  stage.setEmotion(emotion);
  for (let i = 0; i < 90; i++) stage.update(1 / 60);
  if (stage.fx) { stage.fx.setActive(opts.fx || []); for (let i = 0; i < 30; i++) stage.fx.update(i / 60, 1 / 60); }
  stage.renderer.render(stage.scene, stage.camera);
  // Copy the WebGL frame synchronously (same task as render → buffer still valid).
  const pet = document.createElement('canvas'); pet.width = pet.height = S;
  pet.getContext('2d').drawImage(stage.renderer.domElement, 0, 0, S, S);
  stage.dispose(); host.remove();

  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  // macOS Big Sur+ icon grid: 824 px squircle centered, ~185 px corner radius, soft drop shadow.
  const box = 824, x = (S - box) / 2, y = (S - box) / 2 - 10, r = 185;
  const path = new Path2D();
  path.moveTo(x + r, y); path.arcTo(x + box, y, x + box, y + box, r); path.arcTo(x + box, y + box, x, y + box, r);
  path.arcTo(x, y + box, x, y, r); path.arcTo(x, y, x + box, y, r); path.closePath();
  g.save(); g.shadowColor = 'rgba(120,50,70,0.35)'; g.shadowBlur = 40; g.shadowOffsetY = 18; g.fillStyle = '#FFD9DF'; g.fill(path); g.restore();
  g.save(); g.clip(path);
  const bg = g.createLinearGradient(x, y, x + box, y + box);
  bg.addColorStop(0, '#FFC2CF'); bg.addColorStop(0.5, '#FFD9B8'); bg.addColorStop(1, '#D9CFFF');
  g.fillStyle = bg; g.fillRect(x, y, box, box);
  const glow = g.createRadialGradient(S / 2, y + box * 0.38, 20, S / 2, y + box * 0.38, box * 0.62);
  glow.addColorStop(0, 'rgba(255,255,255,0.75)'); glow.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = glow; g.fillRect(x, y, box, box);
  // floor ellipse
  const fl = g.createRadialGradient(S / 2, y + box * 0.9, 10, S / 2, y + box * 0.9, box * 0.45);
  fl.addColorStop(0, 'rgba(255,255,255,0.8)'); fl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = fl; g.fillRect(x, y, box, box);
  const scale = opts.scale || 1.0;
  const pw = S * scale, ph = S * scale;
  g.drawImage(pet, (S - pw) / 2, y + (box - ph) / 2 + (opts.dy ?? 0), pw, ph);
  // inner highlight rim
  g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 6; g.stroke(path);
  g.restore();
  return c.toDataURL('image/png');
};
