const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { normalize, persist, load, publicView } = require('./settings');

test('normalize fills defaults and clamps name', () => {
  const s = normalize({ name: '  Maple  ', speech: 'loud', roam: false });
  assert.strictEqual(s.name, 'Maple');
  assert.strictEqual(s.speech, 'normal');
  assert.strictEqual(s.roam, false);
  assert.strictEqual(s.alwaysOnTop, true);
  assert.strictEqual(s.clickThrough, true);
});

test('normalize respects clickThrough false', () => {
  const s = normalize({ clickThrough: false });
  assert.strictEqual(s.clickThrough, false);
});

test('publicView hides the api key and exposes clickThrough', () => {
  const view = publicView({ ...normalize({ apiKey: 'secret', clickThrough: false }) });
  assert.strictEqual(view.hasApiKey, true);
  assert.strictEqual(view.apiKey, undefined);
  assert.strictEqual(view.clickThrough, false);
});

test('persist then load round-trips', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-set-'));
  persist(dir, { name: 'Bean', roam: false, speech: 'quiet', clickThrough: false });
  const s = load(dir);
  assert.strictEqual(s.name, 'Bean');
  assert.strictEqual(s.speech, 'quiet');
  assert.strictEqual(s.roam, false);
  assert.strictEqual(s.clickThrough, false);
});

test('lastBounds defaults to null and survives a round-trip', () => {
  assert.strictEqual(normalize({}).lastBounds, null);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pet-set-'));
  persist(dir, { lastBounds: { x: 120, y: 640 } });
  assert.deepStrictEqual(load(dir).lastBounds, { x: 120, y: 640 });
});

test('lastBounds garbage normalizes to null and stays out of publicView', () => {
  assert.strictEqual(normalize({ lastBounds: 'nope' }).lastBounds, null);
  assert.strictEqual(normalize({ lastBounds: { x: 'a', y: 1 } }).lastBounds, null);
  const view = publicView(normalize({ lastBounds: { x: 10, y: 20 } }));
  assert.strictEqual(view.lastBounds, undefined);
});
