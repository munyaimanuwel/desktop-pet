const { test } = require('node:test');
const assert = require('node:assert');
const { createInitialState, REACTION_STATES } = require('./state');
const { applyEvent, COOLDOWN_MS } = require('./events');

function fresh(overrides = {}) {
  return { ...createInitialState(), ...overrides };
}

test('COMMIT grants XP, happiness, and happy state', () => {
  const s = fresh();
  const { state, applied } = applyEvent(s, 'COMMIT', { now: 1000 });
  assert.ok(applied);
  assert.strictEqual(state.xp, 25);
  assert.strictEqual(state.happiness, 75);
  assert.strictEqual(state.state, 'happy');
  assert.strictEqual(state.mood, 'joyful');
  assert.strictEqual(state.lastActivity, 1000);
  assert.strictEqual(state.lastEvent, 'COMMIT');
  assert.strictEqual(state.lastEventAt.COMMIT, 1000);
  assert.strictEqual(state.dayStats.commits, 1);
  assert.strictEqual(state.memories.length, 1);
});

test('BUILD_FAILURE reduces happiness and increments consecutiveFailures', () => {
  const s = fresh();
  const { state } = applyEvent(s, 'BUILD_FAILURE', { now: 1000 });
  assert.strictEqual(state.happiness, 60);
  assert.strictEqual(state.consecutiveFailures, 1);
  assert.strictEqual(state.state, 'sad');
  assert.strictEqual(state.lastEvent, 'BUILD_FAILURE');
});

test('TEST_SUCCESS grants XP and resets consecutiveFailures', () => {
  const s = fresh({ consecutiveFailures: 2 });
  const { state } = applyEvent(s, 'TEST_SUCCESS', { now: 1000 });
  assert.strictEqual(state.xp, 15);
  assert.strictEqual(state.consecutiveFailures, 0);
  assert.strictEqual(state.state, 'happy');
  assert.strictEqual(state.lastEvent, 'TEST_SUCCESS');
});

test('BUILD_SUCCESS resets consecutiveFailures', () => {
  const s = fresh({ consecutiveFailures: 2 });
  const { state } = applyEvent(s, 'BUILD_SUCCESS', { now: 1000 });
  assert.strictEqual(state.consecutiveFailures, 0);
  assert.strictEqual(state.lastEvent, 'BUILD_SUCCESS');
});

test('MULTIPLE_FAILURES sets angry state with message and lastEvent', () => {
  const s = fresh({ consecutiveFailures: 3 });
  const { state, message } = applyEvent(s, 'MULTIPLE_FAILURES', { now: 1000 });
  assert.strictEqual(state.state, 'angry');
  assert.strictEqual(state.mood, 'annoyed');
  assert.strictEqual(state.lastEvent, 'MULTIPLE_FAILURES');
  assert.strictEqual(state.lastEventAt.MULTIPLE_FAILURES, 1000);
  assert.ok(message);
});

test('angry is a short-lived reaction that can settle back to idle', () => {
  assert.ok(REACTION_STATES.has('angry'));
});

test('FEED reduces hunger and clamps to zero', () => {
  const s = fresh({ hunger: 10 });
  const { state } = applyEvent(s, 'FEED', { now: 1000 });
  assert.strictEqual(state.hunger, 0);
  assert.strictEqual(state.state, 'eating');
});

test('level-up consumes XP and celebrates', () => {
  const s = fresh({ level: 1, xp: 95 });
  const { state, message } = applyEvent(s, 'COMMIT', { now: 1000 });
  assert.strictEqual(state.level, 2);
  assert.strictEqual(state.xp, 20); // 95 + 25 - 100
  assert.strictEqual(state.state, 'celebrating');
  assert.match(message, /level/i);
});

test('cooldown suppresses repeated same event within 60s', () => {
  const s = fresh();
  const first = applyEvent(s, 'COMMIT', { now: 1000 });
  assert.ok(first.applied);
  const second = applyEvent(first.state, 'COMMIT', { now: 2000 });
  assert.strictEqual(second.applied, false);
});

test('cooldown does not apply to failures', () => {
  const s = fresh();
  const first = applyEvent(s, 'BUILD_FAILURE', { now: 1000 });
  const second = applyEvent(first.state, 'BUILD_FAILURE', { now: 2000 });
  assert.ok(second.applied);
  assert.strictEqual(second.state.consecutiveFailures, 2);
});

test('unknown event is ignored', () => {
  const s = fresh();
  const before = s.happiness;
  const { applied, message } = applyEvent(s, 'NOPE', { now: 1000 });
  assert.strictEqual(applied, false);
  assert.strictEqual(message, null);
  assert.strictEqual(s.happiness, before);
});

test('state is not mutated by applyEvent', () => {
  const s = fresh();
  const before = JSON.stringify(s);
  applyEvent(s, 'COMMIT', { now: 1000 });
  assert.strictEqual(JSON.stringify(s), before);
});
