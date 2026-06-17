import { useState, useEffect } from 'react';
import { usePolling } from '../utils/usePolling';
import { Modal } from '../components/Modal';
import { fmtDate, timeAgo } from '../utils/format';
import type { PveTask, PveNode } from '@shared/types';

function TaskStatus({ task }: { task: PveTask }) {
  const running = !task.endtime;
  if (running) {
    return <span className="badge badge-running"><span className="dot dot-running" />running</span>;
  }
  const ok = task.status === 'OK' || task.exitstatus === 'OK';
  return (
    <span className={`badge ${ok ? 'badge-running' : 'badge-stopped'}`} style={!ok ? { color: 'var(--red)' } : undefined}>
      {ok ? '✓ OK' : `✕ ${task.status || task.exitstatus || 'error'}`}
    </span>
  );
}

export function Tasks() {
  const [nodes, setNodes] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState<string>('');
  const [logTask, setLogTask] = useState<PveTask | null>(null);
  const [logText, setLogText] = useState('');

  useEffect(() => {
    window.pmx.pve.nodes().then((res) => {
      if (res.ok) {
        const ns = (res.data?.data || []) as PveNode[];
        const names = ns.map((n) => n.node);
        setNodes(names);
        if (names.length) setActiveNode(names[0]);
      }
    });
  }, []);

  const { data, loading, error, refresh } = usePolling(
    async () => {
      if (!activeNode) return [] as PveTask[];
      const res = await window.pmx.pve.tasks(activeNode, 100);
      if (!res.ok) throw new Error(res.error || 'Failed to load tasks');
      return (res.data?.data || []) as PveTask[];
    },
    5000,
    [activeNode]
  );

  async function openLog(t: PveTask) {
    setLogTask(t);
    setLogText('Loading…');
    const res = await window.pmx.pve.taskLog(t.node, t.upid);
    if (res.ok) {
      const lines = (res.data?.data || []) as { n: number; t: string }[];
      setLogText(lines.map((l) => l.t).join('\n') || '(no output)');
    } else {
      setLogText(`Error: ${res.error}`);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        {nodes.length > 1 && (
          <select style={{ maxWidth: 200 }} value={activeNode} onChange={(e) => setActiveNode(e.target.value)}>
            {nodes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <span className="text-dim" style={{ fontSize: 13 }}>
          {(data || []).length} recent tasks {activeNode && `on ${activeNode}`}
        </span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Type</th>
                <th>ID</th>
                <th>User</th>
                <th>Started</th>
                <th>Duration</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={7}><div className="loading-center"><span className="spinner" /> Loading…</div></td></tr>
              ) : (
                (data || []).map((t) => {
                  const dur = t.endtime ? t.endtime - t.starttime : null;
                  return (
                    <tr key={t.upid} className="clickable" onClick={() => openLog(t)}>
                      <td><TaskStatus task={t} /></td>
                      <td style={{ fontWeight: 500 }}>{t.type}</td>
                      <td className="text-dim">{t.id || '—'}</td>
                      <td className="text-dim">{t.user}</td>
                      <td className="nowrap" title={fmtDate(t.starttime)}>{timeAgo(t.starttime)}</td>
                      <td className="nowrap">{dur !== null ? `${dur}s` : <span className="text-dim">running…</span>}</td>
                      <td className="text-right"><button className="btn btn-sm">View Log</button></td>
                    </tr>
                  );
                })
              )}
              {!loading && (data || []).length === 0 && (
                <tr><td colSpan={7}><div className="empty"><div className="empty-icon">📋</div>No tasks found</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {logTask && (
        <Modal
          title={`Task Log · ${logTask.type} ${logTask.id || ''}`}
          onClose={() => setLogTask(null)}
          width={760}
        >
          <div style={{ marginBottom: 12 }}>
            <dl className="detail-grid">
              <dt>UPID</dt><dd className="mono" style={{ fontSize: 11, wordBreak: 'break-all' }}>{logTask.upid}</dd>
              <dt>Node</dt><dd>{logTask.node}</dd>
              <dt>Started</dt><dd>{fmtDate(logTask.starttime)}</dd>
              <dt>Status</dt><dd><TaskStatus task={logTask} /></dd>
            </dl>
          </div>
          <div className="log-view">{logText}</div>
        </Modal>
      )}
    </div>
  );
}
