import { useState } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPost, apiDel } from '../utils/api';
import { Modal } from '../components/Modal';
import { Field, TextInput } from '../components/form';
import { useToast } from '../components/Toast';

interface PoolItem {
  poolid: string;
  comment?: string;
  members?: PoolMember[];
}

interface PoolMember {
  id: string;
  type: 'node' | 'qemu' | 'lxc' | 'storage';
  node?: string;
  name?: string;
  vmid?: number;
  storage?: string;
}

export function Pools() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editorOpen, setEditorOpen] = useState(false);

  const { data, loading, error, refresh } = usePolling<PoolItem[]>(
    async () => {
      const pools = await apiGet<PoolItem[]>('/pools');
      // /pools summary list doesn't always return members; hydrate each pool.
      const detailed = await Promise.all(
        (pools || []).map(async (p) => {
          try {
            const detail = await apiGet<PoolItem>(`/pools/${p.poolid}`);
            return { ...p, members: detail.members || [] };
          } catch (e) {
            return { ...p, members: [] };
          }
        })
      );
      return detailed;
    },
    15000,
    []
  );

  async function deletePool(poolid: string) {
    if (!window.confirm(`Delete pool "${poolid}"?`)) return;
    const res = await apiDel(`/pools/${poolid}`);
    if (res.ok) {
      toast.success(`Deleted pool ${poolid}`);
      refresh();
    } else {
      toast.error(res.error || 'Failed to delete pool');
    }
  }

  const pools = (data || []).filter((p) =>
    !query ||
    p.poolid.toLowerCase().includes(query.toLowerCase()) ||
    (p.comment || '').toLowerCase().includes(query.toLowerCase())
  );

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading pools…</div>;
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Search pools…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-dim" style={{ fontSize: 13 }}>{pools.length} pools</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setEditorOpen(true)}>+ Pool</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Pool ID</th>
                <th>Comment</th>
                <th>Members</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.poolid}>
                  <td style={{ fontWeight: 600 }}>🗂️ {p.poolid}</td>
                  <td className="text-dim">{p.comment || '—'}</td>
                  <td>
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(p.poolid)) next.delete(p.poolid); else next.add(p.poolid);
                          return next;
                        });
                      }}
                    >
                      {p.members?.length || 0} members {expanded.has(p.poolid) ? '▲' : '▼'}
                    </button>
                    {expanded.has(p.poolid) && (
                      <div className="mt" style={{ maxWidth: 420 }}>
                        {(p.members || []).length === 0 ? (
                          <span className="text-dim" style={{ fontSize: 12 }}>No members</span>
                        ) : (
                          (p.members || []).map((m) => (
                            <span className="tag" key={m.id}>
                              {m.type === 'node' && '🖥️'}
                              {m.type === 'qemu' && '🖥️'}
                              {m.type === 'lxc' && '📦'}
                              {m.type === 'storage' && '💾'}
                              {' '}{m.name || m.vmid || m.storage || m.node || m.id}
                            </span>
                          ))
                        )}
                      </div>
                    )}
                  </td>
                  <td className="text-right nowrap">
                    <div className="flex" style={{ justifyContent: 'flex-end', gap: 5 }}>
                      <button className="btn btn-sm btn-danger" onClick={() => deletePool(p.poolid)}>✕ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {pools.length === 0 && (
                <tr>
                  <td colSpan={4}>
                    <div className="empty"><div className="empty-icon">🗂️</div>No pools found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen && (
        <PoolEditor onClose={() => setEditorOpen(false)} onSaved={() => { refresh(); setEditorOpen(false); }} />
      )}
    </div>
  );
}

function PoolEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ poolid: '', comment: '' });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.poolid) return toast.error('Pool ID is required');
    setBusy(true);
    const res = await apiPost('/pools', {
      poolid: form.poolid,
      comment: form.comment,
    });
    setBusy(false);
    if (res.ok) {
      toast.success(`Created pool ${form.poolid}`);
      onSaved();
    } else {
      toast.error(res.error || 'Failed to create pool');
    }
  }

  return (
    <Modal title="Add Pool" onClose={onClose} width={420}>
      <div className="flex-col" style={{ gap: 12 }}>
        <Field label="Pool ID" hint="Unique identifier for the pool">
          <TextInput value={form.poolid} onChange={(v) => setForm({ ...form, poolid: v })} />
        </Field>
        <Field label="Comment">
          <TextInput value={form.comment} onChange={(v) => setForm({ ...form, comment: v })} />
        </Field>
        <div className="flex" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Create'}</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
