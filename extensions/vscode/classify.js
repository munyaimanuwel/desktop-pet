// Task classification for the Desktop Pet extension.
// Kept free of `require('vscode')` so it is unit-testable without an editor host.
//
// Default is IGNORE. Only genuine build/test tasks become events, so lint,
// `npm: dev`, install, and watch scripts cannot drive MULTIPLE_FAILURES.

function groupId(task) {
  const g = task && task.group;
  if (!g) return '';
  if (typeof g === 'string') return g;
  // Runtime TaskGroup exposes `id` ('build' | 'test' | ...). `kind` exists on
  // the tasks.json schema object, so keep it only as a fallback.
  return g.id || g.kind || '';
}

// `extra` is an optional user regex (settings.desktopPet.taskPattern) or null.
function eventFor(task, exitCode, extra = null) {
  if (!task) return null;
  const kind = groupId(task);
  const script = task.definition && task.definition.script ? task.definition.script : '';
  const label = `${task.name || ''} ${script} ${task.source || ''}`.toLowerCase();
  const failed = exitCode !== 0;

  const isTest =
    kind === 'test' ||
    /\b(test|jest|mocha|vitest|pytest|phpunit|rspec)\b/.test(label) ||
    Boolean(extra && extra.test(label) && /\btest\b/.test(label));
  const isBuild = kind === 'build' || Boolean(extra && extra.test(label) && !isTest);

  if (isTest) return failed ? 'TEST_FAILURE' : 'TEST_SUCCESS';
  if (isBuild) return failed ? 'BUILD_FAILURE' : 'BUILD_SUCCESS';
  return null;
}

module.exports = { groupId, eventFor };
