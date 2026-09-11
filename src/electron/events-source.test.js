const { test } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const os = require('os');
const path = require('path');
const { start, isPushTransition } = require('./events-source');

const silent = { info() {}, warn() {}, error() {} };
const NO_REPO = path.join(os.tmpdir(), 'pet-no-repo');

function request(port, { method = 'POST', url = '/event', body } = {}) {
  return new Promise((resolve, reject) => {
    const data = body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const req = http.request(
      {
        host: '127.0.0.1',
        port,
        path: url,
        method,
        headers: data
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
          : {},
      },
      (res) => {
        let out = '';
        res.on('data', (c) => (out += c));
        res.on('end', () => resolve({ status: res.statusCode, body: out }));
      }
    );
    req.on('error', (err) => resolve({ status: 0, error: err.code }));
    if (data) req.write(data);
    req.end();
  });
}

async function withServer(fn) {
  const events = [];
  const source = start({ onEvent: (t) => events.push(t), repoDir: NO_REPO, log: silent, port: 0 });
  const port = await source.ready;
  try {
    await fn(port, events);
  } finally {
    source.stop();
  }
}

test('valid event returns 204 and reaches onEvent', async () => {
  await withServer(async (port, events) => {
    const res = await request(port, { body: { type: 'COMMIT' } });
    assert.strictEqual(res.status, 204);
    assert.deepStrictEqual(events, ['COMMIT']);
  });
});

test('extra source and cwd are accepted', async () => {
  await withServer(async (port, events) => {
    const res = await request(port, { body: { type: 'BUILD_FAILURE', source: 'vscode', cwd: 'D:\\work\\app' } });
    assert.strictEqual(res.status, 204);
    assert.deepStrictEqual(events, ['BUILD_FAILURE']);
  });
});

test('unknown type is 204 but never reaches onEvent', async () => {
  await withServer(async (port, events) => {
    const res = await request(port, { body: { type: 'npm-build' } });
    assert.strictEqual(res.status, 204);
    assert.deepStrictEqual(events, []);
  });
});

test('bad JSON is 400', async () => {
  await withServer(async (port) => {
    const res = await request(port, { body: '{not json' });
    assert.strictEqual(res.status, 400);
  });
});

test('oversized body is rejected without parsing', async () => {
  await withServer(async (port, events) => {
    const res = await request(port, { body: JSON.stringify({ type: 'COMMIT', pad: 'x'.repeat(6000) }) });
    assert.strictEqual(res.status, 413);
    assert.deepStrictEqual(events, []);
  });
});

test('GET /health returns ok and no pet details', async () => {
  await withServer(async (port) => {
    const res = await request(port, { method: 'GET', url: '/health' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(JSON.parse(res.body), { ok: true });
  });
});

test('unknown route is 404', async () => {
  await withServer(async (port) => {
    const res = await request(port, { method: 'GET', url: '/nope' });
    assert.strictEqual(res.status, 404);
  });
});

test('push fires only on an ahead>0 to (0,0) transition', () => {
  assert.strictEqual(isPushTransition(null, 0, 0), false);
  assert.strictEqual(isPushTransition({ ahead: 2, behind: 0 }, 2, 0), false);
  assert.strictEqual(isPushTransition({ ahead: 0, behind: 3 }, 0, 0), false); // pull fast-forward
  assert.strictEqual(isPushTransition({ ahead: 0, behind: 3 }, 1, 0), false);
  assert.strictEqual(isPushTransition({ ahead: 2, behind: 0 }, 0, 0), true);
});
