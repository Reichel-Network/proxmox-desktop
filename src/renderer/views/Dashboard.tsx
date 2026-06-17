import { usePolling } from '../utils/usePolling';
import { ResourceBar } from '../components/widgets';
import { bytes, uptime } from '../utils/format';
import type { ClusterResource } from '@shared/types';

async function loadOverview() {
  const res = await window.pmx.pve.clusterResources();
  if (!res.ok) throw new Error(res.error || 'Failed to load cluster resources');
  return (res.data?.data || []) as ClusterResource[];
}

export function Dashboard() {
  const { data, loading, error, refresh } = usePolling(loadOverview, 5000);

  if (loading && !data) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg" /> Loading dashboard…
      </div>
    );
  }
  if (error && !data) {
    return <div className="error-banner">{error}</div>;
  }

  const resources = data || [];
  const nodes = resources.filter((r) => r.type === 'node');
  const qemu = resources.filter((r) => r.type === 'qemu');
  const lxc = resources.filter((r) => r.type === 'lxc');
  const storage = resources.filter((r) => r.type === 'storage');

  const vmsRunning = qemu.filter((v) => v.status === 'running').length;
  const ctRunning = lxc.filter((v) => v.status === 'running').length;

  const totalMem = nodes.reduce((a, n) => a + (n.maxmem || 0), 0);
  const usedMem = nodes.reduce((a, n) => a + (n.mem || 0), 0);
  const totalCpu = nodes.reduce((a, n) => a + (n.maxcpu || 0), 0);
  const cpuLoad =
    nodes.length > 0
      ? nodes.reduce((a, n) => a + (n.cpu || 0), 0) / nodes.length
      : 0;

  return (
    <div className="flex-col" style={{ gap: 20 }}>
      {error && <div className="error-banner">{error}</div>}

      <div className="grid grid-stats">
        <div className="stat">
          <div className="stat-label">Nodes</div>
          <div className="stat-value">{nodes.length}</div>
          <div className="stat-sub">
            {nodes.filter((n) => n.status === 'online').length} online
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">Virtual Machines</div>
          <div className="stat-value">{qemu.length}</div>
          <div className="stat-sub text-green">{vmsRunning} running</div>
        </div>
        <div className="stat">
          <div className="stat-label">LXC Containers</div>
          <div className="stat-value">{lxc.length}</div>
          <div className="stat-sub text-green">{ctRunning} running</div>
        </div>
        <div className="stat">
          <div className="stat-label">Total CPUs</div>
          <div className="stat-value">{totalCpu}</div>
          <div className="stat-sub">{(cpuLoad * 100).toFixed(1)}% avg load</div>
        </div>
        <div className="stat">
          <div className="stat-label">Cluster Memory</div>
          <div className="stat-value">{bytes(usedMem)}</div>
          <div className="stat-sub">of {bytes(totalMem)}</div>
          <ResourceBar frac={totalMem ? usedMem / totalMem : 0} />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          🖥️ Nodes
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={() => refresh()}>
            ↻ Refresh
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Node</th>
                <th>Status</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Disk</th>
                <th>Uptime</th>
              </tr>
            </thead>
            <tbody>
              {nodes.map((n) => (
                <tr key={n.id}>
                  <td style={{ fontWeight: 600 }}>{n.node}</td>
                  <td>
                    <span className={`badge ${n.status === 'online' ? 'badge-running' : 'badge-stopped'}`}>
                      <span className={`dot ${n.status === 'online' ? 'dot-online' : 'dot-offline'}`} />
                      {n.status}
                    </span>
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <ResourceBar frac={n.cpu || 0} />
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <ResourceBar frac={n.maxmem ? (n.mem || 0) / n.maxmem : 0} />
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {bytes(n.mem)} / {bytes(n.maxmem)}
                    </div>
                  </td>
                  <td style={{ minWidth: 140 }}>
                    <ResourceBar frac={n.maxdisk ? (n.disk || 0) / n.maxdisk : 0} />
                    <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                      {bytes(n.disk)} / {bytes(n.maxdisk)}
                    </div>
                  </td>
                  <td className="nowrap">{uptime(n.uptime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">💾 Storage</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Storage</th>
                <th>Node</th>
                <th>Type</th>
                <th>Content</th>
                <th>Usage</th>
                <th>Used / Total</th>
              </tr>
            </thead>
            <tbody>
              {storage.map((s) => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 600 }}>{s.storage}</td>
                  <td>{s.node}</td>
                  <td><span className="tag">{s.plugintype || s.storage_type || (s as any).type || '—'}</span></td>
                  <td className="text-dim" style={{ fontSize: 12 }}>{(s as any).content || '—'}</td>
                  <td style={{ minWidth: 140 }}>
                    <ResourceBar frac={s.maxdisk ? (s.disk || 0) / s.maxdisk : 0} />
                  </td>
                  <td className="nowrap">
                    {bytes(s.disk)} / {bytes(s.maxdisk)}
                  </td>
                </tr>
              ))}
              {storage.length === 0 && (
                <tr><td colSpan={6} className="text-dim">No storage found</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
