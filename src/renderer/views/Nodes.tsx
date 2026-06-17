import { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { usePolling } from '../utils/usePolling';
import { ResourceBar } from '../components/widgets';
import { Modal } from '../components/Modal';
import { bytes, uptime, pct } from '../utils/format';
import type { ClusterResource, RrdPoint, PveNode } from '@shared/types';

const tooltipStyle = { background: '#1d2130', border: '1px solid #323849', borderRadius: 6, fontSize: 12 };

function NodeDetail({ node, onClose }: { node: PveNode; onClose: () => void }) {
  const [tf, setTf] = useState('hour');
  const { data: rrd } = usePolling<RrdPoint[]>(
    async () => {
      const res = await window.pmx.pve.rrd(node.node, 'node', null, tf);
      if (!res.ok) throw new Error(res.error);
      return (res.data?.data || []) as RrdPoint[];
    },
    15000,
    [node.node, tf]
  );

  const fmt = (t: number) => {
    const d = new Date(t * 1000);
    return tf === 'hour' || tf === 'day'
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const cpuData = (rrd || []).map((p) => ({ t: fmt(p.time), cpu: (p.cpu || 0) * 100 }));
  const memData = (rrd || []).map((p) => ({ t: fmt(p.time), mem: (p.memused || (p as any).mem || 0) / 1024 / 1024 / 1024 }));

  return (
    <Modal title={`Node · ${node.node}`} onClose={onClose} width={760}>
      <div className="flex" style={{ gap: 6, marginBottom: 16 }}>
        {['hour', 'day', 'week', 'month'].map((t) => (
          <button key={t} className={`btn btn-sm ${tf === t ? 'btn-primary' : ''}`} onClick={() => setTf(t)}>
            {t === 'hour' ? '1H' : t === 'day' ? '24H' : t === 'week' ? '7D' : '30D'}
          </button>
        ))}
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head" style={{ fontSize: 13 }}>CPU Usage (%)</div>
        <div style={{ padding: '12px 8px 8px 0' }}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={cpuData}>
              <defs>
                <linearGradient id="ncpu" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#e57000" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#e57000" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262b3a" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b7488' }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7488' }} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="cpu" stroke="#e57000" fill="url(#ncpu)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="card">
        <div className="card-head" style={{ fontSize: 13 }}>Memory (GiB)</div>
        <div style={{ padding: '12px 8px 8px 0' }}>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={memData}>
              <defs>
                <linearGradient id="nmem" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#262b3a" />
              <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b7488' }} minTickGap={30} />
              <YAxis tick={{ fontSize: 10, fill: '#6b7488' }} width={32} />
              <Tooltip contentStyle={tooltipStyle} />
              <Area type="monotone" dataKey="mem" stroke="#3b82f6" fill="url(#nmem)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Modal>
  );
}

export function Nodes() {
  const [selected, setSelected] = useState<PveNode | null>(null);
  const { data, loading, error, refresh } = usePolling(
    async () => {
      const res = await window.pmx.pve.clusterResources('node');
      if (!res.ok) throw new Error(res.error || 'Failed to load nodes');
      return (res.data?.data || []) as ClusterResource[];
    },
    5000
  );

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading nodes…</div>;
  }

  const nodes = (data || []).filter((n) => n.type === 'node');

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <span className="text-dim" style={{ fontSize: 13 }}>{nodes.length} nodes</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
      </div>
      <div className="grid grid-2">
        {nodes.map((n) => {
          const node: PveNode = {
            node: n.node as string,
            status: (n.status as any) || 'unknown',
            cpu: n.cpu, maxcpu: n.maxcpu, mem: n.mem, maxmem: n.maxmem,
            disk: n.disk, maxdisk: n.maxdisk, uptime: n.uptime,
          };
          return (
            <div className="card clickable" key={n.id} onClick={() => setSelected(node)} style={{ cursor: 'pointer' }}>
              <div className="card-head">
                🖥️ {node.node}
                <div style={{ flex: 1 }} />
                <span className={`badge ${node.status === 'online' ? 'badge-running' : 'badge-stopped'}`}>
                  <span className={`dot ${node.status === 'online' ? 'dot-online' : 'dot-offline'}`} />
                  {node.status}
                </span>
              </div>
              <div className="card-body flex-col" style={{ gap: 14 }}>
                <div>
                  <div className="flex" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span className="text-dim">CPU ({node.maxcpu} cores)</span><span>{pct(node.cpu)}</span>
                  </div>
                  <ResourceBar frac={node.cpu || 0} />
                </div>
                <div>
                  <div className="flex" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span className="text-dim">Memory</span>
                    <span>{bytes(node.mem)} / {bytes(node.maxmem)}</span>
                  </div>
                  <ResourceBar frac={node.maxmem ? (node.mem || 0) / node.maxmem : 0} />
                </div>
                <div>
                  <div className="flex" style={{ justifyContent: 'space-between', fontSize: 12.5 }}>
                    <span className="text-dim">Disk (root)</span>
                    <span>{bytes(node.disk)} / {bytes(node.maxdisk)}</span>
                  </div>
                  <ResourceBar frac={node.maxdisk ? (node.disk || 0) / node.maxdisk : 0} />
                </div>
                <div className="flex" style={{ justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text-dim)' }}>
                  <span>Uptime</span><span>{uptime(node.uptime)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {selected && <NodeDetail node={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
