// Local, boring memory: a rolling log plus per-day counters.
// Used for recall lines ("3 commits today") — no LLM required.

const MAX_MEMORIES = 40;

function dayKey(now = Date.now()) {
  const d = new Date(now);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

function emptyDay(now = Date.now()) {
  return {
    day: dayKey(now),
    commits: 0,
    pushes: 0,
    builds: 0,
    tests: 0,
    failures: 0,
    pets: 0,
    feeds: 0,
  };
}

const COUNTERS = {
  COMMIT: 'commits',
  PUSH: 'pushes',
  BUILD_SUCCESS: 'builds',
  TEST_SUCCESS: 'tests',
  BUILD_FAILURE: 'failures',
  TEST_FAILURE: 'failures',
  PET: 'pets',
  FEED: 'feeds',
};

function remember(state, event, now = Date.now()) {
  const today = dayKey(now);
  const prev = state.dayStats && state.dayStats.day === today ? state.dayStats : emptyDay(now);
  const dayStats = { ...emptyDay(now), ...prev, day: today };
  const counter = COUNTERS[event];
  if (counter) dayStats[counter] = (dayStats[counter] || 0) + 1;

  const memories = [...(state.memories || []), { type: event, at: now }].slice(-MAX_MEMORIES);
  return { dayStats, memories };
}

function recallLine(state) {
  const s = state.dayStats;
  if (!s || s.day !== dayKey()) return null;
  if (s.failures >= 3) return `${s.failures} failures today. We can still turn this around.`;
  if (s.commits >= 5) return `${s.commits} commits today. I am impressed.`;
  if (s.pushes >= 2) return `${s.pushes} pushes. Shipping is a habit.`;
  if (s.feeds >= 3) return 'Well fed. I could get used to this.';
  return null;
}

module.exports = { dayKey, emptyDay, remember, recallLine, MAX_MEMORIES };
