#!/usr/bin/env node
/**
 * Send a test notification to the running app.
 *   node scripts/send-test-notify.js            → random emotion
 *   node scripts/send-test-notify.js angry      → specific emotion
 *   node scripts/send-test-notify.js love peeker
 *   PET_SECRET=xxx node scripts/send-test-notify.js   (if a webhook secret is set)
 */
const http = require('http');
const { SAMPLE_NOTIFICATIONS } = require('../src/shared/sample-notifications');

const ids = Object.keys(SAMPLE_NOTIFICATIONS);
const emotion = ids.includes(process.argv[2]) ? process.argv[2] : ids[Math.floor(Math.random() * ids.length)];
const presentationMode = process.argv[3];
const payload = JSON.stringify({ ...SAMPLE_NOTIFICATIONS[emotion], forceEmotion: emotion, presentationMode });

const req = http.request({
  hostname: '127.0.0.1', port: 3721, path: '/notify', method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload), ...(process.env.PET_SECRET ? { 'X-Pet-Secret': process.env.PET_SECRET } : {}) }
}, (res) => {
  let body = '';
  res.on('data', c => { body += c; });
  res.on('end', () => console.log(res.statusCode === 200 ? `✅ Đã gửi "${emotion}":` : `❌ HTTP ${res.statusCode}:`, body));
});
req.on('error', (e) => console.error('❌ Không kết nối được app (npm start chưa chạy?):', e.message));
req.end(payload);
