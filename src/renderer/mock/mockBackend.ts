// ---------------------------------------------------------------------------
// DEV-ONLY MOCK BACKEND
//
// Provides a fake `window.pmx` populated with realistic demo data so the full
// UI can be exercised (and screenshotted) without a live Proxmox host.
//
// Activated only when import.meta.env.VITE_MOCK === '1'. Never bundled into a
// production build path that runs against real Electron IPC.
// ---------------------------------------------------------------------------
import type { ApiResult } from '@shared/types';

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, status: 200, data });
// Proxmox wraps payloads as { data: ... }
const wrap = <T,>(d: T): ApiResult => ({ ok: true, status: 200, data: { data: d } as any });

const now = Math.floor(Date.now() / 1000);

// ---- Cluster resources (nodes, vms, lxc, storage) ----
const NODES = [
  { node: 'pve-01', status: 'online', cpu: 0.23, maxcpu: 32, mem: 38_654_705_664, maxmem: 137_438_953_472, disk: 412_316_860_416, maxdisk: 1_099_511_627_776, uptime: 4_233_600, level: '', type: 'node', id: 'node/pve-01' },
  { node: 'pve-02', status: 'online', cpu: 0.41, maxcpu: 32, mem: 71_000_000_000, maxmem: 137_438_953_472, disk: 502_316_860_416, maxdisk: 1_099_511_627_776, uptime: 4_180_000, level: '', type: 'node', id: 'node/pve-02' },
  { node: 'pve-03', status: 'online', cpu: 0.12, maxcpu: 24, mem: 22_000_000_000, maxmem: 68_719_476_736, disk: 210_316_860_416, maxdisk: 549_755_813_888, uptime: 1_200_000, level: '', type: 'node', id: 'node/pve-03' },
];

const QEMU = [
  { vmid: 100, name: 'pfsense-fw', node: 'pve-01', type: 'qemu', status: 'running', cpu: 0.08, maxcpu: 4, maxmem: 4_294_967_296, mem: 2_100_000_000, maxdisk: 34_359_738_368, disk: 0, uptime: 4_100_000, tags: 'network;production', netin: 184320, netout: 91240, diskread: 1024, diskwrite: 2048, id: 'qemu/100' },
  { vmid: 101, name: 'docker-host', node: 'pve-01', type: 'qemu', status: 'running', cpu: 0.34, maxcpu: 8, maxmem: 17_179_869_184, mem: 11_200_000_000, maxdisk: 214_748_364_800, disk: 0, uptime: 2_400_000, tags: 'docker;production', netin: 920000, netout: 442000, diskread: 51200, diskwrite: 102400, id: 'qemu/101' },
  { vmid: 102, name: 'win2022-rds', node: 'pve-02', type: 'qemu', status: 'running', cpu: 0.61, maxcpu: 8, maxmem: 34_359_738_368, mem: 26_000_000_000, maxdisk: 536_870_912_000, disk: 0, uptime: 980_000, tags: 'windows', netin: 320000, netout: 210000, diskread: 204800, diskwrite: 409600, id: 'qemu/102' },
  { vmid: 103, name: 'k8s-master', node: 'pve-02', type: 'qemu', status: 'running', cpu: 0.27, maxcpu: 4, maxmem: 8_589_934_592, mem: 5_900_000_000, maxdisk: 107_374_182_400, disk: 0, uptime: 1_500_000, tags: 'kubernetes', netin: 540000, netout: 380000, diskread: 30720, diskwrite: 61440, id: 'qemu/103' },
  { vmid: 104, name: 'k8s-worker-1', node: 'pve-02', type: 'qemu', status: 'running', cpu: 0.45, maxcpu: 8, maxmem: 17_179_869_184, mem: 13_800_000_000, maxdisk: 214_748_364_800, disk: 0, uptime: 1_500_000, tags: 'kubernetes', netin: 640000, netout: 410000, diskread: 40960, diskwrite: 81920, id: 'qemu/104' },
  { vmid: 105, name: 'backup-target', node: 'pve-03', type: 'qemu', status: 'stopped', cpu: 0, maxcpu: 2, maxmem: 4_294_967_296, mem: 0, maxdisk: 1_099_511_627_776, disk: 0, uptime: 0, tags: 'storage', netin: 0, netout: 0, diskread: 0, diskwrite: 0, id: 'qemu/105' },
  { vmid: 106, name: 'win11-template', node: 'pve-01', type: 'qemu', status: 'stopped', template: 1, cpu: 0, maxcpu: 4, maxmem: 8_589_934_592, mem: 0, maxdisk: 68_719_476_736, disk: 0, uptime: 0, tags: 'template', id: 'qemu/106' },
];

