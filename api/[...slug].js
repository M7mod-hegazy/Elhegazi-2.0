import mongoose from 'mongoose';
import dotenv from 'dotenv';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    console.log(`[CATCH-ALL] ${req.method} ${pathname}`);
    console.log(`[CATCH-ALL] Full URL: ${req.url}`);

    // Connect to MongoDB for all endpoints
    await connectMongoDB();

    // Import all models
    const { default: Product } = await import('../server/models/Product.js');
    const { default: Category } = await import('../server/models/Category.js');
    const { default: Order } = await import('../server/models/Order.js');
    const { default: User } = await import('../server/models/User.js');
    const { default: Settings } = await import('../server/models/Settings.js');
    const { default: Branch } = await import('../server/models/Branch.js');
    const { default: Transaction } = await import('../server/models/Transaction.js');
    const { default: History } = await import('../server/models/History.js');
    const { default: HistoryRead } = await import('../server/models/HistoryRead.js');
    const { default: Role } = await import('../server/models/Role.js');
    const { default: HomeConfig } = await import('../server/models/HomeConfig.js');
    const { default: ShopSetup } = await import('../server/models/ShopSetup.js');

    // ===== CATEGORIES =====
    if (pathname === '/api/categories/:id' || pathname.match(/^\/api\/categories\/[^/]+$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'GET') {
        const cat = await Category.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: cat });
      }
      if (req.method === 'PUT') {
        const updated = await Category.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await Category.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== PRODUCTS =====
    if (pathname === '/api/products/:id' || pathname.match(/^\/api\/products\/[^/?]+$/)) {
      const id = pathname.split('/').pop();
      console.log('[CATCH-ALL] GET /api/products/:id', { id, pathname });
      if (req.method === 'GET') {
        console.log('[CATCH-ALL] Searching for product:', id);
        const prod = await Product.findById(id).lean().maxTimeMS(8000);
        console.log('[CATCH-ALL] Product found:', prod ? 'YES' : 'NO', prod ? { _id: prod._id, name: prod.name } : 'null');
        if (!prod) {
          console.log('[CATCH-ALL] Product not found, returning 404');
          return res.status(404).json({ ok: false, error: 'Product not found' });
        }
        console.log('[CATCH-ALL] Returning product');
        return res.json({ ok: true, item: prod });
      }
      if (req.method === 'PUT') {
        const updated = await Product.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await Product.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== ORDERS =====
    if (pathname === '/api/orders/:id' || pathname.match(/^\/api\/orders\/[^/]+$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'GET') {
        const order = await Order.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: order });
      }
      if (req.method === 'PUT') {
        const updated = await Order.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await Order.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== SETTINGS =====
    if (pathname === '/api/settings') {
      if (req.method === 'GET') {
        const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: settings });
      }
      if (req.method === 'PUT') {
        const updated = await Settings.findOneAndUpdate({}, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
    }

    // ===== HOME CONFIG =====
    if (pathname === '/api/home-config') {
      if (req.method === 'GET') {
        const config = await HomeConfig.findOne({}).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: config });
      }
      if (req.method === 'PUT') {
        const updated = await HomeConfig.findOneAndUpdate({}, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
    }

    // ===== SHOP SETUP =====
    if (pathname === '/api/shop-setup') {
      if (req.method === 'GET') {
        const setup = await ShopSetup.findOne({}).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: setup });
      }
      if (req.method === 'PUT') {
        const updated = await ShopSetup.findOneAndUpdate({}, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
    }

    // ===== BRANCHES =====
    if (pathname === '/api/branches/:id' || pathname.match(/^\/api\/branches\/[^/]+$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'GET') {
        const branch = await Branch.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: branch });
      }
      if (req.method === 'PUT') {
        const updated = await Branch.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await Branch.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== HISTORY =====
    if (pathname === '/api/history') {
      if (req.method === 'POST') {
        const entry = new History(req.body);
        await entry.save();
        return res.json({ ok: true, item: entry });
      }
    }

    // ===== TRANSACTIONS/EXPENSES =====
    if (pathname === '/api/expenses/:id' || pathname.match(/^\/api\/expenses\/[^/]+$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'GET') {
        const tx = await Transaction.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: tx });
      }
      if (req.method === 'PUT') {
        const updated = await Transaction.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await Transaction.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== ROLES =====
    if (pathname === '/api/rbac/roles/:id' || pathname.match(/^\/api\/rbac\/roles\/[^/]+$/)) {
      const id = pathname.split('/').pop();
      if (req.method === 'GET') {
        const role = await Role.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: role });
      }
      if (req.method === 'PUT') {
        const updated = await Role.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await Role.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // 404 for unhandled routes
    return res.status(404).json({ ok: false, error: 'Not found' });
  } catch (error) {
    console.error('[CATCH-ALL] Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
