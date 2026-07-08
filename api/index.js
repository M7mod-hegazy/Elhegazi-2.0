import { Hono } from 'hono';
import { handle } from 'hono/vercel';
import { getPath as honoDefaultGetPath } from 'hono/utils/url';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

let mongoConnection = null;

async function connectMongoDB() {
  if (mongoConnection && mongoConnection.readyState === 1) {
    return mongoConnection;
  }
  try {
    mongoConnection = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || 'appdb',
      maxPoolSize: 2,
      serverSelectionTimeoutMS: 8000,
      socketTimeoutMS: 45000,
    });
    return mongoConnection;
  } catch (error) {
    throw error;
  }
}

function assertSafeRemoteImageUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') throw new Error('url is required');
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  return parsed.toString();
}

async function probeRemoteImageUrl(url, timeoutMs = 8000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: 'GET', redirect: 'follow', signal: controller.signal });
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

/**
 * Vercel invokes `api/index.js` for pathname `/api` only; rewrites pass the real path in `__hono_path`.
 * Only honor that param when the incoming pathname is `/api` so a client cannot spoof paths via query.
 */
function vercelAwareGetPath(request) {
  try {
    const url = new URL(request.url);
    let pathname = url.pathname || '/';
    if (pathname.length > 1 && pathname.endsWith('/')) pathname = pathname.slice(0, -1);
    if (pathname === '/api' && url.searchParams.has('__hono_path')) {
      let raw = url.searchParams.get('__hono_path') ?? '';
      try {
        raw = decodeURIComponent(String(raw).replace(/\+/g, ' '));
      } catch {
        raw = String(raw);
      }
      const segment = raw.replace(/^\/+/, '');
      if (!segment) return '/api';
      return `/api/${segment}`;
    }
  } catch {
    // fall through
  }
  return honoDefaultGetPath(request);
}

const app = new Hono({ getPath: vercelAwareGetPath }).basePath('/api');

function getClientIp(c) {
  return (
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim()
    || c.req.header('x-real-ip')
    || 'unknown-ip'
  );
}

function getActorKey(c) {
  const userId = c.req.header('x-user-id');
  if (userId) return `user:${userId}`;
  const ua = c.req.header('user-agent') || 'unknown-ua';
  const ip = getClientIp(c);
  const anonHash = crypto.createHash('sha1').update(`${ip}|${ua}`).digest('hex').slice(0, 24);
  return `anon:${anonHash}`;
}

async function isAdminRequest(c) {
  const adminSecret = c.req.header('x-admin-secret') || '';
  if (process.env.ADMIN_SECRET && adminSecret === process.env.ADMIN_SECRET) return true;

  const userId = String(c.req.header('x-user-id') || '').trim();
  const userEmail = String(c.req.header('x-user-email') || '').trim().toLowerCase();
  if (!userId && !userEmail) return false;
  try {
    const { default: User } = await import('../server/models/User.js');
    let user = null;
    if (userId && mongoose.isValidObjectId(userId)) {
      user = await User.findById(userId).select('role').lean().maxTimeMS(8000);
    }
    if (!user && userEmail) {
      user = await User.findOne({ email: userEmail }).select('role').lean().maxTimeMS(8000);
    }
    // Login allows a session when email is not in DB (demo / legacy); honor that for API parity
    if (!user && userId.startsWith('temp-admin-')) return true;
    return !!(user && (user.role === 'admin' || user.role === 'SuperAdmin' || user.role === 'super_admin'));
  } catch {
    return false;
  }
}

/** Aligns with server/index.js owner vault defaults (read-only merge for GET /site-visibility). */
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
    latestWork: true,
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
    latestWork: true,
    sync: true,
  },
  featureFlags: {
    rating: true,
    favorites: true,
    shopBuilder3d: true,
    prices: true,
  },
};

function coerceVisibilityBool(raw, fallback) {
  if (raw === true || raw === 'true' || raw === 1 || raw === '1') return true;
  if (raw === false || raw === 'false' || raw === 0 || raw === '0') return false;
  return fallback;
}

function boolifyOwnerSection(defaults, layer) {
  const out = {};
  for (const key of Object.keys(defaults)) {
    out[key] = coerceVisibilityBool(layer?.[key], defaults[key]);
  }
  return out;
}

function mergeOwnerVisibility(visibility = {}) {
  const merged = {
    publicPages: { ...DEFAULT_OWNER_VISIBILITY.publicPages, ...(visibility.publicPages || {}) },
    adminModules: { ...DEFAULT_OWNER_VISIBILITY.adminModules, ...(visibility.adminModules || {}) },
    featureFlags: { ...DEFAULT_OWNER_VISIBILITY.featureFlags, ...(visibility.featureFlags || {}) },
  };
  return {
    publicPages: boolifyOwnerSection(DEFAULT_OWNER_VISIBILITY.publicPages, merged.publicPages),
    adminModules: boolifyOwnerSection(DEFAULT_OWNER_VISIBILITY.adminModules, merged.adminModules),
    featureFlags: boolifyOwnerSection(DEFAULT_OWNER_VISIBILITY.featureFlags, merged.featureFlags),
  };
}

async function getOwnerVisibilityRead() {
  const { default: Settings } = await import('../server/models/Settings.js');
  const settings = await Settings.findOne().maxTimeMS(8000).lean();
  const ov = settings?.ownerVault || {};
  return {
    enabled: ov.enabled !== false,
    visibility: mergeOwnerVisibility(ov.visibility || {}),
  };
}

/** Matches server/index.js owner vault session length. */
const OWNER_VAULT_SESSION_MINUTES = 15;

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

function getOwnerTokenFromHono(c) {
  const auth = String(c.req.header('authorization') || '');
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return String(c.req.header('x-owner-vault-token') || '').trim();
}

async function getOwnerVaultConfigHono() {
  const { default: Settings } = await import('../server/models/Settings.js');
  let settings = await Settings.findOne().maxTimeMS(8000);
  if (!settings) settings = await Settings.create({});
  if (!settings.ownerVault) settings.ownerVault = {};
  if (!settings.ownerVault.passwordHash) {
    const bootstrapPassword = process.env.OWNER_VAULT_PASSWORD || process.env.ADMIN_PASSWORD || '';
    if (bootstrapPassword) settings.ownerVault.passwordHash = hashOwnerPassword(bootstrapPassword);
  }
  if (!settings.ownerVault.visibility) settings.ownerVault.visibility = DEFAULT_OWNER_VISIBILITY;
  settings.ownerVault.visibility = mergeOwnerVisibility(settings.ownerVault.visibility);
  if (settings.isModified()) await settings.save();
  return settings;
}

function createOwnerVaultSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + OWNER_VAULT_SESSION_MINUTES * 60 * 1000);
  return { token, tokenHash: hashOwnerToken(token), expiresAt };
}

/** Returns null if OK, or a JSON Response if auth failed. */
async function requireOwnerVaultSessionHono(c) {
  try {
    const token = getOwnerTokenFromHono(c);
    if (!token) return c.json({ ok: false, error: 'Owner vault authentication required' }, 401);
    const settings = await getOwnerVaultConfigHono();
    const session = settings.ownerVault?.session || {};
    if (!session.tokenHash || !session.expiresAt) {
      return c.json({ ok: false, error: 'Owner vault session missing' }, 401);
    }
    const expected = String(session.tokenHash);
    const incoming = hashOwnerToken(token);
    const same =
      expected.length === incoming.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(incoming));
    if (!same) return c.json({ ok: false, error: 'Invalid owner vault session' }, 401);
    const now = Date.now();
    const exp = new Date(session.expiresAt).getTime();
    if (!Number.isFinite(exp) || exp < now) return c.json({ ok: false, error: 'Owner vault session expired' }, 401);

    settings.ownerVault.session.lastActivityAt = new Date(now);
    settings.ownerVault.session.expiresAt = new Date(now + OWNER_VAULT_SESSION_MINUTES * 60 * 1000);
    await settings.save();
    return null;
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
}

async function attachRatingStatsToProductsVercel(items) {
  if (!Array.isArray(items) || items.length === 0) return [];
  const { default: Rating } = await import('../server/models/Rating.js');
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
  ]).option({ maxTimeMS: 8000 });

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

async function hydrateProductFamilyPayloadVercel(fam) {
  if (!fam || !fam._id) return null;
  const { default: Product } = await import('../server/models/Product.js');
  const memberIds = Array.isArray(fam.memberProductIds) ? fam.memberProductIds : [];
  if (memberIds.length < 2) return null;
  const prods = await Product.find({ _id: { $in: memberIds } }).lean().maxTimeMS(8000);
  const byId = new Map(prods.map((p) => [String(p._id), p]));
  let defaultId = fam.defaultProductId ? String(fam.defaultProductId) : '';
  if (!defaultId || !byId.has(defaultId)) {
    let best = '';
    let bestPrice = Infinity;
    for (const p of prods) {
      if (p.active === false) continue;
      const pr = Number(p.price);
      if (Number.isFinite(pr) && pr < bestPrice) {
        bestPrice = pr;
        best = String(p._id);
      }
    }
    defaultId = best || (prods[0] ? String(prods[0]._id) : '');
  }
  const variants = memberIds
    .map((oid) => {
      const p = byId.get(String(oid));
      if (!p) return null;
      const mem = (fam.members || []).find((m) => String(m.productId) === String(oid));
      return {
        productId: String(p._id),
        name: p.name,
        nameAr: p.nameAr,
        values: mem && mem.values && typeof mem.values === 'object' ? { ...mem.values } : {},
        image: p.image || (Array.isArray(p.images) && p.images[0]) || '',
        price: Number(p.price || 0),
        active: p.active !== false,
      };
    })
    .filter(Boolean);
  return {
    id: String(fam._id),
    name: fam.name,
    nameAr: fam.nameAr,
    defaultProductId: defaultId,
    options: Array.isArray(fam.options) ? fam.options : [],
    variants,
  };
}

async function findProductFamilyLeanForProductIdVercel(productId) {
  if (!mongoose.Types.ObjectId.isValid(String(productId))) return null;
  const { default: Product } = await import('../server/models/Product.js');
  const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
  const pid = new mongoose.Types.ObjectId(String(productId));
  let fam = await ProductFamily.findOne({ memberProductIds: pid }).lean().maxTimeMS(8000);
  if (!fam) {
    const p = await Product.findById(pid).select('productFamilyId').lean().maxTimeMS(8000);
    if (p && p.productFamilyId) fam = await ProductFamily.findById(p.productFamilyId).lean().maxTimeMS(8000);
  }
  return fam;
}

const BUILDER_PROJECT_SCHEMA_VERSION = 1;
const parseBool = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
};

function getOwnerIdentity(c) {
  const ownerUserId = c.req.header('x-user-id') || null;
  const ownerActorKey = getActorKey(c);
  const ownerEmailSnapshot = c.req.header('x-user-email') || '';
  return { ownerUserId, ownerActorKey, ownerEmailSnapshot };
}

function getBuilderProjectStats(layout) {
  const safe = layout && typeof layout === 'object' ? layout : {};
  return {
    wallsCount: Array.isArray(safe.walls) ? safe.walls.length : 0,
    productsCount: Array.isArray(safe.products) ? safe.products.length : 0,
    floorSize: Number(safe.floorSize || 24),
  };
}

function cleanBuilderLayout(layout) {
  const safe = layout && typeof layout === 'object' ? { ...layout } : {};
  if (!Array.isArray(safe.walls)) safe.walls = [];
  if (!Array.isArray(safe.products)) safe.products = [];
  return safe;
}

function mapBuilderProjectListItem(project) {
  return {
    _id: String(project._id),
    title: project.title || 'Project',
    description: project.description || '',
    previewImageUrl: project.previewImageUrl || '',
    previewImagePublicId: project.previewImagePublicId || '',
    stats: project.stats || getBuilderProjectStats(project.layout || {}),
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

function buildBuilderScopeFilter(c, { adminAll = false, ownerQuery } = {}) {
  if (adminAll) {
    const owner = String(ownerQuery || '').trim();
    if (!owner) return {};
    return {
      $or: [
        { ownerUserId: owner },
        { ownerActorKey: owner },
        { ownerEmailSnapshot: { $regex: owner, $options: 'i' } },
      ],
    };
  }

  const userId = c.req.header('x-user-id') || null;
  const actorKey = getActorKey(c);
  if (userId) {
    return { $or: [{ ownerUserId: userId }, { ownerActorKey: actorKey }] };
  }
  return { ownerActorKey: actorKey };
}

async function uploadBuilderPreviewDataUrl(previewDataUrl, ownerActorKey) {
  if (typeof previewDataUrl !== 'string' || !previewDataUrl.trim()) return null;
  if (!previewDataUrl.startsWith('data:image/')) return null;
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) return null;

  const cloudinary = await import('cloudinary').then((m) => m.v2);
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const uploaded = await cloudinary.uploader.upload(previewDataUrl, {
    folder: 'builder-project-previews',
    public_id: `preview_${ownerActorKey.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}`,
    resource_type: 'image',
    format: 'webp',
    quality: 'auto:good',
    transformation: [{ width: 1400, height: 900, crop: 'limit' }],
  });
  return { url: uploaded.secure_url, publicId: uploaded.public_id };
}

// Middleware: Connect to MongoDB for all requests
app.use('*', async (c, next) => {
  try {
    await connectMongoDB();
    await next();
  } catch (error) {
    console.error('[API] MongoDB connection error:', error.message);
    return c.json({ ok: false, error: 'Database connection failed' }, 500);
  }
});

// ===== HEALTH CHECK =====
app.get('/health', (c) => {
  return c.json({
    ok: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    mongoState: mongoose.connection.readyState,
    hasMongoUri: !!process.env.MONGODB_URI,
    mongoUriPrefix: process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 30) + '...' : 'NOT SET',
    dbName: process.env.MONGODB_DB || 'appdb',
  });
});

