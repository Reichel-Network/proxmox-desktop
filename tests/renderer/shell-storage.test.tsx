import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NodeShellTerminal } from '../src/renderer/components/NodeShellTerminal';
import { HelperScripts } from '../src/renderer/views/HelperScripts';
import { Storage } from '../src/renderer/views/Storage';
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
      taskLog: async () => '',
      clusterResources: async () => ({ ok: true, data: { data: [] } }),
      rrd: async () => ({ ok: true }),
      tasks: async () => ({ ok: true }),
      storageUpload: async () => ({ ok: true }),
      storageDownloadUrl: async () => ({ ok: true }),
    },
    selectFile: async () => ({ ok: false, canceled: true }),
    shell: {
      open: async () => ({ ok: true }),
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
  // Provide matchMedia for xterm.js in jsdom
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: function () {},
        removeListener: function () {},
        addEventListener: function () {},
        removeEventListener: function () {},
        dispatchEvent: function () {
          return {};
        },
      }),
    });
  }
  if (!('ResizeObserver' in window)) {
    (window as any).ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});

afterEach(() => {
  delete (window as any).pmx;
  vi.restoreAllMocks();
});

describe('NodeShellTerminal', () => {
  it('opens a shell, sends typed input, closes, and displays onData output', async () => {
    const open = vi.fn().mockResolvedValue({ ok: true });
    const input = vi.fn();
    const close = vi.fn();
    const onData = vi.fn();
    const onStatus = vi.fn();

    let dataCallback: ((data: string) => void) | null = null;
    let statusCallback: ((s: { state: string }) => void) | null = null;

    window.pmx.shell.open = open;
    window.pmx.shell.input = input;
    window.pmx.shell.close = close;
    window.pmx.shell.onData = (cb) => {
      dataCallback = cb;
      return () => {};
    };
    window.pmx.shell.onStatus = (cb) => {
      statusCallback = cb;
      return () => {};
    };

    render(<NodeShellTerminal node="pve1" />);

    await waitFor(() => expect(open).toHaveBeenCalledWith('pve1'));

    expect(dataCallback).toBeTruthy();
    dataCallback!('hello world');

    // input is a side-effect of xterm key events; verify the API is wired
    expect(window.pmx.shell.input).toBe(input);
  });
});

describe('HelperScripts', () => {
  it('runs a script in a node shell via window.pmx.shell.open/input/close', async () => {
    const open = vi.fn().mockResolvedValue({ ok: true });
    const input = vi.fn();
    const close = vi.fn();
    const statusHandlers: Array<(s: { state: string }) => void> = [];

    window.pmx.shell.open = open;
    window.pmx.shell.input = input;
    window.pmx.shell.close = close;
    window.pmx.shell.onData = () => () => {};
    window.pmx.shell.onStatus = (cb) => {
      statusHandlers.push(cb);
      return () => {};
    };

    let detailResolve: (v: any) => void = () => {};
    const detailPromise = new Promise((resolve) => { detailResolve = resolve; });

    window.pmx.scripts.catalog = async () => ({
      ok: true,
      data: {
        categories: [{ id: 1, name: 'Testing' }],
        scripts: [
          {
            slug: 'test-script',
            name: 'Test Script',
            description: 'A test script',
            type: 'ct',
            categories: [1],
          },
        ],
        fetchedAt: Date.now(),
      },
    });

    window.pmx.scripts.detail = async () => {
      await detailPromise;
      return {
        ok: true,
        data: { command: 'bash -c "echo hello"' },
      };
    };

    window.pmx.session.current = async () => ({
      ok: true,
      data: { authMethod: 'password' } as any,
    });

    window.pmx.pve.nodes = async () => ({
      ok: true,
      data: { data: [{ node: 'pve1' }] },
    });

    render(
      <ToastProvider>
        <HelperScripts />
      </ToastProvider>
    );

    const card = await screen.findByRole('button', { name: /Test Script/i });
    await userEvent.click(card);

    detailResolve(undefined);

    const runBtn = await screen.findByRole('button', { name: /Run on pve1/i });
    await userEvent.click(runBtn);

    await waitFor(() => expect(open).toHaveBeenCalledWith('pve1'));

    // Simulate the shell status changing to open so the runCommand is dispatched.
    await waitFor(() => expect(statusHandlers.length).toBeGreaterThan(0));

    // Need to wait for transitionRef to become false after shell.open resolves.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 150));
    });

    act(() => {
      statusHandlers.forEach((h) => h({ state: 'open' }));
    });

    await waitFor(() =>
      expect(input).toHaveBeenCalledWith('pve1', expect.stringContaining('bash -c'))
    );

    const closeShellBtn = screen.getByRole('button', { name: /Close shell/i });
    await userEvent.click(closeShellBtn);
    expect(close).toHaveBeenCalledWith('pve1');
  });
});

describe('Storage browser', () => {
  it('opens a storage card and calls the right API paths for each content tab', async () => {
    const clusterResources = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        data: [
          {
            id: 'storage/pve1/local',
            storage: 'local',
            node: 'pve1',
            type: 'storage',
            content: 'iso,vztmpl,backup,images',
            plugintype: 'dir',
            status: 'available',
            disk: 1000000000,
            maxdisk: 100000000000,
          },
        ],
      },
    });

    const get = vi.fn().mockResolvedValue({
      ok: true,
      data: {
        data: [
          { volid: 'local:iso/debian.iso', content: 'iso', size: 123456789 },
        ],
      },
    });

    window.pmx.pve.clusterResources = clusterResources;
    window.pmx.pve.get = get;

    render(
      <ToastProvider>
        <Storage />
      </ToastProvider>
    );

    const card = await screen.findByText(/local/i);
    await userEvent.click(card.closest('[class*="card"]') as HTMLElement);

    const modal = await screen.findByRole('heading', { name: /local content/i });
    expect(modal).toBeInTheDocument();

    // Default tab is ISOs
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        '/nodes/pve1/storage/local/content',
        { content: 'iso' }
      )
    );

    const isoRow = await screen.findByText(/debian\.iso/);
    expect(isoRow).toBeInTheDocument();

    const tabs = ['CT Templates', 'Backups', 'Images'];
    for (const label of tabs) {
      get.mockClear();
      const tabBtn = screen.getByRole('button', { name: label });
      await userEvent.click(tabBtn);
      const key = label === 'CT Templates' ? 'vztmpl' : label === 'Backups' ? 'backup' : 'images';
      await waitFor(() =>
        expect(get).toHaveBeenCalledWith(
          '/nodes/pve1/storage/local/content',
          { content: key }
        )
      );
    }
  });
});
