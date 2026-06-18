import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { App } from '../src/renderer/App';
import type { ConnectionProfile, AppSettings, PmxApi } from '../src/preload/index';

function mockPmx(overrides: Partial<PmxApi> = {}): PmxApi {
  const profiles: ConnectionProfile[] = [];
  let currentSettings: AppSettings = { theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, autoConnect: true };

  return {
    version: async () => '1.7.5',
    profiles: {
      list: async () => profiles,
      save: async (p: ConnectionProfile) => { profiles.push(p); return profiles; },
      delete: async () => profiles,
    },
    session: {
      connect: async () => ({ ok: true }),
      disconnect: async () => ({ ok: true }),
      current: async () => ({ ok: false }),
    },
    settings: {
      get: async () => currentSettings,
      set: async (s: Partial<AppSettings>) => { currentSettings = { ...currentSettings, ...s }; return currentSettings; },
    },
    openExternal: () => {},
    pve: {
      clusterResources: async () => ({ ok: true, data: { data: [] } }),
      nodes: async () => ({ ok: true, data: { data: [] } }),
      get: async () => ({ ok: true, data: { data: [] } }),
      post: async () => ({ ok: true, data: {} }),
      consoleOpen: async () => true,
      consoleWindowOpen: async () => true,
      embeddedConsoleOpen: async () => true,
      embeddedConsoleClose: async () => true,
      embeddedConsoleBounds: async () => true,
      onConsoleLayout: () => () => {},
      taskLog: async () => '',
      guestAction: async () => ({ ok: true }),
      snapshotList: async () => [],
      snapshotAction: async () => ({ ok: true }),
      rrd: async () => ({ ok: true, data: { data: [] } }),
    },
    shell: {
      open: async () => ({ ok: true }),
      input: vi.fn(),
      close: vi.fn(),
      resize: vi.fn(),
      onData: () => () => {},
      onStatus: () => () => {},
    },
    scripts: { catalog: async () => ({ ok: true, data: { scripts: [], categories: [] } }), detail: async () => ({ ok: true, data: { command: '' } }) },
    updates: { check: async () => ({ ok: true, data: null }), download: async () => ({ ok: true }), install: async () => ({ ok: true }), onEvent: () => () => {} },
    notify: async () => ({ ok: true }),
    ...overrides,
  } as any;
}

describe('App auto-connect', () => {
  afterEach(() => { delete (window as any).pmx; });

  it('auto-connects to the last used profile and lands on shell', async () => {
    const saved: ConnectionProfile = {
      id: 'p1', name: 'Lab', host: '192.168.1.10', port: 8006, authMethod: 'token',
      tokenId: 'root@pam!lab', tokenSecret: 'secret', verifySsl: false, createdAt: 1,
    };
    const api = mockPmx({
      settings: {
        get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, autoConnect: true, lastProfileId: 'p1' }),
        set: async (s: any) => s,
      },
      profiles: { list: async () => [saved], save: async () => [], delete: async () => [] },
      session: { connect: async () => ({ ok: true }), disconnect: async () => true, current: async () => ({ ok: false }) },
    });
    (window as any).pmx = api;

    render(<App />);
    await screen.findByText(/Reconnecting to last Proxmox host/i, {}, { timeout: 1000 });
    await waitFor(() => expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument(), { timeout: 1500 });
    expect(screen.getByRole('button', { name: /Disconnect/i })).toBeInTheDocument();
  });

  it('skips auto-connect when disabled and shows connect screen', async () => {
    const saved: ConnectionProfile = {
      id: 'p1', name: 'Lab', host: '192.168.1.10', port: 8006, authMethod: 'token',
      tokenId: 'root@pam!lab', tokenSecret: 'secret', verifySsl: false, createdAt: 1,
    };
    const connect = vi.fn().mockResolvedValue({ ok: true });
    const api = mockPmx({
      settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, autoConnect: false, lastProfileId: 'p1' }), set: async (s: any) => s },
      profiles: { list: async () => [saved], save: async () => [], delete: async () => [] },
      session: { connect, disconnect: async () => true, current: async () => ({ ok: false }) },
    });
    (window as any).pmx = api;

    render(<App />);
    await waitFor(() => expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument());
    expect(connect).not.toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: /New Connection/i })).toBeInTheDocument();
  });

  it('falls back to connect screen when auto-connect fails', async () => {
    const saved: ConnectionProfile = {
      id: 'p1', name: 'Lab', host: '192.168.1.10', port: 8006, authMethod: 'token',
      tokenId: 'root@pam!lab', tokenSecret: 'secret', verifySsl: false, createdAt: 1,
    };
    const api = mockPmx({
      settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, autoConnect: true, lastProfileId: 'p1' }), set: async (s: any) => s },
      profiles: { list: async () => [saved], save: async () => [], delete: async () => [] },
      session: { connect: async () => ({ ok: false, error: 'Host down' }), disconnect: async () => true, current: async () => ({ ok: false }) },
    });
    (window as any).pmx = api;

    render(<App />);
    await screen.findByText(/Reconnecting to last Proxmox host/i, {}, { timeout: 1000 });
    await waitFor(() => expect(screen.queryByText(/Reconnecting/i)).not.toBeInTheDocument(), { timeout: 1500 });
    expect(await screen.findByRole('button', { name: /New Connection/i })).toBeInTheDocument();
  });
});
