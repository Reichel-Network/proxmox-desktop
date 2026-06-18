import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectScreen } from '../src/renderer/views/ConnectScreen';
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

describe('ConnectScreen', () => {
  it('fills host, token id, token secret and saves profile', async () => {
    const saveSpy = vi.fn().mockResolvedValue([]);
    window.pmx.profiles.save = saveSpy;

    const onConnected = vi.fn();

    render(
      <ToastProvider>
        <ConnectScreen onConnected={onConnected} />
      </ToastProvider>
    );

    await waitFor(() => expect(screen.getByText(/Proxmox VE Management Client · v1\.7\.2/)).toBeInTheDocument());

    await userEvent.type(screen.getByPlaceholderText('192.168.1.10'), '192.168.1.10');
    await userEvent.type(screen.getByPlaceholderText('root@pam!mytoken'), 'root@pam!apitoken');
    await userEvent.type(screen.getByPlaceholderText('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), 'secret-value');

    await userEvent.click(screen.getByRole('button', { name: '⚡Connect' }));

    await waitFor(() => expect(saveSpy).toHaveBeenCalledTimes(1));

    const saved = saveSpy.mock.calls[0][0];
    expect(saved.host).toBe('192.168.1.10');
    expect(saved.tokenId).toBe('root@pam!apitoken');
    expect(saved.tokenSecret).toBe('secret-value');
    expect(saved.name).toBe('192.168.1.10');

    expect(onConnected).toHaveBeenCalledWith(expect.objectContaining({
      host: '192.168.1.10',
      tokenId: 'root@pam!apitoken',
      tokenSecret: 'secret-value',
    }));
  });
});
