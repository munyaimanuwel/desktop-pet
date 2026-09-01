const { test } = require('node:test');
const assert = require('node:assert');
const { createInitialState } = require('./state');
const { tick, deriveMood } = require('./tick');

function fresh(overrides = {}) {
  return { ...createInitialState(), ...overrides, lastTickAt: 1 };
}

test('hunger rises over time and happiness decays while ignored', () => {
  const s = fresh({ lastActivity: 1 });
  const fiveMin = 5 * 60 * 1000;
  const { state } = tick(s, { now: fiveMin, idleSeconds: 0 });
  assert.strictEqual(state.hunger, 41); // 40 + 1
  // 5 min ignored → -1/6 happiness, rounds to 69
  assert.ok(state.happiness < 70);
});

test('idle 5+ minutes makes pet sleepy', () => {
  const s = fresh();
  const { state, message } = tick(s, { now: 5 * 60 * 1000 + 1000, idleSeconds: 5 * 60 + 1 });
  assert.strictEqual(state.state, 'sleepy');
  assert.ok(message);
});

test('idle 15+ minutes makes pet sleep and restores energy', () => {
  const s = fresh({ energy: 50, lastTickAt: 0 });
  const fifteenMin = 15 * 60 * 1000;
  const { state } = tick(s, { now: fifteenMin, idleSeconds: 15 * 60 + 1 });
  assert.strictEqual(state.state, 'sleeping');
  // sleep recovery: 15 min * (1/2min) = +7.5 energy
  assert.ok(state.energy > 50);
});

test('waking up when the user returns', () => {
  const s = fresh({ state: 'sleeping', lastTickAt: 0 });
  const { state, message } = tick(s, { now: 60 * 1000, idleSeconds: 10 });
  assert.strictEqual(state.state, 'curious');
  assert.ok(message);
});

test('low energy makes pet sleepy even when active', () => {
  const s = fresh({ energy: 15, lastActivity: Date.now() });
  const { state } = tick(s, { now: Date.now(), idleSeconds: 0 });
  assert.strictEqual(state.state, 'sleepy');
});

test('deriveMood reflects stats', () => {
  const s = fresh({ hunger: 90 });
  assert.strictEqual(deriveMood(s), 'hungry');
  const t = fresh({ energy: 10 });
  assert.strictEqual(deriveMood(t), 'sleepy');
  const u = fresh({ happiness: 80 });
  assert.strictEqual(deriveMood(u), 'joyful');
  const v = fresh({ happiness: 20 });
  assert.strictEqual(deriveMood(v), 'grumpy');
  assert.strictEqual(deriveMood(fresh()), 'content');
});

test('tick does not mutate input state', () => {
  const s = fresh({ lastTickAt: 0 });
  const before = JSON.stringify(s);
  tick(s, { now: 60 * 1000, idleSeconds: 0 });
  assert.strictEqual(JSON.stringify(s), before);
});
