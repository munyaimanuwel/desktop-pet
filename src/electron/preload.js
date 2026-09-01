// Minimal, safe bridge between the static renderer and the Electron main process.
// The renderer runs in an opaque context, so only intents cross this boundary.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petAPI', {
  // Read the current pet state (once, at mount).
  getState: () => ipcRenderer.invoke('pet:getState'),
  // Subscribe to state pushes. Returns an unsubscribe function.
  onState: (fn) => {
    const listener = (_, state) => fn(state);
    ipcRenderer.on('pet:state', listener);
    return () => ipcRenderer.removeListener('pet:state', listener);
  },
  // Send a user intent from the UI.
  sendIntent: (type) => ipcRenderer.send('pet:intent', type),
  // Move the window by a [dx, dy] delta (called while dragging the pet).
  drag: (offset) => ipcRenderer.send('pet:drag', offset),
  // Window controls.
  toggleHide: () => ipcRenderer.send('pet:toggleHide'),
  show: () => ipcRenderer.send('pet:show'),
  hide: () => ipcRenderer.send('pet:hide'),
  onToggleHide: (fn) => ipcRenderer.on('pet:toggleHide', (_, v) => fn(v)),
});
