const electron = require('electron');
if (typeof electron === 'string' || !electron.app) {
  console.error('Desktop Pet must be launched with Electron (not Node).');
  process.exit(1);
}
const {
  app,
  BrowserWindow,
  ipcMain,
  powerMonitor,
  screen,
  Tray,
  Menu,
  nativeImage,
  globalShortcut,
} = electron;
const fs = require('fs');
const path = require('path');
const store = require('../pet/store');
const { tick, deriveMood } = require('../pet/tick');
const { REACTION_STATES, STATES } = require('../pet/state');
const { messageFor } = require('../pet/messages');
const { dayKey } = require('../pet/memory');
const { shouldSpeak } = require('../pet/speech');
const settingsStore = require('../pet/settings');
const { generateLine, isSpecial, resolveApiKey } = require('../pet/ai');
const eventsSource = require('./events-source');
const { createRoam } = require('./roam');
const { loadDotEnv } = require('./env');

loadDotEnv();

// Fixes a Windows issue where the renderer composites correctly (capturePage
// shows content) but the native window surface stays blank white.
app.disableHardwareAcceleration();

if (process.platform === 'win32') {
  app.setAppUserModelId('ai.petal.desktop-pet');
}

const isDev = Boolean(process.env.ELECTRON_START_URL);
const TICK_MS = 30 * 1000;
const FAILURE_THRESHOLD = 3;
const STALE_SESSION_MS = 24 * 60 * 60 * 1000;
const REACTION_MS = 4500;

let mainWindow = null;
let tray = null;
let petState = null;
let settings = null;
let tickTimer = null;
let eventSource = null;
let returnTimer = null;
let dragOffset = null;
let isQuitting = false;
let roam = null;
let hovering = false;

function dataDir() {
  return app.getPath('userData');
}

function iconPath() {
  return path.join(__dirname, 'icon.png');
}

function loadIcon() {
  try {
    return nativeImage.createFromBuffer(fs.readFileSync(iconPath()));
  } catch (err) {
    console.error('[pet] failed to load icon', err);
    return nativeImage.createEmpty();
  }
}

function persistPet() {
  store.persist(dataDir(), petState);
}

function broadcast(message = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pet:state', { state: petState, message, settings: settingsStore.publicView(settings) });
  }
}

function speak(event, message) {
  if (!message || !shouldSpeak(settings.speech, event)) {
    broadcast(null);
    return;
  }
  broadcast(message);
}

function scheduleReturnToIdle() {
  if (returnTimer) clearTimeout(returnTimer);
  if (!petState || !REACTION_STATES.has(petState.state)) return;
  returnTimer = setTimeout(() => {
    if (!petState || !REACTION_STATES.has(petState.state)) return;
    petState = { ...petState, state: STATES.idle };
    petState.mood = deriveMood(petState);
    persistPet();
    broadcast();
  }, REACTION_MS);
}

function commit(result) {
  if (!result || !result.applied) return;
  petState = result.state;
  persistPet();
  const event = result.messageEvent || '';
  const key = resolveApiKey(settings);
  if (key && isSpecial(event) && shouldSpeak(settings.speech, event)) {
    const snapshot = result.state;
    petState = { ...snapshot, state: STATES.thinking };
    broadcast(null);
    generateLine({ event, state: snapshot, apiKey: key }).then((line) => {
      if (!petState) return;
      petState = snapshot;
      persistPet();
      speak(event, line || result.message);
      scheduleReturnToIdle();
    });
    return;
  }
  speak(event, result.message);
  scheduleReturnToIdle();
}

function handleEvent(type) {
  const result = store.applyEvent(petState, type);
  if (result && result.applied) {
    const piledUp =
      (type === 'BUILD_FAILURE' || type === 'TEST_FAILURE') &&
      result.state.consecutiveFailures >= FAILURE_THRESHOLD &&
      result.state.consecutiveFailures % FAILURE_THRESHOLD === 0;
    if (piledUp) {
      const angry = store.applyEvent(result.state, 'MULTIPLE_FAILURES');
      if (angry && angry.applied) commit(angry);
      else commit(result);
      return;
    }
    commit(result);
  } else {
    broadcast();
  }
}

function greetIfNeeded(idleSeconds) {
  const today = dayKey();
  if (!petState.hatchedAt) {
    petState = { ...petState, hatchedAt: Date.now(), lastGreetingDay: today, state: STATES.curious };
    persistPet();
    speak('WELCOME', messageFor('WELCOME', petState));
    scheduleReturnToIdle();
    return true;
  }
  if (petState.lastGreetingDay !== today && idleSeconds < 180) {
    petState = { ...petState, lastGreetingDay: today, state: STATES.curious };
    persistPet();
    const canned = messageFor('DAILY_GREETING', petState);
    const key = resolveApiKey(settings);
    if (key && shouldSpeak(settings.speech, 'DAILY_GREETING')) {
      generateLine({ event: 'DAILY_GREETING', state: petState, apiKey: key }).then((line) => {
        speak('DAILY_GREETING', line || canned);
        scheduleReturnToIdle();
      });
    } else {
      speak('DAILY_GREETING', canned);
      scheduleReturnToIdle();
    }
    return true;
  }
  return false;
}

