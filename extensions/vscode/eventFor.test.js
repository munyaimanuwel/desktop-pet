const { test } = require('node:test');
const assert = require('node:assert');
const { eventFor, groupId } = require('./classify');

test('build group id wins over the task name', () => {
  assert.strictEqual(eventFor({ group: { id: 'build' }, name: 'npm: compile' }, 0), 'BUILD_SUCCESS');
  assert.strictEqual(eventFor({ group: { id: 'build' }, name: 'npm: compile' }, 2), 'BUILD_FAILURE');
});

test('test group id beats a build-looking name', () => {
  assert.strictEqual(eventFor({ group: { id: 'test' }, name: 'npm: compile' }, 1), 'TEST_FAILURE');
});

test('tasks.json-shaped group.kind is a fallback', () => {
  assert.strictEqual(eventFor({ group: { kind: 'build' }, name: 'webpack' }, 0), 'BUILD_SUCCESS');
  assert.strictEqual(groupId({ group: 'build' }), 'build');
});

test('lint is ignored', () => {
  assert.strictEqual(eventFor({ name: 'npm: lint' }, 1), null);
  assert.strictEqual(eventFor({ name: 'npm: dev' }, 0), null);
  assert.strictEqual(eventFor({ name: 'npm: install' }, 0), null);
});

test('test-runner names are a fallback when the group is empty', () => {
  assert.strictEqual(eventFor({ name: 'npm: vitest run' }, 0), 'TEST_SUCCESS');
  assert.strictEqual(eventFor({ name: 'pytest -q' }, 1), 'TEST_FAILURE');
});

test('empty or invalid pattern (null) does not turn lint into a build', () => {
  assert.strictEqual(eventFor({ name: 'npm: lint' }, 1, null), null);
});

test('a valid taskPattern can promote an ungrouped task', () => {
  assert.strictEqual(eventFor({ name: 'my compile step' }, 0, /compile/), 'BUILD_SUCCESS');
  assert.strictEqual(eventFor({ name: 'my compile step' }, 1, /compile/), 'BUILD_FAILURE');
});
