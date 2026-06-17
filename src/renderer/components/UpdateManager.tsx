import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import type { UpdateStatus } from '../../shared/types';

export function UpdateManager() {
  const [status, setStatus] = useState<UpdateStatus | null>(null);
  const [open, setOpen] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [dismissed, setDismissed] = useState<string | null>(null);

  useEffect(() => {
    if (!window.pmx?.updates?.onEvent) return;
    const unsub = window.pmx.updates.onEvent((s) => {
      setStatus(s);
      if (s.event === 'available' && s.version !== dismissed) {
        setOpen(true);
      }
      if (s.event === 'downloaded' && s.version !== dismissed) {
        setOpen(true);
        setInstalling(false);
      }
    });
    return unsub;
  }, [dismissed]);

  async function startDownload() {
    const res = await window.pmx.updates.download();
    if (!res.ok) {
      setStatus({ event: 'error', message: res.error || 'Download failed' });
    }
  }

  async function install() {
    setInstalling(true);
    await window.pmx.updates.install();
  }

  function later() {
    setOpen(false);
    if (status?.version) setDismissed(status.version);
  }

  if (!open || !status) return null;

  return (
    <Modal title={`Update ${status.version ? `v${status.version}` : ''}`} onClose={later}>
      <div style={{ minWidth: 360 }}>
        {status.event === 'available' && (
          <>
            <p>A new version of ProxTop is available.</p>
            <div className="flex" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={later}>Later</button>
              <button className="btn btn-primary" onClick={startDownload}>Download & install</button>
            </div>
          </>
        )}

        {status.event === 'downloading' && (
          <>
            <p>Downloading update… {status.percent ?? 0}%</p>
            <div className="progress-bar" style={{ height: 8, background: 'var(--bg-2)', borderRadius: 4, overflow: 'hidden', marginTop: 12 }}>
              <div style={{ width: `${status.percent ?? 0}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.2s' }} />
            </div>
            <div className="flex" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={later} disabled>Downloading…</button>
            </div>
          </>
        )}

        {status.event === 'downloaded' && (
          <>
            <p>Update <strong>v{status.version}</strong> is ready. Restart ProxTop to install it now.</p>
            <div className="flex" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={later}>Restart later</button>
              <button className="btn btn-primary" onClick={install} disabled={installing}>
                {installing ? 'Restarting…' : 'Restart & install'}
              </button>
            </div>
          </>
        )}

        {status.event === 'error' && (
          <>
            <p style={{ color: 'var(--danger)' }}>Update check failed: {status.message}</p>
            <div className="flex" style={{ gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={later}>Close</button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
