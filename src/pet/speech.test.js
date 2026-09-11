const { test } = require('node:test');
const assert = require('node:assert');
const { shouldSpeak } = require('./speech');

test('off mode silences everything', () => {
  assert.strictEqual(shouldSpeak('off', 'COMMIT'), false);
  assert.strictEqual(shouldSpeak('off', 'LEVEL_UP'), false);
});

test('quiet mode keeps failures and greetings', () => {
  assert.strictEqual(shouldSpeak('quiet', 'COMMIT'), false);
  assert.strictEqual(shouldSpeak('quiet', 'BUILD_FAILURE'), true);
  assert.strictEqual(shouldSpeak('quiet', 'WELCOME'), true);
  assert.strictEqual(shouldSpeak('quiet', 'LONG_ABSENCE'), true);
  assert.strictEqual(shouldSpeak('quiet', 'END_OF_DAY'), true);
  assert.strictEqual(shouldSpeak('quiet', 'RED_STREAK'), true);
});

test('normal mode speaks ordinary reactions', () => {
  assert.strictEqual(shouldSpeak('normal', 'COMMIT'), true);
  assert.strictEqual(shouldSpeak('normal', 'PET'), true);
});
