import { useState, useEffect } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet } from '../utils/api';
import type { PveNode } from '@shared/types';

interface NetIface {
  iface: string;
  type: string;
  method?: string;
  address?: string;
  netmask?: string;
  cidr?: string;
  gateway?: string;
  active?: number;
  autostart?: number;
  bridge_ports?: string;
  comments?: string;
}

interface FwRule {
  pos: number;
  type: string;       // in | out
  action: string;     // ACCEPT | DROP | REJECT
  proto?: string;
  dport?: string;
  source?: string;
  dest?: string;
  enable?: number;
  comment?: string;
}

export function Network() {
  const [nodes, setNodes] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState('');

  useEffect(() => {
    apiGet<PveNode[]>('/nodes').then((ns) => {
      const names = ns.map((n) => n.node);
      setNodes(names);
      if (names.length) setActiveNode(names[0]);
    });
  }, []);

  const { data: ifaces, loading, error, refresh } = usePolling<NetIface[]>(
    async () => (activeNode ? apiGet<NetIface[]>(`/nodes/${activeNode}/network`) : []),
    0,
    [activeNode]
  );

  const { data: dcFw } = usePolling<FwRule[]>(
    async () => apiGet<FwRule[]>('/cluster/firewall/rules').catch(() => []),
    0,
    []
  );

  if (loading && !ifaces) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading network…</div>;
  }

  const list = ifaces || [];
  const fwRules = dcFw || [];

  return (
    <div className="flex-col" style={{ gap: 18 }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        {nodes.length > 1 && (
          <select style={{ maxWidth: 200 }} value={activeNode} onChange={(e) => setActiveNode(e.target.value)}>
            {nodes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <span className="text-dim" style={{ fontSize: 13 }}>{list.length} interfaces on {activeNode}</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
      </div>

      <div className="card">
        <div className="card-head">🌐 Network Interfaces</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Interface</th><th>Type</th><th>Active</th><th>CIDR / Address</th><th>Gateway</th><th>Ports / Slaves</th></tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.iface}>
                  <td style={{ fontWeight: 600 }}>
                    {n.iface}
                    {n.autostart ? <span className="tag" style={{ marginLeft: 6 }}>auto</span> : null}
                  </td>
                  <td><span className="tag">{n.type}</span></td>
                  <td>
                    <span className={`badge ${n.active ? 'badge-running' : 'badge-stopped'}`}>
                      <span className={`dot ${n.active ? 'dot-online' : 'dot-offline'}`} />
                      {n.active ? 'up' : 'down'}
                    </span>
                  </td>
                  <td className="mono">{n.cidr || n.address || '—'}</td>
                  <td className="mono">{n.gateway || '—'}</td>
                  <td className="text-dim" style={{ fontSize: 12 }}>{n.bridge_ports || '—'}</td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={6}><div className="empty"><div className="empty-icon">🌐</div>No interfaces</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head">🛡️ Datacenter Firewall Rules</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Direction</th><th>Action</th><th>Proto</th><th>Port</th><th>Source</th><th>Dest</th><th>Comment</th></tr>
            </thead>
            <tbody>
              {fwRules.map((r) => (
                <tr key={r.pos} style={{ opacity: r.enable === 0 ? 0.5 : 1 }}>
                  <td>{r.pos}</td>
                  <td><span className="tag">{r.type}</span></td>
                  <td>
                    <span className={`badge ${r.action === 'ACCEPT' ? 'badge-running' : r.action === 'DROP' ? 'badge-stopped' : 'badge-paused'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td>{r.proto || '—'}</td>
                  <td className="mono">{r.dport || '—'}</td>
                  <td className="mono">{r.source || 'any'}</td>
                  <td className="mono">{r.dest || 'any'}</td>
                  <td className="text-dim" style={{ fontSize: 12 }}>{r.comment || '—'}</td>
                </tr>
              ))}
              {fwRules.length === 0 && <tr><td colSpan={8}><div className="empty"><div className="empty-icon">🛡️</div>No datacenter firewall rules</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
