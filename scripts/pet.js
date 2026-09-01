#!/usr/bin/env node
// Tiny CLI for feeding events to the pet's localhost server.
// Usage: node scripts/pet.js commit|push|build-success|build-failure|test-success|test-failure
const http = require('http');

const PORT = 41823;
const MAP = {
  commit: 'COMMIT',
  push: 'PUSH',
  'build-success': 'BUILD_SUCCESS',
  'build-failure': 'BUILD_FAILURE',
  'test-success': 'TEST_SUCCESS',
  'test-failure': 'TEST_FAILURE',
};

const input = process.argv[2];
const type = MAP[input];
if (!type) {
  console.error(`Unknown event "${input}". Use one of: ${Object.keys(MAP).join(', ')}`);
  process.exit(1);
}

const body = JSON.stringify({ type });
const req = http.request(
  {
    host: '127.0.0.1',
    port: PORT,
    path: '/event',
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
  },
  (res) => {
    res.resume();
    if (res.statusCode === 204) process.exit(0);
    process.exit(2);
  }
);
req.on('error', () => {
  console.error(`[pet] no pet running on port ${PORT} — start the app first.`);
  process.exit(3);
});
req.end(body);
