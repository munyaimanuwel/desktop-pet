// Deterministic reactions to developer events.
// Pure arithmetic on pet state — no LLM, no I/O.
const { clone, xpForLevel } = require('./state');
const { messageFor } = require('./messages');

const COOLDOWN_MS = 60 * 1000;

// Which state the pet should enter for each event type.
const EVENT_STATE = {
  COMMIT: 'happy',
  PUSH: 'celebrating',
  BUILD_SUCCESS: 'excited',
  BUILD_FAILURE: 'sad',
  TEST_SUCCESS: 'happy',
  TEST_FAILURE: 'sad',
  MULTIPLE_FAILURES: 'angry',
  RETURN_FROM_IDLE: 'curious',
  FEED: 'eating',
  PET: 'happy',
};

// XP / stat deltas per event type. Successes earn XP; failures only hurt.
const EVENT_EFFECTS = {
  COMMIT: { xp: 25, happiness: 5 },
  PUSH: { xp: 40, happiness: 5 },
  BUILD_SUCCESS: { xp: 20, happiness: 5 },
  BUILD_FAILURE: { xp: 0, happiness: -10 },
  TEST_SUCCESS: { xp: 15, happiness: 4 },
  TEST_FAILURE: { xp: 0, happiness: -10 },
  MULTIPLE_FAILURES: { xp: 0, happiness: -5 },
  RETURN_FROM_IDLE: { xp: 0, happiness: 5 },
  FEED: { xp: 0, happiness: 3, hunger: -30 },
  PET: { xp: 0, happiness: 4 },
};

const CLAMP = (v) => Math.max(0, Math.min(100, v));

const FAILURE_EVENTS = new Set(['BUILD_FAILURE', 'TEST_FAILURE', 'MULTIPLE_FAILURES']);

// Apply an event to a clone of the state. Returns { state, message, applied }.
function applyEvent(state, event, opts = {}) {
  const now = opts.now || Date.now();
  const next = clone(state);

  if (event === 'MULTIPLE_FAILURES') {
    // A dedicated reaction fired by the caller once failures pile up.
    next.state = EVENT_STATE.MULTIPLE_FAILURES;
    next.consecutiveFailures = state.consecutiveFailures;
    next.happiness = CLAMP(state.happiness + EVENT_EFFECTS.MULTIPLE_FAILURES.happiness);
    next.lastActivity = now;
    return { state: next, message: messageFor(event), applied: true };
  }

  const effect = EVENT_EFFECTS[event];
  if (!effect) return { state: next, message: null, applied: false };

  // Cooldown: ignore repeated non-failure events within 60s so a burst of
  // commits doesn't spam messages or re-trigger animations.
  const last = state.lastEventAt && state.lastEventAt[event];
  if (!FAILURE_EVENTS.has(event) && last && now - last < COOLDOWN_MS) {
    return { state: next, message: null, applied: false };
  }

  next.xp = state.xp + (effect.xp || 0);
  next.happiness = CLAMP(state.happiness + (effect.happiness || 0));
  if (effect.hunger) next.hunger = CLAMP(state.hunger + effect.hunger);

  if (event === 'BUILD_SUCCESS' || event === 'TEST_SUCCESS') {
    next.consecutiveFailures = 0;
  } else if (FAILURE_EVENTS.has(event)) {
    next.consecutiveFailures = state.consecutiveFailures + 1;
  }

  if (event === 'FEED') {
    // Full stomach breaks the sleepy trance.
    next.state = EVENT_STATE.FEED;
  } else {
    next.state = EVENT_STATE[event];
  }
  next.lastActivity = now;
  next.lastEventAt = { ...(state.lastEventAt || {}), [event]: now };

  // Level-up check after any XP gain.
  let message = messageFor(event);
  if (next.xp >= xpForLevel(next.level)) {
    next.xp -= xpForLevel(next.level);
    next.level += 1;
    next.state = 'celebrating';
    message = messageFor('LEVEL_UP');
  }

  return { state: next, message, applied: true };
}

module.exports = { applyEvent, COOLDOWN_MS };
