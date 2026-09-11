#!/usr/bin/env node
// Optional convenience: installs git hooks that feed the pet events.
// Commits are already detected by polling; this makes them instant.
const { installHooks } = require('../src/electron/hooks');

const result = installHooks(process.cwd());
if (!result.ok) {
  console.error('[pet] no .git/hooks directory found — are you in a git repo?');
  process.exit(1);
}
for (const name of result.written) console.log(`[pet] wrote ${name} hook.`);
for (const name of result.skipped) console.log(`[pet] ${name} already exists — leaving it alone.`);
