import { useState } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiDel } from '../utils/api';
import { useToast } from '../components/Toast';
import { ResourceBar } from '../components/widgets';
import { bytes, fmtDate } from '../utils/format';
import type { ClusterResource } from '@shared/types';

type ContentKind = 'iso' | 'vztmpl' | 'backup' | 'images';

interface StorageItem {
  volid: string;
  content: string;
  size?: number;
  ctime?: number;
  format?: string;
  vmid?: number;
}

const TABS: { key: ContentKind; label: string }[] = [
  { key: 'iso', label: 'ISOs' },
  { key: 'vztmpl', label: 'CT Templates' },
  { key: 'backup', label: 'Backups' },
  { key: 'images', label: 'Images' },
];

function contentOf(s: ClusterResource): string {
  return String((s as any).content || '');
}

function supports(kind: ContentKind, s: ClusterResource): boolean {
  const c = contentOf(s);
  if (kind === 'images') return c.includes('images') || c.includes('rootdir');
  return c.includes(kind);
}

export function Storage() {
  const toast = useToast();
  const [selected, setSelected] = useState<{ node: string; storage: string } | null>(null);

  const { data, loading, error, refresh } = usePolling(
    async () => {
      const res = await window.pmx.pve.clusterResources('storage');
      if (!res.ok) throw new Error(res.error || 'Failed to load storage');
      return (res.data?.data || []) as ClusterResource[];
    },
    8000
  );

  const stores = (data || []).filter((s) => s.type === 'storage');

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading storage…</div>;
  }

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
            <div
              className="card clickable"
              key={s.id}
              onClick={() => setSelected({ node: s.node || '', storage: s.storage || '' })}
            >
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
                  <dt>Type</dt><dd>{(s as any).plugintype || contentOf(s) || '—'}</dd>
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

      {selected && (
        <StorageBrowser
          store={stores.find((s) => s.node === selected.node && s.storage === selected.storage)!}
          onClose={() => setSelected(null)}
          onDeleted={() => refresh(true)}
        />
      )}
    </div>
  );
}

