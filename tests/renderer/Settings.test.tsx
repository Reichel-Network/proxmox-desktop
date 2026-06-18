import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Settings } from '../src/renderer/views/Settings';
import { ToastProvider } from '../src/renderer/components/Toast';
import type { PmxApi, AppSettings, ConnectionProfile } from '../src/preload/index';

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

const baseProfile: ConnectionProfile = {
  id: 'p1',
  name: 'Homelab',
  host: '192.168.1.10',
  port: 8006,
  authMethod: 'token',
  tokenId: 'root@pam!t1',
  tokenSecret: 'secret',
  username: 'root@pam',
  password: '',
  verifySsl: false,
  createdAt: Date.now(),
};

const baseSettings: AppSettings = {
  theme: 'dark',
  confirmDestructive: true,
  autoCheckUpdates: true,
};

describe('Settings', () => {
  it('toggling auto-check updates calls window.pmx.settings.set', async () => {
    const setSpy = vi.fn().mockResolvedValue({ ...baseSettings, autoCheckUpdates: false });
    window.pmx.settings.set = setSpy;

    const onSettingsChange = vi.fn();

    render(
      <ToastProvider>
        <Settings profile={baseProfile} settings={baseSettings} onSettingsChange={onSettingsChange} />
      </ToastProvider>
    );

    await waitFor(() => expect(screen.getByText(/1\.7\.2/)).toBeInTheDocument());

    const autoCheckCheckbox = screen.getAllByRole('checkbox')[1];
    await userEvent.click(autoCheckCheckbox);

    await waitFor(() => expect(setSpy).toHaveBeenCalledWith({ autoCheckUpdates: false }));
    expect(onSettingsChange).toHaveBeenCalledWith(expect.objectContaining({ autoCheckUpdates: false }));
  });
});
