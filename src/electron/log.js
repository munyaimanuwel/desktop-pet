// Boring append-only log for a desktop toy: userData/pet.log, one rotation.
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;

function format(value) {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || value.message;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function createLogger(dataDir) {
  const file = path.join(dataDir, 'pet.log');
  const rotated = `${file}.1`;

  function write(level, args) {
    try {
      if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) {
        fs.rmSync(rotated, { force: true });
        fs.renameSync(file, rotated);
      }
      fs.mkdirSync(dataDir, { recursive: true });
      const line = `${new Date().toISOString()} ${level} ${args.map(format).join(' ')}\n`;
      fs.appendFileSync(file, line);
    } catch {
      // Logging must never take the app down.
    }
  }

  return {
    info(...args) {
      write('INFO', args);
    },
    warn(...args) {
      write('WARN', args);
      console.warn(...args);
    },
    error(...args) {
      write('ERROR', args);
      console.error(...args);
    },
  };
}

module.exports = { createLogger, MAX_BYTES };