function StorageBrowser({
  store,
  onClose,
  onDeleted,
}: {
  store: ClusterResource;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<ContentKind>(() => {
    const c = contentOf(store);
    if (c.includes('iso')) return 'iso';
    if (c.includes('vztmpl')) return 'vztmpl';
    if (c.includes('backup')) return 'backup';
    return 'images';
  });
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState('');

  const node = store.node || '';
  const storage = store.storage || '';

  const { data, loading, error, refresh } = usePolling<StorageItem[]>(
    async () => {
      const res = await apiGet<StorageItem[]>(`/nodes/${node}/storage/${storage}/content`, { content: tab });
      return (res || []).sort((a, b) => {
        if (tab === 'backup' && a.ctime && b.ctime) return b.ctime - a.ctime;
        return String(a.volid).localeCompare(String(b.volid));
      });
    },
    0,
    [node, storage, tab]
  );

  async function remove(item: StorageItem) {
    if (!window.confirm(`Delete ${item.volid}? This cannot be undone.`)) return;
    const res = await apiDel(`/nodes/${node}/storage/${storage}/content/${encodeURIComponent(item.volid)}`);
    if (res.ok) {
      toast.success(`${item.volid.split('/').pop()} deleted`);
      setTimeout(() => { refresh(); onDeleted(); }, 600);
    } else {
      toast.error(res.error || 'Failed to delete volume');
    }
  }

  async function upload() {
    const filters = tab === 'iso'
      ? [{ name: 'ISO images', extensions: ['iso'] }, { name: 'All files', extensions: ['*'] }]
      : tab === 'vztmpl'
      ? [{ name: 'Container templates', extensions: ['tar', 'tar.gz', 'tar.xz', 'xz', 'gz'] }, { name: 'All files', extensions: ['*'] }]
      : [{ name: 'All files', extensions: ['*'] }];

    const picked = await window.pmx.selectFile({
      title: `Upload ${TABS.find((t) => t.key === tab)?.label}`,
      filters,
    });
    if (!picked.ok || !picked.path) return;

    toast.info(`Uploading ${picked.path.split(/[\\/]/).pop()}…`);
    const res = await window.pmx.pve.storageUpload(node, storage, picked.path, tab);
    if (res.ok) {
      toast.success('Upload complete');
      setTimeout(() => { refresh(); onDeleted(); }, 600);
    } else {
      toast.error(res.error || 'Upload failed');
    }
  }

  async function startDownload() {
    if (!downloadUrl.trim()) return;
    setDownloadOpen(false);
    toast.info('Starting download on node…');
    const res = await window.pmx.pve.storageDownloadUrl(node, storage, downloadUrl.trim(), tab);
    if (res.ok) {
      const task = res.data?.data?.task || res.data?.task;
      toast.success(task ? `Download started (${String(task).slice(0, 40)}…)` : 'Download started');
      setDownloadUrl('');
    } else {
      toast.error(res.error || 'Download failed');
    }
  }

  const items = data || [];
  const canUpload = tab === 'iso' || tab === 'vztmpl';

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: 840 }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>💾 {storage} content <span className="text-dim" style={{ fontSize: 12, fontWeight: 400 }}>({node})</span></h3>
          <div style={{ flex: 1 }} />
          <button className="btn btn-icon btn-sm" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Tabs */}
          <div className="flex" style={{ gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
            {TABS.map((t) => {
              const disabled = !supports(t.key, store);
              return (
                <button
                  key={t.key}
                  disabled={disabled}
                  onClick={() => setTab(t.key)}
                  style={{
                    padding: '8px 14px', fontSize: 13, fontWeight: 500,
                    color: tab === t.key ? 'var(--text)' : disabled ? 'var(--text-faint)' : 'var(--text-dim)',
                    borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
                    marginBottom: -1,
                    opacity: disabled ? 0.5 : 1,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                  }}
                >
                  {t.label}
                </button>
              );
            })}
          </div>

          <div className="toolbar" style={{ marginBottom: 12 }}>
            {canUpload && (
              <button className="btn btn-sm btn-primary" onClick={upload}>⬆ Upload</button>
            )}
            <button className="btn btn-sm" onClick={() => setDownloadOpen(true)}>⬇ Download to node</button>
            <div style={{ flex: 1 }} />
            <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
          </div>

          {error && <div className="error-banner">{error}</div>}

          <div className="table-wrap">
            <table>
              <thead>
                {tab === 'backup' ? (
                  <tr><th>VMID</th><th>Volume</th><th>Format</th><th>Size</th><th>Created</th><th className="text-right">Actions</th></tr>
                ) : (
                  <tr><th>Name</th><th>Size</th><th className="text-right">Actions</th></tr>
                )}
              </thead>
              <tbody>
                {loading && !data ? (
                  <tr><td colSpan={tab === 'backup' ? 6 : 3}><div className="loading-center"><span className="spinner" /> Loading…</div></td></tr>
                ) : items.map((item) => {
                  const name = item.volid.split('/').pop() || item.volid;
                  return (
                    <tr key={item.volid}>
                      {tab === 'backup' ? (
                        <>
                          <td style={{ fontWeight: 600 }}>{item.vmid || '—'}</td>
                          <td className="mono" style={{ fontSize: 12, wordBreak: 'break-all', maxWidth: 340 }}>{name}</td>
                          <td><span className="tag">{item.format || '—'}</span></td>
                          <td className="nowrap">{bytes(item.size)}</td>
                          <td className="nowrap">{fmtDate(item.ctime)}</td>
                        </>
                      ) : (
                        <>
                          <td className="mono" style={{ fontSize: 12, wordBreak: 'break-all' }}>{name}</td>
                          <td className="nowrap">{bytes(item.size)}</td>
                        </>
                      )}
                      <td className="text-right nowrap">
                        <button className="btn btn-sm btn-danger" onClick={() => remove(item)}>🗑 Delete</button>
                      </td>
                    </tr>
                  );
                })}
                {!loading && items.length === 0 && (
                  <tr><td colSpan={tab === 'backup' ? 6 : 3}><div className="empty"><div className="empty-icon">📂</div>No {TABS.find((t) => t.key === tab)?.label.toLowerCase()} found</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-sm" onClick={onClose}>Close</button>
        </div>

        {downloadOpen && (
          <div className="modal-overlay" style={{ zIndex: 20 }} onMouseDown={() => setDownloadOpen(false)}>
            <div className="modal" style={{ maxWidth: 520 }} onMouseDown={(e) => e.stopPropagation()}>
              <div className="modal-head">
                <h3>⬇ Download to node</h3>
                <div style={{ flex: 1 }} />
                <button className="btn btn-icon btn-sm" onClick={() => setDownloadOpen(false)}>✕</button>
              </div>
              <div className="modal-body">
                <div className="field">
                  <label>URL to download</label>
                  <input
                    type="text"
                    placeholder="https://example.com/image.iso"
                    value={downloadUrl}
                    onChange={(e) => setDownloadUrl(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="field">
                  <label>Content type</label>
                  <input type="text" value={tab.toUpperCase()} disabled />
                </div>
                <p className="text-dim" style={{ fontSize: 12, marginTop: 8 }}>
                  Proxmox will download the file directly to <strong>{storage}</strong> on <strong>{node}</strong>.
                </p>
              </div>
              <div className="modal-foot">
                <button className="btn" onClick={() => setDownloadOpen(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!downloadUrl.trim()} onClick={startDownload}>Start download</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
