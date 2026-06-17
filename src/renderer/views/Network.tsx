import { useState, useEffect } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPost, apiPut, apiDel } from '../utils/api';
import { Modal } from '../components/Modal';
import { Field, TextInput, Select, Checkbox } from '../components/form';
import { useToast } from '../components/Toast';
import type { PveNode } from '@shared/types';

interface NetIface {
  iface: string;
  type: string;
  method?: string;
  address?: string;
  netmask?: string;
  cidr?: string;
  gateway?: string;
  active?: number;
  autostart?: number;
  bridge_ports?: string;
  comments?: string;
  method6?: string;
}

interface FwRule {
  pos: number;
  type: string;
  action: string;
  proto?: string;
  dport?: string;
  source?: string;
  dest?: string;
  enable?: number;
  comment?: string;
}

const IFACE_TYPES = [
  { value: 'bridge', label: 'Bridge' },
  { value: 'bond', label: 'Bond' },
  { value: 'eth', label: 'Ethernet' },
  { value: 'vlan', label: 'VLAN' },
  { value: 'alias', label: 'Alias' },
];

export function Network() {
  const toast = useToast();
  const [nodes, setNodes] = useState<string[]>([]);
  const [activeNode, setActiveNode] = useState('');
  const [ifaceEditor, setIfaceEditor] = useState<NetIface | null>(null);
  const [ruleEditor, setRuleEditor] = useState<FwRule | null>(null);

  useEffect(() => {
    apiGet<PveNode[]>('/nodes').then((ns) => {
      const names = ns.map((n) => n.node);
      setNodes(names);
      if (names.length) setActiveNode(names[0]);
    });
  }, []);

  const { data: ifaces, loading, error, refresh } = usePolling<NetIface[]>(
    async () => (activeNode ? apiGet<NetIface[]>(`/nodes/${activeNode}/network`) : []),
    0,
    [activeNode]
  );

  const { data: dcFw, refresh: refreshFw } = usePolling<FwRule[]>(
    async () => apiGet<FwRule[]>('/cluster/firewall/rules').catch(() => []),
    0,
    []
  );

  async function deleteIface(iface: NetIface) {
    if (!window.confirm(`Delete interface "${iface.iface}"?\nThis may require a node reboot.`)) return;
    const res = await apiDel(`/nodes/${activeNode}/network/${iface.iface}`);
    if (res.ok) { toast.success(`Deleted ${iface.iface}`); refresh(); }
    else toast.error(res.error || 'Failed to delete interface');
  }

  async function deleteRule(pos: number) {
    if (!window.confirm(`Delete firewall rule ${pos}?`)) return;
    const res = await apiDel(`/cluster/firewall/rules/${pos}`);
    if (res.ok) { toast.success('Deleted rule'); refreshFw(); }
    else toast.error(res.error || 'Failed to delete rule');
  }

  if (loading && !ifaces) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading network…</div>;
  }

  const list = ifaces || [];
  const fwRules = dcFw || [];

  return (
    <div className="flex-col" style={{ gap: 18 }}>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        {nodes.length > 1 && (
          <select style={{ maxWidth: 200 }} value={activeNode} onChange={(e) => setActiveNode(e.target.value)}>
            {nodes.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        )}
        <span className="text-dim" style={{ fontSize: 13 }}>{list.length} interfaces on {activeNode}</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setIfaceEditor({ iface: '', type: 'bridge', method: 'static', autostart: 1 })}>+ Interface</button>
      </div>

      <div className="card">
        <div className="card-head">🌐 Network Interfaces</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Interface</th><th>Type</th><th>Active</th><th>CIDR / Address</th><th>Gateway</th><th>Ports / Slaves</th><th style={{ width: 90 }}>Actions</th></tr>
            </thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.iface}>
                  <td style={{ fontWeight: 600 }}>
                    {n.iface}
                    {n.autostart ? <span className="tag" style={{ marginLeft: 6 }}>auto</span> : null}
                  </td>
                  <td><span className="tag">{n.type}</span></td>
                  <td>
                    <span className={`badge ${n.active ? 'badge-running' : 'badge-stopped'}`}>
                      <span className={`dot ${n.active ? 'dot-online' : 'dot-offline'}`} />
                      {n.active ? 'up' : 'down'}
                    </span>
                  </td>
                  <td className="mono">{n.cidr || n.address || '—'}</td>
                  <td className="mono">{n.gateway || '—'}</td>
                  <td className="text-dim" style={{ fontSize: 12 }}>{n.bridge_ports || '—'}</td>
                  <td>
                    <div className="flex" style={{ gap: 4 }}>
                      <button className="btn btn-xs" onClick={() => setIfaceEditor(n)}>✎</button>
                      <button className="btn btn-xs btn-danger" onClick={() => deleteIface(n)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={7}><div className="empty"><div className="empty-icon">🌐</div>No interfaces</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-head flex" style={{ justifyContent: 'space-between' }}>
          <span>🛡️ Datacenter Firewall Rules</span>
          <button className="btn btn-sm btn-primary" onClick={() => setRuleEditor({ pos: 0, type: 'in', action: 'ACCEPT', proto: 'tcp', enable: 1 })}>+ Rule</button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>#</th><th>Direction</th><th>Action</th><th>Proto</th><th>Port</th><th>Source</th><th>Dest</th><th>Comment</th><th style={{ width: 90 }}>Actions</th></tr>
            </thead>
            <tbody>
              {fwRules.map((r) => (
                <tr key={r.pos} style={{ opacity: r.enable === 0 ? 0.5 : 1 }}>
                  <td>{r.pos}</td>
                  <td><span className="tag">{r.type}</span></td>
                  <td>
                    <span className={`badge ${r.action === 'ACCEPT' ? 'badge-running' : r.action === 'DROP' ? 'badge-stopped' : 'badge-paused'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td>{r.proto || '—'}</td>
                  <td className="mono">{r.dport || '—'}</td>
                  <td className="mono">{r.source || 'any'}</td>
                  <td className="mono">{r.dest || 'any'}</td>
                  <td className="text-dim" style={{ fontSize: 12 }}>{r.comment || '—'}</td>
                  <td>
                    <div className="flex" style={{ gap: 4 }}>
                      <button className="btn btn-xs" onClick={() => setRuleEditor(r)}>✎</button>
                      <button className="btn btn-xs btn-danger" onClick={() => deleteRule(r.pos)}>✕</button>
                    </div>
                  </td>
                </tr>
              ))}
              {fwRules.length === 0 && <tr><td colSpan={9}><div className="empty"><div className="empty-icon">🛡️</div>No datacenter firewall rules</div></td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {ifaceEditor && (
        <IfaceEditor node={activeNode} iface={ifaceEditor} onClose={() => setIfaceEditor(null)} onSaved={() => { refresh(); setIfaceEditor(null); }} />
      )}
      {ruleEditor && (
        <RuleEditor rule={ruleEditor} isNew={ruleEditor.pos === 0 || !dcFw?.find((r) => r.pos === ruleEditor.pos)} onClose={() => setRuleEditor(null)} onSaved={() => { refreshFw(); setRuleEditor(null); }} />
      )}
    </div>
  );
}

function IfaceEditor({ node, iface, onClose, onSaved }: { node: string; iface: NetIface; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const isNew = !iface.iface;
  const [form, setForm] = useState({ ...iface });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.iface || !form.type) return toast.error('Interface and type are required');
    setBusy(true);
    const payload: Record<string, any> = {
      type: form.type,
      method: form.method || 'static',
      autostart: form.autostart ? 1 : 0,
    };
    if (form.cidr) payload.cidr = form.cidr;
    if (form.gateway) payload.gateway = form.gateway;
    if (form.bridge_ports) payload['bridge-ports'] = form.bridge_ports;

    let res;
    if (isNew) {
      res = await apiPost(`/nodes/${node}/network`, { iface: form.iface, ...payload });
    } else {
      res = await apiPut(`/nodes/${node}/network/${form.iface}`, payload);
    }
    setBusy(false);
    if (res.ok) {
      toast.success(`Saved ${form.iface}`);
      onSaved();
    } else {
      toast.error(res.error || 'Failed to save interface');
    }
  }

  return (
    <Modal title={isNew ? 'Add Interface' : `Edit ${iface.iface}`} onClose={onClose} width={520}>
      <div className="flex-col" style={{ gap: 12 }}>
        <Field label="Name" required>
          <TextInput value={form.iface || ''} onChange={(v) => setForm({ ...form, iface: v })} disabled={!isNew} />
        </Field>
        <Field label="Type" required>
          <Select value={form.type || 'bridge'} onChange={(v) => setForm({ ...form, type: v })} options={IFACE_TYPES} />
        </Field>
        <Field label="Method">
          <Select value={form.method || 'static'} onChange={(v) => setForm({ ...form, method: v })} options={[{ value: 'static', label: 'Static' }, { value: 'dhcp', label: 'DHCP' }, { value: 'manual', label: 'Manual' }]} />
        </Field>
        <Field label="CIDR / Address">
          <TextInput value={form.cidr || ''} onChange={(v) => setForm({ ...form, cidr: v })} placeholder="10.0.0.10/24" />
        </Field>
        <Field label="Gateway">
          <TextInput value={form.gateway || ''} onChange={(v) => setForm({ ...form, gateway: v })} placeholder="10.0.0.1" />
        </Field>
        {(form.type === 'bridge' || form.type === 'bond') && (
          <Field label="Ports / Slaves">
            <TextInput value={form.bridge_ports || ''} onChange={(v) => setForm({ ...form, bridge_ports: v })} placeholder="enp3s0 enp4s0" />
          </Field>
        )}
        <Checkbox checked={!!form.autostart} onChange={(v) => setForm({ ...form, autostart: v ? 1 : 0 })} label="Autostart" id="iface-autostart" />
        <div className="text-dim" style={{ fontSize: 12 }}>
          Some changes require a node reboot to take effect.
        </div>
        <div className="flex" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save'}</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}

function RuleEditor({ rule, isNew, onClose, onSaved }: { rule: FwRule; isNew: boolean; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ ...rule });
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const payload: Record<string, any> = {
      type: form.type,
      action: form.action,
      enable: form.enable ? 1 : 0,
    };
    if (form.proto) payload.proto = form.proto;
    if (form.dport) payload.dport = form.dport;
    if (form.source) payload.source = form.source;
    if (form.dest) payload.dest = form.dest;
    if (form.comment) payload.comment = form.comment;

    let res;
    if (isNew) {
      res = await apiPost('/cluster/firewall/rules', payload);
    } else {
      res = await apiPut(`/cluster/firewall/rules/${rule.pos}`, payload);
    }
    setBusy(false);
    if (res.ok) {
      toast.success('Saved firewall rule');
      onSaved();
    } else {
      toast.error(res.error || 'Failed to save rule');
    }
  }

  return (
    <Modal title={isNew ? 'Add Firewall Rule' : `Edit Rule ${rule.pos}`} onClose={onClose} width={520}>
      <div className="flex-col" style={{ gap: 12 }}>
        {!isNew && (
          <Field label="Position">
            <TextInput value={String(form.pos)} disabled />
          </Field>
        )}
        <Field label="Direction" required>
          <Select value={form.type} onChange={(v) => setForm({ ...form, type: v })} options={[{ value: 'in', label: 'In' }, { value: 'out', label: 'Out' }]} />
        </Field>
        <Field label="Action" required>
          <Select value={form.action} onChange={(v) => setForm({ ...form, action: v })} options={[{ value: 'ACCEPT', label: 'ACCEPT' }, { value: 'DROP', label: 'DROP' }, { value: 'REJECT', label: 'REJECT' }]} />
        </Field>
        <Field label="Protocol">
          <Select value={form.proto || ''} onChange={(v) => setForm({ ...form, proto: v })} options={[{ value: '', label: 'Any' }, { value: 'tcp', label: 'TCP' }, { value: 'udp', label: 'UDP' }, { value: 'icmp', label: 'ICMP' }]} />
        </Field>
        <Field label="Port(s)">
          <TextInput value={form.dport || ''} onChange={(v) => setForm({ ...form, dport: v })} placeholder="80,443 or 22" />
        </Field>
        <Field label="Source">
          <TextInput value={form.source || ''} onChange={(v) => setForm({ ...form, source: v })} placeholder="10.0.0.0/24" />
        </Field>
        <Field label="Destination">
          <TextInput value={form.dest || ''} onChange={(v) => setForm({ ...form, dest: v })} placeholder="any" />
        </Field>
        <Field label="Comment">
          <TextInput value={form.comment || ''} onChange={(v) => setForm({ ...form, comment: v })} />
        </Field>
        <Checkbox checked={form.enable !== 0} onChange={(v) => setForm({ ...form, enable: v ? 1 : 0 })} label="Enabled" id="fw-enabled" />
        <div className="flex" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Save'}</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
