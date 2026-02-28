# portguard

Dev-friendly CLI and API to monitor localhost ports, detect conflicts, and clear zombie processes.

## Install

- `npx portguard`
- `npm i -g portguard`

## CLI Commands

- `npx portguard` - dashboard view of all listening ports
- `npx portguard scan` - alias for dashboard view
- `npx portguard kill <port>` - kill process on a specific port with confirmation
- `npx portguard kill <port> --force` - kill without confirmation
- `npx portguard free <port>` - check if a port is free, or show what is using it
- `npx portguard watch` - live monitor mode, refreshes every 2s and shows changes
- `npx portguard find <name>` - find ports by process name (`node`, `python`, etc.)
- `npx portguard range <start>-<end>` - scan specific port range
- `npx portguard --json` - JSON output mode for scripting

## Examples

```bash
npx portguard
npx portguard kill 3000
npx portguard kill 3000 --force
npx portguard free 5432
npx portguard watch
npx portguard find node
npx portguard range 3000-3999
npx portguard scan --json
```

## Programmatic API

```ts
import { scan, isPortFree, killPort, findByName } from 'portguard';

const ports = await scan();
const free = await isPortFree(3000);
await killPort(3000);
const matches = await findByName('node');
```

### Types

```ts
interface PortInfo {
  port: number;
  pid: number;
  processName: string;
  protocol: 'tcp' | 'udp';
  state: string;
  uptime: string;
  localAddress: string;
}
```

## Cross-Platform Support

- Windows: `netstat` + PowerShell process metadata
- Linux: `ss` (fallback to `netstat`) + `ps`
- macOS: `lsof` + `ps`

## Output Preview

```text
PORT   PID     PROCESS               PROTO   STATE         UPTIME
3000   12544   node                  TCP     LISTEN        2h 11m
5432   1880    postgres              TCP     LISTEN        1d 4h
6379   4120    redis-server          TCP     LISTEN        6h 5m
```

```text
[11:22:08 AM] 4 listening ports | +1 new | -1 dropped

PORT   PID     PROCESS               PROTO   STATE         UPTIME
5173   9024    node                  TCP     LISTEN        14m
```

## Contributing

1. Fork the repo.
2. Create a feature branch.
3. Run `npm test` before opening a PR.
4. Keep runtime dependencies at zero.

## License

MIT