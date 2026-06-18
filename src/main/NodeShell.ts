import WebSocket from 'ws';
import { BrowserWindow } from 'electron';
import type { ProxmoxClient } from './ProxmoxClient';

/**
 * NodeShell bridges a Proxmox node's xterm.js shell (termproxy) to the renderer.
 *
 * Protocol (matches the Proxmox web UI):
 *   1. POST /nodes/{node}/termproxy  -> { ticket, port, user }
 *   2. WebSocket to wss://host:port/api2/json/nodes/{node}/vncwebsocket?port=&vncticket=
 *      with the PVEAuthCookie header (subprotocol 'binary').
 *   3. First frame sent must be  `${user}:${ticket}\n`  to authenticate.
 *   4. Thereafter messages are framed:
 *        "0:<len>:<data>"  -> terminal output (we forward data to renderer)
 *        We send keystrokes as  "0:<bytelen>:<data>"
 *        Resize is            "1:<cols>:<rows>:"
 *        Keepalive ping is    "2"
 *
 * NOTE: termproxy/vncwebsocket require ticket (cookie) auth — API tokens cannot
 * drive it. Callers must use a password-auth session (client.getAuthTicket()).
 */
export class NodeShell {
  private ws: WebSocket | null = null;
  private keepalive: NodeJS.Timeout | null = null;
  private win: BrowserWindow;
  private statusChannel: string;
  private dataChannel: string;

  constructor(win: BrowserWindow, statusChannel: string, dataChannel: string) {
    this.win = win;
    this.statusChannel = statusChannel;
    this.dataChannel = dataChannel;
  }

  private sendStatus(state: string, message?: string) {
    if (!this.win.isDestroyed()) this.win.webContents.send(this.statusChannel, { state, message });
  }

  private sendData(data: string) {
    if (!this.win.isDestroyed()) this.win.webContents.send(this.dataChannel, data);
  }

  async open(client: ProxmoxClient, node: string): Promise<{ ok: boolean; error?: string }> {
    const profile = client.getProfile();
    const ticketCookie = client.getAuthTicket();
    if (!ticketCookie) {
      return {
        ok: false,
        error:
          'Live node shell requires password authentication (API tokens cannot drive the shell websocket). Reconnect with username/password, or use "Copy install command".',
      };
    }

    this.sendStatus('connecting');

    // 1. Request a termproxy ticket
    const res = await client.post(`/nodes/${node}/termproxy`);
    if (!res.ok || !res.data?.data) {
      const err = res.error || 'Failed to open termproxy';
      this.sendStatus('error', err);
      return { ok: false, error: err };
    }
    const { ticket, port, user } = res.data.data as { ticket: string; port: string; user: string };

    // 2. Open the websocket and wait until it is actually ready
    const host = profile.host;
    const wsUrl = `wss://${host}:${profile.port}/api2/json/nodes/${node}/vncwebsocket?port=${encodeURIComponent(
      port
    )}&vncticket=${encodeURIComponent(ticket)}`;

    return new Promise((resolve) => {
      let settled = false;
      const ws = new WebSocket(wsUrl, ['binary'], {
        rejectUnauthorized: profile.verifySsl,
        headers: { Cookie: `PVEAuthCookie=${ticketCookie}` },
        handshakeTimeout: 15_000,
      });
      this.ws = ws;

      const finish = (ok: boolean, error?: string) => {
        if (settled) return;
        settled = true;
        if (!ok) this.cleanup();
        resolve({ ok, error });
      };

      ws.on('open', () => {
        // 3. Authenticate as the PTY user
        ws.send(`${user}:${ticket}\n`);

        // 4. Give the server a moment to create the PTY and print the prompt.
        //    Sending commands immediately after the websocket handshake can cause
        //    Proxmox to drop the connection with "socket hang up".
        setTimeout(() => {
          this.sendStatus('open');
          this.keepalive = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) ws.send('2');
          }, 30_000);
          finish(true);
        }, 600);
      });

      ws.on('message', (raw: WebSocket.RawData) => {
        const text = raw.toString('binary');
        // Proxmox prefixes output frames; strip the "0:<len>:" header when present.
        const m = /^0:\d+:/.exec(text);
        if (m) {
          this.sendData(text.slice(m[0].length));
        } else if (/^[12]:?/.test(text)) {
          // control/keepalive echoes — ignore
        } else {
          this.sendData(text);
        }
      });

      ws.on('close', () => {
        this.cleanup();
        this.sendStatus('closed');
        finish(false, 'Shell connection closed');
      });

      ws.on('error', (err: Error) => {
        this.cleanup();
        this.sendStatus('error', err.message);
        finish(false, err.message);
      });
    });
  }

  /** Send user keystrokes to the shell. */
  write(data: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(`0:${Buffer.byteLength(data, 'binary')}:${data}`);
    }
  }

  resize(cols: number, rows: number) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(`1:${cols}:${rows}:`);
    }
  }

  close() {
    try {
      this.ws?.close();
    } catch {
      /* ignore */
    }
    this.cleanup();
  }

  private cleanup() {
    if (this.keepalive) {
      clearInterval(this.keepalive);
      this.keepalive = null;
    }
  }
}
