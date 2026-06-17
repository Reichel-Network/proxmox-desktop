import { app, BrowserWindow, BrowserView, ipcMain, shell, safeStorage, Notification } from 'electron';
import path from 'node:path';
import Store from 'electron-store';
import { autoUpdater } from 'electron-updater';
import { ProxmoxClient } from './ProxmoxClient';
import { getCatalog, buildInstallCommand } from './ScriptCatalog';
import { NodeShell } from './NodeShell';
import { IPC } from '../shared/ipc';
import type { ConnectionProfile, GuestAction, AppSettings, ScriptEntry } from '../shared/types';

const isDev = process.env.NODE_ENV === 'development';

interface StoreShape {
  profiles: ConnectionProfile[];
  settings: AppSettings;
}

const store = new Store<StoreShape>({
  name: 'proxmox-desktop',
  defaults: {
    profiles: [],
    settings: { theme: 'dark', confirmDestructive: true, autoCheckUpdates: true },
  },
});

let mainWindow: BrowserWindow | null = null;
let client: ProxmoxClient | null = null;
const consoleWindows = new Map<string, BrowserWindow>();

// ---------- Secret encryption helpers (Windows DPAPI via safeStorage) ----------
const ENC_PREFIX = 'enc:v1:';

function encryptSecret(plain?: string): string | undefined {
  if (!plain) return plain;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return ENC_PREFIX + safeStorage.encryptString(plain).toString('base64');
    }
  } catch {
    /* fall through to plaintext */
  }
  return plain;
}

function decryptSecret(stored?: string): string | undefined {
  if (!stored) return stored;
  if (!stored.startsWith(ENC_PREFIX)) return stored; // legacy plaintext
  try {
    const buf = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(buf);
  } catch {
    return undefined;
  }
}

function encryptProfile(p: ConnectionProfile): ConnectionProfile {
  return {
    ...p,
    tokenSecret: encryptSecret(p.tokenSecret),
    password: encryptSecret(p.password),
    secretsEncrypted: safeStorage.isEncryptionAvailable(),
  };
}

function decryptProfile(p: ConnectionProfile): ConnectionProfile {
  return {
    ...p,
    tokenSecret: decryptSecret(p.tokenSecret),
    password: decryptSecret(p.password),
  };
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#0f1117',
    title: 'Proxmox Desktop',
    autoHideMenuBar: true,
    icon: isDev ? path.join(process.cwd(), 'build/icon.ico') : undefined,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5273');
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.on('resize', () => {
    if (embeddedConsoleView && embeddedConsoleShowing && mainWindow) {
      const [w, h] = mainWindow.getContentSize();
      const panelW = Math.max(320, Math.floor(w * 0.35));
      const topY = 64; // matches .main padding-top
      embeddedConsoleView.setBounds({ x: w - panelW, y: topY, width: panelW, height: h - topY });
      resizeMainContent(panelW);
    }
  });
}

// Accept self-signed certs for console windows (user connects to their own server).
app.on('certificate-error', (event, _wc, _url, _error, _cert, callback) => {
  event.preventDefault();
  callback(true);
});

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdate();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ---------------- Auto update ----------------
function setupAutoUpdate() {
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  const send = (payload: any) => {
    mainWindow?.webContents.send(IPC.UPDATE_EVENT, payload);
  };

  autoUpdater.on('checking-for-update', () => send({ event: 'checking' }));
  autoUpdater.on('update-available', (info) => send({ event: 'available', version: info.version }));
  autoUpdater.on('update-not-available', () => send({ event: 'not-available' }));
  autoUpdater.on('download-progress', (p) =>
    send({ event: 'downloading', percent: Math.round(p.percent) })
  );
  autoUpdater.on('update-downloaded', (info) => send({ event: 'downloaded', version: info.version }));
  autoUpdater.on('error', (err) => send({ event: 'error', message: String(err?.message || err) }));

  const settings = store.get('settings');
  if (settings.autoCheckUpdates && !isDev) {
    // Delay so the window is ready; ignore failure when no update server configured.
    setTimeout(() => autoUpdater.checkForUpdates().catch(() => {}), 4000);
  }
}

