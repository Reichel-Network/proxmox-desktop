import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GuestDetail } from '../src/renderer/views/GuestDetail';
import { ToastProvider } from '../src/renderer/components/Toast';
import type { PmxApi } from '../src/preload/index';
import type { PveGuest } from '../src/shared/types';

function mockPmx(overrides: Partial<PmxApi> = {}): PmxApi {
  return {
    version: async () => '1.7.2',
    profiles: { list: async () => [], save: async () => [], delete: async () => [] },
    session: { connect: async () => ({ ok: true }), disconnect: async () => true, current: async () => ({ ok: true }) },
    settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }), set: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }) },
    pve: {
      get: async () => ({ ok: true, data: { data: {} } }),
      post: async () => ({ ok: true }),
      put: async () => ({ ok: true }),
      del: async () => ({ ok: true }),
      guestAction: async () => ({ ok: true }),
      rrd: async () => ({ ok: true, data: { data: [] } }),
      consoleOpen: async () => true,
      consoleWindow: async () => true,
      embeddedConsoleOpen: async () => true,
      embeddedConsoleClose: async () => true,
      embeddedConsoleBounds: async () => true,
      onConsoleLayout: () => () => {},
      snapshotList: async () => [],
      snapshotAction: async () => ({ ok: true }),
      taskLog: async () => '',
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

const baseGuest: PveGuest = {
  vmid: 100,
  name: 'test-vm',
  node: 'pve1',
  type: 'qemu',
  status: 'running',
  maxcpu: 2,
  maxmem: 1024 * 1024 * 1024,
};

function renderDetail(guest: PveGuest = baseGuest, pveOverrides: Partial<PmxApi['pve']> = {}) {
  window.pmx = mockPmx({ pve: { ...mockPmx().pve, ...pveOverrides } });
  return render(
    <ToastProvider>
      <GuestDetail guest={guest} onClose={() => {}} onAction={async () => {}} />
    </ToastProvider>
  );
}

beforeEach(() => {
  window.pmx = mockPmx();
});

afterEach(() => {
  delete (window as any).pmx;
});

describe('GuestDetail tabs', () => {
  it('renders the Overview tab by default', async () => {
    renderDetail();
    expect(await screen.findByText(/Overview/)).toBeInTheDocument();
    expect(screen.getAllByText(/^CPU$/).length).toBeGreaterThan(0);
  });

  it('switches to Snapshots tab and shows snapshot UI', async () => {
    renderDetail(baseGuest, {
      get: async (path: string) => {
        if (path.includes('/snapshot')) {
          return { ok: true, data: { data: [{ name: 'current', snaptime: 0 }, { name: 'snap1', snaptime: 1234567890, vmstate: 1 }] } };
        }
        return { ok: true, data: { data: {} } };
      },
    });

    await userEvent.click(screen.getByText(/Snapshots/));
    await waitFor(() => expect(screen.getByText(/snap1/)).toBeInTheDocument());
    expect(screen.getByText(/Take Snapshot/)).toBeInTheDocument();
  });

  it('switches to Config tab and shows config UI', async () => {
    renderDetail(baseGuest, {
      get: async (path: string) => {
        if (path.includes('/config')) {
          return { ok: true, data: { data: { name: 'test-vm', cores: 2, memory: 1024, scsi0: 'local-lvm:8' } } };
        }
        return { ok: true, data: { data: {} } };
      },
    });

    await userEvent.click(screen.getByText(/Config/));
    await waitFor(() => expect(screen.getByDisplayValue(/test-vm/)).toBeInTheDocument());
    expect(screen.getByText(/General/)).toBeInTheDocument();
    expect(screen.getByText(/Hardware/)).toBeInTheDocument();
  });

  it('switches to Notes tab and shows notes UI', async () => {
    renderDetail(baseGuest, {
      get: async (path: string) => {
        if (path.includes('/config')) {
          return { ok: true, data: { data: { description: 'My note', tags: 'web,prod' } } };
        }
        return { ok: true, data: { data: {} } };
      },
    });

    await userEvent.click(screen.getByText(/Notes & Tags/));
    await waitFor(() => expect(screen.getByText(/web/)).toBeInTheDocument());
    expect(screen.getByText(/Notes \(Markdown\)/)).toBeInTheDocument();
  });

  it('switches to Firewall tab and shows firewall rules', async () => {
    renderDetail(baseGuest, {
      get: async (path: string) => {
        if (path.includes('/firewall/rules')) {
          return { ok: true, data: { data: [{ pos: 1, type: 'in', action: 'ACCEPT', enable: 1 }] } };
        }
        return { ok: true, data: { data: {} } };
      },
    });

    await userEvent.click(screen.getByText(/Firewall/));
    await waitFor(() => expect(screen.getByText(/ACCEPT/)).toBeInTheDocument());
    expect(screen.getByText(/Add Rule/)).toBeInTheDocument();
  });
});
