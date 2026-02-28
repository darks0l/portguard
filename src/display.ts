import type { PortInfo } from './types.js';

const color = {
  reset: '\u001b[0m',
  dim: '\u001b[2m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  cyan: '\u001b[36m',
  red: '\u001b[31m',
};

function pad(input: string | number, size: number): string {
  const str = String(input);
  return str.length >= size ? str : str + ' '.repeat(size - str.length);
}

function formatState(state: string): string {
  const upper = state.toUpperCase();
  if (upper.includes('LISTEN')) return `${color.green}${upper}${color.reset}`;
  if (upper.includes('CLOSE')) return `${color.red}${upper}${color.reset}`;
  return `${color.yellow}${upper}${color.reset}`;
}

export function toTable(records: PortInfo[]): string {
  const headers = ['PORT', 'PID', 'PROCESS', 'PROTO', 'STATE', 'UPTIME'];
  const widths = [7, 8, 22, 8, 14, 10];
  const line = `${pad(headers[0], widths[0])}${pad(headers[1], widths[1])}${pad(headers[2], widths[2])}${pad(headers[3], widths[3])}${pad(headers[4], widths[4])}${pad(headers[5], widths[5])}`;

  if (records.length === 0) {
    return `${color.cyan}${line}${color.reset}\n${color.dim}No listening ports found.${color.reset}`;
  }

  const rows = records.map((r) => {
    return `${pad(r.port, widths[0])}${pad(r.pid, widths[1])}${pad(r.processName, widths[2])}${pad(r.protocol.toUpperCase(), widths[3])}${pad(formatState(r.state), widths[4] + 9)}${pad(r.uptime, widths[5])}`;
  });

  return `${color.cyan}${line}${color.reset}\n${rows.join('\n')}`;
}

export function toJson(records: PortInfo[]): string {
  return JSON.stringify(records, null, 2);
}

export function diffPorts(previous: PortInfo[], current: PortInfo[]): { added: PortInfo[]; removed: PortInfo[] } {
  const toKey = (r: PortInfo) => `${r.port}-${r.pid}-${r.protocol}`;
  const prevMap = new Map(previous.map((p) => [toKey(p), p]));
  const currMap = new Map(current.map((p) => [toKey(p), p]));

  const added = current.filter((entry) => !prevMap.has(toKey(entry)));
  const removed = previous.filter((entry) => !currMap.has(toKey(entry)));

  return { added, removed };
}

export function watchFrame(records: PortInfo[], previous: PortInfo[]): string {
  const { added, removed } = diffPorts(previous, records);
  const timestamp = new Date().toLocaleTimeString();
  const changes = [
    `${color.dim}[${timestamp}]${color.reset} ${records.length} listening ports`,
    added.length ? `${color.green}+${added.length} new${color.reset}` : '',
    removed.length ? `${color.red}-${removed.length} dropped${color.reset}` : '',
  ].filter(Boolean).join(' | ');

  return `${changes}\n\n${toTable(records)}`;
}