ipcMain.handle(IPC.UPDATE_CHECK, async () => {
  try {
    const r = await autoUpdater.checkForUpdates();
    return { ok: true, data: { version: r?.updateInfo?.version } };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Update check failed (no update server configured)' };
  }
});

ipcMain.handle(IPC.UPDATE_INSTALL, async () => {
  try {
    await autoUpdater.downloadUpdate();
    autoUpdater.quitAndInstall();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Download failed' };
  }
});

ipcMain.handle(IPC.APP_VERSION, () => app.getVersion());

// ---------------- Settings ----------------
ipcMain.handle(IPC.SETTINGS_GET, () => store.get('settings'));
ipcMain.handle(IPC.SETTINGS_SET, (_e, s: Partial<AppSettings>) => {
  const merged = { ...store.get('settings'), ...s };
  store.set('settings', merged);
  return merged;
});

// ---------------- Native notifications ----------------
ipcMain.handle(IPC.NOTIFY, (_e, title: string, body: string) => {
  if (Notification.isSupported()) {
    new Notification({ title, body }).show();
  }
  return { ok: true };
});

// ---------------- IPC: profile management ----------------
ipcMain.handle(IPC.PROFILES_LIST, () => {
  return store.get('profiles', []).map(decryptProfile);
});

ipcMain.handle(IPC.PROFILES_SAVE, (_e, profile: ConnectionProfile) => {
  const profiles = store.get('profiles', []);
  const enc = encryptProfile(profile);
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx >= 0) profiles[idx] = enc;
  else profiles.push(enc);
  store.set('profiles', profiles);
  return profiles.map(decryptProfile);
});

ipcMain.handle(IPC.PROFILES_DELETE, (_e, id: string) => {
  const profiles = store.get('profiles', []).filter((p) => p.id !== id);
  store.set('profiles', profiles);
  return profiles.map(decryptProfile);
});

// ---------------- IPC: session ----------------
ipcMain.handle(IPC.CONNECT, async (_e, profile: ConnectionProfile) => {
  client = new ProxmoxClient(profile);
  const res = await client.login();
  if (!res.ok) client = null;
  return res;
});

ipcMain.handle(IPC.DISCONNECT, () => {
  client = null;
  return { ok: true };
});

ipcMain.handle(IPC.CURRENT, () => {
  return client ? { ok: true, data: client.getProfile() } : { ok: false };
});

// ---------------- IPC: generic API passthrough ----------------
function ensureClient() {
  if (!client) throw new Error('Not connected to any Proxmox host');
  return client;
}

ipcMain.handle(IPC.API_GET, (_e, p: string, params?: Record<string, any>) =>
  ensureClient().get(p, params)
);
ipcMain.handle(IPC.API_POST, (_e, p: string, params?: Record<string, any>) =>
  ensureClient().post(p, params)
);
ipcMain.handle(IPC.API_PUT, (_e, p: string, params?: Record<string, any>) =>
  ensureClient().put(p, params)
);
ipcMain.handle(IPC.API_DELETE, (_e, p: string, params?: Record<string, any>) =>
  ensureClient().del(p, params)
);

// ---------------- IPC: high level helpers ----------------
ipcMain.handle(IPC.CLUSTER_RESOURCES, (_e, type?: string) =>
  ensureClient().get('/cluster/resources', type ? { type } : undefined)
);

ipcMain.handle(IPC.NODES, () => ensureClient().get('/nodes'));

ipcMain.handle(
  IPC.GUEST_ACTION,
  (_e, node: string, type: 'qemu' | 'lxc', vmid: number, action: GuestAction) =>
    ensureClient().post(`/nodes/${node}/${type}/${vmid}/status/${action}`)
);

ipcMain.handle(
  IPC.RRD,
  (_e, node: string, type: 'qemu' | 'lxc' | 'node', vmid: number | null, timeframe: string) => {
    const c = ensureClient();
    if (type === 'node') {
      return c.get(`/nodes/${node}/rrddata`, { timeframe, cf: 'AVERAGE' });
    }
    return c.get(`/nodes/${node}/${type}/${vmid}/rrddata`, { timeframe, cf: 'AVERAGE' });
  }
);

