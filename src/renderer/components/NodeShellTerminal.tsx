import { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { ShellStatus } from '@shared/types';

/**
 * Embedded xterm.js terminal bound to a Proxmox node shell (termproxy).
 * Optionally auto-types `runCommand` once the shell is open.
 */
export function NodeShellTerminal({
  node,
  runCommand,
  onClose,
}: {
  node: string;
  runCommand?: string;
  onClose?: () => void;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const [status, setStatus] = useState<ShellStatus>({ state: 'connecting' });
  const ranRef = useRef(false);

  useEffect(() => {
    const term = new Terminal({
      cursorBlink: true,
      fontFamily: 'Cascadia Code, Consolas, monospace',
      fontSize: 13,
      theme: {
        background: '#0a0c11',
        foreground: '#c8cdd8',
        cursor: '#e57000',
        selectionBackground: '#33415580',
      },
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    termRef.current = term;
    fitRef.current = fit;

    if (hostRef.current) {
      term.open(hostRef.current);
      setTimeout(() => {
        try {
          fit.fit();
          window.pmx.shell.resize(node, term.cols, term.rows);
        } catch {
          /* ignore */
        }
      }, 50);
    }

    // Pipe keystrokes to the main process.
    const dataDisp = term.onData((d) => window.pmx.shell.input(node, d));

    // Receive output.
    const offData = window.pmx.shell.onData((chunk) => term.write(chunk));
    const offStatus = window.pmx.shell.onStatus((s) => {
      setStatus(s);
      if (s.state === 'open') {
        term.writeln('\x1b[32m✓ Connected to ' + node + ' shell\x1b[0m');
        if (runCommand && !ranRef.current) {
          ranRef.current = true;
          // Give the shell a moment, then type the install command.
          setTimeout(() => window.pmx.shell.input(node, runCommand + '\n'), 600);
        }
      } else if (s.state === 'error') {
        term.writeln('\x1b[31m✕ ' + (s.message || 'Shell error') + '\x1b[0m');
      } else if (s.state === 'closed') {
        term.writeln('\x1b[33m• Shell closed\x1b[0m');
      }
    });

    // Open the shell.
    window.pmx.shell.open(node).then((res) => {
      if (!res.ok) setStatus({ state: 'error', message: res.error });
    });

    // Resize handling.
    const onResize = () => {
      try {
        fit.fit();
        window.pmx.shell.resize(node, term.cols, term.rows);
      } catch {
        /* ignore */
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
      dataDisp.dispose();
      offData();
      offStatus();
      window.pmx.shell.close(node);
      term.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [node]);

  const dot =
    status.state === 'open'
      ? 'dot-running'
      : status.state === 'error'
      ? 'dot-stopped'
      : 'dot-paused';

  return (
    <div className="flex-col" style={{ gap: 8, height: '100%' }}>
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <span className="badge badge-stopped">
          <span className={`dot ${dot}`} />
          {status.state === 'open'
            ? `Connected · ${node}`
            : status.state === 'connecting'
            ? 'Connecting…'
            : status.state === 'error'
            ? 'Error'
            : 'Closed'}
        </span>
        {onClose && (
          <button className="btn btn-sm" onClick={onClose}>
            Close shell
          </button>
        )}
      </div>
      {status.state === 'error' && status.message && (
        <div className="error-banner" style={{ margin: 0 }}>
          {status.message}
        </div>
      )}
      <div
        ref={hostRef}
        style={{
          flex: 1,
          minHeight: 360,
          background: '#0a0c11',
          borderRadius: 8,
          padding: 8,
          border: '1px solid var(--border)',
          overflow: 'hidden',
        }}
      />
    </div>
  );
}
