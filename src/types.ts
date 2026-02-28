export type Protocol = 'tcp' | 'udp';

export interface PortInfo {
  port: number;
  pid: number;
  processName: string;
  protocol: Protocol;
  state: string;
  uptime: string;
  localAddress: string;
}

export interface ScanOptions {
  range?: {
    start: number;
    end: number;
  };
}