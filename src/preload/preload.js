const { contextBridge, ipcRenderer } = require('electron');

// Minimal, purpose-specific bridge for the overlay renderer. Subscriptions return an unsubscribe
// function, never ipcRenderer itself (the page must not get raw IPC access).
function listen(channel, handler) {
  ipcRenderer.on(channel, handler);
  return () => { ipcRenderer.removeListener(channel, handler); };
}

contextBridge.exposeInMainWorld('electronAPI', {
  onConfig: (cb) => listen('overlay:config', (_e, data) => cb(data)),
  onNotification: (cb) => listen('notification:show', (_e, data) => cb(data)),
  onEmotion: (cb) => listen('pet:emotion', (_e, data) => cb(data)),
  onModelChanged: (cb) => listen('model:changed', (_e, data) => cb(data)),
  onDismiss: (cb) => listen('notification:dismiss', (_e, data) => cb(data)),
  onResumed: (cb) => listen('app:resumed', () => cb()),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('window:set-ignore-mouse-events', !!ignore),
  setHitRects: (rects) => ipcRenderer.send('overlay:hit-rects', rects),
  setDockRect: (rect) => ipcRenderer.send('overlay:dock-rect', rect),
  markInteraction: (onCard) => ipcRenderer.send('overlay:interaction', !!onCard),
  savePosition: (pos) => ipcRenderer.send('pet:save-position', pos),
  onAction: (action, data) => ipcRenderer.send('notification:action', { ...(data && typeof data === 'object' ? data : {}), action }),
  reportBattery: (info) => ipcRenderer.send('system:battery', info),
  openControlCenter: (section) => ipcRenderer.send('overlay:open-control', section),
  onBadge: (cb) => listen('pet:badge', (_e, d) => cb(d)),
  showContextMenu: (opts) => ipcRenderer.send('overlay:context-menu', opts && typeof opts.cardId === 'string' ? { cardId: opts.cardId } : null),
  onBreakStart: (cb) => listen('break:start', (_e, d) => cb(d)),
  onActionResult: (cb) => listen('notification:action-result', (_e, d) => cb(d))
});
