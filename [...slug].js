import { Hono } from 'hono';
import { handle } from 'hono/vercel';
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

const app = new Hono().basePath('/api');

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
  return c.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
});

    // Import all models
    const { default: Product } = await import('./server/models/Product.js');
    const { default: Category } = await import('./server/models/Category.js');
    const { default: Order } = await import('./server/models/Order.js');
    const { default: User } = await import('./server/models/User.js');
    const { default: Settings } = await import('./server/models/Settings.js');
    const { default: HomeConfig } = await import('./server/models/HomeConfig.js');
    const { default: ShopSetup } = await import('./server/models/ShopSetup.js');

    // ===== HEALTH CHECK =====
    if (pathname === '/api/health') {
      console.log(`[ROOT-CATCH-ALL] ✓ Matched /api/health`);
      return res.json({ ok: true, status: 'healthy', timestamp: new Date().toISOString() });
    }

    // ===== PROFIT SETTINGS =====
    if (pathname === '/api/profit-settings') {
      console.log(`[ROOT-CATCH-ALL] ✓ Matched /api/profit-settings`);
      try {
        const { default: ProfitSettings } = await import('./server/models/ProfitSettings.js');
        
        if (req.method === 'GET') {
          const settings = await ProfitSettings.findOne({}).lean().maxTimeMS(8000);
          console.log(`[ROOT-CATCH-ALL] ✓ Profit settings found:`, settings ? 'YES' : 'NO');
          return res.json({ ok: true, item: settings || {} });
        }
        if (req.method === 'PUT') {
          const updated = await ProfitSettings.findOneAndUpdate({}, req.body, { new: true, upsert: true }).maxTimeMS(8000);
          return res.json({ ok: true, item: updated });
        }
      } catch (err) {
        console.error(`[ROOT-CATCH-ALL] ✗ Error:`, err.message);
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // ===== PROFIT REPORTS =====
    if (pathname === '/api/profit-reports' || pathname.match(/^\/api\/profit-reports\/[^/]+$/)) {
      const { default: ProfitReport } = await import('./server/models/ProfitReport.js');
      const id = pathname.split('/')[3];
      
      if (pathname === '/api/profit-reports' && req.method === 'GET') {
        const reports = await ProfitReport.find({}).sort({ createdAt: -1 }).lean().maxTimeMS(8000);
        return res.json({ ok: true, items: reports });
      }
      if (pathname === '/api/profit-reports' && req.method === 'POST') {
        const report = new ProfitReport(req.body);
        await report.save();
        return res.json({ ok: true, item: report });
      }
      if (id && req.method === 'GET') {
        const report = await ProfitReport.findById(id).lean().maxTimeMS(8000);
        return res.json({ ok: true, item: report });
      }
      if (id && req.method === 'PUT') {
        const updated = await ProfitReport.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
        return res.json({ ok: true, item: updated });
      }
      if (id && req.method === 'DELETE') {
        await ProfitReport.findByIdAndDelete(id).maxTimeMS(8000);
        return res.json({ ok: true });
      }
    }

    // ===== DEBUG SEED PRODUCTS =====
    if (pathname === '/api/debug/seed-products') {
      console.log(`[ROOT-CATCH-ALL] ✓ Matched /api/debug/seed-products`);
      
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
    console.log(`[ROOT-CATCH-ALL] ✗ 404 - No handler matched for: ${pathname}`);
    return res.status(404).json({ ok: false, error: 'Not found', pathname });
  } catch (error) {
    console.error(`[ROOT-CATCH-ALL] ✗ EXCEPTION:`, error.message);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