const LXC = [
  { vmid: 200, name: 'nginx-proxy', node: 'pve-01', type: 'lxc', status: 'running', cpu: 0.03, maxcpu: 2, maxmem: 1_073_741_824, mem: 312_000_000, maxdisk: 8_589_934_592, disk: 2_400_000_000, uptime: 3_900_000, tags: 'web;production', netin: 280000, netout: 190000, diskread: 5120, diskwrite: 10240, id: 'lxc/200' },
  { vmid: 201, name: 'postgres-db', node: 'pve-01', type: 'lxc', status: 'running', cpu: 0.18, maxcpu: 4, maxmem: 4_294_967_296, mem: 3_100_000_000, maxdisk: 53_687_091_200, disk: 18_000_000_000, uptime: 3_900_000, tags: 'database;production', netin: 410000, netout: 220000, diskread: 81920, diskwrite: 163840, id: 'lxc/201' },
  { vmid: 202, name: 'gitea', node: 'pve-02', type: 'lxc', status: 'running', cpu: 0.05, maxcpu: 2, maxmem: 2_147_483_648, mem: 780_000_000, maxdisk: 21_474_836_480, disk: 9_200_000_000, uptime: 2_100_000, tags: 'git;dev', netin: 150000, netout: 90000, diskread: 10240, diskwrite: 20480, id: 'lxc/202' },
  { vmid: 203, name: 'grafana', node: 'pve-02', type: 'lxc', status: 'running', cpu: 0.07, maxcpu: 2, maxmem: 2_147_483_648, mem: 1_050_000_000, maxdisk: 16_106_127_360, disk: 4_100_000_000, uptime: 2_100_000, tags: 'monitoring', netin: 200000, netout: 130000, diskread: 8192, diskwrite: 16384, id: 'lxc/203' },
  { vmid: 204, name: 'pihole', node: 'pve-03', type: 'lxc', status: 'running', cpu: 0.02, maxcpu: 1, maxmem: 536_870_912, mem: 180_000_000, maxdisk: 8_589_934_592, disk: 1_800_000_000, uptime: 1_100_000, tags: 'network;dns', netin: 95000, netout: 64000, diskread: 2048, diskwrite: 4096, id: 'lxc/204' },
  { vmid: 205, name: 'vaultwarden', node: 'pve-03', type: 'lxc', status: 'stopped', cpu: 0, maxcpu: 1, maxmem: 536_870_912, mem: 0, maxdisk: 8_589_934_592, disk: 900_000_000, uptime: 0, tags: 'security', netin: 0, netout: 0, diskread: 0, diskwrite: 0, id: 'lxc/205' },
];

const STORAGE = [
  { storage: 'local', node: 'pve-01', type: 'storage', plugintype: 'dir', content: 'iso,vztmpl,backup', status: 'available', shared: 0, disk: 48_000_000_000, maxdisk: 100_000_000_000, id: 'storage/pve-01/local' },
  { storage: 'local-lvm', node: 'pve-01', type: 'storage', plugintype: 'lvmthin', content: 'images,rootdir', status: 'available', shared: 0, disk: 412_316_860_416, maxdisk: 900_000_000_000, id: 'storage/pve-01/local-lvm' },
  { storage: 'ceph-pool', node: 'pve-01', type: 'storage', plugintype: 'rbd', content: 'images,rootdir', status: 'available', shared: 1, disk: 2_100_000_000_000, maxdisk: 8_000_000_000_000, id: 'storage/pve-01/ceph-pool' },
  { storage: 'nfs-backup', node: 'pve-01', type: 'storage', plugintype: 'nfs', content: 'backup,iso', status: 'available', shared: 1, disk: 3_400_000_000_000, maxdisk: 12_000_000_000_000, id: 'storage/pve-01/nfs-backup' },
];

function clusterResources(type?: string) {
  let all: any[] = [...NODES, ...QEMU, ...LXC, ...STORAGE];
  if (type === 'vm') all = [...QEMU, ...LXC];
  else if (type === 'node') all = NODES;
  else if (type === 'storage') all = STORAGE;
  return wrap(all);
}

