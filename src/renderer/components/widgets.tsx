import { pct } from '../utils/format';

export function ResourceBar({ frac, label }: { frac: number; label?: string }) {
  const safe = isNaN(frac) ? 0 : Math.max(0, Math.min(1, frac));
  const cls = safe > 0.85 ? 'high' : safe > 0.6 ? 'mid' : 'low';
  return (
    <div style={{ minWidth: 90 }}>
      {label !== undefined && (
        <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>{label}</div>
      )}
      <div className="flex" style={{ gap: 8 }}>
        <div className="bar" style={{ flex: 1 }}>
          <div className={`bar-fill ${cls}`} style={{ width: `${safe * 100}%` }} />
        </div>
        <span style={{ fontSize: 12, minWidth: 42, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {pct(safe)}
        </span>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = (status || 'unknown').toLowerCase();
  const cls =
    s === 'running' || s === 'online'
      ? 'badge-running'
      : s === 'paused' || s === 'suspended'
      ? 'badge-paused'
      : 'badge-stopped';
  const dotCls =
    s === 'running' || s === 'online'
      ? 'dot-running'
      : s === 'paused' || s === 'suspended'
      ? 'dot-paused'
      : 'dot-stopped';
  return (
    <span className={`badge ${cls}`}>
      <span className={`dot ${dotCls}`} />
      {status}
    </span>
  );
}
