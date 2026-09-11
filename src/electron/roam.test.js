const { test, mock } = require('node:test');
const assert = require('node:assert');
const { createRoam } = require('./roam');
const { floorY } = require('./habitat-math');

const WIN_W = 340;
const WIN_H = 400;
const FLOOR = 1040 - WIN_H; // 640

function makeWindow(x = 100, y = 300) {
  let bounds = { x, y, width: WIN_W, height: WIN_H };
  const moved = [];
  return {
    moved,
    getBounds: () => ({ ...bounds }),
    setPosition(nx, ny) {
      bounds = { ...bounds, x: nx, y: ny };
      moved.push({ x: nx, y: ny });
    },
    isDestroyed: () => false,
    isVisible: () => true,
  };
}

function makeScreen(displays) {
  const handlers = {};
  return {
    handlers,
    getDisplayMatching: () => displays[0],
    getAllDisplays: () => displays,
    on: (ev, fn) => {
      handlers[ev] = fn;
    },
    off: (ev) => {
      delete handlers[ev];
    },
  };
}

function makeHarness({ displays, window, settings = { roam: true }, state = { state: 'idle' } }) {
  const scr = makeScreen(displays);
  const win = window || makeWindow();
  const live = { ...state };
  const boundsCalls = [];
  const roam = createRoam({
    getWindow: () => win,
    getState: () => live,
    setState: (next) => Object.assign(live, next),
    persist: () => {},
    broadcast: () => {},
    getSettings: () => settings,
    screen: scr,
    persistBounds: (b) => boundsCalls.push(b),
  });
  return { roam, win, live, boundsCalls, handlers: scr.handlers };
}

const singleDisplay = [{ id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } }];

function withFakeTimers(fn) {
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const realRandom = Math.random;
  try {
    fn();
  } finally {
    Math.random = realRandom;
    mock.timers.reset();
  }
}

test('walk frames never write a Y other than the display floor', () => {
  withFakeTimers(() => {
    Math.random = () => 0.5;
    const { roam, win } = makeHarness({ displays: singleDisplay });
    roam.start();
    mock.timers.tick(6000);
    assert.ok(win.moved.length > 0);
    for (const p of win.moved) assert.strictEqual(p.y, FLOOR);
    roam.stop();
  });
});

test('hop lands on the second display floor', () => {
  withFakeTimers(() => {
    Math.random = () => 0;
    mock.timers.setTime(10 * 60 * 1000);
    const displays = [
      { id: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
      { id: 2, workArea: { x: 1920, y: 0, width: 1920, height: 1040 } },
    ];
    const { roam, win, live } = makeHarness({ displays });
    roam.start();
    mock.timers.tick(8000);
    mock.timers.tick(2000);
    const last = win.moved[win.moved.length - 1];
    assert.strictEqual(last.x, 1944);
    assert.strictEqual(last.y, floorY(displays[1].workArea, WIN_H));
    assert.strictEqual(live.state, 'idle');
    roam.stop();
  });
});

test('sleeping pet does not move', () => {
  withFakeTimers(() => {
    const { roam, win } = makeHarness({ displays: singleDisplay, state: { state: 'sleeping' } });
    roam.start();
    mock.timers.tick(6000);
    assert.strictEqual(win.moved.length, 0);
    roam.stop();
  });
});

test('wander off parks the pet (no snap on start)', () => {
  withFakeTimers(() => {
    const { roam, win } = makeHarness({ displays: singleDisplay, settings: { roam: false } });
    roam.start();
    roam.snapToFloor();
    mock.timers.tick(6000);
    assert.strictEqual(win.moved.length, 0);
    roam.stop();
  });
});

test('snapToFloor is skipped while drag-paused, applies after resume', () => {
  withFakeTimers(() => {
    const { roam, win } = makeHarness({ displays: singleDisplay });
    roam.pause();
    roam.snapToFloor();
    assert.strictEqual(win.moved.length, 0);
    roam.resume();
    roam.snapToFloor();
    assert.deepStrictEqual(win.moved[win.moved.length - 1], { x: 100, y: FLOOR });
    roam.stop();
  });
});

test('display metric change reclamps only when not paused', () => {
  withFakeTimers(() => {
    const { roam, win, handlers } = makeHarness({ displays: singleDisplay });
    roam.pause();
    handlers['display-metrics-changed']();
    assert.strictEqual(win.moved.length, 0);
    roam.resume();
    handlers['display-metrics-changed']();
    assert.strictEqual(win.moved[win.moved.length - 1].y, FLOOR);
    roam.stop();
  });
});

test('dragEnd return-to-floor animates until on the floor', () => {
  withFakeTimers(() => {
    const { roam, win } = makeHarness({ displays: singleDisplay });
    roam.returnToFloor();
    mock.timers.tick(1000);
    assert.strictEqual(win.moved[win.moved.length - 1].y, FLOOR);
    roam.stop();
  });
});

test('persistBounds is called after a walk settles', () => {
  withFakeTimers(() => {
    Math.random = () => 0.5;
    const { roam, boundsCalls } = makeHarness({ displays: singleDisplay });
    roam.start();
    mock.timers.tick(6000);
    assert.ok(boundsCalls.length > 0);
    roam.stop();
  });
});
