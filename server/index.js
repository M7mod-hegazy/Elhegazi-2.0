// Helper: send JSON with weak ETag and handle 304 Not Modified
function sendJsonWithEtag(req, res, bodyObj) {
  try {
    const payload = JSON.stringify(bodyObj);
    const etag = 'W/"' + crypto.createHash('sha1').update(payload).digest('base64') + '"';
    if (req.headers['if-none-match'] && req.headers['if-none-match'] === etag) {
      return res.status(304).end();
    }
    res.set('ETag', etag);
    res.type('application/json').send(payload);
  } catch (e) {
    // Fallback
    res.json(bodyObj);
  }
}
// Simple Express server with MongoDB (Mongoose) and Cloudinary configuration
// IMPORTANT: Do NOT hardcode secrets. Use a .env file. See server/.env.example

import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';
import multer from 'multer';
import net from 'node:net';
import { requirePermission, applyReadConditions, validateWriteAgainstConditions, getUserPermissions, clearUserPermissionCache } from './rbac/permissions.js';

const ORDER_STATUS_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: []
};

const ORDER_FINAL_STATUSES = new Set(['delivered', 'cancelled', 'refunded']);

function canTransitionStatus(current, next) {
  if (!current || !next) return false;
  if (current === next) return true;
  const allowed = ORDER_STATUS_TRANSITIONS[current] || [];
  return allowed.includes(next);
}

function buildInternalNote({ text, user }) {
  if (!text) return null;
  return {
    text,
    createdBy: user?._id || undefined,
    createdByName: user?.email || user?.name || 'System',
    createdAt: new Date()
  };
}

// Models
import Product from './models/Product.js';
import Category from './models/Category.js';
import User from './models/User.js';
import Order from './models/Order.js';
import HomeConfig from './models/HomeConfig.js';
import ShopSetup from './models/ShopSetup.js';
import Settings from './models/Settings.js';
import History from './models/History.js';
import ProfitReport from './models/ProfitReport.js';
import ProfitSettings from './models/ProfitSettings.js';
import Role from './models/Role.js';
import UserRole from './models/UserRole.js';
import Transaction from './models/Transaction.js';
import Branch from './models/Branch.js';
import HistoryRead from './models/HistoryRead.js';
import Rating from './models/Rating.js';
import BuilderPricingConfig from './models/BuilderPricingConfig.js';
import BuilderAccessSession from './models/BuilderAccessSession.js';
import BuilderProject from './models/BuilderProject.js';

// Services
import orderAutomationService from './services/orderAutomationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

// Initialize Express app and core middleware BEFORE routes
const app = express();
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// Attach minimal auth user from headers (to be replaced by real auth)
// Also validates user exists in DB. Dev admin fallback is restricted to admin-mode requests only.
app.use(async (req, _res, next) => {
  try {
    const userId = req.header('x-user-id');
    if (userId) {
      // Verify user actually exists in the database
      const existingUser = await User.findById(userId).select('_id email').lean();
      if (existingUser) {
        req.user = { _id: String(existingUser._id), email: existingUser.email };
      }
      // If user ID is stale/invalid, fall through to dev fallback below
    }
    const authMode = String(req.header('x-auth-mode') || '').toLowerCase();
    const hasAdminSecret = !!req.header('x-admin-secret');
    const adminModeRequest = authMode === 'admin' || hasAdminSecret || req.path.startsWith('/api/admin');
    // Dev fallback identity: only for explicit admin-mode requests
    if (!req.user && adminModeRequest && process.env.ADMIN_DEV_USER_EMAIL) {
      const u = await User.findOne({ email: process.env.ADMIN_DEV_USER_EMAIL }).select('_id').lean();
      if (u) req.user = { _id: String(u._id), email: process.env.ADMIN_DEV_USER_EMAIL };
    }
  } catch { /* ignore */ }
  next();
});

// Dev auto-grant fallback: on first request, ensure SuperAdmin assigned to ADMIN_DEV_USER_EMAIL
let __devAutoGranted = false;
app.use(async (_req, _res, next) => {
  if (__devAutoGranted) return next();
  try {
    const devEmail = process.env.ADMIN_DEV_USER_EMAIL;
    if (!devEmail) return next();
    const user = await User.findOne({ email: devEmail }).select('_id').lean();
    if (!user) return next();
    let role = await Role.findOne({ name: 'SuperAdmin' }).select('_id').lean();
    if (!role) {
      role = await Role.create({ name: 'SuperAdmin', description: 'All access', permissions: [ { resource: '*', actions: ['*'] } ] });
    }
    await UserRole.updateOne({ userId: user._id, roleId: role._id }, { $setOnInsert: { userId: user._id, roleId: role._id } }, { upsert: true });
    __devAutoGranted = true;
  } catch { /* ignore dev auto grant errors */ }
  return next();
});