ipcMain.handle(IPC.TASKS, (_e, node: string, limit = 50) =>
  ensureClient().get(`/nodes/${node}/tasks`, { limit, start: 0 })
);

ipcMain.handle(IPC.TASK_LOG, (_e, node: string, upid: string) =>
  ensureClient().get(`/nodes/${node}/tasks/${encodeURIComponent(upid)}/log`, { limit: 500 })
);

// Build a noVNC console URL (opened externally in browser).
ipcMain.handle(
  IPC.CONSOLE,
  async (_e, node: string, type: 'qemu' | 'lxc', vmid: number) => {
    const c = ensureClient();
    const base = c.buildConsoleBaseUrl();
    const consoleType = type === 'qemu' ? 'kvm' : 'lxc';
    const url = `${base}/?console=${consoleType}&novnc=1&vmid=${vmid}&vmname=${vmid}&node=${node}&resize=scale`;
    return { ok: true, data: { url, type: 'novnc' as const } };
  }
);

// Open the noVNC console inside an embedded Electron window. For password auth we
// can inject the auth cookie so the user doesn't have to log in again; for token
// auth the Proxmox web UI still requires an interactive login (tokens can't drive noVNC).
ipcMain.handle(
  IPC.CONSOLE_WINDOW,
  async (_e, node: string, type: 'qemu' | 'lxc', vmid: number, name: string) => {
    const c = ensureClient();
    const profile = c.getProfile();
    const base = c.buildConsoleBaseUrl();
    const consoleType = type === 'qemu' ? 'kvm' : 'lxc';
    const url = `${base}/?console=${consoleType}&novnc=1&vmid=${vmid}&vmname=${encodeURIComponent(
      name || String(vmid)
    )}&node=${node}&resize=scale`;

    const key = `${node}/${type}/${vmid}`;
    const existing = consoleWindows.get(key);
    if (existing && !existing.isDestroyed()) {
      existing.focus();
      return { ok: true };
    }

    const win = new BrowserWindow({
      width: 1024,
      height: 720,
      backgroundColor: '#000000',
      title: `Console · ${name || vmid}`,
      icon: isDev ? path.join(process.cwd(), 'build/icon.ico') : undefined,
      webPreferences: { partition: 'persist:pve-console' },
    });
    win.setMenuBarVisibility(false);
    consoleWindows.set(key, win);
    win.on('closed', () => consoleWindows.delete(key));

    // Inject auth cookie for password-based sessions.
    const ticket = c.getAuthTicket();
    if (ticket) {
      try {
        await win.webContents.session.cookies.set({
          url: base,
          name: 'PVEAuthCookie',
          value: ticket,
        });
      } catch {
        /* ignore */
      }
    }

    win.loadURL(url);
    return { ok: true };
  }
);

// ---------------- Side-panel embedded console (BrowserView) ----------------
// A single BrowserView docked to the right half of the main window.
let embeddedConsoleView: BrowserView | null = null;
let embeddedConsoleKey: string | null = null;
let embeddedConsoleShowing = false;

function removeEmbeddedConsole() {
  if (embeddedConsoleView && !embeddedConsoleView.webContents.isDestroyed()) {
    mainWindow?.removeBrowserView(embeddedConsoleView);
    (embeddedConsoleView.webContents as any)?.destroy?.();
    embeddedConsoleView = null;
  }
  embeddedConsoleKey = null;
  embeddedConsoleShowing = false;
}

function resizeMainContent(width?: number) {
  if (!mainWindow) return;
  const [w, h] = mainWindow.getContentSize();
  const panelW = embeddedConsoleShowing && width ? width : 0;
  mainWindow.webContents.send('console:layout', { panelW });
}

