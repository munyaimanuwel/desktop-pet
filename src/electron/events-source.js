// Event feeds for the pet: git polling + a tiny localhost event server.
// The pet CLI (scripts/pet.js), git hooks, and the editor extension POST here.
const { execFile } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 41823;
const GIT_POLL_MS = 20 * 1000;
const MAX_BODY = 4 * 1024;

// Events accepted from local clients. Anything else is acknowledged but ignored.
const ALLOWED = new Set([
  'COMMIT',
  'PUSH',
  'BUILD_SUCCESS',
  'BUILD_FAILURE',
  'TEST_SUCCESS',
  'TEST_FAILURE',
]);

// A push is "local had unpushed commits, now we match upstream". A pull that
// only fast-forwards behind→0 is not a push.
function isPushTransition(prev, ahead, behind) {
  return Boolean(prev && prev.ahead > 0 && ahead === 0 && behind === 0);
}

function start({ onEvent, repoDir = process.cwd(), log = console, port = PORT } = {}) {
  let headHash = null;
  let upstream = null;
  let cwd = repoDir || process.cwd();

  const pollHead = () => {
    execFile('git', ['rev-parse', 'HEAD'], { cwd }, (err, stdout) => {
      if (err) return; // not a git repo (yet) — keep polling
      const hash = stdout.trim();
      if (headHash && hash && hash !== headHash) onEvent('COMMIT');
      headHash = hash;
    });
  };

  const pollUpstream = () => {
    execFile('git', ['rev-list', '--count', '@{u}..HEAD'], { cwd }, (err, stdout) => {
      if (err) {
        upstream = null; // no upstream / not a repo
        return;
      }
      const ahead = parseInt(String(stdout).trim(), 10);
      if (!Number.isFinite(ahead)) {
        upstream = null;
        return;
      }
      execFile('git', ['rev-list', '--count', 'HEAD..@{u}'], { cwd }, (err2, stdout2) => {
        if (err2) {
          upstream = null;
          return;
        }
        const behind = parseInt(String(stdout2).trim(), 10);
        if (!Number.isFinite(behind)) {
          upstream = null;
          return;
        }
        const prev = upstream;
        upstream = { ahead, behind };
        if (isPushTransition(prev, ahead, behind)) onEvent('PUSH');
      });
    });
  };

  const poll = () => {
    pollHead();
    pollUpstream();
  };
  poll();
  const pollTimer = setInterval(poll, GIT_POLL_MS);

  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
      return;
    }
    if (req.method !== 'POST' || req.url !== '/event') {
      res.writeHead(404).end();
      return;
    }

    let body = '';
    let aborted = false;
    req.on('error', () => {});
    req.on('data', (c) => {
      if (aborted) return;
      body += c;
      if (body.length > MAX_BODY) {
        aborted = true;
        res.writeHead(413).end();
        req.destroy();
      }
    });
    req.on('end', () => {
      if (aborted) return;
      try {
        const parsed = JSON.parse(body);
        const type = parsed && parsed.type;
        const source = parsed && typeof parsed.source === 'string' ? parsed.source : '';
        const dir = parsed && typeof parsed.cwd === 'string' ? parsed.cwd : '';
        if (ALLOWED.has(type)) {
          const where = dir ? ` (${path.basename(dir)})` : '';
          if (source) log.info(`[pet] event ${type} from ${source}${where}`);
          onEvent(type);
        }
        res.writeHead(204).end();
      } catch {
        res.writeHead(400).end();
      }
    });
  });

  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  const listen = () =>
    server.listen(port, '127.0.0.1', () => {
      const addr = server.address();
      const actual = addr && typeof addr === 'object' ? addr.port : port;
      log.info(`[pet] event server listening on http://127.0.0.1:${actual}`);
      resolveReady(actual);
    });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      log.warn(`[pet] port ${port} already in use — another pet instance may be running; events will be lost`);
    } else {
      log.error('[pet] event server error:', err);
    }
  });
  listen();

  return {
    ready,
    stop() {
      clearInterval(pollTimer);
      server.close();
    },
    setRepoDir(dir) {
      cwd = dir || process.cwd();
      headHash = null;
      upstream = null;
      poll();
    },
  };
}

module.exports = { start, PORT, ALLOWED, MAX_BODY, isPushTransition };
