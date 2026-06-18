import { useState } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPost, apiPut, apiDel } from '../utils/api';
import { useToast } from '../components/Toast';
import { Field, TextInput, Select, Checkbox } from '../components/form';
import type { PveGuest, PveFirewallRule } from '@shared/types';

const DIRECTION_OPTIONS = [
  { value: 'in', label: 'In' },
  { value: 'out', label: 'Out' },
];

const ACTION_OPTIONS = [
  { value: 'ACCEPT', label: 'ACCEPT' },
  { value: 'DROP', label: 'DROP' },
  { value: 'REJECT', label: 'REJECT' },
];

const PROTO_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'tcp', label: 'TCP' },
  { value: 'udp', label: 'UDP' },
  { value: 'icmp', label: 'ICMP' },
];

const EMPTY_FORM: PveFirewallRule = {
  pos: 0,
  type: 'in',
  action: 'ACCEPT',
  proto: '',
  dport: '',
  sport: '',
  source: '',
  dest: '',
  macro: '',
  comment: '',
  enable: 1,
};

export function GuestFirewall({ guest }: { guest: PveGuest }) {
  const toast = useToast();
  const base = `/nodes/${guest.node}/${guest.type}/${guest.vmid}/firewall/rules`;
  const [editor, setEditor] = useState<PveFirewallRule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const { data, loading, error, refresh } = usePolling<PveFirewallRule[]>(
    async () => apiGet<PveFirewallRule[]>(base),
    0,
    [guest.vmid]
  );

  const rules = (data || []).sort((a, b) => a.pos - b.pos);

  async function toggle(rule: PveFirewallRule) {
    const next = rule.enable === 0 ? 1 : 0;
    setBusy(`toggle:${rule.pos}`);
    try {
      const res = await apiPut(`${base}/${rule.pos}`, { enable: next, digest: rule.digest });
      if (res.ok) {
        toast.success(`Rule ${rule.pos} ${next ? 'enabled' : 'disabled'}`);
        refresh();
      } else toast.error(res.error || 'Failed to update rule');
    } finally {
      setBusy(null);
    }
  }

  async function remove(rule: PveFirewallRule) {
    if (!window.confirm(`Delete firewall rule ${rule.pos}?`)) return;
    setBusy(`del:${rule.pos}`);
    try {
      const res = await apiDel(`${base}/${rule.pos}`, { digest: rule.digest });
      if (res.ok) {
        toast.success(`Deleted rule ${rule.pos}`);
        refresh();
      } else toast.error(res.error || 'Failed to delete rule');
    } finally {
      setBusy(null);
    }
  }

  async function save(form: PveFirewallRule) {
    const isNew = editor?.pos === 0 || !rules.find((r) => r.pos === editor?.pos);
    const payload: Record<string, any> = {
      type: form.type,
      action: form.action,
      enable: form.enable ? 1 : 0,
    };
    if (form.macro?.trim()) payload.macro = form.macro.trim();
    if (form.proto) payload.proto = form.proto;
    if (form.dport?.trim()) payload.dport = form.dport.trim();
    if (form.sport?.trim()) payload.sport = form.sport.trim();
    if (form.source?.trim()) payload.source = form.source.trim();
    if (form.dest?.trim()) payload.dest = form.dest.trim();
    if (form.comment?.trim()) payload.comment = form.comment.trim();

    setBusy('save');
    try {
      let res;
      if (isNew) {
        res = await apiPost(base, payload);
      } else {
        res = await apiPut(`${base}/${form.pos}`, { ...payload, digest: form.digest });
      }
      if (res.ok) {
        toast.success(isNew ? 'Firewall rule added' : `Updated rule ${form.pos}`);
        setEditor(null);
        refresh();
      } else toast.error(res.error || 'Failed to save rule');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <span className="text-dim" style={{ fontSize: 13 }}>{rules.length} rules</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setEditor(EMPTY_FORM)}>+ Add Rule</button>
      </div>

      <div className="card" style={{ marginBottom: 14 }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>#</th>
                <th style={{ width: 50 }}>On</th>
                <th>Action</th>
                <th>Direction</th>
                <th>Macro</th>
                <th>Source</th>
                <th>Dest</th>
                <th>Proto</th>
                <th>Ports</th>
                <th>Comment</th>
                <th style={{ width: 90 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && !data ? (
                <tr>
                  <td colSpan={11}>
                    <div className="loading-center"><span className="spinner" /> Loading rules…</div>
                  </td>
                </tr>
              ) : rules.map((r) => (
                <tr key={r.pos} style={{ opacity: r.enable === 0 ? 0.5 : 1 }}>
                  <td>{r.pos}</td>
                  <td>
                    {busy === `toggle:${r.pos}` ? <span className="spinner" /> : (
                      <input
                        type="checkbox"
                        checked={r.enable !== 0}
                        onChange={() => toggle(r)}
                        aria-label={`Toggle rule ${r.pos}`}
                      />
                    )}
                  </td>
                  <td>
                    <span className={`badge ${r.action === 'ACCEPT' ? 'badge-running' : r.action === 'DROP' ? 'badge-stopped' : 'badge-paused'}`}>
                      {r.action}
                    </span>
                  </td>
                  <td><span className="tag">{r.type}</span></td>
                  <td>{r.macro || '—'}</td>
                  <td className="mono">{r.source || 'any'}</td>
                  <td className="mono">{r.dest || 'any'}</td>
                  <td>{r.proto || '—'}</td>
                  <td className="mono">{r.dport || r.sport ? [r.dport ? `d:${r.dport}` : '', r.sport ? `s:${r.sport}` : ''].filter(Boolean).join(' ') : '—'}</td>
                  <td className="text-dim" style={{ fontSize: 12 }}>{r.comment || '—'}</td>
                  <td className="text-right nowrap">
                    {busy === `del:${r.pos}` ? <span className="spinner" /> : (
                      <div className="flex" style={{ justifyContent: 'flex-end', gap: 4 }}>
                        <button className="btn btn-xs" title="Edit" onClick={() => setEditor(r)}>✎</button>
                        <button className="btn btn-xs btn-danger" title="Delete" onClick={() => remove(r)}>✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {!loading && rules.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <div className="empty"><div className="empty-icon">🛡️</div>No firewall rules for this guest</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editor && (
        <RuleEditor
          rule={editor}
          existing={rules}
          onClose={() => setEditor(null)}
          onSave={save}
          busy={busy === 'save'}
        />
      )}
    </div>
  );
}

function RuleEditor({
  rule,
  existing,
  onClose,
  onSave,
  busy,
}: {
  rule: PveFirewallRule;
  existing: PveFirewallRule[];
  onClose: () => void;
  onSave: (r: PveFirewallRule) => void;
  busy: boolean;
}) {
  const isNew = rule.pos === 0 || !existing.find((r) => r.pos === rule.pos);
  const [form, setForm] = useState<PveFirewallRule>({ ...rule });

  const update = (patch: Partial<PveFirewallRule>) => setForm((f) => ({ ...f, ...patch }));

  return (
    <div className="card">
      <div className="card-head">{isNew ? '+ Add Firewall Rule' : `✎ Edit Rule ${rule.pos}`}</div>
      <div className="card-body">
        <div className="grid grid-3">
          <Field label="Direction">
            <Select value={form.type} onChange={(v) => update({ type: v })} options={DIRECTION_OPTIONS} />
          </Field>
          <Field label="Action">
            <Select value={form.action} onChange={(v) => update({ action: v })} options={ACTION_OPTIONS} />
          </Field>
          <Field label="Protocol">
            <Select value={form.proto || ''} onChange={(v) => update({ proto: v })} options={PROTO_OPTIONS} />
          </Field>
          <Field label="Macro">
            <TextInput value={form.macro || ''} onChange={(v) => update({ macro: v })} placeholder="ssh, http, smtp…" />
          </Field>
          <Field label="Source">
            <TextInput value={form.source || ''} onChange={(v) => update({ source: v })} placeholder="10.0.0.0/24" />
          </Field>
          <Field label="Destination">
            <TextInput value={form.dest || ''} onChange={(v) => update({ dest: v })} placeholder="any" />
          </Field>
          <Field label="Destination Port(s)">
            <TextInput value={form.dport || ''} onChange={(v) => update({ dport: v })} placeholder="80,443" />
          </Field>
          <Field label="Source Port(s)">
            <TextInput value={form.sport || ''} onChange={(v) => update({ sport: v })} placeholder="1234" />
          </Field>
          <Field label="Comment">
            <TextInput value={form.comment || ''} onChange={(v) => update({ comment: v })} />
          </Field>
        </div>
        <div className="flex" style={{ alignItems: 'center', marginTop: 12, gap: 16 }}>
          <Checkbox id="fw-enable" checked={form.enable !== 0} onChange={(v) => update({ enable: v ? 1 : 0 })} label="Enabled" />
          <div style={{ flex: 1 }} />
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" disabled={busy} onClick={() => onSave(form)}>
            {busy ? <span className="spinner" /> : isNew ? 'Add Rule' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
