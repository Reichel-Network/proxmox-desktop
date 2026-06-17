import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/Modal';
import { NodeShellTerminal } from '../components/NodeShellTerminal';
import { useToast } from '../components/Toast';
import type {
  ScriptCatalog,
  ScriptEntry,
  PveNode,
  ConnectionProfile,
} from '@shared/types';

const TYPE_LABEL: Record<string, string> = {
  ct: 'LXC',
  vm: 'VM',
  pve: 'PVE Tool',
  addon: 'Add-on',
};

function ScriptLogo({ entry }: { entry: ScriptEntry }) {
  const [err, setErr] = useState(false);
  if (!entry.logo || err) {
    return (
      <div
        style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0,
          background: 'var(--bg-elev-2)', display: 'grid', placeItems: 'center',
          fontSize: 18, fontWeight: 700, color: 'var(--accent)',
        }}
      >
        {entry.name.charAt(0).toUpperCase()}
      </div>
    );
  }
  return (
    <img
      src={entry.logo}
      alt=""
      onError={() => setErr(true)}
      style={{ width: 40, height: 40, borderRadius: 8, flexShrink: 0, objectFit: 'contain', background: '#fff1' }}
    />
  );
}

export function HelperScripts() {
  const toast = useToast();
  const [catalog, setCatalog] = useState<ScriptCatalog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [activeCat, setActiveCat] = useState<number | 'all'>('all');
  const [activeType, setActiveType] = useState<string>('all');
  const [selected, setSelected] = useState<ScriptEntry | null>(null);

  async function load(force = false) {
    setLoading(true);
    setError(null);
    const res = await window.pmx.scripts.catalog(force);
    if (res.ok) setCatalog(res.data as ScriptCatalog);
    else setError(res.error || 'Failed to load catalog');
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!catalog) return [];
    const q = query.trim().toLowerCase();
    return catalog.scripts.filter((s) => {
      if (activeCat !== 'all' && !s.categories?.includes(activeCat)) return false;
      if (activeType !== 'all' && s.type !== activeType) return false;
      if (q && !(s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q)))
        return false;
      return true;
    });
  }, [catalog, query, activeCat, activeType]);

  if (loading && !catalog) {
    return (
      <div className="loading-center">
        <span className="spinner spinner-lg" /> Loading helper scripts catalog…
      </div>
    );
  }

  if (error && !catalog) {
    return (
      <div>
        <div className="error-banner">{error}</div>
        <button className="btn" onClick={() => load(true)}>↻ Retry</button>
      </div>
    );
  }

  const cats = catalog?.categories || [];
  const types = ['all', 'ct', 'vm', 'pve', 'addon'];

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Search 480+ scripts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          style={{ maxWidth: 240 }}
          value={String(activeCat)}
          onChange={(e) => setActiveCat(e.target.value === 'all' ? 'all' : Number(e.target.value))}
        >
          <option value="all">All categories</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
        <div className="seg" style={{ width: 'auto' }}>
          {types.map((t) => (
            <button
              key={t}
              className={activeType === t ? 'active' : ''}
              style={{ padding: '6px 12px' }}
              onClick={() => setActiveType(t)}
            >
              {t === 'all' ? 'All' : TYPE_LABEL[t] || t}
            </button>
          ))}
        </div>
        <span className="text-dim" style={{ fontSize: 13 }}>{filtered.length} scripts</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => load(true)}>↻ Refresh</button>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-faint)', marginBottom: 14 }}>
        Catalog from{' '}
        <a onClick={() => window.pmx.openExternal('https://community-scripts.org')} style={{ cursor: 'pointer' }}>
          community-scripts.org
        </a>{' '}
        — community-maintained, not affiliated with Proxmox. Review each script before running.
      </div>

      <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
        {filtered.map((s) => (
          <button
            key={s.slug}
            className="card"
            style={{ textAlign: 'left', padding: 14, cursor: 'pointer', display: 'flex', gap: 12, alignItems: 'flex-start' }}
            onClick={() => setSelected(s)}
          >
            <ScriptLogo entry={s} />
            <div style={{ overflow: 'hidden', flex: 1 }}>
              <div className="flex" style={{ gap: 6 }}>
                <span style={{ fontWeight: 600 }}>{s.name}</span>
                <span className="tag">{TYPE_LABEL[s.type] || s.type}</span>
              </div>
              <div
                style={{
                  fontSize: 12, color: 'var(--text-dim)', marginTop: 4,
                  display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                }}
              >
                {s.description || 'No description'}
              </div>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <div className="empty"><div className="empty-icon">🔍</div>No scripts match your filters</div>
        )}
      </div>

      {selected && (
        <ScriptDetail entry={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}

function ScriptDetail({ entry, onClose }: { entry: ScriptEntry; onClose: () => void }) {
  const toast = useToast();
  const [command, setCommand] = useState<string | null>(null);
  const [nodes, setNodes] = useState<string[]>([]);
  const [node, setNode] = useState('');
  const [profile, setProfile] = useState<ConnectionProfile | null>(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    window.pmx.scripts.detail(entry).then((res) => {
      if (res.ok) setCommand(res.data?.command || null);
    });
    window.pmx.pve.nodes().then((res) => {
      if (res.ok) {
        const ns = ((res.data?.data || []) as PveNode[]).map((n) => n.node);
        setNodes(ns);
        if (ns.length) setNode(ns[0]);
      }
    });
    window.pmx.session.current().then((res) => {
      if (res.ok) setProfile(res.data as ConnectionProfile);
    });
  }, [entry.slug]);

  const method = entry.install_methods?.[0];
  const isToken = profile?.authMethod === 'token';

  async function copyCommand() {
    if (command) {
      await navigator.clipboard.writeText(command);
      toast.success('Install command copied to clipboard');
    }
  }

  if (running && node) {
    return (
      <Modal title={`Install ${entry.name} · ${node}`} onClose={() => { setRunning(false); }} width={900}>
        <div style={{ height: 520 }}>
          <NodeShellTerminal node={node} runCommand={command || undefined} onClose={() => setRunning(false)} />
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={entry.name} onClose={onClose} width={680}>
      <div className="flex" style={{ gap: 14, marginBottom: 16, alignItems: 'flex-start' }}>
        <ScriptLogo entry={entry} />
        <div style={{ flex: 1 }}>
          <div className="flex" style={{ gap: 6, flexWrap: 'wrap' }}>
            <span className="tag">{TYPE_LABEL[entry.type] || entry.type}</span>
            {entry.updateable && <span className="tag">updateable</span>}
            {entry.privileged != null && (
              <span className="tag">{entry.privileged ? 'privileged' : 'unprivileged'}</span>
            )}
            {entry.interface_port ? <span className="tag">port {entry.interface_port}</span> : null}
          </div>
          <p style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 8 }}>{entry.description}</p>
        </div>
      </div>

      {method && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-head" style={{ fontSize: 13 }}>Default resources</div>
          <div className="card-body">
            <dl className="detail-grid">
              <dt>OS</dt><dd>{method.resources.os} {method.resources.version}</dd>
              <dt>CPU</dt><dd>{method.resources.cpu} core(s)</dd>
              <dt>RAM</dt><dd>{method.resources.ram} MiB</dd>
              <dt>Disk</dt><dd>{method.resources.hdd} GB</dd>
            </dl>
          </div>
        </div>
      )}

      {entry.notes && entry.notes.length > 0 && (
        <div className="flex-col" style={{ gap: 6, marginBottom: 14 }}>
          {entry.notes.map((n, i) => (
            <div key={i} className="error-banner" style={{
              margin: 0,
              background: n.type === 'warning' ? 'rgba(234,179,8,0.1)' : 'rgba(59,130,246,0.08)',
              borderColor: n.type === 'warning' ? '#4a3a1a' : '#1e3a5a',
              color: n.type === 'warning' ? '#facc15' : '#93c5fd',
            }}>
              {n.text}
            </div>
          ))}
        </div>
      )}

      {command && (
        <div className="field" style={{ marginBottom: 14 }}>
          <label>Install command</label>
          <div className="log-view" style={{ maxHeight: 80 }}>{command}</div>
        </div>
      )}

      {isToken && (
        <div className="error-banner" style={{ background: 'rgba(234,179,8,0.1)', borderColor: '#4a3a1a', color: '#facc15' }}>
          You're connected with an API token. The live node shell needs password
          authentication — use "Copy command" and paste it into a node shell, or reconnect with username/password.
        </div>
      )}

      <div className="flex" style={{ gap: 10, marginTop: 6 }}>
        {nodes.length > 0 && (
          <select style={{ maxWidth: 180 }} value={node} onChange={(e) => setNode(e.target.value)}>
            {nodes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <button
          className="btn btn-primary"
          disabled={!command || !node || isToken}
          onClick={() => setRunning(true)}
          title={isToken ? 'Requires password auth' : 'Run in an embedded node shell'}
        >
          ▶ Run on {node || 'node'}
        </button>
        <button className="btn" disabled={!command} onClick={copyCommand}>⧉ Copy command</button>
        {entry.website && (
          <button className="btn" onClick={() => window.pmx.openExternal(entry.website!)}>🌐 Website</button>
        )}
        {entry.documentation && (
          <button className="btn" onClick={() => window.pmx.openExternal(entry.documentation!)}>📖 Docs</button>
        )}
      </div>
    </Modal>
  );
}
