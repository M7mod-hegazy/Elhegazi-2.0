// Vercel Serverless Function - Express App Handler
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { v2 as cloudinary } from 'cloudinary';
import crypto from 'crypto';
import multer from 'multer';
import { requirePermission, applyReadConditions, validateWriteAgainstConditions, getUserPermissions, clearUserPermissionCache } from '../server/rbac/permissions.js';

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB connection
let mongoConnection = null;

async function connectMongoDB() {
  if (mongoConnection) {
    return mongoConnection;
  }

  try {
    mongoConnection = await mongoose.connect(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB || 'appdb',
      maxPoolSize: 5,
      serverSelectionTimeoutMS: 5000,
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

// Import models (lazy load)
let models = {};

async function loadModels() {
  if (Object.keys(models).length > 0) return models;
  
  try {
    await connectMongoDB();
    const { default: Product } = await import('../server/models/Product.js');
    const { default: Category } = await import('../server/models/Category.js');
    const { default: User } = await import('../server/models/User.js');
    const { default: Order } = await import('../server/models/Order.js');
    const { default: HomeConfig } = await import('../server/models/HomeConfig.js');
    const { default: ShopSetup } = await import('../server/models/ShopSetup.js');
    const { default: Settings } = await import('../server/models/Settings.js');
    
    models = { Product, Category, User, Order, HomeConfig, ShopSetup, Settings };
    return models;
  } catch (error) {
    console.error('Error loading models:', error);
    throw error;
  }
}

// Example API endpoints
app.get('/api/products', async (req, res) => {
  try {
    await connectMongoDB();
    const { Product } = await loadModels();
    const products = await Product.find({}).limit(50).lean();
    return res.json({ ok: true, items: products });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/categories', async (req, res) => {
  try {
    await connectMongoDB();
    const { Category } = await loadModels();
    const categories = await Category.find({}).lean();
    return res.json({ ok: true, items: categories });
  } catch (error) {
    return res.status(500).json({ ok: false, error: error.message });
  }
});

app.get('/api/shop-setup', async (req, res) => {
  try {
    await connectMongoDB();
    const { ShopSetup } = await loadModels();
    const setup = await ShopSetup.findOne({}).lean();
    return res.json({ ok: true, item: setup });
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

// Export for Vercel
export default app;
