// Walk the pet along the current display. X only — the user keeps the height.

function createRoam({
  getWindow,
  getState,
  setState,
  persist,
  broadcast,
  getSettings,
  screen,
}) {
  let timer = null;
  let anim = null;
  let paused = false;

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

  function schedule() {
    if (timer) clearTimeout(timer);
    const settings = getSettings();
    if (!settings || !settings.roam) return;
    timer = setTimeout(start, 14000 + Math.random() * 26000);
  }

  function start() {
    const win = getWindow();
    const settings = getSettings();
    if (!win || win.isDestroyed() || !win.isVisible() || paused || !settings.roam || busy()) {
      schedule();
      return;
    }
    const bounds = win.getBounds();
    const area = screen.getDisplayMatching(bounds).workArea;
    const minX = area.x;
    const maxX = area.x + area.width - bounds.width;
    if (maxX <= minX + 40) {
      schedule();
      return;
    }
    let targetX = Math.round(minX + Math.random() * (maxX - minX));
    if (Math.abs(targetX - bounds.x) < 90) {
      targetX = bounds.x > (minX + maxX) / 2 ? minX + 24 : maxX - 24;
    }
    const facing = targetX >= bounds.x ? 1 : -1;
    const state = { ...getState(), state: 'walking', facing };
    setState(state);
    persist();
    broadcast();

    const dist = Math.abs(targetX - bounds.x);
    const duration = Math.min(5200, Math.max(1600, dist * 7));
    const startX = bounds.x;
    const t0 = Date.now();
    stopAnim();
    anim = setInterval(() => {
      const w = getWindow();
      if (!w || w.isDestroyed() || paused) {
        finish(false);
        return;
      }
      const t = Math.min(1, (Date.now() - t0) / duration);
      const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      const x = Math.round(startX + (targetX - startX) * eased);
      w.setPosition(x, bounds.y);
      if (t >= 1) finish(true);
    }, 32);
  }

  function finish(settled) {
    stopAnim();
    const state = getState();
    if (settled && state && state.state === 'walking') {
      setState({ ...state, state: 'idle' });
      persist();
      broadcast();
    }
    schedule();
  }

  function pause() {
    paused = true;
    stopAnim();
    const state = getState();
    if (state && state.state === 'walking') {
      setState({ ...state, state: 'idle' });
      persist();
      broadcast();
    }
  }

  function resume() {
    paused = false;
    schedule();
  }

  function stop() {
    paused = true;
    if (timer) clearTimeout(timer);
    timer = null;
    stopAnim();
  }

  return { schedule, pause, resume, stop, start };
}

module.exports = { createRoam };