// ---- RRD time-series ----
function rrd(_node: string, type: string, _vmid: number | null, timeframe: string) {
  const points = timeframe === 'hour' ? 70 : timeframe === 'day' ? 96 : 100;
  const step = timeframe === 'hour' ? 60 : timeframe === 'day' ? 900 : 3600;
  const out: any[] = [];
  let base = type === 'node' ? 0.25 : 0.15;
  for (let i = points; i > 0; i--) {
    const t = now - i * step;
    base += (Math.random() - 0.5) * 0.08;
    base = Math.max(0.02, Math.min(0.95, base));
    const maxmem = 8_589_934_592;
    out.push({
      time: t,
      cpu: base,
      mem: maxmem * (0.4 + base * 0.3),
      maxmem,
      memused: maxmem * (0.4 + base * 0.3),
      netin: 50000 + Math.random() * 800000,
      netout: 30000 + Math.random() * 500000,
      diskread: Math.random() * 200000,
      diskwrite: Math.random() * 150000,
    });
  }
  return wrap(out);
}

// ---- Tasks ----
const TASK_TYPES = ['vzdump', 'qmstart', 'qmstop', 'vzstart', 'qmsnapshot', 'qmigrate', 'imgcopy', 'vncproxy'];
function tasks(node: string) {
  const out: any[] = [];
  for (let i = 0; i < 24; i++) {
    const start = now - i * 1800 - Math.floor(Math.random() * 600);
    const dur = 3 + Math.floor(Math.random() * 240);
    const failed = i % 9 === 4;
    out.push({
      upid: `UPID:${node}:0000A1B2:0F3E4D5C:${start.toString(16).toUpperCase()}:${TASK_TYPES[i % TASK_TYPES.length]}:${100 + (i % 6)}:root@pam:`,
      node,
      type: TASK_TYPES[i % TASK_TYPES.length],
      status: failed ? 'command failed' : 'OK',
      exitstatus: failed ? 'command failed' : 'OK',
      starttime: start,
      endtime: start + dur,
      user: 'root@pam',
      id: String(100 + (i % 6)),
      pid: 41394 + i,
    });
  }
  return wrap(out);
}

// ---- Backups (storage content) ----
function backupContent() {
  const out: any[] = [];
  const ids = [100, 101, 102, 200, 201, 202];
  for (let i = 0; i < 14; i++) {
    const vmid = ids[i % ids.length];
    const ct = now - i * 86400 - Math.floor(Math.random() * 3600);
    out.push({
      volid: `nfs-backup:backup/vzdump-${vmid < 200 ? 'qemu' : 'lxc'}-${vmid}-${new Date(ct * 1000).toISOString().slice(0, 10).replace(/-/g, '_')}-02_15_43.${vmid < 200 ? 'vma.zst' : 'tar.zst'}`,
      ctime: ct,
      size: 1_200_000_000 + Math.floor(Math.random() * 18_000_000_000),
      format: vmid < 200 ? 'vma.zst' : 'tar.zst',
      vmid,
      content: 'backup',
      notes: i % 4 === 0 ? 'Automated nightly backup' : undefined,
      subtype: vmid < 200 ? 'qemu' : 'lxc',
    });
  }
  return wrap(out);
}

// ---- Snapshots ----
function snapshots() {
  return wrap([
    { name: 'before-upgrade', description: 'Pre kernel upgrade 6.8', snaptime: now - 604800, parent: '', vmstate: 1 },
    { name: 'stable-config', description: 'Known good configuration', snaptime: now - 259200, parent: 'before-upgrade', vmstate: 0 },
    { name: 'pre-migration', description: 'Snapshot before storage migration', snaptime: now - 86400, parent: 'stable-config', vmstate: 1 },
    { name: 'current', description: 'You are here', snaptime: now - 3600, parent: 'pre-migration' },
  ]);
}

// ---- Guest config ----
function guestConfig(path: string) {
  const isLxc = path.includes('/lxc/');
  if (isLxc) {
    return wrap({
      hostname: 'postgres-db', cores: 4, memory: 4096, swap: 512, ostype: 'debian',
      rootfs: 'local-lvm:subvol-201-disk-0,size=50G', net0: 'name=eth0,bridge=vmbr0,ip=dhcp,firewall=1',
      arch: 'amd64', unprivileged: 1, onboot: 1, tags: 'database;production',
      description: 'Primary PostgreSQL 16 database server',
    });
  }
  return wrap({
    name: 'docker-host', cores: 8, sockets: 1, memory: 16384, cpu: 'host', ostype: 'l26',
    scsihw: 'virtio-scsi-single', scsi0: 'local-lvm:vm-101-disk-0,size=200G,ssd=1',
    net0: 'virtio=BC:24:11:A2:3F:01,bridge=vmbr0,firewall=1', boot: 'order=scsi0',
    bios: 'ovmf', machine: 'q35', agent: '1', onboot: 1, tags: 'docker;production',
    description: 'Docker host running production containers',
    bootdisk: 'scsi0', vmgenid: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  });
}

