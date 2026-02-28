const test = require('node:test');
const assert = require('node:assert/strict');

const { parseCliArgs, runCli } = require('../dist/cjs/cli.js');

function makeDeps(overrides = {}) {
  const writes = [];
  const errs = [];

  return {
    writes,
    errs,
    deps: {
      scan: async () => [],
      isPortFree: async () => true,
      killPort: async () => true,
      findByName: async () => [],
      renderTable: (r) => `table:${r.length}`,
      renderJson: (r) => JSON.stringify(r),
      write: (t) => writes.push(t),
      writeErr: (t) => errs.push(t),
      clear: () => {},
      now: () => 'now',
      confirm: async () => true,
      ...overrides,
    },
  };
}

test('parseCliArgs defaults to scan', () => {
  const parsed = parseCliArgs([]);
  assert.equal(parsed.command, 'scan');
  assert.equal(parsed.json, false);
});

test('parseCliArgs handles flags', () => {
  const parsed = parseCliArgs(['kill', '3000', '--force', '--json']);
  assert.equal(parsed.command, 'kill');
  assert.equal(parsed.force, true);
  assert.equal(parsed.json, true);
});

test('runCli free command reports free port', async () => {
  const { deps, writes } = makeDeps({ isPortFree: async () => true });
  const code = await runCli(['free', '3000'], deps);
  assert.equal(code, 0);
  assert.match(writes[0], /Port 3000 is free/);
});

test('runCli kill command respects cancellation', async () => {
  const { deps, writes } = makeDeps({ confirm: async () => false });
  const code = await runCli(['kill', '3000'], deps);
  assert.equal(code, 0);
  assert.match(writes[0], /Cancelled/);
});

test('runCli range command validates format', async () => {
  const { deps, errs } = makeDeps();
  const code = await runCli(['range', '3000:4000'], deps);
  assert.equal(code, 1);
  assert.match(errs[0], /Range must be in format/);
});

test('runCli find command writes result table', async () => {
  const { deps, writes } = makeDeps({
    findByName: async () => [{
      port: 3000,
      pid: 10,
      processName: 'node',
      protocol: 'tcp',
      state: 'LISTEN',
      uptime: '1m',
      localAddress: '127.0.0.1:3000',
    }],
  });
  const code = await runCli(['find', 'node'], deps);
  assert.equal(code, 0);
  assert.equal(writes[0], 'table:1');
});