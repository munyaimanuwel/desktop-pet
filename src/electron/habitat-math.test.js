const { test } = require('node:test');
const assert = require('node:assert');
const {
  floorY,
  clampX,
  otherDisplays,
  pickHopTarget,
  hopLanding,
  hopEdgeX,
} = require('./habitat-math');

const area = (x, y, width, height) => ({ x, y, width, height });

test('floorY sits at the bottom of the work area', () => {
  assert.strictEqual(floorY(area(0, 0, 1920, 1040), 400), 640);
  assert.strictEqual(floorY(area(0, 24, 1920, 1040), 400), 664);
});

test('clampX keeps the window inside the work area', () => {
  assert.strictEqual(clampX(area(0, 0, 1920, 1040), -50, 340), 0);
  assert.strictEqual(clampX(area(0, 0, 1920, 1040), 5000, 340), 1580);
  assert.strictEqual(clampX(area(100, 0, 1920, 1040), 500, 340), 500);
  assert.strictEqual(clampX(area(0, 0, 200, 400), 90, 340), 0);
});

test('otherDisplays filters the current display and tiny ones', () => {
  const displays = [
    { id: 1, workArea: area(0, 0, 1920, 1040) },
    { id: 2, workArea: area(1920, 0, 1920, 1040) },
    { id: 3, workArea: area(0, 1040, 120, 400) },
  ];
  const others = otherDisplays(displays, 1);
  assert.deepStrictEqual(others.map((d) => d.id), [2]);
});

test('pickHopTarget prefers a horizontally adjacent display', () => {
  const current = { id: 1, workArea: area(0, 0, 1920, 1040) };
  const adjacent = { id: 2, workArea: area(1920, 0, 1920, 1040) };
  const stacked = { id: 3, workArea: area(0, 1040, 1920, 1040) };
  assert.strictEqual(pickHopTarget(current, [stacked, adjacent], () => 0), adjacent);
  assert.strictEqual(pickHopTarget(current, [stacked], () => 0), stacked);
  assert.strictEqual(pickHopTarget(current, []), null);
});

test('hopLanding arrives from the correct edge', () => {
  const from = area(0, 0, 1920, 1040);
  const right = hopLanding(area(1920, 0, 1920, 1040), from, 340, () => 0);
  assert.deepStrictEqual(right, { x: 1944, facing: 1 });
  const left = hopLanding(area(-1920, 0, 1920, 1040), from, 340, () => 0);
  assert.deepStrictEqual(left, { x: -364, facing: -1 });
  const stacked = hopLanding(area(0, 1040, 1920, 1040), from, 340, () => 0);
  assert.strictEqual(stacked.x, 0);
  assert.strictEqual(stacked.facing, -1);
});

test('hopEdgeX walks toward the destination side', () => {
  const current = area(0, 0, 1920, 1040);
  assert.strictEqual(hopEdgeX(current, area(1920, 0, 1920, 1040), 340), 1568);
  assert.strictEqual(hopEdgeX(current, area(-1920, 0, 1920, 1040), 340), 12);
});
