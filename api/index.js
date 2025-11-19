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

// ===== PRODUCTS =====
app.get('/products', async (c) => {
  try {
    const { default: Product } = await import('../server/models/Product.js');
    const ids = c.req.query('ids');
    const categorySlug = c.req.query('categorySlug');
    
    let query = { active: { $ne: false } };
    if (ids) {
      const idArray = ids.split(',').map(id => id.trim());
      query._id = { $in: idArray };
    }
    if (categorySlug) {
      query.categorySlug = categorySlug;
    }
    
    const products = await Product.find(query).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: products });
  } catch (err) {
    console.error('[API] Error:', err.message);
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
    const setup = await ShopSetup.findOne({}).lean().maxTimeMS(8000);
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
    const updated = await ShopSetup.findOneAndUpdate({}, body, { new: true, upsert: true }).maxTimeMS(8000);
    return c.json({ ok: true, item: updated });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
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
    const products = await Product3D.find({}).lean().maxTimeMS(8000);
    return c.json({ ok: true, items: products });
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

app.get('/products-3d-categories', async (c) => {
  try {
    const { default: Product3D } = await import('../server/models/Product3D.js');
    const categories = await Product3D.distinct('category').maxTimeMS(8000);
    return c.json({ ok: true, items: categories });
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
    const body = await c.req.json();
    return c.json({ ok: true, item: { message: '3D model uploaded', url: body.url } });
  } catch (err) {
    console.error('[API] Error:', err.message);
    return c.json({ ok: false, error: err.message }, 500);
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

// ===== CLOUDINARY =====
app.post('/cloudinary/upload-file', async (c) => {
  try {
    const body = await c.req.json();
    return c.json({ ok: true, item: { url: body.url || 'https://via.placeholder.com/400' } });
  } catch (err) {
    console.error('[API] Error:', err.message);
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

// Export for Vercel
export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
export const PATCH = handle(app);
