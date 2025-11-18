/**
 * Permission Management Utility
 * Handles role-based access control (RBAC) for admin users
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

// Cache for user permissions
let permissionsCache: UserPermissions | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

/**
 * Check if user is SuperAdmin
 */
export function isSuperAdmin(): boolean {
  // Check admin email first
  const adminEmail = localStorage.getItem('admin.auth.userEmail');
  if (adminEmail === 'admin@example.com') {
    return true;
  }
  
  // Check role
  const adminRole = localStorage.getItem('admin.auth.role');
  const role = localStorage.getItem('auth.role');
  return adminRole === 'SuperAdmin' || adminRole === 'super_admin' || 
         role === 'SuperAdmin' || role === 'super_admin';
}

/**
 * Get user permissions from cache or fetch from server
 */
export async function getUserPermissions(forceRefresh = false): Promise<UserPermissions> {
  // Check cache first
  if (!forceRefresh && permissionsCache && Date.now() - cacheTimestamp < CACHE_DURATION) {
    return permissionsCache;
  }

  // SuperAdmin has all permissions
  if (isSuperAdmin()) {
    const superAdminPerms: UserPermissions = {
      isSuperAdmin: true,
      permissions: []
    };
    permissionsCache = superAdminPerms;
    cacheTimestamp = Date.now();
    return superAdminPerms;
  }

  // Fetch permissions from server for regular admin
  try {
    const userId = localStorage.getItem('auth.userId');
    if (!userId) {
      return { isSuperAdmin: false, permissions: [] };
    }

    const response = await fetch(`/api/rbac/my-permissions`, {
      headers: {
        'x-user-id': userId,
        'x-user-email': localStorage.getItem('auth.userEmail') || '',
        'Authorization': `Bearer ${localStorage.getItem('auth.token') || ''}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      const userPerms: UserPermissions = {
        isSuperAdmin: false,
        permissions: data.permissions || []
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

/**
 * Check if user has permission for a specific resource and action
 */
export async function hasPermission(resource: string, action: string): Promise<boolean> {
  const perms = await getUserPermissions();
  
  // SuperAdmin has all permissions
  if (perms.isSuperAdmin) {
    return true;
  }

  // Check specific permission
  return perms.permissions.some(
    p => p.resource === resource && p.action === action && p.allowed
  );
}

/**
 * Check if user can access a specific admin page
 */
export async function canAccessPage(pageName: string): Promise<boolean> {
  const perms = await getUserPermissions();
  
  // SuperAdmin can access everything
  if (perms.isSuperAdmin) {
    return true;
  }

  // Map page names to resources
  const pageResourceMap: Record<string, string> = {
    'dashboard': 'dashboard',
    'products': 'products',
    'categories': 'categories',
    'orders': 'orders',
    'users': 'users',
    'locations': 'branches',
    'qr-codes': 'qr',
    'home-config': 'home',
    'settings': 'settings',
    'history': 'history',
    'profit': 'expenses'
  };

  const resource = pageResourceMap[pageName];
  if (!resource) return false;

  return hasPermission(resource, 'read');
}

/**
 * Clear permissions cache (call on logout)
 */
export function clearPermissionsCache() {
  permissionsCache = null;
  cacheTimestamp = 0;
}

/**
 * Get list of accessible pages for navigation
 */
export async function getAccessiblePages(): Promise<string[]> {
  const perms = await getUserPermissions();
  
  // SuperAdmin can access all pages
  if (perms.isSuperAdmin) {
    return [
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
      'profit'
    ];
  }

  // Filter pages based on permissions
  const pages = [
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
    'profit'
  ];

  const accessible: string[] = [];
  for (const page of pages) {
    if (await canAccessPage(page)) {
      accessible.push(page);
    }
  }

  return accessible;
}
