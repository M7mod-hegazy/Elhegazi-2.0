import { Router } from 'express';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import multer from 'multer';
import validateSyncRequest from '../middleware/validateSyncRequest.js';
import SyncStore from '../models/SyncStore.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const router = Router();

const IMAGE_MB = 10;
const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: IMAGE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Image type ${file.mimetype} not allowed`));
  },
});

function toObjectId(id) {
  if (mongoose.Types.ObjectId.isValid(id)) return new mongoose.Types.ObjectId(id);
  return null;
}

/* ──────────────────────────────────────
   PING / HEALTH
   ────────────────────────────────────── */
router.get('/ping', validateSyncRequest, (_req, res) => {
  res.json({ ok: true, timestamp: new Date().toISOString() });
});

/* ──────────────────────────────────────
   STATUS — sync summary for this store
   ────────────────────────────────────── */
router.get('/status', validateSyncRequest, async (req, res) => {
  try {
    const storeId = req.syncStore._id;

    const totalProducts = await Product.countDocuments({});
    const activeProducts = await Product.countDocuments({ active: true });
    const totalCategories = await Category.countDocuments({});

    const changedProducts = await Product.countDocuments({
      updatedAt: { $gte: req.syncStore.lastSeenAt || new Date(0) },
    });

    res.json({
      ok: true,
      status: {
        storeName: req.syncStore.name,
        storeId: String(storeId),
        lastSeenAt: req.syncStore.lastSeenAt,
        totalProducts,
        activeProducts,
        totalCategories,
        changesSinceLastSync: changedProducts,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   AVAILABLE PRODUCTS — what's changed on
   the E-com side since last sync
   ────────────────────────────────────── */
router.get('/available/products', validateSyncRequest, async (req, res) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since)
      : (req.syncStore.lastSeenAt || new Date(0));
    const search = String(req.query.search || '').trim();

    let query = { updatedAt: { $gte: since } };

    if (search) {
      const esc = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { name: { $regex: esc, $options: 'i' } },
        { nameAr: { $regex: esc, $options: 'i' } },
        { sku: { $regex: esc, $options: 'i' } },
      ];
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name nameAr sku price stock stockByStore image images description descriptionAr active categorySlug updatedAt')
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({
      ok: true,
      items,
      total,
      page,
      pages: Math.ceil(total / limit),
      since: since.toISOString(),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   AVAILABLE CATEGORIES — changed since
   last sync
   ────────────────────────────────────── */
router.get('/available/categories', validateSyncRequest, async (req, res) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since)
      : (req.syncStore.lastSeenAt || new Date(0));

    const categories = await Category.find({ updatedAt: { $gte: since } })
      .sort({ updatedAt: -1 })
      .select('name nameAr slug image parentCategory isActive')
      .lean();

    res.json({ ok: true, items: categories });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   AVAILABLE STOCK — products where stock
   changed since last sync
   ────────────────────────────────────── */
router.get('/available/stock', validateSyncRequest, async (req, res) => {
  try {
    const since = req.query.since
      ? new Date(req.query.since)
      : (req.syncStore.lastSeenAt || new Date(0));

    const items = await Product.find({ updatedAt: { $gte: since } })
      .sort({ updatedAt: -1 })
      .select('sku name nameAr stock')
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   SEARCH — search the E-com product catalog
   Used by POS to find products to add to sync
   ────────────────────────────────────── */
router.get('/search', validateSyncRequest, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ ok: true, items: [] });
    }

    const esc = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));

    const query = {
      $or: [
        { name: { $regex: esc, $options: 'i' } },
        { nameAr: { $regex: esc, $options: 'i' } },
        { sku: { $regex: esc, $options: 'i' } },
      ],
    };

    const [items, total] = await Promise.all([
      Product.find(query)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select('name nameAr sku price stock stockByStore image active')
        .lean(),
      Product.countDocuments(query),
    ]);

    res.json({ ok: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   APPLY — POS pushes selected changes
   Body: { items: [{ sku, fields: { field: value } }] }
   ────────────────────────────────────── */
router.post('/apply', validateSyncRequest, async (req, res) => {
  try {
    const { items = [], categories = [] } = req.body;
    const succeeded = [];
    const failed = [];

    // Apply product changes
    for (const item of items) {
      try {
        if (!item.sku) {
          failed.push({ sku: item.sku || 'unknown', error: 'Missing SKU' });
          continue;
        }

        const update = {};
        if (item.fields) {
          if (item.fields.price !== undefined) update.price = Number(item.fields.price);
          if (item.fields.stock !== undefined) {
            update[`stockByStore.${req.syncStore._id}`] = Math.max(0, Number(item.fields.stock));
          }
          if (item.fields.name !== undefined) update.name = String(item.fields.name).trim();
          if (item.fields.nameAr !== undefined) update.nameAr = String(item.fields.nameAr).trim();
          if (item.fields.description !== undefined) update.description = String(item.fields.description);
          if (item.fields.descriptionAr !== undefined) update.descriptionAr = String(item.fields.descriptionAr);
          if (item.fields.active !== undefined) update.active = Boolean(item.fields.active);
          if (item.fields.categorySlug !== undefined) update.categorySlug = String(item.fields.categorySlug);
          if (item.fields.image !== undefined) update.image = String(item.fields.image);
        }

        if (Object.keys(update).length === 0) {
          failed.push({ sku: item.sku, error: 'No fields to update' });
          continue;
        }

        // Update product with stockByStore tracking
        const result = await Product.findOneAndUpdate(
          { sku: item.sku },
          { $set: update },
          { new: true }
        ).lean();

        // Recalculate total stock as sum of all stores
        if (item.fields?.stock !== undefined && result) {
          const storeStocks = result.stockByStore || {};
          const totalStock = Object.values(storeStocks).reduce((sum, v) => sum + (Number(v) || 0), 0);
          await Product.findOneAndUpdate({ sku: item.sku }, { $set: { stock: totalStock } });
        }

        if (!result) {
          // SKU not found — maybe create new product
          if (item.action === 'create') {
            const newProduct = await Product.create({
              sku: item.sku,
              name: item.fields?.name || item.sku,
              nameAr: item.fields?.nameAr || item.fields?.name || item.sku,
              price: Number(item.fields?.price) || 0,
              stock: Math.max(0, Number(item.fields?.stock)) || 0,
              ...(item.fields?.categorySlug ? { categorySlug: item.fields.categorySlug } : {}),
            });
            succeeded.push({ sku: item.sku, action: 'created', id: String(newProduct._id) });
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

    // Apply category changes
    for (const cat of categories) {
      try {
        if (!cat.slug) {
          failed.push({ slug: cat.slug || 'unknown', error: 'Missing slug' });
          continue;
        }
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

    // Update lastSeenAt
    await SyncStore.findByIdAndUpdate(req.syncStore._id, { lastSeenAt: new Date() });

    res.json({
      ok: true,
      succeeded,
      failed,
      total: succeeded.length + failed.length,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   PULL — POS requests product data
   Body: { skus: ["SH-001", ...] }
   ────────────────────────────────────── */
router.post('/pull/products', validateSyncRequest, async (req, res) => {
  try {
    const { skus = [] } = req.body;
    if (!skus.length) {
      return res.status(400).json({ ok: false, error: 'No SKUs provided' });
    }

    const items = await Product.find({ sku: { $in: skus } })
      .select('name nameAr sku price stock stockByStore image images description descriptionAr active categorySlug')
      .lean();

    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   IMAGE UPLOAD — POS sends image file,
   E-com uploads to Cloudinary
   POST /api/sync/images/upload/:sku
   ────────────────────────────────────── */
router.post('/images/upload/:sku', validateSyncRequest, imageUpload.single('image'), async (req, res) => {
  try {
    const { sku } = req.params;
    if (!req.file) {
      return res.status(400).json({ ok: false, error: 'No image file provided' });
    }

    const product = await Product.findOne({ sku }).lean();
    if (!product) {
      return res.status(404).json({ ok: false, error: `Product with SKU ${sku} not found` });
    }

    const b64 = req.file.buffer.toString('base64');
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: 'sync/products',
      public_id: `product_${sku}_${Date.now()}`,
      format: 'webp',
      transformation: [{ width: 1280, height: 1280, crop: 'limit', quality: 'auto:good' }],
    });

    const imageUrl = result.secure_url;

    // Update product: set as main image if none, else add to images array
    if (!product.image) {
      await Product.findOneAndUpdate({ sku }, { $set: { image: imageUrl } });
    } else {
      await Product.findOneAndUpdate({ sku }, { $push: { images: imageUrl } });
    }

    res.json({ ok: true, url: imageUrl, publicId: result.public_id });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   IMAGE GET — return image URLs for a
   product so POS can download
   ────────────────────────────────────── */
router.get('/images/:sku', validateSyncRequest, async (req, res) => {
  try {
    const product = await Product.findOne({ sku: req.params.sku })
      .select('image images')
      .lean();

    if (!product) {
      return res.status(404).json({ ok: false, error: 'Product not found' });
    }

    res.json({
      ok: true,
      image: product.image,
      images: product.images || [],
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   RESOLVE CONFLICT — user decided how to
   handle a SKU conflict
   Body: { sku, action: "merge"|"separate"|"skip",
           targetStoreId (for merge) }
   ────────────────────────────────────── */
router.post('/resolve-conflict', validateSyncRequest, async (req, res) => {
  try {
    const { sku, action, targetSku } = req.body;
    if (!sku || !action) {
      return res.status(400).json({ ok: false, error: 'Missing sku or action' });
    }

    const result = { sku, action };

    // For now, just log the resolution decision
    // Actual merging logic depends on the specific conflict handling requirements
    result.resolved = true;

    res.json({ ok: true, result });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   STORE CRUD — admin endpoints for
   managing sync stores + generating keys
   ────────────────────────────────────── */
router.get('/admin/stores', async (req, res) => {
  try {
    const stores = await SyncStore.find({})
      .select('name apiKeyPrefix isActive lastSeenAt createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ ok: true, items: stores });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/stores', async (req, res) => {
  try {
    const { name, notes } = req.body;
    if (!name || !String(name).trim()) {
      return res.status(400).json({ ok: false, error: 'Store name is required' });
    }

    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(apiKey, 10);
    const apiKeyPrefix = apiKey.slice(-4);

    const store = await SyncStore.create({
      name: String(name).trim(),
      apiKeyHash,
      apiKeyPrefix,
      notes: notes || '',
    });

    res.json({
      ok: true,
      store: {
        _id: store._id,
        name: store.name,
        apiKey,
        apiKeyPrefix: store.apiKeyPrefix,
      },
      message: 'Save this API key — it will not be shown again.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.put('/admin/stores/:id', async (req, res) => {
  try {
    const { name, isActive, allowedIps, notes } = req.body;
    const update = {};
    if (name !== undefined) update.name = String(name).trim();
    if (isActive !== undefined) update.isActive = Boolean(isActive);
    if (allowedIps !== undefined) update.allowedIps = allowedIps;
    if (notes !== undefined) update.notes = notes;

    const store = await SyncStore.findByIdAndUpdate(req.params.id, { $set: update }, { new: true })
      .select('name apiKeyPrefix isActive lastSeenAt allowedIps notes')
      .lean();

    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });
    res.json({ ok: true, store });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.delete('/admin/stores/:id', async (req, res) => {
  try {
    const store = await SyncStore.findByIdAndDelete(req.params.id);
    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });
    res.json({ ok: true, deleted: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post('/admin/stores/:id/rotate-key', async (req, res) => {
  try {
    const apiKey = crypto.randomBytes(32).toString('hex');
    const apiKeyHash = await bcrypt.hash(apiKey, 10);
    const apiKeyPrefix = apiKey.slice(-4);

    const store = await SyncStore.findByIdAndUpdate(
      req.params.id,
      { $set: { apiKeyHash, apiKeyPrefix } },
      { new: true }
    ).select('name apiKeyPrefix').lean();

    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });

    res.json({
      ok: true,
      apiKey,
      apiKeyPrefix: store.apiKeyPrefix,
      message: 'Save this new API key — it will not be shown again.',
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── GET /api/sync/admin/products — synced products for admin dashboard ──
router.get('/admin/products', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      Product.find({})
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .select('name nameAr sku price stock stockByStore image images categorySlug updatedAt')
        .lean(),
      Product.countDocuments({}),
    ]);

    const stores = await SyncStore.find({}).select('name').lean();
    const storeNames = Object.fromEntries(stores.map((s) => [String(s._id), s.name]));

    const products = items.map((p) => ({
      ...p,
      stockByStore: Object.fromEntries(
        Object.entries(p.stockByStore || {}).map(([id, qty]) => [storeNames[id] || id.slice(-6), qty])
      ),
    }));

    res.json({ ok: true, items: products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
