export type ApiResponse<T> = { ok: true; item?: T; items?: T[]; total?: number; page?: number; pages?: number } | { ok: false; error: string };
import { auth } from '@/lib/firebase';

const base = '';

async function request(input: RequestInfo, init?: RequestInit): Promise<unknown> {
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
    
    // Use admin credentials if available, otherwise use regular user credentials
    if (adminUid && !headers.has('x-user-id')) headers.set('x-user-id', adminUid);
    else if (uid && !headers.has('x-user-id')) headers.set('x-user-id', uid);
    
    if (adminEmail && !headers.has('x-user-email')) headers.set('x-user-email', adminEmail);
    else if (email && !headers.has('x-user-email')) headers.set('x-user-email', email);
    
    if (mode && !headers.has('x-auth-mode')) headers.set('x-auth-mode', mode);
    
    if (adminToken && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${adminToken}`);
    else if (token && !headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
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
        const evt = new CustomEvent('permission-denied', { detail: { status: res.status, ...detail, url: input } });
        window.dispatchEvent(evt);
      }
    } catch { /* ignore event dispatch errors */ }
    const message = typeof data === 'string' ? data : (data?.error || res.statusText);
    throw new Error(message);
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

export async function uploadFile(file: File): Promise<{ secure_url: string; public_id: string }>{
  const fd = new FormData();
  fd.append('file', file);
  const data = await request('/api/cloudinary/upload-file', {
    method: 'POST',
    body: fd,
  });
  const resp = data as { ok: boolean; error?: string; result?: { secure_url: string; public_id: string } };
  if (!resp.ok) throw new Error(resp.error || 'Upload failed');
  const r = resp as { ok: true; result: { secure_url: string; public_id: string } };
  return { secure_url: r.result.secure_url, public_id: r.result.public_id };
}
