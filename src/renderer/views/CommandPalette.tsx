import { useState, useEffect, useRef } from 'react';
import { apiGet } from '../utils/api';
import type { ClusterResource } from '@shared/types';

export interface SearchTarget {
  id: string;
  label: string;
  sublabel: string;
  icon: string;
  kind: 'qemu' | 'lxc' | 'node' | 'storage' | 'nav';
  resource?: ClusterResource;
  navKey?: string;
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
  const [query, setQuery] = useState('');
  const [resources, setResources] = useState<ClusterResource[]>([]);
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      apiGet<ClusterResource[]>('/cluster/resources').then(setResources).catch(() => {});
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  if (!open) return null;

  const navItems: SearchTarget[] = [
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
  ];

  const guestTargets: SearchTarget[] = resources
    .filter((r) => r.type === 'qemu' || r.type === 'lxc' || r.type === 'node')
    .map((r) => ({
      id: r.id,
      label: r.type === 'node' ? (r.node as string) : `${r.vmid} · ${r.name || ''}`,
      sublabel: r.type === 'node' ? 'Node' : `${r.type === 'qemu' ? 'VM' : 'CT'} on ${r.node} · ${r.status}`,
      icon: r.type === 'node' ? '🖥️' : r.type === 'qemu' ? '💻' : '📦',
      kind: r.type as any,
      resource: r,
    }));

  const all = [...navItems, ...guestTargets];
  const q = query.toLowerCase().trim();
  const filtered = q
    ? all.filter((t) => t.label.toLowerCase().includes(q) || t.sublabel.toLowerCase().includes(q))
    : all;
  const clamped = Math.min(sel, Math.max(0, filtered.length - 1));

  function choose(t: SearchTarget) {
    if (t.kind === 'nav' && t.navKey) onNavigate(t.navKey);
    else if (t.kind === 'qemu' || t.kind === 'lxc') {
      if (t.resource) onOpenGuest(t.resource);
    } else if (t.kind === 'node') {
      onNavigate('nodes');
    }
    onClose();
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[clamped]) choose(filtered[clamped]); }
  }

  return (
    <div className="modal-overlay" style={{ alignItems: 'flex-start', paddingTop: '12vh' }} onMouseDown={onClose}>
      <div className="modal" style={{ maxWidth: 580 }} onMouseDown={(e) => e.stopPropagation()}>
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
        <div style={{ maxHeight: 380, overflowY: 'auto', padding: 6 }}>
          {filtered.length === 0 && (
            <div className="empty" style={{ padding: 30 }}>No matches</div>
          )}
          {filtered.slice(0, 50).map((t, i) => (
            <button
              key={t.id}
              className="nav-item"
              style={{
                width: '100%',
                background: i === clamped ? 'var(--bg-elev-2)' : 'transparent',
                boxShadow: i === clamped ? 'inset 2px 0 0 var(--accent)' : 'none',
              }}
              onMouseEnter={() => setSel(i)}
              onClick={() => choose(t)}
            >
              <span className="nav-icon">{t.icon}</span>
              <span style={{ flex: 1, textAlign: 'left' }}>
                <span style={{ color: 'var(--text)' }}>{t.label}</span>
                <span style={{ fontSize: 11.5, color: 'var(--text-faint)', marginLeft: 8 }}>{t.sublabel}</span>
              </span>
            </button>
          ))}
        </div>
        <div style={{ padding: '8px 14px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-faint)' }}>
          ↑↓ navigate · ↵ select · esc close
        </div>
      </div>
    </div>
  );
}
