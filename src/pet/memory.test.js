const { test } = require('node:test');
const assert = require('node:assert');
const {
  remember,
  recallLine,
  dayKey,
  emptyDay,
  note,
  journalLine,
  pickRecall,
  markSpoken,
  MAX_JOURNAL,
} = require('./memory');

test('remember increments today counters and appends a memory', () => {
  const now = Date.parse('2026-09-02T12:00:00Z');
  const s = remember({ memories: [], dayStats: emptyDay(now) }, 'COMMIT', now);
  assert.strictEqual(s.dayStats.commits, 1);
  assert.strictEqual(s.memories.length, 1);
  assert.strictEqual(s.memories[0].type, 'COMMIT');
});

test('remember rolls into a new day', () => {
  const yesterday = Date.parse('2026-09-01T12:00:00Z');
  const today = Date.parse('2026-09-02T12:00:00Z');
  const prev = remember({ memories: [], dayStats: emptyDay(yesterday) }, 'COMMIT', yesterday);
  const next = remember(prev, 'COMMIT', today);
  assert.strictEqual(next.dayStats.day, dayKey(today));
  assert.strictEqual(next.dayStats.commits, 1);
  assert.strictEqual(next.memories.length, 2);
});

test('recallLine mentions a busy commit day', () => {
  const now = Date.now();
  const line = recallLine({ dayStats: { ...emptyDay(now), commits: 5 } });
  assert.match(line, /5 commits/i);
});

test('note appends facts and caps the journal', () => {
  let state = { journal: [] };
  for (let i = 0; i < MAX_JOURNAL + 5; i++) {
    Object.assign(state, note(state, { kind: 'red-streak', minutes: 60 }, 1000 + i));
  }
  assert.strictEqual(state.journal.length, MAX_JOURNAL);
  assert.strictEqual(state.journal[0].at, 1005);
});

test('journalLine speaks the notable facts', () => {
  const now = Date.parse('2026-09-02T12:00:00Z');
  assert.match(journalLine({ kind: 'red-streak', minutes: 60, at: now }, {}, now), /red for an hour/i);
  assert.match(journalLine({ kind: 'red-streak', minutes: 120, at: now }, {}, now), /two hours/i);
  assert.match(journalLine({ kind: 'push-gap', days: 3, at: now }, {}, now), /three days/i);
  assert.match(journalLine({ kind: 'absence', at: now }, {}, now), /gone a while/i);
  assert.strictEqual(journalLine({ kind: 'unknown', at: now }, {}, now), null);
});

test('named line uses yesterday only for an older fact', () => {
  const now = Date.parse('2026-09-02T12:00:00Z');
  const today = journalLine({ kind: 'named', name: 'Maple', at: now }, {}, now);
  const older = journalLine({ kind: 'named', name: 'Maple', at: now - 86400000 }, {}, now);
  assert.strictEqual(today, 'You named me Maple.');
  assert.strictEqual(older, 'You named me Maple yesterday.');
});

test('pickRecall prefers an unspoken journal fact, then marks it spoken', () => {
  const now = Date.now();
  const state = { journal: [{ kind: 'absence', at: now - 1000 }], dayStats: emptyDay(now) };
  const first = pickRecall(state, now);
  assert.match(first.line, /gone a while/i);
  assert.strictEqual(first.factAt, now - 1000);
  const spoken = { ...state, ...markSpoken(state, first.factAt, now) };
  const second = pickRecall(spoken, now);
  assert.strictEqual(second.line, null); // no counters left, fact already used
});

test('pickRecall ignores facts older than 48h and falls back to counters', () => {
  const now = Date.now();
  const state = {
    journal: [{ kind: 'absence', at: now - 72 * 60 * 60 * 1000 }],
    dayStats: { ...emptyDay(now), commits: 5 },
  };
  assert.match(pickRecall(state, now).line, /5 commits/i);
});
