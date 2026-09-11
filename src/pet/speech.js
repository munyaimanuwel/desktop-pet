// Speech frequency. The pet talks; it should not chatter.
// off    — animate only
// quiet  — failures, hunger, waking, level-up, greetings
// normal — the usual reactions

const QUIET_EVENTS = new Set([
  'BUILD_FAILURE',
  'TEST_FAILURE',
  'MULTIPLE_FAILURES',
  'LEVEL_UP',
  'HUNGRY',
  'WAKING_UP',
  'WELCOME',
  'DAILY_GREETING',
  'LONG_ABSENCE',
  'END_OF_DAY',
  'RED_STREAK',
]);

const MODES = new Set(['off', 'quiet', 'normal']);

function normalizeMode(mode) {
  return MODES.has(mode) ? mode : 'normal';
}

function shouldSpeak(mode, event) {
  const m = normalizeMode(mode);
  if (m === 'off') return false;
  if (m === 'quiet') return QUIET_EVENTS.has(event);
  return Boolean(event);
}

module.exports = { shouldSpeak, normalizeMode, QUIET_EVENTS };
