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
    await ProfitReport.findByIdAndDelete(id).maxTimeMS(8000);
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

// Export for Vercel
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
