// Deterministic contextual lines per event. Picked sequentially (not randomly)
// so behaviour is stable and testable.
const LINES = {
  COMMIT: [
    'Nice commit — the repo feels alive.',
    'Green and clean. +XP!',
    'Another brick in the wall. In a good way.',
    'Committed and unbothered.',
  ],
  PUSH: [
    'You pushed! The world can see it now.',
    'Ship it! 🚀',
    'Pushed to the far side of the internet.',
  ],
  BUILD_SUCCESS: [
    'Build passed. I could get used to this.',
    'Compiles and smiles.',
    'All green. Impressive.',
  ],
  BUILD_FAILURE: [
    'Build broke. I felt a tremor.',
    'Something failed. Not me, though.',
    'Red build. My mood matches.',
  ],
  TEST_SUCCESS: [
    'Tests passed. Doing a little dance.',
    'All assertions hold. Nice.',
    'Green tests. The universe is in order.',
  ],
  TEST_FAILURE: [
    'A test failed. My circuits ache.',
    'Red test. We can fix it.',
  ],
  MULTIPLE_FAILURES: [
    'That is the third failure. I am watching.',
    'Failing repeatedly is a lifestyle now.',
    'I am concerned. And slightly annoyed.',
  ],
  RETURN_FROM_IDLE: [
    'Oh, you are back!',
    'Welcome back. I missed the clicking.',
    'There you are. I was dozing.',
  ],
  FEED: [
    'Yum. Thank you.',
    'Snack acquired. Happiness rising.',
  ],
  PET: [
    'Hehe, that tickles.',
    'I like that.',
    'Again? Okay.',
  ],
  LEVEL_UP: [
    'Level up! I am evolving.',
    'Leveled up. The power courses through me.',
    'New level. New confidence.',
  ],
  HUNGRY: [
    'I could eat something.',
    'My stomach is rumbling.',
  ],
  FALLING_ASLEEP: [
    'zzz…',
    'Getting sleepy…',
  ],
  WAKING_UP: [
    'Rise and shine… who? Me.',
    'Just woke up. What did I miss?',
  ],
};

const counters = new Map();
function messageFor(event) {
  const lines = LINES[event];
  if (!lines || lines.length === 0) return null;
  const i = counters.get(event) || 0;
  counters.set(event, i + 1);
  return lines[i % lines.length];
}

module.exports = { messageFor, LINES };
