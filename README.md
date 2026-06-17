# Proxmox Desktop

A full-featured Windows desktop client for **Proxmox VE**, built with Electron + React + TypeScript.

It talks directly to the Proxmox REST API (`/api2/json`) from Electron's main process, so it
bypasses browser CORS and transparently handles the self-signed TLS certificates that Proxmox
ships with by default.

## Features

- **Multiple saved connections** — manage several Proxmox hosts/clusters; credentials stored locally.
- **Two auth methods** — API Token (`user@realm!tokenid` + secret) *or* username/password (ticket + CSRF).
- **Self-signed certs** — per-connection "Verify SSL" toggle (off by default for homelabs).
- **Dashboard** — cluster-wide stats: nodes, VMs, containers, CPU, memory, storage at a glance.
- **Nodes** — per-node CPU/mem/disk with live RRD history charts (1H / 24H / 7D / 30D).
- **Virtual Machines (QEMU)** — list, search, filter, and control.
- **LXC Containers** — same management surface as VMs.
- **Lifecycle controls** — start / shutdown / reboot / stop, with confirmation on destructive actions.
- **Guest detail** — live CPU, memory, network, and disk I/O graphs that auto-refresh.
- **noVNC console** — one click opens the VM/CT console in your browser.
- **Storage** — usage breakdown per volume across the cluster.
- **Task log** — recent tasks per node with full log viewer and live status.
- **Auto-refresh** — all views poll on sensible intervals; manual refresh everywhere.

## Requirements

- Windows 10/11, Node.js 18+ (built/tested on Node 22).
- A reachable Proxmox VE host (default API port `8006`).

## Getting Started

```bash
npm install        # install dependencies

npm run dev        # run in development (Vite dev server + Electron, with DevTools)
```

## Production build & packaging

```bash
npm run build      # compile main process (tsc) + bundle renderer (vite)
npm start          # run the built app

npm run dist       # build a Windows NSIS installer (.exe) into ./release
npm run dist:dir   # build an unpacked app directory (faster, for testing)
```

The installer is produced by **electron-builder** and lands in `release/` as
`Proxmox Desktop-Setup-1.0.0.exe`.

## Creating an API token in Proxmox (recommended)

1. Datacenter → Permissions → API Tokens → **Add**.
2. Pick a user (e.g. `root@pam`), give the token an ID (e.g. `desktop`).
3. **Uncheck "Privilege Separation"** for full access, or assign roles explicitly.
4. Copy the secret — it is shown only once.
5. In the app choose **API Token**, enter `root@pam!desktop` as the Token ID and paste the secret.

## Project structure

```
src/
  main/              Electron main process
    index.ts         window + IPC handlers + electron-store profiles
    ProxmoxClient.ts  HTTPS API client (TLS, token + ticket auth, RRD, tasks)
  preload/
    index.ts         contextBridge — exposes window.pmx to the renderer
  shared/
    types.ts         shared TS types
    ipc.ts           IPC channel constants
  renderer/          React UI (Vite)
    App.tsx          sidebar shell + routing
    views/           ConnectScreen, Dashboard, Nodes, Guests, Storage, Tasks, GuestDetail
    components/      Toast, Modal, widgets (ResourceBar, StatusBadge)
    utils/           formatting helpers + usePolling hook
```

## Security notes

- Connection profiles (including secrets) are stored locally via `electron-store`
  under your Windows user profile. They never leave your machine.
- `contextIsolation` is on and `nodeIntegration` is off; the renderer only sees the
  vetted `window.pmx` bridge.
- API tokens are preferred over passwords — they're revocable and scopable.

## License

MIT
