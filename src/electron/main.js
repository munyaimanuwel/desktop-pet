const { app, BrowserWindow, ipcMain, powerMonitor } = require('electron');
const path = require('path');
const store = require('../pet/store');
const { tick } = require('../pet/tick');
const eventsSource = require('./events-source');

// Fixes a Windows issue where the renderer composites correctly (capturePage
// shows content) but the native window surface stays blank white.
app.disableHardwareAcceleration();

const isDev = process.env.NODE_ENV === 'development';
const TICK_MS = 30 * 1000;
const FAILURE_THRESHOLD = 3;
const STALE_SESSION_MS = 24 * 60 * 60 * 1000;

let mainWindow = null;
let petState = null;
let tickTimer = null;
let eventSource = null;

function broadcast(message = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pet:state', { state: petState, message });
  }
}

// Apply a reaction, persist, and push the new state to the renderer.
function commit(result) {
  if (!result || !result.applied) return;
  petState = result.state;
  store.persist(app.getPath('userData'), petState);
  broadcast(result.message || null);
}

function handleEvent(type) {
  const result = store.applyEvent(petState, type);
  if (result && result.applied) {
    // Pile-up of failures earns a dedicated annoyed reaction.
    if (result.state.consecutiveFailures >= FAILURE_THRESHOLD) {
      const angry = store.applyEvent(result.state, 'MULTIPLE_FAILURES');
      if (angry && angry.applied) commit(angry);
      else commit(result);
      return;
    }
    commit(result);
  } else {
    broadcast(); // cooldown-skipped; keep the renderer in sync
  }
}

function handleTick() {
  let idleSeconds = 0;
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch {
    idleSeconds = 0; // powerMonitor unavailable — assume active
  }
  const result = tick(petState, { now: Date.now(), idleSeconds });
  if (result && result.state) commit(result);
}

function onExternalEvent(type) {
  handleEvent(type);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 320,
    height: 360,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    // Frameless + transparent: only the pet and its speech bubble are drawn;
    // there is no title bar, menu, or background rectangle.
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  // No default menu (File/Edit/View/...) — nothing but the pet on screen.
  mainWindow.removeMenu();

  // Present the window only once the page is ready, so the first frame the
  // compositor sees actually has content (avoids a blank painted surface on
  // some Windows setups).
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Windows workaround: the first frame is sometimes never presented to the
  // HWND (window stays blank white even though the renderer composited it).
  // Nudging the bounds forces the compositor to present; done after a delay
  // so the renderer has produced its first real frame.
  mainWindow.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;
      const b = mainWindow.getBounds();
      mainWindow.setBounds({ ...b, width: b.width + 1, height: b.height + 1 });
      mainWindow.setBounds(b);
    }, 1500);
  });

  if (isDev) {
    mainWindow.loadURL(process.env.ELECTRON_START_URL || 'http://localhost:3000');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', '..', 'out', 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Keep the pet on the visible work area. Frameless windows can otherwise end
// up (or be dragged) off-screen where they're unreachable.
function clampToVisibleArea() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const { screen } = require('electron');
  const bounds = mainWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - bounds.width);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - bounds.height);
  if (x !== bounds.x || y !== bounds.y) mainWindow.setPosition(x, y);
}

app.whenReady().then(() => {
  const dataDir = app.getPath('userData');
  petState = store.load(dataDir);

  // Consecutive failures only mean something within a session.
  if (Date.now() - (petState.lastActivity || 0) > STALE_SESSION_MS) {
    petState.consecutiveFailures = 0;
  }

  // Wire IPC intents from the renderer.
  ipcMain.handle('pet:getState', () => petState);
  ipcMain.on('pet:intent', (_, type) => {
    if (type === 'pet' || type === 'feed') handleEvent(type.toUpperCase());
  });
  ipcMain.on('pet:toggleHide', () => {
    if (!mainWindow) return;
    const visible = mainWindow.isVisible();
    if (visible) mainWindow.hide();
    else mainWindow.show();
    mainWindow.webContents.send('pet:toggleHide', visible);
  });
  ipcMain.on('pet:show', () => mainWindow && mainWindow.show());
  ipcMain.on('pet:hide', () => mainWindow && mainWindow.hide());
  // Dragging: the renderer sends the pointer offset from the window origin;
  // we move the window so the pet follows the cursor.
  ipcMain.on('pet:drag', (_e, offset) => {
    if (!mainWindow || !offset) return;
    const [dx, dy] = offset;
    const [x, y] = mainWindow.getPosition();
    mainWindow.setPosition(Math.round(x + dx), Math.round(y + dy));
    clampToVisibleArea();
  });

  createWindow();
  clampToVisibleArea();

  // Start the feel-alive loop and external event feeds.
  tickTimer = setInterval(handleTick, TICK_MS);
  eventSource = eventsSource.start({ onEvent: onExternalEvent });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (tickTimer) clearInterval(tickTimer);
  if (eventSource) eventSource.stop();
});
