import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { ShellStatus } from '@shared/types';

type Session = {
  node: string;
  runCommand?: string;
  status: ShellStatus;
  ran: boolean;
};

const TERM_OPTIONS: ConstructorParameters<typeof Terminal>[0] = {
  cursorBlink: true,
  fontFamily: 'Cascadia Code, Consolas, monospace',
  fontSize: 13,
  theme: {
    background: '#0a0c11',
    foreground: '#c8cdd8',
    cursor: '#e57000',
    selectionBackground: '#33415580',
  },
};

function statusDotClass(s: ShellStatus) {
  if (s.state === 'open') return 'dot-running';
  if (s.state === 'error') return 'dot-stopped';
  return 'dot-paused';
}

function statusLabel(s: ShellStatus) {
  switch (s.state) {
    case 'open':
      return 'Connected';
    case 'connecting':
      return 'Connecting…';
    case 'error':
      return s.message || 'Error';
    case 'closed':
      return 'Closed';
  }
}

/**
 * Embedded xterm.js terminal bound to Proxmox node shells (termproxy).
 *
 * Supports multiple node tabs, a session switcher, container-aware resizing via
 * ResizeObserver, and a reconnect action when a shell errors out.
 */
export function NodeShellTerminal({
  node,
  runCommand,
  onClose,
  nodes,
}: {
  node: string;
  runCommand?: string;
  onClose?: () => void;
  nodes?: string[];
}) {
  const [sessions, setSessions] = useState<Session[]>([
    { node, runCommand, status: { state: 'connecting' }, ran: false },
  ]);
  const [activeNode, setActiveNode] = useState<string>(node);
  const [addValue, setAddValue] = useState('');

  const termMap = useRef(new Map<string, { term: Terminal; fit: FitAddon }>());
  const hostMap = useRef(new Map<string, HTMLDivElement | null>());
  const offDataRef = useRef<() => void>();
  const offStatusRef = useRef<() => void>();
  const prevActiveRef = useRef<string | null>(null);
  const transitionRef = useRef(false);
  const activeNodeRef = useRef(activeNode);
  activeNodeRef.current = activeNode;
  const sessionsRef = useRef(sessions);
  sessionsRef.current = sessions;

  // Keep the session list in sync with the primary node prop.
  useEffect(() => {
    setSessions((prev) => {
      if (prev.some((s) => s.node === node)) return prev;
      return [...prev, { node, runCommand, status: { state: 'connecting' }, ran: false }];
    });
    setActiveNode(node);
  }, [node]);

  // Update the runCommand for the primary node and run it if the shell is already open.
  useEffect(() => {
    setSessions((prev) => {
      const target = prev.find((s) => s.node === node);
      if (!target || target.runCommand === runCommand) return prev;

      const next = prev.map((s) => (s.node === node ? { ...s, runCommand } : s));
      const updated = next.find((s) => s.node === node)!;
      if (updated.runCommand && !updated.ran && updated.status.state === 'open') {
        setTimeout(() => window.pmx.shell.input(node, updated.runCommand + '\n'), 50);
        return prev.map((s) => (s.node === node ? { ...s, runCommand, ran: true } : s));
      }
      return next;
    });
  }, [node, runCommand]);

  // Subscribe once to the shell data/status streams. We only ever drive one
  // live connection at a time, so all events belong to the active session.
  useEffect(() => {
    const offData = window.pmx.shell.onData((chunk) => {
      if (transitionRef.current) return;
      const t = termMap.current.get(activeNodeRef.current);
      if (t) t.term.write(chunk);
    });

    const offStatus = window.pmx.shell.onStatus((s) => {
      const currentNode = activeNodeRef.current;
      setSessions((prev) =>
        prev.map((sess) => (sess.node === currentNode ? { ...sess, status: s } : sess))
      );

      if (s.state === 'open') {
        const session = sessionsRef.current.find((sess) => sess.node === currentNode);
        if (session?.runCommand && !session.ran) {
          setSessions((prev) =>
            prev.map((sess) => (sess.node === currentNode ? { ...sess, ran: true } : sess))
          );
          setTimeout(() => window.pmx.shell.input(currentNode, session.runCommand + '\n'), 600);
        }
      }
    });

    offDataRef.current = offData;
    offStatusRef.current = offStatus;

    return () => {
      offData();
      offStatus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Open/close shells as the active tab changes. Only one node is connected at
  // a time because the existing renderer shell API emits global data/status events.
  useLayoutEffect(() => {
    if (!activeNode) return;

    const prev = prevActiveRef.current;
    if (prev === activeNode) return;

    transitionRef.current = true;
    if (prev && prev !== activeNode) {
      try {
        window.pmx.shell.close(prev);
      } catch {
        /* ignore */
      }
      setSessions((prevList) =>
        prevList.map((s) => (s.node === prev ? { ...s, status: { state: 'closed' } } : s))
      );
    }
    prevActiveRef.current = activeNode;

    const t = termMap.current.get(activeNode);
    if (t) {
      t.term.writeln('\x1b[33m• Opening shell to ' + activeNode + '…\x1b[0m');
    }
    setSessions((prevList) =>
      prevList.map((s) => (s.node === activeNode ? { ...s, status: { state: 'connecting' } } : s))
    );

    let alive = true;
    window.pmx.shell.open(activeNode).then((res) => {
      if (!alive) return;
      if (!res.ok) {
        setSessions((prevList) =>
          prevList.map((s) =>
            s.node === activeNode ? { ...s, status: { state: 'error', message: res.error } } : s
          )
        );
      }
      setTimeout(() => {
        transitionRef.current = false;
        // Fallback: if the open status fired while transitionRef was true, run any
        // pending command now that we know the shell is (or should be) open.
        const currentNode = activeNodeRef.current;
        const session = sessionsRef.current.find((sess) => sess.node === currentNode);
        if (session?.runCommand && !session.ran && session.status.state === 'open') {
          setSessions((prev) =>
            prev.map((sess) => (sess.node === currentNode ? { ...sess, ran: true } : sess))
          );
          setTimeout(() => window.pmx.shell.input(currentNode, session.runCommand + '\n'), 50);
        }
      }, 120);
    });

    return () => {
      alive = false;
    };
  }, [activeNode]);

  // Resize the active terminal whenever its container changes size.
  useLayoutEffect(() => {
    if (!activeNode) return;
    const el = hostMap.current.get(activeNode);
    const t = termMap.current.get(activeNode);
    if (!el || !t) return;

    const resize = () => {
      try {
        t.fit.fit();
        window.pmx.shell.resize(activeNode, t.term.cols, t.term.rows);
      } catch {
        /* ignore */
      }
    };

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(el);
    return () => ro.disconnect();
  }, [activeNode]);

  // Clean everything up when the component is destroyed.
  useEffect(() => {
    return () => {
      offDataRef.current?.();
      offStatusRef.current?.();
      sessionsRef.current.forEach((s) => {
        try {
          window.pmx.shell.close(s.node);
        } catch {
          /* ignore */
        }
      });
      termMap.current.forEach(({ term }) => term.dispose());
      termMap.current.clear();
    };
  }, []);

  const setHostRef = (sessionNode: string) => (el: HTMLDivElement | null) => {
    hostMap.current.set(sessionNode, el);
    if (!el || termMap.current.has(sessionNode)) return;

    const term = new Terminal(TERM_OPTIONS);
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(el);
    termMap.current.set(sessionNode, { term, fit });

    if (sessionNode === activeNodeRef.current) {
      try {
        fit.fit();
        window.pmx.shell.resize(sessionNode, term.cols, term.rows);
      } catch {
        /* ignore */
      }
    }
  };

  const activate = (n: string) => setActiveNode(n);

  const addSession = (newNode: string) => {
    if (!newNode || sessions.some((s) => s.node === newNode)) return;
    setSessions((prev) => [...prev, { node: newNode, status: { state: 'connecting' }, ran: false }]);
    setActiveNode(newNode);
  };

  const closeSession = (n: string) => {
    const nextSessions = sessions.filter((s) => s.node !== n);
    const nextActive = activeNode === n ? nextSessions[0]?.node || '' : activeNode;
    setSessions(nextSessions);
    setActiveNode(nextActive);

    try {
      window.pmx.shell.close(n);
    } catch {
      /* ignore */
    }

    const t = termMap.current.get(n);
    if (t) {
      t.term.dispose();
      termMap.current.delete(n);
    }
    hostMap.current.delete(n);
  };

  const reconnect = () => {
    const n = activeNode;
    if (!n) return;

    const t = termMap.current.get(n);
    t?.term.writeln('\x1b[33m• Reconnecting…\x1b[0m');
    setSessions((prev) =>
      prev.map((s) => (s.node === n ? { ...s, status: { state: 'connecting' }, ran: false } : s))
    );

    transitionRef.current = true;
    try {
      window.pmx.shell.close(n);
    } catch {
      /* ignore */
    }

    setTimeout(() => {
      window.pmx.shell.open(n).then((res) => {
        if (!res.ok) {
          setSessions((prev) =>
            prev.map((s) =>
              s.node === n ? { ...s, status: { state: 'error', message: res.error } } : s
            )
          );
        }
        setTimeout(() => {
          transitionRef.current = false;
        }, 120);
      });
    }, 150);
  };

  const activeSession = sessions.find((s) => s.node === activeNode);
  const availableNodes = (nodes || []).filter((n) => !sessions.some((s) => s.node === n));

  return (
    <div className="flex-col" style={{ gap: 8, height: '100%' }}>
      <div
        className="flex"
        style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}
      >
        <div className="flex" style={{ gap: 6, flexWrap: 'wrap', alignItems: 'center', overflowX: 'auto' }}>
          {sessions.map((s) => (
            <button
              key={s.node}
              className={`btn btn-sm ${activeNode === s.node ? 'btn-primary' : ''}`}
              onClick={() => activate(s.node)}
              title={statusLabel(s.status)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
            >
              <span className={`dot ${statusDotClass(s.status)}`} />
              <span>{s.node}</span>
              <span
                style={{
                  marginLeft: 4,
                  padding: '0 3px',
                  fontSize: 14,
                  lineHeight: 1,
                  cursor: 'pointer',
                  borderRadius: 4,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(s.node);
                }}
                title="Close session"
              >
                ×
              </span>
            </button>
          ))}

          {availableNodes.length > 0 ? (
            <select
              style={{ maxWidth: 150 }}
              value={addValue}
              onChange={(e) => {
                const n = e.target.value;
                if (n) {
                  addSession(n);
                  setAddValue('');
                }
              }}
              title="Open another node shell"
            >
              <option value="">+ Open node…</option>
              {availableNodes.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          ) : (
            <button
              className="btn btn-sm"
              onClick={() => {
                const n = window.prompt('Open shell for node:')?.trim();
                if (n) addSession(n);
              }}
              title="Open another node shell"
            >
              +
            </button>
          )}
        </div>

        <div className="flex" style={{ gap: 8, alignItems: 'center' }}>
          {sessions.length > 0 && (
            <select
              style={{ maxWidth: 170 }}
              value={activeNode}
              onChange={(e) => activate(e.target.value)}
              title="Switch active session"
            >
              {sessions.map((s) => (
                <option key={s.node} value={s.node}>
                  {s.node} — {s.status.state}
                </option>
              ))}
            </select>
          )}

          {activeSession && (activeSession.status.state === 'error' || activeSession.status.state === 'closed') && (
            <button className="btn btn-sm btn-primary" onClick={reconnect}>
              ↻ Reconnect
            </button>
          )}

          {onClose && (
            <button className="btn btn-sm" onClick={onClose}>
              Close shell
            </button>
          )}
        </div>
      </div>

      {activeSession?.status.state === 'error' && activeSession.status.message && (
        <div className="error-banner" style={{ margin: 0 }}>
          {activeSession.status.message}
        </div>
      )}

      <div style={{ flex: 1, position: 'relative', minHeight: 360 }}>
        {sessions.map((s) => (
          <div
            key={s.node}
            ref={setHostRef(s.node)}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: activeNode === s.node ? 'block' : 'none',
              background: '#0a0c11',
              borderRadius: 8,
              padding: 8,
              border: '1px solid var(--border)',
              overflow: 'hidden',
            }}
          />
        ))}
      </div>
    </div>
  );
}
