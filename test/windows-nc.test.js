const test = require('node:test');
const assert = require('node:assert/strict');
const { WindowsNotificationAdapter } = require('../src/adapters/windows-nc-adapter');
const { STATUS } = require('../src/adapters/base-adapter');

function mockCtx() {
  const store = { adapters: { windows_nc: { enabled: true } } };
  return {
    settings: {
      get: () => store,
      update: (patch) => {
        if (patch.adapters) Object.assign(store.adapters, patch.adapters);
      }
    },
    secrets: { has: () => false, set: () => {}, get: () => null },
    log: () => {}
  };
}

test('Windows notification adapter: Unsupported on non-win32', async () => {
  const adapter = new WindowsNotificationAdapter(mockCtx(), 'darwin');
  assert.equal(adapter.status, STATUS.UNSUPPORTED);
  assert.equal(adapter.getConnectionStatus(), STATUS.UNSUPPORTED);
  const ok = await adapter.connect();
  assert.equal(ok, false);
});

test('Windows notification adapter: Normalizes toast notification payload', async () => {
  const adapter = new WindowsNotificationAdapter(mockCtx(), 'win32');
  assert.equal(adapter.status, STATUS.DISCONNECTED);

  const raw = {
    type: 'notification',
    id: 'win_12345',
    rawId: 12345,
    appName: 'Microsoft Teams',
    title: 'Nguyễn Văn A',
    body: 'Chào bạn, dự án thế nào rồi?',
    dismissedNative: true,
    timestamp: 1730628000000
  };

  const normalized = adapter.normalizeNotification(raw);
  assert.equal(normalized.app, 'microsoftteams');
  assert.equal(normalized.appName, 'Microsoft Teams');
  assert.equal(normalized.title, 'Nguyễn Văn A');
  assert.equal(normalized.message, 'Chào bạn, dự án thế nào rồi?');
  assert.equal(normalized.deliveryMode, 'native_os');
  assert.equal(normalized.provider, 'windows');
  assert.equal(normalized.sourceEventId, 'win_12345');
});

test('Windows notification adapter: Event emission and deduplication', async () => {
  const adapter = new WindowsNotificationAdapter(mockCtx(), 'win32');
  const emitted = [];
  adapter.subscribeNotifications((payload) => emitted.push(payload));

  adapter.handleEvent({
    type: 'notification',
    id: 'win_100',
    appName: 'Slack',
    title: 'Team Channel',
    body: 'Hello',
    timestamp: 1730628001000
  });

  // Duplicate event should be ignored
  adapter.handleEvent({
    type: 'notification',
    id: 'win_100',
    appName: 'Slack',
    title: 'Team Channel',
    body: 'Hello',
    timestamp: 1730628001000
  });

  assert.equal(emitted.length, 1);
  assert.equal(emitted[0].appName, 'Slack');
});


test('Windows "Mở app": remembers the sender AUMID per notification; only safe AUMIDs pass', () => {
  const { isSafeAumid } = require('../src/adapters/windows-nc-adapter');
  for (const ok of ['com.vng.zalo', 'MSTeams_8wekyb3d8bbwe!MSTeams', 'Telegram.TelegramDesktop', 'FACEBOOK.317180B0BB486_8xx8rvfyw5nnt!App']) assert.equal(isSafeAumid(ok), true, ok);
  for (const bad of ['', 'a & calc.exe', 'x"; rm', 'C:\..\..\evil', 'x|y', null, 'a'.repeat(300)]) assert.equal(isSafeAumid(bad), false, String(bad));

  const adapter = new WindowsNotificationAdapter(mockCtx(), 'win32');
  adapter.handleEvent({ type: 'notification', id: 'win_1', appName: 'Zalo', aumid: 'com.vng.zalo', title: 'Cẩm Ý', body: 'nhắn' });
  adapter.handleEvent({ type: 'notification', id: 'win_2', appName: 'Evil', aumid: 'x & calc', title: 't', body: 'b' });
  assert.equal(adapter.appIds.get('win_1'), 'com.vng.zalo');
  assert.equal(adapter.appIds.has('win_2'), false, 'unsafe AUMID is never stored');
});
