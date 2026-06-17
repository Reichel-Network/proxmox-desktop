import { usePolling } from '../utils/usePolling';
import { apiGet } from '../utils/api';
import { fmtDate } from '../utils/format';

interface ClusterStatusItem {
  type: string; // 'cluster' | 'node'
  name: string;
  nodeid?: number;
  online?: number;
  local?: number;
  ip?: string;
  level?: string;
  quorate?: number;
  nodes?: number;
  version?: number;
}

export function ClusterHealth() {
  const { data, loading, error, refresh } = usePolling<ClusterStatusItem[]>(
    async () => apiGet<ClusterStatusItem[]>('/cluster/status'),
    5000
  );

  const { data: ha } = usePolling<any[]>(
    async () => apiGet<any[]>('/cluster/ha/status/current').catch(() => []),
    8000
  );

  const { data: replication } = usePolling<any[]>(
    async () => apiGet<any[]>('/cluster/replication').catch(() => []),
    10000
  );

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading cluster status…</div>;
  }

  const items = data || [];
  const cluster = items.find((i) => i.type === 'cluster');
  const clusterNodes = items.filter((i) => i.type === 'node');
  const isClustered = !!cluster;
  const quorate = cluster?.quorate === 1;
  const haItems = ha || [];
  const repItems = replication || [];

  return (
    <div className="flex-col" style={{ gap: 18 }}>
      {error && <div className="error-banner">{error}</div>}

      <div className="toolbar">
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
      </div>

      <div className="grid grid-stats">
        <div className="stat">
          <div className="stat-label">Cluster</div>
          <div className="stat-value" style={{ fontSize: 20 }}>{isClustered ? cluster?.name : 'Standalone'}</div>
          <div className="stat-sub">{isClustered ? `${clusterNodes.length} nodes` : 'single node'}</div>
        </div>
        {isClustered && (
          <div className="stat">
            <div className="stat-label">Quorum</div>
            <div className="stat-value" style={{ fontSize: 20, color: quorate ? 'var(--green)' : 'var(--red)' }}>
              {quorate ? '✓ Quorate' : '✕ No Quorum'}
            </div>
          </div>
        )}
        <div className="stat">
          <div className="stat-label">Nodes Online</div>
          <div className="stat-value">
            {clusterNodes.filter((n) => n.online === 1).length || (isClustered ? 0 : 1)}
            <span style={{ fontSize: 14, color: 'var(--text-dim)' }}> / {clusterNodes.length || 1}</span>
          </div>
        </div>
        <div className="stat">
          <div className="stat-label">HA Services</div>
          <div className="stat-value">{haItems.filter((h) => h.type === 'service').length}</div>
          <div className="stat-sub">{repItems.length} replication jobs</div>
        </div>
      </div>

      {isClustered && (
        <div className="card">
          <div className="card-head">🖧 Cluster Members</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Node</th><th>ID</th><th>IP</th><th>Status</th><th>Local</th></tr></thead>
              <tbody>
                {clusterNodes.map((n) => (
                  <tr key={n.name}>
                    <td style={{ fontWeight: 600 }}>{n.name}</td>
                    <td>{n.nodeid}</td>
                    <td className="mono">{n.ip || '—'}</td>
                    <td>
                      <span className={`badge ${n.online ? 'badge-running' : 'badge-stopped'}`}>
                        <span className={`dot ${n.online ? 'dot-online' : 'dot-offline'}`} />
                        {n.online ? 'online' : 'offline'}
                      </span>
                    </td>
                    <td>{n.local ? <span className="tag">this node</span> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {haItems.length > 0 && (
        <div className="card">
          <div className="card-head">🔁 High Availability</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Service / Node</th><th>Status</th><th>State</th></tr></thead>
              <tbody>
                {haItems.map((h, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 500 }}>{h.sid || h.node || h.id}</td>
                    <td className="text-dim">{h.status || '—'}</td>
                    <td>{h.state ? <span className="tag">{h.state}</span> : (h.crm || h.lrm || '—')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {repItems.length > 0 && (
        <div className="card">
          <div className="card-head">📋 Replication Jobs</div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Target</th><th>Last Sync</th><th>State</th></tr></thead>
              <tbody>
                {repItems.map((r, i) => (
                  <tr key={i}>
                    <td className="mono">{r.id}</td>
                    <td>{r.target}</td>
                    <td className="nowrap">{r.last_sync ? fmtDate(r.last_sync) : '—'}</td>
                    <td>{r.error ? <span className="text-red">error</span> : <span className="text-green">ok</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
