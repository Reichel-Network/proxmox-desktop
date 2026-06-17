// Shared type definitions used by both the main (Node) and renderer (React) processes.

export type AuthMethod = 'token' | 'password';

export interface ConnectionProfile {
  id: string;
  name: string;
  host: string;          // hostname or IP, no scheme
  port: number;          // default 8006
  authMethod: AuthMethod;
  // For token auth:
  tokenId?: string;      // e.g. root@pam!mytoken
  tokenSecret?: string;
  // For password auth:
  username?: string;     // e.g. root@pam
  password?: string;
  realm?: string;        // pam, pve, etc. (parsed from username if omitted)
  verifySsl: boolean;    // false = accept self-signed certs
  createdAt: number;
  secretsEncrypted?: boolean; // true if tokenSecret/password are DPAPI-encrypted at rest
}

export interface ApiResult<T = any> {
  ok: boolean;
  status?: number;
  data?: T;
  error?: string;
}

export interface PveNode {
  node: string;
  status: 'online' | 'offline' | 'unknown';
  cpu?: number;
  maxcpu?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  level?: string;
  type?: string;
}

export interface PveGuest {
  vmid: number;
  name?: string;
  node: string;
  type: 'qemu' | 'lxc';
  status: 'running' | 'stopped' | 'paused' | 'suspended' | string;
  cpu?: number;
  maxcpu?: number;
  cpus?: number;
  mem?: number;
  maxmem?: number;
  disk?: number;
  maxdisk?: number;
  uptime?: number;
  template?: number;
  tags?: string;
  lock?: string;
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
}

export interface PveStorage {
  storage: string;
  node: string;
  type: string;
  content?: string;
  active?: number;
  enabled?: number;
  used?: number;
  avail?: number;
  total?: number;
  used_fraction?: number;
  shared?: number;
}

export interface PveTask {
  upid: string;
  node: string;
  type: string;
  status?: string;
  starttime: number;
  endtime?: number;
  user: string;
  id?: string;
  exitstatus?: string;
  pid?: number;
}

export interface ClusterResource {
  id: string;
  type: string;
  node?: string;
  status?: string;
  [key: string]: any;
}

export interface RrdPoint {
  time: number;
  cpu?: number;
  mem?: number;
  maxmem?: number;
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
  [key: string]: any;
}

export type GuestAction = 'start' | 'stop' | 'shutdown' | 'reboot' | 'suspend' | 'resume';

export interface ConsoleInfo {
  url: string;
  type: 'novnc' | 'spice';
}

export interface Snapshot {
  name: string;
  description?: string;
  snaptime?: number;
  parent?: string;
  vmstate?: number;
  running?: number;
}

export interface BackupFile {
  volid: string;
  ctime?: number;
  size?: number;
  format?: string;
  notes?: string;
  vmid?: number;
  content?: string;
  subtype?: string;
}

export interface AppSettings {
  theme: 'dark' | 'light';
  confirmDestructive: boolean;
  autoCheckUpdates: boolean;
}

export interface UpdateStatus {
  event: 'checking' | 'available' | 'not-available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  percent?: number;
  message?: string;
}
