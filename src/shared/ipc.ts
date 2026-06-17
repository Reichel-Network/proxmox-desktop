// IPC channel names shared between main and preload/renderer.
export const IPC = {
  // Connection profile management
  PROFILES_LIST: 'profiles:list',
  PROFILES_SAVE: 'profiles:save',
  PROFILES_DELETE: 'profiles:delete',
  // Session
  CONNECT: 'pve:connect',
  DISCONNECT: 'pve:disconnect',
  CURRENT: 'pve:current',
  // Generic API passthrough
  API_GET: 'pve:get',
  API_POST: 'pve:post',
  API_PUT: 'pve:put',
  API_DELETE: 'pve:delete',
  // High level helpers
  CLUSTER_RESOURCES: 'pve:clusterResources',
  NODES: 'pve:nodes',
  GUEST_ACTION: 'pve:guestAction',
  RRD: 'pve:rrd',
  TASKS: 'pve:tasks',
  TASK_LOG: 'pve:taskLog',
  CONSOLE: 'pve:console',
  // Embedded console window
  CONSOLE_WINDOW: 'pve:consoleWindow',
  // Settings (theme etc.)
  SETTINGS_GET: 'app:settingsGet',
  SETTINGS_SET: 'app:settingsSet',
  // Auto update
  UPDATE_CHECK: 'app:updateCheck',
  UPDATE_EVENT: 'app:updateEvent',
  UPDATE_INSTALL: 'app:updateInstall',
  // Native notification
  NOTIFY: 'app:notify',
  // External
  OPEN_EXTERNAL: 'app:openExternal',
  APP_VERSION: 'app:version',
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
