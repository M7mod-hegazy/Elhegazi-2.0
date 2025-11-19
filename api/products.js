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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectMongoDB();
    const { default: Product } = await import('../server/models/Product.js');
    
    // Extract product ID from query if present
    const productId = req.query.id;
    
    console.log('[PRODUCTS] Request:', { method: req.method, productId, query: Object.keys(req.query) });

    // GET single product by ID
    if (req.method === 'GET' && productId) {
      console.log('[PRODUCTS] Fetching single product:', productId);
      try {
        const product = await Product.findById(productId).lean().maxTimeMS(8000);
        if (!product) {
          console.log('[PRODUCTS] Product not found:', productId);
          // Try to find ANY product to verify DB connection
          const anyProduct = await Product.findOne({}).lean().maxTimeMS(8000);
          console.log('[PRODUCTS] DB check - any product exists:', anyProduct ? 'YES' : 'NO');
          return res.status(404).json({ ok: false, error: 'Product not found' });
        }
        console.log('[PRODUCTS] Product found:', { _id: product._id, name: product.name });
        return res.json({ ok: true, item: product });
      } catch (err) {
        console.error('[PRODUCTS] Error fetching product:', err.message);
        return res.status(500).json({ ok: false, error: err.message });
      }
    }

    // GET list of products
    if (req.method === 'GET') {
      const { limit = 60, featured, fields, ids } = req.query;

      console.log('[PRODUCTS] Listing products:', { limit, featured, fields: fields ? fields.substring(0, 50) : 'none', ids: ids ? ids.substring(0, 50) : 'none' });

      let query = Product.find({});
      
      // Filter by IDs if provided
      if (ids) {
        const idList = ids.split(',').filter(id => id.trim());
        if (idList.length > 0) {
          query = query.where('_id').in(idList);
          console.log('[PRODUCTS] Filtering by IDs:', idList.length, 'IDs');
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
        console.log('[PRODUCTS] Selecting fields:', fieldArray.join(' '));
      }

      const products = await query.limit(parseInt(limit) || 60).lean().maxTimeMS(8000);
      console.log('[PRODUCTS] Found', products.length, 'products. First product image:', products[0]?.image ? 'YES' : 'EMPTY');
      
      return res.json({ ok: true, items: products });
    }

    // PUT update product
    if (req.method === 'PUT' && productId) {
      const updated = await Product.findByIdAndUpdate(productId, req.body, { new: true }).maxTimeMS(8000);
      return res.json({ ok: true, item: updated });
    }

    // DELETE product
    if (req.method === 'DELETE' && productId) {
      await Product.findByIdAndDelete(productId).maxTimeMS(8000);
      return res.json({ ok: true });
    }

    // POST create product
    if (req.method === 'POST') {
      const product = new Product(req.body);
      await product.save();
      return res.json({ ok: true, item: product });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[ERROR] Products API error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
