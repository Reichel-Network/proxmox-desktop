import { useState, useEffect } from 'react';
import { Modal } from '../components/Modal';
import { apiGet, apiPost } from '../utils/api';
import { useToast } from '../components/Toast';
import { Field, Select } from '../components/form';
import type { PveNode, ClusterResource } from '@shared/types';

type Kind = 'qemu' | 'lxc';

export function CreateGuestWizard({
  kind,
  onClose,
  onDone,
}: {
  kind: Kind;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const [nodes, setNodes] = useState<string[]>([]);
  const [storages, setStorages] = useState<{ storage: string; node: string; content: string }[]>([]);
  const [isos, setIsos] = useState<string[]>([]);
  const [templates, setTemplates] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [nextId, setNextId] = useState('');

  // form state
  const [node, setNode] = useState('');
  const [vmid, setVmid] = useState('');
  const [name, setName] = useState('');
  const [cores, setCores] = useState('2');
  const [memory, setMemory] = useState('2048');
  const [diskGb, setDiskGb] = useState('32');
  const [diskStorage, setDiskStorage] = useState('');
  const [isoImage, setIsoImage] = useState('');
  const [template, setTemplate] = useState('');
  const [bridge, setBridge] = useState('vmbr0');
  const [password, setPassword] = useState('');
  const [start, setStart] = useState(false);

  useEffect(() => {
    apiGet<PveNode[]>('/nodes').then((ns) => {
      const names = ns.map((n) => n.node);
      setNodes(names);
      if (names.length) setNode(names[0]);
    });
    apiGet<{ data: number }>('/cluster/nextid').then((id: any) => setNextId(String(id))).catch(() => {});
    apiGet<ClusterResource[]>('/cluster/resources', { type: 'storage' }).then((r) => {
      setStorages((r || []).map((s) => ({
        storage: s.storage as string, node: s.node as string, content: String(s.content || ''),
      })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load ISOs / templates for the selected node
  useEffect(() => {
    if (!node) return;
    const diskCapable = storages.filter((s) =>
      kind === 'qemu' ? s.content.includes('images') : s.content.includes('rootdir')
    );
    if (diskCapable.length && !diskStorage) setDiskStorage(diskCapable[0].storage);

    if (kind === 'qemu') {
      const isoStores = storages.filter((s) => s.content.includes('iso'));
      Promise.all(isoStores.map((s) =>
        apiGet<any[]>(`/nodes/${node}/storage/${s.storage}/content`, { content: 'iso' }).catch(() => [])
      )).then((lists) => setIsos(lists.flat().map((x) => x.volid)));
    } else {
      const tmplStores = storages.filter((s) => s.content.includes('vztmpl'));
      Promise.all(tmplStores.map((s) =>
        apiGet<any[]>(`/nodes/${node}/storage/${s.storage}/content`, { content: 'vztmpl' }).catch(() => [])
      )).then((lists) => setTemplates(lists.flat().map((x) => x.volid)));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node, storages, kind]);

  const diskStores = storages.filter((s) =>
    kind === 'qemu' ? s.content.includes('images') : s.content.includes('rootdir')
  );

  async function create() {
    const id = vmid || nextId;
    if (!id || !/^\d+$/.test(id)) return toast.error('Enter a valid VMID');
    if (!node) return toast.error('Select a node');
    if (!diskStorage) return toast.error('Select a storage for the disk');
    if (kind === 'lxc' && !template) return toast.error('Select an OS template');
    if (kind === 'lxc' && !password) return toast.error('Set a root password for the container');

    setBusy(true);
    try {
      let res;
      if (kind === 'qemu') {
        const params: Record<string, any> = {
          vmid: Number(id),
          name: name || undefined,
          cores: Number(cores),
          memory: Number(memory),
          net0: `virtio,bridge=${bridge}`,
          scsihw: 'virtio-scsi-pci',
          scsi0: `${diskStorage}:${diskGb}`,
          ostype: 'l26',
        };
        if (isoImage) { params.ide2 = `${isoImage},media=cdrom`; params.boot = 'order=ide2;scsi0'; }
        res = await apiPost(`/nodes/${node}/qemu`, params);
      } else {
        const params: Record<string, any> = {
          vmid: Number(id),
          hostname: name || `ct${id}`,
          cores: Number(cores),
          memory: Number(memory),
          ostemplate: template,
          rootfs: `${diskStorage}:${diskGb}`,
          net0: `name=eth0,bridge=${bridge},ip=dhcp`,
          password,
          start: start ? 1 : 0,
        };
        res = await apiPost(`/nodes/${node}/lxc`, params);
      }
      if (res.ok) {
        toast.success(`Creating ${kind === 'qemu' ? 'VM' : 'CT'} ${id}`, 'Task started');
        if (kind === 'qemu' && start) {
          setTimeout(() => apiPost(`/nodes/${node}/qemu/${id}/status/start`), 3000);
        }
        onDone(); onClose();
      } else toast.error(res.error || 'Creation failed');
    } finally { setBusy(false); }
  }

  return (
    <Modal
      title={kind === 'qemu' ? 'Create Virtual Machine' : 'Create LXC Container'}
      onClose={onClose}
      width={560}
      footer={<>
        <button className="btn btn-sm" onClick={onClose}>Cancel</button>
        <button className="btn btn-sm btn-primary" disabled={busy} onClick={create}>
          {busy ? <span className="spinner" /> : '✨ Create'}
        </button>
      </>}
    >
      <div className="field-row">
        <Field label="Node">
          <Select value={node} onChange={setNode} options={nodes.map((n) => ({ value: n, label: n }))} />
        </Field>
        <Field label="VMID" hint={nextId ? `next free: ${nextId}` : undefined}>
          <input value={vmid} onChange={(e) => setVmid(e.target.value)} placeholder={nextId || '100'} />
        </Field>
      </div>

      <Field label={kind === 'qemu' ? 'Name' : 'Hostname'}>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder={kind === 'qemu' ? 'my-vm' : 'my-container'} />
      </Field>

      {kind === 'qemu' ? (
        <Field label="ISO Image (boot media)">
          <Select value={isoImage} onChange={setIsoImage}
            options={[{ value: '', label: '— none / install later —' },
              ...isos.map((i) => ({ value: i, label: i.split('/').pop() || i }))]} />
        </Field>
      ) : (
        <Field label="OS Template">
          <Select value={template} onChange={setTemplate}
            options={[{ value: '', label: '— select template —' },
              ...templates.map((t) => ({ value: t, label: t.split('/').pop() || t }))]} />
        </Field>
      )}

      <div className="field-row">
        <Field label="CPU Cores"><input type="number" value={cores} onChange={(e) => setCores(e.target.value)} min={1} /></Field>
        <Field label="Memory (MiB)"><input type="number" value={memory} onChange={(e) => setMemory(e.target.value)} min={16} step={256} /></Field>
      </div>

      <div className="field-row">
        <Field label="Disk Size (GiB)"><input type="number" value={diskGb} onChange={(e) => setDiskGb(e.target.value)} min={1} /></Field>
        <Field label="Disk Storage">
          <Select value={diskStorage} onChange={setDiskStorage}
            options={diskStores.length ? diskStores.map((s) => ({ value: s.storage, label: s.storage }))
              : [{ value: '', label: 'no suitable storage' }]} />
        </Field>
      </div>

      <div className="field-row">
        <Field label="Network Bridge"><input value={bridge} onChange={(e) => setBridge(e.target.value)} placeholder="vmbr0" /></Field>
        {kind === 'lxc' && (
          <Field label="Root Password"><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        )}
      </div>

      <div className="checkbox-row" style={{ marginTop: 6 }}>
        <input id="startnow" type="checkbox" checked={start} onChange={(e) => setStart(e.target.checked)} />
        <label htmlFor="startnow">Start after creation</label>
      </div>
    </Modal>
  );
}
