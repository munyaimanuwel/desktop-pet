// The "feel alive" decay loop. Pure function of state + time deltas.
// Run every ~30s from the main process.
const { clone, CLAMP } = require('./state');
const { messageFor } = require('./messages');
const { note, journalLine } = require('./memory');

const IDLE_SLEEPY_S = 5 * 60; // 5 min idle → sleepy
const IDLE_SLEEPING_S = 15 * 60; // 15 min idle → sleeping
const HUNGRY_THRESHOLD = 85;
const LOW_ENERGY = 20;
const GRUMPY_HAPPINESS = 30;

// Rates per millisecond, derived from "per minute" constants.
const HUNGER_PER_MS = 1 / (5 * 60 * 1000); // +1 hunger / 5 min
const ENERGY_PER_MS = 1 / (10 * 60 * 1000); // -1 energy / 10 min
const HAPPINESS_PER_MS = 1 / (10 * 60 * 1000); // -1 happiness / 10 min while ignored
const SLEEP_RECOVERY_PER_MS = 1 / (2 * 60 * 1000); // +1 energy / 2 min while sleeping

// Derive a mood label from stats (and a couple of animation states).
function deriveMood(state) {
  if (state.state === 'angry') return 'annoyed';
  if (state.state === 'sad') return 'sad';
  if (state.hunger >= HUNGRY_THRESHOLD) return 'hungry';
  if (state.energy < LOW_ENERGY) return 'sleepy';
  if (state.happiness >= 75) return 'joyful';
  if (state.happiness <= GRUMPY_HAPPINESS) return 'grumpy';
  return 'content';
}

// Note a long red build once per milestone (60 / 120 minutes). Kept out of the
// decay math so it can run whether the pet is awake or asleep.
function redStreakPatch(state, now) {
  if (!state.failureStreakStartedAt) return { patch: {}, line: null };
  const minutes = Math.floor((now - state.failureStreakStartedAt) / 60000);
  if (minutes >= 120 && state.redStreakNoted < 2) {
    const fact = { kind: 'red-streak', minutes: 120 };
    return { patch: { redStreakNoted: 2, ...note(state, fact, now) }, line: journalLine(fact, state, now) };
  }
  if (minutes >= 60 && state.redStreakNoted < 1) {
    const fact = { kind: 'red-streak', minutes: 60 };
    return { patch: { redStreakNoted: 1, ...note(state, fact, now) }, line: journalLine(fact, state, now) };
  }
  return { patch: {}, line: null };
}

// Advance the pet by the elapsed wall-clock time. `idleSeconds` is the system
// idle time as reported by powerMonitor (0 if the user has been active).
// Returns { state, message } — message is a one-time bubble line, if any.
function tick(state, { now = Date.now(), idleSeconds = 0 } = {}) {
  const next = clone(state);
  const elapsed = Math.max(0, now - (state.lastTickAt ?? state.lastActivity ?? now));
  next.lastTickAt = now;

  const streak = redStreakPatch(next, now);
  Object.assign(next, streak.patch);

  const wasSleeping = next.state === 'sleeping';
  const wasHungry = state.hunger >= HUNGRY_THRESHOLD;

  // Waking up: user returned after a long idle stretch.
  if (wasSleeping && idleSeconds < IDLE_SLEEPY_S) {
    next.state = 'curious';
    next.lastActivity = now;
    next.lastWokeUp = now;
    next.mood = deriveMood(next);
    return { state: next, message: messageFor('WAKING_UP'), messageEvent: 'WAKING_UP' };
  }

  // Decay. Stats round to whole numbers so the UI reads cleanly.
  next.hunger = Math.round(CLAMP(next.hunger + elapsed * HUNGER_PER_MS));

  const asleep = wasSleeping || idleSeconds >= IDLE_SLEEPING_S;
  if (asleep) {
    next.energy = Math.round(CLAMP(next.energy + elapsed * SLEEP_RECOVERY_PER_MS));
  } else {
    next.energy = Math.round(CLAMP(next.energy - elapsed * ENERGY_PER_MS));
  }

  // Ignored pet: happiness drifts down, but only while the user is around.
  // Use this tick's elapsed time (not total ignored duration) so each tick
  // subtracts a slice rather than re-applying the whole debt.
  const ignoredForMs = now - (next.lastActivity ?? now);
  if (idleSeconds < IDLE_SLEEPY_S && ignoredForMs > 0) {
    next.happiness = Math.round(CLAMP(next.happiness - elapsed * HAPPINESS_PER_MS));
  }

  // State transitions. Sleep wins when the user is away; otherwise low energy
  // trumps hunger (an exhausted pet sleeps, a hungry one just complains).
  // Sustained low happiness stays idle with a grumpy mood — the angry face is
  // reserved for short MULTIPLE_FAILURES reactions that settle via REACTION_STATES.
  let message = null;
  let messageEvent = null;
  if (idleSeconds >= IDLE_SLEEPING_S && next.state !== 'sleeping') {
    next.state = 'sleeping';
    message = messageFor('FALLING_ASLEEP');
    messageEvent = 'FALLING_ASLEEP';
  } else if (idleSeconds >= IDLE_SLEEPY_S && (next.state === 'idle' || next.state === 'walking')) {
    next.state = 'sleepy';
    message = messageFor('FALLING_ASLEEP');
    messageEvent = 'FALLING_ASLEEP';
  } else if (next.energy < LOW_ENERGY && next.state === 'idle') {
    next.state = 'sleepy';
    message = messageFor('FALLING_ASLEEP');
    messageEvent = 'FALLING_ASLEEP';
  } else if (next.hunger >= HUNGRY_THRESHOLD && next.state === 'idle' && !wasHungry) {
    message = messageFor('HUNGRY');
    messageEvent = 'HUNGRY';
  }
  if (!message && streak.line) {
    message = streak.line;
    messageEvent = 'RED_STREAK';
  }

  next.mood = deriveMood(next);
  return { state: next, message, messageEvent };
}

module.exports = { tick, deriveMood, redStreakPatch, IDLE_SLEEPY_S, IDLE_SLEEPING_S, HUNGRY_THRESHOLD };
