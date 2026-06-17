// Thin wrapper around window.pmx.pve with error-throwing semantics for use in hooks.
import type { ApiResult } from '@shared/types';

export async function apiGet<T = any>(path: string, params?: Record<string, any>): Promise<T> {
  const res = await window.pmx.pve.get(path, params);
  if (!res.ok) throw new Error(res.error || `GET ${path} failed`);
  return res.data?.data as T;
}

export async function apiPost(path: string, params?: Record<string, any>): Promise<ApiResult> {
  return window.pmx.pve.post(path, params);
}

export async function apiPut(path: string, params?: Record<string, any>): Promise<ApiResult> {
  return window.pmx.pve.put(path, params);
}

export async function apiDel(path: string, params?: Record<string, any>): Promise<ApiResult> {
  return window.pmx.pve.del(path, params);
}

/** Returns a friendly error string from an ApiResult, or null if ok. */
export function errOf(res: ApiResult): string | null {
  return res.ok ? null : res.error || 'Request failed';
}
