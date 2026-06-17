import { useState } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPost, apiDel } from '../utils/api';
import { useToast } from '../components/Toast';
import { Field, TextInput, Checkbox } from '../components/form';
import { fmtDate } from '../utils/format';
import type { PveGuest, Snapshot } from '@shared/types';

export function Snapshots({ guest }: { guest: PveGuest }) {
  const toast = useToast();
  const base = `/nodes/${guest.node}/${guest.type}/${guest.vmid}/snapshot`;
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [vmstate, setVmstate] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, refresh } = usePolling<Snapshot[]>(
    async () => {
      const list = await apiGet<Snapshot[]>(base);
      // 'current' is a pseudo-snapshot representing the running state; keep it last.
      return (list || []).sort((a, b) => (a.snaptime || 0) - (b.snaptime || 0));
    },
    0,
    [guest.vmid]
  );

  async function create() {
    if (!name.trim()) return toast.error('Snapshot name is required');
    if (!/^[a-zA-Z][\w-]*$/.test(name))
      return toast.error('Name must start with a letter and contain only letters, digits, - or _');
    setBusy('create');
    try {
      const params: Record<string, any> = { snapname: name, description: desc };
      if (guest.type === 'qemu') params.vmstate = vmstate ? 1 : 0;
      const res = await apiPost(base, params);
      if (res.ok) {
        toast.success(`Snapshot "${name}" started`);
        setName(''); setDesc(''); setCreating(false);
        setTimeout(() => refresh(), 1500);
      } else toast.error(res.error || 'Failed');
    } finally {
      setBusy(null);
    }
  }

  async function rollback(snap: string) {
    if (!window.confirm(`Roll back to snapshot "${snap}"? Current state will be lost.`)) return;
    setBusy(snap);
    try {
      const res = await apiPost(`${base}/${snap}/rollback`);
      if (res.ok) { toast.success(`Rolling back to "${snap}"`); setTimeout(() => refresh(), 1500); }
      else toast.error(res.error || 'Failed');
    } finally { setBusy(null); }
  }

  async function remove(snap: string) {
    if (!window.confirm(`Delete snapshot "${snap}"?`)) return;
    setBusy(snap);
    try {
      const res = await apiDel(`${base}/${snap}`);
      if (res.ok) { toast.success(`Deleting "${snap}"`); setTimeout(() => refresh(), 1200); }
      else toast.error(res.error || 'Failed');
    } finally { setBusy(null); }
  }

  const snaps = (data || []).filter((s) => s.name !== 'current');

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <span className="text-dim" style={{ fontSize: 13 }}>{snaps.length} snapshots</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating((v) => !v)}>
          + Take Snapshot
        </button>
      </div>

      {creating && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-body">
            <Field label="Snapshot Name">
              <TextInput value={name} onChange={setName} placeholder="before-upgrade" onEnter={create} />
            </Field>
            <Field label="Description (optional)">
              <TextInput value={desc} onChange={setDesc} placeholder="What changed…" />
            </Field>
            {guest.type === 'qemu' && (
              <Checkbox id="vmstate" checked={vmstate} onChange={setVmstate}
                label="Include RAM (vmstate) — snapshot running memory" />
            )}
            <div className="flex" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
              <button className="btn btn-sm" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn btn-sm btn-primary" disabled={busy === 'create'} onClick={create}>
                {busy === 'create' ? <span className="spinner" /> : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Name</th><th>Description</th><th>Created</th><th>RAM</th><th className="text-right">Actions</th></tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr><td colSpan={5}><div className="loading-center"><span className="spinner" /> Loading…</div></td></tr>
              ) : snaps.map((s) => (
                <tr key={s.name}>
                  <td style={{ fontWeight: 600 }}>
                    {s.name}
                    {s.parent && <span className="tag" style={{ marginLeft: 6 }}>↳ {s.parent}</span>}
                  </td>
                  <td className="text-dim">{s.description || '—'}</td>
                  <td className="nowrap">{fmtDate(s.snaptime)}</td>
                  <td>{s.vmstate ? <span className="tag">RAM</span> : '—'}</td>
                  <td className="text-right nowrap">
                    {busy === s.name ? <span className="spinner" /> : (
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: 5 }}>
                        <button className="btn btn-sm" title="Rollback" onClick={() => rollback(s.name)}>⏮ Rollback</button>
                        <button className="btn btn-sm btn-danger" title="Delete" onClick={() => remove(s.name)}>🗑</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && snaps.length === 0 && (
                <tr><td colSpan={5}><div className="empty"><div className="empty-icon">📸</div>No snapshots yet</div></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
