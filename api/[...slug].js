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

    // ===== SETTINGS FOOTER =====
    if (pathname === '/api/settings/footer') {
      if (req.method === 'GET') {
        const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: settings?.footer || {} });
      }
      if (req.method === 'PUT') {
        const updated = await Settings.findOneAndUpdate({}, { footer: req.body }, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated?.footer || {} });
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

    // ===== PROFIT SETTINGS =====
    if (pathname === '/api/profit-settings') {
      console.log('[CATCH-ALL] Handling /api/profit-settings');
      try {
        const { default: ProfitSettings } = await import('../server/models/ProfitSettings.js');
        if (req.method === 'GET') {
          const settings = await ProfitSettings.findOne({}).lean().maxTimeMS(8000);
          console.log('[CATCH-ALL] Profit settings found:', settings ? 'YES' : 'NO');
          return res.json({ ok: true, item: settings || {} });
        }
        if (req.method === 'PUT') {
          const updated = await ProfitSettings.findOneAndUpdate({}, req.body, { new: true, upsert: true }).maxTimeMS(8000);
          return res.json({ ok: true, item: updated });
        }
      } catch (err) {
        console.error('[CATCH-ALL] Profit settings error:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // ===== PROFIT REPORTS =====
    if (pathname === '/api/profit-reports/:id' || pathname.match(/^\/api\/profit-reports\/[^/]+$/)) {
      const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
      const id = pathname.split('/').pop();
      
      if (req.method === 'GET') {
        const report = await ProfitReport.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: report });
      }
      if (req.method === 'PUT') {
        const updated = await ProfitReport.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (req.method === 'DELETE') {
        await ProfitReport.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== PROFIT REPORTS LIST =====
    if (pathname === '/api/profit-reports') {
      const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
      
      if (req.method === 'GET') {
        const reports = await ProfitReport.find({}).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
        return res.json({ ok: true, items: reports });
      }
      if (req.method === 'POST') {
        const report = new (await import('../server/models/ProfitReport.js')).default(req.body);
        await report.save();
        return res.json({ ok: true, item: report });
      }
    }

    // ===== PROFIT AGGREGATE =====
    if (pathname === '/api/profit-aggregate') {
      const { default: ProfitReport } = await import('../server/models/ProfitReport.js');
      const { from, to } = req.query;
      
      if (req.method === 'GET') {
        const query = {};
        if (from || to) {
          query.createdAt = {};
          if (from) query.createdAt.$gte = new Date(from);
          if (to) query.createdAt.$lte = new Date(to);
        }
        const reports = await ProfitReport.find(query).lean().maxTimeMS(8000);
        return res.json({ ok: true, items: reports });
      }
    }

    // ===== DEBUG SEED PRODUCTS =====
    if (pathname === '/api/debug/seed-products') {
      const { default: Product } = await import('../server/models/Product.js');
      
      if (req.method === 'GET') {
        const count = await Product.countDocuments({});
        return res.json({ ok: true, count, message: 'Use POST to seed products' });
      }
      
      if (req.method === 'POST') {
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
        
        return res.json({
          ok: true,
          message: `Seeded ${inserted.length} test products`,
          products: inserted.map(p => ({ _id: p._id, name: p.name, nameAr: p.nameAr }))
        });
      }
    }

    // 404 for unhandled routes
    console.log('[CATCH-ALL] 404 - No handler for:', pathname);
    return res.status(404).json({ ok: false, error: 'Not found', pathname });
  } catch (error) {
    console.error('[CATCH-ALL] Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
