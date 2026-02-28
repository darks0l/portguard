const test = require('node:test');
const assert = require('node:assert/strict');

const { parseScanOutput } = require('../dist/cjs/scanner.js');

test('parse windows netstat tcp listening line', () => {
  const output = '  TCP    127.0.0.1:3000     0.0.0.0:0      LISTENING       1234';
  const rows = parseScanOutput(output, 'windows', 'netstat -ano -p tcp');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].port, 3000);
  assert.equal(rows[0].pid, 1234);
  assert.equal(rows[0].protocol, 'tcp');
});

test('parse windows netstat ignores non-listening tcp states', () => {
  const output = '  TCP    127.0.0.1:3000     127.0.0.1:52311      ESTABLISHED       1234';
  const rows = parseScanOutput(output, 'windows', 'netstat -ano -p tcp');
  assert.equal(rows.length, 0);
});

test('parse linux ss output', () => {
  const output = 'tcp LISTEN 0 511 127.0.0.1:5173 0.0.0.0:* users:(("node",pid=4521,fd=23))';
  const rows = parseScanOutput(output, 'linux', 'ss -lntup');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].port, 5173);
  assert.equal(rows[0].pid, 4521);
  assert.equal(rows[0].processName, 'node');
});

test('parse mac lsof output', () => {
  const output = 'node 888 user 22u IPv4 0x123 0t0 TCP *:3000 (LISTEN)';
  const rows = parseScanOutput(output, 'macos', 'lsof -nP -iTCP -sTCP:LISTEN');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].port, 3000);
  assert.equal(rows[0].pid, 888);
});

test('parse linux netstat fallback output', () => {
  const output = 'tcp 0 0 127.0.0.1:8080 0.0.0.0:* LISTEN 9012/python';
  const rows = parseScanOutput(output, 'linux', 'netstat -lntup');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].port, 8080);
  assert.equal(rows[0].processName, 'python');
});