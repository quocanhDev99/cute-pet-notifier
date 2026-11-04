const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { NcPrefs, styleOf, withStyle, styleBits } = require('../src/adapters/ncprefs');

const isMac = process.platform === 'darwin';

test('styleOf: bit 3 banners, bit 4 alerts, none', () => {
  assert.strictEqual(styleOf(8396814), 'banners');   // Zalo on the dev machine
  assert.strictEqual(styleOf(814219286), 'alerts');  // Calendar (Apple default = alerts)
  assert.strictEqual(styleOf(withStyle(8396814, 0)), 'none');
  // > 2^32 values keep their high bits
  assert.strictEqual(withStyle(9437708310, 0) + styleBits(9437708310), 9437708310);
  assert.strictEqual(styleOf(9437708310), ['none', 'banners', 'alerts', 'unknown'][Number((BigInt(9437708310) >> 3n) & 3n)]);
});

test('replaceAll / restore on a COPY of the real prefs (separate domain, no daemon restart)', { skip: !isMac }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cpc-ncp-'));
  const domain = `com.cutepet.test-ncprefs-${process.pid}`;
  const src = path.join(dir, 'src.plist');
  execFileSync('/usr/bin/defaults', ['export', 'com.apple.ncprefs', src]);
  execFileSync('/usr/bin/defaults', ['import', domain, src]);
  try {
    const np = new NcPrefs(dir, { domain, restartDaemons: false });
    const before = await np.status();
    const xml0 = await np.exportXml(); const apps0 = await np.readApps(xml0); fs.rmSync(xml0);
    const r = await np.replaceAll();
    assert.strictEqual(r.changed, before.banners + before.alerts);
    const after = await np.status();
    assert.strictEqual(after.banners + after.alerts, 0);
    assert.strictEqual(after.replaced, true);
    // every non-style bit is untouched
    const xml1 = await np.exportXml(); const apps1 = await np.readApps(xml1); fs.rmSync(xml1);
    for (let i = 0; i < apps0.length; i++) assert.strictEqual(apps0[i].flags - styleBits(apps0[i].flags), apps1[i].flags - styleBits(apps1[i].flags), apps0[i].bundleId);
    assert.ok(fs.existsSync(path.join(dir, 'ncprefs-backup.plist')));
    const rr = await np.restore();
    assert.strictEqual(rr.restored, r.changed);
    const xml2 = await np.exportXml(); const apps2 = await np.readApps(xml2); fs.rmSync(xml2);
    assert.deepStrictEqual(apps2.map(a => a.flags), apps0.map(a => a.flags)); // exact original restored
  } finally {
    try { execFileSync('/usr/bin/defaults', ['delete', domain]); } catch { /* ignore */ }
  }
});
