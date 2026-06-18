import { expect, describe, it, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Tasks } from '../src/renderer/views/Tasks';
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
      nodes: async () => ({ ok: true, data: { data: [{ node: 'pve1' }] } }),
      guestAction: async () => ({ ok: true }),
      consoleOpen: async () => true,
      consoleWindow: async () => true,
      embeddedConsoleOpen: async () => true,
      embeddedConsoleClose: async () => true,
      embeddedConsoleBounds: async () => true,
      onConsoleLayout: () => () => {},
      snapshotList: async () => [],
      snapshotAction: async () => ({ ok: true }),
      taskLog: async () => ({ ok: true, data: { data: [{ n: 1, t: 'log line one' }, { n: 2, t: 'log line two' }] } }),
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

const mockTask = {
  upid: 'UPID:pve1:00001234:00123456:1234567890:vzdump:101:root@pam:',
  node: 'pve1',
  type: 'vzdump',
  id: '101',
  user: 'root@pam',
  starttime: Math.floor(Date.now() / 1000) - 120,
  endtime: Math.floor(Date.now() / 1000) - 60,
  status: 'OK',
};

describe('Tasks view', () => {
  it('renders task rows', async () => {
    window.pmx.pve.tasks = vi.fn(async () => ({
      ok: true,
      data: { data: [mockTask] },
    })) as any;

    render(
      <ToastProvider>
        <Tasks />
      </ToastProvider>
    );

    expect(await screen.findByText('vzdump')).toBeInTheDocument();
    expect(await screen.findByText('101')).toBeInTheDocument();
    expect(await screen.findByText('root@pam')).toBeInTheDocument();
  });

  it('opens the task log when a row is clicked', async () => {
    const taskLog = vi.fn(async () => ({
      ok: true,
      data: { data: [{ n: 1, t: 'task log output' }] },
    })) as any;
    window.pmx.pve.taskLog = taskLog;
    window.pmx.pve.tasks = vi.fn(async () => ({
      ok: true,
      data: { data: [mockTask] },
    })) as any;

    render(
      <ToastProvider>
        <Tasks />
      </ToastProvider>
    );

    const row = await screen.findByText('vzdump');
    fireEvent.click(row.closest('tr')!);

    await waitFor(() => {
      expect(taskLog).toHaveBeenCalledWith(mockTask.node, mockTask.upid);
    });

    expect(await screen.findByText('task log output')).toBeInTheDocument();
  });

  it('shows the View Log button for each task row', async () => {
    window.pmx.pve.tasks = vi.fn(async () => ({
      ok: true,
      data: { data: [mockTask] },
    })) as any;

    render(
      <ToastProvider>
        <Tasks />
      </ToastProvider>
    );

    expect(await screen.findByRole('button', { name: /View Log/i })).toBeInTheDocument();
  });
});