ipcMain.handle(IPC.EMBEDDED_CONSOLE_OPEN, async (_e, key: string, node: string, type: 'qemu' | 'lxc', vmid: number, name?: string) => {
  if (!mainWindow) return { ok: false, error: 'No main window' };
  const c = ensureClient();
  const base = c.buildConsoleBaseUrl();
  const consoleType = type === 'qemu' ? 'kvm' : 'lxc';
  const url = `${base}/?console=${consoleType}&novnc=1&vmid=${vmid}&vmname=${encodeURIComponent(name || String(vmid))}&node=${node}&resize=scale`;

  if (embeddedConsoleKey === key && embeddedConsoleView && !embeddedConsoleView.webContents.isDestroyed()) {
    if (!embeddedConsoleShowing) {
      mainWindow.addBrowserView(embeddedConsoleView);
      embeddedConsoleShowing = true;
      resizeMainContent(480);
    }
    return { ok: true };
  }

  removeEmbeddedConsole();
  embeddedConsoleView = new BrowserView({
    webPreferences: { partition: 'persist:pve-console-embed' },
  });
  embeddedConsoleKey = key;
  embeddedConsoleShowing = true;
  mainWindow.addBrowserView(embeddedConsoleView);

  const ticket = c.getAuthTicket();
  if (ticket) {
    try {
      await embeddedConsoleView.webContents.session.cookies.set({
        url: base,
        name: 'PVEAuthCookie',
        value: ticket,
      });
    } catch { /* ignore */ }
  }
  await embeddedConsoleView.webContents.loadURL(url);
  resizeMainContent(480);
  return { ok: true };
});

ipcMain.handle(IPC.EMBEDDED_CONSOLE_CLOSE, () => {
  removeEmbeddedConsole();
  resizeMainContent();
  return { ok: true };
});

ipcMain.handle(IPC.EMBEDDED_CONSOLE_BOUNDS, (_e, bounds: { x: number; y: number; width: number; height: number }) => {
  if (embeddedConsoleView && embeddedConsoleShowing && mainWindow) {
    const [cx] = mainWindow.getContentSize();
    const panelX = cx - bounds.width;
    embeddedConsoleView.setBounds({ x: Math.max(panelX, 0), y: bounds.y, width: bounds.width, height: bounds.height });
  }
  return { ok: true };
});

ipcMain.handle(IPC.OPEN_EXTERNAL, (_e, url: string) => {
  shell.openExternal(url);
  return { ok: true };
});

// ---------------- Community Helper Scripts catalog ----------------
ipcMain.handle(IPC.SCRIPTS_CATALOG, async (_e, forceRefresh?: boolean) => {
  try {
    const catalog = await getCatalog(!!forceRefresh);
    return { ok: true, data: catalog };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Failed to fetch script catalog' };
  }
});

ipcMain.handle(IPC.SCRIPTS_DETAIL, (_e, entry: ScriptEntry, methodType?: string) => {
  const command = buildInstallCommand(entry, methodType || 'default');
  return { ok: true, data: { command } };
});

// ---------------- Node shell (termproxy websocket) ----------------
const shells = new Map<string, NodeShell>();

ipcMain.handle(IPC.SHELL_OPEN, async (e, node: string) => {
  const c = client;
  if (!c) return { ok: false, error: 'Not connected' };
  const win = BrowserWindow.fromWebContents(e.sender);
  if (!win) return { ok: false, error: 'No window' };

  // One shell per node per window.
  const key = node;
  const existing = shells.get(key);
  if (existing) existing.close();

  const shell = new NodeShell(win, IPC.SHELL_STATUS, IPC.SHELL_DATA);
  shells.set(key, shell);
  return shell.open(c, node);
});

ipcMain.on(IPC.SHELL_INPUT, (_e, node: string, data: string) => {
  shells.get(node)?.write(data);
});

ipcMain.on(IPC.SHELL_RESIZE, (_e, node: string, cols: number, rows: number) => {
  shells.get(node)?.resize(cols, rows);
});

ipcMain.on(IPC.SHELL_CLOSE, (_e, node: string) => {
  shells.get(node)?.close();
  shells.delete(node);
});
