import os from 'node:os';

export type Platform = 'windows' | 'linux' | 'macos';

export function detectPlatform(nodePlatform: NodeJS.Platform = os.platform()): Platform {
  if (nodePlatform === 'win32') return 'windows';
  if (nodePlatform === 'darwin') return 'macos';
  return 'linux';
}

export function getScanCommands(platform: Platform): string[] {
  if (platform === 'windows') {
    return ['netstat -ano -p tcp', 'netstat -ano -p udp'];
  }

  if (platform === 'macos') {
    return ['lsof -nP -iTCP -sTCP:LISTEN', 'lsof -nP -iUDP'];
  }

  return ['ss -lntup', 'netstat -lntup'];
}

export function getProcessListCommand(platform: Platform): string {
  if (platform === 'windows') {
    return 'powershell -NoProfile -Command "Get-Process | Select-Object Id,ProcessName,StartTime | ConvertTo-Csv -NoTypeInformation"';
  }

  return 'ps -eo pid=,comm=,lstart=';
}