function handleTick() {
  let idleSeconds = 0;
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch {
    idleSeconds = 0;
  }
  if (greetIfNeeded(idleSeconds)) return;
  const result = tick(petState, { now: Date.now(), idleSeconds });
  if (result && result.state) {
    const wasWalking = petState.state === 'walking';
    petState = result.state;
    persistPet();
    if (wasWalking && petState.state !== 'walking' && roam) {
      roam.pause();
      if (settings.roam && !hovering) roam.resume();
    }
    const event =
      petState.state === 'sleeping' || petState.state === 'sleepy'
        ? 'FALLING_ASLEEP'
        : petState.state === 'curious'
          ? 'WAKING_UP'
          : 'HUNGRY';
    speak(result.message ? event : '', result.message);
    scheduleReturnToIdle();
  }
}

function ensureWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) createWindow();
}

function setHidden(hidden) {
  if (hidden) {
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.hide();
  } else {
    ensureWindow();
    mainWindow.show();
    applyAlwaysOnTop();
  }
  refreshTrayMenu();
}

function toggleHide() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    ensureWindow();
    return;
  }
  setHidden(mainWindow.isVisible());
}

function applyAlwaysOnTop() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (settings.alwaysOnTop) mainWindow.setAlwaysOnTop(true, 'pop-up-menu');
  else mainWindow.setAlwaysOnTop(false);
}

function clickThroughEnabled() {
  return !settings || settings.clickThrough !== false;
}

function applyClickThrough() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (!clickThroughEnabled()) {
    mainWindow.setIgnoreMouseEvents(false);
    return;
  }
  // Pass through when not hovering; hover IPC re-enables hits on the pet.
  mainWindow.setIgnoreMouseEvents(!hovering, { forward: true });
}

function applySettings(patch) {
  const next = { ...settings, ...patch };
  if (patch && Object.prototype.hasOwnProperty.call(patch, 'apiKey')) {
    if (patch.apiKey === undefined) delete next.apiKey;
  }
  settings = settingsStore.persist(dataDir(), next);
  if (petState && petState.name !== settings.name) {
    petState = { ...petState, name: settings.name };
    persistPet();
    broadcast();
  }
  applyAlwaysOnTop();
  applyClickThrough();
  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtLogin) });
  } catch (err) {
    console.error('[pet] login item failed', err);
  }
  if (eventSource && eventSource.setRepoDir) {
    eventSource.setRepoDir(settings.repoDir || process.cwd());
  }
  if (roam) {
    if (settings.roam && !hovering) roam.resume();
    else roam.pause();
  }
  refreshTrayMenu();
  if (tray && !tray.isDestroyed()) tray.setToolTip(`Desktop Pet — ${settings.name}`);
  return settingsStore.publicView(settings);
}

function buildMenu() {
  const visible = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
  const name = (settings && settings.name) || 'Pip';
  return Menu.buildFromTemplate([
    { label: visible ? `Hide ${name}` : `Show ${name}`, click: toggleHide },
    { label: 'Feed', click: () => handleEvent('FEED') },
    { type: 'separator' },
    { label: 'Wander', type: 'checkbox', checked: !!(settings && settings.roam), click: (item) => applySettings({ roam: item.checked }) },
    {
      label: 'Speech',
      submenu: [
        { label: 'Normal', type: 'radio', checked: settings.speech === 'normal', click: () => applySettings({ speech: 'normal' }) },
        { label: 'Quiet', type: 'radio', checked: settings.speech === 'quiet', click: () => applySettings({ speech: 'quiet' }) },
        { label: 'Off', type: 'radio', checked: settings.speech === 'off', click: () => applySettings({ speech: 'off' }) },
      ],
    },
    { label: 'Always on top', type: 'checkbox', checked: !!(settings && settings.alwaysOnTop), click: (item) => applySettings({ alwaysOnTop: item.checked }) },
    {
      label: 'Click-through',
      type: 'checkbox',
      checked: clickThroughEnabled(),
      click: (item) => applySettings({ clickThrough: item.checked }),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);
}

function refreshTrayMenu() {
  if (tray && !tray.isDestroyed()) tray.setContextMenu(buildMenu());
}

function createTray() {
  try {
    const img = loadIcon();
    const trayImg = img.isEmpty() ? img : img.resize({ width: 16, height: 16 });
    tray = new Tray(trayImg);
    tray.setToolTip(`Desktop Pet — ${(settings && settings.name) || 'Pip'}`);
    tray.setContextMenu(buildMenu());
    tray.on('click', toggleHide);
  } catch (err) {
    console.error('[pet] tray unavailable', err);
    tray = null;
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 340,
    height: 400,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    frame: false,
    transparent: true,
    alwaysOnTop: !!(settings && settings.alwaysOnTop),
    skipTaskbar: true,
    resizable: false,
    show: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  mainWindow.removeMenu();
  applyAlwaysOnTop();
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    applyClickThrough();
    setTimeout(() => greetIfNeeded(0), 600);
  });

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

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow.hide();
      refreshTrayMenu();
    }
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function clampToVisibleArea() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const bounds = mainWindow.getBounds();
  const area = screen.getDisplayMatching(bounds).workArea;
  const x = Math.min(Math.max(bounds.x, area.x), area.x + area.width - bounds.width);
  const y = Math.min(Math.max(bounds.y, area.y), area.y + area.height - bounds.height);
  if (x !== bounds.x || y !== bounds.y) mainWindow.setPosition(x, y);
}

