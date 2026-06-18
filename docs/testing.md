# Test Harness (added in v1.7.2 / v1.7.3)

ProxTop now runs three layers of automated tests on every push and pull request to `main`.

## Test layers

| Layer | Command | Runner | Purpose |
|---|---|---|---|
| Renderer tests | `npm run test` | jsdom (Vitest) | React components, mocked `window.pmx` API |
| Integration tests | `npm run test:integration` | Node + live host | Real Proxmox API shape validation |
| E2E launch test | `npm run test:e2e` | Playwright + Electron binary | App actually launches and opens a window |

Run everything locally:

```bash
npm run test:all
npm run test:e2e
```

## CI

`.github/workflows/ci.yml` has three jobs:

1. **build** (windows-latest) — type-check main process, build renderer, run renderer tests, unpackaged NSIS smoke check.
2. **integration** (ubuntu-latest, depends on `build`) — connects to the live Proxmox host using repository secrets `PVE_TEST_HOST` and `PVE_TEST_TOKEN`.
3. **e2e** (windows-latest, depends on `build`, `continue-on-error: true`) — installs Playwright Chromium, builds the app, and runs the launch spec.

## Renderer tests

Located in `tests/renderer/`.

- `guests.test.tsx` — guest action buttons and CommandPalette dispatch call `window.pmx.pve.guestAction` with the correct node/type/vmid/action.
- `ConnectScreen.test.tsx` — filling the form and saving calls `window.pmx.profiles.save` with the parsed token ID and secret.
- `Settings.test.tsx` — toggling **Auto-check updates** calls `window.pmx.settings.set`.
- `updater.test.tsx` — mocked update events `checking → available → downloaded` make the update-ready badge appear.
- `GuestDetail.test.tsx` — all tabs (Overview, Snapshots, Config, Notes & Tags, Firewall) render without crashing.
- `shell-storage.test.tsx` — node shell open/input/close/onData lifecycle and storage content browser ISO/Template/Backup/Image tabs.
- `smoke.test.tsx` — baseline coverage for Permissions, Storage, Pools, and Users views.

Shared mocks and jsdom polyfills (e.g. `matchMedia`, `ResizeObserver` for xterm.js) live in `tests/renderer/setup.ts`.

## Integration tests

Located in `tests/integration/pve.test.ts`. They use `src/main/ProxmoxClient.ts` against the live host configured via environment variables:

```bash
PVE_TEST_HOST=host:8006
PVE_TEST_TOKEN=root@pam!tokenid=secret
```

Tests cover:

- cluster status and resources
- storage list and content
- node list and tasks
- QEMU/LXC guest lists (via `/cluster/resources?type=vm` and per-node endpoints)
- firewall rules for the first QEMU guest
- permissions object-map shape (the bug that caused the v1.7.0 crash)
- pools, users, access ACL
- task log response shape
- RRD data shape with numeric `time` field
- console ticket (`termproxy`) for the first QEMU guest
- snapshot list for the first QEMU guest

VM/node-dependent tests skip gracefully if the host has no matching resources.

## E2E test

Located in `tests/e2e/launch.spec.ts`. It launches the packaged Electron app via Playwright and asserts the window title contains `ProxTop`.

TypeScript config: `tsconfig.e2e.json`.

## Secrets

The live host token is stored as a GitHub repository secret:

- `PVE_TEST_HOST`
- `PVE_TEST_TOKEN`

No credentials are present in source code.
