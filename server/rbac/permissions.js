import Role from '../models/Role.js';
import User from '../models/User.js';
import UserRole from '../models/UserRole.js';

// Fetch permissions across all user roles
// Simple in-memory cache for permission contexts
export const __permCache = new Map(); // key: `${userId}` -> { perms, ts }
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// Function to clear user permission cache
export function clearUserPermissionCache(userId) {
  if (userId) {
    __permCache.delete(String(userId));
  } else {
    __permCache.clear();
  }
}

// Super admin override cache for ADMIN_DEV_USER_EMAIL or ADMIN_EMAIL mapping
let __superIds = new Set();
async function isDevSuper(userId) {
  try {
    const emails = [process.env.ADMIN_DEV_USER_EMAIL, process.env.ADMIN_EMAIL].filter(Boolean);
    if (!emails.length) return false;
    // Prime cache if empty
    if (__superIds.size === 0) {
      const found = await User.find({ email: { $in: emails } }).select('_id').lean();
      for (const f of found) __superIds.add(String(f._id));
    }
    return __superIds.has(String(userId));
  } catch {
    return false;
  }
}

export async function getUserPermissions(userId) {
  const key = String(userId);
  const cached = __permCache.get(key);
  if (cached && (Date.now() - cached.ts) < CACHE_TTL_MS) {
    return cached.perms;
  }
  const userRoles = await UserRole.find({ userId }).lean();
  if (!userRoles.length) return [];
  const roleIds = userRoles.map((ur) => ur.roleId);
  const roles = await Role.find({ _id: { $in: roleIds } }).lean();
  const perms = roles.flatMap((r) => r.permissions || []);
  __permCache.set(key, { perms, ts: Date.now() });
  return perms;
}

export function mergeConditions(conds) {
  const out = {};
  for (const c of conds) {
    if (!c) continue;
    for (const [k, v] of Object.entries(c)) {
      if (Array.isArray(v)) {
        out[k] = Array.isArray(out[k]) ? Array.from(new Set([...out[k], ...v])) : v.slice();
      } else if (v && typeof v === 'object') {
        out[k] = { ...(out[k] || {}), ...v };
      } else {
        out[k] = v;
      }
    }
  }
  return out;
}

export async function getPermissionContext(userId, resource, action) {
  // Dev-only super override
  if (await isDevSuper(userId)) {
    return { allowed: true, conditions: {} };
  }
  const perms = await getUserPermissions(userId);
  const matched = perms.filter((p) => {
    const resOk = p.resource === resource || p.resource === '*' ;
    const actOk = Array.isArray(p.actions) && (p.actions.includes(action) || p.actions.includes('*'));
    return resOk && actOk;
  });
  if (!matched.length) return { allowed: false };
  const conditions = mergeConditions(matched.map((m) => m.conditions || {}));
  return { allowed: true, conditions };
}

export function applyReadConditions(baseFilter, conditions, { userId } = {}) {
  const filter = { ...(baseFilter || {}) };
  if (!conditions) return filter;
  if (conditions.branchIds?.length) filter.branchId = { $in: conditions.branchIds };
  if (conditions.categoryIds?.length) filter.categoryId = { $in: conditions.categoryIds };
  if (conditions.status?.length) filter.status = { $in: conditions.status };
  if (conditions.dateRange?.from || conditions.dateRange?.to) {
    filter.createdAt = { ...(filter.createdAt || {}) };
    if (conditions.dateRange.from) filter.createdAt.$gte = new Date(conditions.dateRange.from);
    if (conditions.dateRange.to) filter.createdAt.$lte = new Date(conditions.dateRange.to);
  }
  if (conditions.ownedBy === 'self' && userId) filter.userId = userId;
  return filter;
}

export function validateWriteAgainstConditions(record, conditions, userId) {
  if (!conditions) return true;
  const get = (obj, key) => (obj ? obj[key] ?? obj[key]?.toString?.() : undefined);
  if (conditions.branchIds?.length) {
    const recBranch = get(record, 'branchId') || get(record, 'branch');
    if (!recBranch || !conditions.branchIds.map(String).includes(String(recBranch))) return false;
  }
  if (conditions.categoryIds?.length) {
    const recCat = get(record, 'categoryId') || get(record, 'category');
    if (!recCat || !conditions.categoryIds.map(String).includes(String(recCat))) return false;
  }
  if (conditions.ownedBy === 'self' && userId) {
    const recUser = get(record, 'userId');
    if (String(recUser) !== String(userId)) return false;
  }
  if (typeof conditions.maxAmount === 'number') {
    const amt = Number(get(record, 'amount') ?? get(record, 'total') ?? 0);
    if (amt > conditions.maxAmount) return false;
  }
  return true;
}

// Express middleware factory
export function requirePermission(resource, action, { attach = false } = {}) {
  return async (req, res, next) => {
    try {
      // Resolve user by id (header), or email if provided
      let userId = req.user?._id || req.user?.id || req.header('x-user-id');
      if (!userId) {
        const email = req.user?.email || req.header('x-user-email');
        if (email) {
          const u = await User.findOne({ email }).select('_id').lean();
          if (u) userId = String(u._id);
        }
      }
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized', resource, action });
      const ctx = await getPermissionContext(userId, resource, action);
      if (!ctx.allowed) return res.status(403).json({ ok: false, error: 'Forbidden', resource, action, userId: String(userId) });
      if (attach) req.permission = { conditions: ctx.conditions, userId: String(userId) };
      return next();
    } catch (e) {
      return next(e);
    }
  };
}