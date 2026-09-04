const fs = require('fs');
const path = require('path');
const { createInitialState, clone, STATES, CLAMP } = require('./state');
const { applyEvent } = require('./events');

function fileFor(dataDir) {
  return path.join(dataDir, 'pet.json');
}

function readRaw(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(dataDir), 'utf8'));
  } catch {
    return null;
  }
}

function finite(n, fallback) {
  return Number.isFinite(n) ? n : fallback;
}

// Fill in missing fields and clamp stats so an older or partial save still runs.
function normalize(raw) {
  const base = createInitialState();
  if (!raw || typeof raw !== 'object') return base;
  const merged = { ...base, ...clone(raw) };
  merged.name = typeof merged.name === 'string' && merged.name.trim() ? merged.name : base.name;
  merged.level = Math.max(1, Math.floor(finite(merged.level, 1)));
  merged.xp = Math.max(0, finite(merged.xp, 0));
  merged.happiness = CLAMP(finite(merged.happiness, base.happiness));
  merged.energy = CLAMP(finite(merged.energy, base.energy));
  merged.hunger = CLAMP(finite(merged.hunger, base.hunger));
  merged.mood = typeof merged.mood === 'string' ? merged.mood : base.mood;
  merged.state = STATES[merged.state] ? merged.state : STATES.idle;
  merged.lastActivity = finite(merged.lastActivity, base.lastActivity);
  merged.lastTickAt = finite(merged.lastTickAt, merged.lastActivity);
  merged.lastWokeUp = finite(merged.lastWokeUp, base.lastWokeUp);
  merged.consecutiveFailures = Math.max(0, Math.floor(finite(merged.consecutiveFailures, 0)));
  merged.lastEventAt = merged.lastEventAt && typeof merged.lastEventAt === 'object' ? merged.lastEventAt : {};
  merged.lastEvent = typeof merged.lastEvent === 'string' && merged.lastEvent ? merged.lastEvent : null;
  merged.facing = merged.facing === -1 ? -1 : 1;
  merged.hatchedAt = finite(merged.hatchedAt, 0);
  if (!merged.hatchedAt && raw && finite(raw.lastActivity, 0)) merged.hatchedAt = raw.lastActivity;
  merged.lastGreetingDay = typeof merged.lastGreetingDay === 'string' ? merged.lastGreetingDay : null;
  merged.memories = Array.isArray(merged.memories) ? merged.memories.slice(-40) : [];
  const stats = merged.dayStats && typeof merged.dayStats === 'object' ? merged.dayStats : {};
  merged.dayStats = {
    day: typeof stats.day === 'string' ? stats.day : '',
    commits: Math.max(0, Math.floor(finite(stats.commits, 0))),
    pushes: Math.max(0, Math.floor(finite(stats.pushes, 0))),
    builds: Math.max(0, Math.floor(finite(stats.builds, 0))),
    tests: Math.max(0, Math.floor(finite(stats.tests, 0))),
    failures: Math.max(0, Math.floor(finite(stats.failures, 0))),
    pets: Math.max(0, Math.floor(finite(stats.pets, 0))),
    feeds: Math.max(0, Math.floor(finite(stats.feeds, 0))),
  };
  return merged;
}

// Load persisted state, or fall back to a fresh instance.
function load(dataDir) {
  return normalize(readRaw(dataDir));
}

function persist(dataDir, state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(fileFor(dataDir), JSON.stringify(state, null, 2));
}

module.exports = { fileFor, load, persist, applyEvent, normalize };
