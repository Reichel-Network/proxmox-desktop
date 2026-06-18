import { useState } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet, apiPost, apiDel } from '../utils/api';
import { Modal } from '../components/Modal';
import { Field, TextInput } from '../components/form';
import { useToast } from '../components/Toast';

interface PveUser {
  userid: string;
  email?: string;
  comment?: string;
  enabled?: number;
  expire?: number;
  firstname?: string;
  lastname?: string;
  keys?: string;
}

export function Users() {
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);

  const { data, loading, error, refresh } = usePolling<PveUser[]>(
    async () => apiGet<PveUser[]>('/access/users'),
    15000,
    []
  );

  async function deleteUser(userid: string) {
    if (!window.confirm(`Delete user "${userid}"?`)) return;
    const res = await apiDel(`/access/users/${userid}`);
    if (res.ok) {
      toast.success(`Deleted user ${userid}`);
      refresh();
    } else {
      toast.error(res.error || 'Failed to delete user');
    }
  }

  const users = (data || []).filter((u) =>
    !query ||
    u.userid.toLowerCase().includes(query.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(query.toLowerCase()) ||
    (u.firstname || '').toLowerCase().includes(query.toLowerCase()) ||
    (u.lastname || '').toLowerCase().includes(query.toLowerCase())
  );

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading users…</div>;
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Search users…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-dim" style={{ fontSize: 13 }}>{users.length} users</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
        <button className="btn btn-sm btn-primary" onClick={() => setEditorOpen(true)}>+ User</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>User ID</th>
                <th>Email</th>
                <th>Name</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userid}>
                  <td style={{ fontWeight: 600 }}>👤 {u.userid}</td>
                  <td className="text-dim">{u.email || '—'}</td>
                  <td>
                    {[u.firstname, u.lastname].filter(Boolean).join(' ') || '—'}
                  </td>
                  <td>
                    <span className={`badge ${u.enabled === 0 ? 'badge-stopped' : 'badge-running'}`}>
                      <span className={`dot ${u.enabled === 0 ? 'dot-offline' : 'dot-online'}`} />
                      {u.enabled === 0 ? 'disabled' : 'enabled'}
                    </span>
                  </td>
                  <td className="text-right nowrap">
                    <div className="flex" style={{ justifyContent: 'flex-end', gap: 5 }}>
                      <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u.userid)}>✕ Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty"><div className="empty-icon">👤</div>No users found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {editorOpen && (
        <UserEditor onClose={() => setEditorOpen(false)} onSaved={() => { refresh(); setEditorOpen(false); }} />
      )}
    </div>
  );
}

function UserEditor({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [form, setForm] = useState({ userid: '', password: '', email: '' });
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form.userid) return toast.error('User ID is required');
    if (!form.password) return toast.error('Password is required');
    setBusy(true);
    const payload: Record<string, string> = {
      userid: form.userid,
      password: form.password,
    };
    if (form.email) payload.email = form.email;
    const res = await apiPost('/access/users', payload);
    setBusy(false);
    if (res.ok) {
      toast.success(`Created user ${form.userid}`);
      onSaved();
    } else {
      toast.error(res.error || 'Failed to create user');
    }
  }

  return (
    <Modal title="Add User" onClose={onClose} width={420}>
      <div className="flex-col" style={{ gap: 12 }}>
        <Field label="User ID" hint="e.g. john@pam or jane@pve">
          <TextInput value={form.userid} onChange={(v) => setForm({ ...form, userid: v })} />
        </Field>
        <Field label="Password">
          <TextInput type="password" value={form.password} onChange={(v) => setForm({ ...form, password: v })} />
        </Field>
        <Field label="Email (optional)">
          <TextInput type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
        </Field>
        <div className="flex" style={{ gap: 10, marginTop: 10 }}>
          <button className="btn btn-primary" disabled={busy} onClick={save}>{busy ? <span className="spinner" /> : 'Create'}</button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </Modal>
  );
}
