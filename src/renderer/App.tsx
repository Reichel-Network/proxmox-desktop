import { useState, useEffect, useCallback } from 'react';
import { ToastProvider } from './components/Toast';
import { ConnectScreen } from './views/ConnectScreen';
import { Dashboard } from './views/Dashboard';
import { Nodes } from './views/Nodes';
import { Guests } from './views/Guests';
import { Storage } from './views/Storage';
import { Tasks } from './views/Tasks';
import { Backups } from './views/Backups';
import { ClusterHealth } from './views/ClusterHealth';
import { Network } from './views/Network';
import { HelperScripts } from './views/HelperScripts';
import { Settings } from './views/Settings';
import { CommandPalette } from './views/CommandPalette';
import { GuestDetail } from './views/GuestDetail';
import { useClusterMonitor } from './utils/useClusterMonitor';
import type { ConnectionProfile, AppSettings, ClusterResource, PveGuest, GuestAction } from '@shared/types';

type View =
  | 'dashboard' | 'nodes' | 'qemu' | 'lxc' | 'storage'
  | 'backups' | 'tasks' | 'cluster' | 'network' | 'scripts' | 'settings';

const NAV: { key: View; label: string; icon: string; group?: string }[] = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'nodes', label: 'Nodes', icon: '🖥️' },
  { key: 'qemu', label: 'Virtual Machines', icon: '💻' },
  { key: 'lxc', label: 'Containers', icon: '📦' },
  { key: 'storage', label: 'Storage', icon: '💾' },
  { key: 'backups', label: 'Backups', icon: '💿' },
  { key: 'cluster', label: 'Cluster Health', icon: '🖧' },
  { key: 'network', label: 'Network & Firewall', icon: '🌐' },
  { key: 'scripts', label: 'Helper Scripts', icon: '🧩' },
  { key: 'tasks', label: 'Tasks', icon: '📋' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

const TITLES: Record<View, string> = {
  dashboard: 'Dashboard',
  nodes: 'Nodes',
  qemu: 'Virtual Machines',
  lxc: 'LXC Containers',
  storage: 'Storage',
  backups: 'Backups',
  tasks: 'Task Log',
  cluster: 'Cluster Health',
  network: 'Network & Firewall',
  scripts: 'Helper Scripts',
  settings: 'Settings',
};

function Shell({
  profile,
  settings,
  onSettingsChange,
  onDisconnect,
}: {
  profile: ConnectionProfile;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  onDisconnect: () => void;
}) {
  const [view, setView] = useState<View>('dashboard');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteGuest, setPaletteGuest] = useState<PveGuest | null>(null);
  const [consolePanelW, setConsolePanelW] = useState(0);

  useClusterMonitor(true);

  // Listen for main-process console panel layout updates.
  useEffect(() => {
    const unsub = window.pmx.pve.onConsoleLayout((p) => setConsolePanelW(p.panelW));
    return unsub;
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      } else if (e.key === 'Escape') {
        setPaletteOpen(false);
      } else if ((e.ctrlKey || e.metaKey) && e.key >= '1' && e.key <= '9') {
        const idx = parseInt(e.key) - 1;
        if (NAV[idx]) { e.preventDefault(); setView(NAV[idx].key); }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const openGuestFromResource = useCallback((r: ClusterResource) => {
    setPaletteGuest({
      vmid: r.vmid as number,
      name: r.name as string,
      node: r.node as string,
      type: r.type as 'qemu' | 'lxc',
      status: r.status as string,
      maxcpu: r.maxcpu,
      maxmem: r.maxmem,
    });
  }, []);

  async function guestAction(g: PveGuest, action: GuestAction) {
    await window.pmx.pve.guestAction(g.node, g.type, g.vmid, action);
  }

  async function closeEmbeddedConsole() {
    await window.pmx.pve.embeddedConsoleClose();
    setConsolePanelW(0);
  }

  return (
    <div className="app-shell">
      <div className="sidebar">
        <div className="sidebar-header">
          <div className="sidebar-logo">P</div>
          <div style={{ overflow: 'hidden' }}>
            <div className="sidebar-title">Proxmox Desktop</div>
            <div className="sidebar-host" style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
              {profile.name}
            </div>
          </div>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((n) => (
            <button
              key={n.key}
              className={`nav-item ${view === n.key ? 'active' : ''}`}
              onClick={() => setView(n.key)}
            >
              <span className="nav-icon">{n.icon}</span>
              {n.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
            onClick={() => setPaletteOpen(true)}>
            🔍 Search <span style={{ color: 'var(--text-faint)', fontSize: 11 }}>Ctrl+K</span>
          </button>
          {consolePanelW > 0 && (
            <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginBottom: 8 }}
              onClick={closeEmbeddedConsole}>
              ✕ Close embedded console
            </button>
          )}
          <div style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 8, padding: '0 4px' }}>
            {profile.host}:{profile.port}
            <br />
            {profile.authMethod === 'token' ? `🔑 ${profile.tokenId}` : `👤 ${profile.username}`}
          </div>
          <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center' }} onClick={onDisconnect}>
            ⎋ Disconnect
          </button>
        </div>
      </div>

      <div className="main" style={{ marginRight: consolePanelW }}>
        <div className="topbar">
          <h1>{TITLES[view]}</h1>
          <div className="topbar-spacer" />
          <span className="badge badge-running">
            <span className="dot dot-online" /> Connected
          </span>
        </div>
        <div className="content">
          {view === 'dashboard' && <Dashboard />}
          {view === 'nodes' && <Nodes />}
          {view === 'qemu' && <Guests kind="qemu" key="qemu" />}
          {view === 'lxc' && <Guests kind="lxc" key="lxc" />}
          {view === 'storage' && <Storage />}
          {view === 'backups' && <Backups />}
          {view === 'cluster' && <ClusterHealth />}
          {view === 'network' && <Network />}
          {view === 'scripts' && <HelperScripts />}
          {view === 'tasks' && <Tasks />}
          {view === 'settings' && (
            <Settings profile={profile} settings={settings} onSettingsChange={onSettingsChange} />
          )}
        </div>
      </div>

      {consolePanelW > 0 && (
        <div
          id="embedded-console-anchor"
          style={{
            position: 'absolute',
            right: 0,
            top: 64,
            width: consolePanelW,
            height: 'calc(100% - 64px)',
            pointerEvents: 'none',
            opacity: 0,
          }}
        />
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(key) => setView(key as View)}
        onOpenGuest={openGuestFromResource}
      />

      {paletteGuest && (
        <GuestDetail guest={paletteGuest} onClose={() => setPaletteGuest(null)} onAction={guestAction} />
      )}
    </div>
  );
}

export function App() {
  const [profile, setProfile] = useState<ConnectionProfile | null>(null);
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark', confirmDestructive: true, autoCheckUpdates: true,
  });

  useEffect(() => {
    window.pmx.settings.get().then(setSettings);
  }, []);

  // Apply theme to <html data-theme>
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme);
  }, [settings.theme]);

  async function disconnect() {
    await window.pmx.session.disconnect();
    setProfile(null);
  }

  return (
    <ToastProvider>
      {profile ? (
        <Shell
          profile={profile}
          settings={settings}
          onSettingsChange={setSettings}
          onDisconnect={disconnect}
        />
      ) : (
        <ConnectScreen onConnected={setProfile} />
      )}
    </ToastProvider>
  );
}
