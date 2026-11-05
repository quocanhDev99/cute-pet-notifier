const { contextBridge, ipcRenderer } = require('electron');

// Minimal, purpose-specific bridge for the overlay renderer.
contextBridge.exposeInMainWorld('electronAPI', {
  onConfig: (cb) => ipcRenderer.on('overlay:config', (_e, data) => cb(data)),
  onNotification: (cb) => ipcRenderer.on('notification:show', (_e, data) => cb(data)),
  onEmotion: (cb) => ipcRenderer.on('pet:emotion', (_e, data) => cb(data)),
  onModelChanged: (cb) => ipcRenderer.on('model:changed', (_e, data) => cb(data)),
  onDismiss: (cb) => ipcRenderer.on('notification:dismiss', (_e, data) => cb(data)),
  onResumed: (cb) => ipcRenderer.on('app:resumed', () => cb()),
  setIgnoreMouseEvents: (ignore) => ipcRenderer.send('window:set-ignore-mouse-events', !!ignore),
  setHitRects: (rects) => ipcRenderer.send('overlay:hit-rects', rects),
  savePosition: (pos) => ipcRenderer.send('pet:save-position', pos),
  onAction: (action, data) => ipcRenderer.send('notification:action', { action, ...(data || {}) }),
  reportBattery: (info) => ipcRenderer.send('system:battery', info),
  openControlCenter: (section) => ipcRenderer.send('overlay:open-control', section),
  onBadge: (cb) => ipcRenderer.on('pet:badge', (_e, d) => cb(d)),
  showContextMenu: (opts) => ipcRenderer.send('overlay:context-menu', opts && typeof opts.cardId === 'string' ? { cardId: opts.cardId } : null),
  onBreakStart: (cb) => ipcRenderer.on('break:start', (_e, d) => cb(d)),
  onActionResult: (cb) => ipcRenderer.on('notification:action-result', (_e, d) => cb(d))
});
