import { usePolling } from '../utils/usePolling';
import { ResourceBar } from '../components/widgets';
import { bytes } from '../utils/format';
import type { ClusterResource } from '@shared/types';

export function Storage() {
  const { data, loading, error, refresh } = usePolling(
    async () => {
      const res = await window.pmx.pve.clusterResources('storage');
      if (!res.ok) throw new Error(res.error || 'Failed to load storage');
      return (res.data?.data || []) as ClusterResource[];
    },
    8000
  );

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading storage…</div>;
  }

  const stores = (data || []).filter((s) => s.type === 'storage');

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <span className="text-dim" style={{ fontSize: 13 }}>{stores.length} storage volumes</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
      </div>

      <div className="grid grid-2">
        {stores.map((s) => {
          const frac = s.maxdisk ? (s.disk || 0) / s.maxdisk : 0;
          return (
            <div className="card" key={s.id}>
              <div className="card-head">
                💾 {s.storage}
                <div style={{ flex: 1 }} />
                <span className={`badge ${s.status === 'available' ? 'badge-running' : 'badge-stopped'}`}>
                  {s.status || 'unknown'}
                </span>
              </div>
              <div className="card-body">
                <dl className="detail-grid">
                  <dt>Node</dt><dd>{s.node}</dd>
                  <dt>Type</dt><dd>{(s as any).plugintype || (s as any).content || '—'}</dd>
                  <dt>Shared</dt><dd>{(s as any).shared ? 'Yes' : 'No'}</dd>
                  <dt>Used</dt><dd>{bytes(s.disk)}</dd>
                  <dt>Total</dt><dd>{bytes(s.maxdisk)}</dd>
                  <dt>Available</dt><dd>{bytes((s.maxdisk || 0) - (s.disk || 0))}</dd>
                </dl>
                <div className="mt">
                  <ResourceBar frac={frac} label="Usage" />
                </div>
              </div>
            </div>
          );
        })}
        {stores.length === 0 && (
          <div className="empty"><div className="empty-icon">💾</div>No storage found</div>
        )}
      </div>
    </div>
  );
}
