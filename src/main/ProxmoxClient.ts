import https from 'node:https';
import { URL } from 'node:url';
import type { ConnectionProfile, ApiResult } from '../shared/types';

interface Ticket {
  ticket: string;
  CSRFPreventionToken: string;
  username: string;
  expiresAt: number; // epoch ms
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

/**
 * Proxmox VE API client. Runs in the Electron main process so it can:
 *  - make raw HTTPS calls (no browser CORS)
 *  - accept self-signed certificates (rejectUnauthorized=false)
 *  - manage auth tickets + CSRF tokens for password auth
 *  - use API tokens via the Authorization header
 */
export class ProxmoxClient {
  private profile: ConnectionProfile;
  private agent: https.Agent;
  private ticket: Ticket | null = null;

  constructor(profile: ConnectionProfile) {
    this.profile = profile;
    this.agent = new https.Agent({
      rejectUnauthorized: profile.verifySsl,
      keepAlive: true,
      maxSockets: 8,
    });
  }

  get base(): string {
    return `https://${this.profile.host}:${this.profile.port}/api2/json`;
  }

  /** Authenticate. For token auth this is a no-op verification; for password it fetches a ticket. */
  async login(): Promise<ApiResult> {
    if (this.profile.authMethod === 'token') {
      // Verify the token works by hitting /version.
      const res = await this.request('GET', '/version');
      return res.ok
        ? { ok: true, data: res.data }
        : { ok: false, status: res.status, error: res.error || 'Token authentication failed' };
    }
    // Password auth -> obtain ticket
    return this.acquireTicket();
  }

  private async acquireTicket(): Promise<ApiResult> {
    const username = this.profile.username || '';
    const password = this.profile.password || '';
    const body = new URLSearchParams({ username, password }).toString();

    const res = await this.rawRequest('POST', '/access/ticket', body, {
      'Content-Type': 'application/x-www-form-urlencoded',
    });

    if (!res.ok || !res.data?.data?.ticket) {
      return {
        ok: false,
        status: res.status,
        error: res.error || 'Authentication failed — check username/password/realm',
      };
    }
    const d = res.data.data;
    this.ticket = {
      ticket: d.ticket,
      CSRFPreventionToken: d.CSRFPreventionToken,
      username: d.username,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000, // tickets last ~2h
    };
    return { ok: true, data: { username: d.username } };
  }

  private async ensureAuth(): Promise<void> {
    if (this.profile.authMethod !== 'password') return;
    if (!this.ticket || Date.now() > this.ticket.expiresAt - 60_000) {
      await this.acquireTicket();
    }
  }

  private authHeaders(method: HttpMethod): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.profile.authMethod === 'token') {
      headers['Authorization'] = `PVEAPIToken=${this.profile.tokenId}=${this.profile.tokenSecret}`;
    } else if (this.ticket) {
      headers['Cookie'] = `PVEAuthCookie=${this.ticket.ticket}`;
      if (method !== 'GET') {
        headers['CSRFPreventionToken'] = this.ticket.CSRFPreventionToken;
      }
    }
    return headers;
  }

  /** Public typed request with auth + body encoding. */
  async request(
    method: HttpMethod,
    path: string,
    params?: Record<string, any>
  ): Promise<ApiResult> {
    await this.ensureAuth();

    let urlPath = path;
    let body: string | undefined;
    const headers = this.authHeaders(method);

    if (method === 'GET' && params && Object.keys(params).length) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.append(k, String(v));
      }
      urlPath += `?${qs.toString()}`;
    } else if (params && Object.keys(params).length) {
      const form = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) form.append(k, String(v));
      }
      body = form.toString();
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
    }

    return this.rawRequest(method, urlPath, body, headers);
  }

  private rawRequest(
    method: HttpMethod,
    path: string,
    body: string | undefined,
    headers: Record<string, string>
  ): Promise<ApiResult> {
    return new Promise((resolve) => {
      let url: URL;
      try {
        url = new URL(this.base + path);
      } catch (e: any) {
        resolve({ ok: false, error: `Invalid URL: ${e.message}` });
        return;
      }

      const options: https.RequestOptions = {
        method,
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        agent: this.agent,
        headers: {
          Accept: 'application/json',
          ...headers,
          ...(body ? { 'Content-Length': Buffer.byteLength(body).toString() } : {}),
        },
        timeout: 30_000,
      };

      const req = https.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf-8');
          const status = res.statusCode || 0;
          let parsed: any = undefined;
          if (text) {
            try {
              parsed = JSON.parse(text);
            } catch {
              parsed = { raw: text };
            }
          }
          if (status >= 200 && status < 300) {
            resolve({ ok: true, status, data: parsed });
          } else {
            const errMsg =
              parsed?.errors
                ? JSON.stringify(parsed.errors)
                : parsed?.message || `HTTP ${status}`;
            resolve({ ok: false, status, error: errMsg, data: parsed });
          }
        });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ ok: false, error: 'Request timed out (30s)' });
      });
      req.on('error', (e: any) => {
        let msg = e.message || String(e);
        if (e.code === 'ECONNREFUSED') msg = `Connection refused to ${url.hostname}:${url.port}`;
        else if (e.code === 'ENOTFOUND') msg = `Host not found: ${url.hostname}`;
        else if (e.code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || e.code === 'SELF_SIGNED_CERT_IN_CHAIN')
          msg = 'Self-signed certificate. Disable "Verify SSL" for this connection.';
        else if (e.code === 'ETIMEDOUT') msg = `Connection timed out to ${url.hostname}:${url.port}`;
        resolve({ ok: false, error: msg });
      });

      if (body) req.write(body);
      req.end();
    });
  }

  // ---- Convenience wrappers ----
  get = (path: string, params?: Record<string, any>) => this.request('GET', path, params);
  post = (path: string, params?: Record<string, any>) => this.request('POST', path, params);
  put = (path: string, params?: Record<string, any>) => this.request('PUT', path, params);
  del = (path: string, params?: Record<string, any>) => this.request('DELETE', path, params);

  buildConsoleBaseUrl(): string {
    return `https://${this.profile.host}:${this.profile.port}`;
  }

  getProfile(): ConnectionProfile {
    return this.profile;
  }

  /** Returns the current auth ticket string (password auth only), or null. */
  getAuthTicket(): string | null {
    return this.ticket?.ticket ?? null;
  }
}
