import { useState, useEffect, useMemo } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPost, apiDel } from '../utils/api';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { Field, Select } from '../components/form';
import { bytes, fmtDate } from '../utils/format';
import type { BackupFile, PveNode, ClusterResource } from '@shared/types';

interface StorageRef { storage: string; node: string; content?: string; }

export function Backups() {
  const toast = useToast();
  const [nodes, setNodes] = useState<string[]>([]);
  const [storages, setStorages] = useState<StorageRef[]>([]);
  const [activeStorage, setActiveStorage] = useState<string>('');
  const [activeNode, setActiveNode] = useState<string>('');
  const [restoring, setRestoring] = useState<BackupFile | null>(null);
  const [showBackupNow, setShowBackupNow] = useState(false);

  useEffect(() => {
    apiGet<ClusterResource[]>('/cluster/resources', { type: 'storage' })
      .then((res) => {
        const backupStores = (res || [])
          .filter((s) => String(s.content || '').includes('backup'))
          .map((s) => ({ storage: s.storage as string, node: s.node as string, content: s.content }));
        setStorages(backupStores);
        if (backupStores.length) {
          setActiveStorage(backupStores[0].storage);
          setActiveNode(backupStores[0].node);
        }
      })
      .catch((e) => toast.error(e.message));
    apiGet<PveNode[]>('/nodes').then((ns) => setNodes(ns.map((n) => n.node))).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data, loading, error, refresh } = usePolling<BackupFile[]>(
    async () => {
      if (!activeStorage || !activeNode) return [];
      const res = await apiGet<BackupFile[]>(
        `/nodes/${activeNode}/storage/${activeStorage}/content`,
        { content: 'backup' }
      );
      return (res || []).sort((a, b) => (b.ctime || 0) - (a.ctime || 0));
    },
    0,
    [activeStorage, activeNode]
  );

  async function remove(b: BackupFile) {
    if (!window.confirm(`Delete backup ${b.volid}?`)) return;
    const res = await apiDel(`/nodes/${activeNode}/storage/${activeStorage}/content/${encodeURIComponent(b.volid)}`);
    if (res.ok) { toast.success('Backup deleted'); setTimeout(() => refresh(), 800); }
    else toast.error(res.error || 'Failed');
  }

  const backups = data || [];

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        {storages.length > 0 && (
          <select style={{ maxWidth: 240 }} value={activeStorage}
            onChange={(e) => {
              const s = storages.find((x) => x.storage === e.target.value);
              if (s) { setActiveStorage(s.storage); setActiveNode(s.node); }
            }}>
            {storages.map((s) => <option key={s.storage} value={s.storage}>{s.storage} ({s.node})</option>)}
          </select>
        )}
        <span className="text-dim" style={{ fontSize: 13 }}>{backups.length} backups</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setShowBackupNow(true)}>+ Backup Now</button>
      </div>

      {storages.length === 0 ? (
        <div className="empty"><div className="empty-icon">💿</div>No backup-capable storage found</div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>VMID</th><th>Volume</th><th>Format</th><th>Size</th><th>Created</th><th>Notes</th><th className="text-right">Actions</th></tr>
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={7}><div className="loading-center"><span className="spinner" /> Loading…</div></td></tr>
                ) : backups.map((b) => (
                  <tr key={b.volid}>
                    <td style={{ fontWeight: 600 }}>{b.vmid || '—'}</td>
                    <td className="mono" style={{ fontSize: 11.5, wordBreak: 'break-all', maxWidth: 320 }}>
                      {b.volid.split('/').pop()}
                    </td>
                    <td><span className="tag">{b.format || '—'}</span></td>
                    <td className="nowrap">{bytes(b.size)}</td>
                    <td className="nowrap">{fmtDate(b.ctime)}</td>
                    <td className="text-dim" style={{ fontSize: 12, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {b.notes || '—'}
                    </td>
                    <td className="text-right nowrap">
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: 5 }}>
                        <button className="btn btn-sm btn-success" onClick={() => setRestoring(b)}>⟲ Restore</button>
                        <button className="btn btn-sm btn-danger" onClick={() => remove(b)}>🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!loading && backups.length === 0 && (
                  <tr><td colSpan={7}><div className="empty"><div className="empty-icon">💿</div>No backups in this storage</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {restoring && (
        <RestoreDialog backup={restoring} nodes={nodes} defaultNode={activeNode}
          onClose={() => setRestoring(null)} onDone={() => refresh()} />
      )}
      {showBackupNow && (
        <BackupNowDialog nodes={nodes} storages={storages} defaultStorage={activeStorage}
          onClose={() => setShowBackupNow(false)} onDone={() => refresh()} />
      )}
    </div>
  );
}

function RestoreDialog({
  backup, nodes, defaultNode, onClose, onDone,
}: {
  backup: BackupFile; nodes: string[]; defaultNode: string;
  onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [node, setNode] = useState(defaultNode);
  const [vmid, setVmid] = useState(String(backup.vmid || ''));
  const [force, setForce] = useState(false);
  const [busy, setBusy] = useState(false);

  // Detect guest type from the backup volid (vzdump-qemu-… / vzdump-lxc-…)
  const isLxc = backup.volid.includes('lxc') || backup.subtype === 'lxc';
  const guestType = isLxc ? 'lxc' : 'qemu';

  async function restore() {
    if (!vmid || !/^\d+$/.test(vmid)) return toast.error('Enter a valid numeric VMID');
    if (!window.confirm(`Restore ${guestType.toUpperCase()} to VMID ${vmid} on ${node}? ${force ? 'This will OVERWRITE the existing guest.' : ''}`)) return;
    setBusy(true);
    try {
      const params: Record<string, any> = {
        vmid: Number(vmid),
        archive: backup.volid,
        force: force ? 1 : 0,
      };
      // qemu uses /nodes/{node}/qemu with archive; lxc uses /nodes/{node}/lxc with ostemplate=archive
      let res;
      if (guestType === 'qemu') {
        res = await apiPost(`/nodes/${node}/qemu`, params);
      } else {
        res = await apiPost(`/nodes/${node}/lxc`, { vmid: Number(vmid), ostemplate: backup.volid, force: force ? 1 : 0, restore: 1 });
      }
      if (res.ok) { toast.success(`Restore to VMID ${vmid} started`, 'Task started'); onDone(); onClose(); }
      else toast.error(res.error || 'Restore failed');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Restore Backup" onClose={onClose} width={460}
      footer={<>
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={restore}>
          {busy ? <span className="spinner" /> : '⟲ Restore'}
        </button>
      </>}>
      <Field label="Backup Archive">
        <input value={backup.volid} disabled style={{ fontSize: 11.5 }} />
      </Field>
      <Field label="Guest Type"><input value={guestType.toUpperCase()} disabled /></Field>
      <Field label="Target Node">
        <Select value={node} onChange={setNode} options={nodes.map((n) => ({ value: n, label: n }))} />
      </Field>
      <Field label="New VMID" hint="The ID to restore into. Use a free ID to avoid overwriting.">
        <input value={vmid} onChange={(e) => setVmid(e.target.value)} placeholder="e.g. 200" />
      </Field>
      <div className="checkbox-row" style={{ marginTop: 8 }}>
        <input id="force" type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
        <label htmlFor="force" style={{ color: force ? 'var(--red)' : undefined }}>
          Force — overwrite existing guest with this VMID
        </label>
      </div>
    </Modal>
  );
}

function BackupNowDialog({
  nodes, storages, defaultStorage, onClose, onDone,
}: {
  nodes: string[]; storages: StorageRef[]; defaultStorage: string;
  onClose: () => void; onDone: () => void;
}) {
  const toast = useToast();
  const [node, setNode] = useState(nodes[0] || '');
  const [vmid, setVmid] = useState('');
  const [storage, setStorage] = useState(defaultStorage);
  const [mode, setMode] = useState('snapshot');
  const [compress, setCompress] = useState('zstd');
  const [busy, setBusy] = useState(false);

  const [guests, setGuests] = useState<{ vmid: number; name: string; type: string; node: string }[]>([]);
  useEffect(() => {
    apiGet<ClusterResource[]>('/cluster/resources', { type: 'vm' })
      .then((r) => setGuests((r || []).filter((g) => !g.template).map((g) => ({
        vmid: g.vmid as number, name: (g.name as string) || '', type: g.type, node: g.node as string,
      })).sort((a, b) => a.vmid - b.vmid)))
      .catch(() => {});
  }, []);

  async function run() {
    if (!vmid) return toast.error('Select a guest to back up');
    setBusy(true);
    try {
      const g = guests.find((x) => String(x.vmid) === vmid);
      const targetNode = g?.node || node;
      const res = await apiPost(`/nodes/${targetNode}/vzdump`, {
        vmid: Number(vmid), storage, mode, compress, remove: 0,
      });
      if (res.ok) { toast.success(`Backup of ${vmid} started`, 'Task started'); onDone(); onClose(); }
      else toast.error(res.error || 'Backup failed');
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Create Backup" onClose={onClose} width={460}
      footer={<>
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={run}>
          {busy ? <span className="spinner" /> : '💾 Start Backup'}
        </button>
      </>}>
      <Field label="Guest">
        <Select value={vmid} onChange={setVmid}
          options={[{ value: '', label: '— select —' }, ...guests.map((g) => ({
            value: String(g.vmid), label: `${g.vmid} · ${g.name} (${g.type === 'qemu' ? 'VM' : 'CT'})`,
          }))]} />
      </Field>
      <Field label="Storage">
        <Select value={storage} onChange={setStorage}
          options={storages.map((s) => ({ value: s.storage, label: s.storage }))} />
      </Field>
      <div className="field-row">
        <Field label="Mode">
          <Select value={mode} onChange={setMode} options={[
            { value: 'snapshot', label: 'Snapshot' },
            { value: 'suspend', label: 'Suspend' },
            { value: 'stop', label: 'Stop' },
          ]} />
        </Field>
        <Field label="Compression">
          <Select value={compress} onChange={setCompress} options={[
            { value: 'zstd', label: 'ZSTD (fast)' },
            { value: 'gzip', label: 'GZIP' },
            { value: 'lzo', label: 'LZO' },
            { value: '0', label: 'None' },
          ]} />
        </Field>
      </div>
    </Modal>
  );
}
