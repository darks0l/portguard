const test = require('node:test');
const assert = require('node:assert/strict');

const { toTable, toJson, diffPorts, watchFrame } = require('../dist/cjs/display.js');

const sample = {
  port: 3000,
  pid: 123,
  processName: 'node',
  protocol: 'tcp',
  state: 'LISTEN',
  uptime: '1h 2m',
  localAddress: '127.0.0.1:3000',
};

test('toTable renders header and rows', () => {
  const out = toTable([sample]);
  assert.match(out, /PORT/);
  assert.match(out, /node/);
  assert.match(out, /3000/);
});

test('toTable renders empty state', () => {
  const out = toTable([]);
  assert.match(out, /No listening ports found/);
});

test('toJson serializes records', () => {
  const out = toJson([sample]);
  const parsed = JSON.parse(out);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].processName, 'node');
});

test('diffPorts identifies added and removed', () => {
  const previous = [sample];
  const current = [{ ...sample, pid: 124, port: 4000 }];
  const diff = diffPorts(previous, current);
  assert.equal(diff.added.length, 1);
  assert.equal(diff.removed.length, 1);
});

test('watchFrame includes change summary and table', () => {
  const out = watchFrame([{ ...sample, port: 5000 }], [sample]);
  assert.match(out, /listening ports/);
  assert.match(out, /PORT/);
});