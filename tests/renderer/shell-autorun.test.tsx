import { expect, describe, it, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { NodeShellTerminal } from '../src/renderer/components/NodeShellTerminal';
import { ToastProvider } from '../src/renderer/components/Toast';
import type { PmxApi } from '../src/preload/index';

type MockFn = ReturnType<typeof vi.fn>;

function mockPmx(overrides: Partial<PmxApi> = {}): PmxApi {
  const input = vi.fn();
  const open = vi.fn();
  const close = vi.fn();
  const resize = vi.fn();
  let dataCb: ((chunk: string) => void) | null = null;
  let statusCb: ((s: any) => void) | null = null;

  const shell = {
    open,
    input,
    close,
    resize,
    onData: (cb: (chunk: string) => void) => { dataCb = cb; return () => { dataCb = null; }; },
    onStatus: (cb: (s: any) => void) => { statusCb = cb; return () => { statusCb = null; }; },
  };

  return {
    version: async () => '1.7.4',
    profiles: { list: async () => [], save: async () => [], delete: async () => [] },
    session: { connect: async () => ({ ok: true }), disconnect: async () => true, current: async () => ({ ok: false }) },
    settings: { get: async () => ({ theme: 'dark', confirmDestructive: true, autoCheckUpdates: true }), set: async () => true },
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
    shell,
    scripts: { catalog: async () => ({ ok: true, data: { scripts: [], categories: [] } }), detail: async () => ({ ok: true, data: { command: 'bash -c "echo hi"' } }) },
    updates: { check: async () => ({ ok: true, data: null }), download: async () => ({ ok: true }), install: async () => ({ ok: true }), onEvent: () => () => {} },
    ...overrides,
    // expose callbacks so tests can drive them
    _dataCb: dataCb as any,
    _statusCb: statusCb as any,
    _input: input as any,
    _open: open as any,
  } as any;
}

function setPmx(api: PmxApi) {
  (window as any).pmx = api;
}

describe('NodeShellTerminal auto-run race', () => {
  let cleanup: (() => void)[] = [];

  beforeEach(() => {
    cleanup = [];
    globalThis.matchMedia = globalThis.matchMedia || (() => ({ matches: false, addListener: () => {}, removeListener: () => {}, addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false })) as any;
    globalThis.ResizeObserver = globalThis.ResizeObserver || class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  });

  afterEach(() => {
    cleanup.forEach((c) => c());
    delete (window as any).pmx;
  });

  it('runs pending command even if status open fires before shell.open resolves', async () => {
    let statusCb: ((s: any) => void) | null = null;
    let resolveOpen: (() => void) | null = null;

    const api = mockPmx();
    const shell = api.shell as any;

    // Override onStatus so test captures callback before open resolves.
    let capturedStatus: ((s: any) => void) | null = null;
    shell.onStatus = (cb: any) => { capturedStatus = cb; return () => { capturedStatus = null; }; };

    shell.open = async () => {
      // Simulate websocket opening before the promise resolves.
      setTimeout(() => {
        capturedStatus?.({ state: 'open' });
      }, 5);
      await new Promise<void>((r) => { resolveOpen = r; });
      return { ok: true };
    };

    setPmx(api);

    const { unmount } = render(
      <ToastProvider>
        <NodeShellTerminal node="node1" runCommand="bash -c 'install lxc'" />
      </ToastProvider>
    );
    cleanup.push(unmount);

    // Wait until after shell.open would have resolved and transitionRef cleared.
    await waitFor(() => expect(resolveOpen).not.toBeNull(), { timeout: 100 });
    resolveOpen!();

    // Command should be sent even though the 'open' status arrived during transition.
    await waitFor(() => expect(api._input.mock.calls.length).toBeGreaterThan(0), { timeout: 1500 });
    expect(api._input).toHaveBeenCalledWith('node1', "bash -c 'install lxc'\n");
  });
});