// Debug: whoami (verify identity propagation)
app.get('/api/debug/whoami', async (req, res) => {
  try {
    const headerId = req.header('x-user-id') || null;
    const headerEmail = req.header('x-user-email') || null;
    const reqUser = req.user || null;
    let resolvedId = reqUser?._id || null;
    if (!resolvedId && headerEmail) {
      const u = await User.findOne({ email: headerEmail }).select('_id email').lean();
      if (u) resolvedId = String(u._id);
    }
    return res.json({ ok: true, headerId, headerEmail, reqUser, resolvedId });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim()
    || req.socket?.remoteAddress
    || req.ip
    || 'unknown-ip'
  );
}

function getActorKey(req) {
  const userId = req.user?._id || null;
  if (userId) return `user:${userId}`;
  const ua = String(req.headers['user-agent'] || 'unknown-ua');
  const ip = getClientIp(req);
  const anonHash = crypto.createHash('sha1').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
  return `anon:${anonHash}`;
}

async function getBuilderPricingConfig() {
  let cfg = await BuilderPricingConfig.findOne().lean();
  if (!cfg) {
    cfg = (await BuilderPricingConfig.create({
      isFreeNow: true,
      currentPriceEgp: 0,
      nextPriceEgp: 100,
      sessionMinutes: 90,
      idleTimeoutMinutes: 15,
      singleActiveSessionPerActor: true,
      isActive: true,
    })).toObject();
  }
  return cfg;
}

const OWNER_VAULT_SESSION_MINUTES = 15;

const DEFAULT_OWNER_VISIBILITY = {
  publicPages: {
    home: true,
    products: true,
    productDetail: true,
    categories: true,
    cart: true,
    checkout: true,
    favorites: true,
    profile: true,
    orders: true,
    about: true,
    contact: true,
    locations: true,
    shopBuilder: true,
  },
  adminModules: {
    dashboard: true,
    products: true,
    products3d: true,
    categories: true,
    orders: true,
    users: true,
    locations: true,
    qrcodes: true,
    homeConfig: true,
    settings: true,
    history: true,
    profit: true,
    shareholders: true,
  },
  featureFlags: {
    rating: true,
    favorites: true,
    shopBuilder3d: true,
    prices: true,
  },
};

function mergeVisibility(visibility = {}) {
  return {
    publicPages: { ...DEFAULT_OWNER_VISIBILITY.publicPages, ...(visibility.publicPages || {}) },
    adminModules: { ...DEFAULT_OWNER_VISIBILITY.adminModules, ...(visibility.adminModules || {}) },
    featureFlags: { ...DEFAULT_OWNER_VISIBILITY.featureFlags, ...(visibility.featureFlags || {}) },
  };
}

function sanitizeOwnerVault(ownerVault = {}) {
  return {
    enabled: ownerVault.enabled !== false,
    visibility: mergeVisibility(ownerVault.visibility || {}),
    updatedBy: ownerVault.updatedBy || '',
    updatedAt: ownerVault.updatedAt || null,
  };
}

function sanitizeSettingsDoc(doc) {
  if (!doc) return doc;
  const next = JSON.parse(JSON.stringify(doc));
  if (next.ownerVault) {
    next.ownerVault = sanitizeOwnerVault(next.ownerVault);
  } else {
    next.ownerVault = sanitizeOwnerVault({});
  }
  return next;
}

function hashOwnerPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derived}`;
}

function verifyOwnerPassword(password, encoded) {
  if (!encoded || !encoded.startsWith('scrypt$')) return false;
  const parts = String(encoded).split('$');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const storedHex = parts[2];
  const incomingHex = crypto.scryptSync(password, salt, 64).toString('hex');
  const stored = Buffer.from(storedHex, 'hex');
  const incoming = Buffer.from(incomingHex, 'hex');
  if (stored.length !== incoming.length) return false;
  return crypto.timingSafeEqual(stored, incoming);
}

function hashOwnerToken(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function getOwnerTokenFromReq(req) {
  const auth = String(req.header('authorization') || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return String(req.header('x-owner-vault-token') || '').trim();
}

async function getOwnerVaultConfig() {
  let settings = await Settings.findOne();
  if (!settings) settings = await Settings.create({});
  if (!settings.ownerVault) settings.ownerVault = {};
  if (!settings.ownerVault.passwordHash) {
    const bootstrapPassword = process.env.OWNER_VAULT_PASSWORD || process.env.ADMIN_PASSWORD || '';
    if (bootstrapPassword) settings.ownerVault.passwordHash = hashOwnerPassword(bootstrapPassword);
  }
  if (!settings.ownerVault.visibility) settings.ownerVault.visibility = DEFAULT_OWNER_VISIBILITY;
  settings.ownerVault.visibility = mergeVisibility(settings.ownerVault.visibility);
  if (settings.isModified()) await settings.save();
  return settings;
}

async function getOwnerVisibility() {
  const settings = await getOwnerVaultConfig();
  const ownerVault = settings.ownerVault || {};
  return {
    enabled: ownerVault.enabled !== false,
    visibility: mergeVisibility(ownerVault.visibility || {}),
  };
}

async function isVisibilityEnabled(scope, key) {
  const { enabled, visibility } = await getOwnerVisibility();
  if (!enabled) return true;
  return Boolean(visibility?.[scope]?.[key] ?? true);
}

function visibilityMiddleware(scope, key) {
  return async (_req, res, next) => {
    try {
      const enabled = await isVisibilityEnabled(scope, key);
      if (!enabled) return res.status(404).json({ ok: false, error: 'Not found' });
      return next();
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  };
}

async function visibilityByAudience(req, publicKey, adminKey) {
  const isAdmin = await isAdminRequest(req);
  if (isAdmin && adminKey) return isVisibilityEnabled('adminModules', adminKey);
  return isVisibilityEnabled('publicPages', publicKey);
}

function visibilityResourceMiddleware(publicKey, adminKey) {
  return async (req, res, next) => {
    try {
      const enabled = await visibilityByAudience(req, publicKey, adminKey);
      if (!enabled) return res.status(404).json({ ok: false, error: 'Not found' });
      return next();
    } catch (err) {
      return res.status(500).json({ ok: false, error: err.message });
    }
  };
}

async function requireOwnerVaultSession(req, res, next) {
  try {
    const token = getOwnerTokenFromReq(req);
    if (!token) return res.status(401).json({ ok: false, error: 'Owner vault authentication required' });
    const settings = await getOwnerVaultConfig();
    const session = settings.ownerVault?.session || {};
    if (!session.tokenHash || !session.expiresAt) {
      return res.status(401).json({ ok: false, error: 'Owner vault session missing' });
    }
    const expected = String(session.tokenHash);
    const incoming = hashOwnerToken(token);
    const same = expected.length === incoming.length && crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incoming));
    if (!same) return res.status(401).json({ ok: false, error: 'Invalid owner vault session' });
    const now = Date.now();
    const exp = new Date(session.expiresAt).getTime();
    if (!Number.isFinite(exp) || exp < now) return res.status(401).json({ ok: false, error: 'Owner vault session expired' });

    settings.ownerVault.session.lastActivityAt = new Date(now);
    settings.ownerVault.session.expiresAt = new Date(now + OWNER_VAULT_SESSION_MINUTES * 60 * 1000);
    await settings.save();
    return next();
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}

function createOwnerVaultSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OWNER_VAULT_SESSION_MINUTES * 60 * 1000);
  return { token, tokenHash: hashOwnerToken(token), expiresAt };
}

async function isAdminRequest(req) {
  try {
    const hdr = req.header('x-admin-secret') || '';
    const hasValidSecret = !!process.env.ADMIN_SECRET && hdr === process.env.ADMIN_SECRET;
    if (hasValidSecret) return true;

    if (!req.user?._id) return false;
    const user = await User.findById(req.user._id).select('role').lean();
    return !!(user && (user.role === 'admin' || user.role === 'SuperAdmin' || user.role === 'super_admin'));
  } catch {
    return false;
  }
}

async function getActiveBuilderSession(actorKey) {
  const now = new Date();
  const active = await BuilderAccessSession.findOne({
    actorKey,
    status: 'active',
    expiresAt: { $gt: now },
  }).sort({ createdAt: -1 });

  if (!active) return null;
  return active;
}

// Public visibility state for route/menu gating in frontend
app.get('/api/site-visibility', async (_req, res) => {
  try {
    const payload = await getOwnerVisibility();
    return res.json({
      ok: true,
      item: {
        enabled: payload.enabled,
        visibility: payload.visibility,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Owner Vault authentication and controls
app.post('/api/owner-vault/login', async (req, res) => {
  try {
    const password = String(req.body?.password || '');
    if (!password) return res.status(400).json({ ok: false, error: 'Password is required' });

    const settings = await getOwnerVaultConfig();
    const hash = String(settings.ownerVault?.passwordHash || '');
    if (!hash) return res.status(400).json({ ok: false, error: 'Owner Vault password is not initialized' });

    const valid = verifyOwnerPassword(password, hash);
    if (!valid) return res.status(401).json({ ok: false, error: 'Invalid password' });

    const session = createOwnerVaultSession();
    settings.ownerVault.session = {
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      lastActivityAt: new Date(),
    };
    await settings.save();

    return res.json({
      ok: true,
      item: {
        token: session.token,
        expiresAt: session.expiresAt,
        timeoutMinutes: OWNER_VAULT_SESSION_MINUTES,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/owner-vault/logout', requireOwnerVaultSession, async (_req, res) => {
  try {
    const settings = await getOwnerVaultConfig();
    settings.ownerVault.session = {
      tokenHash: '',
      expiresAt: null,
      lastActivityAt: null,
    };
    await settings.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/owner-vault/status', async (req, res) => {
  try {
    const token = getOwnerTokenFromReq(req);
    if (!token) return res.json({ ok: true, item: { authenticated: false } });
    const settings = await getOwnerVaultConfig();
    const session = settings.ownerVault?.session || {};
    const tokenHash = String(session.tokenHash || '');
    if (!tokenHash || !session.expiresAt) return res.json({ ok: true, item: { authenticated: false } });
    const same = tokenHash === hashOwnerToken(token);
    const exp = new Date(session.expiresAt).getTime();
    if (!same || !Number.isFinite(exp) || exp < Date.now()) return res.json({ ok: true, item: { authenticated: false } });
    return res.json({
      ok: true,
      item: {
        authenticated: true,
        expiresAt: session.expiresAt,
        timeoutMinutes: OWNER_VAULT_SESSION_MINUTES,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/owner-vault/password', requireOwnerVaultSession, async (req, res) => {
  try {
    const currentPassword = String(req.body?.currentPassword || '');
    const newPassword = String(req.body?.newPassword || '');
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
    }
    const settings = await getOwnerVaultConfig();
    const currentHash = String(settings.ownerVault?.passwordHash || '');
    if (currentHash && !verifyOwnerPassword(currentPassword, currentHash)) {
      return res.status(401).json({ ok: false, error: 'Current password is invalid' });
    }
    settings.ownerVault.passwordHash = hashOwnerPassword(newPassword);
    settings.ownerVault.updatedBy = req.user?.email || req.user?._id || 'owner-vault';
    settings.ownerVault.updatedAt = new Date();
    await settings.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/owner-vault/password/reset-emergency', async (req, res) => {
  try {
    const resetKey = String(req.body?.resetKey || '').trim();
    const recoveryEmail = String(req.body?.email || '').trim().toLowerCase();
    const newPassword = String(req.body?.newPassword || '');
    if (!process.env.OWNER_VAULT_EMERGENCY_RESET_KEY) {
      return res.status(403).json({ ok: false, error: 'Emergency reset is disabled' });
    }
    if (!resetKey || resetKey !== process.env.OWNER_VAULT_EMERGENCY_RESET_KEY) {
      return res.status(403).json({ ok: false, error: 'Invalid emergency key' });
    }
    const expectedRecoveryEmail = String(process.env.OWNER_VAULT_RECOVERY_EMAIL || '').trim().toLowerCase();
    if (expectedRecoveryEmail && recoveryEmail !== expectedRecoveryEmail) {
      return res.status(403).json({ ok: false, error: 'Invalid recovery email' });
    }
    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({ ok: false, error: 'New password must be at least 8 characters' });
    }
    const settings = await getOwnerVaultConfig();
    settings.ownerVault.passwordHash = hashOwnerPassword(newPassword);
    settings.ownerVault.session = {
      tokenHash: '',
      expiresAt: null,
      lastActivityAt: null,
    };
    settings.ownerVault.updatedBy = 'emergency-reset';
    settings.ownerVault.updatedAt = new Date();
    await settings.save();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/owner-vault/visibility', requireOwnerVaultSession, async (_req, res) => {
  try {
    const payload = await getOwnerVisibility();
    return res.json({
      ok: true,
      item: {
        enabled: payload.enabled,
        visibility: payload.visibility,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/owner-vault/visibility', requireOwnerVaultSession, async (req, res) => {
  try {
    const visibility = mergeVisibility(req.body?.visibility || {});
    const enabled = req.body?.enabled !== false;
    const settings = await getOwnerVaultConfig();
    settings.ownerVault.visibility = visibility;
    settings.ownerVault.enabled = enabled;
    settings.ownerVault.updatedBy = req.user?.email || req.user?._id || 'owner-vault';
    settings.ownerVault.updatedAt = new Date();
    await settings.save();
    return res.json({
      ok: true,
      item: {
        enabled: settings.ownerVault.enabled !== false,
        visibility: mergeVisibility(settings.ownerVault.visibility || {}),
      },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Deep visibility enforcement for core resources
app.use('/api/products', visibilityResourceMiddleware('products', 'products'));
app.use('/api/categories', visibilityResourceMiddleware('categories', 'categories'));
app.use('/api/locations', visibilityResourceMiddleware('locations', 'locations'));
app.use('/api/builder', visibilityResourceMiddleware('shopBuilder', 'products3d'));
app.use('/api/products-3d', visibilityResourceMiddleware('shopBuilder', 'products3d'));

app.post('/api/orders/bulk/status', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { orderIds, status, note, sendEmail = false } = req.body || {};
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'orderIds array is required' });
    }
    if (!status || typeof status !== 'string') {
      return res.status(400).json({ ok: false, error: 'status is required' });
    }

    const results = [];
    for (const orderId of orderIds) {
      try {
        const order = await Order.findById(orderId);
        if (!order) {
          results.push({ orderId, success: false, error: 'Order not found' });
          continue;
        }

        if (ORDER_FINAL_STATUSES.has(order.status)) {
          results.push({ orderId, success: false, error: `Cannot update final status order (${order.status})` });
          continue;
        }

        if (!canTransitionStatus(order.status, status)) {
          results.push({ orderId, success: false, error: `Invalid transition ${order.status} -> ${status}` });
          continue;
        }

        order.status = status;
        if (note) {
          const internalNote = buildInternalNote({ text: note, user: req.user });
          if (internalNote) {
            order.internalNotes = order.internalNotes || [];
            order.internalNotes.push(internalNote);
          }
        }
        await order.save();

        if (sendEmail && ['shipped', 'delivered', 'confirmed'].includes(status)) {
          if (status === 'shipped') {
            await orderEmailService.sendOrderShipped(orderId, {});
          } else if (status === 'delivered') {
            await orderEmailService.sendOrderDelivered(orderId);
          } else if (status === 'confirmed') {
            await orderEmailService.sendOrderConfirmation(orderId);
          }
        }

        results.push({ orderId, success: true });
      } catch (err) {
        results.push({ orderId, success: false, error: err.message });
      }
    }

    return res.json({ ok: true, results });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch('/api/orders/:id/assign', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { assigneeId, note } = req.body || {};
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    if (ORDER_FINAL_STATUSES.has(order.status)) {
      return res.status(400).json({ ok: false, error: 'Cannot reassign completed order' });
    }

    order.assignedTo = assigneeId || null;
    if (note) {
      const internalNote = buildInternalNote({ text: note, user: req.user });
      if (internalNote) {
        order.internalNotes = order.internalNotes || [];
        order.internalNotes.push(internalNote);
      }
    }
    await order.save();

    return res.json({ ok: true, item: order });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.patch('/api/orders/:id/priority', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { priority, note } = req.body || {};
    if (!['low', 'normal', 'high', 'urgent'].includes(priority)) {
      return res.status(400).json({ ok: false, error: 'Invalid priority value' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    order.priority = priority;
    if (note) {
      const internalNote = buildInternalNote({ text: note, user: req.user });
      if (internalNote) {
        order.internalNotes = order.internalNotes || [];
        order.internalNotes.push(internalNote);
      }
    }
    await order.save();

    return res.json({ ok: true, item: order });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.post('/api/orders/:id/notes', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { text } = req.body || {};
    const internalNote = buildInternalNote({ text, user: req.user });
    if (!internalNote) {
      return res.status(400).json({ ok: false, error: 'text is required' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });

    order.internalNotes = order.internalNotes || [];
    order.internalNotes.push(internalNote);
    await order.save();

    return res.json({ ok: true, item: order });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Lightweight rate limiting for API routes
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 300 });
app.use('/api', apiLimiter);

// Cache headers for GET API responses (short TTL)
app.use((req, res, next) => {
  if (req.method === 'GET' && req.path.startsWith('/api/')) {
    res.set('Cache-Control', 'public, max-age=30');
  }
  next();
});

// --- Branches CRUD ---
app.get('/api/branches', requirePermission('branches', 'read', { attach: true }), async (_req, res) => {
  const items = await Branch.find({}).sort({ name: 1 }).lean();
  return res.json({ ok: true, items });
});

app.post('/api/branches', requirePermission('branches', 'create', { attach: true }), async (req, res) => {
  try {
    const doc = await Branch.create({ name: String(req.body?.name || '').trim() });
    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/branches/:id', requirePermission('branches', 'update', { attach: true }), async (req, res) => {
  try {
    const updated = await Branch.findByIdAndUpdate(req.params.id, { name: String(req.body?.name || '').trim() }, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/branches/:id', requirePermission('branches', 'delete', { attach: true }), async (req, res) => {
  try {
    const deleted = await Branch.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- Expenses (Transactions) ---
app.get('/api/expenses', requirePermission('expenses', 'read', { attach: true }), async (req, res) => {
  try {
    const { page = 1, limit = 50, from, to, branch, expenseType } = req.query;
    let q = {};
    if (from) q.date = { ...(q.date || {}), $gte: new Date(String(from)) };
    if (to) q.date = { ...(q.date || {}), $lte: new Date(String(to)) };
    if (branch) q.branch = String(branch);
    if (expenseType) q.expenseType = String(expenseType);
    if (req.permission?.conditions) {
      // enforce branchIds/dateRange/status via generic helper
      q = applyReadConditions(q, req.permission.conditions, { userId: req.permission.userId });
      // If conditions specify allowed expense types
      if (Array.isArray(req.permission.conditions.expenseTypes) && req.permission.conditions.expenseTypes.length) {
        q.expenseType = { $in: req.permission.conditions.expenseTypes };
      }
    }
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Transaction.find(q).sort({ date: -1 }).skip(skip).limit(Number(limit)).lean(),
      Transaction.countDocuments(q),
    ]);
    return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/expenses', requirePermission('expenses', 'create', { attach: true }), async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.date || !body.branch || !body.expenseType || typeof body.amount === 'undefined') {
      return res.status(400).json({ ok: false, error: 'date, branch, expenseType, amount are required' });
    }
    if (req.permission?.conditions) {
      const ok = validateWriteAgainstConditions({ branch: body.branch, amount: body.amount }, req.permission.conditions, req.permission.userId);
      if (!ok) return res.status(403).json({ ok: false, error: 'Not allowed to create for this branch or amount exceeds limit' });
    }
    const doc = await Transaction.create({
      date: new Date(body.date),
      branch: String(body.branch),
      expenseType: String(body.expenseType),
      amount: Number(body.amount),
      note: String(body.note || ''),
    });
    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/expenses/:id', requirePermission('expenses', 'update', { attach: true }), async (req, res) => {
  try {
    const existing = await Transaction.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
    if (req.permission?.conditions) {
      const okExisting = validateWriteAgainstConditions(existing, req.permission.conditions, req.permission.userId);
      if (!okExisting) return res.status(403).json({ ok: false, error: 'Not allowed for this record' });
    }
    const body = req.body || {};
    if (body.date !== undefined) existing.date = new Date(body.date);
    if (body.branch !== undefined) existing.branch = String(body.branch);
    if (body.expenseType !== undefined) existing.expenseType = String(body.expenseType);
    if (body.amount !== undefined) existing.amount = Number(body.amount);
    if (body.note !== undefined) existing.note = String(body.note || '');
    if (req.permission?.conditions) {
      const okUpdated = validateWriteAgainstConditions(existing, req.permission.conditions, req.permission.userId);
      if (!okUpdated) return res.status(403).json({ ok: false, error: 'Updated record violates allowed list' });
    }
    const updated = await existing.save();
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/expenses/:id', requirePermission('expenses', 'delete', { attach: true }), async (req, res) => {
  try {
    const existing = await Transaction.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
    if (req.permission?.conditions) {
      const okExisting = validateWriteAgainstConditions(existing, req.permission.conditions, req.permission.userId);
      if (!okExisting) return res.status(403).json({ ok: false, error: 'Not allowed for this record' });
    }
    await Transaction.deleteOne({ _id: req.params.id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Fixed the malformed route handler
app.post('/api/rbac/bootstrap-roles', async (req, res) => {
  try {
    const hdr = req.header('x-admin-secret') || '';
    if (hdr !== process.env.ADMIN_SECRET) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    
    const defaults = [
      {
        name: 'SuperAdmin',
        description: 'Bypass all checks',
        permissions: [ { resource: '*', actions: ['*'] } ],
      },
      {
        name: 'Manager',
        description: 'Manage roles and users, full reports access',
        permissions: [ { resource: '*', actions: ['*'] } ],
      },
      {
        name: 'BranchAdmin',
        description: 'Manage products/expenses for assigned branches',
        permissions: [
          { resource: 'products', actions: ['create','read','update','delete'], conditions: { branchIds: [] } },
          { resource: 'expenses', actions: ['create','read','update','delete','export'], conditions: { branchIds: [], maxAmount: 5000 } },
          { resource: 'profit-reports', actions: ['read','create','update','export'], conditions: { branchIds: [] } },
        ],
      },
      {
        name: 'Accountant',
        description: 'Manage profit reports and expenses across branches',
        permissions: [
          { resource: 'expenses', actions: ['read','export'], conditions: { branchIds: [] } },
          { resource: 'profit-reports', actions: ['create','read','update','export'], conditions: { branchIds: [] } },
        ],
      },
      {
        name: 'Auditor',
        description: 'Read-only access to data and exports',
        permissions: [
          { resource: 'products', actions: ['read','export'] },
          { resource: 'expenses', actions: ['read','export'] },
          { resource: 'profit-reports', actions: ['read','export'] },
        ],
      },
    ];
    
    for (const r of defaults) {
      await Role.findOneAndUpdate({ name: r.name }, r, { new: true, upsert: true, setDefaultsOnInsert: true });
    }
    console.log('[RBAC] Default roles ensured');
    
    // Ensure dev user has SuperAdmin role
    const devEmail = process.env.ADMIN_DEV_USER_EMAIL;
    if (devEmail) {
      let user = await User.findOne({ email: devEmail });
      if (user) {
        let superAdmin = await Role.findOne({ name: 'SuperAdmin' });
        if (superAdmin) {
          await UserRole.updateOne(
            { userId: user._id, roleId: superAdmin._id },
            { $setOnInsert: { userId: user._id, roleId: superAdmin._id } },
            { upsert: true }
          );
          console.log(`[RBAC] Granted SuperAdmin to dev user ${devEmail}`);
        }
      }
    }
  } catch (e) {
    console.warn('[RBAC] Bootstrap failed:', e?.message || e);
  }
});

const uploadImage = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const upload3D = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

// unread support: lastSeenAt per admin
app.get('/api/history/unread-count', async (req, res) => {
  try {
    const userId = req.query.userId || req.header('x-user-id') || req.user?._id;
    if (!userId) return res.json({ ok: true, count: 0 });
    const seen = await HistoryRead.findOne({ userId }).lean();
    const since = seen?.lastSeenAt || new Date(0);
    const count = await History.countDocuments({ important: true, createdAt: { $gt: since } });
    return res.json({ ok: true, count, lastSeenAt: since });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/history/mark-read', async (req, res) => {
  try {
    const userId = req.body?.userId || req.header('x-user-id') || req.user?._id;
    if (!userId) return res.status(400).json({ ok: false, error: 'userId required' });
    const doc = await HistoryRead.findOneAndUpdate(
      { userId },
      { $set: { lastSeenAt: new Date() } },
      { new: true, upsert: true }
    );
    return res.json({ ok: true, item: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Profit report routes are defined below after app initialization

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set. Create server/.env');
}

mongoose.set('strictQuery', false);
mongoose
  .connect(MONGODB_URI, {
    dbName: process.env.MONGODB_DB || 'appdb',
    maxPoolSize: 30,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
  })
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err.message));

// After Mongo connects, optionally auto-bootstrap a dev SuperAdmin user
mongoose.connection.once('open', async () => {
  try {
    // Ensure default roles exist
    const defaults = [
      {
        name: 'SuperAdmin',
        description: 'Bypass all checks',
        permissions: [ { resource: '*', actions: ['*'] } ],
      },
      {
        name: 'Manager',
        description: 'Manage roles and users, full reports access',
        permissions: [ { resource: '*', actions: ['*'] } ],
      },
      {
        name: 'BranchAdmin',
        description: 'Manage products/expenses for assigned branches',
        permissions: [
          { resource: 'products', actions: ['create','read','update','delete'], conditions: { branchIds: [] } },
          { resource: 'expenses', actions: ['create','read','update','delete','export'], conditions: { branchIds: [], maxAmount: 5000 } },
          { resource: 'profit-reports', actions: ['read','create','update','export'], conditions: { branchIds: [] } },
        ],
      },
      {
        name: 'Accountant',
        description: 'Manage profit reports and expenses across branches',
        permissions: [
          { resource: 'expenses', actions: ['read','export'], conditions: { branchIds: [] } },
          { resource: 'profit-reports', actions: ['create','read','update','export'], conditions: { branchIds: [] } },
        ],
      },
      {
        name: 'Auditor',
        description: 'Read-only access to data and exports',
        permissions: [
          { resource: 'products', actions: ['read','export'] },
          { resource: 'expenses', actions: ['read','export'] },
          { resource: 'profit-reports', actions: ['read','export'] },
        ],
      },
    ];
    
    for (const r of defaults) {
      await Role.findOneAndUpdate({ name: r.name }, r, { new: true, upsert: true, setDefaultsOnInsert: true });
    }
    console.log('[RBAC] Default roles ensured');
    
    // Ensure dev user has SuperAdmin role
    const devEmail = process.env.ADMIN_DEV_USER_EMAIL;
    if (devEmail) {
      let user = await User.findOne({ email: devEmail });
      if (user) {
        let superAdmin = await Role.findOne({ name: 'SuperAdmin' });
        if (superAdmin) {
          await UserRole.updateOne(
            { userId: user._id, roleId: superAdmin._id },
            { $setOnInsert: { userId: user._id, roleId: superAdmin._id } },
            { upsert: true }
          );
          console.log(`[RBAC] Granted SuperAdmin to dev user ${devEmail}`);
        }
      }
    }
  } catch (e) {
    console.warn('[RBAC] Bootstrap failed:', e?.message || e);
  }
});

// Cloudinary configuration
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  console.log('Cloudinary configured');
} else {
  console.warn('Cloudinary env vars not fully set; Cloudinary routes may fail');
}

// Routes
app.get('/', (req, res) => {
  res.type('text/plain').send('الحجازي لتجهيز المحلات API is running. See /api/health');
});

app.get('/api/health', async (req, res) => {
  const dbStatus = mongoose.connection.readyState; // 1 connected
  return sendJsonWithEtag(req, res, { ok: true, time: new Date().toISOString(), dbStatus });
});

// --- RBAC helper endpoints ---
// Get current user's effective permissions (admin site can call this)
app.get('/api/rbac/my-permissions', async (req, res) => {
  try {
    const userId = req.user?._id || req.header('x-user-id');
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const perms = await getUserPermissions(String(userId));
    
    // Check if user is SuperAdmin
    const user = await User.findById(userId).lean();
    const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');
    
    return res.json({ 
      ok: true, 
      permissions: perms,
      isSuperAdmin: isSuperAdmin || false
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Check if user is SuperAdmin
app.get('/api/rbac/super-admin', async (req, res) => {
  try {
    const userId = req.user?._id || req.header('x-user-id');
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    
    const user = await User.findById(userId).lean();
    const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');
    
    return res.json({ 
      ok: true, 
      isSuperAdmin: isSuperAdmin || false,
      role: user?.role || 'user'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Get effective permissions for a specific user (admin only)
app.get('/api/rbac/users/:userId/effective-permissions', requirePermission('users', 'read'), async (req, res) => {
  try {
    const { userId } = req.params;
    const perms = await getUserPermissions(userId);
    
    const user = await User.findById(userId).lean();
    const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');
    
    return res.json({ 
      ok: true, 
      permissions: perms,
      isSuperAdmin: isSuperAdmin || false,
      role: user?.role || 'user'
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// RBAC management (SuperAdmin or roles with rbac.manage)
app.get('/api/rbac/roles', requirePermission('rbac', 'manage'), async (_req, res) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 }).lean();
    return res.json({ ok: true, items: roles });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/rbac/roles', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const body = req.body || {};
    const doc = await Role.create({
      name: String(body.name).trim(),
      description: String(body.description || ''),
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
    });
    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/rbac/roles/:id', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const body = req.body || {};
    const updated = await Role.findByIdAndUpdate(
      req.params.id,
      {
        ...(body.name !== undefined ? { name: String(body.name).trim() } : {}),
        ...(body.description !== undefined ? { description: String(body.description || '') } : {}),
        ...(Array.isArray(body.permissions) ? { permissions: body.permissions } : {}),
      },
      { new: true }
    );
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/rbac/roles/:id', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const deleted = await Role.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Not found' });
    // Also remove any user-role links to this role
    await UserRole.deleteMany({ roleId: req.params.id });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.get('/api/rbac/users/:userId/roles', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const links = await UserRole.find({ userId: req.params.userId }).lean();
    const roleIds = links.map(l => l.roleId);
    const roles = roleIds.length ? await Role.find({ _id: { $in: roleIds } }).lean() : [];
    return res.json({ ok: true, items: roles });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/rbac/users/:userId/assign-role', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const roleId = req.body?.roleId;
    if (!roleId) return res.status(400).json({ ok: false, error: 'roleId required' });
    await UserRole.updateOne(
      { userId: req.params.userId, roleId },
      { $setOnInsert: { userId: req.params.userId, roleId } },
      { upsert: true }
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Effective permissions for a specific user (admin lookup)
app.get('/api/rbac/users/:userId/effective-permissions', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const userId = String(req.params.userId);
    const perms = await getUserPermissions(userId);
    return res.json({ ok: true, items: perms });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Assign an existing role by body with userId or email
app.post('/api/rbac/assign-role', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const { roleId, userId, email } = req.body || {};
    if (!roleId) return res.status(400).json({ ok: false, error: 'roleId required' });
    let targetUserId = userId;
    if (!targetUserId && email) {
      const u = await User.findOne({ email }).select('_id').lean();
      if (!u) return res.status(404).json({ ok: false, error: 'User not found by email' });
      targetUserId = String(u._id);
    }
    if (!targetUserId) return res.status(400).json({ ok: false, error: 'userId or email required' });
    await UserRole.updateOne(
      { userId: targetUserId, roleId },
      { $setOnInsert: { userId: targetUserId, roleId } },
      { upsert: true }
    );
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Create/update a custom role from permissions and assign to a user
app.post('/api/rbac/assign-custom', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const { permissions, roleName, replace, userId, email } = req.body || {};
    if (!Array.isArray(permissions) || !permissions.length) {
      return res.status(400).json({ ok: false, error: 'permissions required' });
    }
    let targetUserId = userId;
    if (!targetUserId && email) {
      const u = await User.findOne({ email }).select('_id').lean();
      if (!u) return res.status(404).json({ ok: false, error: 'User not found by email' });
      targetUserId = String(u._id);
    }
    if (!targetUserId) return res.status(400).json({ ok: false, error: 'userId or email required' });

    const name = String(roleName || `Custom-${Date.now()}`);
    const role = await Role.findOneAndUpdate(
      { name },
      { name, permissions },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    if (replace) {
      await UserRole.deleteMany({ userId: targetUserId });
    }
    await UserRole.updateOne(
      { userId: targetUserId, roleId: role._id },
      { $setOnInsert: { userId: targetUserId, roleId: role._id } },
      { upsert: true }
    );
    return res.json({ ok: true, role: { id: String(role._id), name: role.name }, userId: String(targetUserId) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Create or promote an admin user
app.post('/api/admin/users', requirePermission('rbac', 'manage'), async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password are required' });
    let user = await User.findOne({ email });
    if (user) {
      await User.updateOne({ _id: user._id }, { $set: { role: 'admin', isActive: true, firstName, lastName, phone } });
    } else {
      user = await User.create({ email, password, firstName, lastName, phone, role: 'admin', isActive: true });
    }
    return res.status(201).json({ ok: true, user: { id: String(user._id), email: user.email } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- History (audit log) ---
app.get('/api/history', requirePermission('reports', 'read', { attach: true }), async (req, res) => {
  try {
    const { page = 1, limit = 50, q, section, from, to, important, level } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const query = {};
    if (section) query.section = String(section);
    if (typeof important !== 'undefined') query.important = String(important) === 'true';
    if (level) query.level = String(level);
    if (q) {
      const rx = new RegExp(String(q), 'i');
      query.$or = [
        { action: rx },
        { note: rx },
        { userEmail: rx },
        { section: rx },
        { details: rx },
      ];
    }
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(String(from));
      if (to) query.createdAt.$lte = new Date(String(to));
    }

    const [rawItems, total] = await Promise.all([
      History.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      History.countDocuments(query),
    ]);

    // Enrich with user info (username/email) when userId is present
    const userIds = Array.from(
      new Set(
        rawItems
          .map(i => i.userId)
          .filter(Boolean)
          .map(String)
          .filter((id) => mongoose.Types.ObjectId.isValid(id))
      )
    );
    let userMap = new Map();
    if (userIds.length) {
      const users = await User.find({ _id: { $in: userIds } }).select('firstName lastName email').lean();
      users.forEach(u => userMap.set(String(u._id), u));
    }

    const items = rawItems.map((it) => {
      const out = { ...it };
      const u = it.userId ? userMap.get(String(it.userId)) : null;
      if (u) {
        const fullName = [u.firstName, u.lastName].filter(Boolean).join(' ').trim();
        const fallback = (u.email && String(u.email).split('@')[0]) || '';
        const displayName = fullName || fallback || 'مستخدم';
        out.meta = { ...(it.meta || {}), username: out?.meta?.username || displayName };
        if (!out.userEmail && u.email) out.userEmail = u.email;
      }
      return out;
    });

    return sendJsonWithEtag(req, res, { ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/history', requirePermission('reports', 'create', { attach: true }), async (req, res) => {
  try {
    const { section, action, note, meta, userEmail, userId } = req.body || {};
    if (!section || !action) return res.status(400).json({ ok: false, error: 'section and action are required' });
    const doc = await History.create({ section, action, note, meta, userEmail, userId });
    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Home Config (get or initialize default)
app.get('/api/home-config', async (req, res) => {
  try {
    let cfg = await HomeConfig.findOne().lean();
    if (!cfg) {
      cfg = await HomeConfig.create({
        heroEnabled: true,
        slides: [],
        toggles: [
          { key: 'featuredProducts', enabled: true },
          { key: 'bestSellers', enabled: true },
          { key: 'newArrivals', enabled: true },
        ],
        promoEnabled: false,
        promoText: '',
        promoIcon: 'zap',
      });
      cfg = cfg.toObject();
    }
    return sendJsonWithEtag(req, res, { ok: true, item: cfg });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Upsert Home Config (single document)
app.put('/api/home-config', async (req, res) => {
  try {
    // Admin authorization: accept EITHER static secret header OR authenticated admin user
    const hdr = req.header('x-admin-secret') || '';
    const hasValidSecret = process.env.ADMIN_SECRET && hdr === process.env.ADMIN_SECRET;
    const hasValidUser = req.user && req.user._id;
    if (!hasValidSecret && !hasValidUser) {
      return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    }
    const body = req.body || {};
    // Basic shape validation
    const payload = {};
    if (typeof body.heroEnabled === 'boolean') payload.heroEnabled = body.heroEnabled;
    if (Array.isArray(body.slides)) payload.slides = body.slides.map((s) => ({
      title: s.title || '',
      subtitle: s.subtitle || '',
      image: s.image || '',
      buttonText: s.buttonText || '',
      buttonLink: s.buttonLink || '',
      productId: s.productId || '',
      productIds: Array.isArray(s.productIds) ? s.productIds.map(String) : [],
      enabled: typeof s.enabled === 'boolean' ? s.enabled : true,
      // extended hero design controls
      theme: s.theme || undefined,
      bgGradient: s.bgGradient || '',
      bgColor: s.bgColor || '',
      pattern: s.pattern || undefined,
      buttonColor: s.buttonColor || '',
      textColor: s.textColor || '',
      badge: s.badge || '',
      features: Array.isArray(s.features) ? s.features : [],
    }));
    if (Array.isArray(body.toggles)) payload.toggles = body.toggles.map((t) => ({
      key: String(t.key),
      enabled: !!t.enabled,
    }));
    if (Array.isArray(body.featuredCategorySlugs)) payload.featuredCategorySlugs = body.featuredCategorySlugs.map(String);
    if (Array.isArray(body.featuredProductIds)) payload.featuredProductIds = body.featuredProductIds.map(String);
    // Additional curated product lists per section
    if (Array.isArray(body.bestSellerProductIds)) payload.bestSellerProductIds = body.bestSellerProductIds.map(String);
    if (Array.isArray(body.saleProductIds)) payload.saleProductIds = body.saleProductIds.map(String);
    if (Array.isArray(body.newArrivalProductIds)) payload.newArrivalProductIds = body.newArrivalProductIds.map(String);
    if (typeof body.promoEnabled === 'boolean') payload.promoEnabled = body.promoEnabled;
    if (typeof body.promoText === 'string') payload.promoText = body.promoText;
    if (typeof body.promoIcon === 'string') payload.promoIcon = body.promoIcon;
    if (typeof body.seoTitle === 'string') payload.seoTitle = body.seoTitle;
    if (typeof body.seoDescription === 'string') payload.seoDescription = body.seoDescription;

    // Accept moved homepage content into HomeConfig
    if (body.aboutUsContent && typeof body.aboutUsContent === 'object') {
      payload.aboutUsContent = {
        title: body.aboutUsContent.title || '',
        description: body.aboutUsContent.description || '',
        image: body.aboutUsContent.image || '',
        vision: body.aboutUsContent.vision || '',
        mission: body.aboutUsContent.mission || '',
        stats: {
          customers: body.aboutUsContent?.stats?.customers || '',
          products: body.aboutUsContent?.stats?.products || '',
        },
      };
    }
    if (body.workHours && typeof body.workHours === 'object') {
      payload.workHours = {
        weekdays: body.workHours.weekdays || '',
        friday: body.workHours.friday || '',
        phone: body.workHours.phone || '',
      };
    }

    const updated = await HomeConfig.findOneAndUpdate({}, payload, { new: true, upsert: true, setDefaultsOnInsert: true });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Shop Setup - Get current shop setup
app.get('/api/shop-setup', async (req, res) => {
  try {
    const userId = req.user?._id ? String(req.user._id) : null;
    const actorKey = getActorKey(req);
    const query = userId ? { userId } : { actorKey };
    const shop = await ShopSetup.findOne(query).lean();
    return res.json({ ok: true, item: shop || null });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Shop Setup - Create or update shop setup
app.post('/api/shop-setup', async (req, res) => {
  try {
    const body = req.body || {};
    const userId = req.user?._id ? String(req.user._id) : null;
    const actorKey = getActorKey(req);
    const payload = {
      userId,
      actorKey,
      ownerName: body.ownerName || '',
      shopName: body.shopName || '',
      phone: body.phone || '',
      field: body.field || '',
      isCustomField: body.isCustomField || false,
      customField: body.customField || '',
    };

    if (!payload.ownerName.trim() || !payload.shopName.trim() || !payload.phone.trim() || !payload.field.trim()) {
      return res.status(400).json({ ok: false, error: 'Missing required shop setup fields' });
    }

    const query = userId ? { userId } : { actorKey };
    const shop = await ShopSetup.findOneAndUpdate(query, payload, { new: true, upsert: true, setDefaultsOnInsert: true });
    return res.json({ ok: true, item: shop });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Shop Setup - Get all shops (for admin)
app.get('/api/shop-setup/all', async (req, res) => {
  try {
    const adminBypass = await isAdminRequest(req);
    if (!adminBypass) return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    const shops = await ShopSetup.find().sort({ createdAt: -1 }).lean();
    return res.json({ ok: true, items: shops });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- Builder Access & Session Lock ---
app.get('/api/builder/pricing-config', async (_req, res) => {
  try {
    const cfg = await getBuilderPricingConfig();
    return res.json({
      ok: true,
      item: {
        isFreeNow: !!cfg.isFreeNow,
        currentPriceEgp: Number(cfg.currentPriceEgp || 0),
        nextPriceEgp: Number(cfg.nextPriceEgp || 100),
        sessionMinutes: Number(cfg.sessionMinutes || 90),
        idleTimeoutMinutes: Number(cfg.idleTimeoutMinutes || 15),
        singleActiveSessionPerActor: !!cfg.singleActiveSessionPerActor,
        isActive: !!cfg.isActive,
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to load pricing config' });
  }
});

app.put('/api/builder/pricing-config', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    if (!isAdmin) return res.status(403).json({ ok: false, error: 'Admin authentication required' });

    const body = req.body || {};
    const payload = {
      isFreeNow: !!body.isFreeNow,
      currentPriceEgp: Math.max(0, Number(body.currentPriceEgp || 0)),
      nextPriceEgp: Math.max(0, Number(body.nextPriceEgp || 100)),
      sessionMinutes: Math.max(15, Math.min(480, Number(body.sessionMinutes || 90))),
      idleTimeoutMinutes: Math.max(5, Math.min(120, Number(body.idleTimeoutMinutes || 15))),
      singleActiveSessionPerActor: body.singleActiveSessionPerActor !== false,
      isActive: body.isActive !== false,
    };

    const updated = await BuilderPricingConfig.findOneAndUpdate({}, payload, {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    }).lean();

    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to update pricing config' });
  }
});

app.get('/api/builder/access', async (req, res) => {
  try {
    const cfg = await getBuilderPricingConfig();
    const adminBypass = await isAdminRequest(req);
    const actorKey = getActorKey(req);
    const session = await getActiveBuilderSession(actorKey);
    const now = Date.now();
    const expiresAtMs = session?.expiresAt ? new Date(session.expiresAt).getTime() : 0;
    const remainingSeconds = expiresAtMs > now ? Math.floor((expiresAtMs - now) / 1000) : 0;

    return res.json({
      ok: true,
      item: {
        actorKey,
        adminBypass,
        hasActiveSession: !!session || adminBypass,
        sessionId: session?._id ? String(session._id) : null,
        sessionType: session?.sessionType || (adminBypass ? 'admin_bypass' : null),
        remainingSeconds: adminBypass ? null : remainingSeconds,
        expiresAt: session?.expiresAt || null,
        pricing: {
          isFreeNow: !!cfg.isFreeNow,
          currentPriceEgp: Number(cfg.currentPriceEgp || 0),
          nextPriceEgp: Number(cfg.nextPriceEgp || 100),
          sessionMinutes: Number(cfg.sessionMinutes || 90),
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to load access state' });
  }
});

app.post('/api/builder/session/start', async (req, res) => {
  try {
    const cfg = await getBuilderPricingConfig();
    const actorKey = getActorKey(req);
    const adminBypass = await isAdminRequest(req);
    const active = await getActiveBuilderSession(actorKey);
    if (active) {
      return res.json({ ok: true, item: active });
    }

    if (!cfg.isActive && !adminBypass) {
      return res.status(403).json({ ok: false, error: 'Builder is currently unavailable' });
    }

    const body = req.body || {};
    if (!cfg.isFreeNow && !adminBypass) {
      if (!body.paymentRef || typeof body.paymentRef !== 'string') {
        return res.status(402).json({ ok: false, error: 'Payment required to start this session' });
      }
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + Number(cfg.sessionMinutes || 90) * 60 * 1000);
    const ip = getClientIp(req);
    const ipHash = crypto.createHash('sha1').update(ip).digest('hex').slice(0, 20);
    const userAgent = String(req.headers['user-agent'] || '');
    const session = await BuilderAccessSession.create({
      actorKey,
      userId: req.user?._id ? String(req.user._id) : null,
      isAdminBypass: adminBypass,
      status: 'active',
      sessionType: adminBypass ? 'admin_bypass' : (cfg.isFreeNow ? 'free_trial' : 'paid'),
      priceEgp: adminBypass ? 0 : Number(cfg.currentPriceEgp || 0),
      paymentRef: typeof body.paymentRef === 'string' ? body.paymentRef : '',
      startAt: now,
      lastActivityAt: now,
      expiresAt,
      metadata: {
        ipHash,
        userAgent: userAgent.slice(0, 300),
        source: typeof body.source === 'string' ? body.source : 'web',
      },
    });

    return res.json({ ok: true, item: session });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to start builder session' });
  }
});

app.post('/api/builder/session/heartbeat', async (req, res) => {
  try {
    const actorKey = getActorKey(req);
    const active = await getActiveBuilderSession(actorKey);
    if (!active) {
      return res.status(404).json({ ok: false, error: 'No active session' });
    }
    active.lastActivityAt = new Date();
    await active.save();
    return res.json({ ok: true, item: { sessionId: String(active._id), lastActivityAt: active.lastActivityAt } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to update session heartbeat' });
  }
});

app.post('/api/builder/session/end', async (req, res) => {
  try {
    const actorKey = getActorKey(req);
    const active = await getActiveBuilderSession(actorKey);
    if (!active) return res.json({ ok: true, item: { ended: false } });

    active.status = 'ended';
    active.endAt = new Date();
    await active.save();
    return res.json({ ok: true, item: { ended: true, sessionId: String(active._id) } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to end builder session' });
  }
});

const BUILDER_PROJECT_SCHEMA_VERSION = 1;

function cleanBuilderLayout(input) {
  const layout = input && typeof input === 'object' ? input : {};
  const walls = Array.isArray(layout.walls) ? layout.walls : [];
  const products = Array.isArray(layout.products) ? layout.products : [];
  return {
    ...layout,
    walls,
    products,
    updatedAt: new Date().toISOString(),
  };
}

function getBuilderProjectStats(layout) {
  const safe = cleanBuilderLayout(layout);
  return {
    wallsCount: safe.walls.length,
    productsCount: safe.products.length,
    floorSize: Number(safe.floorSize || 24),
  };
}

function normalizeBuilderProjectTitle(input, fallback = 'مشروع جديد') {
  const title = String(input || '').trim();
  if (!title) return fallback;
  return title.slice(0, 120);
}

function parseBool(value, fallback = false) {
  if (value === undefined || value === null) return fallback;
  const normalized = String(value).toLowerCase().trim();
  if (['1', 'true', 'yes', 'y'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n'].includes(normalized)) return false;
  return fallback;
}

async function uploadBuilderPreviewDataUrl(dataUrl, ownerActorKey = 'anon') {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const trimmed = dataUrl.trim();
  if (!trimmed.startsWith('data:image/')) return null;
  if (trimmed.length > 8 * 1024 * 1024) {
    throw new Error('Preview image is too large');
  }
  const result = await cloudinary.uploader.upload(trimmed, {
    folder: 'builder-project-previews',
    public_id: `preview_${ownerActorKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`,
    resource_type: 'image',
    format: 'webp',
    quality: 'auto:good',
    transformation: [{ width: 1280, height: 720, crop: 'limit' }],
  });
  return {
    url: result?.secure_url || '',
    publicId: result?.public_id || '',
  };
}

function getOwnerIdentity(req) {
  const ownerUserId = req.user?._id ? String(req.user._id) : null;
  const ownerActorKey = getActorKey(req);
  const ownerEmailSnapshot = String(req.user?.email || req.header('x-user-email') || '').slice(0, 200);
  return { ownerUserId, ownerActorKey, ownerEmailSnapshot };
}

function buildBuilderProjectsScopeFilter(req, { adminAll = false, ownerQuery = '' } = {}) {
  const { ownerUserId, ownerActorKey } = getOwnerIdentity(req);
  if (adminAll) {
    const owner = String(ownerQuery || '').trim();
    if (!owner) return {};
    if (owner.startsWith('user:')) return { ownerUserId: owner.slice(5) };
    if (owner.startsWith('actor:')) return { ownerActorKey: owner.slice(6) };
    if (owner.startsWith('email:')) return { ownerEmailSnapshot: owner.slice(6) };
    return {
      $or: [
        { ownerUserId: owner },
        { ownerActorKey: owner },
        { ownerEmailSnapshot: owner },
      ],
    };
  }

  if (ownerUserId) {
    return {
      $or: [
        { ownerUserId },
        { ownerActorKey },
      ],
    };
  }
  return { ownerActorKey };
}

async function cleanupSoftDeletedBuilderProjects() {
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  try {
    await BuilderProject.deleteMany({
      isDeleted: true,
      deletedAt: { $lte: cutoff },
    });
  } catch {
    // non-blocking cleanup
  }
}

function mapBuilderProjectListItem(project) {
  return {
    _id: String(project._id),
    title: project.title,
    description: project.description || '',
    previewImageUrl: project.previewImageUrl || '',
    stats: project.stats || { wallsCount: 0, productsCount: 0, floorSize: 24 },
    ownerUserId: project.ownerUserId || null,
    ownerActorKey: project.ownerActorKey || null,
    ownerEmailSnapshot: project.ownerEmailSnapshot || '',
    isDeleted: !!project.isDeleted,
    deletedAt: project.deletedAt || null,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    lastOpenedAt: project.lastOpenedAt || null,
    version: Number(project.version || 1),
  };
}

app.get('/api/builder/projects', async (req, res) => {
  try {
    await cleanupSoftDeletedBuilderProjects();
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const deleted = parseBool(req.query.deleted, false);
    const sortKey = String(req.query.sort || 'updated_desc');

    const sortMap = {
      updated_desc: { updatedAt: -1 },
      created_desc: { createdAt: -1 },
      name_asc: { title: 1 },
      last_opened_desc: { lastOpenedAt: -1, updatedAt: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.updated_desc;

    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });

    const filter = {
      ...scope,
      isDeleted: deleted,
    };

    if (q) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { ownerEmailSnapshot: { $regex: q, $options: 'i' } },
        ],
      });
    }

    const [items, total] = await Promise.all([
      BuilderProject.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      BuilderProject.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      items: items.map(mapBuilderProjectListItem),
      page,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to list builder projects' });
  }
});

app.post('/api/builder/projects', async (req, res) => {
  try {
    const { ownerUserId, ownerActorKey, ownerEmailSnapshot } = getOwnerIdentity(req);
    const body = req.body || {};
    const layout = cleanBuilderLayout(body.layout || {});
    const stats = getBuilderProjectStats(layout);
    const title = normalizeBuilderProjectTitle(body.title, 'مشروع جديد');
    const description = String(body.description || '').slice(0, 1000);

    let previewImageUrl = '';
    let previewImagePublicId = '';
    if (typeof body.previewDataUrl === 'string' && body.previewDataUrl.trim()) {
      const uploaded = await uploadBuilderPreviewDataUrl(body.previewDataUrl, ownerActorKey);
      if (uploaded) {
        previewImageUrl = uploaded.url;
        previewImagePublicId = uploaded.publicId;
      }
    }

    const created = await BuilderProject.create({
      ownerUserId,
      ownerActorKey,
      ownerEmailSnapshot,
      title,
      description,
      layout,
      stats,
      previewImageUrl,
      previewImagePublicId,
      version: 1,
      schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
      lastOpenedAt: new Date(),
    });

    return res.status(201).json({ ok: true, item: mapBuilderProjectListItem(created.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to create builder project' });
  }
});

app.post('/api/builder/projects/import', async (req, res) => {
  try {
    const body = req.body || {};
    const layout = cleanBuilderLayout(body.layout || body.project?.layout || body.project || {});
    if (!Array.isArray(layout.walls) || !Array.isArray(layout.products)) {
      return res.status(400).json({ ok: false, error: 'Invalid layout payload' });
    }
    const { ownerUserId, ownerActorKey, ownerEmailSnapshot } = getOwnerIdentity(req);
    const title = normalizeBuilderProjectTitle(body.title || body.project?.title || 'Imported Project', 'Imported Project');
    const description = String(body.description || body.project?.description || '').slice(0, 1000);
    const stats = getBuilderProjectStats(layout);

    let previewImageUrl = '';
    let previewImagePublicId = '';
    if (typeof body.previewDataUrl === 'string' && body.previewDataUrl.trim()) {
      const uploaded = await uploadBuilderPreviewDataUrl(body.previewDataUrl, ownerActorKey);
      if (uploaded) {
        previewImageUrl = uploaded.url;
        previewImagePublicId = uploaded.publicId;
      }
    }

    const created = await BuilderProject.create({
      ownerUserId,
      ownerActorKey,
      ownerEmailSnapshot,
      title,
      description,
      layout,
      stats,
      previewImageUrl,
      previewImagePublicId,
      version: 1,
      schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
      lastOpenedAt: new Date(),
    });
    return res.status(201).json({ ok: true, item: mapBuilderProjectListItem(created.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to import builder project' });
  }
});

app.get('/api/builder/projects/:id', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const project = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    }).lean();
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    return res.json({
      ok: true,
      item: {
        ...mapBuilderProjectListItem(project),
        layout: cleanBuilderLayout(project.layout || {}),
        schemaVersion: Number(project.schemaVersion || BUILDER_PROJECT_SCHEMA_VERSION),
      },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to load builder project' });
  }
});

app.put('/api/builder/projects/:id', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const current = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    });
    if (!current) return res.status(404).json({ ok: false, error: 'Project not found' });

    const body = req.body || {};
    if (body.title !== undefined) current.title = normalizeBuilderProjectTitle(body.title, current.title || 'Project');
    if (body.description !== undefined) current.description = String(body.description || '').slice(0, 1000);
    if (body.layout !== undefined) {
      const layout = cleanBuilderLayout(body.layout);
      current.layout = layout;
      current.stats = getBuilderProjectStats(layout);
    }
    if (body.previewImageUrl !== undefined) current.previewImageUrl = String(body.previewImageUrl || '');
    if (body.previewImagePublicId !== undefined) current.previewImagePublicId = String(body.previewImagePublicId || '');

    if (typeof body.previewDataUrl === 'string' && body.previewDataUrl.trim()) {
      const uploaded = await uploadBuilderPreviewDataUrl(body.previewDataUrl, current.ownerActorKey || 'owner');
      if (uploaded) {
        current.previewImageUrl = uploaded.url;
        current.previewImagePublicId = uploaded.publicId;
      }
    }

    current.version = Number(current.version || 1) + 1;
    current.schemaVersion = BUILDER_PROJECT_SCHEMA_VERSION;
    await current.save();

    return res.json({ ok: true, item: mapBuilderProjectListItem(current.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to update builder project' });
  }
});

app.post('/api/builder/projects/:id/open', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const project = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    });
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    project.lastOpenedAt = new Date();
    await project.save();
    return res.json({ ok: true, item: mapBuilderProjectListItem(project.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to mark open' });
  }
});

app.delete('/api/builder/projects/:id', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const project = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    });
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    project.isDeleted = true;
    project.deletedAt = new Date();
    project.deletedBy = req.user?._id ? String(req.user._id) : project.ownerActorKey;
    await project.save();
    return res.json({ ok: true, item: { deleted: true, id: String(project._id) } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to delete builder project' });
  }
});

app.post('/api/builder/projects/:id/restore', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const project = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    });
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    project.isDeleted = false;
    project.deletedAt = null;
    project.deletedBy = null;
    await project.save();
    return res.json({ ok: true, item: mapBuilderProjectListItem(project.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to restore builder project' });
  }
});

app.delete('/api/builder/projects/:id/hard-delete', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const deleted = await BuilderProject.findOneAndDelete({
      _id: req.params.id,
      ...scope,
    });
    if (!deleted) return res.status(404).json({ ok: false, error: 'Project not found' });
    return res.json({ ok: true, item: { hardDeleted: true, id: String(req.params.id) } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to hard-delete builder project' });
  }
});

app.post('/api/builder/projects/:id/duplicate', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const source = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    }).lean();
    if (!source) return res.status(404).json({ ok: false, error: 'Project not found' });

    const { ownerUserId, ownerActorKey, ownerEmailSnapshot } = getOwnerIdentity(req);
    const clone = await BuilderProject.create({
      ownerUserId: source.ownerUserId || ownerUserId,
      ownerActorKey: source.ownerActorKey || ownerActorKey,
      ownerEmailSnapshot: source.ownerEmailSnapshot || ownerEmailSnapshot,
      title: normalizeBuilderProjectTitle(`${source.title || 'Project'} (Copy)`, 'Project (Copy)'),
      description: source.description || '',
      layout: cleanBuilderLayout(source.layout || {}),
      previewImageUrl: source.previewImageUrl || '',
      previewImagePublicId: source.previewImagePublicId || '',
      stats: source.stats || getBuilderProjectStats(source.layout || {}),
      version: 1,
      schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
      lastOpenedAt: new Date(),
    });
    return res.status(201).json({ ok: true, item: mapBuilderProjectListItem(clone.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to duplicate builder project' });
  }
});

app.get('/api/builder/projects/:id/export', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    const adminAll = isAdmin && parseBool(req.query.allUsers, false);
    const scope = buildBuilderProjectsScopeFilter(req, {
      adminAll,
      ownerQuery: req.query.owner,
    });
    const project = await BuilderProject.findOne({
      _id: req.params.id,
      ...scope,
    }).lean();
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    return res.json({
      ok: true,
      item: {
        schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
        projectMeta: {
          title: project.title,
          description: project.description || '',
          ownerEmailSnapshot: project.ownerEmailSnapshot || '',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
        },
        layout: cleanBuilderLayout(project.layout || {}),
      },
    });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to export builder project' });
  }
});

app.get('/api/admin/builder/projects', async (req, res) => {
  try {
    const admin = await isAdminRequest(req);
    if (!admin) return res.status(403).json({ ok: false, error: 'Admin authentication required' });

    await cleanupSoftDeletedBuilderProjects();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(48, Math.max(1, Number(req.query.limit || 12)));
    const skip = (page - 1) * limit;
    const q = String(req.query.q || '').trim();
    const deleted = parseBool(req.query.deleted, false);
    const sortKey = String(req.query.sort || 'updated_desc');
    const owner = req.query.owner;

    const sortMap = {
      updated_desc: { updatedAt: -1 },
      created_desc: { createdAt: -1 },
      name_asc: { title: 1 },
      last_opened_desc: { lastOpenedAt: -1, updatedAt: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.updated_desc;

    const filter = {
      ...buildBuilderProjectsScopeFilter(req, { adminAll: true, ownerQuery: owner }),
      isDeleted: deleted,
    };
    if (q) {
      filter.$and = filter.$and || [];
      filter.$and.push({
        $or: [
          { title: { $regex: q, $options: 'i' } },
          { description: { $regex: q, $options: 'i' } },
          { ownerEmailSnapshot: { $regex: q, $options: 'i' } },
        ],
      });
    }

    const [items, total] = await Promise.all([
      BuilderProject.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      BuilderProject.countDocuments(filter),
    ]);

    return res.json({
      ok: true,
      items: items.map(mapBuilderProjectListItem),
      page,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message || 'Failed to list admin builder projects' });
  }
});

app.post('/api/admin/builder/projects/:id/restore', async (req, res) => {
  try {
    const admin = await isAdminRequest(req);
    if (!admin) return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    const project = await BuilderProject.findById(req.params.id);
    if (!project) return res.status(404).json({ ok: false, error: 'Project not found' });
    project.isDeleted = false;
    project.deletedAt = null;
    project.deletedBy = null;
    await project.save();
    return res.json({ ok: true, item: mapBuilderProjectListItem(project.toObject()) });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to restore project' });
  }
});

app.delete('/api/admin/builder/projects/:id', async (req, res) => {
  try {
    const admin = await isAdminRequest(req);
    if (!admin) return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    const deleted = await BuilderProject.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Project not found' });
    return res.json({ ok: true, item: { deleted: true, hard: true } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message || 'Failed to hard-delete builder project' });
  }
});

// Ensure an admin user exists (dev convenience)
async function ensureAdminUser() {
  try {
    const email = process.env.ADMIN_EMAIL || 'admin@example.com';
    const password = process.env.ADMIN_PASSWORD || 'admin123';
    if (!email || !password) return;
    let admin = await User.findOne({ role: 'admin' }).lean();
    if (admin) {
      console.log('Admin user already exists');
      return;
    }
    const existsByEmail = await User.findOne({ email }).lean();
    if (existsByEmail && existsByEmail.role !== 'admin') {
      await User.updateOne({ _id: existsByEmail._id }, { $set: { role: 'admin', isActive: true } });
      console.log(`Promoted existing user ${email} to admin`);
      return;
    }
    if (!existsByEmail) {
      const created = await User.create({ email, password, firstName: 'Admin', lastName: 'User', role: 'admin', isActive: true });
      console.log(`Seeded admin user: ${email} / ${password}`);
      return created;
    }
  } catch (e) {
    console.warn('ensureAdminUser failed:', e?.message || e);
  }
}

ensureAdminUser();

function isPrivateIpv4(ip) {
  const parts = String(ip).split('.').map((p) => Number(p));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10) return true;
  if (parts[0] === 127) return true;
  if (parts[0] === 0) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  return false;
}

function isPrivateIpv6(ip) {
  const normalized = String(ip).toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80:')) return true;
  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.replace('::ffff:', '');
    if (net.isIP(mapped) === 4) return isPrivateIpv4(mapped);
  }
  return false;
}

function isBlockedHostname(hostname) {
  const host = String(hostname || '').toLowerCase();
  return host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal');
}

function assertSafeRemoteImageUrl(inputUrl) {
  if (typeof inputUrl !== 'string' || !inputUrl.trim()) {
    throw new Error('url is required');
  }
  if (inputUrl.length > 2048) {
    throw new Error('URL is too long');
  }

  let parsed;
  try {
    parsed = new URL(inputUrl.trim());
  } catch {
    throw new Error('Invalid URL');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http/https URLs are allowed');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Credentials in URL are not allowed');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('Blocked host');
  }

  const hostType = net.isIP(parsed.hostname);
  if (hostType === 4 && isPrivateIpv4(parsed.hostname)) {
    throw new Error('Private network IPs are not allowed');
  }
  if (hostType === 6 && isPrivateIpv6(parsed.hostname)) {
    throw new Error('Private network IPs are not allowed');
  }

  return parsed.toString();
}

async function probeRemoteImageUrl(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        Range: 'bytes=0-4096',
      },
    });
    if (!response.ok) {
      throw new Error(`Source returned ${response.status}`);
    }
    const contentType = String(response.headers.get('content-type') || '').toLowerCase();
    if (!contentType.startsWith('image/')) {
      throw new Error('URL does not point to an image');
    }
    return {
      contentType,
      contentLength: Number(response.headers.get('content-length') || 0),
    };
  } catch (err) {
    if (err && err.name === 'AbortError') {
      throw new Error('Timed out while checking image URL');
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

// Upload image by URL to Cloudinary (hardened)
app.post('/api/cloudinary/upload-url', async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    }

    const { url, public_id, folder, validateOnly } = req.body || {};
    const safeUrl = assertSafeRemoteImageUrl(url);
    await probeRemoteImageUrl(safeUrl, 8000);

    if (validateOnly) {
      return res.json({ ok: true, item: { url: safeUrl, valid: true } });
    }

    const uploadOptions = {
      folder: typeof folder === 'string' && folder.trim() ? folder.trim() : 'products',
      resource_type: 'image',
    };

    if (typeof public_id === 'string' && public_id.trim()) {
      const cleaned = public_id.trim();
      if (!/^[a-zA-Z0-9/_-]+$/.test(cleaned)) {
        return res.status(400).json({ ok: false, error: 'Invalid public_id format' });
      }
      uploadOptions.public_id = cleaned;
    }

    const result = await cloudinary.uploader.upload(safeUrl, uploadOptions);
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('Cloudinary upload error:', err);
    const message = err?.message || 'Upload failed';
    const isClientError = /required|invalid|only|blocked|timed out|does not point|source returned|private network/i.test(message);
    return res.status(isClientError ? 400 : 500).json({ ok: false, error: message });
  }
});

// Sign direct browser upload for 3D models (production-safe large uploads)
app.post('/api/cloudinary/sign-3d-upload', async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ ok: false, error: 'Cloudinary is not configured on this environment' });
    }

    const rawName = String(req.body?.fileName || 'model').trim();
    const extMatch = rawName.match(/\.([a-zA-Z0-9]+)$/);
    const ext = extMatch ? extMatch[1].toLowerCase() : 'bin';
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.random().toString(36).slice(2, 8);
    const publicId = `model_${Date.now()}_${random}_${ext}`;
    const folder = '3d-models';
    const paramsToSign = {
      folder,
      public_id: publicId,
      resource_type: 'raw',
      timestamp,
    };
    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
    return res.json({
      ok: true,
      item: {
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder,
        publicId,
        resourceType: 'raw',
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload`,
      },
    });
  } catch (err) {
    console.error('Cloudinary sign-3d-upload error:', err);
    return res.status(500).json({ ok: false, error: err?.message || 'Unable to sign upload' });
  }
});

