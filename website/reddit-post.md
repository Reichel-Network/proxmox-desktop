# Reddit post drafts for Proxmox Desktop

## Primary post (best for r/homelab + r/Proxmox)

**Title:** Show HN-style /r/homelab: I built a native Windows desktop client for Proxmox VE

**Body:**

Hey homelabbers 👋

I've been managing my Proxmox cluster almost entirely through the web UI and got tired of the browser-tab shuffle, CORS quirks, and self-signed cert warnings every time I opened it. So I built **Proxmox Desktop** — a full-featured Windows desktop client that talks directly to the Proxmox REST API.

It's open source (MIT), built with Electron + React + TypeScript, and designed for the "open the app and get stuff done" workflow.

**What's in it:**

- Multiple saved connections with API token or username/password auth
- Per-connection SSL verification toggle (for self-signed homelab certs)
- Dashboard with cluster-wide nodes, VMs, containers, CPU, memory, storage
- VM and LXC management + lifecycle controls (start / shutdown / reboot / stop)
- Live CPU, memory, network, and disk I/O graphs
- Embedded noVNC console (in-app, not a browser tab)
- Storage, backups & restore, snapshots, task log
- Cluster health, network & firewall views
- Command palette with Ctrl+K — jump to any page or guest instantly
- Dark/light theme, auto-update via GitHub Releases, encrypted credentials via Windows DPAPI

The screenshots in the repo are all from the built-in demo mode, so you can explore the full UI without a live Proxmox host.

**Links:**
- GitHub: https://github.com/Reichel-Network/proxmox-desktop
- Download: grab the latest Windows installer from the Releases page

Would love feedback, bug reports, or contributions. If you've also wanted a better Proxmox desktop experience, let me know what features you'd like to see next.

---

## Shorter version (for r/selfhosted or r/sysadmin)

**Title:** Proxmox Desktop — a native Windows client for Proxmox VE

**Body:**

I built a free, open-source Windows desktop app for managing Proxmox VE clusters.

- Direct REST API connection from Electron main process (no browser, no CORS, handles self-signed certs)
- Dashboard, VMs, LXC, storage, backups, snapshots, tasks, cluster health, network/firewall
- Command palette (Ctrl+K), embedded noVNC console, dark/light themes
- Windows auto-updater, encrypted credential storage

Built with Electron + React + TypeScript. MIT licensed.

https://github.com/Reichel-Network/proxmox-desktop

Happy to hear what you think — especially if you run a homelab or small Proxmox cluster daily.

---

## r/Proxmox specific

**Title:** Proxmox Desktop — native Windows client for Proxmox VE (open source)

**Body:**

Hi all,

Wanted to share a project I've been working on: **Proxmox Desktop**, an open-source Windows client for Proxmox VE.

Instead of wrapping the web UI, it talks directly to `/api2/json` from Electron's main process, so it bypasses browser CORS and lets you accept self-signed certificates per connection.

It covers the main Proxmox workflows I use daily: VMs, LXC, storage, backups, snapshots, tasks, cluster health, network/firewall, plus a command palette and embedded noVNC console.

Repo: https://github.com/Reichel-Network/proxmox-desktop

There's a demo mode so you can try the UI without connecting a real cluster. Feedback and PRs welcome.

---

## Notes for posting

- Best subreddits: r/homelab, r/Proxmox, r/selfhosted, r/sysadmin, r/electronjs
- Reddit generally dislikes overt self-promotion; make sure the post focuses on value/utility and invites discussion
- Consider posting in only one subreddit first, then cross-posting if it gets traction
- Be ready to answer questions in comments about security, Electron, and Windows-only support
- The GitHub URL currently returns 404 to external tools in some environments, but should work normally for Reddit users
