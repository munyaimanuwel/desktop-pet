#!/usr/bin/env node
// Optional convenience: installs git hooks that feed the pet events.
// Commits are already detected by polling; this makes them instant.
const fs = require('fs');
const path = require('path');

const HOOKS = {
  'post-commit': '#!/bin/sh\nnode "$(git rev-parse --show-toplevel)/scripts/pet.js" commit &\n',
  'pre-push': '#!/bin/sh\nnode "$(git rev-parse --show-toplevel)/scripts/pet.js" push &\n',
};

const hooksDir = path.join(process.cwd(), '.git', 'hooks');
if (!fs.existsSync(hooksDir)) {
  console.error('[pet] no .git/hooks directory found — are you in a git repo?');
  process.exit(1);
}

for (const [name, body] of Object.entries(HOOKS)) {
  const file = path.join(hooksDir, name);
  if (fs.existsSync(file)) {
    console.log(`[pet] ${name} already exists — leaving it alone.`);
    continue;
  }
  fs.writeFileSync(file, body, { mode: 0o755 });
  console.log(`[pet] wrote ${name} hook.`);
}
