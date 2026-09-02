// Tiny .env reader so `XAI_API_KEY=...` in the project root works during electron:dev.
const fs = require('fs');
const path = require('path');

function loadDotEnv(cwd = process.cwd()) {
  try {
    const text = fs.readFileSync(path.join(cwd, '.env'), 'utf8');
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq < 1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (process.env[key] == null || process.env[key] === '') process.env[key] = value;
    }
  } catch {
    // no .env — that's fine
  }
}

module.exports = { loadDotEnv };
