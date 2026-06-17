import { useState } from 'react';
import React from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPut } from '../utils/api';
import { useToast } from '../components/Toast';
import type { PveGuest } from '@shared/types';

// Keys we render as friendly editable fields; everything else shows read-only.
const QEMU_FIELDS = ['name', 'cores', 'sockets', 'memory', 'balloon', 'onboot', 'ostype', 'boot', 'agent'];
const LXC_FIELDS = ['hostname', 'cores', 'memory', 'swap', 'onboot', 'ostype'];

export function GuestConfig({ guest }: { guest: PveGuest }) {
  const toast = useToast();
  const base = `/nodes/${guest.node}/${guest.type}/${guest.vmid}/config`;
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data, loading, error, refresh } = usePolling<Record<string, any>>(
    async () => apiGet<Record<string, any>>(base),
    0,
    [guest.vmid]
  );

  const fields = guest.type === 'qemu' ? QEMU_FIELDS : LXC_FIELDS;
  const cfg = data || {};

  function setEdit(k: string, v: string) {
    setEdits((e) => ({ ...e, [k]: v }));
  }
  function val(k: string): string {
    return edits[k] !== undefined ? edits[k] : cfg[k] !== undefined ? String(cfg[k]) : '';
  }

  async function save() {
    const changed = Object.entries(edits).filter(([k, v]) => String(cfg[k] ?? '') !== v);
    if (changed.length === 0) return toast.info('No changes to save');
    setSaving(true);
    try {
      const params: Record<string, any> = {};
      for (const [k, v] of changed) params[k] = v;
      const res = await apiPut(base, params);
      if (res.ok) {
        toast.success('Configuration updated');
        setEdits({});
        setTimeout(() => refresh(), 800);
      } else toast.error(res.error || 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading config…</div>;
  }

  // Hardware lines: disks, networks, etc.
  const hwKeys = Object.keys(cfg)
    .filter((k) => /^(scsi|sata|ide|virtio|net|mp|rootfs|unused|efidisk|tpmstate)\d*$/.test(k))
    .sort();

  const dirty = Object.keys(edits).some((k) => String(cfg[k] ?? '') !== edits[k]);

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="grid grid-2">
        <div className="card">
          <div className="card-head">⚙️ General</div>
          <div className="card-body flex-col" style={{ gap: 12 }}>
            {fields.map((k) => (
              <div className="field" key={k} style={{ margin: 0 }}>
                <label style={{ textTransform: 'capitalize' }}>{k}</label>
                <input value={val(k)} onChange={(e) => setEdit(k, e.target.value)} />
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-head">🔌 Hardware</div>
          <div className="card-body">
            <dl className="detail-grid">
              {hwKeys.map((k) => (
                <React.Fragment key={k}>
                  <dt className="mono">{k}</dt>
                  <dd className="mono" style={{ wordBreak: 'break-all', fontSize: 11.5 }}>
                    {String(cfg[k])}
                  </dd>
                </React.Fragment>
              ))}
              {hwKeys.length === 0 && <dd className="text-dim">No hardware devices found</dd>}
            </dl>
          </div>
        </div>
      </div>

      <div className="flex mt" style={{ justifyContent: 'flex-end', gap: 8 }}>
        <button className="btn btn-sm" onClick={() => { setEdits({}); refresh(); }}>Reset</button>
        <button className="btn btn-sm btn-primary" disabled={!dirty || saving} onClick={save}>
          {saving ? <span className="spinner" /> : '💾 Save Changes'}
        </button>
      </div>

      <details className="mt">
        <summary style={{ cursor: 'pointer', color: 'var(--text-dim)', fontSize: 13 }}>
          Raw configuration ({Object.keys(cfg).length} keys)
        </summary>
        <div className="log-view mt">{JSON.stringify(cfg, null, 2)}</div>
      </details>
    </div>
  );
}
