/**
 * Admin access helpers. All authenticated admin-panel sessions get full access;
 * RBAC matrix is no longer required for day-to-day admin operations.
 */

export interface Permission {
  resource: string;
  action: 'read' | 'create' | 'update' | 'delete' | 'manage';
  allowed: boolean;
}

export interface UserPermissions {
  isSuperAdmin: boolean;
  permissions: Permission[];
}

let permissionsCache: UserPermissions | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5 * 60 * 1000;

/** True when the current browser session is an admin with full dashboard access. */
export function hasFullAdminAccess(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    const mode = localStorage.getItem('AUTH_MODE');
    if (mode === 'admin') return true;
    const adminRole = (localStorage.getItem('admin.auth.role') || '').toLowerCase();
    if (['admin', 'superadmin', 'super_admin'].includes(adminRole)) return true;
    const authRole = (localStorage.getItem('auth.role') || '').toLowerCase();
    if (['admin', 'superadmin', 'super_admin'].includes(authRole)) return true;
    const adminEmail = localStorage.getItem('admin.auth.userEmail');
    if (adminEmail === 'admin@example.com') return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Legacy name: treated as “full admin capabilities” for the dashboard and guards.
 */
export function isSuperAdmin(): boolean {
  return hasFullAdminAccess();
}

export async function getUserPermissions(forceRefresh = false): Promise<UserPermissions> {
  if (!forceRefresh && permissionsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return permissionsCache;
  }

  if (hasFullAdminAccess()) {
    const all: UserPermissions = { isSuperAdmin: true, permissions: [] };
    permissionsCache = all;
    cacheTimestamp = Date.now();
    return all;
  }

  try {
    const userId =
      localStorage.getItem('admin.auth.userId') ||
      localStorage.getItem('auth.userId');
    if (!userId) {
      return { isSuperAdmin: false, permissions: [] };
    }

    const response = await fetch(`/api/rbac/my-permissions`, {
      headers: {
        'x-user-id': userId,
        'x-user-email':
          localStorage.getItem('admin.auth.userEmail') ||
          localStorage.getItem('auth.userEmail') ||
          '',
        Authorization: `Bearer ${localStorage.getItem('admin.auth.token') || localStorage.getItem('auth.token') || ''}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      const userPerms: UserPermissions = {
        isSuperAdmin: false,
        permissions: data.permissions || [],
      };
      permissionsCache = userPerms;
      cacheTimestamp = Date.now();
      return userPerms;
    }
  } catch (error) {
    console.error('Failed to fetch permissions:', error);
  }

  return { isSuperAdmin: false, permissions: [] };
}

export async function hasPermission(resource: string, action: string): Promise<boolean> {
  if (hasFullAdminAccess()) return true;
  const perms = await getUserPermissions();
  if (perms.isSuperAdmin) return true;
  return perms.permissions.some(
    (p) => p.resource === resource && p.action === action && p.allowed
  );
}

export async function canAccessPage(pageName: string): Promise<boolean> {
  if (hasFullAdminAccess()) return true;
  const perms = await getUserPermissions();
  if (perms.isSuperAdmin) return true;

  const pageResourceMap: Record<string, string> = {
    dashboard: 'dashboard',
    products: 'products',
    categories: 'categories',
    orders: 'orders',
    users: 'users',
    locations: 'branches',
    'qr-codes': 'qr',
    'home-config': 'home',
    settings: 'settings',
    history: 'history',
    profit: 'expenses',
    latestWork: 'products',
  };

  const resource = pageResourceMap[pageName];
  if (!resource) return false;
  return hasPermission(resource, 'read');
}

export function clearPermissionsCache() {
  permissionsCache = null;
  cacheTimestamp = 0;
}

const ALL_ADMIN_PAGES = [
  'dashboard',
  'products',
  'categories',
  'orders',
  'users',
  'locations',
  'qr-codes',
  'home-config',
  'settings',
  'history',
  'profit',
  'latestWork',
] as const;

export async function getAccessiblePages(): Promise<string[]> {
  if (hasFullAdminAccess()) return [...ALL_ADMIN_PAGES];
  const perms = await getUserPermissions();
  if (perms.isSuperAdmin) return [...ALL_ADMIN_PAGES];

  const accessible: string[] = [];
  for (const page of ALL_ADMIN_PAGES) {
    if (await canAccessPage(page)) accessible.push(page);
  }
  return accessible;
}
