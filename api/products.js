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
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    await connectMongoDB();
    const { default: Product } = await import('../server/models/Product.js');
    const { limit = 60, featured, fields, ids } = req.query;

    console.log('[DEBUG] Products API called:', { limit, featured, fields: fields ? fields.substring(0, 50) : 'none', ids: ids ? ids.substring(0, 50) : 'none' });

    let query = Product.find({});
    
    // Filter by IDs if provided
    if (ids) {
      const idList = ids.split(',').filter(id => id.trim());
      if (idList.length > 0) {
        query = query.where('_id').in(idList);
        console.log('[DEBUG] Filtering by IDs:', idList.length, 'IDs');
      }
    }
    
    if (featured === 'true') query = query.where('featured').equals(true);
    if (fields) {
      // Ensure 'image' is always included in fields
      const fieldArray = fields.split(',').map(f => f.trim());
      if (!fieldArray.includes('image')) {
        fieldArray.push('image');
      }
      query = query.select(fieldArray.join(' '));
      console.log('[DEBUG] Selecting fields:', fieldArray.join(' '));
    }

    const products = await query.limit(parseInt(limit) || 60).lean().maxTimeMS(8000);
    console.log('[DEBUG] Found', products.length, 'products. First product image:', products[0]?.image ? 'YES' : 'EMPTY');
    
    return res.json({ ok: true, items: products });
  } catch (error) {
    console.error('[ERROR] Products API error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
