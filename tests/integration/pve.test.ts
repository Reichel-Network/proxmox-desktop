import { describe, it, expect, beforeAll } from 'vitest';
import { ProxmoxClient } from '../../src/main/ProxmoxClient';
import type { ConnectionProfile } from '../../src/shared/types';

const host = process.env.PVE_TEST_HOST;
const token = process.env.PVE_TEST_TOKEN;

function getProfile(): ConnectionProfile {
  if (!host || !token) {
    throw new Error('PVE_TEST_HOST and PVE_TEST_TOKEN must be set');
  }
  const [hostPart, portPart] = host.split(':');
  const port = parseInt(portPart || '8006', 10);
  const [tokenId, tokenSecret] = token.includes('=') ? token.split('=') : [token, ''];
  return {
    id: 'ci-test',
    name: 'CI Test',
    host: hostPart,
    port,
    authMethod: 'token',
    tokenId,
    tokenSecret,
    verifySsl: false,
    createdAt: Date.now(),
    secretsEncrypted: false,
  };
}

describe('Proxmox API integration', () => {
  let client: ProxmoxClient;

  beforeAll(async () => {
    client = new ProxmoxClient(getProfile());
    const login = await client.login();
    expect(login.ok).toBe(true);
  });

  it('reads cluster status', async () => {
    const res = await client.get('/cluster/status');
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data?.data)).toBe(true);
  });

  it('reads cluster resources (guests, storage, nodes)', async () => {
    const res = await client.get('/cluster/resources');
    expect(res.ok).toBe(true);
    expect(Array.isArray(res.data?.data)).toBe(true);
    const types = new Set(res.data!.data.map((r: any) => r.type));
    expect(types.has('node') || types.has('qemu') || types.has('lxc') || types.has('storage')).toBe(true);
  });

  it('reads storage list and content', async () => {
    const res = await client.get('/cluster/resources', { type: 'storage' });
    expect(res.ok).toBe(true);
    const stores = res.data!.data as any[];
    expect(Array.isArray(stores)).toBe(true);

    for (const s of stores.slice(0, 2)) {
      const content = await client.get(`/nodes/${s.node}/storage/${s.storage}/content`, { content: 'iso' });
      expect(content.ok).toBe(true);
      expect(Array.isArray(content.data?.data)).toBe(true);
    }
  });

  it('reads node list and tasks', async () => {
    const res = await client.get('/nodes');
    expect(res.ok).toBe(true);
    const nodes = res.data!.data as any[];
    expect(nodes.length).toBeGreaterThan(0);
    for (const n of nodes.slice(0, 1)) {
      const tasks = await client.get(`/nodes/${n.node}/tasks`, { limit: 5 });
      expect(tasks.ok).toBe(true);
    }
  });

  it('reads qemu and lxc guests via vm filter and per-node list', async () => {
    const all = await client.get('/cluster/resources', { type: 'vm' });
    expect(all.ok).toBe(true);
    expect(Array.isArray(all.data?.data)).toBe(true);
    const qemu = (all.data!.data as any[]).filter((r) => r.type === 'qemu');
    const lxc = (all.data!.data as any[]).filter((r) => r.type === 'lxc');
    expect(qemu.length + lxc.length).toBeGreaterThanOrEqual(0);

    // Also verify per-node lists work
    const nodes = await client.get('/nodes');
    expect(nodes.ok).toBe(true);
    for (const n of (nodes.data!.data as any[]).slice(0, 1)) {
      const vmList = await client.get(`/nodes/${n.node}/qemu`);
      const ctList = await client.get(`/nodes/${n.node}/lxc`);
      expect(vmList.ok).toBe(true);
      expect(ctList.ok).toBe(true);
    }
  });

  it('reads firewall rules for the first qemu guest', async () => {
    const all = await client.get('/cluster/resources', { type: 'vm' });
    expect(all.ok).toBe(true);
    const list = (all.data!.data as any[]).filter((r) => r.type === 'qemu');
    if (list.length === 0) return;
    const g = list[0];
    const fw = await client.get(`/nodes/${g.node}/qemu/${g.vmid}/firewall/rules`);
    expect(fw.ok).toBe(true);
    expect(Array.isArray(fw.data?.data)).toBe(true);
  });

  it('reads permissions (the shape that caused v1.7.0 crash)', async () => {
    const res = await client.get('/access/permissions');
    expect(res.ok).toBe(true);
    const raw = res.data!.data;
    expect(typeof raw).toBe('object');
    expect(raw).not.toBeNull();
  });

  it('fetches task log for a recent task', async () => {
    const nodes = await client.get('/nodes');
    expect(nodes.ok).toBe(true);
    const nodeList = nodes.data!.data as any[];
    if (nodeList.length === 0) return;
    const node = nodeList[0].node;

    const tasks = await client.get(`/nodes/${node}/tasks`, { limit: 5 });
    expect(tasks.ok).toBe(true);
    const taskList = tasks.data!.data as any[];
    if (taskList.length === 0) return;

    const upid = taskList[0].upid;
    const log = await client.get(`/nodes/${node}/tasks/${upid}/log`);
    expect(log.ok).toBe(true);
    expect(Array.isArray(log.data?.data)).toBe(true);
  });

  it('returns RRD data with numeric time field', async () => {
    const all = await client.get('/cluster/resources', { type: 'vm' });
    expect(all.ok).toBe(true);
    const qemu = (all.data!.data as any[]).filter((r) => r.type === 'qemu');

    let rrd;
    if (qemu.length > 0) {
      const g = qemu[0];
      rrd = await client.get(`/nodes/${g.node}/qemu/${g.vmid}/rrddata`, { timeframe: 'hour', cf: 'AVERAGE' });
    } else {
      const nodes = await client.get('/nodes');
      expect(nodes.ok).toBe(true);
      const nodeList = nodes.data!.data as any[];
      if (nodeList.length === 0) return;
      rrd = await client.get(`/nodes/${nodeList[0].node}/rrddata`, { timeframe: 'hour', cf: 'AVERAGE' });
    }

    expect(rrd.ok).toBe(true);
    expect(Array.isArray(rrd.data?.data)).toBe(true);
    if (rrd.data!.data.length > 0) {
      expect(typeof rrd.data!.data[0].time).toBe('number');
    }
  });

  it('returns a console ticket for the first qemu guest', async () => {
    const all = await client.get('/cluster/resources', { type: 'vm' });
    expect(all.ok).toBe(true);
    const qemu = (all.data!.data as any[]).filter((r) => r.type === 'qemu');
    if (qemu.length === 0) return;

    const g = qemu[0];
    const ticket = await client.post(`/nodes/${g.node}/qemu/${g.vmid}/termproxy`);
    expect(ticket.ok).toBe(true);
    expect(typeof ticket.data?.data?.ticket).toBe('string');
    expect(ticket.data!.data.ticket.length).toBeGreaterThan(0);
  });

  it('lists snapshots for the first qemu guest', async () => {
    const all = await client.get('/cluster/resources', { type: 'vm' });
    expect(all.ok).toBe(true);
    const qemu = (all.data!.data as any[]).filter((r) => r.type === 'qemu');
    if (qemu.length === 0) return;

    const g = qemu[0];
    const snaps = await client.get(`/nodes/${g.node}/qemu/${g.vmid}/snapshot`);
    expect(snaps.ok).toBe(true);
    expect(Array.isArray(snaps.data?.data)).toBe(true);
  });

  it('reads pools, users, and access ACL', async () => {
    const pools = await client.get('/pools');
    const users = await client.get('/access/users');
    const acl = await client.get('/access/acl');
    expect(pools.ok).toBe(true);
    expect(users.ok).toBe(true);
    expect(acl.ok).toBe(true);
    expect(Array.isArray(pools.data?.data)).toBe(true);
    expect(Array.isArray(users.data?.data)).toBe(true);
    expect(Array.isArray(acl.data?.data)).toBe(true);
  });
});
