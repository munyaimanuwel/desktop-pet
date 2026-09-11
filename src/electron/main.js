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
const { dayKey, note } = require('../pet/memory');
const { shouldSpeak } = require('../pet/speech');
const settingsStore = require('../pet/settings');
const { generateLine, isSpecial, resolveApiKey } = require('../pet/ai');
const eventsSource = require('./events-source');
const { createRoam } = require('./roam');
const { createLogger } = require('./log');
const { initUpdater } = require('./updater');
const hooks = require('./hooks');
const { loadDotEnv } = require('./env');

loadDotEnv();

// Fixes a Windows issue where the renderer composites correctly (capturePage
// shows content) but the native window surface stays blank white.
app.disableHardwareAcceleration();

if (process.platform === 'win32') {
  app.setAppUserModelId('ai.petal.desktop-pet');
}

// One pet per machine. Must run before whenReady() so two launches cannot both
// create a window and race for the event-server port.
if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}
app.on('second-instance', () => {
  setHidden(false);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
});

const isDev = Boolean(process.env.ELECTRON_START_URL);
const TICK_MS = 30 * 1000;
const FAILURE_THRESHOLD = 3;
const STALE_SESSION_MS = 24 * 60 * 60 * 1000;
const REACTION_MS = 4500;
const ABSENCE_MS = 36 * 60 * 60 * 1000;
const AI_COOLDOWN_MS = 30 * 60 * 1000;
const AI_DAILY_CAP = 4;
const END_OF_DAY_HOUR = 18;
const WINDOW_W = 280;
const WINDOW_H = 240;
const HUD_GROWTH = 320; // extra height the settings panel needs

let mainWindow = null;
let tray = null;
let petState = null;
let settings = null;
let log = console;
let hudPinned = false;
let updater = null;
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

// The display whose work area overlaps these bounds, if any. Used to decide
// whether a remembered position is still reachable.
function displayForBounds(bounds) {
  return (
    screen.getAllDisplays().find((d) => {
      const a = d.workArea;
      return (
        bounds.x + bounds.width > a.x &&
        bounds.x < a.x + a.width &&
        bounds.y + bounds.height > a.y &&
        bounds.y < a.y + a.height
      );
    }) || null
  );
}

function saveLastBounds(bounds) {
  if (!settings || !mainWindow || mainWindow.isDestroyed()) return;
  const b = bounds || mainWindow.getBounds();
  const prev = settings.lastBounds;
  if (prev && prev.x === b.x && prev.y === b.y) return;
  settings = settingsStore.persist(dataDir(), { ...settings, lastBounds: { x: b.x, y: b.y } });
}

function broadcast(message = null) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pet:state', { state: petState, message, settings: settingsView() });
  }
}

// What the renderer may see, plus a main-process-only "is this a git repo" flag
// the HUD uses to enable the install-hooks button.
function settingsView() {
  return {
    ...settingsStore.publicView(settings),
    repoIsGit: hooks.isGitRoot(settings.repoDir || process.cwd()),
  };
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

function aiBudget() {
  const day = dayKey();
  const used = petState.aiLinesToday && petState.aiLinesToday.day === day ? petState.aiLinesToday.count : 0;
  const cooled = Date.now() - (petState.lastAiAt || 0) >= AI_COOLDOWN_MS;
  return { key: resolveApiKey(settings), ok: cooled && used < AI_DAILY_CAP };
}

// The one path for "maybe generate, else say the canned line". Called from
// commit, greetIfNeeded, and handleTick so tick cannot bypass the caps.
function maybeSpeakGenerated(event, canned, snapshot) {
  if (!shouldSpeak(settings.speech, event)) {
    broadcast(null);
    return;
  }
  const budget = aiBudget();
  if (!budget.key || !budget.ok || !isSpecial(event)) {
    speak(event, canned);
    scheduleReturnToIdle();
    return;
  }
  petState = { ...snapshot, state: STATES.thinking };
  broadcast(null);
  generateLine({ event, state: snapshot, apiKey: budget.key }).then((line) => {
    if (!petState) return;
    // Restore the event reaction (celebrating / curious / sad) rather than
    // leaving `thinking` in place, which would skip the visible reaction.
    petState = snapshot;
    if (line) {
      const day = dayKey();
      const used = petState.aiLinesToday && petState.aiLinesToday.day === day ? petState.aiLinesToday.count : 0;
      petState = { ...petState, lastAiAt: Date.now(), aiLinesToday: { day, count: used + 1 } };
    }
    persistPet();
    speak(event, line || canned);
    scheduleReturnToIdle();
  });
}

function commit(result) {
  if (!result || !result.applied) return;
  const event = result.messageEvent || '';
  petState = result.state;
  persistPet();
  maybeSpeakGenerated(event, result.message, result.state);
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
    petState = { ...petState, hatchedAt: Date.now(), lastGreetingDay: today, lastSeenAt: Date.now(), state: STATES.curious };
    persistPet();
    speak('WELCOME', messageFor('WELCOME', petState));
    scheduleReturnToIdle();
    return true;
  }
  // Long absence. lastSeenAt === 0 means unknown — never treat that as a holiday.
  const seenAt = petState.lastSeenAt || 0;
  if (seenAt > 0 && Date.now() - seenAt >= ABSENCE_MS && idleSeconds < 180) {
    petState = { ...petState, lastSeenAt: Date.now(), lastGreetingDay: today, state: STATES.curious };
    Object.assign(petState, note(petState, { kind: 'absence' }, Date.now()));
    persistPet();
    maybeSpeakGenerated('LONG_ABSENCE', messageFor('LONG_ABSENCE', petState), petState);
    return true;
  }
  if (petState.lastGreetingDay !== today && idleSeconds < 180) {
    petState = { ...petState, lastGreetingDay: today, lastSeenAt: Date.now(), state: STATES.curious };
    persistPet();
    maybeSpeakGenerated('DAILY_GREETING', messageFor('DAILY_GREETING', petState), petState);
    return true;
  }
  return false;
}