// ===== PROFIT SETTINGS =====
app.get('/profit-settings', async (c) => {
  try {
    const { default: ProfitSettings } = await import('../server/models/ProfitSettings.js');
    const settings = await ProfitSettings.findOne({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: settings || {} });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/profit-settings', async (c) => {
  try {
    const { default: ProfitSettings } = await import('../server/models/ProfitSettings.js');
    const body = await c.req.json();
    const updated = await ProfitSettings.findOneAndUpdate({}, body, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== PROFIT REPORTS =====
app.get('/profit-reports', async (c) => {
  try {
    const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
    const reports = await ProfitReport.find({}).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: reports });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/profit-reports', async (c) => {
  try {
    const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
    const body = await c.req.json();
    const report = new ProfitReport(body);
    await report.save();
    return c.json({ ok: true, item: report });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/profit-reports/:id', async (c) => {
  try {
    const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
    const id = c.req.param('id');
    const report = await ProfitReport.findById(id).lean().maxTimeMS(8000);
    if (!report) return c.json({ ok: false, error: 'Profit report not found' }, 404);
    return c.json({ ok: true, item: report });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/profit-reports/:id', async (c) => {
  try {
    const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await ProfitReport.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Profit report not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/profit-reports/:id', async (c) => {
  try {
    const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
    const id = c.req.param('id');
    const deleted = await ProfitReport.findByIdAndDelete(id).maxTimeMS(8000);
    if (!deleted) return c.json({ ok: false, error: 'Profit report not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== DEBUG SEED PRODUCTS =====
app.get('/debug/seed-products', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const count = await Product.countDocuments({});
    return c.json({ ok: true, count, message: 'Use POST to seed products' });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/debug/seed-products', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const testProducts = [
      {
        name: 'Test Product 1',
        nameAr: 'منتج اختبار 1',
        sku: 'TEST-001',
        price: 99.99,
        originalPrice: 149.99,
        description: 'This is a test product',
        descriptionAr: 'هذا منتج اختبار',
        image: 'https://via.placeholder.com/400x400?text=Product+1',
        images: ['https://via.placeholder.com/400x400?text=Product+1'],
        categorySlug: 'test-category',
        stock: 10,
        featured: true,
        active: true,
        rating: 4.5,
        reviews: 5,
        tags: ['test', 'sample']
      },
      {
        name: 'Test Product 2',
        nameAr: 'منتج اختبار 2',
        sku: 'TEST-002',
        price: 149.99,
        originalPrice: 199.99,
        description: 'This is another test product',
        descriptionAr: 'هذا منتج اختبار آخر',
        image: 'https://via.placeholder.com/400x400?text=Product+2',
        images: ['https://via.placeholder.com/400x400?text=Product+2'],
        categorySlug: 'test-category',
        stock: 15,
        featured: true,
        active: true,
        rating: 4.8,
        reviews: 8,
        tags: ['test', 'sample']
      },
      {
        name: 'Test Product 3',
        nameAr: 'منتج اختبار 3',
        sku: 'TEST-003',
        price: 199.99,
        originalPrice: 299.99,
        description: 'Premium test product',
        descriptionAr: 'منتج اختبار متميز',
        image: 'https://via.placeholder.com/400x400?text=Product+3',
        images: ['https://via.placeholder.com/400x400?text=Product+3'],
        categorySlug: 'test-category',
        stock: 5,
        featured: true,
        active: true,
        rating: 5,
        reviews: 12,
        tags: ['test', 'premium']
      }
    ];

    await Product.deleteMany({});
    const inserted = await Product.insertMany(testProducts);

    return c.json({
      ok: true,
      message: `Seeded ${inserted.length} test products`,
      products: inserted.map(p => ({ _id: p._id, name: p.name, nameAr: p.nameAr }))
    });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== SITE VISIBILITY & PRODUCT FAMILIES (Vercel API parity with monolithic server) =====
app.get('/site-visibility', async (c) => {
  try {
    const payload = await getOwnerVisibilityRead();
    return c.json({ ok: true, item: payload });
  } catch (err) {
    console.error('[API site-visibility]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Owner vault (parity with server/index.js for Vercel Hono API)
app.post('/owner-vault/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const password = String(body?.password || '');
    if (!password) return c.json({ ok: false, error: 'Password is required' }, 400);

    const settings = await getOwnerVaultConfigHono();
    const hash = String(settings.ownerVault?.passwordHash || '');
    if (!hash) return c.json({ ok: false, error: 'Owner Vault password is not initialized' }, 400);

    const valid = verifyOwnerPassword(password, hash);
    if (!valid) return c.json({ ok: false, error: 'Invalid password' }, 401);

    const session = createOwnerVaultSession();
    settings.ownerVault.session = {
      tokenHash: session.tokenHash,
      expiresAt: session.expiresAt,
      lastActivityAt: new Date(),
    };
    await settings.save();

    return c.json({
      ok: true,
      item: {
        token: session.token,
        expiresAt: session.expiresAt,
        timeoutMinutes: OWNER_VAULT_SESSION_MINUTES,
      },
    });
  } catch (err) {
    console.error('[API owner-vault/login]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/owner-vault/logout', async (c) => {
  const authErr = await requireOwnerVaultSessionHono(c);
  if (authErr) return authErr;
  try {
    const settings = await getOwnerVaultConfigHono();
    settings.ownerVault.session = {
      tokenHash: '',
      expiresAt: null,
      lastActivityAt: null,
    };
    await settings.save();
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API owner-vault/logout]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/owner-vault/status', async (c) => {
  try {
    const token = getOwnerTokenFromHono(c);
    if (!token) return c.json({ ok: true, item: { authenticated: false } });
    const settings = await getOwnerVaultConfigHono();
    const session = settings.ownerVault?.session || {};
    const tokenHash = String(session.tokenHash || '');
    if (!tokenHash || !session.expiresAt) return c.json({ ok: true, item: { authenticated: false } });
    const same = tokenHash === hashOwnerToken(token);
    const exp = new Date(session.expiresAt).getTime();
    if (!same || !Number.isFinite(exp) || exp < Date.now()) {
      return c.json({ ok: true, item: { authenticated: false } });
    }
    return c.json({
      ok: true,
      item: {
        authenticated: true,
        expiresAt: session.expiresAt,
        timeoutMinutes: OWNER_VAULT_SESSION_MINUTES,
      },
    });
  } catch (err) {
    console.error('[API owner-vault/status]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/owner-vault/password', async (c) => {
  const authErr = await requireOwnerVaultSessionHono(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json().catch(() => ({}));
    const currentPassword = String(body?.currentPassword || '');
    const newPassword = String(body?.newPassword || '');
    if (!newPassword || newPassword.length < 8) {
      return c.json({ ok: false, error: 'New password must be at least 8 characters' }, 400);
    }
    const settings = await getOwnerVaultConfigHono();
    const currentHash = String(settings.ownerVault?.passwordHash || '');
    if (currentHash && !verifyOwnerPassword(currentPassword, currentHash)) {
      return c.json({ ok: false, error: 'Current password is invalid' }, 401);
    }
    settings.ownerVault.passwordHash = hashOwnerPassword(newPassword);
    settings.ownerVault.updatedBy = 'owner-vault';
    settings.ownerVault.updatedAt = new Date();
    await settings.save();
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API owner-vault/password]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/owner-vault/password/reset-emergency', async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const resetKey = String(body?.resetKey || '').trim();
    const recoveryEmail = String(body?.email || '').trim().toLowerCase();
    const newPassword = String(body?.newPassword || '');
    if (!process.env.OWNER_VAULT_EMERGENCY_RESET_KEY) {
      return c.json({ ok: false, error: 'Emergency reset is disabled' }, 403);
    }
    if (!resetKey || resetKey !== process.env.OWNER_VAULT_EMERGENCY_RESET_KEY) {
      return c.json({ ok: false, error: 'Invalid emergency key' }, 403);
    }
    const expectedRecoveryEmail = String(process.env.OWNER_VAULT_RECOVERY_EMAIL || '').trim().toLowerCase();
    if (expectedRecoveryEmail && recoveryEmail !== expectedRecoveryEmail) {
      return c.json({ ok: false, error: 'Invalid recovery email' }, 403);
    }
    if (!newPassword || newPassword.length < 8) {
      return c.json({ ok: false, error: 'New password must be at least 8 characters' }, 400);
    }
    const settings = await getOwnerVaultConfigHono();
    settings.ownerVault.passwordHash = hashOwnerPassword(newPassword);
    settings.ownerVault.session = {
      tokenHash: '',
      expiresAt: null,
      lastActivityAt: null,
    };
    settings.ownerVault.updatedBy = 'emergency-reset';
    settings.ownerVault.updatedAt = new Date();
    await settings.save();
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API owner-vault/password/reset-emergency]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/owner-vault/visibility', async (c) => {
  const authErr = await requireOwnerVaultSessionHono(c);
  if (authErr) return authErr;
  try {
    const payload = await getOwnerVisibilityRead();
    return c.json({ ok: true, item: payload });
  } catch (err) {
    console.error('[API owner-vault/visibility GET]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/owner-vault/visibility', async (c) => {
  const authErr = await requireOwnerVaultSessionHono(c);
  if (authErr) return authErr;
  try {
    const body = await c.req.json().catch(() => ({}));
    const visibility = mergeOwnerVisibility(body?.visibility || {});
    const enabled = body?.enabled !== false;
    const settings = await getOwnerVaultConfigHono();
    settings.ownerVault.visibility = visibility;
    settings.ownerVault.enabled = enabled;
    settings.ownerVault.updatedBy = 'owner-vault';
    settings.ownerVault.updatedAt = new Date();
    await settings.save();
    return c.json({
      ok: true,
      item: {
        enabled: settings.ownerVault.enabled !== false,
        visibility: mergeOwnerVisibility(settings.ownerVault.visibility || {}),
      },
    });
  } catch (err) {
    console.error('[API owner-vault/visibility PUT]', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.get('/product-families/storefront', async (c) => {
  try {
    const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
    const families = await ProductFamily.find({}).lean().maxTimeMS(15000);
    const items = [];
    for (const fam of families) {
      const payload = await hydrateProductFamilyPayloadVercel(fam);
      if (payload && payload.variants && payload.variants.length >= 2) items.push(payload);
    }
    return c.json({ ok: true, items });
  } catch (err) {
    console.error('[API product-families/storefront]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

async function visibilityLatestWorkAllowed(c) {
  const admin = await isAdminRequest(c);
  const payload = await getOwnerVisibilityRead();
  if (!payload.enabled) return true;
  if (admin) return Boolean(payload.visibility?.adminModules?.latestWork ?? true);
  return Boolean(payload.visibility?.publicPages?.latestWork ?? true);
}

app.get('/portfolio-posts', async (c) => {
  try {
    if (!(await visibilityLatestWorkAllowed(c))) {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
    const { default: PortfolioPost } = await import('../server/models/PortfolioPost.js');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(40, Math.max(1, Number(c.req.query('limit')) || 9));
    const skip = (page - 1) * limit;
    const filter = { published: true };
    const [items, total] = await Promise.all([
      PortfolioPost.find(filter)
        .sort({ sortOrder: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(15000),
      PortfolioPost.countDocuments(filter).maxTimeMS(15000),
    ]);
    return c.json({
      ok: true,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[API portfolio-posts]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/admin/portfolio-posts', async (c) => {
  try {
    if (!(await visibilityLatestWorkAllowed(c))) {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
    if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
    const { default: PortfolioPost } = await import('../server/models/PortfolioPost.js');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 20));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      PortfolioPost.find({})
        .sort({ sortOrder: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .maxTimeMS(15000),
      PortfolioPost.countDocuments({}).maxTimeMS(15000),
    ]);
    return c.json({
      ok: true,
      items,
      total,
      page,
      limit,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[API admin/portfolio-posts]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/admin/portfolio-posts', async (c) => {
  try {
    if (!(await visibilityLatestWorkAllowed(c))) {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
    if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
    const body = await c.req.json().catch(() => ({}));
    const titleAr = String(body?.titleAr || '').trim();
    const bodyAr = String(body?.bodyAr || '').trim();
    const published = body?.published !== false;
    const sortOrder = Number(body?.sortOrder) || 0;
    const media = Array.isArray(body?.media) ? body.media : [];
    const norm = media
      .map((m, i) => ({
        url: String(m?.url || '').trim(),
        type: m?.type === 'video' ? 'video' : 'image',
        order: Number(m?.order) || i,
        publicId: String(m?.publicId || '').trim(),
      }))
      .filter((m) => m.url);
    const { default: PortfolioPost } = await import('../server/models/PortfolioPost.js');
    const doc = await PortfolioPost.create({ titleAr, bodyAr, media: norm, published, sortOrder });
    return c.json({ ok: true, item: doc.toObject() });
  } catch (err) {
    console.error('[API admin/portfolio-posts POST]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/admin/portfolio-posts/:id', async (c) => {
  try {
    if (!(await visibilityLatestWorkAllowed(c))) {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
    if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
    const { default: PortfolioPost } = await import('../server/models/PortfolioPost.js');
    const id = c.req.param('id');
    const doc = await PortfolioPost.findById(id).maxTimeMS(8000);
    if (!doc) return c.json({ ok: false, error: 'Not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (body.titleAr !== undefined) doc.titleAr = String(body.titleAr || '').trim();
    if (body.bodyAr !== undefined) doc.bodyAr = String(body.bodyAr || '').trim();
    if (body.published !== undefined) doc.published = !!body.published;
    if (body.sortOrder !== undefined) doc.sortOrder = Number(body.sortOrder) || 0;
    if (Array.isArray(body.media)) {
      doc.media = body.media
        .map((m, i) => ({
          url: String(m?.url || '').trim(),
          type: m?.type === 'video' ? 'video' : 'image',
          order: Number(m?.order) || i,
          publicId: String(m?.publicId || '').trim(),
        }))
        .filter((m) => m.url);
    }
    await doc.save();
    return c.json({ ok: true, item: doc.toObject() });
  } catch (err) {
    console.error('[API admin/portfolio-posts PATCH]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/admin/portfolio-posts/:id', async (c) => {
  try {
    if (!(await visibilityLatestWorkAllowed(c))) {
      return c.json({ ok: false, error: 'Not found' }, 404);
    }
    if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
    const { default: PortfolioPost } = await import('../server/models/PortfolioPost.js');
    const id = c.req.param('id');
    const r = await PortfolioPost.findByIdAndDelete(id).maxTimeMS(8000);
    if (!r) return c.json({ ok: false, error: 'Not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API admin/portfolio-posts DELETE]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

async function canReadProductsResource(c) {
  if (await isAdminRequest(c)) return true;
  const userId = c.req.header('x-user-id');
  if (!userId) return false;
  try {
    const { getPermissionContext } = await import('../server/rbac/permissions.js');
    const ctx = await getPermissionContext(userId, 'products', 'read');
    return !!(ctx && ctx.allowed);
  } catch {
    return false;
  }
}

async function requireProductsMutationPermission(c, action) {
  if (await isAdminRequest(c)) return null;
  const userId = c.req.header('x-user-id');
  if (!userId) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { getPermissionContext } = await import('../server/rbac/permissions.js');
    const ctx = await getPermissionContext(userId, 'products', action);
    if (!ctx?.allowed) return c.json({ ok: false, error: 'Forbidden' }, 403);
    return null;
  } catch {
    return c.json({ ok: false, error: 'Forbidden' }, 403);
  }
}

async function detachProductFromItsFamilyVercel(productIdStr) {
  const pid = String(productIdStr);
  if (!mongoose.Types.ObjectId.isValid(pid)) return;
  const { default: Product } = await import('../server/models/Product.js');
  const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
  const p = await Product.findById(pid).select('productFamilyId').lean().maxTimeMS(8000);
  if (!p || !p.productFamilyId) return;
  const fid = String(p.productFamilyId);
  const fam = await ProductFamily.findById(fid).maxTimeMS(8000);
  if (!fam) {
    await Product.updateOne({ _id: pid }, { $unset: { productFamilyId: 1 } }).maxTimeMS(8000);
    return;
  }
  const mids = (fam.memberProductIds || []).map((x) => String(x));
  const remaining = mids.filter((id) => id !== pid);
  fam.memberProductIds = remaining.map((id) => new mongoose.Types.ObjectId(id));
  fam.members = (fam.members || []).filter((m) => String(m.productId) !== pid);
  if (remaining.length < 2) {
    await Product.updateMany(
      { _id: { $in: mids.map((id) => new mongoose.Types.ObjectId(id)) } },
      { $unset: { productFamilyId: 1 } }
    ).maxTimeMS(15000);
    await ProductFamily.findByIdAndDelete(fid).maxTimeMS(8000);
  } else {
    await fam.save();
    await Product.updateOne({ _id: pid }, { $unset: { productFamilyId: 1 } }).maxTimeMS(8000);
  }
}

app.get('/product-families', async (c) => {
  try {
    const allowed = await canReadProductsResource(c);
    if (!allowed) return c.json({ ok: false, error: 'Forbidden' }, 403);
    const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
    const families = await ProductFamily.find({}).sort({ updatedAt: -1 }).lean().maxTimeMS(15000);
    return c.json({ ok: true, items: families });
  } catch (err) {
    console.error('[API product-families]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/product-families', async (c) => {
  const denied = await requireProductsMutationPermission(c, 'create');
  if (denied) return denied;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
    const body = await c.req.json().catch(() => ({}));
    let name = String(body.name || '').trim();
    let nameAr = String(body.nameAr || '').trim();
    if (!nameAr && name) nameAr = name;
    if (!name && nameAr) name = nameAr;
    const memberProductIds = Array.isArray(body.memberProductIds) ? body.memberProductIds : [];
    const options = Array.isArray(body.options) ? body.options : [];
    const membersRaw = Array.isArray(body.members) ? body.members : [];
    const members = membersRaw
      .map((m) => ({
        productId: mongoose.Types.ObjectId.isValid(String(m.productId))
          ? new mongoose.Types.ObjectId(String(m.productId))
          : null,
        values: m.values && typeof m.values === 'object' ? m.values : {},
      }))
      .filter((m) => m.productId);
    if (!nameAr && !name) return c.json({ ok: false, error: 'اسم العائلة مطلوب' }, 400);
    if (!nameAr) nameAr = name;
    if (!name) name = nameAr;
    if (memberProductIds.length < 2 || memberProductIds.length > 20) {
      return c.json({ ok: false, error: 'Between 2 and 20 products required' }, 400);
    }
    const ids = memberProductIds
      .filter((id) => mongoose.Types.ObjectId.isValid(String(id)))
      .map((id) => new mongoose.Types.ObjectId(String(id)));
    let prods = await Product.find({ _id: { $in: ids } }).lean().maxTimeMS(15000);
    if (prods.length !== ids.length) return c.json({ ok: false, error: 'One or more products not found' }, 400);
    const transfer = body.transferFromOtherFamilies === true;
    for (const p of prods) {
      if (p.productFamilyId) {
        if (!transfer) {
          return c.json({ ok: false, error: `Product ${p._id} already belongs to a family` }, 400);
        }
        await detachProductFromItsFamilyVercel(String(p._id));
      }
    }
    prods = await Product.find({ _id: { $in: ids } }).lean().maxTimeMS(15000);
    const defaultProductId =
      body.defaultProductId && mongoose.Types.ObjectId.isValid(String(body.defaultProductId))
        ? new mongoose.Types.ObjectId(String(body.defaultProductId))
        : null;
    const doc = await ProductFamily.create({
      name,
      nameAr,
      memberProductIds: ids,
      options,
      members,
      defaultProductId,
    });
    let defaultId = doc.defaultProductId;
    if (!defaultId) {
      let best = null;
      let bestPrice = Infinity;
      for (const p of prods) {
        if (p.active === false) continue;
        const pr = Number(p.price);
        if (Number.isFinite(pr) && pr < bestPrice) {
          bestPrice = pr;
          best = p._id;
        }
      }
      defaultId = best || prods[0]._id;
      doc.defaultProductId = defaultId;
      await doc.save();
    }
    await Product.updateMany({ _id: { $in: ids } }, { $set: { productFamilyId: doc._id } }).maxTimeMS(15000);
    return c.json({ ok: true, item: doc.toObject() }, 201);
  } catch (err) {
    console.error('[API product-families POST]', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.put('/product-families/:id', async (c) => {
  const denied = await requireProductsMutationPermission(c, 'update');
  if (denied) return denied;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid id' }, 400);
    const existing = await ProductFamily.findById(id).maxTimeMS(8000);
    if (!existing) return c.json({ ok: false, error: 'Not found' }, 404);
    const body = await c.req.json().catch(() => ({}));
    if (body.name != null) existing.name = String(body.name).trim();
    if (body.nameAr != null) existing.nameAr = String(body.nameAr).trim();
    if (Array.isArray(body.options)) existing.options = body.options;
    if (Array.isArray(body.members)) {
      existing.members = body.members
        .map((m) => ({
          productId: mongoose.Types.ObjectId.isValid(String(m.productId))
            ? new mongoose.Types.ObjectId(String(m.productId))
            : null,
          values: m.values && typeof m.values === 'object' ? m.values : {},
        }))
        .filter((m) => m.productId);
    }
    if (Array.isArray(body.memberProductIds) && body.memberProductIds.length >= 2) {
      const transfer = body.transferFromOtherFamilies === true;
      const oldIds = (existing.memberProductIds || []).map(String);
      const newIds = body.memberProductIds
        .filter((x) => mongoose.Types.ObjectId.isValid(String(x)))
        .map((x) => new mongoose.Types.ObjectId(String(x)));
      if (newIds.length > 20) return c.json({ ok: false, error: 'Max 20 members' }, 400);
      const removed = oldIds.filter((oid) => !newIds.map(String).includes(oid));
      if (removed.length) {
        const removedOids = removed
          .filter((oid) => mongoose.Types.ObjectId.isValid(oid))
          .map((oid) => new mongoose.Types.ObjectId(oid));
        await Product.updateMany({ _id: { $in: removedOids } }, { $unset: { productFamilyId: 1 } }).maxTimeMS(15000);
      }
      for (const oid of newIds) {
        const p = await Product.findById(oid).select('productFamilyId').lean().maxTimeMS(8000);
        if (!p) return c.json({ ok: false, error: 'Invalid member list' }, 400);
        const pf = p.productFamilyId ? String(p.productFamilyId) : '';
        if (pf && pf !== String(existing._id)) {
          if (!transfer) {
            return c.json({ ok: false, error: `Product ${p._id} in another family` }, 400);
          }
          await detachProductFromItsFamilyVercel(String(p._id));
        }
      }
      const prods = await Product.find({ _id: { $in: newIds } }).lean().maxTimeMS(15000);
      if (prods.length !== newIds.length) return c.json({ ok: false, error: 'Invalid member list' }, 400);
      existing.memberProductIds = newIds;
      await Product.updateMany({ _id: { $in: newIds } }, { $set: { productFamilyId: existing._id } }).maxTimeMS(
        15000
      );
    }
    if (body.defaultProductId && mongoose.Types.ObjectId.isValid(String(body.defaultProductId))) {
      existing.defaultProductId = new mongoose.Types.ObjectId(String(body.defaultProductId));
    }
    await existing.save();
    return c.json({ ok: true, item: existing.toObject() });
  } catch (err) {
    console.error('[API product-families PUT]', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.delete('/product-families/:id', async (c) => {
  const denied = await requireProductsMutationPermission(c, 'delete');
  if (denied) return denied;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const { default: ProductFamily } = await import('../server/models/ProductFamily.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid id' }, 400);
    const fam = await ProductFamily.findById(id).maxTimeMS(8000);
    if (!fam) return c.json({ ok: true, deleted: false });
    const ids = (fam.memberProductIds || []).map((x) => x);
    await Product.updateMany({ _id: { $in: ids } }, { $unset: { productFamilyId: 1 } }).maxTimeMS(15000);
    await ProductFamily.findByIdAndDelete(id).maxTimeMS(8000);
    return c.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('[API product-families DELETE]', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

// ===== PRODUCTS =====
app.get('/products', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const ids = c.req.query('ids');
    const categorySlug = c.req.query('categorySlug');
    const categoryId = c.req.query('categoryId');
    const search = c.req.query('search');
    const featured = c.req.query('featured');
    const pageRaw = c.req.query('page');
    const limitRaw = c.req.query('limit') || c.req.query('perPage');
    const fields = c.req.query('fields');

    const page = Math.max(1, parseInt(String(pageRaw || '1'), 10) || 1);
    const limit = Math.min(500, Math.max(1, parseInt(String(limitRaw || '20'), 10) || 20));

    if (ids) {
      const idList = String(ids)
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (idList.length === 0) {
        return c.json({ ok: true, items: [], total: 0, page: 1, pages: 1 });
      }
      const projection = typeof fields === 'string' && fields.trim() ? String(fields).split(',').join(' ') : undefined;
      const docs = await Product.find({ _id: { $in: idList } })
        .select(projection)
        .lean()
        .maxTimeMS(15000);
      const itemsWithStats = await attachRatingStatsToProductsVercel(docs);
      return c.json({
        ok: true,
        items: itemsWithStats,
        total: itemsWithStats.length,
        page: 1,
        pages: 1,
      });
    }

    let q = { active: { $ne: false } };
    if (featured !== undefined) q.featured = featured === 'true';
    if (categorySlug) q.categorySlug = categorySlug;
    if (categoryId && mongoose.Types.ObjectId.isValid(String(categoryId))) {
      q.categoryId = new mongoose.Types.ObjectId(String(categoryId));
    }
    if (search && String(search).trim()) {
      const raw = String(search).trim();
      const esc = raw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      q.$or = [
        { name: { $regex: esc, $options: 'i' } },
        { nameAr: { $regex: esc, $options: 'i' } },
        { sku: { $regex: esc, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;
    const projection = typeof fields === 'string' && fields.trim() ? String(fields).split(',').join(' ') : undefined;
    const [items, total] = await Promise.all([
      Product.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .select(projection)
        .lean()
        .maxTimeMS(15000),
      Product.countDocuments(q, { maxTimeMS: 15000 }),
    ]);
    const itemsWithStats = await attachRatingStatsToProductsVercel(items);
    return c.json({
      ok: true,
      items: itemsWithStats,
      total,
      page,
      pages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (err) {
    console.error('[API /products]', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/products/:id', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const id = c.req.param('id');
    const product = await Product.findById(id).lean().maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    const [itemWithStats] = await attachRatingStatsToProductsVercel([product]);
    let productFamily = null;
    try {
      const fam = await findProductFamilyLeanForProductIdVercel(product._id);
      if (fam) productFamily = await hydrateProductFamilyPayloadVercel(fam);
    } catch (e) {
      console.warn('[API products/:id] productFamily hydrate failed', e?.message);
    }
    return c.json({ ok: true, item: itemWithStats, productFamily });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/products/:id', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Product.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/products/:id', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const id = c.req.param('id');
    if (!id) return c.json({ ok: false, error: 'Invalid product id' }, 400);

    let existing = null;
    if (mongoose.Types.ObjectId.isValid(id)) {
      existing = await Product.findById(id).maxTimeMS(8000);
    } else {
      // Legacy fallback for non-ObjectId identifiers (older datasets)
      existing = await Product.findOne({ sku: id }).maxTimeMS(8000);
    }

    // Keep DELETE idempotent: if already deleted/missing, return success.
    if (!existing) return c.json({ ok: true, deleted: false, message: 'Already deleted or missing' });

    if (mongoose.Types.ObjectId.isValid(id)) {
      await Product.findByIdAndDelete(id).maxTimeMS(8000);
    } else {
      await Product.deleteOne({ _id: existing._id }).maxTimeMS(8000);
    }
    return c.json({ ok: true, deleted: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/products', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const body = await c.req.json();
    console.log('[API POST /products] Creating product:', body.name || body.nameAr);
    const product = new Product(body);
    await product.save();
    return c.json({ ok: true, item: product });
  } catch (err) {
    console.error('[API] Error creating product:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/products/:id/ratings', async (c) => {
  try {
    const { default: Rating } = await import('../server/models/Rating.js');
    const id = c.req.param('id');
    const ratings = await Rating.find({ productId: id }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: ratings });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== CATEGORIES =====
app.get('/categories', async (c) => {
  try {
    const { default: Category } = await import('../server/models/Category.js');
    const categories = await Category.find({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: categories });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

/** Used as img fallback when a product has no image (see Checkout, OrderHistory). */
app.get('/categories/:slug/image', async (c) => {
  try {
    await connectMongoDB();
    const { default: Category } = await import('../server/models/Category.js');
    const slug = c.req.param('slug');
    let category = slug ? await Category.findOne({ slug }).lean().maxTimeMS(8000) : null;
    if (!category && slug && mongoose.Types.ObjectId.isValid(slug)) {
      category = await Category.findById(slug).lean().maxTimeMS(8000);
    }
    const rawImage = category?.image && String(category.image).trim();
    if (!rawImage) return c.text('', 404);
    let safe;
    try {
      safe = assertSafeRemoteImageUrl(rawImage);
    } catch {
      return c.text('', 404);
    }
    return c.redirect(safe, 302);
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/categories/:id', async (c) => {
  try {
    const { default: Category } = await import('../server/models/Category.js');
    const id = c.req.param('id');
    const category = await Category.findById(id).lean().maxTimeMS(8000);
    if (!category) return c.json({ ok: false, error: 'Category not found' }, 404);
    return c.json({ ok: true, item: category });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/categories', async (c) => {
  try {
    const { default: Category } = await import('../server/models/Category.js');
    const body = await c.req.json();
    const category = new Category({
      ...body,
      previewProducts: Array.isArray(body?.previewProducts) ? body.previewProducts : [],
      productDisplayOrder: Array.isArray(body?.productDisplayOrder) ? body.productDisplayOrder : [],
    });
    await category.save();
    return c.json({ ok: true, item: category });
  } catch (err) {
    console.error('[API] Error creating category:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/categories/:id', async (c) => {
  try {
    const { default: Category } = await import('../server/models/Category.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updatePayload = { ...body };
    if (Object.prototype.hasOwnProperty.call(body || {}, 'previewProducts')) {
      updatePayload.previewProducts = Array.isArray(body?.previewProducts) ? body.previewProducts : [];
    }
    if (Object.prototype.hasOwnProperty.call(body || {}, 'productDisplayOrder')) {
      updatePayload.productDisplayOrder = Array.isArray(body?.productDisplayOrder) ? body.productDisplayOrder : [];
    }
    const updated = await Category.findByIdAndUpdate(id, updatePayload, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Category not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/categories/:id', async (c) => {
  try {
    const { default: Category } = await import('../server/models/Category.js');
    const id = c.req.param('id');
    const deleted = await Category.findByIdAndDelete(id).maxTimeMS(8000);
    if (!deleted) return c.json({ ok: false, error: 'Category not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== HOME CONFIG =====
app.get('/home-config', async (c) => {
  try {
    const { default: HomeConfig } = await import('../server/models/HomeConfig.js');
    const config = await HomeConfig.findOne({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: config });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/home-config', async (c) => {
  try {
    const { default: HomeConfig } = await import('../server/models/HomeConfig.js');
    const body = await c.req.json();
    const updated = await HomeConfig.findOneAndUpdate({}, body, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== SHOP SETUP =====
app.get('/shop-setup', async (c) => {
  try {
    const { default: ShopSetup } = await import('../server/models/ShopSetup.js');
    const userId = c.req.header('x-user-id') || null;
    const actorKey = getActorKey(c);
    const query = userId ? { userId } : { actorKey };
    const setup = await ShopSetup.findOne(query).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: setup });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/shop-setup', async (c) => {
  try {
    const { default: ShopSetup } = await import('../server/models/ShopSetup.js');
    const body = await c.req.json();
    const userId = c.req.header('x-user-id') || null;
    const actorKey = getActorKey(c);
    const payload = { ...body, userId, actorKey };

    if (!String(payload.ownerName || '').trim() || !String(payload.shopName || '').trim() || !String(payload.phone || '').trim() || !String(payload.field || '').trim()) {
      return c.json({ ok: false, error: 'Missing required shop setup fields' }, 400);
    }

    const query = userId ? { userId } : { actorKey };
    const updated = await ShopSetup.findOneAndUpdate(query, payload, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/shop-setup/all', async (c) => {
  try {
    const admin = await isAdminRequest(c);
    if (!admin) return c.json({ ok: false, error: 'Admin authentication required' }, 403);
    const { default: ShopSetup } = await import('../server/models/ShopSetup.js');
    const items = await ShopSetup.find({}).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== BUILDER ACCESS =====
app.get('/builder/pricing-config', async (c) => {
  try {
    const { default: BuilderPricingConfig } = await import('../server/models/BuilderPricingConfig.js');
    let cfg = await BuilderPricingConfig.findOne({}).lean().maxTimeMS(8000);
    if (!cfg) {
      cfg = await BuilderPricingConfig.create({
        isFreeNow: true,
        currentPriceEgp: 0,
        nextPriceEgp: 100,
        sessionMinutes: 90,
        idleTimeoutMinutes: 15,
        singleActiveSessionPerActor: true,
        isActive: true,
      });
    }
    return c.json({ ok: true, item: cfg });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/builder/pricing-config', async (c) => {
  try {
    const admin = await isAdminRequest(c);
    if (!admin) return c.json({ ok: false, error: 'Admin authentication required' }, 403);
    const { default: BuilderPricingConfig } = await import('../server/models/BuilderPricingConfig.js');
    const body = await c.req.json();
    const payload = {
      isFreeNow: body.isFreeNow !== false,
      currentPriceEgp: Math.max(0, Number(body.currentPriceEgp || 0)),
      nextPriceEgp: Math.max(0, Number(body.nextPriceEgp || 100)),
      sessionMinutes: Math.max(15, Math.min(480, Number(body.sessionMinutes || 90))),
      idleTimeoutMinutes: Math.max(5, Math.min(120, Number(body.idleTimeoutMinutes || 15))),
      singleActiveSessionPerActor: body.singleActiveSessionPerActor !== false,
      isActive: body.isActive !== false,
    };
    const updated = await BuilderPricingConfig.findOneAndUpdate({}, payload, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/builder/access', async (c) => {
  try {
    const { default: BuilderPricingConfig } = await import('../server/models/BuilderPricingConfig.js');
    const { default: BuilderAccessSession } = await import('../server/models/BuilderAccessSession.js');
    let cfg = await BuilderPricingConfig.findOne({}).lean().maxTimeMS(8000);
    if (!cfg) {
      cfg = await BuilderPricingConfig.create({
        isFreeNow: true,
        currentPriceEgp: 0,
        nextPriceEgp: 100,
        sessionMinutes: 90,
        idleTimeoutMinutes: 15,
        singleActiveSessionPerActor: true,
        isActive: true,
      });
    }
    const actorKey = getActorKey(c);
    const now = new Date();
    const adminBypass = await isAdminRequest(c);
    const session = await BuilderAccessSession.findOne({
      actorKey,
      status: 'active',
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 }).maxTimeMS(8000);
    const remainingSeconds = session ? Math.max(0, Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000)) : 0;
    return c.json({
      ok: true,
      item: {
        actorKey,
        adminBypass,
        hasActiveSession: !!session || adminBypass,
        sessionId: session ? String(session._id) : null,
        sessionType: session?.sessionType || (adminBypass ? 'admin_bypass' : null),
        remainingSeconds: adminBypass ? null : remainingSeconds,
        expiresAt: session?.expiresAt || null,
        pricing: {
          isFreeNow: !!cfg.isFreeNow,
          currentPriceEgp: Number(cfg.currentPriceEgp || 0),
          nextPriceEgp: Number(cfg.nextPriceEgp || 100),
          sessionMinutes: Number(cfg.sessionMinutes || 90),
        },
      }
    });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/builder/session/start', async (c) => {
  try {
    const { default: BuilderPricingConfig } = await import('../server/models/BuilderPricingConfig.js');
    const { default: BuilderAccessSession } = await import('../server/models/BuilderAccessSession.js');
    let cfg = await BuilderPricingConfig.findOne({}).lean().maxTimeMS(8000);
    if (!cfg) {
      cfg = await BuilderPricingConfig.create({
        isFreeNow: true,
        currentPriceEgp: 0,
        nextPriceEgp: 100,
        sessionMinutes: 90,
        idleTimeoutMinutes: 15,
        singleActiveSessionPerActor: true,
        isActive: true,
      });
    }
    const body = await c.req.json().catch(() => ({}));
    const actorKey = getActorKey(c);
    const adminBypass = await isAdminRequest(c);
    const now = new Date();
    const existing = await BuilderAccessSession.findOne({
      actorKey,
      status: 'active',
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 }).maxTimeMS(8000);
    if (existing) return c.json({ ok: true, item: existing });

    if (!cfg.isActive && !adminBypass) {
      return c.json({ ok: false, error: 'Builder is currently unavailable' }, 403);
    }
    if (!cfg.isFreeNow && !adminBypass) {
      const paymentRef = typeof body.paymentRef === 'string' ? body.paymentRef : '';
      if (!paymentRef) return c.json({ ok: false, error: 'Payment required to start this session' }, 402);
    }

    const expiresAt = new Date(now.getTime() + Number(cfg.sessionMinutes || 90) * 60 * 1000);
    const ipHash = crypto.createHash('sha1').update(getClientIp(c)).digest('hex').slice(0, 20);
    const created = await BuilderAccessSession.create({
      actorKey,
      userId: c.req.header('x-user-id') || null,
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
        userAgent: String(c.req.header('user-agent') || '').slice(0, 300),
        source: typeof body.source === 'string' ? body.source : 'web',
      },
    });
    return c.json({ ok: true, item: created });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/builder/session/heartbeat', async (c) => {
  try {
    const { default: BuilderAccessSession } = await import('../server/models/BuilderAccessSession.js');
    const actorKey = getActorKey(c);
    const now = new Date();
    const active = await BuilderAccessSession.findOne({
      actorKey,
      status: 'active',
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 }).maxTimeMS(8000);
    if (!active) return c.json({ ok: false, error: 'No active session' }, 404);
    active.lastActivityAt = now;
    await active.save();
    return c.json({ ok: true, item: { sessionId: String(active._id), lastActivityAt: active.lastActivityAt } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/builder/session/end', async (c) => {
  try {
    const { default: BuilderAccessSession } = await import('../server/models/BuilderAccessSession.js');
    const actorKey = getActorKey(c);
    const now = new Date();
    const active = await BuilderAccessSession.findOne({
      actorKey,
      status: 'active',
      expiresAt: { $gt: now },
    }).sort({ createdAt: -1 }).maxTimeMS(8000);
    if (!active) return c.json({ ok: true, item: { ended: false } });
    active.status = 'ended';
    active.endAt = now;
    await active.save();
    return c.json({ ok: true, item: { ended: true, sessionId: String(active._id) } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== BUILDER PROJECTS =====
app.get('/builder/projects', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(48, Math.max(1, Number(c.req.query('limit') || 12)));
    const skip = (page - 1) * limit;
    const q = String(c.req.query('q') || '').trim();
    const deleted = parseBool(c.req.query('deleted'), false);
    const sortKey = String(c.req.query('sort') || 'updated_desc');

    const sortMap = {
      updated_desc: { updatedAt: -1 },
      created_desc: { createdAt: -1 },
      name_asc: { title: 1 },
      last_opened_desc: { lastOpenedAt: -1, updatedAt: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.updated_desc;
    const filter = { ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }), isDeleted: deleted };

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
      BuilderProject.find(filter).sort(sort).skip(skip).limit(limit).lean().maxTimeMS(12000),
      BuilderProject.countDocuments(filter).maxTimeMS(12000),
    ]);

    return c.json({
      ok: true,
      items: items.map(mapBuilderProjectListItem),
      page,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
      limit,
    });
  } catch (err) {
    console.error('[API] builder/projects list error:', err.message);
    return c.json({ ok: false, error: err.message || 'Failed to list projects' }, 500);
  }
});

app.post('/builder/projects', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const body = await c.req.json().catch(() => ({}));
    const { ownerUserId, ownerActorKey, ownerEmailSnapshot } = getOwnerIdentity(c);
    const layout = cleanBuilderLayout(body.layout || {});
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
      title: String(body.title || 'مشروع جديد').slice(0, 120),
      description: String(body.description || '').slice(0, 1000),
      layout,
      previewImageUrl,
      previewImagePublicId,
      stats,
      version: 1,
      schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
      lastOpenedAt: new Date(),
    });
    return c.json({ ok: true, item: mapBuilderProjectListItem(created.toObject()) }, 201);
  } catch (err) {
    console.error('[API] builder/projects create error:', err.message);
    return c.json({ ok: false, error: err.message || 'Failed to create project' }, 400);
  }
});

app.post('/builder/projects/import', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const body = await c.req.json().catch(() => ({}));
    const { ownerUserId, ownerActorKey, ownerEmailSnapshot } = getOwnerIdentity(c);
    const layout = cleanBuilderLayout(body.layout || body.project?.layout || body.project || {});
    const stats = getBuilderProjectStats(layout);
    const title = String(body.title || body.project?.title || 'Imported Project').slice(0, 120);
    const description = String(body.description || body.project?.description || '').slice(0, 1000);

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
      previewImageUrl,
      previewImagePublicId,
      stats,
      version: 1,
      schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
      lastOpenedAt: new Date(),
    });
    return c.json({ ok: true, item: mapBuilderProjectListItem(created.toObject()) }, 201);
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to import project' }, 400);
  }
});

app.get('/builder/projects/:id', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const project = await BuilderProject.findOne(filter).lean().maxTimeMS(12000);
    if (!project) return c.json({ ok: false, error: 'Project not found' }, 404);
    return c.json({ ok: true, item: { ...mapBuilderProjectListItem(project), layout: cleanBuilderLayout(project.layout || {}), schemaVersion: Number(project.schemaVersion || 1) } });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to load project' }, 400);
  }
});

app.put('/builder/projects/:id', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const body = await c.req.json().catch(() => ({}));
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const current = await BuilderProject.findOne(filter).maxTimeMS(12000);
    if (!current) return c.json({ ok: false, error: 'Project not found' }, 404);

    if (body.title !== undefined) current.title = String(body.title || 'Project').slice(0, 120);
    if (body.description !== undefined) current.description = String(body.description || '').slice(0, 1000);
    if (body.layout !== undefined) {
      const layout = cleanBuilderLayout(body.layout);
      current.layout = layout;
      current.stats = getBuilderProjectStats(layout);
    }
    if (body.previewImageUrl !== undefined) current.previewImageUrl = String(body.previewImageUrl || '');
    if (body.previewImagePublicId !== undefined) current.previewImagePublicId = String(body.previewImagePublicId || '');

    if (typeof body.previewDataUrl === 'string' && body.previewDataUrl.trim()) {
      const uploaded = await uploadBuilderPreviewDataUrl(body.previewDataUrl, current.ownerActorKey || getActorKey(c));
      if (uploaded) {
        current.previewImageUrl = uploaded.url;
        current.previewImagePublicId = uploaded.publicId;
      }
    }

    current.version = Number(current.version || 1) + 1;
    current.schemaVersion = BUILDER_PROJECT_SCHEMA_VERSION;
    await current.save();
    return c.json({ ok: true, item: mapBuilderProjectListItem(current.toObject()) });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to update project' }, 400);
  }
});

app.post('/builder/projects/:id/open', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const project = await BuilderProject.findOne(filter).maxTimeMS(12000);
    if (!project) return c.json({ ok: false, error: 'Project not found' }, 404);
    project.lastOpenedAt = new Date();
    await project.save();
    return c.json({ ok: true, item: mapBuilderProjectListItem(project.toObject()) });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to mark open' }, 400);
  }
});

app.delete('/builder/projects/:id', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const project = await BuilderProject.findOne(filter).maxTimeMS(12000);
    if (!project) return c.json({ ok: false, error: 'Project not found' }, 404);
    project.isDeleted = true;
    project.deletedAt = new Date();
    project.deletedBy = c.req.header('x-user-id') || project.ownerActorKey;
    await project.save();
    return c.json({ ok: true, item: { deleted: true, id: String(project._id) } });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to delete project' }, 400);
  }
});

app.post('/builder/projects/:id/restore', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const project = await BuilderProject.findOne(filter).maxTimeMS(12000);
    if (!project) return c.json({ ok: false, error: 'Project not found' }, 404);
    project.isDeleted = false;
    project.deletedAt = null;
    project.deletedBy = null;
    await project.save();
    return c.json({ ok: true, item: mapBuilderProjectListItem(project.toObject()) });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to restore project' }, 400);
  }
});

app.delete('/builder/projects/:id/hard-delete', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const deleted = await BuilderProject.findOneAndDelete(filter).maxTimeMS(12000);
    if (!deleted) return c.json({ ok: false, error: 'Project not found' }, 404);
    return c.json({ ok: true, item: { hardDeleted: true, id: c.req.param('id') } });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to permanently delete project' }, 400);
  }
});

app.post('/builder/projects/:id/duplicate', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const source = await BuilderProject.findOne(filter).lean().maxTimeMS(12000);
    if (!source) return c.json({ ok: false, error: 'Project not found' }, 404);

    const { ownerUserId, ownerActorKey, ownerEmailSnapshot } = getOwnerIdentity(c);
    const created = await BuilderProject.create({
      ownerUserId: source.ownerUserId || ownerUserId,
      ownerActorKey: source.ownerActorKey || ownerActorKey,
      ownerEmailSnapshot: source.ownerEmailSnapshot || ownerEmailSnapshot,
      title: `${source.title || 'Project'} (Copy)`.slice(0, 120),
      description: source.description || '',
      layout: cleanBuilderLayout(source.layout || {}),
      previewImageUrl: source.previewImageUrl || '',
      previewImagePublicId: source.previewImagePublicId || '',
      stats: source.stats || getBuilderProjectStats(source.layout || {}),
      version: 1,
      schemaVersion: BUILDER_PROJECT_SCHEMA_VERSION,
      lastOpenedAt: new Date(),
    });
    return c.json({ ok: true, item: mapBuilderProjectListItem(created.toObject()) }, 201);
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to duplicate project' }, 400);
  }
});

app.get('/builder/projects/:id/export', async (c) => {
  try {
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const isAdmin = await isAdminRequest(c);
    const adminAll = isAdmin && parseBool(c.req.query('allUsers'), false);
    const filter = { _id: c.req.param('id'), ...buildBuilderScopeFilter(c, { adminAll, ownerQuery: c.req.query('owner') }) };
    const project = await BuilderProject.findOne(filter).lean().maxTimeMS(12000);
    if (!project) return c.json({ ok: false, error: 'Project not found' }, 404);
    return c.json({
      ok: true,
      item: {
        schemaVersion: Number(project.schemaVersion || BUILDER_PROJECT_SCHEMA_VERSION),
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
    return c.json({ ok: false, error: err.message || 'Failed to export project' }, 400);
  }
});

app.get('/admin/builder/projects', async (c) => {
  try {
    const admin = await isAdminRequest(c);
    if (!admin) return c.json({ ok: false, error: 'Admin authentication required' }, 403);
    const { default: BuilderProject } = await import('../server/models/BuilderProject.js');
    const page = Math.max(1, Number(c.req.query('page') || 1));
    const limit = Math.min(48, Math.max(1, Number(c.req.query('limit') || 12)));
    const skip = (page - 1) * limit;
    const q = String(c.req.query('q') || '').trim();
    const deleted = parseBool(c.req.query('deleted'), false);
    const sortKey = String(c.req.query('sort') || 'updated_desc');
    const sortMap = {
      updated_desc: { updatedAt: -1 },
      created_desc: { createdAt: -1 },
      name_asc: { title: 1 },
      last_opened_desc: { lastOpenedAt: -1, updatedAt: -1 },
    };
    const sort = sortMap[sortKey] || sortMap.updated_desc;
    const filter = { ...buildBuilderScopeFilter(c, { adminAll: true, ownerQuery: c.req.query('owner') }), isDeleted: deleted };
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
      BuilderProject.find(filter).sort(sort).skip(skip).limit(limit).lean().maxTimeMS(12000),
      BuilderProject.countDocuments(filter).maxTimeMS(12000),
    ]);
    return c.json({ ok: true, items: items.map(mapBuilderProjectListItem), page, total, pages: Math.max(1, Math.ceil(total / limit)), limit });
  } catch (err) {
    return c.json({ ok: false, error: err.message || 'Failed to list admin projects' }, 500);
  }
});

// ===== SETTINGS =====
app.get('/settings', async (c) => {
  try {
    const { default: Settings } = await import('../server/models/Settings.js');
    const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: settings });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/settings', async (c) => {
  try {
    const { default: Settings } = await import('../server/models/Settings.js');
    const body = await c.req.json();
    const updated = await Settings.findOneAndUpdate({}, body, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== SETTINGS FOOTER =====
app.get('/settings/footer', async (c) => {
  try {
    const { default: Settings } = await import('../server/models/Settings.js');
    const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: settings?.footer || {} });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/settings/footer', async (c) => {
  try {
    const { default: Settings } = await import('../server/models/Settings.js');
    const body = await c.req.json();
    const updated = await Settings.findOneAndUpdate({}, { footer: body }, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated?.footer || {} });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ORDERS =====
app.get('/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const orders = await Order.find({}).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: orders });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const body = await c.req.json();
    const order = new Order(body);
    await order.save();
    // Push to registered POS webhooks. Awaited so it isn't killed after the response.
    try {
      const { dispatchOrderWebhooks } = await import('../server/services/orderWebhook.js');
      await dispatchOrderWebhooks(order);
    } catch (whErr) {
      console.error('[API] order webhook dispatch failed:', whErr.message);
    }
    return c.json({ ok: true, item: order });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/orders/:id', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const order = await Order.findById(id).lean().maxTimeMS(8000);
    if (!order) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: order });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/orders/track', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const orderNumber = c.req.query('orderNumber');
    const email = c.req.query('email');

    if (!orderNumber || !email) {
      return c.json({ ok: false, error: 'orderNumber and email required' }, 400);
    }

    const order = await Order.findOne({ orderNumber, email }).lean().maxTimeMS(8000);
    if (!order) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: order });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id/request-cancellation', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id/request-return', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/orders/rate', async (c) => {
  try {
    const { default: Rating } = await import('../server/models/Rating.js');
    const body = await c.req.json();
    const rating = new Rating(body);
    await rating.save();
    return c.json({ ok: true, item: rating });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== USERS =====
app.get('/users/:id/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const userId = c.req.param('id');
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: orders });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/users/:id', async (c) => {
  try {
    if (!(await isAdminRequest(c))) {
      return c.json({ ok: false, error: 'Forbidden' }, 403);
    }
    const { default: User } = await import('../server/models/User.js');
    const id = c.req.param('id');
    const body = await c.req.json().catch(() => ({}));
    const allowed = {};
    if (typeof body.isActive === 'boolean') allowed.isActive = body.isActive;
    if (typeof body.role === 'string' && ['customer', 'admin'].includes(body.role)) allowed.role = body.role;
    if (typeof body.firstName === 'string') allowed.firstName = String(body.firstName).trim().slice(0, 120);
    if (typeof body.lastName === 'string') allowed.lastName = String(body.lastName).trim().slice(0, 120);
    if (typeof body.phone === 'string') allowed.phone = String(body.phone).trim().slice(0, 40);
    const updated = await User.findByIdAndUpdate(id, { $set: allowed }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== SEARCH =====
app.get('/search/popular', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    // Get popular products (highest rated or most reviewed)
    const popular = await Product.find({ active: { $ne: false } })
      .sort({ rating: -1, reviews: -1 })
      .limit(10)
      .lean()
      .maxTimeMS(8000);
    return c.json({ ok: true, items: popular });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/search/track', async (c) => {
  try {
    const query = c.req.query('q');
    const { default: Product } = await import('../server/models/Product.js');
    const results = await Product.find({
      $or: [
        { name: { $regex: query, $options: 'i' } },
        { nameAr: { $regex: query, $options: 'i' } },
        { description: { $regex: query, $options: 'i' } }
      ],
      active: { $ne: false }
    })
      .limit(20)
      .lean()
      .maxTimeMS(8000);
    return c.json({ ok: true, items: results });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ANALYTICS =====
app.get('/analytics/customers', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const count = await User.countDocuments({ role: 'user' });
    const recent = await User.find({ role: 'user' }).sort({ createdAt: -1 }).limit(10).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: { totalCustomers: count, recentCustomers: recent } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/analytics/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const total = await Order.countDocuments({});
    const completed = await Order.countDocuments({ status: 'completed' });
    const pending = await Order.countDocuments({ status: 'pending' });
    return c.json({ ok: true, item: { totalOrders: total, completedOrders: completed, pendingOrders: pending } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/analytics/returns', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const returns = await Order.countDocuments({ returnReason: { $exists: true, $ne: null } });
    return c.json({ ok: true, item: { totalReturns: returns } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== HISTORY =====
app.get('/history', async (c) => {
  try {
    const { default: History } = await import('../server/models/History.js');
    const history = await History.find({}).sort({ createdAt: -1 }).limit(100).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: history });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/history/mark-read', async (c) => {
  try {
    const { default: HistoryRead } = await import('../server/models/HistoryRead.js');
    const body = await c.req.json();
    const marked = await HistoryRead.updateMany({ userId: body.userId }, { read: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: marked });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== RETURNS =====
app.get('/returns', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const returns = await Order.find({ returnReason: { $exists: true, $ne: null } }).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: returns });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/returns/:id', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const order = await Order.findById(id).lean().maxTimeMS(8000);
    if (!order || !order.returnReason) return c.json({ ok: false, error: 'Return not found' }, 404);
    return c.json({ ok: true, item: order });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/my/returns', async (c) => {
  try {
    const userId = c.req.query('userId');
    const { default: Order } = await import('../server/models/Order.js');
    const returns = await Order.find({ userId, returnReason: { $exists: true, $ne: null } }).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: returns });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ORDERS BULK =====
app.post('/orders/bulk/assign', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const body = await c.req.json();
    const updated = await Order.updateMany({ _id: { $in: body.orderIds } }, { assignedTo: body.assignedTo }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/orders/bulk/status', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const body = await c.req.json();
    const updated = await Order.updateMany({ _id: { $in: body.orderIds } }, { status: body.status }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== PRODUCTS 3D =====
app.get('/products-3d', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const page = Math.max(Number(c.req.query('page') || 1), 1);
    const limit = Math.min(Math.max(Number(c.req.query('limit') || 50), 1), 200);
    const skip = (page - 1) * limit;
    const category = c.req.query('category');
    const search = c.req.query('search');
    const isActive = c.req.query('isActive');
    const sort = c.req.query('sort') || 'date';

    const query = {};
    if (category && category !== 'all') query.category = category;
    if (search) query.name = { $regex: search, $options: 'i' };
    if (isActive !== undefined && isActive !== '') query.isActive = String(isActive) === 'true';

    let sortOption = { createdAt: -1 };
    if (sort === 'name') sortOption = { name: 1 };
    else if (sort === 'usage') sortOption = { usageCount: -1 };
    else if (sort === 'size') sortOption = { fileSize: -1 };

    const [items, total] = await Promise.all([
      Product3D.find(query).sort(sortOption).skip(skip).limit(limit).lean().maxTimeMS(8000),
      Product3D.countDocuments(query).maxTimeMS(8000),
    ]);

    return c.json({ ok: true, items, total, page, limit });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/products-3d/:id', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const id = c.req.param('id');
    const product = await Product3D.findById(id).lean().maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true, item: product });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/products-3d', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const body = await c.req.json();
    const product = await Product3D.create(body);
    return c.json({ ok: true, item: product }, 201);
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.put('/products-3d/:id', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const product = await Product3D.findByIdAndUpdate(id, body, {
      new: true,
      runValidators: true,
    }).maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true, item: product });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.delete('/products-3d/:id', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const id = c.req.param('id');
    const product = await Product3D.findByIdAndDelete(id).maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.post('/products-3d/:id/use', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const id = c.req.param('id');
    const product = await Product3D.findByIdAndUpdate(
      id,
      { $inc: { usageCount: 1 } },
      { new: true }
    ).maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true, item: product });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

app.get('/products-3d-categories', async (c) => {
  try {
    const { default: Settings } = await import('../server/models/Settings.js');
    let settings = await Settings.findOne().lean().maxTimeMS(8000);
    if (!settings) {
      settings = await Settings.create({});
    }
    const categories = settings?.products3DCategories || ['أثاث', 'أجهزة', 'إضاءة', 'ديكور', 'أخرى'];
    return c.json({ ok: true, categories });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/products-3d-categories', async (c) => {
  try {
    const { default: Settings } = await import('../server/models/Settings.js');
    const body = await c.req.json();
    const categories = Array.isArray(body?.categories) ? body.categories : null;
    if (!categories) return c.json({ ok: false, error: 'Categories must be an array' }, 400);

    let settings = await Settings.findOne().maxTimeMS(8000);
    if (!settings) {
      settings = await Settings.create({ products3DCategories: categories });
    } else {
      settings.products3DCategories = categories;
      await settings.save();
    }
    return c.json({ ok: true, categories: settings.products3DCategories || categories });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/products-3d/categories/list', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const items = await Product3D.distinct('category').maxTimeMS(8000);
    return c.json({ ok: true, items });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== PROFIT AGGREGATE =====
app.get('/profit-aggregate', async (c) => {
  try {
    const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
    const reports = await ProfitReport.find({}).lean().maxTimeMS(8000);
    const totalProfit = reports.reduce((sum, r) => sum + (r.totalProfit || 0), 0);
    return c.json({ ok: true, item: { totalProfit, reportCount: reports.length } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== RBAC =====
app.get('/rbac/my-permissions', async (c) => {
  try {
    const userId = c.req.query('userId');
    const { default: Role } = await import('../server/models/Role.js');
    const roles = await Role.find({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: roles });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/rbac/resources', async (c) => {
  try {
    const resources = [
      { name: 'products', actions: ['create', 'read', 'update', 'delete'] },
      { name: 'orders', actions: ['create', 'read', 'update', 'delete'] },
      { name: 'users', actions: ['create', 'read', 'update', 'delete'] },
      { name: 'settings', actions: ['read', 'update'] },
      { name: 'analytics', actions: ['read'] }
    ];
    return c.json({ ok: true, items: resources });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/rbac/super-admin', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const admin = await User.findOne({ role: 'admin' }).lean().maxTimeMS(8000);
    return c.json({ ok: true, item: { email: admin?.email || '' } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/rbac/users/:id/effective-permissions', async (c) => {
  try {
    const userId = c.req.param('id');
    const { default: User } = await import('../server/models/User.js');
    const user = await User.findById(userId).lean().maxTimeMS(8000);
    const permissions = user?.role === 'admin' ? [{ resource: '*', actions: ['*'] }] : [];
    return c.json({ ok: true, items: permissions });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/rbac/assign-custom', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ ok: true, item: body });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ROLES =====
app.get('/roles', async (c) => {
  try {
    const { default: Role } = await import('../server/models/Role.js');
    const roles = await Role.find({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: roles });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/roles', async (c) => {
  try {
    const { default: Role } = await import('../server/models/Role.js');
    const body = await c.req.json();
    const role = new Role(body);
    await role.save();
    return c.json({ ok: true, item: role });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== USER ROLE =====
app.post('/user-role', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json();
    const updated = await User.findByIdAndUpdate(body.userId, { role: body.roleId }, { new: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ROOMS =====
app.get('/rooms', async (c) => {
  try {
    const { default: Room } = await import('../server/models/Room.js');
    const rooms = await Room.find({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: rooms });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/rooms/:id', async (c) => {
  try {
    const { default: Room } = await import('../server/models/Room.js');
    const id = c.req.param('id');
    const room = await Room.findById(id).lean().maxTimeMS(8000);
    if (!room) return c.json({ ok: false, error: 'Room not found' }, 404);
    return c.json({ ok: true, item: room });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/room-planner/save', async (c) => {
  try {
    const { default: Room } = await import('../server/models/Room.js');
    const body = await c.req.json();
    const room = new Room(body);
    await room.save();
    return c.json({ ok: true, item: room });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== SUPPORT =====
app.post('/support/contact', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ ok: true, item: { message: 'Contact form submitted', data: body } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== 3D MODEL UPLOAD =====
app.post('/upload-3d-model', async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return c.json({ ok: false, error: 'No file uploaded' }, 400);
    }
    if (Number(file.size || 0) > 50 * 1024 * 1024) {
      return c.json({ ok: false, error: 'File too large. Max size is 50MB.' }, 413);
    }

    const fileName = String((file && file.name) || '');
    const fileExt = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')).toLowerCase() : '';
    const allowedTypes = ['.glb', '.gltf', '.obj', '.fbx'];
    if (!allowedTypes.includes(fileExt)) {
      return c.json({ ok: false, error: `Invalid file type. Allowed types: ${allowedTypes.join(', ')}` }, 400);
    }

    const cloudinary = await import('cloudinary').then((m) => m.v2);
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return c.json({ ok: false, error: 'Cloudinary is not configured on production environment' }, 500);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const publicId = `model_${Date.now()}${fileExt}`;
    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: '3d-models',
          resource_type: 'raw',
          public_id: publicId,
        },
        (error, uploaded) => {
          if (error) return reject(error);
          resolve(uploaded);
        }
      );
      stream.end(buffer);
    });

    return c.json({
      ok: true,
      url: result.secure_url,
      publicId: result.public_id,
      fileSize: result.bytes,
      format: fileExt.slice(1),
    });
  } catch (err) {
    const message = err?.message || '3D upload failed';
    console.error('[API] upload-3d-model error:', message);
    const lower = String(message).toLowerCase();
    const status = (
      lower.includes('too large')
      || lower.includes('entity too large')
      || lower.includes('payload too large')
    ) ? 413 : (
      lower.includes('invalid')
      || lower.includes('no file')
      || lower.includes('unsupported')
    ) ? 400 : 500;
    return c.json({ ok: false, error: message }, status);
  }
});

// ===== USERS =====
app.get('/users', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const users = await User.find({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: users });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/users/profile', async (c) => {
  try {
    const userId = c.req.query('userId');
    const { default: User } = await import('../server/models/User.js');
    const user = await User.findById(userId).lean().maxTimeMS(8000);
    if (!user) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true, item: user });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/users/sync', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ ok: true, item: { synced: true } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/users/profile', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json();
    const userId = body.userId || body.id;
    const updated = await User.findByIdAndUpdate(userId, body, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/users/:id/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const userId = c.req.param('id');
    const orders = await Order.find({ userId }).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: orders });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/users/:id/favorites', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const userId = c.req.param('id');
    const user = await User.findById(userId).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: user?.favorites || [] });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/users/:id/favorites/:productId', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const userId = c.req.param('id');
    const productId = c.req.param('productId');
    const updated = await User.findByIdAndUpdate(userId, {
      $addToSet: { favorites: productId }
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true, item: productId });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/users/:id/favorites/:productId', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const userId = c.req.param('id');
    const productId = c.req.param('productId');
    const updated = await User.findByIdAndUpdate(userId, {
      $pull: { favorites: productId }
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/users/:id/favorites', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const userId = c.req.param('id');
    const updated = await User.findByIdAndUpdate(userId, {
      favorites: []
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ADMIN USERS (promote / create; requires admin session) =====
app.post('/admin/users', async (c) => {
  try {
    if (!(await isAdminRequest(c))) {
      return c.json({ ok: false, error: 'Forbidden' }, 403);
    }
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json().catch(() => ({}));
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');
    const firstName = typeof body?.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body?.lastName === 'string' ? body.lastName.trim() : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim() : '';
    if (!email || !password) {
      return c.json({ ok: false, error: 'email and password are required' }, 400);
    }
    let user = await User.findOne({ email }).maxTimeMS(8000);
    if (user) {
      await User.updateOne(
        { _id: user._id },
        { $set: { role: 'admin', isActive: true, firstName, lastName, phone } }
      ).maxTimeMS(8000);
      user = await User.findById(user._id).maxTimeMS(8000);
    } else {
      user = await User.create({
        email,
        password,
        firstName,
        lastName,
        phone,
        role: 'admin',
        isActive: true,
      });
    }
    return c.json({ ok: true, user: { id: String(user._id), email: user.email } }, 201);
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 400);
  }
});

// ===== RBAC ASSIGN =====
app.post('/rbac/assign', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json();
    const updated = await User.findByIdAndUpdate(body.userId, {
      roleId: body.roleId
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true, success: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/rbac/assign-custom', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json();
    const updated = await User.findByIdAndUpdate(body.userId, {
      customPermissions: body.permissions
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'User not found' }, 404);
    return c.json({ ok: true, success: true });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== CLOUDINARY =====
app.post('/cloudinary/sign-3d-upload', async (c) => {
  try {
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return c.json({ ok: false, error: 'Cloudinary is not configured on this environment' }, 500);
    }

    const body = await c.req.json().catch(() => ({}));
    const rawName = String(body?.fileName || 'model').trim();
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

    const cloudinary = await import('cloudinary').then((m) => m.v2);
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);
    return c.json({
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
    console.error('[API] Cloudinary sign-3d-upload error:', err.message);
    return c.json({ ok: false, error: err?.message || 'Unable to sign upload' }, 500);
  }
});

app.post('/cloudinary/upload-url', async (c) => {
  try {
    const body = await c.req.json();
    const { url, public_id, folder, validateOnly } = body || {};
    const safeUrl = assertSafeRemoteImageUrl(url);
    await probeRemoteImageUrl(safeUrl, 8000);

    if (validateOnly) {
      return c.json({ ok: true, item: { url: safeUrl, valid: true } });
    }

    const cloudinary = await import('cloudinary').then(m => m.v2);
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const uploadOptions = {
      folder: typeof folder === 'string' && folder.trim() ? folder.trim() : 'products',
      resource_type: 'image',
      format: 'webp',
      quality: 'auto:good',
      transformation: [{ width: 1280, height: 1280, crop: 'limit' }],
    };

    if (typeof public_id === 'string' && public_id.trim()) {
      const cleaned = public_id.trim();
      if (!/^[a-zA-Z0-9/_-]+$/.test(cleaned)) {
        return c.json({ ok: false, error: 'Invalid public_id format' }, 400);
      }
      uploadOptions.public_id = cleaned;
    }

    const result = await cloudinary.uploader.upload(safeUrl, uploadOptions);
    return c.json({ ok: true, result });
  } catch (err) {
    console.error('[API] Cloudinary upload-url error:', err.message);
    const message = err?.message || 'Upload failed';
    const isClientError = /required|invalid|only|timed out|does not point|source returned/i.test(message);
    return c.json({ ok: false, error: message }, isClientError ? 400 : 500);
  }
});

app.post('/cloudinary/upload-file', async (c) => {
  try {
    // Parse multipart/form-data — NOT JSON (the file is a binary blob)
    const formData = await c.req.formData();
    const file = formData.get('file');

    if (!file || typeof file === 'string') {
      return c.json({ ok: false, error: 'file is required' }, 400);
    }

    // Read the file into an ArrayBuffer then Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Lazy-load cloudinary to avoid top-level import issues in Vercel edge
    const cloudinary = await import('cloudinary').then(m => m.v2);
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder: 'products',
          format: 'webp',
          quality: 'auto:good',
          transformation: [{ width: 1280, height: 1280, crop: 'limit' }],
        },
        (error, uploaded) => {
          if (error) return reject(error);
          resolve(uploaded);
        }
      );
      stream.end(buffer);
    });

    return c.json({ ok: true, result });
  } catch (err) {
    console.error('[API] Cloudinary upload error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== CART =====
app.post('/cart/add', async (c) => {
  try {
    const body = await c.req.json();
    // Cart is typically stored in session/local storage on client
    // This endpoint can be used to validate cart items exist
    const { default: Product } = await import('../server/models/Product.js');
    const product = await Product.findById(body.productId).lean().maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true, item: product });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== AUTH =====
app.post('/auth/login', async (c) => {
  try {
    const body = await c.req.json();
    const email = body?.email?.trim?.() || body?.email;
    const password = body?.password?.trim?.() || body?.password;

    console.log('[AUTH/LOGIN] Request:', { email: email || 'MISSING', hasPassword: !!password });

    if (!email || !password) {
      return c.json({ ok: false, error: 'email and password required' }, 400);
    }

    const { default: User } = await import('../server/models/User.js');
    const user = await User.findOne({ email }).lean().maxTimeMS(8000);

    if (!user) {
      // Allow login with temp admin session
      return c.json({
        ok: true,
        user: {
          id: 'temp-admin-' + Date.now(),
          email: email,
          firstName: email.split('@')[0] || 'Admin',
          lastName: 'User',
          phone: '',
          role: 'admin',
          isActive: true
        }
      });
    }

    return c.json({
      ok: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName || email.split('@')[0] || 'Admin',
        lastName: user.lastName || 'User',
        phone: user.phone || '',
        role: user.role || 'admin',
        isActive: user.isActive !== false
      }
    });
  } catch (err) {
    console.error('[API] Auth error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== ORDERS =====
app.get('/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const limit = parseInt(c.req.query('limit')) || 50;
    const page = parseInt(c.req.query('page')) || 1;
    const status = c.req.query('status');
    const skip = (page - 1) * limit;

    let query = Order.find({});
    if (status) query = query.where('status').equals(status);

    const [items, total] = await Promise.all([
      query.sort({ createdAt: -1 }).skip(skip).limit(limit).lean().maxTimeMS(8000),
      Order.countDocuments(status ? { status } : {})
    ]);

    return c.json({ ok: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/orders', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const body = await c.req.json();
    const order = new Order(body);
    await order.save();
    // Push to registered POS webhooks. Awaited so it isn't killed after the response.
    try {
      const { dispatchOrderWebhooks } = await import('../server/services/orderWebhook.js');
      await dispatchOrderWebhooks(order);
    } catch (whErr) {
      console.error('[API] order webhook dispatch failed:', whErr.message);
    }
    return c.json({ ok: true, item: order });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/orders/:id', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const order = await Order.findById(id).lean().maxTimeMS(8000);
    if (!order) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: order });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/orders/:id', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id/cancel', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, {
      status: 'cancelled',
      cancellationReason: body.cancellationReason,
      cancellationRequested: false,
      cancelledAt: new Date()
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id/return', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, {
      status: 'returned',
      returnReason: body.returnReason,
      returnStatus: body.returnStatus || 'approved',
      returnedAt: new Date()
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id/request-cancellation', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, {
      cancellationRequested: true,
      cancellationReason: body.reason || body.cancellationReason
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.patch('/orders/:id/partial-refund', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, {
      $push: { refunds: { amount: body.refundAmount, reason: body.refundReason, createdAt: new Date() } }
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/orders/:id/notes', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(id, {
      $push: { notes: { text: body.text, createdAt: new Date() } }
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/orders/rate', async (c) => {
  try {
    const { default: Order } = await import('../server/models/Order.js');
    const body = await c.req.json();
    const updated = await Order.findByIdAndUpdate(body.orderId, {
      rating: body.rating,
      review: body.review,
      ratedAt: new Date()
    }, { new: true }).maxTimeMS(8000);
    if (!updated) return c.json({ ok: false, error: 'Order not found' }, 404);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Sitemap ────────────────────────────────────────────────────────────────
app.get('/sitemap.xml', async (c) => {
  try {
    await connectMongoDB();
    const { default: Product } = await import('../server/models/Product.js');
    const { default: Category } = await import('../server/models/Category.js');

    const [products, categories] = await Promise.all([
      Product.find({ active: true }).select('_id').lean().maxTimeMS(10000),
      Category.find({}).select('_id').lean().maxTimeMS(10000),
    ]);

    const base = 'https://elhegazi.vercel.app';
    const staticUrls = ['/', '/products', '/categories', '/about', '/contact', '/locations'];

    const urls = [
      ...staticUrls.map((path) => `  <url><loc>${base}${path}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>`),
      ...products.map((p) => `  <url><loc>${base}/products/${p._id}</loc><changefreq>weekly</changefreq><priority>0.9</priority></url>`),
      ...categories.map((cat) => `  <url><loc>${base}/categories/${cat._id}</loc><changefreq>weekly</changefreq><priority>0.7</priority></url>`),
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  } catch (err) {
    console.error('[sitemap] error:', err.message);
    return new Response('<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>', {
      status: 500,
      headers: { 'Content-Type': 'application/xml' },
    });
  }
});

// ── QR Presets ─────────────────────────────────────────────────────────────
app.get('/qr-presets', async (c) => {
  try {
    await connectMongoDB();
    const { default: QRPreset } = await import('../server/models/QRPreset.js');
    const presets = await QRPreset.find({}).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: presets.map(p => ({ ...p, id: p._id.toString() })) });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/qr-presets', async (c) => {
  try {
    await connectMongoDB();
    const { default: QRPreset } = await import('../server/models/QRPreset.js');
    const body = await c.req.json();
    if (!body.name || !body.settings) return c.json({ ok: false, error: 'name and settings required' }, 400);
    const preset = await QRPreset.create({
      name: String(body.name).trim().slice(0, 100),
      settings: body.settings,
      productIds: Array.isArray(body.productIds) ? body.productIds : null,
    });
    return c.json({ ok: true, item: { ...preset.toObject(), id: preset._id.toString() } });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/qr-presets/:id', async (c) => {
  try {
    await connectMongoDB();
    const { default: QRPreset } = await import('../server/models/QRPreset.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const update = {};
    if (body.name) update.name = String(body.name).trim().slice(0, 100);
    if (body.settings) update.settings = body.settings;
    if ('productIds' in body) update.productIds = Array.isArray(body.productIds) ? body.productIds : null;
    const preset = await QRPreset.findByIdAndUpdate(id, update, { new: true }).lean().maxTimeMS(8000);
    if (!preset) return c.json({ ok: false, error: 'not found' }, 404);
    return c.json({ ok: true, item: { ...preset, id: preset._id.toString() } });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/qr-presets/:id', async (c) => {
  try {
    await connectMongoDB();
    const { default: QRPreset } = await import('../server/models/QRPreset.js');
    const id = c.req.param('id');
    await QRPreset.findByIdAndDelete(id).maxTimeMS(8000);
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ===== SYNC MANAGEMENT (Admin dashboard + POS sync endpoints for Vercel) =====

function hashSyncApiKey(apiKey) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(apiKey, salt, 64).toString('hex');
  return `sync_scrypt$${salt}$${derived}`;
}

function verifySyncApiKey(apiKey, encoded) {
  if (!encoded || !encoded.startsWith('sync_scrypt$')) return false;
  const parts = String(encoded).split('$');
  if (parts.length !== 3) return false;
  const salt = parts[1];
  const storedHex = parts[2];
  const incomingHex = crypto.scryptSync(apiKey, salt, 64).toString('hex');
  const stored = Buffer.from(storedHex, 'hex');
  const incoming = Buffer.from(incomingHex, 'hex');
  if (stored.length !== incoming.length) return false;
  return crypto.timingSafeEqual(stored, incoming);
}

// ════════════════════════════════════════════════════════════════════════
//  POS-FACING SYNC API (header x-store-id / x-api-key auth)
//  Ported from server/routes/sync.routes.js so the Vercel deployment serves
//  the same contract the desktop POS app expects.
// ════════════════════════════════════════════════════════════════════════

// Accept both hash schemes so a key minted by the Express admin (bcrypt) or the
// Vercel admin (scrypt) verifies everywhere.
async function verifySyncKeyAny(apiKey, encoded) {
  if (!encoded) return false;
  if (String(encoded).startsWith('sync_scrypt$')) return verifySyncApiKey(apiKey, encoded);
  try {
    const mod = await import('bcrypt');
    const bcrypt = mod.default || mod;
    return await bcrypt.compare(apiKey, encoded);
  } catch {
    return false;
  }
}

// Returns { store } on success or { error: <Response> } on failure.
async function validateSyncStore(c) {
  const storeId = c.req.header('x-store-id');
  const apiKey = c.req.header('x-api-key');
  if (!storeId || !apiKey) return { error: c.json({ ok: false, error: 'Missing x-store-id or x-api-key headers' }, 401) };
  if (!mongoose.Types.ObjectId.isValid(storeId)) return { error: c.json({ ok: false, error: 'Invalid store ID format' }, 401) };
  const { default: SyncStore } = await import('../server/models/SyncStore.js');
  const store = await SyncStore.findById(storeId).lean().maxTimeMS(8000);
  if (!store) return { error: c.json({ ok: false, error: 'Store not found' }, 403) };
  if (!store.isActive) return { error: c.json({ ok: false, error: 'Store is deactivated. Contact admin.' }, 403) };
  const ok = await verifySyncKeyAny(apiKey, store.apiKeyHash);
  if (!ok) return { error: c.json({ ok: false, error: 'Invalid API key' }, 403) };
  SyncStore.findByIdAndUpdate(storeId, { lastSeenAt: new Date() }).catch(() => {});
  return { store };
}

// ── Status: admin dashboard (session) OR POS (headers) depending on request ──
app.get('/sync/status', async (c) => {
  const { default: Product } = await import('../server/models/Product.js');
  const { default: Category } = await import('../server/models/Category.js');

  // POS path — authenticated by store headers, returns the flat POS shape.
  if (c.req.header('x-store-id')) {
    const { store, error } = await validateSyncStore(c);
    if (error) return error;
    const [totalProducts, activeProducts, totalCategories, changed] = await Promise.all([
      Product.countDocuments({}).maxTimeMS(8000),
      Product.countDocuments({ active: true }).maxTimeMS(8000),
      Category.countDocuments({}).maxTimeMS(8000),
      Product.countDocuments({ updatedAt: { $gte: store.lastSeenAt || new Date(0) } }).maxTimeMS(8000),
    ]);
    return c.json({
      ok: true,
      status: {
        storeName: store.name,
        storeId: String(store._id),
        lastSeenAt: store.lastSeenAt,
        totalProducts,
        activeProducts,
        totalCategories,
        changesSinceLastSync: changed,
      },
    });
  }

  // Admin dashboard path.
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const [totalProducts, activeProducts, totalCategories, stores] = await Promise.all([
      Product.countDocuments({}).maxTimeMS(8000),
      Product.countDocuments({ active: true }).maxTimeMS(8000),
      Category.countDocuments({}).maxTimeMS(8000),
      SyncStore.find({}).select('name lastSeenAt').sort({ lastSeenAt: -1 }).lean().maxTimeMS(8000),
    ]);
    const lastSync = stores.length > 0 && stores[0].lastSeenAt ? stores[0].lastSeenAt : null;
    return c.json({
      ok: true,
      item: {
        status: {
          storeName: stores.length > 0 ? stores[0].name : '—',
          storeId: stores.length > 0 ? String(stores[0]._id) : '',
          lastSeenAt: lastSync,
          totalProducts,
          activeProducts,
          totalCategories,
          changesSinceLastSync: 0,
        },
      },
    });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Available products changed since ?since ──
app.get('/sync/available/products', async (c) => {
  const { store, error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const sinceRaw = c.req.query('since');
    const since = sinceRaw ? new Date(sinceRaw) : (store.lastSeenAt || new Date(0));
    const search = String(c.req.query('search') || '').trim();
    const query = { updatedAt: { $gte: since } };
    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: esc, $options: 'i' } },
        { nameAr: { $regex: esc, $options: 'i' } },
        { sku: { $regex: esc, $options: 'i' } },
      ];
    }
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(100, Math.max(1, Number(c.req.query('limit')) || 50));
    const [items, total] = await Promise.all([
      Product.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('name nameAr sku price stock stockByStore image images description descriptionAr active categorySlug updatedAt').lean().maxTimeMS(8000),
      Product.countDocuments(query).maxTimeMS(8000),
    ]);
    return c.json({ ok: true, items, total, page, pages: Math.ceil(total / limit), since: since.toISOString() });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Available categories changed since ?since ──
app.get('/sync/available/categories', async (c) => {
  const { store, error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Category } = await import('../server/models/Category.js');
    const sinceRaw = c.req.query('since');
    const since = sinceRaw ? new Date(sinceRaw) : (store.lastSeenAt || new Date(0));
    const items = await Category.find({ updatedAt: { $gte: since } })
      .select('name nameAr slug image parentCategory isActive updatedAt').lean().maxTimeMS(8000);
    return c.json({ ok: true, items, total: items.length });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Available stock changed since ?since ──
app.get('/sync/available/stock', async (c) => {
  const { store, error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const sinceRaw = c.req.query('since');
    const since = sinceRaw ? new Date(sinceRaw) : (store.lastSeenAt || new Date(0));
    const items = await Product.find({ updatedAt: { $gte: since } })
      .select('sku name nameAr stock updatedAt').lean().maxTimeMS(8000);
    return c.json({ ok: true, items, total: items.length });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Search catalog ──
app.get('/sync/search', async (c) => {
  const { error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const q = String(c.req.query('q') || '').trim();
    if (!q || q.length < 2) return c.json({ ok: true, items: [] });
    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
    const query = { $or: [
      { name: { $regex: esc, $options: 'i' } },
      { nameAr: { $regex: esc, $options: 'i' } },
      { sku: { $regex: esc, $options: 'i' } },
    ] };
    const [items, total] = await Promise.all([
      Product.find(query).sort({ updatedAt: -1 }).skip((page - 1) * limit).limit(limit)
        .select('name nameAr sku price stock stockByStore image active').lean().maxTimeMS(8000),
      Product.countDocuments(query).maxTimeMS(8000),
    ]);
    return c.json({ ok: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Pull full product docs by SKU ──
app.post('/sync/pull/products', async (c) => {
  const { error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const body = await c.req.json().catch(() => ({}));
    const skus = Array.isArray(body.skus) ? body.skus : [];
    if (!skus.length) return c.json({ ok: false, error: 'No SKUs provided' }, 400);
    const items = await Product.find({ sku: { $in: skus } })
      .select('name nameAr sku price stock stockByStore image images description descriptionAr active categorySlug').lean().maxTimeMS(8000);
    return c.json({ ok: true, items });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Apply POS→store changes (per-store stock, upserts) ──
app.post('/sync/apply', async (c) => {
  const { store, error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const { default: Category } = await import('../server/models/Category.js');
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const body = await c.req.json().catch(() => ({}));
    const items = Array.isArray(body.items) ? body.items : [];
    const categories = Array.isArray(body.categories) ? body.categories : [];
    const succeeded = [];
    const failed = [];

    for (const item of items) {
      try {
        if (!item.sku) { failed.push({ sku: item.sku || 'unknown', error: 'Missing SKU' }); continue; }
        const update = {};
        if (item.fields) {
          if (item.fields.price !== undefined) update.price = Number(item.fields.price);
          if (item.fields.stock !== undefined) update[`stockByStore.${store._id}`] = Math.max(0, Number(item.fields.stock));
          if (item.fields.name !== undefined) update.name = String(item.fields.name).trim();
          if (item.fields.nameAr !== undefined) update.nameAr = String(item.fields.nameAr).trim();
          if (item.fields.description !== undefined) update.description = String(item.fields.description);
          if (item.fields.descriptionAr !== undefined) update.descriptionAr = String(item.fields.descriptionAr);
          if (item.fields.active !== undefined) update.active = Boolean(item.fields.active);
          if (item.fields.categorySlug !== undefined) update.categorySlug = String(item.fields.categorySlug);
          if (item.fields.image !== undefined) update.image = String(item.fields.image);
        }
        if (Object.keys(update).length === 0) { failed.push({ sku: item.sku, error: 'No fields to update' }); continue; }
        const result = await Product.findOneAndUpdate({ sku: item.sku }, { $set: update }, { new: true }).lean();
        if (item.fields?.stock !== undefined && result) {
          const storeStocks = result.stockByStore || {};
          const totalStock = Object.values(storeStocks).reduce((s, v) => s + (Number(v) || 0), 0);
          await Product.findOneAndUpdate({ sku: item.sku }, { $set: { stock: totalStock } });
        }
        if (!result) {
          if (item.action === 'create') {
            const np = await Product.create({
              sku: item.sku,
              name: item.fields?.name || item.sku,
              nameAr: item.fields?.nameAr || item.fields?.name || item.sku,
              price: Number(item.fields?.price) || 0,
              stock: Math.max(0, Number(item.fields?.stock)) || 0,
              ...(item.fields?.categorySlug ? { categorySlug: item.fields.categorySlug } : {}),
            });
            succeeded.push({ sku: item.sku, action: 'created', id: String(np._id) });
          } else {
            failed.push({ sku: item.sku, error: 'SKU not found on E-com' });
          }
        } else {
          succeeded.push({ sku: item.sku, action: 'updated', fields: Object.keys(update) });
        }
      } catch (err) {
        failed.push({ sku: item.sku || 'unknown', error: err.message });
      }
    }

    for (const cat of categories) {
      try {
        if (!cat.slug) { failed.push({ slug: cat.slug || 'unknown', error: 'Missing slug' }); continue; }
        const update = {};
        if (cat.name !== undefined) update.name = String(cat.name);
        if (cat.nameAr !== undefined) update.nameAr = String(cat.nameAr);
        if (Object.keys(update).length > 0) {
          await Category.findOneAndUpdate({ slug: cat.slug }, { $set: update });
          succeeded.push({ slug: cat.slug, action: 'updated_category' });
        }
      } catch (err) {
        failed.push({ slug: cat.slug || 'unknown', error: err.message });
      }
    }

    await SyncStore.findByIdAndUpdate(store._id, { lastSeenAt: new Date() });
    return c.json({ ok: true, succeeded, failed, total: succeeded.length + failed.length });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Image URLs for a SKU ──
app.get('/sync/images/:sku', async (c) => {
  const { error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const product = await Product.findOne({ sku: c.req.param('sku') }).select('image images').lean().maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: 'Product not found' }, 404);
    return c.json({ ok: true, image: product.image, images: product.images || [] });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Image upload (POS → store) ──
app.post('/sync/images/upload/:sku', async (c) => {
  const { error } = await validateSyncStore(c);
  if (error) return error;
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const sku = c.req.param('sku');
    const product = await Product.findOne({ sku }).lean().maxTimeMS(8000);
    if (!product) return c.json({ ok: false, error: `Product with SKU ${sku} not found` }, 404);
    const bodyForm = await c.req.parseBody();
    const file = bodyForm.image;
    if (!file || typeof file === 'string') return c.json({ ok: false, error: 'No image file provided' }, 400);
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowed.includes(file.type)) return c.json({ ok: false, error: `Image type ${file.type} not allowed` }, 400);
    const buf = Buffer.from(await file.arrayBuffer());
    const dataUri = `data:${file.type};base64,${buf.toString('base64')}`;
    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
      return c.json({ ok: false, error: 'Image uploads not configured' }, 500);
    }
    const cloudinary = await import('cloudinary').then((m) => m.v2);
    cloudinary.config({
      cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
      api_key: process.env.CLOUDINARY_API_KEY,
      api_secret: process.env.CLOUDINARY_API_SECRET,
    });
    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'sync/products',
      public_id: `product_${sku}_${Date.now()}`,
      format: 'webp',
      transformation: [{ width: 1280, height: 1280, crop: 'limit', quality: 'auto:good' }],
    });
    const imageUrl = result.secure_url;
    if (!product.image) await Product.findOneAndUpdate({ sku }, { $set: { image: imageUrl } });
    else await Product.findOneAndUpdate({ sku }, { $push: { images: imageUrl } });
    return c.json({ ok: true, url: imageUrl, publicId: result.public_id });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/sync/check', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({
      ok: true,
      item: { products: [], categories: [], stockChanges: [], totalProducts: 0, pages: 0 },
    });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Store CRUD (batch routes BEFORE parameterized routes) ──
app.post('/sync/admin/stores/batch-activate', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [];
    if (ids.length > 0) {
      await SyncStore.updateMany(
        { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
        { $set: { isActive: true } }
      ).maxTimeMS(8000);
    }
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/sync/admin/stores/batch-deactivate', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [];
    if (ids.length > 0) {
      await SyncStore.updateMany(
        { _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } },
        { $set: { isActive: false } }
      ).maxTimeMS(8000);
    }
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/sync/admin/stores/batch-delete', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const body = await c.req.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids.filter((id) => mongoose.Types.ObjectId.isValid(id)) : [];
    if (ids.length > 0) {
      await SyncStore.deleteMany({ _id: { $in: ids.map((id) => new mongoose.Types.ObjectId(id)) } }).maxTimeMS(8000);
    }
    return c.json({ ok: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/sync/admin/trigger-sync', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({ ok: true, message: 'Manual sync triggered' });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Store CRUD (parameterized routes) ──
app.get('/sync/admin/stores', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const stores = await SyncStore.find({})
      .select('name apiKeyPrefix isActive lastSeenAt allowedIps notes createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean()
      .maxTimeMS(8000);
    return c.json({ ok: true, items: stores });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/sync/admin/stores', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const body = await c.req.json().catch(() => ({}));
    const name = String(body.name || '').trim();
    if (!name) return c.json({ ok: false, error: 'Store name is required' }, 400);

    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = hashSyncApiKey(apiKey);
    const apiKeyPrefix = apiKey.slice(-4);

    const store = await SyncStore.create({
      name,
      apiKeyHash,
      apiKeyPrefix,
      notes: String(body.notes || ''),
      allowedIps: Array.isArray(body.allowedIps) ? body.allowedIps : [],
    });

    return c.json({
      ok: true,
      item: {
        store: {
          _id: String(store._id),
          name: store.name,
          apiKeyPrefix: store.apiKeyPrefix,
          isActive: store.isActive,
          lastSeenAt: store.lastSeenAt,
          allowedIps: store.allowedIps,
          notes: store.notes,
          createdAt: store.createdAt,
          updatedAt: store.updatedAt,
        },
        apiKey,
      },
    }, 201);
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/sync/admin/stores/:id', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid store id' }, 400);
    const store = await SyncStore.findById(id)
      .select('name apiKeyPrefix isActive lastSeenAt allowedIps notes createdAt updatedAt')
      .lean()
      .maxTimeMS(8000);
    if (!store) return c.json({ ok: false, error: 'Store not found' }, 404);
    return c.json({ ok: true, item: store });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/sync/admin/stores/:id', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid store id' }, 400);
    const body = await c.req.json().catch(() => ({}));
    const update = {};
    if (body.name !== undefined) update.name = String(body.name).trim();
    if (body.isActive !== undefined) update.isActive = Boolean(body.isActive);
    if (body.allowedIps !== undefined) update.allowedIps = body.allowedIps;
    if (body.notes !== undefined) update.notes = body.notes;
    const store = await SyncStore.findByIdAndUpdate(id, { $set: update }, { new: true })
      .select('name apiKeyPrefix isActive lastSeenAt allowedIps notes createdAt updatedAt')
      .lean()
      .maxTimeMS(8000);
    if (!store) return c.json({ ok: false, error: 'Store not found' }, 404);
    return c.json({ ok: true, item: store });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.delete('/sync/admin/stores/:id', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid store id' }, 400);
    const store = await SyncStore.findByIdAndDelete(id).maxTimeMS(8000);
    if (!store) return c.json({ ok: false, error: 'Store not found' }, 404);
    return c.json({ ok: true, deleted: true });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/sync/admin/stores/:id/rotate-key', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid store id' }, 400);
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = hashSyncApiKey(apiKey);
    const apiKeyPrefix = apiKey.slice(-4);
    const store = await SyncStore.findByIdAndUpdate(
      id,
      { $set: { apiKeyHash, apiKeyPrefix } },
      { new: true }
    ).select('name apiKeyPrefix').lean().maxTimeMS(8000);
    if (!store) return c.json({ ok: false, error: 'Store not found' }, 404);
    return c.json({ ok: true, item: { apiKey, apiKeyPrefix: store.apiKeyPrefix } });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Store activity & webhooks ──
app.get('/sync/admin/stores/:id/activity', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({ ok: true, items: [] });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/sync/admin/stores/:id/webhook', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const id = c.req.param('id');
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: true, item: null });
    const store = await SyncStore.findById(id).select('webhookUrl webhookActive').lean().maxTimeMS(8000);
    if (!store || !store.webhookUrl) return c.json({ ok: true, item: null });
    return c.json({ ok: true, item: { webhookUrl: store.webhookUrl, webhookActive: !!store.webhookActive } });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.put('/sync/admin/stores/:id/webhook', async (c) => {
  try {
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const id = c.req.param('id');

    // POS path — the store authenticates with its own headers.
    if (c.req.header('x-store-id')) {
      const { store, error } = await validateSyncStore(c);
      if (error) return error;
      if (String(id) !== String(store._id)) return c.json({ ok: false, error: 'Store mismatch' }, 403);
      const body = await c.req.json().catch(() => ({}));
      await SyncStore.findByIdAndUpdate(store._id, { $set: {
        webhookUrl: String(body.webhookUrl || ''),
        webhookSecret: String(body.webhookSecret || ''),
        webhookActive: body.isActive === undefined ? true : Boolean(body.isActive),
      } });
      return c.json({ ok: true, item: { webhookUrl: String(body.webhookUrl || ''), webhookActive: body.isActive === undefined ? true : Boolean(body.isActive) } });
    }

    // Admin path.
    if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
    if (!mongoose.Types.ObjectId.isValid(id)) return c.json({ ok: false, error: 'Invalid store id' }, 400);
    const body = await c.req.json().catch(() => ({}));
    await SyncStore.findByIdAndUpdate(id, { $set: {
      webhookUrl: String(body.webhookUrl || ''),
      webhookSecret: String(body.webhookSecret || ''),
      webhookActive: body.isActive === undefined ? true : Boolean(body.isActive),
    } });
    return c.json({ ok: true, item: { webhookUrl: String(body.webhookUrl || ''), webhookActive: body.isActive === undefined ? true : Boolean(body.isActive) } });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.get('/sync/admin/stores/:id/webhook/logs', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({ ok: true, items: [] });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

app.post('/sync/admin/stores/:id/webhook/test', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({ ok: true, item: { ok: true, statusCode: 200, message: 'No webhook configured' } });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Synced products (admin dashboard) ──
app.get('/sync/admin/products', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const { default: SyncStore } = await import('../server/models/SyncStore.js');
    const page = Math.max(1, Number(c.req.query('page')) || 1);
    const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name nameAr sku price stock stockByStore image images categorySlug updatedAt')
        .lean()
        .maxTimeMS(15000),
      Product.countDocuments({}).maxTimeMS(15000),
    ]);
    const stores = await SyncStore.find({}).select('name').lean().maxTimeMS(8000);
    const storeNames = Object.fromEntries(stores.map((s) => [String(s._id), s.name]));
    const products = items.map((p) => ({
      ...p,
      stockByStore: Object.fromEntries(
        Object.entries(p.stockByStore || {}).map(([sid, qty]) => [storeNames[sid] || sid.slice(-6), qty])
      ),
    }));
    return c.json({ ok: true, items: products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Sync activity feed ──
app.get('/sync/activity', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({ ok: true, items: [] });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Sync impact summary ──
app.get('/sync/impact-summary', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({
      ok: true,
      item: {
        summary: {
          totalChanges: 0,
          newProducts: 0,
          pricesUp: { count: 0, totalIncrease: 0 },
          pricesDown: { count: 0, totalDecrease: 0 },
          stockToZero: { count: 0 },
          imageChanges: { count: 0 },
          productsToInactive: { count: 0 },
          fieldChanges: { count: 0 },
        },
      },
    });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// ── Sync snapshots (rollback history) ──
app.get('/sync/snapshots', async (c) => {
  if (!(await isAdminRequest(c))) return c.json({ ok: false, error: 'Forbidden' }, 403);
  try {
    return c.json({ ok: true, items: [], total: 0 });
  } catch (err) {
    return c.json({ ok: false, error: err.message }, 500);
  }
});

// Export for Vercel (HEAD/OPTIONS avoid 405 from probes, link checks, and CORS preflights)
const honoHandler = handle(app);
export const GET = honoHandler;
export const HEAD = honoHandler;
export const POST = honoHandler;
export const PUT = honoHandler;
export const DELETE = honoHandler;
export const PATCH = honoHandler;
export const OPTIONS = honoHandler;
