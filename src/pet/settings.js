const fs = require('fs');
const path = require('path');
const { normalizeMode } = require('./speech');

function fileFor(dataDir) {
  return path.join(dataDir, 'settings.json');
}

function defaults() {
  return {
    name: 'Pip',
    roam: true,
    speech: 'normal',
    alwaysOnTop: true,
    clickThrough: true,
    launchAtLogin: false,
    apiKey: '',
    repoDir: '',
  };
}

function normalize(raw) {
  const base = defaults();
  if (!raw || typeof raw !== 'object') return base;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 24) : base.name;
  return {
    name,
    roam: raw.roam !== false,
    speech: normalizeMode(raw.speech),
    alwaysOnTop: raw.alwaysOnTop !== false,
    clickThrough: raw.clickThrough !== false,
    launchAtLogin: Boolean(raw.launchAtLogin),
    apiKey: typeof raw.apiKey === 'string' ? raw.apiKey.trim() : '',
    repoDir: typeof raw.repoDir === 'string' ? raw.repoDir.trim() : '',
  };
}

function load(dataDir) {
  try {
    return normalize(JSON.parse(fs.readFileSync(fileFor(dataDir), 'utf8')));
  } catch {
    return defaults();
  }
}

function persist(dataDir, settings) {
  const next = normalize(settings);
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(fileFor(dataDir), JSON.stringify(next, null, 2));
  return next;
}

// What the renderer is allowed to see — never ship the raw key.
function publicView(settings) {
  return {
    name: settings.name,
    roam: settings.roam,
    speech: settings.speech,
    alwaysOnTop: settings.alwaysOnTop,
    clickThrough: settings.clickThrough !== false,
    launchAtLogin: settings.launchAtLogin,
    repoDir: settings.repoDir,
    hasApiKey: Boolean(settings.apiKey || process.env.XAI_API_KEY),
  };
}

module.exports = { fileFor, defaults, normalize, load, persist, publicView };
