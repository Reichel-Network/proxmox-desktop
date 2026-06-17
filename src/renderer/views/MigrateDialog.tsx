import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { apiGet, apiPost } from '../utils/api';
import { useToast } from '../components/Toast';
import { Field, Select, Checkbox } from '../components/form';
import type { PveGuest, PveNode } from '@shared/types';

export function MigrateDialog({
  guest,
  onClose,
  onDone,
}: {
  guest: PveGuest;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nodes, setNodes] = useState<string[]>([]);
  const [target, setTarget] = useState('');
  const [online, setOnline] = useState(guest.status === 'running');
  const [withLocalDisks, setWithLocalDisks] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    apiGet<PveNode[]>('/nodes').then((ns) => {
      const others = ns.map((n) => n.node).filter((n) => n !== guest.node);
      setNodes(others);
      if (others.length) setTarget(others[0]);
    }).catch((e) => toast.error(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function migrate() {
    if (!target) return toast.error('Select a target node');
    setBusy(true);
    try {
      const params: Record<string, any> = { target };
      if (guest.type === 'qemu') {
        params.online = online ? 1 : 0;
        if (withLocalDisks) params['with-local-disks'] = 1;
      } else {
        params.restart = online ? 1 : 0;
      }
      const res = await apiPost(`/nodes/${guest.node}/${guest.type}/${guest.vmid}/migrate`, params);
      if (res.ok) {
        toast.success(`Migrating ${guest.vmid} → ${target}`, 'Migration started');
        onDone();
        onClose();
      } else toast.error(res.error || 'Migration failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      title={`Migrate ${guest.type === 'qemu' ? 'VM' : 'CT'} ${guest.vmid}`}
      onClose={onClose}
      width={460}
      footer={
        <>
          <button className="btn btn-sm" onClick={onClose}>Cancel</button>
          <button className="btn btn-sm btn-primary" disabled={busy || !target} onClick={migrate}>
            {busy ? <span className="spinner" /> : '➡ Migrate'}
          </button>
        </>
      }
    >
      {nodes.length === 0 ? (
        <div className="empty"><div className="empty-icon">🖥️</div>No other nodes available to migrate to</div>
      ) : (
        <>
          <Field label="Source Node"><input value={guest.node} disabled /></Field>
          <Field label="Target Node">
            <Select value={target} onChange={setTarget}
              options={nodes.map((n) => ({ value: n, label: n }))} />
          </Field>
          <Checkbox id="online" checked={online} onChange={setOnline}
            label={guest.type === 'qemu' ? 'Online (live) migration' : 'Restart mode migration'} />
          {guest.type === 'qemu' && (
            <div style={{ marginTop: 10 }}>
              <Checkbox id="localdisks" checked={withLocalDisks} onChange={setWithLocalDisks}
                label="Migrate local disks (if any)" />
            </div>
          )}
        </>
      )}
    </Modal>
  );
}
