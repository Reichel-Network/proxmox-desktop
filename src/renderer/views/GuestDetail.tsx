import { useState } from 'react';
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import { Modal } from '../components/Modal';
import { StatusBadge, ResourceBar } from '../components/widgets';
import { usePolling } from '../utils/usePolling';
import { bytes, uptime, pct, rate } from '../utils/format';
import { useToast } from '../components/Toast';
import { Snapshots } from './Snapshots';
import { GuestConfig } from './GuestConfig';
import { GuestNotes } from './GuestNotes';
import { MigrateDialog } from './MigrateDialog';
import type { PveGuest, GuestAction, RrdPoint } from '@shared/types';

const TIMEFRAMES = [
  { key: 'hour', label: '1H' },
  { key: 'day', label: '24H' },
  { key: 'week', label: '7D' },
  { key: 'month', label: '30D' },
];

type Tab = 'overview' | 'snapshots' | 'config' | 'notes';

function chartTime(t: number, tf: string): string {
  const d = new Date(t * 1000);
  if (tf === 'hour' || tf === 'day')
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

const tooltipStyle = {
  background: '#1d2130',
  border: '1px solid #323849',
  borderRadius: 6,
  fontSize: 12,
};

export function GuestDetail({
  guest,
  onClose,
  onAction,
}: {
  guest: PveGuest;
  onClose: () => void;
  onAction: (g: PveGuest, a: GuestAction) => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('overview');
  const [tf, setTf] = useState('hour');
  const [busy, setBusy] = useState(false);
  const [migrating, setMigrating] = useState(false);

  const { data: status } = usePolling(
    async () => {
      const res = await window.pmx.pve.get(
        `/nodes/${guest.node}/${guest.type}/${guest.vmid}/status/current`
      );
      if (!res.ok) throw new Error(res.error);
      return res.data?.data;
    },
    tab === 'overview' ? 4000 : 0,
    [guest.vmid, tab]
  );

  const { data: rrd } = usePolling<RrdPoint[]>(
    async () => {
      const res = await window.pmx.pve.rrd(guest.node, guest.type, guest.vmid, tf);
      if (!res.ok) throw new Error(res.error);
      return (res.data?.data || []) as RrdPoint[];
    },
    tab === 'overview' ? (tf === 'hour' ? 10000 : 60000) : 0,
    [guest.vmid, tf, tab]
  );

  const cur = status || guest;
  const running = cur.status === 'running';

  const cpuData = (rrd || []).map((p) => ({ t: chartTime(p.time, tf), cpu: (p.cpu || 0) * 100 }));
  const memData = (rrd || []).map((p) => ({
    t: chartTime(p.time, tf),
    used: (p.mem || 0) / 1024 / 1024,
  }));
  const netData = (rrd || []).map((p) => ({
    t: chartTime(p.time, tf),
    in: (p.netin || 0) / 1024,
    out: (p.netout || 0) / 1024,
  }));
  const diskData = (rrd || []).map((p) => ({
    t: chartTime(p.time, tf),
    read: (p.diskread || 0) / 1024,
    write: (p.diskwrite || 0) / 1024,
  }));

  async function doAction(a: GuestAction) {
    setBusy(true);
    try {
      await onAction({ ...guest, status: cur.status }, a);
    } finally {
      setTimeout(() => setBusy(false), 800);
    }
  }

  async function openConsole() {
    const res = await window.pmx.pve.consoleWindow(guest.node, guest.type, guest.vmid, guest.name || String(guest.vmid));
    if (res.ok) toast.info('Opening console window…');
    else toast.error(res.error || 'Failed to open console');
  }

  async function openEmbeddedConsole() {
    const res = await window.pmx.pve.embeddedConsoleOpen(
      `${guest.node}/${guest.type}/${guest.vmid}`,
      guest.node,
      guest.type,
      guest.vmid,
      guest.name || String(guest.vmid)
    );
    if (res.ok) {
      // Notify main process of the anchor bounds so the BrowserView aligns precisely.
      const anchor = document.getElementById('embedded-console-anchor');
      if (anchor) {
        const r = anchor.getBoundingClientRect();
        await window.pmx.pve.embeddedConsoleBounds({ x: r.x, y: r.y, width: r.width, height: r.height });
      }
      toast.info('Console docked to the right side');
    } else {
      toast.error(res.error || 'Failed to open embedded console');
    }
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'snapshots', label: '📸 Snapshots' },
    { key: 'config', label: '⚙️ Config' },
    { key: 'notes', label: '📝 Notes & Tags' },
  ];

  return (
    <Modal
      title={`${guest.type === 'qemu' ? 'VM' : 'CT'} ${guest.vmid} · ${guest.name || ''}`}
      onClose={onClose}
      width={860}
    >
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 14 }}>
        <StatusBadge status={cur.status} />
        <div className="flex" style={{ gap: 7, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {!running ? (
            <button className="btn btn-sm btn-success" disabled={busy} onClick={() => doAction('start')}>▶ Start</button>
          ) : (
            <>
              <button className="btn btn-sm" disabled={busy} onClick={() => doAction('shutdown')}>⏻ Shutdown</button>
              <button className="btn btn-sm" disabled={busy} onClick={() => doAction('reboot')}>⟳ Reboot</button>
              <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => doAction('stop')}>⏹ Stop</button>
            </>
          )}
          <button className="btn btn-sm" onClick={() => setMigrating(true)}>➡ Migrate</button>
          <button className="btn btn-sm" onClick={openEmbeddedConsole}>▣ Dock console</button>
          <button className="btn btn-sm btn-primary" onClick={openConsole}>🖥️ Console</button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex" style={{ gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 500,
              color: tab === t.key ? 'var(--text)' : 'var(--text-dim)',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              marginBottom: -1,
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px,1fr))', marginBottom: 18 }}>
            <div className="stat" style={{ padding: 12 }}>
              <div className="stat-label">CPU</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{pct(cur.cpu)}</div>
              <ResourceBar frac={cur.cpu || 0} />
              <div className="stat-sub">{cur.cpus || cur.maxcpu || '?'} cores</div>
            </div>
            <div className="stat" style={{ padding: 12 }}>
              <div className="stat-label">Memory</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>
                {pct(cur.maxmem ? (cur.mem || 0) / cur.maxmem : 0)}
              </div>
              <ResourceBar frac={cur.maxmem ? (cur.mem || 0) / cur.maxmem : 0} />
              <div className="stat-sub">{bytes(cur.mem)} / {bytes(cur.maxmem)}</div>
            </div>
            <div className="stat" style={{ padding: 12 }}>
              <div className="stat-label">Uptime</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{uptime(cur.uptime)}</div>
              <div className="stat-sub">Node: {guest.node}</div>
            </div>
            <div className="stat" style={{ padding: 12 }}>
              <div className="stat-label">Disk</div>
              <div style={{ fontSize: 18, fontWeight: 700, marginTop: 4 }}>{bytes(cur.maxdisk)}</div>
              <div className="stat-sub">↓ {rate(cur.diskread)} ↑ {rate(cur.diskwrite)}</div>
            </div>
          </div>

          <div className="flex" style={{ gap: 6, marginBottom: 14 }}>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', marginRight: 4 }}>Timeframe:</span>
            {TIMEFRAMES.map((t) => (
              <button key={t.key} className={`btn btn-sm ${tf === t.key ? 'btn-primary' : ''}`} onClick={() => setTf(t.key)}>
                {t.label}
              </button>
            ))}
          </div>

          <div className="grid grid-2">
            <ChartCard title="CPU Usage (%)">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={cpuData}>
                  <defs>
                    <linearGradient id="cpuG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#e57000" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#e57000" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262b3a" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b7488' }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7488' }} width={32} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="cpu" stroke="#e57000" fill="url(#cpuG)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Memory (MiB)">
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={memData}>
                  <defs>
                    <linearGradient id="memG" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262b3a" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b7488' }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7488' }} width={42} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Area type="monotone" dataKey="used" stroke="#3b82f6" fill="url(#memG)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Network (KiB/s)">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={netData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262b3a" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b7488' }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7488' }} width={42} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="in" stroke="#22c55e" dot={false} strokeWidth={1.8} />
                  <Line type="monotone" dataKey="out" stroke="#eab308" dot={false} strokeWidth={1.8} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="Disk I/O (KiB/s)">
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={diskData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262b3a" />
                  <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#6b7488' }} minTickGap={30} />
                  <YAxis tick={{ fontSize: 10, fill: '#6b7488' }} width={42} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Line type="monotone" dataKey="read" stroke="#a855f7" dot={false} strokeWidth={1.8} />
                  <Line type="monotone" dataKey="write" stroke="#ef4444" dot={false} strokeWidth={1.8} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}

      {tab === 'snapshots' && <Snapshots guest={guest} />}
      {tab === 'config' && <GuestConfig guest={guest} />}
      {tab === 'notes' && <GuestNotes guest={guest} />}

      {migrating && (
        <MigrateDialog guest={guest} onClose={() => setMigrating(false)} onDone={() => {}} />
      )}
    </Modal>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <div className="card-head" style={{ fontSize: 13, padding: '10px 14px' }}>{title}</div>
      <div style={{ padding: '12px 8px 8px 0' }}>{children}</div>
    </div>
  );
}
