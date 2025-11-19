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
  res.setHeader('Access-Control-Allow-Methods', 'GET, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { id } = req.query;
    
    console.log('[PRODUCTS/ID] Request:', { method: req.method, id });

    if (!id) {
      return res.status(400).json({ ok: false, error: 'Product ID required' });
    }

    await connectMongoDB();
    const { default: Product } = await import('../../server/models/Product.js');

    // GET single product
    if (req.method === 'GET') {
      console.log('[PRODUCTS/ID] Fetching product:', id);
      const product = await Product.findById(id).lean().maxTimeMS(8000);
      
      if (!product) {
        console.log('[PRODUCTS/ID] Product not found:', id);
        return res.status(404).json({ ok: false, error: 'Product not found' });
      }
      
      console.log('[PRODUCTS/ID] Product found:', { _id: product._id, name: product.name });
      return res.json({ ok: true, item: product });
    }

    // PUT update product
    if (req.method === 'PUT') {
      console.log('[PRODUCTS/ID] Updating product:', id);
      const updated = await Product.findByIdAndUpdate(id, req.body, { new: true }).maxTimeMS(8000);
      return res.json({ ok: true, item: updated });
    }

    // DELETE product
    if (req.method === 'DELETE') {
      console.log('[PRODUCTS/ID] Deleting product:', id);
      await Product.findByIdAndDelete(id).maxTimeMS(8000);
      return res.json({ ok: true });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[ERROR] Products/ID API error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
