import { useEffect, useRef } from 'react';
import type { ClusterResource } from '@shared/types';

/**
 * Polls cluster resources and fires native notifications when:
 *  - a node or guest transitions online <-> offline / running <-> stopped
 * Lightweight diff-based change detection.
 */
export function useClusterMonitor(enabled: boolean) {
  const prev = useRef<Map<string, string>>(new Map());
  const firstRun = useRef(true);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;

    async function tick() {
      try {
        const res = await window.pmx.pve.clusterResources();
        if (!res.ok || !alive) return;
        const list = (res.data?.data || []) as ClusterResource[];
        const cur = new Map<string, string>();
        for (const r of list) {
          if (r.type === 'node' || r.type === 'qemu' || r.type === 'lxc') {
            cur.set(r.id, r.status || 'unknown');
          }
        }
        if (!firstRun.current) {
          for (const [id, status] of Array.from(cur.entries())) {
            const old = prev.current.get(id);
            if (old && old !== status) {
              const label = id.replace(/^(qemu|lxc|node)\//, '');
              const kind = id.startsWith('node/') ? 'Node' : id.startsWith('qemu/') ? 'VM' : 'CT';
              const good = status === 'running' || status === 'online';
              window.pmx.notify(
                `${kind} ${label} ${status}`,
                `${kind} ${label} changed from ${old} to ${status}`
              ).catch(() => {});
              void good;
            }
          }
        }
        prev.current = cur;
        firstRun.current = false;
      } catch {
        /* ignore */
      }
    }

    tick();
    const interval = setInterval(tick, 15000);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [enabled]);
}
