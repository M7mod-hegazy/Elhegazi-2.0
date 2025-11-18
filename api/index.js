// Vercel Serverless Function - Express App Handler
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// MongoDB connection pool
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
    console.log('✓ MongoDB connected');
    return mongoConnection;
  } catch (error) {
    console.error('✗ MongoDB connection failed:', error.message);
    throw error;
  }
}

// Attach minimal auth user from headers
app.use(async (req, _res, next) => {
  const userId = req.header('x-user-id');
  if (userId) req.user = { _id: userId };
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ ok: true, status: 'running', timestamp: new Date().toISOString() });
});

// Debug endpoint
app.get('/api/debug/whoami', async (req, res) => {
  try {
    const headerId = req.header('x-user-id') || null;
    const headerEmail = req.header('x-user-email') || null;
    const reqUser = req.user || null;
    return res.json({ ok: true, headerId, headerEmail, reqUser });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Test MongoDB connection
app.get('/api/test-db', async (req, res) => {
  try {
    await connectMongoDB();
    return res.json({ ok: true, message: 'MongoDB connected successfully' });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

// Example API endpoints
app.get('/api/products', async (req, res) => {
  try {
    await connectMongoDB();
    
    // Dynamically import Product model
    const { default: Product } = await import('../server/models/Product.js');
    const products = await Product.find({}).limit(50).lean().maxTimeMS(8000);
    
    return res.json({ ok: true, items: products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    await connectMongoDB();
    
    // Dynamically import Category model
    const { default: Category } = await import('../server/models/Category.js');
    const categories = await Category.find({}).lean().maxTimeMS(8000);
    
    return res.json({ ok: true, items: categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/shop-setup', async (req, res) => {
  try {
    await connectMongoDB();
    
    // Dynamically import ShopSetup model
    const { default: ShopSetup } = await import('../server/models/ShopSetup.js');
    const setup = await ShopSetup.findOne({}).lean().maxTimeMS(8000);
    
    return res.json({ ok: true, item: setup });
  } catch (error) {
    console.error('Error fetching shop setup:', error);
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

// Export for Vercel
export default app;
