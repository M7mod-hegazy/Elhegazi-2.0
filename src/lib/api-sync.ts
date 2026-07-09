import { apiGet, apiPostJson, apiPutJson, apiDelete } from '@/lib/api';

export interface SyncProduct {
  _id: string;
  sku: string;
  name: string;
  nameAr: string;
  price: number;
  stock: number;
  stockByStore?: Record<string, number>;
  image?: string;
  images?: string[];
  description?: string;
  descriptionAr?: string;
  active?: boolean;
  categorySlug?: string;
  updatedAt: string;
  localMatch?: {
    exists: boolean;
    name?: { match: boolean; local: string; ecom: string };
    price?: { match: boolean; local: number; ecom: number };
    stock?: { match: boolean; local: number; ecom: number };
    image?: { match: boolean; local: string | null; ecom: string | null };
  };
}

export interface SyncStore {
  _id: string;
  name: string;
  apiKeyPrefix: string;
  isActive: boolean;
  lastSeenAt?: string;
  allowedIps: string[];
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface SyncStatusData {
  storeName: string;
  storeId: string;
  lastSeenAt?: string;
  totalProducts: number;
  activeProducts: number;
  totalCategories: number;
  changesSinceLastSync: number;
}

export interface SyncCheckResponse {
  ok: boolean;
  products: SyncProduct[];
  categories: any[];
  stockChanges: any[];
  totalProducts: number;
  pages: number;
}

function extractError(res: unknown): string {
  return res && typeof res === 'object' && 'error' in res ? String((res as any).error) : 'Unknown error';
}

export async function getSyncStatus(): Promise<SyncStatusData | null> {
  const res = await apiGet<any>('/api/sync/status');
  if (!res.ok) throw new Error(extractError(res));
  return res.item?.status ?? null;
}

export async function getStores(): Promise<SyncStore[]> {
  const res = await apiGet<SyncStore>('/api/sync/admin/stores');
  if (!res.ok) throw new Error(extractError(res));
  return res.items || [];
}

export async function getSyncCheck(): Promise<SyncCheckResponse> {
  const res = await apiGet<any>('/api/sync/check');
  if (!res.ok) throw new Error(extractError(res));
  return { ok: true, products: res.item?.products || [], categories: res.item?.categories || [], stockChanges: res.item?.stockChanges || [], totalProducts: res.item?.totalProducts || 0, pages: res.item?.pages || 0 };
}

export async function createStore(data: {
  name: string;
  allowedIps?: string[];
  notes?: string;
}): Promise<{ store: SyncStore; apiKey: string }> {
  const res = await apiPostJson<any, typeof data>('/api/sync/admin/stores', data);
  if (!res.ok) throw new Error(extractError(res));
  return res.item!;
}

export async function updateStore(
  id: string,
  data: { name?: string; isActive?: boolean; allowedIps?: string[]; notes?: string }
): Promise<SyncStore> {
  const res = await apiPutJson<SyncStore, typeof data>('/api/sync/admin/stores/' + id, data);
  if (!res.ok) throw new Error(extractError(res));
  return res.item!;
}

export async function deleteStore(id: string): Promise<void> {
  const res = await apiDelete('/api/sync/admin/stores/' + id);
  if (!res.ok) throw new Error(extractError(res));
}

export async function getSyncedProducts(): Promise<SyncProduct[]> {
  const res = await apiGet<SyncProduct>('/api/sync/admin/products');
  if (!res.ok) throw new Error(extractError(res));
  return res.items || [];
}

export async function rotateStoreKey(id: string): Promise<string> {
  const res = await apiPostJson<any, Record<string, unknown>>('/api/sync/admin/stores/' + id + '/rotate-key', {});
  if (!res.ok) throw new Error(extractError(res));
  return res.item!.apiKey;
}

export interface SyncActivityEvent {
  _id: string;
  storeId: string;
  storeName: string;
  type: 'sync' | 'error' | 'warning';
  description: string;
  descriptionAr: string;
  createdAt: string;
}

export async function getSyncActivity(): Promise<SyncActivityEvent[]> {
  const res = await apiGet<SyncActivityEvent>('/api/sync/activity');
  if (!res.ok) throw new Error(extractError(res));
  return res.items || [];
}

export interface SyncImpactSummary {
  totalChanges: number;
  newProducts: number;
  pricesUp: { count: number; totalIncrease: number };
  pricesDown: { count: number; totalDecrease: number };
  stockToZero: { count: number };
  imageChanges: { count: number };
  productsToInactive: { count: number };
  fieldChanges: { count: number };
}

export async function getSyncImpactSummary(): Promise<SyncImpactSummary | null> {
  try {
    const res = await apiGet<{ summary: SyncImpactSummary }>('/api/sync/impact-summary');
    if (!res.ok) return null;
    return res.item?.summary ?? null;
  } catch {
    return null;
  }
}

// ─── Webhook types ────────────────────────────────────────────────────────────

export interface WebhookConfig {
  storeId: string;
  webhookUrl: string;
  webhookSecret: string;
  isActive: boolean;
  lastDelivery?: {
    status: 'success' | 'failed' | 'pending';
    createdAt: string;
    responseCode?: number;
  };
}

export interface WebhookLog {
  _id: string;
  storeId: string;
  event: string;
  status: 'success' | 'failed' | 'pending';
  requestBody?: string;
  responseCode?: number;
  responseBody?: string;
  createdAt: string;
}

export interface WebhookTestResult {
  ok: boolean;
  statusCode?: number;
  message?: string;
}

// ─── Webhook API functions ────────────────────────────────────────────────────

export async function getWebhookConfig(storeId: string): Promise<WebhookConfig | null> {
  try {
    const res = await apiGet<WebhookConfig>(`/api/sync/admin/stores/${storeId}/webhook`);
    if (!res.ok) return null;
    return res.item ?? null;
  } catch {
    return null;
  }
}

export async function updateWebhookConfig(
  storeId: string,
  data: { isActive?: boolean; webhookSecret?: string }
): Promise<WebhookConfig | null> {
  try {
    const res = await apiPutJson<WebhookConfig, typeof data>(
      `/api/sync/admin/stores/${storeId}/webhook`,
      data
    );
    if (!res.ok) return null;
    return res.item ?? null;
  } catch {
    return null;
  }
}

export async function getWebhookLogs(storeId: string): Promise<WebhookLog[]> {
  try {
    const res = await apiGet<WebhookLog>(`/api/sync/admin/stores/${storeId}/webhook/logs`);
    if (!res.ok) return [];
    return res.items || [];
  } catch {
    return [];
  }
}

export async function testWebhookDelivery(storeId: string): Promise<WebhookTestResult | null> {
  try {
    const res = await apiPostJson<WebhookTestResult, Record<string, unknown>>(
      `/api/sync/admin/stores/${storeId}/webhook/test`,
      {}
    );
    if (!res.ok) return null;
    return res.item ?? null;
  } catch {
    return null;
  }
}

// ─── Store detail + batch operations ────────────────────────────────────────────

export async function getStoreById(id: string): Promise<SyncStore> {
  const res = await apiGet<SyncStore>('/api/sync/admin/stores/' + id);
  if (!res.ok) throw new Error(extractError(res));
  return res.item!;
}

export async function getStoreActivity(id: string, params?: { type?: string; days?: number }): Promise<SyncActivityEvent[]> {
  const query = params ? '?' + new URLSearchParams(
    Object.fromEntries(Object.entries(params).filter(([_, v]) => v !== undefined)) as Record<string, string>
  ).toString() : '';
  const res = await apiGet<SyncActivityEvent>('/api/sync/admin/stores/' + id + '/activity' + query);
  if (!res.ok) throw new Error(extractError(res));
  return res.items || [];
}

export async function batchActivateStores(ids: string[]): Promise<void> {
  const res = await apiPostJson<any, { ids: string[] }>('/api/sync/admin/stores/batch-activate', { ids });
  if (!res.ok) throw new Error(extractError(res));
}

export async function batchDeactivateStores(ids: string[]): Promise<void> {
  const res = await apiPostJson<any, { ids: string[] }>('/api/sync/admin/stores/batch-deactivate', { ids });
  if (!res.ok) throw new Error(extractError(res));
}

export async function batchDeleteStores(ids: string[]): Promise<void> {
  const res = await apiPostJson<any, { ids: string[] }>('/api/sync/admin/stores/batch-delete', { ids });
  if (!res.ok) throw new Error(extractError(res));
}

export async function triggerManualSync(storeId?: string): Promise<void> {
  const res = await apiPostJson<any, { storeId?: string }>('/api/sync/admin/trigger-sync', { storeId });
  if (!res.ok) throw new Error(extractError(res));
}

export async function adminApplySync(items: Array<{ sku: string; fields: Record<string, unknown> }>): Promise<{ succeeded: Array<{ sku: string }>; failed: Array<{ sku: string; error: string }> }> {
  const res = await apiPostJson<any, { items: typeof items }>('/api/sync/admin/apply', { items });
  if (!res.ok) throw new Error(extractError(res));
  const data = res as any;
  return { succeeded: data.succeeded || [], failed: data.failed || [] };
}

// ─── Pending online orders ─────────────────────────────────────────────────────

export interface PendingOrderItem {
  productId: string;
  product?: Record<string, unknown>;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface PendingOrder {
  _id: string;
  orderNumber?: string;
  items: PendingOrderItem[];
  subtotal: number;
  total: number;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingAddress?: {
    name?: string;
    phone?: string;
    city?: string;
    street?: string;
  };
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export async function getPendingOrders(page = 1, status = 'pending'): Promise<{ items: PendingOrder[]; total: number }> {
  const res = await apiGet<PendingOrder>(`/api/sync/admin/pending-orders?page=${page}&status=${status}`);
  if (!res.ok) throw new Error(extractError(res));
  return { items: res.items || [], total: res.total || 0 };
}

// ─── Rollback history ──────────────────────────────────────────────────────────

export interface SyncSnapshot {
  id: number;
  direction: 'pull' | 'push' | 'rollback';
  items_count: number;
  created_at: string;
  metadata?: { newProducts?: number; pricesChanged?: number; stockChanged?: number };
}

export async function getRollbackHistory(page = 1): Promise<{ items: SyncSnapshot[]; total: number }> {
  const res = await apiGet<SyncSnapshot>(`/api/sync/snapshots?page=${page}&limit=20`);
  if (!res.ok) throw new Error(extractError(res));
  return { items: res.items || [], total: res.total || 0 };
}
