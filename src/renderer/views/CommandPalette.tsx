import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { apiGet } from '../utils/api';
import { useToast } from '../components/Toast';
import { StatusBadge } from '../components/widgets';
import type { ClusterResource, GuestAction } from '@shared/types';

export interface SearchTarget {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  kind: 'qemu' | 'lxc' | 'node' | 'storage' | 'nav' | 'action';
  resource?: ClusterResource;
  navKey?: string;
  action?: GuestAction;
  /** For action items, the parent guest resource this action applies to. */
  guest?: ClusterResource;
}

const ACTION_LABEL: Record<GuestAction, string> = {
  start: 'Start',
  stop: 'Stop',
  shutdown: 'Shutdown',
  reboot: 'Reboot',
  suspend: 'Suspend',
  resume: 'Resume',
};

const ACTION_ICON: Record<GuestAction, string> = {
  start: '▶',
  stop: '⏹',
  shutdown: '⏻',
  reboot: '⟳',
  suspend: '⏸',
  resume: '⏵',
};

function running(r?: ClusterResource) {
  return (r?.status || '').toLowerCase() === 'running';
}

function availableActions(r?: ClusterResource): GuestAction[] {
  if (!r || (r.type !== 'qemu' && r.type !== 'lxc')) return [];
  const isRunning = running(r);
  if (isRunning) return ['shutdown', 'reboot', 'stop', 'suspend'];
  return ['start', 'resume'];
}

