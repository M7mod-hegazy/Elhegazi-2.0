export type ApiResponse<T> = { ok: true; item?: T; items?: T[]; total?: number; page?: number; pages?: number } | { ok: false; error: string };
import { auth } from '@/lib/firebase';

/** Thrown by {@link request} on non-2xx responses so callers can branch on HTTP status (e.g. 404). */
export class ApiHttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiHttpError';
    this.status = status;
  }
}

const base = '';
const ADMIN_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

function clearAdminAuthStorage() {
  if (typeof window === 'undefined') return;
  const keys = [
    'admin.auth.userId',
    'admin.auth.userEmail',
    'admin.auth.role',
    'admin.auth.firstName',
    'admin.auth.lastName',
    'admin.auth.isActive',
    'admin.auth.token',
    'admin.auth.lastActivityAt',
  ];
  keys.forEach((key) => localStorage.removeItem(key));
}

function checkAdminIdleLock() {
  if (typeof window === 'undefined') return false;
  const mode = localStorage.getItem('AUTH_MODE');
  if (mode !== 'admin') return false;
  const adminId = localStorage.getItem('admin.auth.userId');
  if (!adminId) return false;
  const lastActivityAt = Number(localStorage.getItem('admin.auth.lastActivityAt') || '0');
  if (!Number.isFinite(lastActivityAt) || lastActivityAt <= 0) return false;
  if (Date.now() - lastActivityAt <= ADMIN_IDLE_TIMEOUT_MS) return false;

  localStorage.setItem('admin.auth.lockReason', 'idle_timeout');
  localStorage.setItem('admin.auth.lockedAt', String(Date.now()));
  clearAdminAuthStorage();
  const evt = new CustomEvent('permission-denied', {
    detail: { status: 401, error: 'Admin session expired due to inactivity', reason: 'idle_timeout' },
  });
  window.dispatchEvent(evt);
  return true;
}

async function request(input: RequestInfo, init?: RequestInit): Promise<unknown> {
  if (checkAdminIdleLock()) {
    throw new Error('انتهت جلسة الإدارة بسبب عدم النشاط');
  }
  // Inject user headers from localStorage when available to identify the actor on the server
  const mergedInit: RequestInit = { ...(init || {}) };
  try {
    const headers = new Headers(init?.headers || {});
    
    // Check for admin token first, then regular token
    const adminToken = typeof window !== 'undefined' ? localStorage.getItem('admin.auth.token') : null;
    const adminUid = typeof window !== 'undefined' ? localStorage.getItem('admin.auth.userId') : null;
    const adminEmail = typeof window !== 'undefined' ? localStorage.getItem('admin.auth.userEmail') : null;
    
    const uid = typeof window !== 'undefined' ? localStorage.getItem('auth.userId') : null;
    const email = typeof window !== 'undefined' ? localStorage.getItem('auth.userEmail') : null;
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') : null;
    const mode = typeof window !== 'undefined' ? localStorage.getItem('AUTH_MODE') : null;
    
    // Choose identity strictly by explicit auth mode to avoid leaking admin identity
    const preferAdmin = mode === 'admin';
    const effectiveUid = preferAdmin ? adminUid : uid;
    const effectiveEmail = preferAdmin ? adminEmail : email;

    if (effectiveUid && !headers.has('x-user-id')) headers.set('x-user-id', effectiveUid);
    if (effectiveEmail && !headers.has('x-user-email')) headers.set('x-user-email', effectiveEmail);
    
    if (mode && !headers.has('x-auth-mode')) headers.set('x-auth-mode', mode);
    
    const effectiveToken = preferAdmin ? adminToken : token;
    if (effectiveToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${effectiveToken}`);
    
    // Legacy support for admin secret override
    const adminSecret = typeof window !== 'undefined' ? localStorage.getItem('ADMIN_SECRET') : null;
    if (adminSecret && !headers.has('x-admin-secret')) headers.set('x-admin-secret', adminSecret);

    // Firebase mode: attach ID token if present and no Authorization provided yet
    if (!headers.has('Authorization') && auth?.currentUser?.getIdToken) {
      try {
        const idToken = await auth.currentUser.getIdToken();
        if (idToken) headers.set('Authorization', `Bearer ${idToken}`);
      } catch { /* ignore token fetch errors */ }
    }
    mergedInit.headers = headers;
  } catch {
    // ignore header injection failures (SSR or storage issues)
  }
  // Ensure cookies/session are sent if backend uses cookie-based auth
  if (!('credentials' in mergedInit)) mergedInit.credentials = 'include';
  const res = await fetch(input, mergedInit);
  const ct = res.headers.get('content-type') || '';
  const data = ct.includes('application/json') ? await res.json() : await res.text();
  if (!res.ok) {
    // Emit a global permission-denied event to enable graceful UI messaging
    try {
      if (res.status === 401 || res.status === 403) {
        const detail = typeof data === 'string' ? { error: data } : (data || {});
        if (res.status === 401 && detail?.reason === 'idle_timeout') {
          clearAdminAuthStorage();
        }
        const evt = new CustomEvent('permission-denied', { detail: { status: res.status, ...detail, url: input } });
        window.dispatchEvent(evt);
      }
    } catch { /* ignore event dispatch errors */ }
    const message = typeof data === 'string' ? data : (data?.error || res.statusText);
    throw new ApiHttpError(res.status, typeof message === 'string' ? message : String(message));
  }
  return data;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  return request(base + path, { method: 'GET' }) as Promise<ApiResponse<T>>;
}

export async function apiPostJson<T, B extends Record<string, unknown> | unknown>(path: string, body: B): Promise<ApiResponse<T>> {
  return request(base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<ApiResponse<T>>;
}

export async function apiPutJson<T, B extends Record<string, unknown> | unknown>(path: string, body: B, extraHeaders?: Record<string, string>): Promise<ApiResponse<T>> {
  return request(base + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(extraHeaders || {}) },
    body: JSON.stringify(body),
  }) as Promise<ApiResponse<T>>;
}

export async function apiPatchJson<T, B extends Record<string, unknown> | unknown>(path: string, body: B): Promise<ApiResponse<T>> {
  return request(base + path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as Promise<ApiResponse<T>>;
}

export async function apiDelete(path: string): Promise<ApiResponse<unknown>> {
  return request(base + path, { method: 'DELETE' }) as Promise<ApiResponse<unknown>>;
}

export async function uploadFile(
  file: File,
  options?: { folder?: string; publicId?: string }
): Promise<{ secure_url: string; public_id: string }>{
  const fd = new FormData();
  fd.append('file', file);
  if (options?.folder) fd.append('folder', options.folder);
  if (options?.publicId) fd.append('public_id', options.publicId);
  const data = await request('/api/cloudinary/upload-file', {
    method: 'POST',
    body: fd,
  });
  const resp = data as { ok: boolean; error?: string; result?: { secure_url: string; public_id: string } };
  if (!resp.ok) throw new Error(resp.error || 'Upload failed');
  const r = resp as { ok: true; result: { secure_url: string; public_id: string } };
  return { secure_url: r.result.secure_url, public_id: r.result.public_id };
}
