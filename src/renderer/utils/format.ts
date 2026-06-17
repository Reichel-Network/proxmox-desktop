// Formatting / utility helpers for the renderer.

export function bytes(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  if (n === 0) return '0 B';
  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB'];
  const i = Math.floor(Math.log(n) / Math.log(1024));
  const v = n / Math.pow(1024, i);
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function pct(frac?: number): string {
  if (frac === undefined || frac === null || isNaN(frac)) return '—';
  return `${(frac * 100).toFixed(1)}%`;
}

export function uptime(seconds?: number): string {
  if (!seconds || seconds <= 0) return '—';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m && !d) parts.push(`${m}m`);
  if (!parts.length) parts.push(`${Math.floor(seconds)}s`);
  return parts.join(' ');
}

export function timeAgo(epochSec?: number): string {
  if (!epochSec) return '—';
  const diff = Date.now() / 1000 - epochSec;
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function fmtDate(epochSec?: number): string {
  if (!epochSec) return '—';
  return new Date(epochSec * 1000).toLocaleString();
}

export function rate(n?: number): string {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return `${bytes(n)}/s`;
}

export function classNames(...xs: (string | false | undefined | null)[]): string {
  return xs.filter(Boolean).join(' ');
}
