const { test } = require('node:test');
const assert = require('node:assert');
const { sanitize, extractText, isSpecial, generateLine } = require('./ai');

test('sanitize trims quotes and rejects empty lines', () => {
  assert.strictEqual(sanitize('  "Hello there."  '), 'Hello there.');
  assert.strictEqual(sanitize(''), null);
  assert.strictEqual(sanitize('x'.repeat(100)), null);
});

test('extractText reads Responses API output_text', () => {
  assert.strictEqual(extractText({ output_text: 'Hi.' }), 'Hi.');
  assert.strictEqual(
    extractText({ output: [{ content: [{ text: 'Ship it.' }] }] }),
    'Ship it.'
  );
});

test('only special events may call the model', () => {
  assert.strictEqual(isSpecial('COMMIT'), false);
  assert.strictEqual(isSpecial('LEVEL_UP'), true);
});

test('generateLine no-ops without a key', async () => {
  const line = await generateLine({ event: 'LEVEL_UP', state: {}, apiKey: '' });
  assert.strictEqual(line, null);
});

test('generateLine returns sanitized model text', async () => {
  const fetchImpl = async () => ({
    ok: true,
    json: async () => ({ output_text: '  "Level up. I glitter now."  ' }),
  });
  const line = await generateLine({
    event: 'LEVEL_UP',
    state: { name: 'Pip', level: 2, mood: 'joyful', dayStats: { commits: 1 } },
    apiKey: 'test',
    fetchImpl,
  });
  assert.strictEqual(line, 'Level up. I glitter now.');
});