// Evening, something happened today, the user is around, and we have not said
// so yet today.
function endOfDayDue(idleSeconds) {
  if (new Date().getHours() < END_OF_DAY_HOUR) return false;
  if (idleSeconds >= 180) return false;
  if (!petState || petState.lastEndOfDay === dayKey()) return false;
  const s = petState.dayStats || {};
  return Boolean((s.commits || 0) + (s.pushes || 0) + (s.builds || 0) + (s.tests || 0));
}

function handleTick() {
  let idleSeconds = 0;
  try {
    idleSeconds = powerMonitor.getSystemIdleTime();
  } catch {
    idleSeconds = 0;
  }
  // Refresh the "last seen" clock every tick, so a crash still leaves a value
  // that is at most ~30s stale rather than a days-old clean-quit timestamp.
  petState = { ...petState, lastSeenAt: Date.now() };
  if (greetIfNeeded(idleSeconds)) return;
  const result = tick(petState, { now: Date.now(), idleSeconds });
  if (!result || !result.state) return;

  const wasWalking = petState.state === 'walking';
  petState = result.state;
  persistPet();
  if (wasWalking && petState.state !== 'walking' && roam) {
    roam.pause();
    if (settings.roam && !hovering) roam.resume();
  }

  if (endOfDayDue(idleSeconds)) {
    petState = { ...petState, lastEndOfDay: dayKey() };
    persistPet();
    maybeSpeakGenerated('END_OF_DAY', messageFor('END_OF_DAY', petState), petState);
    return;
  }

  const event = result.messageEvent;
  if (result.message && event) {
    if (event === 'WAKING_UP') maybeSpeakGenerated(event, result.message, petState);
    else {
      speak(event, result.message);
      scheduleReturnToIdle();
    }
  } else {
    broadcast();
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
    const previousName = petState.name || '';
    const namedAt = Date.now();
    petState = { ...petState, name: settings.name, previousName, namedAt };
    // Journal the rename so a later commit can say "You named me Maple."
    Object.assign(petState, note(petState, { kind: 'named', name: settings.name }, namedAt));
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
    if (settings.roam) roam.snapToFloor();
  }
  refreshTrayMenu();
  if (tray && !tray.isDestroyed()) tray.setToolTip(`Desktop Pet — ${settings.name}`);
  syncUpdater();
  return settingsView();
}

