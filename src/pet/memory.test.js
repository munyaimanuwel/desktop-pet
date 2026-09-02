const { test } = require('node:test');
const assert = require('node:assert');
const { remember, recallLine, dayKey, emptyDay } = require('./memory');

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
