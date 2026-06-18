import React, { useEffect, useState } from 'react';
import type { ConnectionProfile, AuthMethod } from '@shared/types';
import { useToast } from '../components/Toast';

function blankProfile(): ConnectionProfile {
  return {
    id: crypto.randomUUID(),
    name: '',
    host: '',
    port: 8006,
    authMethod: 'token',
    tokenId: '',
    tokenSecret: '',
    username: 'root@pam',
    password: '',
    verifySsl: false,
    createdAt: Date.now(),
  };
}

export function ConnectScreen({ onConnected }: { onConnected: (p: ConnectionProfile) => void }) {
  const toast = useToast();
  const [profiles, setProfiles] = useState<ConnectionProfile[]>([]);
  const [form, setForm] = useState<ConnectionProfile>(blankProfile());
  const [connecting, setConnecting] = useState(false);
  const [remember, setRemember] = useState(true);
  const [editingExisting, setEditingExisting] = useState(false);
  const [version, setVersion] = useState('');

  useEffect(() => {
    window.pmx.version().then(setVersion);
    window.pmx.profiles.list().then((p) => {
      setProfiles(p);
      if (p.length) {
        setForm(p[0]);
        setEditingExisting(true);
      }
    });
  }, []);

  function update<K extends keyof ConnectionProfile>(key: K, val: ConnectionProfile[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function selectProfile(p: ConnectionProfile) {
    setForm(p);
    setEditingExisting(true);
  }

  function newProfile() {
    setForm(blankProfile());
    setEditingExisting(false);
  }

  async function deleteProfile(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    const updated = await window.pmx.profiles.delete(id);
    setProfiles(updated);
    if (form.id === id) newProfile();
    toast.info('Connection profile deleted');
  }

  async function connect() {
    if (!form.host.trim()) return toast.error('Host is required');
    if (form.authMethod === 'token' && (!form.tokenId || !form.tokenSecret))
      return toast.error('Token ID and secret are required');
    if (form.authMethod === 'password' && (!form.username || !form.password))
      return toast.error('Username and password are required');

    const profile: ConnectionProfile = {
      ...form,
      name: form.name.trim() || form.host.trim(),
    };

    setConnecting(true);
    try {
      const res = await window.pmx.session.connect(profile);
      if (!res.ok) {
        toast.error(res.error || 'Connection failed', 'Could not connect');
        return;
      }
      if (remember) {
        const updated = await window.pmx.profiles.save(profile);
        setProfiles(updated);
      }
      // Always remember this as the last-used profile for startup auto-connect.
      await window.pmx.settings.set({ lastProfileId: profile.id });
      toast.success(`Connected to ${profile.name}`);
      onConnected(profile);
    } finally {
      setConnecting(false);
    }
  }

  return (
    <div className="connect-screen">
      <div className="connect-card">
        <div className="connect-side">
          <div className="connect-brand">
            <div className="sidebar-logo">P</div>
            <div>
              <div className="connect-brand-name">ProxTop</div>
              <div className="connect-brand-sub">Proxmox VE Management Client · v{version}</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 10, fontWeight: 600 }}>
            SAVED CONNECTIONS
          </div>
          <div className="profile-list">
            {profiles.length === 0 && (
              <div style={{ fontSize: 12.5, color: 'var(--text-faint)' }}>
                No saved connections yet.
              </div>
            )}
            {profiles.map((p) => (
              <button
                key={p.id}
                className={`profile-item ${form.id === p.id ? 'active' : ''}`}
                onClick={() => selectProfile(p)}
              >
                <div className="flex">
                  <div style={{ flex: 1 }}>
                    <div className="profile-item-name">{p.name}</div>
                    <div className="profile-item-host">
                      {p.host}:{p.port} · {p.authMethod}
                    </div>
                  </div>
                  <span
                    onClick={(e) => deleteProfile(p.id, e)}
                    style={{ color: 'var(--text-faint)', fontSize: 14, padding: 4 }}
                    title="Delete"
                  >
                    ✕
                  </span>
                </div>
              </button>
            ))}
          </div>
          <button className="btn btn-sm mt" onClick={newProfile}>
            + New Connection
          </button>
        </div>

        <div className="connect-main">
          <h2>{editingExisting ? 'Connect' : 'New Connection'}</h2>
          <div className="subtitle">Enter your Proxmox VE server details</div>

          <div className="field">
            <label>Connection Name</label>
            <input
              value={form.name}
              placeholder="My Homelab"
              onChange={(e) => update('name', e.target.value)}
            />
          </div>

          <div className="field-row row-gap">
            <div className="field">
              <label>Host / IP</label>
              <input
                value={form.host}
                placeholder="192.168.1.10"
                onChange={(e) => update('host', e.target.value)}
              />
            </div>
            <div className="field" style={{ maxWidth: 110 }}>
              <label>Port</label>
              <input
                type="number"
                value={form.port}
                onChange={(e) => update('port', parseInt(e.target.value) || 8006)}
              />
            </div>
          </div>

          <div className="field">
            <label>Authentication Method</label>
            <div className="seg">
              {(['token', 'password'] as AuthMethod[]).map((m) => (
                <button
                  key={m}
                  className={form.authMethod === m ? 'active' : ''}
                  onClick={() => update('authMethod', m)}
                >
                  {m === 'token' ? 'API Token' : 'Username / Password'}
                </button>
              ))}
            </div>
          </div>

          {form.authMethod === 'token' ? (
            <>
              <div className="field">
                <label>Token ID</label>
                <input
                  value={form.tokenId}
                  placeholder="root@pam!mytoken"
                  onChange={(e) => update('tokenId', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Token Secret</label>
                <input
                  type="password"
                  value={form.tokenSecret}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  onChange={(e) => update('tokenSecret', e.target.value)}
                />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label>Username (with realm)</label>
                <input
                  value={form.username}
                  placeholder="root@pam"
                  onChange={(e) => update('username', e.target.value)}
                />
              </div>
              <div className="field">
                <label>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => update('password', e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && connect()}
                />
              </div>
            </>
          )}

          <div className="flex" style={{ justifyContent: 'space-between', marginTop: 4 }}>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="verifySsl"
                checked={form.verifySsl}
                onChange={(e) => update('verifySsl', e.target.checked)}
              />
              <label htmlFor="verifySsl">Verify SSL certificate</label>
            </div>
            <div className="checkbox-row">
              <input
                type="checkbox"
                id="remember"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <label htmlFor="remember">Save connection</label>
            </div>
          </div>

          {!form.verifySsl && (
            <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 8 }}>
              SSL verification disabled — accepts self-signed certificates (typical for Proxmox).
            </div>
          )}

          <button
            className="btn btn-primary mt"
            style={{ width: '100%', justifyContent: 'center', padding: 11 }}
            onClick={connect}
            disabled={connecting}
          >
            {connecting ? <span className="spinner" /> : '⚡'}
            {connecting ? 'Connecting…' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
