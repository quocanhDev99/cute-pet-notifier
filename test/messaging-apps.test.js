const test = require('node:test');
const assert = require('node:assert');
const { MessagingApps } = require('../src/main/messaging-apps');

test('macOS: detects installed + running chat apps (main executables only), running first', async () => {
  const installed = new Set(['/Applications/Microsoft Teams.app', '/Applications/Zalo.app', '/Applications/Telegram.app', '/System/Applications/Messages.app']);
  const ps = ['/Applications/Zalo.app/Contents/MacOS/Zalo', '/Applications/Zalo.app/Contents/Frameworks/Zalo Helper.app/Contents/MacOS/Zalo Helper',
    '/Applications/Microsoft Teams.app/Contents/MacOS/MSTeams', '/usr/sbin/cfprefsd'].join('\n');
  const m = new MessagingApps({ platform: 'darwin', home: '/Users/x', exists: (p) => installed.has(p), exec: async () => ps, getIcon: async (p) => `icon:${p}` });
  const list = await m.detect();
  assert.deepStrictEqual(list.map(a => [a.app, a.running]), [['teams', true], ['zalo', true], ['telegram', false], ['messages', false]]);
  assert.strictEqual(list[0].icon, 'icon:/Applications/Microsoft Teams.app');
  assert.ok(!list.some(a => a.app === 'slack'), 'not installed → not listed');
});

test('Windows: running exe counts even when the install path is unknown', async () => {
  const m = new MessagingApps({ platform: 'win32', home: 'C:\\Users\\x', exists: () => false, exec: async () => '"Zalo.exe","123","Console","1","100 K"\n"ms-teams.exe","9","Console","1","1 K"' });
  const list = await m.detect();
  assert.deepStrictEqual(list.map(a => [a.app, a.running, a.installed]), [['teams', true, true], ['zalo', true, true]]);
});