// ---- Cluster status / HA / replication ----
function clusterStatus() {
  return wrap([
    { type: 'cluster', name: 'homelab-cluster', nodes: 3, quorate: 1, version: 12, id: 'cluster' },
    { type: 'node', name: 'pve-01', nodeid: 1, online: 1, local: 1, ip: '10.0.0.11', level: '', id: 'node/pve-01' },
    { type: 'node', name: 'pve-02', nodeid: 2, online: 1, local: 0, ip: '10.0.0.12', level: '', id: 'node/pve-02' },
    { type: 'node', name: 'pve-03', nodeid: 3, online: 1, local: 0, ip: '10.0.0.13', level: '', id: 'node/pve-03' },
  ]);
}
function haStatus() {
  return wrap([
    { id: 'vm:100', sid: 'vm:100', type: 'service', node: 'pve-01', status: 'started', state: 'started', crm_state: 'started', request_state: 'started' },
    { id: 'vm:201', sid: 'ct:201', type: 'service', node: 'pve-01', status: 'started', state: 'started', crm_state: 'started', request_state: 'started' },
    { id: 'vm:103', sid: 'vm:103', type: 'service', node: 'pve-02', status: 'started', state: 'started', crm_state: 'started', request_state: 'started' },
    { id: 'master', type: 'master', node: 'pve-01', status: 'active', timestamp: now },
    { id: 'lrm:pve-01', type: 'lrm', node: 'pve-01', status: 'active', timestamp: now },
    { id: 'lrm:pve-02', type: 'lrm', node: 'pve-02', status: 'active', timestamp: now },
  ]);
}
function replication() {
  return wrap([
    { id: '201-0', source: 'pve-01', target: 'pve-02', guest: 201, type: 'local', schedule: '*/15', rate: null, last_sync: now - 600, next_sync: now + 300, duration: 12.4, fail_count: 0, error: null },
    { id: '103-0', source: 'pve-02', target: 'pve-03', guest: 103, type: 'local', schedule: '*/30', rate: null, last_sync: now - 1200, next_sync: now + 600, duration: 28.1, fail_count: 0, error: null },
  ]);
}

// ---- Network & firewall ----
function networkIfaces() {
  return wrap([
    { iface: 'vmbr0', type: 'bridge', method: 'static', address: '10.0.0.11', netmask: '255.255.255.0', gateway: '10.0.0.1', active: 1, autostart: 1, bridge_ports: 'eno1', bridge_stp: 'off', cidr: '10.0.0.11/24' },
    { iface: 'vmbr1', type: 'bridge', method: 'manual', active: 1, autostart: 1, bridge_ports: 'eno2', bridge_stp: 'off', comments: 'VLAN trunk for VM traffic' },
    { iface: 'eno1', type: 'eth', method: 'manual', active: 1, autostart: 1 },
    { iface: 'eno2', type: 'eth', method: 'manual', active: 1, autostart: 1 },
    { iface: 'bond0', type: 'bond', method: 'manual', active: 1, autostart: 1, slaves: 'eno3 eno4', bond_mode: '802.3ad' },
  ]);
}
function firewallRules() {
  return wrap([
    { pos: 0, type: 'in', action: 'ACCEPT', proto: 'tcp', dport: '8006', source: '10.0.0.0/24', enable: 1, comment: 'Proxmox web UI from LAN' },
    { pos: 1, type: 'in', action: 'ACCEPT', proto: 'tcp', dport: '22', source: '10.0.0.0/24', enable: 1, comment: 'SSH from LAN' },
    { pos: 2, type: 'in', action: 'ACCEPT', proto: 'tcp', dport: '443', enable: 1, comment: 'HTTPS' },
    { pos: 3, type: 'in', action: 'DROP', enable: 1, comment: 'Default drop' },
  ]);
}