app.whenReady().then(() => {
  const dir = dataDir();
  settings = settingsStore.load(dir);
  petState = store.load(dir);
  if (settings.name && petState.name !== settings.name) petState.name = settings.name;

  if (Date.now() - (petState.lastActivity || 0) > STALE_SESSION_MS) {
    petState.consecutiveFailures = 0;
  }

  try {
    app.setLoginItemSettings({ openAtLogin: Boolean(settings.launchAtLogin) });
  } catch {
    /* unsupported on this platform */
  }

  ipcMain.handle('pet:getState', () => petState);
  ipcMain.handle('pet:getSettings', () => settingsStore.publicView(settings));
  ipcMain.on('pet:setSettings', (e, patch) => {
    const view = applySettings(patch || {});
    e.sender.send('pet:settings', view);
    broadcast();
  });
  ipcMain.on('pet:intent', (_, type) => {
    if (type === 'pet' || type === 'feed') handleEvent(type.toUpperCase());
  });
  ipcMain.on('pet:toggleHide', () => toggleHide());
  ipcMain.on('pet:show', () => setHidden(false));
  ipcMain.on('pet:hide', () => setHidden(true));
  ipcMain.on('pet:mouseIgnore', (_e, ignore) => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (!clickThroughEnabled()) {
      mainWindow.setIgnoreMouseEvents(false);
      return;
    }
    mainWindow.setIgnoreMouseEvents(!!ignore, { forward: true });
  });
  ipcMain.on('pet:hover', (_e, on) => {
    hovering = !!on;
    if (!roam) return;
    if (hovering) roam.pause();
    else if (settings.roam) roam.resume();
  });
  ipcMain.on('pet:menu', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.setIgnoreMouseEvents(false);
    buildMenu().popup({
      window: mainWindow,
      callback: () => applyClickThrough(),
    });
  });
  ipcMain.on('pet:dragStart', (_e, offset) => {
    if (roam) roam.pause();
    if (Array.isArray(offset) && offset.length === 2) {
      dragOffset = [Number(offset[0]) || 0, Number(offset[1]) || 0];
    }
  });
  ipcMain.on('pet:dragMove', () => {
    if (!mainWindow || mainWindow.isDestroyed() || !dragOffset) return;
    const p = screen.getCursorScreenPoint();
    mainWindow.setPosition(Math.round(p.x - dragOffset[0]), Math.round(p.y - dragOffset[1]));
    clampToVisibleArea();
  });
  ipcMain.on('pet:dragEnd', () => {
    dragOffset = null;
    if (roam && settings.roam && !hovering) roam.resume();
  });

  createWindow();
  createTray();
  clampToVisibleArea();

  roam = createRoam({
    getWindow: () => mainWindow,
    getState: () => petState,
    setState: (s) => {
      petState = s;
    },
    persist: persistPet,
    broadcast: () => broadcast(),
    getSettings: () => settings,
    screen,
  });
  if (settings.roam) roam.schedule();

  try {
    globalShortcut.register('CommandOrControl+Shift+P', toggleHide);
  } catch (err) {
    console.error('[pet] shortcut unavailable', err);
  }

  tickTimer = setInterval(handleTick, TICK_MS);
  eventSource = eventsSource.start({
    onEvent: handleEvent,
    repoDir: settings.repoDir || process.cwd(),
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Stay alive in the tray.
});

app.on('before-quit', () => {
  isQuitting = true;
  if (tickTimer) clearInterval(tickTimer);
  if (returnTimer) clearTimeout(returnTimer);
  if (roam) roam.stop();
  if (eventSource) eventSource.stop();
  globalShortcut.unregisterAll();
});
