// Walk the pet along the work-area floor and occasionally hop to another
// display. Wander on = floor + hop; Wander off = parked wherever dropped.
const {
  floorY,
  clampX,
  otherDisplays,
  pickHopTarget,
  hopLanding,
  hopEdgeX,
} = require('./habitat-math');

const WALK_MIN_MS = 14000;
const WALK_JITTER_MS = 26000;
const FRAME_MS = 32;
const HOP_P = 0.22;
const HOP_COOLDOWN_MS = 2 * 60 * 1000;
const HOP_SETTLE_MS = 1200;
const RETURN_MS = 550;

function createRoam({
  getWindow,
  getState,
  setState,
  persist,
  broadcast,
  getSettings,
  screen,
  persistBounds,
  log = { info() {} },
}) {
  let timer = null;
  let anim = null;
  let settleTimer = null;
  let paused = false;
  let lastHopAt = 0;

  function busy() {
    const state = getState();
    if (!state) return true;
    const s = state.state;
    return s === 'sleeping' || s === 'sleepy' || s === 'eating' || s === 'walking';
  }

  function stopAnim() {
    if (anim) {
      clearInterval(anim);
      anim = null;
    }
  }

  function setWalking(facing) {
    const state = { ...getState(), state: 'walking' };
    if (facing === 1 || facing === -1) state.facing = facing;
    setState(state);
    persist();
    broadcast();
  }

  function settleIdle() {
    const state = getState();
    if (state && state.state === 'walking') {
      setState({ ...state, state: 'idle' });
      persist();
      broadcast();
    }
  }

  function saveBounds() {
    if (!persistBounds || !getWindow) return;
    const win = getWindow();
    if (win && !win.isDestroyed()) persistBounds(win.getBounds());
  }

  function currentDisplay(win) {
    const bounds = win.getBounds();
    return screen.getDisplayMatching(bounds);
  }

  function schedule() {
    if (timer) clearTimeout(timer);
    const settings = getSettings();
    if (!settings || !settings.roam) return;
    timer = setTimeout(start, WALK_MIN_MS + Math.random() * WALK_JITTER_MS);
  }

  // Animate X toward targetX while keeping Y pinned to `floor` every frame.
  function animateTo(targetX, floor, onDone) {
    const win = getWindow();
    const startX = win.getBounds().x;
    const dist = Math.abs(targetX - startX);
    const duration = Math.min(5200, Math.max(1600, dist * 7));
    const t0 = Date.now();
    let done = false;
    const finish = (settled) => {
      if (done) return;
      done = true;
      stopAnim();
      onDone(settled);
    };
    stopAnim();
    anim = setInterval(() => {
      if (done) return;
      const w = getWindow();
      if (!w || w.isDestroyed() || paused) {
        finish(false);
        return;
      }
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      w.setPosition(Math.round(startX + (targetX - startX) * eased), floor);
      if (t >= 1) finish(true);
    }, FRAME_MS);
  }

  function start() {
    const win = getWindow();
    const settings = getSettings();
    if (
      !win ||
      win.isDestroyed() ||
      !win.isVisible() ||
      paused ||
      !settings ||
      !settings.roam ||
      busy()
    ) {
      schedule();
      return;
    }
    const display = currentDisplay(win);
    const area = display.workArea;
    const bounds = win.getBounds();
    const minX = area.x;
    const maxX = area.x + area.width - bounds.width;
    if (maxX <= minX + 40) {
      schedule();
      return;
    }

    const others = otherDisplays(screen.getAllDisplays(), display.id);
    if (others.length && Date.now() - lastHopAt > HOP_COOLDOWN_MS && Math.random() < HOP_P) {
      hop(win, area, others);
      return;
    }
    floorWalk(win, area, minX, maxX);
  }

  function floorWalk(win, area, minX, maxX) {
    const bounds = win.getBounds();
    let targetX = Math.round(minX + Math.random() * (maxX - minX));
    if (Math.abs(targetX - bounds.x) < 90) {
      targetX = bounds.x > (minX + maxX) / 2 ? minX + 24 : maxX - 24;
    }
    targetX = clampX(area, targetX, bounds.width);
    const facing = targetX >= bounds.x ? 1 : -1;
    const floor = floorY(area, bounds.height);
    setWalking(facing);
    animateTo(targetX, floor, () => {
      settleIdle();
      saveBounds();
      schedule();
    });
  }

  function hop(win, area, others) {
    const current = { workArea: area };
    const bounds = win.getBounds();
    const dest = pickHopTarget(current, others);
    if (!dest) {
      floorWalk(win, area, area.x, area.x + area.width - bounds.width);
      return;
    }
    const edgeX = hopEdgeX(area, dest.workArea, bounds.width);
    const facing = edgeX >= bounds.x ? 1 : -1;
    setWalking(facing);
    animateTo(edgeX, floorY(area, bounds.height), (settled) => {
      if (!settled) {
        schedule();
        return;
      }
      const w = getWindow();
      if (!w || w.isDestroyed()) {
        schedule();
        return;
      }
      const landing = hopLanding(dest.workArea, area, w.getBounds().width);
      lastHopAt = Date.now();
      log.info(`[pet] hop to display ${dest.id}`);
      w.setPosition(landing.x, floorY(dest.workArea, w.getBounds().height));
      setState({ ...getState(), state: 'curious', facing: landing.facing });
      persist();
      broadcast();
      saveBounds();
      if (settleTimer) clearTimeout(settleTimer);
      settleTimer = setTimeout(() => {
        const state = getState();
        if (state && state.state === 'curious') {
          setState({ ...state, state: 'idle' });
          persist();
          broadcast();
        }
      }, HOP_SETTLE_MS);
      schedule();
    });
  }

  // Instant: put the window on the floor of whatever display it is over.
  function snapToFloor() {
    const win = getWindow();
    const settings = getSettings();
    if (!win || win.isDestroyed() || !settings || !settings.roam || paused) return;
    const bounds = win.getBounds();
    const area = currentDisplay(win).workArea;
    const y = floorY(area, bounds.height);
    const x = clampX(area, bounds.x, bounds.width);
    if (x !== bounds.x || y !== bounds.y) win.setPosition(x, y);
    saveBounds();
  }

  // After a drag with Wander on: ease back down to the floor (and across, if
  // the drop was far horizontally). A drop already on the floor is a no-op.
  function returnToFloor() {
    const win = getWindow();
    const settings = getSettings();
    if (!win || win.isDestroyed() || !settings || !settings.roam) return;
    const bounds = win.getBounds();
    const area = currentDisplay(win).workArea;
    const y = floorY(area, bounds.height);
    const x = clampX(area, bounds.x, bounds.width);
    if (Math.abs(y - bounds.y) < 8) {
      if (x !== bounds.x || y !== bounds.y) win.setPosition(x, y);
      saveBounds();
      return;
    }
    const startY = bounds.y;
    const startX = bounds.x;
    setWalking(x >= startX ? 1 : -1);
    stopAnim();
    const t0 = Date.now();
    let done = false;
    anim = setInterval(() => {
      if (done) return;
      const w = getWindow();
      if (!w || w.isDestroyed()) {
        done = true;
        stopAnim();
        return;
      }
      const t = Math.min(1, (Date.now() - t0) / RETURN_MS);
      const eased = 1 - Math.pow(1 - t, 3);
      w.setPosition(
        Math.round(startX + (x - startX) * eased),
        Math.round(startY + (y - startY) * eased)
      );
      if (t >= 1) {
        done = true;
        stopAnim();
        settleIdle();
        saveBounds();
      }
    }, FRAME_MS);
  }

  function pause() {
    paused = true;
    stopAnim();
    settleIdle();
  }

  function resume() {
    paused = false;
    schedule();
  }

  function stop() {
    paused = true;
    if (timer) clearTimeout(timer);
    timer = null;
    if (settleTimer) clearTimeout(settleTimer);
    settleTimer = null;
    stopAnim();
    if (screen && screen.off) {
      screen.off('display-added', onDisplaysChanged);
      screen.off('display-removed', onDisplaysChanged);
      screen.off('display-metrics-changed', onDisplaysChanged);
    }
  }

  // The work area moved (taskbar, DPI, monitor unplugged): re-read it and snap,
  // but never yank Y out from under an in-progress drag.
  function onDisplaysChanged() {
    const settings = getSettings();
    if (!settings || !settings.roam || paused) return;
    stopAnim();
    settleIdle();
    snapToFloor();
  }

  if (screen && screen.on) {
    screen.on('display-added', onDisplaysChanged);
    screen.on('display-removed', onDisplaysChanged);
    screen.on('display-metrics-changed', onDisplaysChanged);
  }

  return { schedule, pause, resume, stop, start, snapToFloor, returnToFloor };
}

module.exports = { createRoam };
