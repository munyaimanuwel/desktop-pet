const fs = require('fs');
const path = require('path');
const { createInitialState, clone } = require('./state');
const { applyEvent } = require('./events');

function fileFor(dataDir) {
  return path.join(dataDir, 'pet.json');
}

function readRaw(dataDir) {
  try {
    return JSON.parse(fs.readFileSync(fileFor(dataDir), 'utf8'));
  } catch {
    return null;
  }
}

// Load persisted state, or fall back to a fresh instance.
function load(dataDir) {
  const raw = readRaw(dataDir);
  if (raw && typeof raw === 'object') return clone(raw);
  return createInitialState();
}

function persist(dataDir, state) {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(fileFor(dataDir), JSON.stringify(state, null, 2));
}

module.exports = { fileFor, load, persist, applyEvent };
