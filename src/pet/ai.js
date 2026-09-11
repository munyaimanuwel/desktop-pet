// Optional one-liner from SpaceXAI (xAI). Deterministic lines always exist;
// this only replaces them when a key is present and the request is fast.
const { journalLine } = require('./memory');

const SPECIAL = new Set([
  'MULTIPLE_FAILURES',
  'LEVEL_UP',
  'DAILY_GREETING',
  'WAKING_UP',
  'LONG_ABSENCE',
  'END_OF_DAY',
]);

const SYSTEM = [
  'You are Pip, a tiny purple creature who lives on a developer\'s desktop.',
  'Reply with ONE spoken line, max 12 words.',
  'Dry, warm, a little smug. No quotes, no name prefix, no hashtags.',
].join(' ');

function isSpecial(event) {
  return SPECIAL.has(event);
}

function sanitize(text) {
  if (typeof text !== 'string') return null;
  const line = text.replace(/\s+/g, ' ').replace(/^["'\s]+|["'\s]+$/g, '').trim();
  if (!line || line.length > 90) return null;
  if (line.split(/\s+/).length > 14) return null;
  return line.slice(0, 80);
}

function extractText(data) {
  if (!data || typeof data !== 'object') return null;
  if (typeof data.output_text === 'string') return data.output_text;
  if (Array.isArray(data.output)) {
    const chunks = [];
    for (const item of data.output) {
      const parts = item && item.content;
      if (!Array.isArray(parts)) continue;
      for (const part of parts) {
        if (part && typeof part.text === 'string') chunks.push(part.text);
      }
    }
    if (chunks.length) return chunks.join(' ');
  }
  const choice = data.choices && data.choices[0];
  if (choice && choice.message && typeof choice.message.content === 'string') {
    return choice.message.content;
  }
  return null;
}

function contextPrompt(event, state) {
  const stats = state.dayStats || {};
  const parts = [
    `Event: ${event}.`,
    `Name: ${state.name || 'Pip'}. Level ${state.level || 1}. Mood: ${state.mood || 'content'}.`,
    `Today: ${stats.commits || 0} commits, ${stats.pushes || 0} pushes, ${stats.failures || 0} failures.`,
  ];
  // One recent journal fact so the model can allude to it instead of narrating.
  const journal = (state.journal || []).filter((f) => f && !f.spokenAt && f.kind !== 'red-streak');
  const latest = journal.length ? journalLine(journal[journal.length - 1], state) : null;
  if (latest) parts.push(`Latest: ${latest}`);
  return parts.join(' ');
}

async function generateLine({ event, state, apiKey, fetchImpl = fetch } = {}) {
  if (!apiKey || !isSpecial(event)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 3500);
  try {
    const res = await fetchImpl('https://api.x.ai/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'grok-4.6',
        store: false,
        input: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: contextPrompt(event, state) },
        ],
      }),
      signal: ctrl.signal,
    });
    if (!res.ok) return null;
    const data = await res.json();
    return sanitize(extractText(data));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function resolveApiKey(settings = {}) {
  return process.env.XAI_API_KEY || settings.apiKey || '';
}

module.exports = { SPECIAL, isSpecial, sanitize, extractText, generateLine, resolveApiKey, contextPrompt };