function buildMenu() {
  const visible = !!(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible());
  const name = (settings && settings.name) || 'Pip';
  return Menu.buildFromTemplate([
    { label: visible ? `Hide ${name}` : `Show ${name}`, click: toggleHide },
    { label: 'Settings…', click: openSettings },
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

// The panel is opened explicitly from the menu, never on hover. The renderer
// owns the pinned state; main just asks it to open.
function openSettings() {
  setHidden(false);
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('pet:openSettings');
}

// Grow upward (and shrink back) so the pet's feet stay on the floor while the
// in-flow settings panel is visible.
function setHudPinned(pinned) {
  if (!mainWindow || mainWindow.isDestroyed() || pinned === hudPinned) return;
  hudPinned = pinned;
  const b = mainWindow.getBounds();
  const delta = pinned ? HUD_GROWTH : -HUD_GROWTH;
  mainWindow.setBounds({ x: b.x, y: b.y - delta, width: b.width, height: b.height + delta });
  clampToVisibleArea();
  // The panel can be opened from the tray, where the pointer is not over the
  // pet and the window may still be click-through. Make it interactive while
  // open, and restore the hover-based rule (and roaming) on close.
  const roaming = Boolean(roam && settings && settings.roam);
  if (pinned) {
    if (roaming) roam.snapToFloor();
    mainWindow.setIgnoreMouseEvents(false);
    if (roam) roam.pause();
  } else {
    applyClickThrough();
    if (roaming && !hovering) roam.resume();
    if (roaming) roam.snapToFloor();
  }
}

// Start/stop the quiet auto-updater to match the setting.
function syncUpdater() {
  const wanted = Boolean(settings && settings.autoUpdate);
  if (wanted && !updater) {
    updater = initUpdater({
      log,
      onDownloaded: () => {
        if (!petState) return;
        petState = { ...petState, state: STATES.celebrating };
        persistPet();
        speak('UPDATE', messageFor('UPDATE', petState));
        scheduleReturnToIdle();
      },
    });
  } else if (!wanted && updater) {
    updater.stop();
    updater = null;
  }
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
    width: WINDOW_W,
    height: WINDOW_H,
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

  if (
    settings.lastBounds &&
    displayForBounds({ ...settings.lastBounds, width: WINDOW_W, height: WINDOW_H })
  ) {
    mainWindow.setBounds({ x: settings.lastBounds.x, y: settings.lastBounds.y, width: WINDOW_W, height: WINDOW_H });
  }

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
  log = createLogger(dir);
  // A desktop pet with no window chrome has no business in the Dock.
  if (process.platform === 'darwin' && app.dock) app.dock.hide();
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
  ipcMain.handle('pet:getSettings', () => settingsView());
  ipcMain.on('pet:setSettings', (e, patch) => {
    const view = applySettings(patch || {});
    e.sender.send('pet:settings', view);
    broadcast();
  });
  ipcMain.on('pet:intent', (_, type) => {
    if (type === 'pet' || type === 'feed') handleEvent(type.toUpperCase());
  });
  ipcMain.on('pet:installHooks', () => {
    const result = hooks.installHooks(settings.repoDir || process.cwd());
    if (!result.ok) {
      broadcast('No git repo here to add hooks to.');
      return;
    }
    const parts = [];
    if (result.written.length) parts.push(`installed ${result.written.join(', ')}`);
    if (result.skipped.length) parts.push(`left ${result.skipped.join(', ')} alone`);
    broadcast(parts.length ? `Hooks: ${parts.join('; ')}.` : 'Hooks already installed.');
  });
  ipcMain.on('pet:toggleHide', () => toggleHide());
  ipcMain.on('pet:hudPinned', (_e, pinned) => setHudPinned(!!pinned));
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
    saveLastBounds();
    if (roam && settings.roam) roam.returnToFloor();
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
    persistBounds: saveLastBounds,
    log,
  });
  if (settings.roam) {
    roam.snapToFloor();
    roam.schedule();
  }

  try {
    globalShortcut.register('CommandOrControl+Alt+P', toggleHide);
  } catch (err) {
    console.error('[pet] shortcut unavailable', err);
  }

  tickTimer = setInterval(handleTick, TICK_MS);
  try {
    // A laptop lid or sleep is the other way to leave; record it too.
    powerMonitor.on('suspend', () => {
      if (petState) {
        petState = { ...petState, lastSeenAt: Date.now() };
        persistPet();
      }
    });
  } catch {
    /* unsupported on this platform */
  }
  eventSource = eventsSource.start({
    onEvent: handleEvent,
    repoDir: settings.repoDir || process.cwd(),
    log,
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  syncUpdater();
});

app.on('window-all-closed', () => {
  // Stay alive in the tray.
});

app.on('before-quit', () => {
  isQuitting = true;
  if (petState) petState = { ...petState, lastSeenAt: Date.now() };
  saveLastBounds();
  if (tickTimer) clearInterval(tickTimer);
  if (returnTimer) clearTimeout(returnTimer);
  if (roam) roam.stop();
  if (updater) updater.stop();
  if (eventSource) eventSource.stop();
  globalShortcut.unregisterAll();
});
