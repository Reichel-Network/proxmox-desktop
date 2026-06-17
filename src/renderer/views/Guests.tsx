import { useState, useMemo } from 'react';
import { usePolling } from '../utils/usePolling';
import { StatusBadge, ResourceBar } from '../components/widgets';
import { bytes, uptime } from '../utils/format';
import { useToast } from '../components/Toast';
import { GuestDetail } from './GuestDetail';
import { CreateGuestWizard } from './CreateGuestWizard';
import type { PveGuest, GuestAction, ClusterResource } from '@shared/types';

const ACTION_LABEL: Record<GuestAction, string> = {
  start: 'start',
  stop: 'stop',
  shutdown: 'shutdown',
  reboot: 'reboot',
  suspend: 'suspend',
  resume: 'resume',
};

export function Guests({ kind }: { kind: 'qemu' | 'lxc' }) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<PveGuest | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  const { data, loading, error, refresh } = usePolling(
    async () => {
      // Proxmox /cluster/resources only accepts type=vm|storage|node|sdn.
      // Both VMs and LXC come back under 'vm'; we discriminate qemu vs lxc
      // via each resource's own .type field in the filter below.
      const res = await window.pmx.pve.clusterResources('vm');
      if (!res.ok) throw new Error(res.error || 'Failed to load');
      return (res.data?.data || []) as ClusterResource[];
    },
    5000,
    [kind]
  );

  const guests: PveGuest[] = useMemo(() => {
    return (data || [])
      .filter((r) => r.type === kind)
      .map((r) => ({
        vmid: r.vmid as number,
        name: r.name,
        node: r.node as string,
        type: kind,
        status: r.status as string,
        cpu: r.cpu,
        maxcpu: r.maxcpu,
        cpus: (r as any).maxcpu,
        mem: r.mem,
        maxmem: r.maxmem,
        disk: r.disk,
        maxdisk: r.maxdisk,
        uptime: r.uptime,
        template: (r as any).template,
        tags: (r as any).tags,
        lock: (r as any).lock,
      }))
      .filter((g) => {
        if (!query) return true;
        const q = query.toLowerCase();
        return (
          String(g.vmid).includes(q) ||
          (g.name || '').toLowerCase().includes(q) ||
          (g.tags || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.vmid - b.vmid);
  }, [data, kind, query]);

  async function act(g: PveGuest, action: GuestAction) {
    // Guard rails on destructive actions
    if (action === 'stop' || action === 'shutdown' || action === 'reboot') {
      const ok = window.confirm(
        `Really ${ACTION_LABEL[action]} ${kind === 'qemu' ? 'VM' : 'CT'} ${g.vmid} (${g.name || ''})?`
      );
      if (!ok) return;
    }
    setBusyId(g.vmid);
    try {
      const res = await window.pmx.pve.guestAction(g.node, kind, g.vmid, action);
      if (res.ok) {
        toast.success(`${ACTION_LABEL[action]} issued for ${g.vmid}`, 'Task started');
        setTimeout(() => refresh(true), 1200);
      } else {
        toast.error(res.error || 'Action failed');
      }
    } finally {
      setBusyId(null);
    }
  }

  function togglePick(vmid: number) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(vmid)) next.delete(vmid); else next.add(vmid);
      return next;
    });
  }

  async function bulkAction(action: GuestAction) {
    const targets = guests.filter((g) => picked.has(g.vmid) && !g.template);
    if (targets.length === 0) return toast.error('No guests selected');
    if ((action === 'stop' || action === 'shutdown' || action === 'reboot') &&
        !window.confirm(`${ACTION_LABEL[action]} ${targets.length} selected guest(s)?`)) return;
    setBulkBusy(true);
    try {
      let ok = 0;
      for (const g of targets) {
        const res = await window.pmx.pve.guestAction(g.node, kind, g.vmid, action);
        if (res.ok) ok++;
      }
      toast.success(`${action} issued for ${ok}/${targets.length} guests`, 'Bulk action');
      setPicked(new Set());
      setTimeout(() => refresh(true), 1500);
    } finally {
      setBulkBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg" /> Loading…
      </div>
    );
  }

  const running = guests.filter((g) => g.status === 'running').length;

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          className="search-box"
          placeholder={`Search ${kind === 'qemu' ? 'VMs' : 'containers'}…`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-dim" style={{ fontSize: 13 }}>
          {guests.length} total · <span className="text-green">{running} running</span>
          {picked.size > 0 && <span> · {picked.size} selected</span>}
        </span>
        <div style={{ flex: 1 }} />
        {picked.size > 0 && (
          <div className="flex" style={{ gap: 5 }}>
            <button className="btn btn-sm btn-success" disabled={bulkBusy} onClick={() => bulkAction('start')}>▶ Start</button>
            <button className="btn btn-sm" disabled={bulkBusy} onClick={() => bulkAction('shutdown')}>⏻ Shutdown</button>
            <button className="btn btn-sm btn-danger" disabled={bulkBusy} onClick={() => bulkAction('stop')}>⏹ Stop</button>
            {bulkBusy && <span className="spinner" />}
          </div>
        )}
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setCreating(true)}>
          + Create {kind === 'qemu' ? 'VM' : 'CT'}
        </button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>VMID</th>
                <th>Name</th>
                <th>Status</th>
                <th>Node</th>
                <th>CPU</th>
                <th>Memory</th>
                <th>Uptime</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {guests.map((g) => {
                const isRunning = g.status === 'running';
                const busy = busyId === g.vmid;
                return (
                  <tr key={g.vmid} className="clickable" onClick={() => setSelected(g)}>
                    <td onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" style={{ width: 'auto' }}
                        checked={picked.has(g.vmid)} onChange={() => togglePick(g.vmid)} />
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {g.vmid}
                      {g.template ? <span className="tag" style={{ marginLeft: 6 }}>template</span> : null}
                    </td>
                    <td>
                      {g.name || <span className="text-dim">—</span>}
                      {g.tags
                        ? g.tags.split(/[;,]/).filter(Boolean).map((t) => (
                            <span key={t} className="tag">{t}</span>
                          ))
                        : null}
                      {g.lock ? <span className="tag" style={{ color: 'var(--yellow)' }}>🔒 {g.lock}</span> : null}
                    </td>
                    <td><StatusBadge status={g.status} /></td>
                    <td>{g.node}</td>
                    <td style={{ minWidth: 120 }}><ResourceBar frac={g.cpu || 0} /></td>
                    <td style={{ minWidth: 120 }}>
                      <ResourceBar frac={g.maxmem ? (g.mem || 0) / g.maxmem : 0} />
                      <div style={{ fontSize: 11, color: 'var(--text-faint)' }}>
                        {bytes(g.mem)} / {bytes(g.maxmem)}
                      </div>
                    </td>
                    <td className="nowrap">{uptime(g.uptime)}</td>
                    <td className="text-right nowrap" onClick={(e) => e.stopPropagation()}>
                      {busy ? (
                        <span className="spinner" />
                      ) : (
                        <div className="flex" style={{ justifyContent: 'flex-end', gap: 5 }}>
                          {!isRunning ? (
                            <button
                              className="btn btn-sm btn-success"
                              title="Start"
                              disabled={!!g.template}
                              onClick={() => act(g, 'start')}
                            >▶</button>
                          ) : (
                            <>
                              <button className="btn btn-sm" title="Shutdown" onClick={() => act(g, 'shutdown')}>⏻</button>
                              <button className="btn btn-sm" title="Reboot" onClick={() => act(g, 'reboot')}>⟳</button>
                              <button className="btn btn-sm btn-danger" title="Stop" onClick={() => act(g, 'stop')}>⏹</button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {guests.length === 0 && (
                <tr>
                  <td colSpan={9}>
                    <div className="empty">
                      <div className="empty-icon">{kind === 'qemu' ? '🖥️' : '📦'}</div>
                      <div>No {kind === 'qemu' ? 'virtual machines' : 'containers'} found</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <GuestDetail guest={selected} onClose={() => setSelected(null)} onAction={act} />
      )}
      {creating && (
        <CreateGuestWizard kind={kind} onClose={() => setCreating(false)} onDone={() => setTimeout(() => refresh(true), 2000)} />
      )}
    </div>
  );
}