export function CommandPalette({
  open,
  onClose,
  onNavigate,
  onOpenGuest,
}: {
  open: boolean;
  onClose: () => void;
  onNavigate: (key: string) => void;
  onOpenGuest: (r: ClusterResource) => void;
}) {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<ClusterResource[]>([]);
  const [sel, setSel] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      setBusyId(null);
      apiGet<ClusterResource[]>('/cluster/resources').then(setResources).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navItems: SearchTarget[] = useMemo(
    () => [
      { id: 'nav:dashboard', label: 'Dashboard', sublabel: 'Go to', icon: '📊', kind: 'nav', navKey: 'dashboard' },
      { id: 'nav:nodes', label: 'Nodes', sublabel: 'Go to', icon: '🖥️', kind: 'nav', navKey: 'nodes' },
      { id: 'nav:qemu', label: 'Virtual Machines', sublabel: 'Go to', icon: '💻', kind: 'nav', navKey: 'qemu' },
      { id: 'nav:lxc', label: 'Containers', sublabel: 'Go to', icon: '📦', kind: 'nav', navKey: 'lxc' },
      { id: 'nav:storage', label: 'Storage', sublabel: 'Go to', icon: '💾', kind: 'nav', navKey: 'storage' },
      { id: 'nav:backups', label: 'Backups', sublabel: 'Go to', icon: '💿', kind: 'nav', navKey: 'backups' },
      { id: 'nav:tasks', label: 'Tasks', sublabel: 'Go to', icon: '📋', kind: 'nav', navKey: 'tasks' },
      { id: 'nav:cluster', label: 'Cluster Health', sublabel: 'Go to', icon: '🖧', kind: 'nav', navKey: 'cluster' },
      { id: 'nav:network', label: 'Network & Firewall', sublabel: 'Go to', icon: '🌐', kind: 'nav', navKey: 'network' },
      { id: 'nav:settings', label: 'Settings', sublabel: 'Go to', icon: '⚙️', kind: 'nav', navKey: 'settings' },
    ],
    []
  );

  const guestTargets: SearchTarget[] = useMemo(() => {
    return resources
      .filter((r) => r.type === 'qemu' || r.type === 'lxc' || r.type === 'node')
      .map((r) => ({
        id: r.id,
        label: r.type === 'node' ? (r.node as string) : `${r.vmid} · ${r.name || ''}`,
        sublabel: r.type === 'node' ? 'Node' : `${r.type === 'qemu' ? 'VM' : 'CT'} on ${r.node}`,
        icon: r.type === 'node' ? '🖥️' : r.type === 'qemu' ? '💻' : '📦',
        kind: r.type as 'qemu' | 'lxc' | 'node',
        resource: r,
      }));
  }, [resources]);

  const actionTargets: SearchTarget[] = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase().trim();
    const out: SearchTarget[] = [];
    for (const r of resources) {
      if (r.type !== 'qemu' && r.type !== 'lxc') continue;
      const label = `${r.vmid} · ${r.name || ''}`;
      if (!label.toLowerCase().includes(q) && !(r.vmid?.toString() || '').includes(q)) continue;
      for (const action of availableActions(r)) {
        out.push({
          id: `action:${r.id}:${action}`,
          label: `${ACTION_LABEL[action]} ${r.type === 'qemu' ? 'VM' : 'CT'} ${r.vmid}`,
          sublabel: r.name ? r.name : `${r.type.toUpperCase()} on ${r.node}`,
          icon: ACTION_ICON[action],
          kind: 'action',
          action,
          guest: r,
        });
      }
    }
    return out;
  }, [resources, query]);

  const all = useMemo(
    () => [...navItems, ...guestTargets, ...actionTargets],
    [navItems, guestTargets, actionTargets]
  );

  const q = query.toLowerCase().trim();
  const filtered = useMemo(() => {
    if (!q) return all;
    return all.filter(
      (t) => t.label.toLowerCase().includes(q) || t.sublabel.toLowerCase().includes(q)
    );
  }, [all, q]);

  const clamped = Math.min(sel, Math.max(0, filtered.length - 1));

  const executeAction = useCallback(
    async (r: ClusterResource, action: GuestAction) => {
      const id = `action:${r.id}:${action}`;
      if (busyId === id) return;

      if (action === 'stop' || action === 'shutdown' || action === 'reboot') {
        const ok = window.confirm(
          `Really ${ACTION_LABEL[action].toLowerCase()} ${r.type === 'qemu' ? 'VM' : 'CT'} ${r.vmid} (${r.name || ''})?`
        );
        if (!ok) return;
      }

      setBusyId(id);
      try {
        const res = await window.pmx.pve.guestAction(
          r.node as string,
          r.type as 'qemu' | 'lxc',
          r.vmid as number,
          action
        );
        if (res.ok) {
          toast.success(
            `${ACTION_LABEL[action]} issued for ${r.vmid}`,
            'Task started'
          );
        } else {
          toast.error(res.error || 'Action failed');
        }
      } catch (err: any) {
        toast.error(err?.message || 'Action failed');
      } finally {
        setBusyId(null);
      }
    },
    [busyId, toast]
  );

  function choose(t: SearchTarget, viaShiftEnter = false) {
    if (t.kind === 'nav' && t.navKey) {
      onNavigate(t.navKey);
      onClose();
    } else if (t.kind === 'action' && t.action && t.guest) {
      executeAction(t.guest, t.action);
      onClose();
    } else if (t.kind === 'qemu' || t.kind === 'lxc') {
      if (t.resource) {
        if (viaShiftEnter) {
          // Shift+Enter on a guest entry opens its actions inline by focusing the
          // first action item for this guest in the filtered list.
          const firstAction = filtered.find(
            (x) => x.kind === 'action' && x.guest?.id === t.resource?.id
          );
          if (firstAction) {
            const idx = filtered.indexOf(firstAction);
            setSel(idx);
            return;
          }
        }
        onOpenGuest(t.resource);
      }
      onClose();
    } else if (t.kind === 'node') {
      onNavigate('nodes');
      onClose();
    }
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filtered[clamped]) choose(filtered[clamped], e.shiftKey);
    }
  }

  if (!open) return null;

  const selectedItem = filtered[clamped];

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: 640 }} onMouseDown={(e) => e.stopPropagation()}>
        <div style={{ padding: 14, borderBottom: '1px solid var(--border)' }}>
          <input
            ref={inputRef}
            value={query}
            placeholder="Search VMs, containers, nodes, or jump to a page…"
            onChange={(e) => { setQuery(e.target.value); setSel(0); }}
            onKeyDown={onKey}
            style={{ fontSize: 15 }}
          />
        </div>
        <div style={{ maxHeight: 420, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: 30 }}>No matches</div>
          )}
          {filtered.slice(0, 50).map((t, i) => {
            const isGuest = t.kind === 'qemu' || t.kind === 'lxc';
            const isAction = t.kind === 'action';
            const isBusy = busyId === t.id;
            return (
              <button
                key={t.id}
                className="nav-item"
                style={{
                  width: '100%',
                  background: i === clamped ? 'var(--bg-elev-2)' : 'transparent',
                  boxShadow: i === clamped ? 'inset 2px 0 0 var(--accent)' : 'none',
                  paddingLeft: isAction ? 34 : undefined,
                }}
                onMouseEnter={() => setSel(i)}
                onClick={() => choose(t)}
              >
                <span className="nav-icon">{isBusy ? <span className="spinner" style={{ width: 14, height: 14 }} /> : t.icon}</span>
                <span style={{ flex: 1, textAlign: 'left' }}>
                  <span style={{ color: 'var(--text)' }}>{t.label}</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text-faint)', marginLeft: 8 }}>{t.sublabel}</span>
                  {isGuest && t.resource?.status && (
                    <span style={{ marginLeft: 8, verticalAlign: 'middle' }}>
                      <StatusBadge status={t.resource.status} />
                    </span>
                  )}
                </span>
                {isGuest && (
                  <span
                    className="badge badge-running"
                    style={{ fontSize: 11, padding: '2px 6px', opacity: 0.85 }}
                    title="Shift+Enter to show actions"
                  >
                    Shift+↵
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            padding: '8px 14px',
            borderTop: '1px solid var(--border)',
            fontSize: 11,
            color: 'var(--text-faint)',
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <span>↑↓ navigate · ↵ select · esc close</span>
          <span>Shift+Enter on a guest to jump to its actions</span>
          {selectedItem && (selectedItem.kind === 'qemu' || selectedItem.kind === 'lxc') && (
            <span style={{ marginLeft: 'auto' }}>
              {running(selectedItem.resource) ? '▶ running' : '● stopped'}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
