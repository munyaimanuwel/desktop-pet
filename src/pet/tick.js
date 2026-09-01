// The "feel alive" decay loop. Pure function of state + time deltas.
// Run every ~30s from the main process.
const { clone } = require('./state');
const { messageFor } = require('./messages');

const CLAMP = (v) => Math.max(0, Math.min(100, v));

const IDLE_SLEEPY_S = 5 * 60; // 5 min idle → sleepy
const IDLE_SLEEPING_S = 15 * 60; // 15 min idle → sleeping
const HUNGRY_THRESHOLD = 85;
const LOW_ENERGY = 20;

// Rates per millisecond, derived from "per minute" constants.
const HUNGER_PER_MS = 1 / (5 * 60 * 1000); // +1 hunger / 5 min
const ENERGY_PER_MS = 1 / (10 * 60 * 1000); // -1 energy / 10 min
const HAPPINESS_PER_MS = 1 / (30 * 60 * 1000); // -1 happiness / 30 min while ignored
const SLEEP_RECOVERY_PER_MS = 1 / (2 * 60 * 1000); // +1 energy / 2 min while sleeping

// Derive a mood label from stats. Kept simple and deterministic.
function deriveMood(state) {
  if (state.hunger >= HUNGRY_THRESHOLD) return 'hungry';
  if (state.energy < LOW_ENERGY) return 'sleepy';
  if (state.happiness >= 75) return 'joyful';
  if (state.happiness <= 30) return 'grumpy';
  return 'content';
}

// Advance the pet by the elapsed wall-clock time. `idleSeconds` is the system
// idle time as reported by powerMonitor (0 if the user has been active).
// Returns { state, message } — message is a one-time bubble line, if any.
function tick(state, { now = Date.now(), idleSeconds = 0 } = {}) {
  const next = clone(state);
  const elapsed = Math.max(0, now - (state.lastTickAt || state.lastActivity || now));
  next.lastTickAt = now;

  const idleMs = idleSeconds * 1000;
  const wasSleeping = next.state === 'sleeping';

  // Waking up: user returned after a long idle stretch.
  if (wasSleeping && idleSeconds < IDLE_SLEEPY_S) {
    next.state = 'curious';
    next.lastActivity = now;
    return { state: next, message: messageFor('WAKING_UP') };
  }

  // Decay. Stats round to whole numbers so the UI reads cleanly.
  next.hunger = Math.round(CLAMP(next.hunger + elapsed * HUNGER_PER_MS));
  next.energy = Math.round(CLAMP(next.energy - elapsed * ENERGY_PER_MS));

  // Ignored pet: happiness drifts down, but only while the user is around.
  const ignoredForMs = now - (next.lastActivity || now);
  if (idleSeconds < IDLE_SLEEPY_S && ignoredForMs > 0) {
    next.happiness = CLAMP(next.happiness - ignoredForMs * HAPPINESS_PER_MS);
  }

  // Sleeping restores energy.
  if (wasSleeping || idleSeconds >= IDLE_SLEEPING_S) {
    next.energy = Math.round(CLAMP(next.energy + elapsed * SLEEP_RECOVERY_PER_MS));
  }

  next.mood = deriveMood(next);

  // State transitions. Sleep wins when the user is away; otherwise low energy
  // trumps hunger (an exhausted pet sleeps, a hungry one just complains).
  let message = null;
  if (idleSeconds >= IDLE_SLEEPING_S && next.state !== 'sleeping') {
    next.state = 'sleeping';
    message = messageFor('FALLING_ASLEEP');
  } else if (idleSeconds >= IDLE_SLEEPY_S && next.state === 'idle') {
    next.state = 'sleepy';
    message = messageFor('FALLING_ASLEEP');
  } else if (next.energy < LOW_ENERGY && next.state === 'idle') {
    next.state = 'sleepy';
    message = messageFor('FALLING_ASLEEP');
  } else if (next.hunger >= HUNGRY_THRESHOLD && next.state === 'idle') {
    message = messageFor('HUNGRY');
  }

  return { state: next, message };
}

module.exports = { tick, deriveMood, IDLE_SLEEPY_S, IDLE_SLEEPING_S };
