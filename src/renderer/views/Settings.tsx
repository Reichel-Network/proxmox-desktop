import { useState, useEffect } from 'react';
import { useToast } from '../components/Toast';
import type { AppSettings, ConnectionProfile, UpdateStatus } from '@shared/types';

export function Settings({
  profile,
  settings,
  onSettingsChange,
}: {
  profile: ConnectionProfile;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
}) {
  const toast = useToast();
  const [version, setVersion] = useState('');
  const [update, setUpdate] = useState<UpdateStatus | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    window.pmx.version().then(setVersion);
    const off = window.pmx.updates.onEvent(setUpdate);
    return off;
  }, []);

  async function set<K extends keyof AppSettings>(key: K, val: AppSettings[K]) {
    const merged = await window.pmx.settings.set({ [key]: val });
    onSettingsChange(merged);
  }

  async function checkUpdates() {
    setChecking(true);
    const res = await window.pmx.updates.check();
    setChecking(false);
    if (!res.ok) toast.info(res.error || 'No update server configured for this build');
  }

  return (
    <div className="flex-col" style={{ gap: 18, maxWidth: 640 }}>
      <div className="card">
        <div className="card-head">🎨 Appearance</div>
        <div className="card-body flex-col" style={{ gap: 14 }}>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Theme</div>
              <div className="text-dim" style={{ fontSize: 12.5 }}>Switch between dark and light mode</div>
            </div>
            <div className="seg" style={{ width: 200 }}>
              <button className={settings.theme === 'dark' ? 'active' : ''} onClick={() => set('theme', 'dark')}>🌙 Dark</button>
              <button className={settings.theme === 'light' ? 'active' : ''} onClick={() => set('theme', 'light')}>☀️ Light</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">⚠️ Safety</div>
        <div className="card-body">
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Confirm destructive actions</div>
              <div className="text-dim" style={{ fontSize: 12.5 }}>Ask before stop, reboot, rollback, delete</div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={settings.confirmDestructive}
                onChange={(e) => set('confirmDestructive', e.target.checked)} />
            </label>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">⬇️ Updates</div>
        <div className="card-body flex-col" style={{ gap: 14 }}>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 500 }}>Automatically check for updates</div>
              <div className="text-dim" style={{ fontSize: 12.5 }}>Check on startup</div>
            </div>
            <label className="checkbox-row">
              <input type="checkbox" checked={settings.autoCheckUpdates}
                onChange={(e) => set('autoCheckUpdates', e.target.checked)} />
            </label>
          </div>
          <div className="flex" style={{ justifyContent: 'space-between' }}>
            <div className="text-dim" style={{ fontSize: 13 }}>
              Current version: <span className="mono">{version || '…'}</span>
              {update && (
                <div style={{ marginTop: 4 }}>
                  {update.event === 'available' && <span className="text-green">Update {update.version} available</span>}
                  {update.event === 'not-available' && <span>You are up to date</span>}
                  {update.event === 'downloading' && <span>Downloading… {update.percent}%</span>}
                  {update.event === 'downloaded' && <span className="text-green">Update ready — restart to install</span>}
                  {update.event === 'error' && <span className="text-red">{update.message}</span>}
                </div>
              )}
            </div>
            <div className="flex" style={{ gap: 8 }}>
              {update?.event === 'downloaded' ? (
                <button className="btn btn-sm btn-primary" onClick={() => window.pmx.updates.install()}>Restart & Install</button>
              ) : (
                <button className="btn btn-sm" disabled={checking} onClick={checkUpdates}>
                  {checking ? <span className="spinner" /> : '↻ Check Now'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">🔗 Connection</div>
        <div className="card-body">
          <dl className="detail-grid">
            <dt>Name</dt><dd>{profile.name}</dd>
            <dt>Host</dt><dd className="mono">{profile.host}:{profile.port}</dd>
            <dt>Auth</dt><dd>{profile.authMethod === 'token' ? `Token (${profile.tokenId})` : `User (${profile.username})`}</dd>
            <dt>SSL Verify</dt><dd>{profile.verifySsl ? 'Enabled' : 'Disabled (self-signed OK)'}</dd>
            <dt>Secrets</dt><dd>{profile.secretsEncrypted ? '🔒 Encrypted (DPAPI)' : 'Plaintext'}</dd>
          </dl>
        </div>
      </div>
    </div>
  );
}
