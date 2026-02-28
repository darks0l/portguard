import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { detectPlatform } from './platform.js';
import { scan } from './scanner.js';

const execAsync = promisify(exec);

async function killByPid(pid: number, force = false): Promise<void> {
  const platform = detectPlatform();

  if (platform === 'windows') {
    const cmd = force ? `taskkill /PID ${pid} /F` : `taskkill /PID ${pid}`;
    await execAsync(cmd, { windowsHide: true });
    return;
  }

  process.kill(pid, force ? 'SIGKILL' : 'SIGTERM');
}

export async function killPort(port: number, force = false): Promise<boolean> {
  const ports = await scan();
  const matches = ports.filter((entry) => entry.port === port);
  if (matches.length === 0) return false;

  for (const match of matches) {
    await killByPid(match.pid, force);
  }

  return true;
}