// Upload image file (multipart/form-data) to Cloudinary
app.post('/api/cloudinary/upload-file', (req, res, next) => {
  uploadImage.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ ok: false, error: 'Image is too large. Max size is 8MB.' });
    }
    return res.status(400).json({ ok: false, error: err?.message || 'Invalid upload payload' });
  });
}, async (req, res) => {
  try {
    const isAdmin = await isAdminRequest(req);
    if (!isAdmin) {
      return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    }
    if (!req.file) return res.status(400).json({ ok: false, error: 'file is required' });
    if (!String(req.file.mimetype || '').startsWith('image/')) {
      return res.status(400).json({ ok: false, error: 'Only image files are allowed' });
    }
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: 'products',
        format: 'webp',
        quality: 'auto:good',
        transformation: [
          { width: 1280, height: 1280, crop: 'limit' }
        ]
      }, (error, uploaded) => {
        if (error) return reject(error);
        resolve(uploaded);
      });
      stream.end(req.file.buffer);
    });
    return res.json({ ok: true, result });
  } catch (err) {
    console.error('Cloudinary upload_file error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Upload 3D model file to Cloudinary
app.post('/api/upload-3d-model', (req, res, next) => {
  upload3D.single('file')(req, res, (err) => {
    if (!err) return next();
    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ ok: false, error: '3D file is too large. Max size is 50MB.' });
    }
    return res.status(400).json({ ok: false, error: err?.message || 'Invalid upload payload' });
  });
}, async (req, res) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return res.status(500).json({ ok: false, error: 'Cloudinary is not configured on this server' });
    }

    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No file uploaded' });
    }

    // Check file type
    const allowedTypes = ['.glb', '.gltf', '.obj', '.fbx'];
    const fileExt = path.extname(req.file.originalname).toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      return res.status(400).json({ 
        ok: false, 
        error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` 
      });
    }

    // Upload to Cloudinary with raw resource type for 3D files
    // Include file extension in public_id to preserve it in the URL
    const publicId = `model_${Date.now()}${fileExt}`; // Include extension for stable URL suffix
    
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream({
        folder: '3d-models',
        resource_type: 'raw', // Important for non-image files
        public_id: publicId,
      }, (error, uploaded) => {
        if (error) return reject(error);
        resolve(uploaded);
      });
      stream.end(req.file.buffer);
    });

    console.log('✅ 3D Model uploaded:', result.secure_url);
    console.log('📦 File extension:', fileExt);
    
    return res.json({ 
      ok: true, 
      url: result.secure_url,
      publicId: result.public_id,
      fileSize: result.bytes,
      format: fileExt.substring(1) // Return extension without dot
    });
  } catch (err) {
    console.error('❌ 3D Model upload error:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Category CRUD
app.get('/api/categories', async (req, res) => {
  const { page = 1, limit = 20, featured } = req.query;
  try {
    let q = {};
    if (featured !== undefined) q.featured = featured === 'true';
    
    // Apply RBAC read conditions only if user is authenticated
    if (req.user && req.user._id) {
      const { getPermissionContext, applyReadConditions } = await import('./rbac/permissions.js');
      const ctx = await getPermissionContext(req.user._id, 'categories', 'read');
      if (ctx.allowed && ctx.conditions) {
        // Apply conditions to the query
        q = applyReadConditions(q, ctx.conditions, { userId: req.user._id });
      }
    }
    
    const skip = (Number(page) - 1) * Number(limit);

    // Fetch categories page
    const [rawItems, total] = await Promise.all([
      Category.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Category.countDocuments(q),
    ]);

    // Compute product counts using a single pipeline:
    // 1) $lookup categories by categoryId to get canonical slug
    // 2) effectiveSlug := coalesce(lookup slug, product.categorySlug)
    // 3) filter active: true and effectiveSlug in returned category slugs
    // 4) group by effectiveSlug
    const slugs = rawItems.map((c) => c.slug).filter(Boolean);
    let countMap = new Map(); // slug -> count
    if (slugs.length > 0) {
      const counts = await Product.aggregate([
        { $match: {
            $or: [
              { categorySlug: { $in: slugs } },
              { categoryId: { $in: rawItems.map((c) => c._id) } },
            ],
            active: { $ne: false },
          }
        },
        { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'cat' } },
        { $addFields: { lookedUpSlug: { $arrayElemAt: ['$cat.slug', 0] } } },
        { $addFields: { effectiveSlug: { $ifNull: ['$lookedUpSlug', '$categorySlug'] } } },
        { $match: { effectiveSlug: { $in: slugs } } },
        { $group: { _id: '$effectiveSlug', count: { $sum: 1 } } },
      ]);
      counts.forEach((d) => countMap.set(d._id, d.count));
    }

    // Attach live productCount to each item (fallback to stored productCount or 0)
    const items = rawItems.map((c) => {
      const item = {
        ...c,
        productCount: typeof countMap.get(c.slug) === 'number' ? countMap.get(c.slug) : (typeof c.productCount === 'number' ? c.productCount : 0),
      };
      
      
      return item;
    });

    return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/categories/:id', async (req, res) => {
  // Categories are public - anyone can view them
  const item = await Category.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  return sendJsonWithEtag(req, res, { ok: true, item });
});

app.post('/api/categories', requirePermission('categories', 'create', { attach: true }), async (req, res) => {
  try {
    const {
      name, nameAr, description, descriptionAr, slug,
      categoryType, icon, color, parentCategory,
      featured, image, order, isActive, showInMenu,
      metaTitle, metaDescription, useRandomPreview, previewProducts
    } = req.body;

    // Create category with enhanced fields
    const categoryData = {
      name, nameAr, description, descriptionAr, slug,
      categoryType: categoryType || 'product',
      icon: icon || '',
      color: color || '#3B82F6',
      parentCategory: parentCategory || null,
      featured: featured || false,
      image: image || '',
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
      showInMenu: showInMenu !== undefined ? showInMenu : true,
      metaTitle: metaTitle || '',
      metaDescription: metaDescription || '',
      useRandomPreview: useRandomPreview !== undefined ? useRandomPreview : true,
      previewProducts: previewProducts || [],
      productCount: 0 // Initialize to 0
    };

    const created = await Category.create(categoryData);
    
    // Update product count if there are existing products
    await Category.updateProductCount(created._id);
    
    res.status(201).json({ ok: true, item: created });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/categories/:id', requirePermission('categories', 'update', { attach: true }), async (req, res) => {
  try {
    const {
      name, nameAr, description, descriptionAr, slug,
      categoryType, icon, color, parentCategory,
      featured, image, order, isActive, showInMenu,
      metaTitle, metaDescription, useRandomPreview, previewProducts
    } = req.body;

    // Prepare update data (only include defined fields)
    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (nameAr !== undefined) updateData.nameAr = nameAr;
    if (description !== undefined) updateData.description = description;
    if (descriptionAr !== undefined) updateData.descriptionAr = descriptionAr;
    if (slug !== undefined) updateData.slug = slug;
    if (categoryType !== undefined) updateData.categoryType = categoryType;
    if (icon !== undefined) updateData.icon = icon;
    if (color !== undefined) updateData.color = color;
    if (parentCategory !== undefined) updateData.parentCategory = parentCategory;
    if (featured !== undefined) updateData.featured = featured;
    if (image !== undefined) updateData.image = image;
    if (order !== undefined) updateData.order = order;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (showInMenu !== undefined) updateData.showInMenu = showInMenu;
    if (metaTitle !== undefined) updateData.metaTitle = metaTitle;
    if (metaDescription !== undefined) updateData.metaDescription = metaDescription;
    if (useRandomPreview !== undefined) updateData.useRandomPreview = useRandomPreview;
    if (previewProducts !== undefined) updateData.previewProducts = previewProducts;

    const updated = await Category.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    
    // Update product count after category update
    await Category.updateProductCount(updated._id);
    
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/categories/:id', requirePermission('categories', 'delete', { attach: true }), async (req, res) => {
  const deleted = await Category.findByIdAndDelete(req.params.id);
  if (!deleted) return res.status(404).json({ ok: false, error: 'Not found' });
  res.json({ ok: true });
});

// Get category hierarchy (subcategories)
app.get('/api/categories/:id/subcategories', async (req, res) => {
  try {
    const category = await Category.findById(req.params.id);
    if (!category) return res.status(404).json({ ok: false, error: 'Category not found' });
    
    const subcategories = await category.getSubcategories();
    res.json({ ok: true, items: subcategories });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Update all category product counts (admin utility)
app.post('/api/categories/update-counts', requirePermission('categories', 'update', { attach: true }), async (req, res) => {
  try {
    const categories = await Category.find({});
    let updated = 0;
    
    for (const category of categories) {
      await Category.updateProductCount(category._id);
      updated++;
    }
    
    res.json({ 
      ok: true, 
      message: `Updated product counts for ${updated} categories` 
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Product CRUD
async function attachRatingStatsToProducts(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const ids = items
    .map((item) => String(item?._id || item?.id || ''))
    .filter(Boolean)
    .filter((id) => mongoose.Types.ObjectId.isValid(id))
    .map((id) => new mongoose.Types.ObjectId(id));
  if (ids.length === 0) return items;

  const stats = await Rating.aggregate([
    { $match: { product: { $in: ids } } },
    {
      $group: {
        _id: '$product',
        avgRating: { $avg: '$rating' },
        reviews: { $sum: 1 },
      },
    },
  ]);

  const statsMap = new Map(
    stats.map((s) => [String(s._id), { rating: Number(s.avgRating || 0), reviews: Number(s.reviews || 0) }])
  );

  return items.map((item) => {
    const key = String(item?._id || item?.id || '');
    const stat = statsMap.get(key) || { rating: 0, reviews: 0 };
    return {
      ...item,
      rating: Number(stat.rating.toFixed(1)),
      reviews: stat.reviews,
    };
  });
}

app.get('/api/products', async (req, res) => {
  const { page = 1, limit = 20, featured, categorySlug, search, ids, fields } = req.query;
  try {
    // If ids are provided, fetch specific products in one query and ignore pagination
    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const projection = typeof fields === 'string' ? String(fields).split(',').join(' ') : undefined;
      const docs = await Product.find({ _id: { $in: idList } })
        .select(projection)
        .lean();
      const itemsWithStats = await attachRatingStatsToProducts(docs);
      return sendJsonWithEtag(req, res, { ok: true, items: itemsWithStats, total: itemsWithStats.length, page: 1, pages: 1 });
    }

    let q = {};
    if (featured !== undefined) q.featured = featured === 'true';
    if (categorySlug) q.categorySlug = categorySlug;
    if (search) q.name = { $regex: String(search), $options: 'i' };
    
    // Apply RBAC read conditions only if user is authenticated
    if (req.user && req.user._id) {
      const { getPermissionContext, applyReadConditions } = await import('./rbac/permissions.js');
      const ctx = await getPermissionContext(req.user._id, 'products', 'read');
      if (ctx.allowed && ctx.conditions) {
        // Apply conditions to the query
        q = applyReadConditions(q, ctx.conditions, { userId: req.user._id });
      }
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    const projection = typeof fields === 'string' ? String(fields).split(',').join(' ') : undefined;
    const [items, total] = await Promise.all([
      Product.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).select(projection).lean(),
      Product.countDocuments(q),
    ]);
    const itemsWithStats = await attachRatingStatsToProducts(items);
    return sendJsonWithEtag(req, res, { ok: true, items: itemsWithStats, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/products/:id', async (req, res) => {
  // Products are public - anyone can view them
  // Only check permissions for admin users trying to access
  const item = await Product.findById(req.params.id).lean();
  if (!item) return res.status(404).json({ ok: false, error: 'Not found' });
  const [itemWithStats] = await attachRatingStatsToProducts([item]);
  res.json({ ok: true, item: itemWithStats });
});

app.get('/api/products/:id/ratings', async (req, res) => {
  const ratingsEnabled = await isVisibilityEnabled('featureFlags', 'rating');
  if (!ratingsEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  try {
    const productId = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product id' });
    }

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) return res.status(404).json({ ok: false, error: 'Product not found' });

    const ratings = await Rating.find({ product: productId })
      .sort({ updatedAt: -1, createdAt: -1 })
      .populate('user', 'name email')
      .lean();

    const items = ratings.map((r) => ({
      id: String(r._id),
      userId: String(r.user?._id || ''),
      userName: r.user?.name || r.user?.email || 'مستخدم',
      rating: Number(r.rating || 0),
      review: r.review || '',
      date: r.updatedAt || r.createdAt || new Date(),
    }));

    const total = items.length;
    const averageRating = total > 0 ? Number((items.reduce((sum, r) => sum + r.rating, 0) / total).toFixed(1)) : 0;
    return res.json({ ok: true, items, total, averageRating });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/products/:id/ratings', async (req, res) => {
  const ratingsEnabled = await isVisibilityEnabled('featureFlags', 'rating');
  if (!ratingsEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  try {
    const productId = String(req.params.id || '');
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ ok: false, error: 'Invalid product id' });
    }
    if (!req.user?._id) {
      return res.status(401).json({ ok: false, error: 'Authentication required' });
    }

    const { rating, review } = req.body || {};
    const normalizedRating = Number(rating);
    if (!Number.isFinite(normalizedRating) || normalizedRating < 1 || normalizedRating > 5) {
      return res.status(400).json({ ok: false, error: 'Rating must be between 1 and 5' });
    }
    const normalizedReview = String(review || '').trim().slice(0, 500);

    const productExists = await Product.exists({ _id: productId });
    if (!productExists) return res.status(404).json({ ok: false, error: 'Product not found' });

    const existing = await Rating.findOne({ product: productId, user: req.user._id }).select('_id').lean();
    if (existing) {
      return res.status(409).json({ ok: false, error: 'You have already rated this product' });
    }

    const saved = await Rating.create({
      product: productId,
      user: req.user._id,
      rating: normalizedRating,
      review: normalizedReview,
    });
    await saved.populate('user', 'name email');

    const stats = await Rating.aggregate([
      { $match: { product: new mongoose.Types.ObjectId(productId) } },
      {
        $group: {
          _id: '$product',
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
        },
      },
    ]);

    const summary = stats[0] || { averageRating: 0, totalReviews: 0 };
    return res.status(201).json({
      ok: true,
      item: {
        id: String(saved._id),
        userId: String(saved.user?._id || req.user._id),
        userName: saved.user?.name || saved.user?.email || req.user?.email || 'مستخدم',
        rating: Number(saved.rating || 0),
        review: saved.review || '',
        date: saved.updatedAt || saved.createdAt || new Date(),
      },
      averageRating: Number(Number(summary.averageRating || 0).toFixed(1)),
      totalReviews: Number(summary.totalReviews || 0),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/products', requirePermission('products', 'create', { attach: true }), async (req, res) => {
  try {
    const body = req.body || {};
    if (req.permission?.conditions) {
      const ok = validateWriteAgainstConditions(body, req.permission.conditions, req.permission.userId);
      if (!ok) return res.status(403).json({ ok: false, error: 'Not allowed to create with provided attributes' });
    }
    const created = await Product.create(body);
    res.status(201).json({ ok: true, item: created });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/products', requirePermission('products', 'create', { attach: true }), async (req, res) => {
  try {
    const body = req.body || {};
    if (req.permission?.conditions) {
      const ok = validateWriteAgainstConditions(body, req.permission.conditions, req.permission.userId);
      if (!ok) return res.status(403).json({ ok: false, error: 'Not allowed to create with provided attributes' });
    }
    const created = await Product.create(body);
    res.status(201).json({ ok: true, item: created });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/categories', requirePermission('categories', 'create', { attach: true }), async (req, res) => {
  try {
    // Validate against allowed lists (e.g., category)
    const body = req.body || {};
    if (req.permission?.conditions) {
      const mockRecord = body; // expecting categoryId/category in body
      const ok = validateWriteAgainstConditions(mockRecord, req.permission.conditions, req.permission.userId);
      if (!ok) return res.status(403).json({ ok: false, error: 'Not allowed to create with provided attributes' });
    }
    const created = await Category.create(body);
    res.status(201).json({ ok: true, item: created });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/products/:id', requirePermission('products', 'update', { attach: true }), async (req, res) => {
  try {
    const existing = await Product.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
    if (req.permission?.conditions) {
      const okExisting = validateWriteAgainstConditions(existing, req.permission.conditions, req.permission.userId);
      if (!okExisting) return res.status(403).json({ ok: false, error: 'Not allowed for this record' });
    }
    Object.assign(existing, req.body || {});
    if (req.permission?.conditions) {
      const okUpdated = validateWriteAgainstConditions(existing, req.permission.conditions, req.permission.userId);
      if (!okUpdated) return res.status(403).json({ ok: false, error: 'Updated fields violate allowed list' });
    }
    const updated = await existing.save();
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Create new order (checkout endpoint)
app.post('/api/orders', async (req, res) => {
  try {
    const { 
      items, 
      shippingAddress, 
      billingAddress, 
      paymentMethod = 'cod',
      shippingMethod = 'standard',
      notes,
      guestInfo,
      subtotal,
      shipping,
      tax,
      total
    } = req.body || {};

    // Validate required fields
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ ok: false, error: 'Order items are required' });
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
      return res.status(400).json({ ok: false, error: 'Shipping address is required' });
    }

    // Determine userId (authenticated user or guest)
    let userId = req.user?._id || req.header('x-user-id');
    let customerEmail = req.user?.email;
    let customerName = req.user?.name;

    // Handle guest checkout
    if (!userId && guestInfo) {
      if (!guestInfo.email || !guestInfo.name) {
        return res.status(400).json({ ok: false, error: 'Guest email and name are required' });
      }
      // Create a guest user ID based on email
      userId = `guest_${crypto.createHash('md5').update(guestInfo.email).digest('hex')}`;
      customerEmail = guestInfo.email;
      customerName = guestInfo.name;
    }

    if (!userId) {
      return res.status(401).json({ ok: false, error: 'User authentication required or guest info needed' });
    }

    // Validate and fetch product details
    const orderItems = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return res.status(400).json({ ok: false, error: 'Invalid item in order' });
      }

      // Fetch product from database
      const product = await Product.findById(item.productId);
      if (!product) {
        return res.status(404).json({ ok: false, error: `Product ${item.productId} not found` });
      }

      if (!product.active) {
        return res.status(400).json({ ok: false, error: `Product ${product.nameAr} is not available` });
      }

      // Stock check disabled - allow orders regardless of stock
      // if (product.stock < item.quantity) {
      //   return res.status(400).json({ 
      //     ok: false, 
      //     error: `Insufficient stock for ${product.nameAr}. Available: ${product.stock}, Requested: ${item.quantity}` 
      //   });
      // }

      const itemPrice = product.price;
      const itemSubtotal = itemPrice * item.quantity;
      calculatedSubtotal += itemSubtotal;

      orderItems.push({
        productId: product._id.toString(),
        product: {
          _id: product._id,
          name: product.name,
          nameAr: product.nameAr,
          image: product.image,
          price: product.price,
          sku: product.sku
        },
        quantity: item.quantity,
        price: itemPrice,
        subtotal: itemSubtotal
      });

      // Stock update disabled - don't decrease stock on orders
      // product.stock -= item.quantity;
      // await product.save();
    }

    // Validate totals (allow small rounding differences)
    if (subtotal && Math.abs(calculatedSubtotal - subtotal) > 0.01) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Subtotal mismatch. Please refresh and try again.' 
      });
    }

    // Calculate shipping cost
    const shippingCost = shipping || 0;

    // Calculate tax
    const taxAmount = tax || 0;

    // Calculate total
    const totalAmount = calculatedSubtotal + shippingCost + taxAmount;

    // Create order
    const order = await Order.create({
      userId,
      items: orderItems,
      subtotal: calculatedSubtotal,
      shipping: shippingCost,
      tax: taxAmount,
      total: totalAmount,
      status: 'pending',
      paymentMethod,
      paymentStatus: paymentMethod === 'cod' ? 'pending' : 'pending',
      shippingAddress,
      billingAddress: billingAddress || shippingAddress,
      notes,
      estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) // 3 days from now
    });

    // Send order confirmation email
    try {
      const orderEmailService = (await import('./services/orderEmailService.js')).default;
      await orderEmailService.sendOrderConfirmation(order._id);
    } catch (emailError) {
      console.error('Failed to send order confirmation email:', emailError);
      // Don't fail the order creation if email fails
    }

    // Log order creation
    try {
      await logHistory({
        section: 'orders',
        action: 'order_created',
        note: `Order ${order.orderNumber} created`,
        meta: { 
          orderId: order._id.toString(), 
          orderNumber: order.orderNumber,
          total: totalAmount,
          itemCount: orderItems.length,
          userId
        }
      });
    } catch (logError) {
      console.error('Failed to log order creation:', logError);
    }

    res.status(201).json({ 
      ok: true, 
      item: order,
      orderId: order._id.toString(),
      orderNumber: order.orderNumber
    });
  } catch (err) {
    console.error('Order creation error:', err);
    res.status(500).json({ ok: false, error: err.message || 'Failed to create order' });
  }
});

// New endpoint for users to get their own orders
app.get('/api/users/:id/orders', async (req, res) => {
  try {
    // Check if the user is authenticated
    if (!req.user || !req.user._id) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }
    
    // Check if the user is trying to access their own orders
    if (req.user._id !== req.params.id) {
      // If not, check if they have permission to read orders
      const { getPermissionContext, applyReadConditions } = await import('./rbac/permissions.js');
      const ctx = await getPermissionContext(req.user._id, 'orders', 'read');
      if (!ctx.allowed) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      
      // Apply conditions if any
      let q = { userId: req.params.id };
      if (ctx.conditions) {
        q = applyReadConditions(q, ctx.conditions, { userId: req.user._id });
      }
      
      const { page = 1, limit = 20, status, search } = req.query;
      const skip = (Number(page) - 1) * Number(limit);
      
      if (status) q.status = status;
      if (search) {
        // rudimentary search on id and trackingNumber
        q.$or = [
          { _id: { $regex: String(search), $options: 'i' } },
          { trackingNumber: { $regex: String(search), $options: 'i' } },
        ];
      }
      
      const [items, total] = await Promise.all([
        Order.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
        Order.countDocuments(q),
      ]);
      
      return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    }
    
    // User is accessing their own orders
    const { page = 1, limit = 20, status, search } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    let q = { userId: req.params.id };
    if (status) q.status = status;
    if (search) {
      // rudimentary search on id and trackingNumber
      q.$or = [
        { _id: { $regex: String(search), $options: 'i' } },
        { trackingNumber: { $regex: String(search), $options: 'i' } },
      ];
    }
    
    const [items, total] = await Promise.all([
      Order.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Order.countDocuments(q),
    ]);
    
    return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Orders (list and update status)
app.get('/api/orders', requirePermission('orders', 'read', { attach: true }), async (req, res) => {
  const { page = 1, limit = 20, status, userId, search } = req.query;
  let q = {};
  if (status) q.status = status;
  if (userId) q.userId = userId;
  if (search) {
    // rudimentary search on id and trackingNumber
    q.$or = [
      { _id: { $regex: String(search), $options: 'i' } },
      { trackingNumber: { $regex: String(search), $options: 'i' } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  // Apply generic read conditions (status/dateRange, ownedBy=self)
  if (req.permission?.conditions) {
    q = applyReadConditions(q, req.permission.conditions, { userId: req.permission.userId });
  }
  const [items, total] = await Promise.all([
    Order.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    Order.countDocuments(q),
  ]);
  res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// Get single order by ID
app.get('/api/orders/:id', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).lean();
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    
    // Allow users to view their own orders, or admins to view any order
    const userId = req.user?._id || req.header('x-user-id');
    
    // Convert both to strings for comparison
    const orderUserId = String(order.userId);
    const requestUserId = String(userId);
    const isOwnOrder = orderUserId === requestUserId;
    
    // Check if user has admin permission
    let hasAdminPermission = false;
    if (userId) {
      try {
        const permissions = await getUserPermissions(userId);
        hasAdminPermission = permissions.some(p => p.resource === 'orders' && p.action === 'read');
      } catch (e) {
        // If permission check fails, continue with ownership check
      }
    }
    
    // Allow if it's user's own order OR if user has admin permission OR if user is authenticated (temporary for testing)
    if (!isOwnOrder && !hasAdminPermission && !userId) {
      console.log('Access denied:', { orderUserId, requestUserId, isOwnOrder, hasAdminPermission });
      return res.status(403).json({ ok: false, error: 'Not allowed to view this order' });
    }
    
    // Log for debugging
    if (!isOwnOrder && !hasAdminPermission) {
      console.log('Allowing access despite mismatch (user is authenticated):', { orderUserId, requestUserId });
    }
    
    res.json({ ok: true, item: order });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.patch('/api/orders/:id', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    // Validate write against conditions if applicable (e.g., ownedBy/self/team)
    if (req.permission?.conditions) {
      const existing = await Order.findById(req.params.id).lean();
      if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
      const okExisting = validateWriteAgainstConditions(existing, req.permission.conditions, req.permission.userId);
      if (!okExisting) return res.status(403).json({ ok: false, error: 'Not allowed for this record' });
    }
    const allowed = {};
    if (typeof req.body.status === 'string') allowed.status = req.body.status;
    if (typeof req.body.paymentStatus === 'string') allowed.paymentStatus = req.body.paymentStatus;
    if (typeof req.body.notes === 'string') allowed.notes = req.body.notes;
    if (typeof req.body.trackingNumber === 'string') allowed.trackingNumber = req.body.trackingNumber;
    if (req.body.estimatedDelivery) allowed.estimatedDelivery = req.body.estimatedDelivery;
    if (typeof req.body.cancellationRequested === 'boolean') allowed.cancellationRequested = req.body.cancellationRequested;
    if (typeof req.body.cancellationReason === 'string') allowed.cancellationReason = req.body.cancellationReason;
    if (req.body.cancellationRequestedAt) allowed.cancellationRequestedAt = req.body.cancellationRequestedAt;
    if (typeof req.body.assignedTo === 'string') allowed.assignedTo = req.body.assignedTo;
    if (typeof req.body.priority === 'string') allowed.priority = req.body.priority;
    if (typeof req.body.carrier === 'string') allowed.carrier = req.body.carrier;
    
    const updated = await Order.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// New endpoint for return requests
app.patch('/api/orders/:id/return', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    
    // Check if order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({ ok: false, error: 'Order must be delivered to request return' });
    }
    
    // In a real implementation, this would create a return request record
    // For now, we'll just update the order status to refunded
    order.status = 'refunded';
    order.paymentStatus = 'refunded';
    await order.save();
    
    res.json({ ok: true, item: order });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// New endpoint for requesting returns (creates a return request)
app.patch('/api/orders/:id/request-return', async (req, res) => {
  try {
    const { returnReason } = req.body || {};
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    
    // Check if order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({ ok: false, error: 'Order must be delivered to request return' });
    }
    
    // In a real implementation, this would create a return request record
    // For now, we'll just add return request info to the order notes
    if (returnReason) {
      order.notes = order.notes ? `${order.notes}\nReturn requested: ${returnReason}` : `Return requested: ${returnReason}`;
    }
    
    await order.save();
    
    res.json({ ok: true, item: order });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// New endpoint for requesting order cancellation
app.patch('/api/orders/:id/request-cancellation', async (req, res) => {
  try {
    const { cancellationRequested, cancellationReason, cancellationRequestedAt } = req.body || {};
    const allowed = {};
    
    if (typeof cancellationRequested === 'boolean') allowed.cancellationRequested = cancellationRequested;
    if (typeof cancellationReason === 'string') allowed.cancellationReason = cancellationReason;
    if (cancellationRequestedAt) allowed.cancellationRequestedAt = cancellationRequestedAt;
    
    const updated = await Order.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// New endpoint for cancelling an order
app.patch('/api/orders/:id/cancel', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const allowed = {
      status: 'cancelled',
      cancellationRequested: false
    };
    
    const updated = await Order.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// New endpoint for partial refund
app.patch('/api/orders/:id/partial-refund', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { refundAmount, refundReason, refundItems } = req.body || {};
    
    // Validate input
    if (!refundAmount || refundAmount <= 0) {
      return res.status(400).json({ ok: false, error: 'Refund amount is required and must be greater than 0' });
    }
    
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    
    // Check if order is eligible for partial refund
    if (order.status !== 'delivered' && order.status !== 'shipped') {
      return res.status(400).json({ ok: false, error: 'Order must be delivered or shipped to process partial refund' });
    }
    
    // Validate refund amount doesn't exceed order total
    if (refundAmount > order.total) {
      return res.status(400).json({ ok: false, error: 'Refund amount cannot exceed order total' });
    }
    
    // Update order with partial refund info
    const refundNote = `Partial refund processed: ${refundAmount} SAR${refundReason ? ` - ${refundReason}` : ''}`;
    order.paymentStatus = 'partially_refunded';
    order.notes = order.notes ? `${order.notes}\n${refundNote}` : refundNote;
    
    // If this is a full refund, update status to refunded
    if (refundAmount >= order.total) {
      order.status = 'refunded';
      order.paymentStatus = 'refunded';
    }
    
    await order.save();
    
    // In a real implementation, this would integrate with a payment gateway
    // For now, we'll just update the order status
    
    res.json({ ok: true, item: order, message: `Partial refund of ${refundAmount} SAR processed successfully` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// New endpoint for exporting orders as CSV
app.get('/api/orders/export', requirePermission('orders', 'read', { attach: true }), async (req, res) => {
  try {
    const { status, startDate, endDate } = req.query;
    
    // Build query
    let q = {};
    if (status && status !== 'all') {
      q.status = status;
    }
    if (startDate || endDate) {
      q.createdAt = {};
      if (startDate) q.createdAt.$gte = new Date(String(startDate));
      if (endDate) q.createdAt.$lte = new Date(String(endDate));
    }
    
    // Apply generic read conditions (status/dateRange, ownedBy=self)
    if (req.permission?.conditions) {
      q = applyReadConditions(q, req.permission.conditions, { userId: req.permission.userId });
    }
    
    // Fetch all orders matching criteria
    const orders = await Order.find(q).sort({ createdAt: -1 }).lean();
    
    // Create CSV content
    const headers = [
      'رقم الطلب',
      'تاريخ الطلب',
      'حالة الطلب',
      'حالة الدفع',
      'اسم العميل',
      'البريد الإلكتروني',
      'رقم الهاتف',
      'العنوان',
      'إجمالي الطلب',
      'رسوم الشحن',
      'الضريبة',
      'عدد المنتجات',
      'شركة الشحن',
      'رقم التتبع'
    ];
    
    const csvRows = [headers.join(',')];
    
    for (const order of orders) {
      const row = [
        `"${order.orderNumber || order._id}"`,
        `"${new Date(order.createdAt).toLocaleDateString('ar-SA')}"`,
        `"${getOrderStatusLabel(order.status)}"`,
        `"${getPaymentStatusLabel(order.paymentStatus)}"`,
        `"${order.shippingAddress?.name || ''}"`,
        `"${order.userId || ''}"`, // In a real implementation, this would be the customer's email
        `"${order.shippingAddress?.phone || ''}"`,
        `"${[
          order.shippingAddress?.street,
          order.shippingAddress?.city,
          order.shippingAddress?.state,
          order.shippingAddress?.postalCode,
          order.shippingAddress?.country
        ].filter(Boolean).join(', ')}"`,
        order.total,
        order.shipping,
        order.tax,
        order.items.length,
        `"${order.carrier || ''}"`,
        `"${order.trackingNumber || ''}"`
      ];
      csvRows.push(row.join(','));
    }
    
    const csvContent = csvRows.join('\n');
    
    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="orders-${new Date().toISOString().split('T')[0]}.csv"`);
    
    res.send('\uFEFF' + csvContent); // Add BOM for UTF-8
  } catch (err) {
    console.error('Error exporting orders:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Helper functions for labels
function getOrderStatusLabel(status) {
  const labels = {
    'pending': 'قيد التجهيز',
    'confirmed': 'تم التأكيد',
    'processing': 'قيد التنفيذ',
    'shipped': 'تم الشحن',
    'out_for_delivery': 'خارج للتوصيل',
    'delivered': 'تم التسليم',
    'cancelled': 'ملغي',
    'refunded': 'تم الاسترجاع',
    'returned': 'تم الإرجاع'
  };
  return labels[status] || status;
}

function getPaymentStatusLabel(status) {
  const labels = {
    'pending': 'قيد الانتظار',
    'paid': 'مدفوع',
    'failed': 'فشل',
    'refunded': 'مسترد',
    'partially_refunded': 'مسترد جزئياً'
  };
  return labels[status] || status;
}

// --- Order Email Notifications ---
import orderEmailService from './services/orderEmailService.js';

// Send order confirmation email
app.post('/api/orders/:id/email/confirmation', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const result = await orderEmailService.sendOrderConfirmation(req.params.id);
    if (result.success) {
      return res.json({ ok: true, message: 'Order confirmation email sent', ...result });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Send order shipped email
app.post('/api/orders/:id/email/shipped', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { trackingNumber, carrier, estimatedDelivery, trackingUrl } = req.body || {};
    const result = await orderEmailService.sendOrderShipped(req.params.id, {
      trackingNumber,
      carrier,
      estimatedDelivery: estimatedDelivery ? new Date(estimatedDelivery) : null,
      trackingUrl
    });
    
    if (result.success) {
      return res.json({ ok: true, message: 'Order shipped email sent', ...result });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Send order delivered email
app.post('/api/orders/:id/email/delivered', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const result = await orderEmailService.sendOrderDelivered(req.params.id);
    if (result.success) {
      return res.json({ ok: true, message: 'Order delivered email sent', ...result });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Resend any order email
app.post('/api/orders/:id/email/resend', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { emailType } = req.body || {};
    if (!['confirmation', 'shipped', 'delivered'].includes(emailType)) {
      return res.status(400).json({ ok: false, error: 'Invalid email type' });
    }
    
    const result = await orderEmailService.resendOrderEmail(req.params.id, emailType);
    if (result.success) {
      return res.json({ ok: true, message: `Order ${emailType} email resent`, ...result });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Get order email status
app.get('/api/orders/:id/email/status', requirePermission('orders', 'read', { attach: true }), async (req, res) => {
  try {
    const result = await orderEmailService.getOrderEmailStatus(req.params.id);
    if (result.success) {
      res.json({ ok: true, ...result });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Return Management API Endpoints
import Return from './models/Return.js';
import Product3D from './models/Product3D.js';

// Get all returns (admin)
app.get('/api/returns', requirePermission('returns', 'read', { attach: true }), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let q = {};
    
    if (status && status !== 'all') {
      q.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Return.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Return.countDocuments(q),
    ]);
    
    res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get return by ID (admin)
app.get('/api/returns/:id', requirePermission('returns', 'read', { attach: true }), async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id).lean();
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });
    res.json({ ok: true, item: ret });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update return status (admin)
app.patch('/api/returns/:id', requirePermission('returns', 'update', { attach: true }), async (req, res) => {
  try {
    const allowed = {};
    if (typeof req.body.status === 'string') allowed.status = req.body.status;
    if (typeof req.body.refundStatus === 'string') allowed.refundStatus = req.body.refundStatus;
    
    const updated = await Return.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Return not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Add internal note to return (admin)
app.patch('/api/returns/:id/notes', requirePermission('returns', 'update', { attach: true }), async (req, res) => {
  try {
    const { internalNote } = req.body || {};
    if (!internalNote) {
      return res.status(400).json({ ok: false, error: 'internalNote is required' });
    }

    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });

    const note = {
      text: internalNote,
      createdBy: req.user?._id,
      createdByName: req.user?.email,
      createdAt: new Date()
    };

    ret.internalNotes = ret.internalNotes || [];
    ret.internalNotes.push(note);
    await ret.save();

    res.json({ ok: true, item: ret });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Create return request (customer)
app.post('/api/returns', async (req, res) => {
  try {
    const { orderId, items, reason } = req.body || {};
    
    // Validate order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    
    // Check if user owns the order
    if (order.userId !== req.user?._id) {
      return res.status(403).json({ ok: false, error: 'Not authorized to return this order' });
    }
    
    // Check if order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({ ok: false, error: 'Order must be delivered to request return' });
    }
    
    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create return request
    const ret = await Return.create({
      orderId: order._id,
      userId: req.user._id,
      items,
      totalAmount,
      reason,
      status: 'requested',
      refundMethod: 'original', // Default to original payment method
      refundAmount: totalAmount,
      refundStatus: 'pending'
    });
    
    // Update order with return request info
    order.returnRequested = true;
    order.returnRequestedAt = new Date();
    await order.save();
    
    res.status(201).json({ ok: true, item: ret });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get returns for current user
app.get('/api/my/returns', async (req, res) => {
  try {
    const items = await Return.find({ userId: req.user?._id }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get specific return for current user
app.get('/api/my/returns/:id', async (req, res) => {
  try {
    const ret = await Return.findOne({ _id: req.params.id, userId: req.user?._id }).lean();
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });
    res.json({ ok: true, item: ret });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Return Management API Endpoints

// Get all returns (admin)
app.get('/api/returns', requirePermission('returns', 'read', { attach: true }), async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    let q = {};
    
    if (status && status !== 'all') {
      q.status = status;
    }
    
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Return.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Return.countDocuments(q),
    ]);
    
    res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get return by ID (admin)
app.get('/api/returns/:id', requirePermission('returns', 'read', { attach: true }), async (req, res) => {
  try {
    const ret = await Return.findById(req.params.id).lean();
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });
    res.json({ ok: true, item: ret });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Update return status (admin)
app.patch('/api/returns/:id', requirePermission('returns', 'update', { attach: true }), async (req, res) => {
  try {
    const allowed = {};
    if (typeof req.body.status === 'string') allowed.status = req.body.status;
    if (typeof req.body.refundStatus === 'string') allowed.refundStatus = req.body.refundStatus;
    
    const updated = await Return.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Return not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Add internal note to return (admin)
app.patch('/api/returns/:id/notes', requirePermission('returns', 'update', { attach: true }), async (req, res) => {
  try {
    const { internalNote } = req.body || {};
    if (!internalNote) {
      return res.status(400).json({ ok: false, error: 'internalNote is required' });
    }

    const ret = await Return.findById(req.params.id);
    if (!ret) return res.status(404).json({ ok: false, error: 'Return not found' });

    const note = {
      text: internalNote,
      createdBy: req.user?._id,
      createdByName: req.user?.email,
      createdAt: new Date()
    };

    ret.internalNotes = ret.internalNotes || [];
    ret.internalNotes.push(note);
    await ret.save();

    res.json({ ok: true, item: ret });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Create return request (customer)
app.post('/api/returns', async (req, res) => {
  try {
    const { orderId, items, reason } = req.body || {};
    
    // Validate order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ ok: false, error: 'Order not found' });
    
    // Check if user owns the order
    if (order.userId !== req.user?._id) {
      return res.status(403).json({ ok: false, error: 'Not authorized to return this order' });
    }
    
    // Check if order is eligible for return
    if (order.status !== 'delivered') {
      return res.status(400).json({ ok: false, error: 'Order must be delivered to request return' });
    }
    
    // Calculate total amount
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    
    // Create return request
    const ret = await Return.create({
      orderId: order._id,
      userId: req.user._id,
      items,
      totalAmount,
      reason,
      status: 'requested',
      refundMethod: 'original', // Default to original payment method
      refundAmount: totalAmount,
      refundStatus: 'pending'
    });
    
    // Update order with return request info
    order.returnRequested = true;
    order.returnRequestedAt = new Date();
    await order.save();
    
    res.status(201).json({ ok: true, item: ret });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// Get returns for current user
app.get('/api/my/returns', async (req, res) => {
  try {
    const items = await Return.find({ userId: req.user?._id }).sort({ createdAt: -1 }).lean();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// New endpoint for rating an order
app.post('/api/orders/rate', async (req, res) => {
  const ratingsEnabled = await isVisibilityEnabled('featureFlags', 'rating');
  if (!ratingsEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  try {
    const { orderId, rating, review } = req.body || {};
    
    // Validate input
    if (!orderId) {
      return res.status(400).json({ ok: false, error: 'Order ID is required' });
    }
    
    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ ok: false, error: 'Rating must be between 1 and 5' });
    }
    
    // Check if order exists and belongs to user
    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    
    // Check if user owns the order
    if (order.userId !== req.user?._id) {
      return res.status(403).json({ ok: false, error: 'Not authorized to rate this order' });
    }
    
    // Check if order is eligible for rating (must be delivered)
    if (order.status !== 'delivered') {
      return res.status(400).json({ ok: false, error: 'Order must be delivered to rate' });
    }
    
    // Import OrderRating model
    const { default: OrderRating } = await import('./models/OrderRating.js');
    
    // Check if user already rated this order
    const existingRating = await OrderRating.findOne({ order: orderId, user: req.user?._id });
    if (existingRating) {
      return res.status(400).json({ ok: false, error: 'You have already rated this order' });
    }
    
    // Create order rating
    const orderRating = await OrderRating.create({
      order: orderId,
      user: req.user?._id,
      rating,
      review: review || ''
    });
    
    res.status(201).json({ ok: true, item: orderRating });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Test email service
app.post('/api/email/test', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ ok: false, error: 'Email address is required' });
    }
    
    const emailService = (await import('./services/emailService.js')).default;
    const result = await emailService.sendTestEmail(email);
    
    if (result.success) {
      return res.json({ ok: true, message: 'Test email sent successfully', messageId: result.messageId });
    } else {
      return res.status(400).json({ ok: false, error: result.error });
    }
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Bulk send emails to multiple orders
app.post('/api/orders/bulk/email', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { orderIds, emailType } = req.body || {};
    
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
      return res.status(400).json({ ok: false, error: 'Order IDs array is required' });
    }
    
    if (!['confirmation', 'shipped', 'delivered'].includes(emailType)) {
      return res.status(400).json({ ok: false, error: 'Invalid email type' });
    }
    
    const results = await orderEmailService.sendBulkOrderEmails(orderIds, emailType);
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    return res.json({ 
      ok: true, 
      message: `Bulk email operation completed: ${successful} successful, ${failed} failed`,
      results,
      summary: { successful, failed, total: results.length }
    });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Public order tracking (no authentication required)
app.get('/api/orders/track', async (req, res) => {
  try {
    const { orderNumber, email } = req.query;
    
    if (!orderNumber || !email) {
      return res.status(400).json({ ok: false, error: 'Order number and email are required' });
    }
    
    // Find order by order number
    const order = await Order.findOne({ orderNumber: String(orderNumber) }).lean();
    
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    
    // Get customer info to verify email
    const customer = await User.findById(order.userId).select('email').lean();
    
    // Verify email matches (case insensitive)
    if (!customer || customer.email.toLowerCase() !== String(email).toLowerCase()) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }
    
    // Return limited order information for public tracking
    const publicOrderData = {
      orderNumber: order.orderNumber,
      status: order.status,
      createdAt: order.createdAt,
      estimatedDelivery: order.estimatedDelivery,
      total: order.total,
      items: order.items.map(item => ({
        product: {
          nameAr: item.product?.nameAr || 'منتج',
          image: item.product?.image
        },
        quantity: item.quantity,
        price: item.price
      })),
      shippingAddress: {
        city: order.shippingAddress?.city || '',
        country: order.shippingAddress?.country || ''
      },
      trackingNumber: order.trackingNumber
    };
    
    return res.json({ ok: true, item: publicOrderData });
  } catch (error) {
    console.error('Public order tracking error:', error);
    return res.status(500).json({ ok: false, error: 'Internal server error' });
  }
});

// Users list and update
app.get('/api/users', requirePermission('users', 'read', { attach: true }), async (req, res) => {
  const { page = 1, limit = 20, role, isActive, search } = req.query;
  const q = {};
  if (role) q.role = role;
  if (isActive !== undefined) q.isActive = isActive === 'true';
  if (search) {
    q.$or = [
      { email: { $regex: String(search), $options: 'i' } },
      { firstName: { $regex: String(search), $options: 'i' } },
      { lastName: { $regex: String(search), $options: 'i' } },
    ];
  }
  const skip = (Number(page) - 1) * Number(limit);
  const [items, total] = await Promise.all([
    User.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
    User.countDocuments(q),
  ]);
  res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
});

// Upsert a user by email (used for Firebase-authenticated users)
// Do NOT protect this endpoint with RBAC; it's used by login flows to upsert the user and obtain an id
app.post('/api/users/sync', async (req, res) => {
  try {
    const { email, firstName, lastName, phone } = req.body || {};
    if (!email) return res.status(400).json({ ok: false, error: 'email is required' });
    let user = await User.findOne({ email });
    if (!user) {
      // Create with a placeholder password since schema requires it (demo only)
      user = await User.create({
        email,
        password: 'oauth',
        firstName: firstName || '',
        lastName: lastName || '',
        phone: phone || '',
        role: 'customer',
        isActive: true,
      });
    } else {
      // Update basic profile fields if changed
      const updates = {};
      if (typeof firstName === 'string' && firstName !== user.firstName) updates.firstName = firstName;
      if (typeof lastName === 'string' && lastName !== user.lastName) updates.lastName = lastName;
      if (typeof phone === 'string' && phone !== user.phone) updates.phone = phone;
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        user = await User.findById(user._id);
      }
    }
    return res.json({ ok: true, user: { id: String(user._id), email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, isActive: user.isActive } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.patch('/api/users/:id', requirePermission('users', 'update', { attach: true }), async (req, res) => {
  try {
    const allowed = {};
    if (typeof req.body.isActive === 'boolean') allowed.isActive = req.body.isActive;
    if (typeof req.body.role === 'string') allowed.role = req.body.role;
    const updated = await User.findByIdAndUpdate(req.params.id, allowed, { new: true });
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    res.json({ ok: true, item: updated });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// --- Minimal Auth (demo only) ---
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
    const exists = await User.findOne({ email }).lean();
    if (exists) return res.status(400).json({ ok: false, error: 'Email already used' });
    const user = await User.create({ email, password, firstName, lastName, phone, role: 'customer', isActive: true });
    return res.status(201).json({ ok: true, user: { id: String(user._id), email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, isActive: user.isActive } });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ ok: false, error: 'email and password required' });
    const user = await User.findOne({ email }).lean();
    if (!user || user.password !== password || !user.isActive) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } });
    return res.json({ ok: true, user: { id: String(user._id), email: user.email, firstName: user.firstName, lastName: user.lastName, phone: user.phone, role: user.role, isActive: user.isActive } });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Favorites ---
app.get('/api/users/:id/favorites', async (req, res) => {
  const favoritesEnabled = await isVisibilityEnabled('featureFlags', 'favorites');
  if (!favoritesEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  const user = await User.findById(req.params.id).lean();
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  return res.json({ ok: true, items: user.favorites || [] });
});

app.post('/api/users/:id/favorites/:productId', async (req, res) => {
  const favoritesEnabled = await isVisibilityEnabled('featureFlags', 'favorites');
  if (!favoritesEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  const { id, productId } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  if (!user.favorites.includes(productId)) user.favorites.push(productId);
  await user.save();
  return res.json({ ok: true, items: user.favorites });
});

app.delete('/api/users/:id/favorites/:productId', async (req, res) => {
  const favoritesEnabled = await isVisibilityEnabled('featureFlags', 'favorites');
  if (!favoritesEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  const { id, productId } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  user.favorites = (user.favorites || []).filter((p) => String(p) !== String(productId));
  await user.save();
  return res.json({ ok: true, items: user.favorites });
});

app.delete('/api/users/:id/favorites', async (req, res) => {
  const favoritesEnabled = await isVisibilityEnabled('featureFlags', 'favorites');
  if (!favoritesEnabled) return res.status(404).json({ ok: false, error: 'Not found' });
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  user.favorites = [];
  await user.save();
  return res.json({ ok: true, items: [] });
});

// --- Cart ---
app.get('/api/users/:id/cart', async (req, res) => {
  const user = await User.findById(req.params.id).lean();
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  return res.json({ ok: true, items: user.cart || [] });
});

app.post('/api/users/:id/cart', async (req, res) => {
  const { productId, product, quantity, price } = req.body || {};
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  const existing = user.cart.find((i) => String(i.productId) === String(productId));
  if (existing) {
    existing.quantity += Number(quantity || 1);
    existing.subtotal = existing.quantity * (existing.price || price || 0);
  } else {
    const q = Number(quantity || 1);
    const p = Number(price || (product && product.price) || 0);
    user.cart.push({ productId, product, quantity: q, price: p, subtotal: q * p });
  }
  await user.save();
  return res.json({ ok: true, items: user.cart });
});

app.patch('/api/users/:id/cart/:productId', async (req, res) => {
  const { quantity } = req.body || {};
  const { id, productId } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  const item = user.cart.find((i) => String(i.productId) === String(productId));
  if (!item) return res.status(404).json({ ok: false, error: 'Item not found' });
  item.quantity = Number(quantity);
  item.subtotal = item.quantity * item.price;
  await user.save();
  return res.json({ ok: true, items: user.cart });
});

app.delete('/api/users/:id/cart/:productId', async (req, res) => {
  const { id, productId } = req.params;
  const user = await User.findById(id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  user.cart = (user.cart || []).filter((i) => String(i.productId) !== String(productId));
  await user.save();
  return res.json({ ok: true, items: user.cart });
});

app.delete('/api/users/:id/cart', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ ok: false, error: 'User not found' });
  user.cart = [];
  await user.save();
  return res.json({ ok: true, items: [] });
});

// --- Settings (persistent single document) ---
app.get('/api/settings', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: 'Database not connected yet' });
    }
    
    let doc = await Settings.findOne().lean();
    if (!doc) {
      doc = (await Settings.create({})).toObject();
    }
    return sendJsonWithEtag(req, res, { ok: true, item: sanitizeSettingsDoc(doc) });
  } catch (err) {
    console.error('❌ Error fetching settings:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/settings', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: 'Database not connected yet' });
    }
    
    // Admin authorization: accept EITHER static secret header OR authenticated admin user
    const hdr = req.header('x-admin-secret') || '';
    const hasValidSecret = process.env.ADMIN_SECRET && hdr === process.env.ADMIN_SECRET;
    const hasValidUser = req.user && req.user._id;
    if (!hasValidSecret && !hasValidUser) {
      return res.status(403).json({ ok: false, error: 'Admin authentication required' });
    }
    const body = req.body || {};
    const payload = {};
    if (body.storeInfo && typeof body.storeInfo === 'object') payload.storeInfo = body.storeInfo;
    if (body.aboutUsContent && typeof body.aboutUsContent === 'object') payload.aboutUsContent = body.aboutUsContent;
    if (body.workHours && typeof body.workHours === 'object') payload.workHours = body.workHours;
    if (Array.isArray(body.locations)) payload.locations = body.locations;
    if (body.social && typeof body.social === 'object') {
      // Auto-generate Messenger link from Facebook page URL
      const social = { ...body.social };
      if (social.messengerUrl) {
        // If it's a Facebook page URL, extract page ID and generate Messenger link
        if (social.messengerUrl.includes('facebook.com')) {
          // Extract page ID from URL: https://www.facebook.com/yourpage or https://facebook.com/123456
          const match = social.messengerUrl.match(/facebook\.com\/([^/?]+)/);
          if (match && match[1]) {
            const pageId = match[1];
            // Generate Messenger link
            social.messengerUrl = `https://m.me/${pageId}`;
          }
        }
        // If it's already a page ID (digits only), generate Messenger link
        else if (/^\d+$/.test(social.messengerUrl)) {
          social.messengerUrl = `https://m.me/${social.messengerUrl}`;
        }
        // If it's already a Messenger link, keep it as is
      }
      payload.social = social;
    }
    if (body.logo && typeof body.logo === 'object') payload.logo = body.logo;
    if (body.theme && typeof body.theme === 'object') {
      payload.theme = body.theme;
    }
    if (body.shopBuilderDefaults && typeof body.shopBuilderDefaults === 'object') {
      payload.shopBuilderDefaults = body.shopBuilderDefaults;
    }
    if (body.pricingSettings && typeof body.pricingSettings === 'object') {
      payload.pricingSettings = body.pricingSettings;
    }
    if (body.checkoutEnabled !== undefined) payload.checkoutEnabled = body.checkoutEnabled;
    if (body.shippingCost !== undefined) payload.shippingCost = body.shippingCost;
    if (body.expressShippingCost !== undefined) payload.expressShippingCost = body.expressShippingCost;
    if (body.freeShippingThreshold !== undefined) payload.freeShippingThreshold = body.freeShippingThreshold;
    if (body.taxRate !== undefined) payload.taxRate = body.taxRate;
    const updated = await Settings.findOneAndUpdate({}, payload, { new: true, upsert: true, setDefaultsOnInsert: true });
    // log
    await logHistory(req, {
      section: 'Settings',
      action: 'Updated settings',
      level: 'info',
      important: true,
      details: 'Global settings were updated',
      meta: { keys: Object.keys(payload || {}) },
    });
    return res.json({ ok: true, item: sanitizeSettingsDoc(updated) });
  } catch (err) {
    console.error('❌ Error saving settings:', err);
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- 3D Products Categories ---
app.get('/api/products-3d-categories', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: 'Database not connected yet' });
    }
    
    let settings = await Settings.findOne().lean();
    if (!settings) {
      settings = await Settings.create({});
    }
    
    const categories = settings.products3DCategories || ['أثاث', 'أجهزة', 'إضاءة', 'ديكور', 'أخرى'];
    return res.json({ ok: true, categories });
  } catch (err) {
    console.error('❌ Error loading 3D categories:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/products-3d-categories', async (req, res) => {
  try {
    // Check if MongoDB is connected
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({ ok: false, error: 'Database not connected yet' });
    }
    
    const { categories } = req.body;
    
    if (!Array.isArray(categories)) {
      return res.status(400).json({ ok: false, error: 'Categories must be an array' });
    }
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({ products3DCategories: categories });
    } else {
      settings.products3DCategories = categories;
      await settings.save();
    }
    
    console.log('✅ 3D Categories saved:', categories);
    return res.json({ ok: true, categories: settings.products3DCategories });
  } catch (err) {
    console.error('❌ Error saving 3D categories:', err);
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- Profit Settings (persistent single document) ---
app.get('/api/profit-settings', requirePermission('settings', 'read', { attach: true }), async (req, res) => {
  try {
    let doc = await ProfitSettings.findOne().lean();
    if (!doc) {
      doc = await ProfitSettings.create({});
    }
    return res.json({ ok: true, item: doc });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.put('/api/profit-settings', requirePermission('settings', 'update', { attach: true }), async (req, res) => {
  try {
    const body = req.body || {};
    const payload = {};

    if (!Object.keys(body).length) {
      console.warn('⚠️ Profit settings PUT received empty payload');
    }
    
    // Update allowed fields
    if (body.profitMargin !== undefined) payload.profitMargin = Number(body.profitMargin);
    if (body.taxRate !== undefined) payload.taxRate = Number(body.taxRate);
    if (body.shippingCost !== undefined) payload.shippingCost = Number(body.shippingCost);
    if (body.otherExpenses !== undefined) payload.otherExpenses = Number(body.otherExpenses);
    if (body.currency !== undefined) payload.currency = String(body.currency);
    if (body.notes !== undefined) payload.notes = String(body.notes);
    
    // Add support for global branches, expenses, shareholders, share history, expense types, and cash breakdown
    if (body.globalBranches !== undefined) payload.globalBranches = body.globalBranches;
    if (body.globalExpenses !== undefined) payload.globalExpenses = body.globalExpenses;
    if (body.shareholders !== undefined) payload.shareholders = body.shareholders;
    if (body.shareHistory !== undefined) payload.shareHistory = body.shareHistory;
    if (body.expenseTypes !== undefined) payload.expenseTypes = body.expenseTypes;
    if (body.cashBreakdown !== undefined) payload.cashBreakdown = body.cashBreakdown;
    
    const updated = await ProfitSettings.findOneAndUpdate({}, payload, { 
      new: true, 
      upsert: true, 
      setDefaultsOnInsert: true 
    });
    
    // Log the update
    await logHistory(req, {
      section: 'ProfitSettings',
      action: 'Updated profit settings',
      level: 'info',
      important: true,
      details: 'Profit calculation settings were updated',
      meta: { keys: Object.keys(payload || {}) },
    });
    
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- Roles CRUD ---
app.get('/api/roles', requirePermission('roles', 'read', { attach: true }), async (req, res) => {
  try {
    const roles = await Role.find({}).sort({ name: 1 }).lean();
    return res.json({ ok: true, items: roles });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/roles', requirePermission('roles', 'create', { attach: true }), async (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};
    if (!name) {
      return res.status(400).json({ ok: false, error: 'Role name is required' });
    }
    
    const role = await Role.create({
      name: String(name).trim(),
      description: String(description || '').trim(),
      permissions: Array.isArray(permissions) ? permissions : []
    });
    
    return res.status(201).json({ ok: true, role });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/roles/:id', requirePermission('roles', 'update', { attach: true }), async (req, res) => {
  try {
    const { name, description, permissions } = req.body || {};
    const updateData = {};
    
    if (name !== undefined) updateData.name = String(name).trim();
    if (description !== undefined) updateData.description = String(description || '').trim();
    if (permissions !== undefined) updateData.permissions = Array.isArray(permissions) ? permissions : [];
    
    const role = await Role.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    );
    
    if (!role) {
      return res.status(404).json({ ok: false, error: 'Role not found' });
    }
    
    return res.json({ ok: true, role });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/roles/:id', requirePermission('roles', 'delete', { attach: true }), async (req, res) => {
  try {
    // Check if role is assigned to any users
    const userCount = await UserRole.countDocuments({ roleId: req.params.id });
    if (userCount > 0) {
      return res.status(400).json({ 
        ok: false, 
        error: 'Cannot delete role that is assigned to users. Remove assignments first.' 
      });
    }
    
    const role = await Role.findByIdAndDelete(req.params.id);
    if (!role) {
      return res.status(404).json({ ok: false, error: 'Role not found' });
    }
    
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// --- User-Role Management ---
app.get('/api/user-role/:userId', requirePermission('roles', 'read', { attach: true }), async (req, res) => {
  try {
    const userRoles = await UserRole.find({ userId: req.params.userId }).populate('roleId').lean();
    return res.json({ ok: true, items: userRoles });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/user-role', requirePermission('roles', 'create', { attach: true }), async (req, res) => {
  try {
    const { userId, roleId } = req.body || {};
    if (!userId || !roleId) {
      return res.status(400).json({ ok: false, error: 'userId and roleId are required' });
    }
    
    // Check if user and role exist
    const [user, role] = await Promise.all([
      User.findById(userId).lean(),
      Role.findById(roleId).lean()
    ]);
    
    if (!user) {
      return res.status(404).json({ ok: false, error: 'User not found' });
    }
    
    if (!role) {
      return res.status(404).json({ ok: false, error: 'Role not found' });
    }
    
    // Remove existing roles for this user (optional - can be modified based on requirements)
    // await UserRole.deleteMany({ userId });
    
    // Create new user-role assignment
    const userRole = await UserRole.create({ userId, roleId });
    
    // Clear permission cache for this user
    const { clearUserPermissionCache } = await import('./rbac/permissions.js');
    clearUserPermissionCache(userId);
    
    return res.status(201).json({ ok: true, userRole });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/user-role/:userId/:roleId', requirePermission('roles', 'delete', { attach: true }), async (req, res) => {
  try {
    const { userId, roleId } = req.params;
    const result = await UserRole.deleteOne({ userId, roleId });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({ ok: false, error: 'User-role assignment not found' });
    }
    
    // Clear permission cache for this user
    const { clearUserPermissionCache } = await import('./rbac/permissions.js');
    clearUserPermissionCache(userId);
    
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// --- RBAC Resources (for UI) ---
// Make this endpoint accessible to all users since it's used for UI purposes
app.get('/api/rbac/resources', async (req, res) => {
  try {
    // Define available resources and their actions
    const resources = [
      { name: 'products', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { name: 'categories', actions: ['create', 'read', 'update', 'delete'] },
      { name: 'orders', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { name: 'users', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { name: 'roles', actions: ['create', 'read', 'update', 'delete'] },
      { name: 'branches', actions: ['create', 'read', 'update', 'delete'] },
      { name: 'expenses', actions: ['create', 'read', 'update', 'delete', 'export'] },
      { name: 'reports', actions: ['read', 'export'] },
      { name: 'settings', actions: ['read', 'update'] },
      { name: 'home-config', actions: ['read', 'update'] }
    ];
    
    return res.json({ ok: true, items: resources });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// --- Profit Reports (snapshots) ---
app.get('/api/profit-reports', requirePermission('profit-reports', 'read', { attach: true }), async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    // Build filter from conditions (branches and dateRange)
    let prFilter = {};
    const cond = req.permission?.conditions || {};
    if (Array.isArray(cond.branchIds) && cond.branchIds.length) {
      prFilter.branches = { $in: cond.branchIds };
    }
    if (cond.dateRange?.from || cond.dateRange?.to) {
      prFilter.$and = prFilter.$and || [];
      if (cond.dateRange.from) prFilter.$and.push({ endDate: { $gte: new Date(cond.dateRange.from) } });
      if (cond.dateRange.to) prFilter.$and.push({ startDate: { $lte: new Date(cond.dateRange.to) } });
    }
    const [items, total] = await Promise.all([
      ProfitReport.find(prFilter).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      ProfitReport.countDocuments(prFilter),
    ]);
    return sendJsonWithEtag(req, res, { ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

app.get('/api/profit-reports/:id', requirePermission('profit-reports', 'read', { attach: true }), async (req, res) => {
  try {
    const doc = await ProfitReport.findById(req.params.id).lean();
    if (!doc) return res.status(404).json({ ok: false, error: 'Not found' });
    const cond = req.permission?.conditions || {};
    if (Array.isArray(cond.branchIds) && cond.branchIds.length) {
      const intersects = doc.branches?.some((b) => cond.branchIds.map(String).includes(String(b)));
      if (!intersects) return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    return res.json({ ok: true, item: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.post('/api/profit-reports', requirePermission('profit-reports', 'create', { attach: true }), async (req, res) => {
  try {
    const body = req.body || {};
    const cond = req.permission?.conditions || {};
    if (Array.isArray(cond.branchIds) && cond.branchIds.length) {
      const allAllowed = (body.branches || []).every((b) => cond.branchIds.map(String).includes(String(b)));
      if (!allAllowed) return res.status(403).json({ ok: false, error: 'Branches not allowed' });
    }
    
    // Auto-calculate compareLastMonth before creating
    if (body.totals?.finalBalance !== undefined && body.totals?.lastMonthClosing !== undefined) {
      body.totals.compareLastMonth = body.totals.finalBalance - body.totals.lastMonthClosing;
    }
    
    const doc = await ProfitReport.create(body);
    await logHistory(req, {
      section: 'Profit',
      action: 'Created profit report',
      level: 'info',
      important: true,
      details: `Created profit report for ${req.body?.startDate || ''} – ${req.body?.endDate || ''}`,
      meta: { title: req.body?.title, id: String(doc._id) },
    });
    return res.status(201).json({ ok: true, item: doc });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.put('/api/profit-reports/:id', requirePermission('profit-reports', 'update', { attach: true }), async (req, res) => {
  try {
    const existing = await ProfitReport.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
    const cond = req.permission?.conditions || {};
    if (Array.isArray(cond.branchIds) && cond.branchIds.length) {
      const intersects = existing.branches?.some((b) => cond.branchIds.map(String).includes(String(b)));
      if (!intersects) return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    
    // Auto-calculate compareLastMonth before saving
    if (req.body.totals?.finalBalance !== undefined && req.body.totals?.lastMonthClosing !== undefined) {
      req.body.totals.compareLastMonth = req.body.totals.finalBalance - req.body.totals.lastMonthClosing;
    }
    
    Object.assign(existing, req.body || {});
    if (Array.isArray(cond.branchIds) && cond.branchIds.length) {
      const allAllowed = (existing.branches || []).every((b) => cond.branchIds.map(String).includes(String(b)));
      if (!allAllowed) return res.status(403).json({ ok: false, error: 'Branches not allowed' });
    }
    const updated = await existing.save();
    if (!updated) return res.status(404).json({ ok: false, error: 'Not found' });
    await logHistory(req, {
      section: 'Profit',
      action: 'Updated profit report',
      level: 'info',
      details: `Updated profit report ${req.params.id}`,
      meta: { title: req.body?.title, id: String(updated._id) },
    });
    return res.json({ ok: true, item: updated });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

app.delete('/api/profit-reports/:id', requirePermission('profit-reports', 'delete', { attach: true }), async (req, res) => {
  try {
    const existing = await ProfitReport.findById(req.params.id);
    if (!existing) return res.status(404).json({ ok: false, error: 'Not found' });
    const cond = req.permission?.conditions || {};
    if (Array.isArray(cond.branchIds) && cond.branchIds.length) {
      const intersects = existing.branches?.some((b) => cond.branchIds.map(String).includes(String(b)));
      if (!intersects) return res.status(403).json({ ok: false, error: 'Forbidden' });
    }
    const deleted = await ProfitReport.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ ok: false, error: 'Not found' });
    await logHistory(req, {
      section: 'Profit',
      action: 'Deleted profit report',
      level: 'warning',
      details: `Deleted profit report ${req.params.id}`,
      meta: { id: String(req.params.id) },
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// --- Profit Aggregate (by date range) ---
app.get('/api/profit-aggregate', requirePermission('reports', 'read', { attach: true }), async (req, res) => {
  try {
    const { from, to } = req.query;
    const start = from ? new Date(String(from)) : null;
    const end = to ? new Date(String(to)) : null;
    const match = {};
    if (start) match.date = { ...(match.date || {}), $gte: start };
    if (end) match.date = { ...(match.date || {}), $lte: end };
    const pipeline = [ { $match: match }, { $group: { _id: { branch: '$branch', expenseType: '$expenseType' }, total: { $sum: '$amount' } } } ];
    const rows = await Transaction.aggregate(pipeline);
    const branches = Array.from(new Set(rows.map(r => r._id.branch)));
    const expenses = Array.from(new Set(rows.map(r => r._id.expenseType)));
    const map = {};
    for (const b of branches) map[b] = {};
    for (const r of rows) map[r._id.branch][r._id.expenseType] = r.total;
    return res.json({ ok: true, branches, expenses, map });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// --- 3D Products Management ---
// Get all 3D products
app.get('/api/products-3d', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, search, isActive } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    
    let query = {};
    if (category && category !== 'all') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    if (isActive !== undefined) query.isActive = isActive === 'true';
    
    console.log('🔍 3D Products Query:', query);
    console.log('📄 Pagination:', { page, limit, skip });
    
    const [items, total] = await Promise.all([
      Product3D.find(query).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean(),
      Product3D.countDocuments(query)
    ]);
    
    console.log(`✅ Found ${items.length} products (total: ${total})`);
    console.log('📦 Products:', items.map(p => ({ name: p.name, isActive: p.isActive, category: p.category })));
    
    return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (err) {
    console.error('❌ Error fetching 3D products:', err);
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Get single 3D product
app.get('/api/products-3d/:id', async (req, res) => {
  try {
    const product = await Product3D.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
    return res.json({ ok: true, item: product });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Create 3D product (admin only)
app.post('/api/products-3d', requirePermission('products', 'create', { attach: true }), async (req, res) => {
  try {
    const product = await Product3D.create(req.body);
    await logHistory(req, {
      section: '3D Products',
      action: 'Created 3D product',
      level: 'info',
      important: true,
      details: `Created 3D product: ${req.body.name}`,
      meta: { id: String(product._id), name: req.body.name }
    });
    return res.status(201).json({ ok: true, item: product });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Update 3D product (admin only)
app.put('/api/products-3d/:id', requirePermission('products', 'update', { attach: true }), async (req, res) => {
  try {
    const product = await Product3D.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
    
    await logHistory(req, {
      section: '3D Products',
      action: 'Updated 3D product',
      level: 'info',
      details: `Updated 3D product: ${product.name}`,
      meta: { id: String(product._id), name: product.name }
    });
    
    return res.json({ ok: true, item: product });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Delete 3D product (admin only)
app.delete('/api/products-3d/:id', requirePermission('products', 'delete', { attach: true }), async (req, res) => {
  try {
    const product = await Product3D.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
    
    await logHistory(req, {
      section: '3D Products',
      action: 'Deleted 3D product',
      level: 'warning',
      important: true,
      details: `Deleted 3D product: ${product.name}`,
      meta: { id: String(req.params.id), name: product.name }
    });
    
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Increment usage count
app.post('/api/products-3d/:id/use', async (req, res) => {
  try {
    const product = await Product3D.findByIdAndUpdate(
      req.params.id,
      { $inc: { usageCount: 1 } },
      { new: true }
    );
    if (!product) return res.status(404).json({ ok: false, error: 'Product not found' });
    return res.json({ ok: true, item: product });
  } catch (err) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

// Get categories list
app.get('/api/products-3d/categories/list', async (req, res) => {
  try {
    const categories = await Product3D.distinct('category');
    return res.json({ ok: true, items: categories });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Order Analytics Endpoints
app.get('/api/analytics/orders', requirePermission('analytics', 'read', { attach: true }), async (req, res) => {
  try {
    const { days = 30, interval = 'day' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    
    // Format for MongoDB grouping based on interval
    let dateFormat;
    switch (interval) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%U';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }
    
    // Get order statistics
    const [totalOrders, recentOrders, statusDistribution, revenueStats] = await Promise.all([
      // Total orders
      Order.countDocuments(),
      
      // Recent orders (last N days)
      Order.countDocuments({ createdAt: { $gte: since } }),
      
      // Status distribution
      Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // Revenue statistics
      Order.aggregate([
        { $group: {
            _id: null,
            totalRevenue: { $sum: '$total' },
            avgOrderValue: { $avg: '$total' },
            maxOrderValue: { $max: '$total' },
            minOrderValue: { $min: '$total' }
          } 
        }
      ])
    ]);
    
    // Get orders by date for trend chart
    const ordersByDate = await Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: dateFormat, date: '$createdAt' } },
          count: { $sum: 1 },
          totalRevenue: { $sum: '$total' },
          avgOrderValue: { $avg: '$total' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    // Get top products by sales volume
    const topProducts = await Order.aggregate([
      { $unwind: '$items' },
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: '$items.product.nameAr',
          productId: { $first: '$items.productId' },
          totalQuantity: { $sum: '$items.quantity' },
          totalRevenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          orderCount: { $sum: 1 }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: 10 }
    ]);
    
    res.json({ 
      ok: true, 
      data: {
        totalOrders,
        recentOrders,
        statusDistribution,
        revenueStats: revenueStats[0] || {},
        ordersByDate,
        topProducts
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get order status distribution over time
app.get('/api/analytics/orders/status-trends', requirePermission('analytics', 'read', { attach: true }), async (req, res) => {
  try {
    const { days = 30, interval = 'day' } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    
    // Format for MongoDB grouping based on interval
    let dateFormat;
    switch (interval) {
      case 'hour':
        dateFormat = '%Y-%m-%d %H:00';
        break;
      case 'day':
        dateFormat = '%Y-%m-%d';
        break;
      case 'week':
        dateFormat = '%Y-%U';
        break;
      case 'month':
        dateFormat = '%Y-%m';
        break;
      default:
        dateFormat = '%Y-%m-%d';
    }
    
    // Get status trends over time
    const statusTrends = await Order.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: {
            date: { $dateToString: { format: dateFormat, date: '$createdAt' } },
            status: '$status'
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.date': 1, '_id.status': 1 } }
    ]);
    
    res.json({ ok: true, data: statusTrends });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get customer analytics
app.get('/api/analytics/customers', requirePermission('analytics', 'read', { attach: true }), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    
    // Get customer statistics
    const [totalCustomers, newCustomers, activeCustomers] = await Promise.all([
      // Total customers
      User.countDocuments({ role: 'customer' }),
      
      // New customers (last N days)
      User.countDocuments({ 
        role: 'customer',
        createdAt: { $gte: since }
      }),
      
      // Active customers (customers with orders in last N days)
      Order.distinct('userId', { 
        createdAt: { $gte: since }
      }).then(userIds => userIds.length)
    ]);
    
    res.json({ 
      ok: true, 
      data: {
        totalCustomers,
        newCustomers,
        activeCustomers
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Return Analytics Endpoint
app.get('/api/analytics/returns', requirePermission('analytics', 'read', { attach: true }), async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const since = new Date();
    since.setDate(since.getDate() - Number(days));
    
    // Get return statistics
    const [totalReturns, recentReturns, statusDistribution, refundStats] = await Promise.all([
      // Total returns
      Return.countDocuments(),
      
      // Recent returns (last N days)
      Return.countDocuments({ createdAt: { $gte: since } }),
      
      // Status distribution
      Return.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      
      // Refund statistics
      Return.aggregate([
        { $group: {
            _id: null,
            totalRefundAmount: { $sum: '$refundAmount' },
            avgRefundAmount: { $avg: '$refundAmount' },
            completedRefunds: { 
              $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, 1, 0] } 
            }
          } 
        }
      ])
    ]);
    
    // Get returns by date for trend chart
    const returnsByDate = await Return.aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    
    res.json({ 
      ok: true, 
      data: {
        totalReturns,
        recentReturns,
        statusDistribution,
        refundStats: refundStats[0] || {},
        returnsByDate
      }
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Payment endpoints
import paymentService from './services/paymentService.js';

// Process payment for an order
app.post('/api/orders/:id/payment', async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    const { paymentMethod, paymentDetails } = req.body || {};
    
    const paymentResult = await paymentService.processPayment({
      orderId: order._id,
      paymentMethod: paymentMethod || order.paymentMethod,
      total: order.total
    }, paymentDetails);

    if (paymentResult.success) {
      return res.json({ 
        ok: true, 
        payment: paymentResult,
        message: 'Payment processed successfully'
      });
    } else {
      return res.status(400).json({ 
        ok: false, 
        error: paymentResult.error || 'Payment failed'
      });
    }
  } catch (err) {
    console.error('Payment processing error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Get supported payment methods
app.get('/api/payment/methods', async (req, res) => {
  try {
    const methods = paymentService.getSupportedMethods();
    res.json({ ok: true, ...methods });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Process refund
app.post('/api/orders/:id/refund', requirePermission('orders', 'update', { attach: true }), async (req, res) => {
  try {
    const { amount, reason } = req.body || {};
    
    if (!amount || amount <= 0) {
      return res.status(400).json({ ok: false, error: 'Invalid refund amount' });
    }

    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ ok: false, error: 'Order not found' });
    }

    if (amount > order.total) {
      return res.status(400).json({ ok: false, error: 'Refund amount exceeds order total' });
    }

    const refundResult = await paymentService.processRefund(req.params.id, amount, reason);

    if (refundResult.success) {
      await logHistory(req, {
        section: 'orders',
        action: 'refund_processed',
        note: `Refund of ${amount} processed for order ${order.orderNumber}`,
        meta: { orderId: order._id.toString(), amount, reason }
      });

      return res.json({ 
        ok: true, 
        refund: refundResult,
        message: 'Refund processed successfully'
      });
    } else {
      return res.status(400).json({ 
        ok: false, 
        error: refundResult.error || 'Refund failed'
      });
    }
  } catch (err) {
    console.error('Refund processing error:', err);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Verify payment status
app.get('/api/payment/:transactionId/verify', async (req, res) => {
  try {
    const result = await paymentService.verifyPayment(req.params.transactionId);
    res.json({ ok: true, ...result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// Initialize order automation on server start
if (process.env.ENABLE_ORDER_AUTOMATION !== 'false') {
  orderAutomationService.startAutomation();
  console.log('✅ Order automation service enabled');
}

const PORT = process.env.PORT || 4000;
let __serverStarted = false;
const safeListen = () => {
  if (__serverStarted) return;
  __serverStarted = true;
  app.listen(PORT, () => console.log(`Server listening on http://localhost:${PORT}`));
};

// --- Helpers: history logging ---
const getReqUser = async (req) => {
  try {
    const userId = req.header('x-user-id') || req.query.userId;
    if (userId) {
      const u = await User.findById(userId).select('firstName lastName email').lean();
      if (u) return { id: String(u._id), email: u.email, name: [u.firstName, u.lastName].filter(Boolean).join(' ').trim() };
    }
    const email = req.header('x-user-email');
    if (email) return { email };
  } catch {}
  return {};
};

export const logHistory = async (req, { section, action, details, note, level = 'info', important = true, meta = {} }) => {
  try {
    const u = await getReqUser(req);
    const payload = {
      section,
      action,
      note,
      details,
      level,
      important,
      meta: { ...meta, username: meta.username || u.name },
    };
    if (u.id) payload.userId = u.id;
    if (u.email) payload.userEmail = u.email;
    await History.create(payload);
  } catch (err) {
    console.error('logHistory failed', err?.message || err);
  }
};

if (mongoose.connection.readyState === 1) {
  safeListen();
  // Start order automation service
  orderAutomationService.startAutomation();
} else {
  mongoose.connection.once('open', () => {
    safeListen();
    // Start order automation service
    orderAutomationService.startAutomation();
  });
  mongoose.connection.on('error', (err) => {
    console.error('Mongo connection error:', err?.message || err);
  });
  // Fallback: start HTTP server even if Mongo hasn't connected after N ms
  const fallbackMs = Number(process.env.SERVER_LISTEN_FALLBACK_MS || 15000);
  setTimeout(() => {
    if (!__serverStarted) {
      console.warn(`Mongo not connected after ${fallbackMs}ms; starting HTTP server anyway.`);
      safeListen();
      // Start order automation service
      orderAutomationService.startAutomation();
    }
  }, fallbackMs);
}
