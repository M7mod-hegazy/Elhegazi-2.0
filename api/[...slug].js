import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import all models
import Product from '../server/models/Product.js';
import Category from '../server/models/Category.js';
import User from '../server/models/User.js';
import Order from '../server/models/Order.js';
import HomeConfig from '../server/models/HomeConfig.js';
import ShopSetup from '../server/models/ShopSetup.js';
import Settings from '../server/models/Settings.js';
import History from '../server/models/History.js';
import ProfitReport from '../server/models/ProfitReport.js';
import ProfitSettings from '../server/models/ProfitSettings.js';
import Role from '../server/models/Role.js';
import UserRole from '../server/models/UserRole.js';
import Transaction from '../server/models/Transaction.js';
import Branch from '../server/models/Branch.js';
import HistoryRead from '../server/models/HistoryRead.js';
import Rating from '../server/models/Rating.js';

const app = express();

// Middleware
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// MongoDB connection
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

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await connectMongoDB();
    return res.json({ ok: true, status: 'running', timestamp: new Date().toISOString() });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Debug whoami
app.get('/api/debug/whoami', async (req, res) => {
  try {
    const headerId = req.header('x-user-id') || null;
    const headerEmail = req.header('x-user-email') || null;
    return res.json({ ok: true, headerId, headerEmail });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Categories
app.get('/api/categories', async (req, res) => {
  try {
    await connectMongoDB();
    const { limit, featured } = req.query;
    let query = Category.find({});
    if (featured === 'true') query = query.where('featured').equals(true);
    if (limit) query = query.limit(parseInt(limit));
    const categories = await query.lean().maxTimeMS(8000);
    return res.json({ ok: true, items: categories });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Products
app.get('/api/products', async (req, res) => {
  try {
    await connectMongoDB();
    const { limit = 60, featured, fields } = req.query;
    let query = Product.find({});
    if (featured === 'true') query = query.where('featured').equals(true);
    if (fields) query = query.select(fields);
    const products = await query.limit(parseInt(limit) || 60).lean().maxTimeMS(8000);
    return res.json({ ok: true, items: products });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Settings
app.get('/api/settings', async (req, res) => {
  try {
    await connectMongoDB();
    const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
    return res.json({ ok: true, item: settings });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Settings footer
app.get('/api/settings/footer', async (req, res) => {
  try {
    await connectMongoDB();
    const settings = await Settings.findOne({}).lean().maxTimeMS(8000);
    return res.json({ ok: true, item: settings?.footer || {} });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Home config
app.get('/api/home-config', async (req, res) => {
  try {
    await connectMongoDB();
    const config = await HomeConfig.findOne({}).lean().maxTimeMS(8000);
    return res.json({ ok: true, item: config });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Shop setup
app.get('/api/shop-setup', async (req, res) => {
  try {
    await connectMongoDB();
    const setup = await ShopSetup.findOne({}).lean().maxTimeMS(8000);
    return res.json({ ok: true, item: setup });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Search popular
app.get('/api/search/popular', async (req, res) => {
  try {
    await connectMongoDB();
    const popular = await Product.find({}).limit(10).lean().maxTimeMS(8000);
    return res.json({ ok: true, items: popular });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Branches
app.get('/api/branches', async (req, res) => {
  try {
    await connectMongoDB();
    const items = await Branch.find({}).sort({ name: 1 }).lean().maxTimeMS(8000);
    return res.json({ ok: true, items });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Expenses
app.get('/api/expenses', async (req, res) => {
  try {
    await connectMongoDB();
    const { page = 1, limit = 50 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      Transaction.find({}).sort({ date: -1 }).skip(skip).limit(Number(limit)).lean().maxTimeMS(8000),
      Transaction.countDocuments({}),
    ]);
    return res.json({ ok: true, items, total, page: Number(page), pages: Math.ceil(total / Number(limit)) });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// History unread count
app.get('/api/history/unread-count', async (req, res) => {
  try {
    await connectMongoDB();
    const userId = req.query.userId || req.header('x-user-id');
    if (!userId) return res.json({ ok: true, count: 0 });
    const seen = await HistoryRead.findOne({ userId }).lean().maxTimeMS(8000);
    const since = seen?.lastSeenAt || new Date(0);
    const count = await History.countDocuments({ important: true, createdAt: { $gt: since } }).maxTimeMS(8000);
    return res.json({ ok: true, count, lastSeenAt: since });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// RBAC endpoints
app.get('/api/rbac/my-permissions', async (req, res) => {
  try {
    await connectMongoDB();
    const userId = req.user?._id || req.header('x-user-id');
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = await User.findById(userId).lean().maxTimeMS(8000);
    const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');
    return res.json({ ok: true, permissions: [], isSuperAdmin: isSuperAdmin || false });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/rbac/super-admin', async (req, res) => {
  try {
    await connectMongoDB();
    const userId = req.user?._id || req.header('x-user-id');
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });
    const user = await User.findById(userId).lean().maxTimeMS(8000);
    const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');
    return res.json({ ok: true, isSuperAdmin: isSuperAdmin || false, role: user?.role || 'user' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/rbac/roles', async (req, res) => {
  try {
    await connectMongoDB();
    const roles = await Role.find({}).sort({ name: 1 }).lean().maxTimeMS(8000);
    return res.json({ ok: true, items: roles });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ ok: false, error: 'Not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ ok: false, error: err.message });
});

export default app;
