// Minimal, safe bridge between the static renderer and the Electron main process.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  getState: () => ipcRenderer.invoke('pet:getState'),
  getSettings: () => ipcRenderer.invoke('pet:getSettings'),
  setSettings: (patch) => ipcRenderer.send('pet:setSettings', patch),
  onState: (fn) => {
    const listener = (_, payload) => fn(payload);
    ipcRenderer.on('pet:state', listener);
    return () => ipcRenderer.removeListener('pet:state', listener);
  },
  onSettings: (fn) => {
    const listener = (_, settings) => fn(settings);
    ipcRenderer.on('pet:settings', listener);
    return () => ipcRenderer.removeListener('pet:settings', listener);
  },
  sendIntent: (type) => ipcRenderer.send('pet:intent', type),
  setHudPinned: (pinned) => ipcRenderer.send('pet:hudPinned', pinned),
  installHooks: () => ipcRenderer.send('pet:installHooks'),
  dragStart: (offset) => ipcRenderer.send('pet:dragStart', offset),
  dragMove: () => ipcRenderer.send('pet:dragMove'),
  dragEnd: () => ipcRenderer.send('pet:dragEnd'),
  toggleHide: () => ipcRenderer.send('pet:toggleHide'),
  show: () => ipcRenderer.send('pet:show'),
  hide: () => ipcRenderer.send('pet:hide'),
  setMouseIgnore: (ignore) => ipcRenderer.send('pet:mouseIgnore', ignore),
  setHover: (on) => ipcRenderer.send('pet:hover', on),
  openMenu: () => ipcRenderer.send('pet:menu'),
  onOpenSettings: (fn) => {
    const listener = () => fn();
    ipcRenderer.on('pet:openSettings', listener);
    return () => ipcRenderer.removeListener('pet:openSettings', listener);
  },
  onToggleHide: (fn) => ipcRenderer.on('pet:toggleHide', (_, v) => fn(v)),
});
