import https from 'node:https';
import type { ScriptCatalog, ScriptCategory, ScriptEntry } from '../shared/types';

// Source: community-scripts.org metadata (ProxmoxVE-Frontend-Archive repo).
// We fetch from the main process to avoid CORS and to allow on-disk caching.
const RAW_BASE =
  'https://raw.githubusercontent.com/community-scripts/ProxmoxVE-Frontend-Archive/main/public';
const API_BASE = 'https://api.github.com/repos/community-scripts/ProxmoxVE-Frontend-Archive/contents/public/json';
const METADATA_URL = `${RAW_BASE}/json/metadata.json`;
// Base URL the install scripts are actually served from when run on a node.
export const INSTALL_BASE = 'https://raw.githubusercontent.com/community-scripts/ProxmoxVE/main';

const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6h

let cache: ScriptCatalog | null = null;
let inflight: Promise<ScriptCatalog> | null = null;

function fetchJson<T = any>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          'User-Agent': 'proxtop',
          Accept: 'application/json,application/vnd.github+json',
        },
        timeout: 30_000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          // follow one redirect
          fetchJson<T>(res.headers.location).then(resolve, reject);
          res.resume();
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} for ${url}`));
          res.resume();
          return;
        }
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
          } catch (e: any) {
            reject(new Error(`Bad JSON from ${url}: ${e.message}`));
          }
        });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', reject);
  });
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (idx < items.length) {
      const i = idx++;
      try {
        out[i] = await fn(items[i]);
      } catch {
        out[i] = undefined as any;
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

async function build(): Promise<ScriptCatalog> {
  // 1. categories from metadata.json
  const meta = await fetchJson<{ categories: ScriptCategory[] }>(METADATA_URL);
  const categories = (meta.categories || []).sort(
    (a, b) => (a.sort_order ?? a.id) - (b.sort_order ?? b.id)
  );

  // 2. list all per-script json files
  const listing = await fetchJson<Array<{ name: string; download_url: string }>>(API_BASE);
  const files = (listing || []).filter(
    (f) => f.name.endsWith('.json') && f.name !== 'metadata.json'
  );

  // 3. fetch each script json (bounded concurrency)
  const entries = await mapWithConcurrency(files, 12, (f) =>
    fetchJson<ScriptEntry>(f.download_url || `${RAW_BASE}/json/${f.name}`)
  );

  const scripts = entries
    .filter((e): e is ScriptEntry => !!e && !!e.slug && !!e.name)
    .sort((a, b) => a.name.localeCompare(b.name));

  return { categories, scripts, fetchedAt: Date.now() };
}

export async function getCatalog(forceRefresh = false): Promise<ScriptCatalog> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache;
  }
  if (inflight) return inflight;
  inflight = build()
    .then((c) => {
      cache = c;
      return c;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/** Build the shell command that runs a script's install on a PVE node. */
export function buildInstallCommand(entry: ScriptEntry, methodType = 'default'): string | null {
  const method =
    entry.install_methods?.find((m) => m.type === methodType) || entry.install_methods?.[0];
  if (!method?.script) return null;
  return `bash -c "$(curl -fsSL ${INSTALL_BASE}/${method.script})"`;
}
