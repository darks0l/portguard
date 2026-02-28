import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { detectPlatform, getProcessListCommand, getScanCommands, type Platform } from './platform.js';
import type { PortInfo, Protocol, ScanOptions } from './types.js';

const execAsync = promisify(exec);

export async function runCommand(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command, { windowsHide: true, maxBuffer: 1024 * 1024 * 8 });
    return stdout;
  } catch (error) {
    const failed = error as { stdout?: string };
    if (failed.stdout) {
      return failed.stdout;
    }
    return '';
  }
}

function parsePortFromAddress(address: string): number | null {
  const normalized = address.trim();
  const match = normalized.match(/:(\d+)$/);
  if (!match) return null;
  const port = Number(match[1]);
  return Number.isInteger(port) ? port : null;
}

function formatUptime(startTimeMs: number): string {
  if (!Number.isFinite(startTimeMs) || startTimeMs <= 0) return 'unknown';
  const elapsed = Math.max(0, Date.now() - startTimeMs);
  const seconds = Math.floor(elapsed / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function parseWindowsNetstat(output: string, protocol: Protocol): PortInfo[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: PortInfo[] = [];

  for (const line of lines) {
    if (!line.toLowerCase().startsWith(protocol)) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 4) continue;

    const localAddress = parts[1];
    const state = protocol === 'tcp' ? parts[3] ?? 'LISTEN' : 'LISTEN';
    const pidPart = protocol === 'tcp' ? parts[4] : parts[3];
    const pid = Number(pidPart);
    const port = parsePortFromAddress(localAddress);

    if (!port || !Number.isInteger(pid)) continue;
    if (protocol === 'tcp' && state.toUpperCase() !== 'LISTENING') continue;

    records.push({
      port,
      pid,
      processName: 'unknown',
      protocol,
      state: state.toUpperCase(),
      uptime: 'unknown',
      localAddress,
    });
  }

  return records;
}

function parseLinuxSs(output: string): PortInfo[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: PortInfo[] = [];

  for (const line of lines) {
    if (line.startsWith('Netid') || line.startsWith('State')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    const protocol = parts[0].toLowerCase().startsWith('udp') ? 'udp' : 'tcp';
    const state = protocol === 'udp' ? 'LISTEN' : (parts[1] || 'LISTEN').toUpperCase();
    const localAddress = parts[4];
    const port = parsePortFromAddress(localAddress);
    const pidMatch = line.match(/pid=(\d+)/);
    const processMatch = line.match(/\("([^\"]+)"/);
    const pid = pidMatch ? Number(pidMatch[1]) : 0;

    if (!port || !pid) continue;

    records.push({
      port,
      pid,
      processName: processMatch ? processMatch[1] : 'unknown',
      protocol,
      state,
      uptime: 'unknown',
      localAddress,
    });
  }

  return records;
}

function parseMacLsof(output: string): PortInfo[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: PortInfo[] = [];

  for (const line of lines) {
    if (line.startsWith('COMMAND')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const processName = parts[0] || 'unknown';
    const pid = Number(parts[1]);
    const protocol = (parts[7] || '').toLowerCase().includes('udp') ? 'udp' : 'tcp';
    const localAddress = parts[8] || '';
    const port = parsePortFromAddress(localAddress.replace('->', ''));
    if (!port || !pid) continue;

    const state = protocol === 'tcp' && line.includes('(LISTEN)') ? 'LISTEN' : 'LISTEN';

    records.push({
      port,
      pid,
      processName,
      protocol,
      state,
      uptime: 'unknown',
      localAddress,
    });
  }

  return records;
}

function parseNetstatFallback(output: string): PortInfo[] {
  const lines = output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const records: PortInfo[] = [];

  for (const line of lines) {
    if (!line.startsWith('tcp') && !line.startsWith('udp')) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 6) continue;

    const protocol = parts[0].startsWith('udp') ? 'udp' : 'tcp';
    const localAddress = parts[3];
    const state = protocol === 'udp' ? 'LISTEN' : (parts[5] || 'LISTEN').toUpperCase();
    const pidProgram = parts[6] || '';
    const pid = Number(pidProgram.split('/')[0]);
    const processName = pidProgram.split('/')[1] || 'unknown';
    const port = parsePortFromAddress(localAddress);

    if (!port || !pid) continue;
    if (protocol === 'tcp' && state !== 'LISTEN') continue;

    records.push({
      port,
      pid,
      processName,
      protocol,
      state,
      uptime: 'unknown',
      localAddress,
    });
  }

  return records;
}

export function parseScanOutput(output: string, platform: Platform, command: string): PortInfo[] {
  if (platform === 'windows') {
    const protocol: Protocol = command.toLowerCase().includes('udp') ? 'udp' : 'tcp';
    return parseWindowsNetstat(output, protocol);
  }

  if (platform === 'macos') {
    return parseMacLsof(output);
  }

  if (command.startsWith('ss ')) {
    return parseLinuxSs(output);
  }

  return parseNetstatFallback(output);
}

function parseWindowsProcessCsv(csv: string): Map<number, { processName: string; uptime: string }> {
  const lines = csv.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const map = new Map<number, { processName: string; uptime: string }>();

  for (const line of lines.slice(1)) {
    const cleaned = line.replace(/^"|"$/g, '');
    const cols = cleaned.split('","');
    if (cols.length < 3) continue;
    const pid = Number(cols[0]);
    const processName = cols[1] || 'unknown';
    const startMs = Date.parse(cols[2]);
    if (!pid) continue;
    map.set(pid, { processName, uptime: formatUptime(startMs) });
  }

  return map;
}

function parsePsOutput(output: string): Map<number, { processName: string; uptime: string }> {
  const lines = output.split(/\r?\n/).filter(Boolean);
  const map = new Map<number, { processName: string; uptime: string }>();

  for (const line of lines) {
    const match = line.trim().match(/^(\d+)\s+([^\s]+)\s+(.+)$/);
    if (!match) continue;
    const pid = Number(match[1]);
    const processName = match[2];
    const startMs = Date.parse(match[3]);
    if (!pid) continue;
    map.set(pid, { processName, uptime: formatUptime(startMs) });
  }

  return map;
}

export async function enrichWithProcessInfo(records: PortInfo[], platform: Platform): Promise<PortInfo[]> {
  if (records.length === 0) return [];

  const processMap = await runCommand(getProcessListCommand(platform)).then((out) => {
    if (platform === 'windows') return parseWindowsProcessCsv(out);
    return parsePsOutput(out);
  });

  return records.map((record) => {
    const proc = processMap.get(record.pid);
    if (!proc) return record;
    return {
      ...record,
      processName: proc.processName || record.processName,
      uptime: proc.uptime || record.uptime,
    };
  });
}

function dedupe(records: PortInfo[]): PortInfo[] {
  const seen = new Set<string>();
  const result: PortInfo[] = [];

  for (const record of records) {
    const key = `${record.port}-${record.pid}-${record.protocol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(record);
  }

  return result;
}

function applyRange(records: PortInfo[], options?: ScanOptions): PortInfo[] {
  if (!options?.range) return records;
  return records.filter((record) => record.port >= options.range!.start && record.port <= options.range!.end);
}

export async function scan(options?: ScanOptions): Promise<PortInfo[]> {
  const platform = detectPlatform();
  const commands = getScanCommands(platform);
  const allRecords: PortInfo[] = [];

  for (const command of commands) {
    const output = await runCommand(command);
    if (!output.trim()) continue;
    const parsed = parseScanOutput(output, platform, command);
    allRecords.push(...parsed);
    if (parsed.length > 0 && platform === 'linux' && command.startsWith('ss ')) {
      break;
    }
  }

  const deduped = dedupe(allRecords);
  const enriched = await enrichWithProcessInfo(deduped, platform);
  return applyRange(enriched, options).sort((a, b) => a.port - b.port);
}

export async function isPortFree(port: number): Promise<boolean> {
  const ports = await scan();
  return !ports.some((entry) => entry.port === port);
}

export async function findByName(name: string): Promise<PortInfo[]> {
  const needle = name.toLowerCase();
  const ports = await scan();
  return ports.filter((entry) => entry.processName.toLowerCase().includes(needle));
}