import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../shared/ipc';
import type {
  ConnectionProfile,
  ApiResult,
  GuestAction,
  AppSettings,
  UpdateStatus,
} from '../shared/types';

const api = {
  profiles: {
    list: (): Promise<ConnectionProfile[]> => ipcRenderer.invoke(IPC.PROFILES_LIST),
    save: (p: ConnectionProfile): Promise<ConnectionProfile[]> =>
      ipcRenderer.invoke(IPC.PROFILES_SAVE, p),
    delete: (id: string): Promise<ConnectionProfile[]> =>
      ipcRenderer.invoke(IPC.PROFILES_DELETE, id),
  },
  session: {
    connect: (p: ConnectionProfile): Promise<ApiResult> => ipcRenderer.invoke(IPC.CONNECT, p),
    disconnect: (): Promise<ApiResult> => ipcRenderer.invoke(IPC.DISCONNECT),
    current: (): Promise<ApiResult<ConnectionProfile>> => ipcRenderer.invoke(IPC.CURRENT),
  },
  pve: {
    get: (path: string, params?: Record<string, any>): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.API_GET, path, params),
    post: (path: string, params?: Record<string, any>): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.API_POST, path, params),
    put: (path: string, params?: Record<string, any>): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.API_PUT, path, params),
    del: (path: string, params?: Record<string, any>): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.API_DELETE, path, params),
    clusterResources: (type?: string): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.CLUSTER_RESOURCES, type),
    nodes: (): Promise<ApiResult> => ipcRenderer.invoke(IPC.NODES),
    guestAction: (
      node: string,
      type: 'qemu' | 'lxc',
      vmid: number,
      action: GuestAction
    ): Promise<ApiResult> => ipcRenderer.invoke(IPC.GUEST_ACTION, node, type, vmid, action),
    rrd: (
      node: string,
      type: 'qemu' | 'lxc' | 'node',
      vmid: number | null,
      timeframe: string
    ): Promise<ApiResult> => ipcRenderer.invoke(IPC.RRD, node, type, vmid, timeframe),
    tasks: (node: string, limit?: number): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.TASKS, node, limit),
    taskLog: (node: string, upid: string): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.TASK_LOG, node, upid),
    console: (node: string, type: 'qemu' | 'lxc', vmid: number): Promise<ApiResult> =>
      ipcRenderer.invoke(IPC.CONSOLE, node, type, vmid),
    consoleWindow: (
      node: string,
      type: 'qemu' | 'lxc',
      vmid: number,
      name: string
    ): Promise<ApiResult> => ipcRenderer.invoke(IPC.CONSOLE_WINDOW, node, type, vmid, name),
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (s: Partial<AppSettings>): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_SET, s),
  },
  updates: {
    check: (): Promise<ApiResult> => ipcRenderer.invoke(IPC.UPDATE_CHECK),
    install: (): Promise<ApiResult> => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
    onEvent: (cb: (s: UpdateStatus) => void) => {
      const listener = (_e: unknown, payload: UpdateStatus) => cb(payload);
      ipcRenderer.on(IPC.UPDATE_EVENT, listener);
      return () => {
        ipcRenderer.removeListener(IPC.UPDATE_EVENT, listener);
      };
    },
  },
  notify: (title: string, body: string): Promise<ApiResult> =>
    ipcRenderer.invoke(IPC.NOTIFY, title, body),
  version: (): Promise<string> => ipcRenderer.invoke(IPC.APP_VERSION),
  openExternal: (url: string): Promise<ApiResult> => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
};

contextBridge.exposeInMainWorld('pmx', api);

export type PmxApi = typeof api;
