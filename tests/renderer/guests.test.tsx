import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Guests } from '../src/renderer/views/Guests';
import { CommandPalette } from '../src/renderer/views/CommandPalette';
import { ToastProvider } from '../src/renderer/components/Toast';
import type { PmxApi } from '../src/preload/index';

function mockPmx(overrides: Partial<PmxApi> = {}): PmxApi {
  return {
    version: async () => '1.7.1',
    profiles: { list: async () => [], save: async () => [], delete: async () => [] },
    session: { connect: async () => ({ ok: true }), disconnect: async () => true, current: async () => ({ ok: true }) },
    settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }), set: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }) },
    pve: {
      get: async () => ({ ok: true, data: { data: [] } }),
      post: async () => ({ ok: true }),
      put: async () => ({ ok: true }),
      del: async () => ({ ok: true }),
      guestAction: async () => ({ ok: true }),
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

beforeEach(() => {
  window.pmx = mockPmx();
  vi.stubGlobal('confirm', vi.fn(() => true));
});

afterEach(() => {
  delete (window as any).pmx;
  vi.unstubAllGlobals();
});

function makeGuest(status: 'running' | 'stopped') {
  return {
    id: `qemu/pve1/101`,
    type: 'qemu',
    vmid: 101,
    name: 'web',
    node: 'pve1',
    status,
    cpu: 0.1,
    maxcpu: 4,
    mem: 1024 * 1024 * 256,
    maxmem: 1024 * 1024 * 1024,
    disk: 1024 * 1024 * 1024 * 5,
    maxdisk: 1024 * 1024 * 1024 * 20,
    uptime: 3600,
  };
}

describe('Guest actions', () => {
  it('calls guestAction with start for a stopped guest', async () => {
    const guestAction = vi.fn(async () => ({ ok: true }));
    const clusterResources = vi.fn(async () => ({ ok: true, data: { data: [makeGuest('stopped')] } }));
    window.pmx.pve.guestAction = guestAction as any;
    window.pmx.pve.clusterResources = clusterResources as any;

    render(
      <ToastProvider>
        <Guests kind="qemu" />
      </ToastProvider>
    );

    expect(await screen.findByText('101')).toBeInTheDocument();
    const startBtn = screen.getByTitle('Start');
    fireEvent.click(startBtn);

    await expect.poll(() => guestAction.mock.calls.length).toBe(1);
    expect(guestAction).toHaveBeenCalledWith('pve1', 'qemu', 101, 'start');
  });

  it('calls guestAction with stop for a running guest', async () => {
    const guestAction = vi.fn(async () => ({ ok: true }));
    window.pmx.pve.guestAction = guestAction as any;
    window.pmx.pve.clusterResources = vi.fn(async () => ({ ok: true, data: { data: [makeGuest('running')] } })) as any;

    render(
      <ToastProvider>
        <Guests kind="qemu" />
      </ToastProvider>
    );

    expect(await screen.findByText('101')).toBeInTheDocument();
    const stopBtn = screen.getByTitle('Stop');
    fireEvent.click(stopBtn);

    await expect.poll(() => guestAction.mock.calls.length).toBe(1);
    expect(guestAction).toHaveBeenCalledWith('pve1', 'qemu', 101, 'stop');
  });

  it('calls guestAction with reboot for a running guest', async () => {
    const guestAction = vi.fn(async () => ({ ok: true }));
    window.pmx.pve.guestAction = guestAction as any;
    window.pmx.pve.clusterResources = vi.fn(async () => ({ ok: true, data: { data: [makeGuest('running')] } })) as any;

    render(
      <ToastProvider>
        <Guests kind="qemu" />
      </ToastProvider>
    );

    expect(await screen.findByText('101')).toBeInTheDocument();
    const rebootBtn = screen.getByTitle('Reboot');
    fireEvent.click(rebootBtn);

    await expect.poll(() => guestAction.mock.calls.length).toBe(1);
    expect(guestAction).toHaveBeenCalledWith('pve1', 'qemu', 101, 'reboot');
  });
});

describe('CommandPalette', () => {
  it('dispatches a guest action when an action item is selected', async () => {
    const guestAction = vi.fn(async () => ({ ok: true }));
    const resources = [makeGuest('running')];
    window.pmx.pve.guestAction = guestAction as any;
    window.pmx.pve.get = vi.fn(async () => ({ ok: true, data: { data: resources } })) as any;

    const onClose = vi.fn();
    render(
      <ToastProvider>
        <CommandPalette open={true} onClose={onClose} onNavigate={vi.fn()} onOpenGuest={vi.fn()} />
      </ToastProvider>
    );

    const input = screen.getByPlaceholderText(/Search VMs/);
    fireEvent.change(input, { target: { value: '101' } });

    const rebootItem = await screen.findByText(/Reboot VM 101/);
    fireEvent.click(rebootItem);

    await expect.poll(() => guestAction.mock.calls.length).toBe(1);
    expect(guestAction).toHaveBeenCalledWith('pve1', 'qemu', 101, 'reboot');
    expect(onClose).toHaveBeenCalled();
  });
});
