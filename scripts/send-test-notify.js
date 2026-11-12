#!/usr/bin/env node
/**
 * Send a test notification to the running app.
 *   node scripts/send-test-notify.js            → random emotion
 *   node scripts/send-test-notify.js angry      → specific emotion
 *   node scripts/send-test-notify.js love peeker
 *   PET_SECRET=xxx node scripts/send-test-notify.js   (if a webhook secret is set)
 *   PET_PORT=37210 node scripts/send-test-notify.js   (otherwise read from the app's server-port.json)
 */
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

/** The app may run on a fallback port (3721 reserved by Windows / taken) — it records the real one. */
function appPort() {
  if (process.env.PET_PORT) return Number(process.env.PET_PORT);
  const base = process.platform === 'win32' ? (process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'))
    : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support')
      : (process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'));
  for (const name of ['Cute Pet Companion', 'cute-pet-notifier']) {
    try { const p = Number(JSON.parse(fs.readFileSync(path.join(base, name, 'server-port.json'), 'utf8')).port); if (p) return p; } catch { /* next */ }
  }
  return 3721;
}
const { SAMPLE_NOTIFICATIONS } = require('../src/shared/sample-notifications');

const ids = Object.keys(SAMPLE_NOTIFICATIONS);
const emotion = ids.includes(process.argv[2]) ? process.argv[2] : ids[Math.floor(Math.random() * ids.length)];
const presentationMode = process.argv[3];
const payload = JSON.stringify({ ...SAMPLE_NOTIFICATIONS[emotion], forceEmotion: emotion, presentationMode });

const req = http.request({
  hostname: '127.0.0.1', port: appPort(), path: '/notify', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...(process.env.PET_SECRET ? { 'X-Pet-Secret': process.env.PET_SECRET } : {}) }
}, (res) => {
  let body = '';
  res.on('data', c => { body += c; });
  res.on('end', () => console.log(res.statusCode === 200 ? `✅ Đã gửi "${emotion}":` : `❌ HTTP ${res.statusCode}:`, body));
});
req.on('error', (e) => console.error('❌ Không kết nối được app (npm start chưa chạy?):', e.message));
req.end(payload);
