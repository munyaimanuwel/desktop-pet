// Local, boring memory: a rolling log plus per-day counters.
// Used for recall lines ("3 commits today") — no LLM required.

const MAX_MEMORIES = 40;
const MAX_JOURNAL = 60;
const DAY_MS = 24 * 60 * 60 * 1000;
const RECALL_WINDOW_MS = 48 * 60 * 60 * 1000;

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

// Append a notable fact. Journal is a derived log, not a copy of every event.
function note(state, fact, now = Date.now()) {
  const journal = [...(state.journal || []), { at: now, ...fact }].slice(-MAX_JOURNAL);
  return { journal };
}

// The deterministic line for a fact, or null if it has no voice.
function journalLine(fact, state, now = Date.now()) {
  if (!fact) return null;
  switch (fact.kind) {
    case 'named': {
      const whose = fact.name || (state && state.name) || 'me';
      return dayKey(fact.at) === dayKey(now)
        ? `You named me ${whose}.`
        : `You named me ${whose} yesterday.`;
    }
    case 'red-streak':
      return fact.minutes >= 120
        ? 'You have been red for two hours.'
        : 'You have been red for an hour.';
    case 'push-gap':
      return fact.days >= 3
        ? `First push in ${fact.days >= 7 ? 'a week' : 'three days'}.`
        : 'First push in a while.';
    case 'absence':
      return 'You were gone a while. I kept the desk.';
    case 'busy-day':
      return fact.pushes >= 2
        ? `${fact.pushes} pushes. Shipping is a habit.`
        : `${fact.commits} commits today. I am impressed.`;
    default:
      return null;
  }
}

// Most recent unspoken journal fact from the last 48h, else today's counters.
// Returns { line, factAt } — factAt is set when the line came from the journal,
// so the caller can mark it spoken.
function pickRecall(state, now = Date.now()) {
  const journal = state.journal || [];
  for (let i = journal.length - 1; i >= 0; i--) {
    const fact = journal[i];
    if (!fact || fact.spokenAt) continue;
    if (now - fact.at > RECALL_WINDOW_MS) continue;
    const line = journalLine(fact, state, now);
    if (line) return { line, factAt: fact.at };
  }
  // Counters are the fallback, but only until today's busy-day has been
  // journaled — otherwise "6 commits today" would repeat on every later commit.
  const busyToday = journal.some((f) => f && f.kind === 'busy-day' && dayKey(f.at) === dayKey(now));
  if (busyToday) return { line: null, factAt: 0 };
  return { line: recallLine(state), factAt: 0 };
}

// Mark the journal fact at `at` as spoken so it is not repeated.
function markSpoken(state, at, now = Date.now()) {
  if (!at) return {};
  const journal = (state.journal || []).map((f) => (f && f.at === at ? { ...f, spokenAt: now } : f));
  return { journal };
}

module.exports = {
  dayKey,
  emptyDay,
  remember,
  recallLine,
  pickRecall,
  markSpoken,
  note,
  journalLine,
  MAX_MEMORIES,
  MAX_JOURNAL,
  DAY_MS,
};
