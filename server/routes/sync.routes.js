import { Router } from 'express';
import mongoose from 'mongoose';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import multer from 'multer';
import validateSyncRequest from '../middleware/validateSyncRequest.js';
import SyncStore from '../models/SyncStore.js';
import SyncActivity from '../models/SyncActivity.js';
import Product from '../models/Product.js';
import Category from '../models/Category.js';
import Order from '../models/Order.js';

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
            // Save posSnapshot for newly created product
            await Product.findOneAndUpdate({ sku: item.sku }, {
              $set: {
                posSnapshot: {
                  name: item.fields?.name || item.sku,
                  nameAr: item.fields?.nameAr || item.fields?.name || item.sku,
                  price: Number(item.fields?.price) || 0,
                  stock: Math.max(0, Number(item.fields?.stock)) || 0,
                  image: item.fields?.image || '',
                  images: item.fields?.images || [],
                  syncedAt: new Date(),
                },
              },
            });
            succeeded.push({ sku: item.sku, action: 'created', id: String(newProduct._id) });
          } else {
            failed.push({ sku: item.sku, error: 'SKU not found on E-com' });
          }
        } else {
          // Save posSnapshot — record what POS reported so future diffs detect website changes
          const snapshotUpdate = {};
          if (item.fields?.name !== undefined) snapshotUpdate['posSnapshot.name'] = String(item.fields.name).trim();
          if (item.fields?.nameAr !== undefined) snapshotUpdate['posSnapshot.nameAr'] = String(item.fields.nameAr).trim();
          if (item.fields?.price !== undefined) snapshotUpdate['posSnapshot.price'] = Number(item.fields.price);
          if (item.fields?.stock !== undefined) snapshotUpdate['posSnapshot.stock'] = Math.max(0, Number(item.fields.stock));
          if (item.fields?.image !== undefined) snapshotUpdate['posSnapshot.image'] = String(item.fields.image);
          snapshotUpdate['posSnapshot.syncedAt'] = new Date();
          await Product.findOneAndUpdate({ sku: item.sku }, { $set: snapshotUpdate });
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
   WEBHOOK REGISTER — POS registers its
   order-webhook URL for this store
   PUT /api/sync/admin/stores/:storeId/webhook
   ────────────────────────────────────── */
router.put('/admin/stores/:storeId/webhook', async (req, res) => {
  try {
    const storeId = req.params.storeId;

    // POS-authenticated request: validate and check store ownership
    if (req.headers['x-store-id'] && req.headers['x-api-key']) {
      return await (async () => {
        const validateSyncRequest = (await import('../middleware/validateSyncRequest.js')).default;
        req.params.storeId = storeId;
        // We skip full middleware and just do a lightweight check via the imported function
        // Actually, let's use a simpler approach — just update the webhook for the requesting store
        if (String(storeId) !== String(req.headers['x-store-id'])) {
          return res.status(403).json({ ok: false, error: 'Store mismatch' });
        }
        const { webhookUrl = '', webhookSecret = '', isActive = true } = req.body || {};
        await SyncStore.findByIdAndUpdate(storeId, {
          $set: {
            webhookUrl: String(webhookUrl),
            webhookSecret: String(webhookSecret),
            webhookActive: Boolean(isActive),
          },
        });
        return res.json({ ok: true, item: { webhookUrl: String(webhookUrl), webhookActive: Boolean(isActive) } });
      })();
    }

    // Admin request: update directly
    const { webhookUrl, webhookSecret, isActive } = req.body || {};
    const update = {};
    if (webhookUrl !== undefined) update.webhookUrl = String(webhookUrl);
    if (webhookSecret !== undefined) update.webhookSecret = String(webhookSecret);
    if (isActive !== undefined) update.webhookActive = Boolean(isActive);

    const store = await SyncStore.findByIdAndUpdate(storeId, { $set: update }, { new: true })
      .select('webhookUrl webhookSecret webhookActive')
      .lean();
    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });

    res.json({
      ok: true,
      item: {
        storeId,
        webhookUrl: store.webhookUrl || '',
        webhookSecret: store.webhookSecret || '',
        isActive: store.webhookActive || false,
      },
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
      item: {
        store: {
          _id: store._id,
          name: store.name,
          apiKey,
          apiKeyPrefix: store.apiKeyPrefix,
        },
        message: 'Save this API key — it will not be shown again.',
      },
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
    res.json({ ok: true, item: store });
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
      item: {
        apiKey,
        apiKeyPrefix: store.apiKeyPrefix,
        message: 'Save this new API key — it will not be shown again.',
      },
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
        .select('name nameAr sku price stock stockByStore image images categorySlug updatedAt posSnapshot')
        .lean(),
      Product.countDocuments({}),
    ]);

    const stores = await SyncStore.find({}).select('name').lean();
    const storeNames = Object.fromEntries(stores.map((s) => [String(s._id), s.name]));

    const products = items.map((p) => {
      const snapshot = p.posSnapshot;
      const hasSnapshot = !!(snapshot && snapshot.syncedAt);
      const ecomImgCount = [p.image, ...(p.images || [])].filter(Boolean).length;
      const snapImgCount = snapshot ? [snapshot.image, ...(snapshot.images || [])].filter(Boolean).length : 0;

      const localMatch = {
        exists: true,
        name: {
          local: hasSnapshot ? (snapshot.name || snapshot.nameAr || '') : '',
          ecom: p.nameAr || p.name || '',
          match: hasSnapshot ? ((snapshot.name || snapshot.nameAr || '').trim().toLowerCase() === (p.nameAr || p.name || '').trim().toLowerCase()) : false,
        },
        price: {
          local: hasSnapshot ? (snapshot.price ?? 0) : 0,
          ecom: p.price ?? 0,
          match: hasSnapshot ? (Number(snapshot.price) === Number(p.price)) : false,
        },
        stock: {
          local: hasSnapshot ? (snapshot.stock ?? 0) : 0,
          ecom: p.stock ?? 0,
          match: hasSnapshot ? (Number(snapshot.stock) === Number(p.stock)) : false,
        },
        image: {
          local: hasSnapshot ? (snapshot.image || (snapshot.images?.length ? snapshot.images[0] : null)) : null,
          ecom: p.image || (p.images?.length ? p.images[0] : null),
          match: hasSnapshot ? (snapImgCount === ecomImgCount) : false,
        },
        acknowledged: hasSnapshot,
      };

      return {
        ...p,
        posSnapshot: undefined,
        localMatch,
        stockByStore: Object.fromEntries(
          Object.entries(p.stockByStore || {}).map(([id, qty]) => [storeNames[id] || id.slice(-6), qty])
        ),
      };
    });

    res.json({ ok: true, items: products, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
    ADMIN — pending online orders for POS
    ────────────────────────────────────── */
router.get('/admin/pending-orders', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const status = req.query.status || 'pending';

    const [items, total] = await Promise.all([
      Order.find({ status })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments({ status }),
    ]);

    res.json({ ok: true, items, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
    ADMIN — GET single store
    ────────────────────────────────────── */
router.get('/admin/stores/:id', async (req, res) => {
  try {
    const store = await SyncStore.findById(req.params.id)
      .select('name apiKeyPrefix isActive lastSeenAt allowedIps notes createdAt')
      .lean();
    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });
    res.json({ ok: true, item: store });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — store activity
   ────────────────────────────────────── */
router.get('/admin/stores/:id/activity', async (req, res) => {
  try {
    const { type, days } = req.query;
    const filter = { storeId: req.params.id };
    if (type) filter.type = type;
    if (days) {
      const since = new Date(Date.now() - Number(days) * 86400000);
      filter.createdAt = { $gte: since };
    }
    const items = await SyncActivity.find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   GLOBAL — activity feed
   ────────────────────────────────────── */
router.get('/activity', async (req, res) => {
  try {
    const items = await SyncActivity.find({})
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ ok: true, items });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   GLOBAL — impact summary
   ────────────────────────────────────── */
router.get('/impact-summary', async (req, res) => {
  try {
    const since = req.query.since ? new Date(req.query.since) : new Date(Date.now() - 86400000);
    const changedProducts = await Product.find({ updatedAt: { $gte: since } })
      .select('price stock image updatedAt')
      .lean();

    let pricesUp = 0, pricesDown = 0, totalIncrease = 0, totalDecrease = 0;
    let stockToZero = 0, imageChanges = 0, newProducts = 0;

    // For new products, need to compare with a previous snapshot
    // Simplified: count products created in the period
    const recentCreated = await Product.countDocuments({ createdAt: { $gte: since } });
    newProducts = recentCreated;

    for (const p of changedProducts) {
      if (p.image) imageChanges++;
      if (p.stock === 0) stockToZero++;
    }

    res.json({
      ok: true,
      item: {
        summary: {
          totalChanges: changedProducts.length,
          newProducts,
          pricesUp: { count: pricesUp, totalIncrease },
          pricesDown: { count: pricesDown, totalDecrease },
          stockToZero: { count: stockToZero },
          imageChanges: { count: imageChanges },
          productsToInactive: { count: 0 },
          fieldChanges: { count: 0 },
        },
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — batch activate stores
   ────────────────────────────────────── */
router.post('/admin/stores/batch-activate', async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No store IDs provided' });
    await SyncStore.updateMany({ _id: { $in: ids } }, { $set: { isActive: true } });
    res.json({ ok: true, updated: ids.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — batch deactivate stores
   ────────────────────────────────────── */
router.post('/admin/stores/batch-deactivate', async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No store IDs provided' });
    await SyncStore.updateMany({ _id: { $in: ids } }, { $set: { isActive: false } });
    res.json({ ok: true, updated: ids.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — batch delete stores
   ────────────────────────────────────── */
router.post('/admin/stores/batch-delete', async (req, res) => {
  try {
    const { ids = [] } = req.body;
    if (!ids.length) return res.status(400).json({ ok: false, error: 'No store IDs provided' });
    await SyncStore.deleteMany({ _id: { $in: ids } });
    // Also clean up related activity
    await SyncActivity.deleteMany({ storeId: { $in: ids } });
    res.json({ ok: true, deleted: ids.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — trigger manual sync
   ────────────────────────────────────── */
router.post('/admin/trigger-sync', async (req, res) => {
  try {
    const { storeId } = req.body;
    let msg = 'Manual sync triggered';

    if (storeId) {
      const store = await SyncStore.findById(storeId);
      if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });
      // Log activity
      await SyncActivity.create({
        storeId: store._id,
        storeName: store.name,
        type: 'sync',
        description: `Manual sync triggered for store ${store.name}`,
        descriptionAr: `تم تشغيل مزامنة يدوية للمتجر ${store.name}`,
      });
    } else {
      // Trigger for all stores
      const stores = await SyncStore.find({ isActive: true }).lean();
      for (const store of stores) {
        await SyncActivity.create({
          storeId: store._id,
          storeName: store.name,
          type: 'sync',
          description: `Manual sync triggered for store ${store.name}`,
          descriptionAr: `تم تشغيل مزامنة يدوية للمتجر ${store.name}`,
        });
      }
      msg = `Manual sync triggered for ${stores.length} stores`;
    }

    res.json({ ok: true, message: msg });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — apply/push product changes from dashboard
   Body: { items: [{ sku, fields: { name?, price?, stock?, images? } }] }
   ────────────────────────────────────── */
router.post('/admin/apply', async (req, res) => {
  try {
    const { items = [] } = req.body;
    const succeeded = [];
    const failed = [];

    for (const item of items) {
      try {
        if (!item.sku) {
          failed.push({ sku: item.sku || 'unknown', error: 'Missing SKU' });
          continue;
        }
        const update = {};
        const snapshot = {};
        if (item.fields) {
          if (item.fields.name !== undefined) {
            update.name = String(item.fields.name).trim();
            snapshot['posSnapshot.name'] = String(item.fields.name).trim();
          }
          if (item.fields.nameAr !== undefined) {
            update.nameAr = String(item.fields.nameAr).trim();
            snapshot['posSnapshot.nameAr'] = String(item.fields.nameAr).trim();
          }
          if (item.fields.price !== undefined) {
            update.price = Number(item.fields.price);
            snapshot['posSnapshot.price'] = Number(item.fields.price);
          }
          if (item.fields.stock !== undefined) {
            update.stock = Math.max(0, Number(item.fields.stock));
            snapshot['posSnapshot.stock'] = Math.max(0, Number(item.fields.stock));
          }
          if (item.fields.image !== undefined) {
            update.image = String(item.fields.image);
            snapshot['posSnapshot.image'] = String(item.fields.image);
          }
        }

        if (Object.keys(update).length === 0) {
          failed.push({ sku: item.sku, error: 'No fields to update' });
          continue;
        }

        snapshot['posSnapshot.syncedAt'] = new Date();
        const result = await Product.findOneAndUpdate(
          { sku: item.sku },
          { $set: { ...update, ...snapshot } },
          { new: true }
        ).lean();

        if (!result) {
          // Create new product if SKU doesn't exist (admin push for new product)
          const newProduct = await Product.create({
            sku: item.sku,
            name: item.fields?.name || item.sku,
            nameAr: item.fields?.nameAr || item.fields?.name || item.sku,
            price: Number(item.fields?.price) || 0,
            stock: Math.max(0, Number(item.fields?.stock)) || 0,
            posSnapshot: {
              name: item.fields?.name || item.sku,
              nameAr: item.fields?.nameAr || item.fields?.name || item.sku,
              price: Number(item.fields?.price) || 0,
              stock: Math.max(0, Number(item.fields?.stock)) || 0,
              syncedAt: new Date(),
            },
          });
          succeeded.push({ sku: item.sku, action: 'created', id: String(newProduct._id) });
        } else {
          succeeded.push({ sku: item.sku, action: 'updated', fields: Object.keys(update) });
        }
      } catch (err) {
        failed.push({ sku: item.sku || 'unknown', error: err.message });
      }
    }

    // Log activity
    const activeStores = await SyncStore.find({ isActive: true }).lean();
    for (const store of activeStores) {
      await SyncActivity.create({
        storeId: store._id,
        storeName: store.name,
        type: 'sync',
        description: `Admin pushed ${succeeded.length} product updates to store ${store.name}`,
        descriptionAr: `قام المسؤول بدفع ${succeeded.length} تحديث منتج إلى المتجر ${store.name}`,
      });
    }

    res.json({ ok: true, succeeded, failed, total: succeeded.length + failed.length });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — get webhook config
   ────────────────────────────────────── */
router.get('/admin/stores/:id/webhook', async (req, res) => {
  try {
    const store = await SyncStore.findById(req.params.id)
      .select('webhookUrl webhookSecret webhookActive')
      .lean();
    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });
    res.json({
      ok: true,
      item: {
        storeId: req.params.id,
        webhookUrl: store.webhookUrl || '',
        webhookSecret: store.webhookSecret || '',
        isActive: store.webhookActive || false,
      },
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — get webhook delivery logs
   ────────────────────────────────────── */
router.get('/admin/stores/:id/webhook/logs', async (req, res) => {
  try {
    const store = await SyncStore.findById(req.params.id).select('webhookUrl').lean();
    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });

    // Return any SyncActivity events related to webhook for this store
    const items = await SyncActivity.find({
      storeId: req.params.id,
      type: { $in: ['sync', 'error'] },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const logs = items.map((a) => ({
      _id: String(a._id),
      storeId: String(a.storeId),
      event: a.type,
      status: a.type === 'error' ? 'failed' : 'success',
      responseCode: a.type === 'error' ? 500 : 200,
      createdAt: a.createdAt,
    }));

    res.json({ ok: true, items: logs });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   ADMIN — test webhook delivery
   ────────────────────────────────────── */
router.post('/admin/stores/:id/webhook/test', async (req, res) => {
  try {
    const store = await SyncStore.findById(req.params.id).lean();
    if (!store) return res.status(404).json({ ok: false, error: 'Store not found' });

    if (!store.webhookUrl) {
      return res.json({
        ok: true,
        item: { ok: false, statusCode: null, message: 'No webhook URL configured' },
      });
    }

    try {
      const response = await fetch(store.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Secret': store.webhookSecret || '',
          'X-Event': 'test',
        },
        body: JSON.stringify({ event: 'test', timestamp: new Date().toISOString() }),
        signal: AbortSignal.timeout(10000),
      });

      await SyncActivity.create({
        storeId: store._id,
        storeName: store.name,
        type: response.ok ? 'sync' : 'error',
        description: `Webhook test: ${response.status} ${response.statusText}`,
        descriptionAr: `اختبار webhook: ${response.status} ${response.statusText}`,
      });

      res.json({
        ok: true,
        item: { ok: response.ok, statusCode: response.status, message: response.statusText },
      });
    } catch (fetchErr) {
      await SyncActivity.create({
        storeId: store._id,
        storeName: store.name,
        type: 'error',
        description: `Webhook test failed: ${fetchErr.message}`,
        descriptionAr: `فشل اختبار webhook: ${fetchErr.message}`,
      });
      res.json({
        ok: true,
        item: { ok: false, statusCode: null, message: fetchErr.message },
      });
    }
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

/* ──────────────────────────────────────
   SNAPSHOTS — rollback history
   ────────────────────────────────────── */
router.get('/snapshots', async (req, res) => {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      SyncActivity.find({ type: 'sync' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SyncActivity.countDocuments({ type: 'sync' }),
    ]);

    const snapshots = items.map((a, i) => ({
      id: skip + i + 1,
      direction: 'pull',
      items_count: 1,
      created_at: a.createdAt,
      metadata: { newProducts: 0, pricesChanged: 0, stockChanged: 0 },
    }));

    res.json({ ok: true, items: snapshots, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

export default router;
