import { expect, describe, it, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from '../src/renderer/App';
import type { PmxApi } from '../src/preload/index';
import type { UpdateStatus } from '../src/shared/types';

function mockPmx(overrides: Partial<PmxApi> = {}): PmxApi {
  return {
    version: async () => '1.7.2',
    profiles: { list: async () => [], save: async () => [], delete: async () => [] },
    session: { connect: async () => ({ ok: true }), disconnect: async () => true, current: async () => ({ ok: true }) },
    settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, autoConnect: false }), set: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true, autoConnect: false }) },
    pve: {
      get: async () => ({ ok: true, data: { data: [] } }),
      post: async () => ({ ok: true }),
      put: async () => ({ ok: true }),
      del: async () => ({ ok: true }),
      guestAction: async () => ({ ok: true }),
      rrd: async () => ({ ok: true }),
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

let emitUpdateCbs: Array<(s: UpdateStatus) => void> = [];
const emitUpdate = (s: UpdateStatus) => emitUpdateCbs.forEach((cb) => cb(s));

beforeEach(() => {
  emitUpdateCbs = [];
  window.pmx = mockPmx({
    updates: {
      check: async () => ({ ok: true }),
      download: async () => ({ ok: true }),
      install: async () => ({ ok: true }),
      onEvent: (cb: (s: UpdateStatus) => void) => {
        emitUpdateCbs.push(cb);
        return () => { emitUpdateCbs = emitUpdateCbs.filter((c) => c !== cb); };
      },
    },
  });
});

afterEach(() => {
  delete (window as any).pmx;
  emitUpdateCbs = [];
});

async function waitForConnectScreen() {
  await screen.findByRole('button', { name: /New Connection/i });
}

async function completeConnectScreen() {
  await waitForConnectScreen();
  const hostInput = await screen.findByPlaceholderText('192.168.1.10');
  await userEvent.type(hostInput, '192.168.1.10');
  await userEvent.type(screen.getByPlaceholderText('root@pam!mytoken'), 'root@pam!apitoken');
  await userEvent.type(screen.getByPlaceholderText('xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'), 'secret-value');
  await userEvent.click(screen.getByRole('button', { name: /⚡\s*Connect/i }));
  await waitFor(() => expect(screen.getByText(/Connected to 192\.168\.1\.10/)).toBeInTheDocument());
}

describe('Updater flow', () => {
  it('shows update-ready badge after checking → available → downloaded events', async () => {
    render(<App />);

    await completeConnectScreen();

    act(() => { emitUpdate({ event: 'checking' }); });
    act(() => { emitUpdate({ event: 'available', version: '1.8.0' }); });
    act(() => { emitUpdate({ event: 'downloaded', version: '1.8.0' }); });

    await waitFor(() => expect(document.querySelector('.update-badge')?.textContent).toMatch(/v1\.8\.0 ready/));
  });

  it('opens update manager modal on available event', async () => {
    render(<App />);
    await waitForConnectScreen();

    act(() => { emitUpdate({ event: 'available', version: '1.8.0' }); });

    await waitFor(() => expect(screen.getByText(/A new version of ProxTop is available/)).toBeInTheDocument());
  });

  it('shows install-ready UI after downloaded event in modal', async () => {
    render(<App />);
    await waitForConnectScreen();

    act(() => { emitUpdate({ event: 'available', version: '1.8.0' }); });
    await waitFor(() => expect(screen.getByText(/A new version of ProxTop is available/)).toBeInTheDocument());

    act(() => { emitUpdate({ event: 'downloaded', version: '1.8.0' }); });
    await waitFor(() => expect(screen.getByText(/is ready/)).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /Restart & install/ })).toBeInTheDocument();
  });
});
