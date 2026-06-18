import { useState } from 'react';
import { usePolling } from '../utils/usePolling';
import { apiGet } from '../utils/api';

interface Permission {
  path: string;
  type: 'user' | 'group' | 'token';
  roleid: string;
  userid?: string;
  groupid?: string;
  tokenid?: string;
  propagate?: number;
}

export function Permissions() {
  const [query, setQuery] = useState('');

  const { data, loading, error, refresh } = usePolling<Permission[]>(
    async () => {
      const res = await apiGet<Permission[]>('/access/permissions');
      return res || [];
    },
    30000,
    []
  );

  const permissions = (data || []).filter((p) =>
    !query ||
    p.path.toLowerCase().includes(query.toLowerCase()) ||
    p.roleid.toLowerCase().includes(query.toLowerCase()) ||
    (p.userid || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.groupid || '').toLowerCase().includes(query.toLowerCase()) ||
    (p.tokenid || '').toLowerCase().includes(query.toLowerCase())
  );

  if (loading && !data) {
    return <div className="loading-center"><span className="spinner spinner-lg" /> Loading permissions…</div>;
  }

  return (
    <div>
      {error && <div className="error-banner">{error}</div>}
      <div className="toolbar">
        <input
          className="search-box"
          placeholder="Search permissions…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <span className="text-dim" style={{ fontSize: 13 }}>{permissions.length} permissions</span>
        <div style={{ flex: 1 }} />
        <button className="btn btn-sm" onClick={() => refresh()}>↻ Refresh</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Path</th>
                <th>Subject</th>
                <th>Type</th>
                <th>Role</th>
                <th>Propagate</th>
              </tr>
            </thead>
            <tbody>
              {permissions.map((p, idx) => (
                <tr key={`${p.path}-${p.type}-${p.userid || p.groupid || p.tokenid || ''}-${idx}`}>
                  <td className="mono">{p.path}</td>
                  <td style={{ fontWeight: 500 }}>{p.userid || p.groupid || p.tokenid || '—'}</td>
                  <td><span className="tag">{p.type}</span></td>
                  <td className="mono">{p.roleid}</td>
                  <td>
                    <span className={`badge ${p.propagate ? 'badge-running' : 'badge-stopped'}`}>
                      <span className={`dot ${p.propagate ? 'dot-online' : 'dot-offline'}`} />
                      {p.propagate ? 'yes' : 'no'}
                    </span>
                  </td>
                </tr>
              ))}
              {permissions.length === 0 && (
                <tr>
                  <td colSpan={5}>
                    <div className="empty"><div className="empty-icon">🔐</div>No permissions found</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
