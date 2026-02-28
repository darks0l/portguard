#!/usr/bin/env node
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { killPort } from './killer.js';
import { toJson, toTable, watchFrame } from './display.js';
import { findByName, isPortFree, scan } from './scanner.js';
import type { PortInfo } from './types.js';

interface CliDeps {
  scan: typeof scan;
  isPortFree: typeof isPortFree;
  killPort: typeof killPort;
  findByName: typeof findByName;
  renderTable: (records: PortInfo[]) => string;
  renderJson: (records: PortInfo[]) => string;
  write: (text: string) => void;
  writeErr: (text: string) => void;
  clear: () => void;
  now: () => string;
  confirm: (prompt: string) => Promise<boolean>;
}

const defaultDeps: CliDeps = {
  scan,
  isPortFree,
  killPort,
  findByName,
  renderTable: toTable,
  renderJson: toJson,
  write: (text) => output.write(`${text}\n`),
  writeErr: (text) => process.stderr.write(`${text}\n`),
  clear: () => process.stdout.write('\u001Bc'),
  now: () => new Date().toISOString(),
  confirm: async (prompt: string): Promise<boolean> => {
    const rl = readline.createInterface({ input, output });
    const answer = await rl.question(prompt);
    rl.close();
    return answer.trim().toLowerCase() === 'y' || answer.trim().toLowerCase() === 'yes';
  },
};

export interface ParsedArgs {
  command: 'scan' | 'kill' | 'free' | 'watch' | 'find' | 'range';
  args: string[];
  json: boolean;
  force: boolean;
}

export function parseCliArgs(argv: string[]): ParsedArgs {
  const json = argv.includes('--json');
  const force = argv.includes('--force');
  const filtered = argv.filter((arg) => arg !== '--json' && arg !== '--force');

  const command = (filtered[0] as ParsedArgs['command'] | undefined) || 'scan';
  if (command === 'scan' || command === 'kill' || command === 'free' || command === 'watch' || command === 'find' || command === 'range') {
    return { command, args: filtered.slice(1), json, force };
  }

  return { command: 'scan', args: filtered, json, force };
}

function parsePort(inputPort: string): number {
  const value = Number(inputPort);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw new Error(`Invalid port: ${inputPort}`);
  }
  return value;
}

function parseRange(inputRange: string): { start: number; end: number } {
  const match = inputRange.match(/^(\d+)-(\d+)$/);
  if (!match) {
    throw new Error('Range must be in format <start>-<end>');
  }

  const start = parsePort(match[1]);
  const end = parsePort(match[2]);
  if (start > end) throw new Error('Range start must be <= end');
  return { start, end };
}

async function renderRecords(records: PortInfo[], json: boolean, deps: CliDeps): Promise<void> {
  deps.write(json ? deps.renderJson(records) : deps.renderTable(records));
}

async function runWatch(json: boolean, deps: CliDeps): Promise<void> {
  let previous: PortInfo[] = [];

  const render = async () => {
    const current = await deps.scan();
    deps.clear();

    if (json) {
      deps.write(deps.renderJson(current));
    } else {
      deps.write(watchFrame(current, previous));
    }

    previous = current;
  };

  await render();
  setInterval(() => {
    render().catch((err) => deps.writeErr(`Watch refresh failed: ${(err as Error).message}`));
  }, 2000);
}

export async function runCli(argv = process.argv.slice(2), injected?: Partial<CliDeps>): Promise<number> {
  const deps: CliDeps = { ...defaultDeps, ...injected };

  try {
    const parsed = parseCliArgs(argv);

    if (parsed.command === 'scan') {
      const records = await deps.scan();
      await renderRecords(records, parsed.json, deps);
      return 0;
    }

    if (parsed.command === 'kill') {
      if (!parsed.args[0]) throw new Error('Usage: portguard kill <port> [--force]');
      const port = parsePort(parsed.args[0]);

      if (!parsed.force) {
        const ok = await deps.confirm(`Kill process on port ${port}? (y/N): `);
        if (!ok) {
          deps.write('Cancelled.');
          return 0;
        }
      }

      const killed = await deps.killPort(port, parsed.force);
      deps.write(killed ? `Port ${port} cleared.` : `No process found on port ${port}.`);
      return killed ? 0 : 1;
    }

    if (parsed.command === 'free') {
      if (!parsed.args[0]) throw new Error('Usage: portguard free <port>');
      const port = parsePort(parsed.args[0]);
      const free = await deps.isPortFree(port);

      if (free) {
        deps.write(`Port ${port} is free.`);
        return 0;
      }

      const records = (await deps.scan()).filter((entry) => entry.port === port);
      if (parsed.json) {
        deps.write(deps.renderJson(records));
      } else {
        deps.write(`Port ${port} is in use:`);
        deps.write(deps.renderTable(records));
      }
      return 1;
    }

    if (parsed.command === 'watch') {
      await runWatch(parsed.json, deps);
      return 0;
    }

    if (parsed.command === 'find') {
      if (!parsed.args[0]) throw new Error('Usage: portguard find <name>');
      const matches = await deps.findByName(parsed.args[0]);
      await renderRecords(matches, parsed.json, deps);
      return 0;
    }

    if (!parsed.args[0]) throw new Error('Usage: portguard range <start>-<end>');
    const range = parseRange(parsed.args[0]);
    const records = await deps.scan({ range });
    await renderRecords(records, parsed.json, deps);
    return 0;
  } catch (error) {
    deps.writeErr((error as Error).message);
    return 1;
  }
}

const isDirectRun =
  typeof require !== 'undefined' &&
  typeof module !== 'undefined' &&
  require.main === module;

if (isDirectRun) {
  runCli().then((code) => {
    process.exitCode = code;
  });
}
