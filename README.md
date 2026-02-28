# Portguard

<p align="center">
  <img src="./assets/darksol-logo.png" alt="DARKSOL logo" width="120" />
</p>

**Find, inspect, and clear local port conflicts fast — from terminal or code.**

[![npm version](https://img.shields.io/npm/v/@darksol/portguard.svg)](https://www.npmjs.com/package/@darksol/portguard)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![node >= 18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](https://nodejs.org/)

## Why this exists

Port collisions waste dev time: your app won’t boot, logs are noisy, and finding the offending process differs by OS. Portguard gives one consistent interface for checking what is listening, killing stale processes, and scripting that flow in CI/dev tooling.

## What it does

- Scan active localhost listeners (TCP/UDP) with process metadata
- Check if a specific port is free (`free <port>`)
- Kill the process bound to a port (`kill <port>`) with optional `--force`
- Monitor changes in real time (`watch`)
- Filter by process name (`find <name>`) or range (`range <start>-<end>`)
- Emit machine-readable JSON (`--json`) for scripts
- Use the same core from a programmatic API

## Quickstart

```bash
# one-shot
npx @darksol/portguard

# optional global install
npm i -g @darksol/portguard
portguard
```

## Real examples

```bash
# scan all active listeners
npx @darksol/portguard

# free a blocked dev port
npx @darksol/portguard kill 3000

# non-interactive kill
npx @darksol/portguard kill 3000 --force

# verify database port usage
npx @darksol/portguard free 5432

# live monitor
npx @darksol/portguard watch

# query by process name
npx @darksol/portguard find node

# inspect a bounded range
npx @darksol/portguard range 3000-3999

# script-friendly output
npx @darksol/portguard scan --json
```

Programmatic usage:

```ts
import { scan, isPortFree, killPort, findByName } from '@darksol/portguard';

const listeners = await scan();
const free = await isPortFree(3000);
const killed = await killPort(3000);
const nodePorts = await findByName('node');
```

## Config and options

| Command | Arguments | Flags | Description |
|---|---|---|---|
| `scan` (default) | none | `--json` | List active listeners |
| `free` | `<port>` | `--json` | Check if a port is available |
| `kill` | `<port>` | `--force` | Kill process on target port |
| `watch` | none | `--json` | Refresh every 2s with change summary |
| `find` | `<name>` | `--json` | Filter listeners by process name |
| `range` | `<start>-<end>` | `--json` | Scan only a numeric port range |

## Architecture / flow

- `scanner` collects socket/process data per OS:
  - Windows: `netstat` + PowerShell metadata
  - Linux: `ss` (fallback: `netstat`) + `ps`
  - macOS: `lsof` + `ps`
- `display` formats table and JSON output
- `killer` resolves PID and terminates process by port
- `cli` handles argument parsing, command routing, and watch mode

## Performance notes

Portguard shells out to native system tools, so speed depends on host load and socket count. Typical local scans complete quickly enough for interactive use; watch mode refreshes every 2 seconds by design.

## Limitations + roadmap

### Current limitations

- Requires Node.js 18+
- Relies on OS networking tools being available in `PATH`
- `watch` is a polling loop (2s), not event-stream based

### Roadmap

- Add command aliases/help output for discoverability
- Add optional structured error codes for CI pipelines
- Add richer filter options (protocol/state)

## Security notes

- `kill` terminates local processes; use `--force` carefully
- No network calls or telemetry are performed by Portguard
- Prefer non-force kill in shared/dev environments to avoid accidental disruption

## Development

```bash
npm install
npm test
```

## License + links

MIT © darksol

- Issues: https://github.com/darks0l/portguard/issues
- Repository: https://github.com/darks0l/portguard
- npm: https://www.npmjs.com/package/@darksol/portguard
