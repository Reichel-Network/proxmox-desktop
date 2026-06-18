import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Permissions } from '../src/renderer/views/Permissions';
import { Storage } from '../src/renderer/views/Storage';
import { Pools } from '../src/renderer/views/Pools';
import { Users } from '../src/renderer/views/Users';
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
});

afterEach(() => {
  delete (window as any).pmx;
});

describe('Permissions view', () => {
  it('parses the object-map response without crashing', async () => {
    window.pmx.pve.get = async () => ({
      ok: true,
      data: {
        data: {
          '/storage': { 'Sys.Audit': 1, 'VM.Audit': 1 },
          '/access': { 'Permissions.Modify': 1 },
        },
      },
    });

    render(
      <ToastProvider>
        <Permissions />
      </ToastProvider>
    );

    const rows = await screen.findAllByText(/Sys\.Audit/);
    expect(rows.length).toBeGreaterThan(0);
  });

  it('handles empty permissions', async () => {
    window.pmx.pve.get = async () => ({ ok: true, data: { data: {} } });
    render(
      <ToastProvider>
        <Permissions />
      </ToastProvider>
    );
    expect(await screen.findByText('No permissions found')).toBeInTheDocument();
  });
});

describe('Storage view', () => {
  it('lists storage cards', async () => {
    window.pmx.pve.clusterResources = async () => ({
      ok: true,
      data: {
        data: [{ id: 'storage/node1/local', storage: 'local', node: 'node1', type: 'storage', content: 'iso,vztmpl', used_fraction: 0.3 }],
      },
    });
    render(
      <ToastProvider>
        <Storage />
      </ToastProvider>
    );
    expect(await screen.findByText(/local/)).toBeInTheDocument();
  });
});

describe('Pools view', () => {
  it('shows empty state', async () => {
    window.pmx.pve.get = async () => ({ ok: true, data: { data: [] } });
    render(
      <ToastProvider>
        <Pools />
      </ToastProvider>
    );
    expect(await screen.findByText(/no pools/i)).toBeInTheDocument();
  });
});

describe('Users view', () => {
  it('shows users', async () => {
    window.pmx.pve.get = async () => ({
      ok: true,
      data: {
        data: [{ userid: 'root@pam', enable: 1, 'realm-type': 'pam' }],
      },
    });
    render(
      <ToastProvider>
        <Users />
      </ToastProvider>
    );
    expect(await screen.findByText(/root@pam/)).toBeInTheDocument();
  });
});
