const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { load, persist, normalize } = require('./store');

test('normalize fills missing fields and clamps stats', () => {
  const s = normalize({ name: 'Pip', happiness: 900, hunger: -4 });
  assert.strictEqual(s.happiness, 100);
  assert.strictEqual(s.hunger, 0);
  assert.strictEqual(s.level, 1);
  assert.strictEqual(s.state, 'idle');
  assert.ok(s.lastEventAt);
});

test('normalize rejects unknown states', () => {
  const s = normalize({ state: 'flying' });
  assert.strictEqual(s.state, 'idle');
});

test('normalize defaults the journal-era fields on an old save', () => {
  const s = normalize({ name: 'Pip' });
  assert.deepStrictEqual(s.journal, []);
  assert.strictEqual(s.lastSeenAt, 0);
  assert.strictEqual(s.lastEndOfDay, null);
  assert.strictEqual(s.lastPushAt, 0);
  assert.deepStrictEqual(s.aiLinesToday, { day: '', count: 0 });
});

test('normalize clamps garbage journal-era fields', () => {
  const s = normalize({
    journal: [{ kind: 'absence', at: 5 }, null, 'nope'],
    lastSeenAt: -5,
    aiLinesToday: 'nope',
  });
  assert.strictEqual(s.journal.length, 1);
  assert.strictEqual(s.lastSeenAt, 0);
  assert.deepStrictEqual(s.aiLinesToday, { day: '', count: 0 });
});

test('load falls back to a fresh pet when the file is missing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-'));
  const s = load(dir);
  assert.strictEqual(s.name, 'Pip');
  assert.strictEqual(s.level, 1);
});

test('persist then load round-trips', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-'));
  persist(dir, { ...load(dir), xp: 42, name: 'Pip' });
  const s = load(dir);
  assert.strictEqual(s.xp, 42);
});
