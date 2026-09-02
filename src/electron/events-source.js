// Event feeds for the pet: git polling + a tiny localhost event server.
// The pet CLI (scripts/pet.js) and git hooks POST build/test/push events here.
const { execFile } = require('child_process');
const http = require('http');

const PORT = 41823;
const GIT_POLL_MS = 20 * 1000;

// Events accepted from the local CLI. Anything else is rejected.
const ALLOWED = new Set([
  'COMMIT',
  'PUSH',
  'BUILD_SUCCESS',
  'BUILD_FAILURE',
  'TEST_SUCCESS',
  'TEST_FAILURE',
]);

function start({ onEvent, repoDir = process.cwd(), log = console } = {}) {
  let headHash = null;
  let cwd = repoDir || process.cwd();

  const poll = () => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd }, (err, stdout) => {
      if (err) return; // not a git repo (yet) — keep polling
      const hash = stdout.trim();
      if (headHash && hash && hash !== headHash) onEvent('COMMIT');
      headHash = hash;
    });
  };
  poll();
  const pollTimer = setInterval(poll, GIT_POLL_MS);

  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404).end();
      return;
    }
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { type } = JSON.parse(body);
        if (ALLOWED.has(type)) onEvent(type);
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  });

  const listen = () =>
    server.listen(PORT, '127.0.0.1', () =>
      log.log(`[pet] event server listening on http://127.0.0.1:${PORT}`)
    );
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log.warn(`[pet] port ${PORT} already in use — another pet instance may be running; events will be lost`);
    } else {
      log.error('[pet] event server error:', err);
    }
  });
  listen();

  return {
    stop() {
      clearInterval(pollTimer);
      server.close();
    },
    setRepoDir(dir) {
      cwd = dir || process.cwd();
      headHash = null;
      poll();
    },
  };
}

module.exports = { start, PORT, ALLOWED };
