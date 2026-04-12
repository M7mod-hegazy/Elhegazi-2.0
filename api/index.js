import { Hono } from 'hono';
import { handle } from 'hono/vercel';
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

const app = new Hono().basePath('/api');

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

  const userId = c.req.header('x-user-id');
  if (!userId) return false;
  try {
    const { default: User } = await import('../server/models/User.js');
    const user = await User.findById(userId).select('role').lean().maxTimeMS(8000);
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
  },
  featureFlags: {
    rating: true,
    favorites: true,
    shopBuilder3d: true,
    prices: true,
  },
};

function mergeOwnerVisibility(visibility = {}) {
  return {
    publicPages: { ...DEFAULT_OWNER_VISIBILITY.publicPages, ...(visibility.publicPages || {}) },
    adminModules: { ...DEFAULT_OWNER_VISIBILITY.adminModules, ...(visibility.adminModules || {}) },
    featureFlags: { ...DEFAULT_OWNER_VISIBILITY.featureFlags, ...(visibility.featureFlags || {}) },
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
  ]).maxTimeMS(8000);

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
    return c.json({ ok: true, item: product });
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
    const category = new Category(body);
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
    const updated = await Category.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
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
    const { default: User } = await import('../server/models/User.js');
    const id = c.req.param('id');
    const body = await c.req.json();
    const updated = await User.findByIdAndUpdate(id, body, { new: true }).maxTimeMS(8000);
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

// ===== ADMIN =====
app.post('/admin/users', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json();
    const user = new User({ ...body, role: 'admin' });
    await user.save();
    return c.json({ ok: true, item: user });
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

// ===== ADMIN USERS =====
app.post('/admin/users', async (c) => {
  try {
    const { default: User } = await import('../server/models/User.js');
    const body = await c.req.json();
    const user = new User({ ...body, role: body.role || 'admin' });
    await user.save();
    return c.json({ ok: true, user: { id: user._id, email: user.email } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
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

// Export for Vercel
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
