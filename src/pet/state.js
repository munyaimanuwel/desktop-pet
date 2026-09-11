// The pet's core, deterministic state.
// All behaviour here is pure arithmetic — no LLM required.
const STATES = {
  idle: 'idle',
  happy: 'happy',
  excited: 'excited',
  sad: 'sad',
  angry: 'angry',
  sleepy: 'sleepy',
  sleeping: 'sleeping',
  eating: 'eating',
  thinking: 'thinking',
  celebrating: 'celebrating',
  curious: 'curious',
  walking: 'walking',
};

const CLAMP = (v) => Math.max(0, Math.min(100, v));

// Short-lived reactions that should settle back to idle on their own.
const REACTION_STATES = new Set([
  STATES.happy,
  STATES.excited,
  STATES.sad,
  STATES.angry,
  STATES.eating,
  STATES.celebrating,
  STATES.curious,
  STATES.thinking,
]);

function createInitialState() {
  return {
    name: 'Pip',
    level: 1,
    xp: 0,
    happiness: 70,
    energy: 80,
    hunger: 40,
    mood: 'content',
    state: STATES.idle,
    // Timestamps (ms) used by the "feel alive" decay loops.
    lastActivity: Date.now(),
    lastTickAt: Date.now(),
    lastEventAt: {},
    lastEvent: null,
    consecutiveFailures: 0,
    lastWokeUp: Date.now(),
    facing: 1,
    hatchedAt: 0,
    lastGreetingDay: null,
    memories: [],
    dayStats: { day: '', commits: 0, pushes: 0, builds: 0, tests: 0, failures: 0, pets: 0, feeds: 0 },
    // Journal facts: notable moments the pet can bring up later. Capped, local.
    journal: [],
    lastPushAt: 0,
    failureStreakStartedAt: 0,
    redStreakNoted: 0,
    namedAt: 0,
    previousName: '',
    lastSeenAt: 0, // 0 = unknown; never treat as "gone a long time"
    lastEndOfDay: null,
    lastAiAt: 0,
    aiLinesToday: { day: '', count: 0 },
  };
}

function clone(s) {
  return JSON.parse(JSON.stringify(s));
}

// XP earned scales with level so growth feels meaningful but never punishing.
function xpForLevel(level) {
  return level * 100;
}

module.exports = {
  STATES,
  REACTION_STATES,
  CLAMP,
  createInitialState,
  clone,
  xpForLevel,
};