// ---- Router ----
function get(path: string, params?: Record<string, any>): Promise<ApiResult> {
  if (path === '/version') return Promise.resolve(wrap({ version: '8.2.4', release: '8.2', repoid: 'demo' }));
  if (path === '/cluster/resources') return Promise.resolve(clusterResources(params?.type));
  if (path === '/cluster/status') return Promise.resolve(clusterStatus());
  if (path === '/cluster/ha/status/current') return Promise.resolve(haStatus());
  if (path === '/cluster/replication') return Promise.resolve(replication());
  if (path === '/cluster/nextid') return Promise.resolve(wrap('107'));
  if (path === '/nodes') return Promise.resolve(wrap(NODES));
  if (/\/storage\/[^/]+\/content$/.test(path)) return Promise.resolve(backupContent());
  if (/\/snapshot$/.test(path)) return Promise.resolve(snapshots());
  if (/\/config$/.test(path)) return Promise.resolve(guestConfig(path));
  if (/\/status\/current$/.test(path)) {
    const m = path.match(/\/(qemu|lxc)\/(\d+)\//);
    const all = [...QEMU, ...LXC];
    const g = all.find((x) => m && x.vmid === Number(m[2])) || QEMU[1];
    return Promise.resolve(wrap({ ...g, ha: { managed: 1 }, agent: 1 }));
  }
  if (/\/network$/.test(path)) return Promise.resolve(networkIfaces());
  if (/\/firewall\/rules$/.test(path)) return Promise.resolve(firewallRules());
  if (/\/nodes\/[^/]+\/qemu$/.test(path)) return Promise.resolve(wrap(QEMU.filter((v) => path.includes(v.node))));
  if (/\/nodes\/[^/]+\/lxc$/.test(path)) return Promise.resolve(wrap(LXC.filter((v) => path.includes(v.node))));
  return Promise.resolve(wrap([]));
}

const mockPmx = {
  profiles: {
    list: () => Promise.resolve([
      { id: 'demo-1', name: 'Homelab Cluster', host: '10.0.0.11', port: 8006, authMethod: 'token', tokenId: 'root@pam!desktop', tokenSecret: '••••••••', verifySsl: false, createdAt: now * 1000 },
      { id: 'demo-2', name: 'Edge Node (Office)', host: '192.168.50.4', port: 8006, authMethod: 'password', username: 'root@pam', verifySsl: false, createdAt: now * 1000 },
    ]),
    save: (_p: any) => Promise.resolve([]),
    delete: (_id: string) => Promise.resolve([]),
  },
  session: {
    connect: () => Promise.resolve(ok({ username: 'root@pam' })),
    disconnect: () => Promise.resolve({ ok: true }),
    current: () => Promise.resolve(ok({ id: 'demo-1', name: 'Homelab Cluster', host: '10.0.0.11', port: 8006, authMethod: 'token', verifySsl: false, createdAt: now * 1000 })),
  },
  pve: {
    get,
    post: (_p: string) => Promise.resolve(wrap('UPID:pve-01:0000A1B2:demo:task:root@pam:')),
    put: (_p: string) => Promise.resolve(ok({})),
    del: (_p: string) => Promise.resolve(ok({})),
    clusterResources: (type?: string) => Promise.resolve(clusterResources(type)),
    nodes: () => Promise.resolve(wrap(NODES)),
    guestAction: () => Promise.resolve(wrap('UPID:pve-01:demo:task:root@pam:')),
    rrd,
    tasks: (node: string) => Promise.resolve(tasks(node)),
    taskLog: () => Promise.resolve(wrap([
      { n: 1, t: 'INFO: starting new backup job' },
      { n: 2, t: 'INFO: Starting Backup of VM 101 (qemu)' },
      { n: 3, t: 'INFO: creating vzdump archive' },
      { n: 4, t: 'INFO: transferred 200.0 GiB in 184 seconds (1.1 GiB/s)' },
      { n: 5, t: 'INFO: Finished Backup of VM 101 (00:03:04)' },
      { n: 6, t: 'INFO: Backup job finished successfully' },
      { n: 7, t: 'TASK OK' },
    ])),
    console: () => Promise.resolve(ok({ url: 'https://10.0.0.11:8006', type: 'novnc' })),
    consoleWindow: () => Promise.resolve({ ok: true }),
  },
  settings: {
    get: () => Promise.resolve({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }),
    set: (s: any) => Promise.resolve({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, ...s }),
  },
  updates: {
    check: () => Promise.resolve(ok({ version: '1.1.0' })),
    install: () => Promise.resolve({ ok: true }),
    onEvent: (_cb: any) => () => {},
  },
  notify: () => Promise.resolve({ ok: true }),
  version: () => Promise.resolve('1.1.0'),
  openExternal: () => Promise.resolve({ ok: true }),
};

export function installMock() {
  (window as any).pmx = mockPmx;
  // eslint-disable-next-line no-console
  console.info('[proxmox-desktop] MOCK backend active — demo data, no real host.');
}
