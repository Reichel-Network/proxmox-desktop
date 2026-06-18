import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Dashboard } from '../src/renderer/views/Dashboard';
import { ToastProvider } from '../src/renderer/components/Toast';
import type { PmxApi } from '../src/preload/index';

function mockPmx(overrides: Partial<PmxApi> = {}): PmxApi {
  return {
    version: async () => '1.7.2',
    profiles: { list: async () => [], save: async () => [], delete: async () => [] },
    session: { connect: async () => ({ ok: true }), disconnect: async () => true, current: async () => ({ ok: true }) },
    settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }), set: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }) },
    pve: {
      get: async () => ({ ok: true, data: { data: [] } }),
      post: async () => ({ ok: true }),
      put: async () => ({ ok: true }),
      del: async () => ({ ok: true }),
      nodes: async () => ({ ok: true, data: { data: [] } }),
      guestAction: async () => ({ ok: true }),
      consoleOpen: async () => true,
      consoleWindow: async () => true,
      embeddedConsoleOpen: async () => true,
      embeddedConsoleClose: async () => true,
      embeddedConsoleBounds: async () => true,
      onConsoleLayout: () => () => {},
      snapshotList: async () => [],
      snapshotAction: async () => ({ ok: true }),
      taskLog: async () => ({ ok: true, data: { data: [] } }),
      tasks: async () => ({ ok: true, data: { data: [] } }),
      clusterResources: async () => ({ ok: true, data: { data: [] } }),
    },
    shell: {
      open: async () => true,
      input: () => {},
      resize: () => {},
      close: () => {},
      onData: () => () => {},
      onStatus: () => () => {},
    },
    scripts: {
      catalog: async () => ({ ok: true, data: { categories: [], scripts: [], fetchedAt: Date.now() } }),
      detail: async () => ({ ok: true }),
    },
    updates: { check: async () => ({ ok: true }), download: async () => ({ ok: true }), install: async () => ({ ok: true }), onEvent: () => () => {} },
    openExternal: async () => ({ ok: true }),
    notify: async () => true,
    ...overrides,
  } as unknown as PmxApi;
}

beforeEach(() => {
  window.pmx = mockPmx();
});

afterEach(() => {
  delete (window as any).pmx;
  vi.useRealTimers?.();
});

const clusterResources = [
  {
    id: 'node/pve1',
    type: 'node',
    node: 'pve1',
    status: 'online',
    maxcpu: 8,
    cpu: 0.25,
    maxmem: 32 * 1024 * 1024 * 1024,
    mem: 8 * 1024 * 1024 * 1024,
    maxdisk: 500 * 1024 * 1024 * 1024,
    disk: 120 * 1024 * 1024 * 1024,
    uptime: 86400,
  },
  {
    id: 'qemu/pve1/101',
    type: 'qemu',
    node: 'pve1',
    vmid: 101,
    name: 'web',
    status: 'running',
  },
  {
    id: 'qemu/pve1/102',
    type: 'qemu',
    node: 'pve1',
    vmid: 102,
    name: 'db',
    status: 'stopped',
  },
  {
    id: 'lxc/pve1/200',
    type: 'lxc',
    node: 'pve1',
    vmid: 200,
    name: 'proxy',
    status: 'running',
  },
  {
    id: 'storage/pve1/local',
    type: 'storage',
    node: 'pve1',
    storage: 'local',
    plugintype: 'dir',
    content: 'iso,vztmpl',
    maxdisk: 100 * 1024 * 1024 * 1024,
    disk: 30 * 1024 * 1024 * 1024,
  },
];

describe('Dashboard view', () => {
  it('renders summary cards with cluster resource counts', async () => {
    window.pmx.pve.clusterResources = vi.fn(async () => ({
      ok: true,
      data: { data: clusterResources },
    })) as any;

    render(
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    );

    expect(await screen.findByText('Nodes')).toBeInTheDocument();
    expect(await screen.findByText('Virtual Machines')).toBeInTheDocument();
    expect(await screen.findByText('LXC Containers')).toBeInTheDocument();
    expect(await screen.findByText('Total CPUs')).toBeInTheDocument();
    expect(await screen.findByText('Cluster Memory')).toBeInTheDocument();

    const statValues = screen.getAllByText(/\b(\d+\.?\d*\s*(GiB|B|KiB|MiB|TiB)?|online|running)\b/).map((el) => el.textContent);
    expect(statValues).toEqual(expect.arrayContaining(['1', '2', '1', '8', '1 online', '1 running', '1 running']));
  });

  it('renders the nodes table', async () => {
    window.pmx.pve.clusterResources = vi.fn(async () => ({
      ok: true,
      data: { data: clusterResources },
    })) as any;

    render(
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    );

    expect(await screen.findByText('🖥️ Nodes')).toBeInTheDocument();
    const [nodeNameCell] = screen.getAllByText('pve1');
    expect(nodeNameCell).toBeInTheDocument();
    expect(nodeNameCell.tagName).toBe('TD');
    expect(await screen.findByText('online')).toBeInTheDocument();
  });

  it('renders the storage table', async () => {
    window.pmx.pve.clusterResources = vi.fn(async () => ({
      ok: true,
      data: { data: clusterResources },
    })) as any;

    render(
      <ToastProvider>
        <Dashboard />
      </ToastProvider>
    );

    expect(await screen.findByText('💾 Storage')).toBeInTheDocument();
    expect(await screen.findByText('local')).toBeInTheDocument();
    expect(await screen.findByText('dir')).toBeInTheDocument();
  });
});
