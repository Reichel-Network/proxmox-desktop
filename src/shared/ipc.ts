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
  // Side-panel embedded console (BrowserView)
  EMBEDDED_CONSOLE_OPEN: 'console:embeddedOpen',
  EMBEDDED_CONSOLE_CLOSE: 'console:embeddedClose',
  EMBEDDED_CONSOLE_BOUNDS: 'console:embeddedBounds',
  // Settings (theme etc.)
  SETTINGS_GET: 'app:settingsGet',
  SETTINGS_SET: 'app:settingsSet',
  // Auto update
  UPDATE_CHECK: 'app:updateCheck',
  UPDATE_EVENT: 'app:updateEvent',
  UPDATE_DOWNLOAD: 'app:updateDownload',
  UPDATE_INSTALL: 'app:updateInstall',
  // Native notification
  NOTIFY: 'app:notify',
  // External
  OPEN_EXTERNAL: 'app:openExternal',
  APP_VERSION: 'app:version',
  // Community helper scripts catalog
  SCRIPTS_CATALOG: 'scripts:catalog',
  SCRIPTS_DETAIL: 'scripts:detail',
  // Node shell (termproxy websocket bridge)
  SHELL_OPEN: 'shell:open',
  SHELL_DATA: 'shell:data',     // main -> renderer: output chunk
  SHELL_INPUT: 'shell:input',   // renderer -> main: keystrokes
  SHELL_RESIZE: 'shell:resize',
  SHELL_CLOSE: 'shell:close',
  SHELL_STATUS: 'shell:status', // main -> renderer: open/closed/error
} as const;

export type IpcChannel = (typeof IPC)[keyof typeof IPC];
