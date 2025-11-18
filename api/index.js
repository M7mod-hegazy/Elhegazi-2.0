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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = url.pathname;

    // Health check - no DB needed
    if (pathname === '/api/health') {
      return res.json({ ok: true, status: 'running', timestamp: new Date().toISOString() });
    }

    // Debug whoami - no DB needed
    if (pathname === '/api/debug/whoami') {
      return res.json({ 
        ok: true, 
        headerId: req.headers['x-user-id'] || null,
        headerEmail: req.headers['x-user-email'] || null
      });
    }

    // Connect to MongoDB for all other endpoints
    await connectMongoDB();

    // Shop setup
    if (pathname === '/api/shop-setup') {
      const { default: ShopSetup } = await import('../server/models/ShopSetup.js');
      const setup = await ShopSetup.findOne({}).lean().maxTimeMS(8000);
      return res.json({ ok: true, item: setup });
    }

    // Home config
    if (pathname === '/api/home-config') {
      const { default: HomeConfig } = await import('../server/models/HomeConfig.js');
      const config = await HomeConfig.findOne({}).lean().maxTimeMS(8000);
      return res.json({ ok: true, item: config });
    }

    // Settings footer (check this FIRST before /api/settings)
    if (pathname === '/api/settings/footer') {
      const { default: Settings } = await import('../server/models/Settings.js');
      const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
      return res.json({ ok: true, item: settings?.footer || {} });
    }

    // Settings
    if (pathname === '/api/settings') {
      const { default: Settings } = await import('../server/models/Settings.js');
      const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
      return res.json({ ok: true, item: settings });
    }

    // Popular searches
    if (pathname === '/api/search/popular') {
      const { default: Product } = await import('../server/models/Product.js');
      const popular = await Product.find({}).limit(10).lean().maxTimeMS(8000);
      return res.json({ ok: true, items: popular });
    }

    // Products
    if (pathname === '/api/products') {
      const { default: Product } = await import('../server/models/Product.js');
      const limit = url.searchParams.get('limit') || 60;
      const featured = url.searchParams.get('featured');
      const fields = url.searchParams.get('fields');

      let query = Product.find({});
      if (featured === 'true') query = query.where('featured').equals(true);
      if (fields) query = query.select(fields);

      const products = await query.limit(parseInt(limit) || 60).lean().maxTimeMS(8000);
      return res.json({ ok: true, items: products });
    }

    // Categories
    if (pathname === '/api/categories') {
      const { default: Category } = await import('../server/models/Category.js');
      const limit = url.searchParams.get('limit');
      const featured = url.searchParams.get('featured');

      let query = Category.find({});
      if (featured === 'true') query = query.where('featured').equals(true);
      if (limit) query = query.limit(parseInt(limit));

      const categories = await query.lean().maxTimeMS(8000);
      return res.json({ ok: true, items: categories });
    }

    // Branches
    if (pathname === '/api/branches') {
      const { default: Branch } = await import('../server/models/Branch.js');
      const items = await Branch.find({}).sort({ name: 1 }).lean().maxTimeMS(8000);
      return res.json({ ok: true, items });
    }

    // Expenses
    if (pathname === '/api/expenses') {
      const { default: Transaction } = await import('../server/models/Transaction.js');
      const page = url.searchParams.get('page') || 1;
      const limit = url.searchParams.get('limit') || 50;
      const skip = (Number(page) - 1) * Number(limit);

      const [items, total] = await Promise.all([
        Transaction.find({}).sort({ date: -1 }).skip(skip).limit(Number(limit)).lean().maxTimeMS(8000),
        Transaction.countDocuments({}),
      ]);

      return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
    }

    // History unread count
    if (pathname === '/api/history/unread-count') {
      const { default: History } = await import('../server/models/History.js');
      const { default: HistoryRead } = await import('../server/models/HistoryRead.js');

      const userId = url.searchParams.get('userId') || req.headers['x-user-id'];
      if (!userId) return res.json({ ok: true, count: 0 });

      const seen = await HistoryRead.findOne({ userId }).lean().maxTimeMS(8000);
      const since = seen?.lastSeenAt || new Date(0);
      const count = await History.countDocuments({ important: true, createdAt: { $gt: since } }).maxTimeMS(8000);

      return res.json({ ok: true, count, lastSeenAt: since });
    }

    // RBAC my-permissions
    if (pathname === '/api/rbac/my-permissions') {
      const { default: User } = await import('../server/models/User.js');
      const userId = req.headers['x-user-id'];
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const user = await User.findById(userId).lean().maxTimeMS(8000);
      const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');

      return res.json({ ok: true, permissions: [], isSuperAdmin: isSuperAdmin || false });
    }

    // RBAC super-admin
    if (pathname === '/api/rbac/super-admin') {
      const { default: User } = await import('../server/models/User.js');
      const userId = req.headers['x-user-id'];
      if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });

      const user = await User.findById(userId).lean().maxTimeMS(8000);
      const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');

      return res.json({ ok: true, isSuperAdmin: isSuperAdmin || false, role: user?.role || 'user' });
    }

    // RBAC roles
    if (pathname === '/api/rbac/roles') {
      const { default: Role } = await import('../server/models/Role.js');
      const roles = await Role.find({}).sort({ name: 1 }).lean().maxTimeMS(8000);
      return res.json({ ok: true, items: roles });
    }

    // 404
    return res.status(404).json({ ok: false, error: 'Not found' });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
