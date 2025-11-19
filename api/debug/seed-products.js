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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await connectMongoDB();
    const { default: Product } = await import('../../server/models/Product.js');

    // Check existing products
    const count = await Product.countDocuments({});
    console.log('[SEED] Existing products:', count);

    if (req.method === 'GET') {
      // Just return count
      return res.json({ ok: true, count, message: 'Use POST to seed products' });
    }

    if (req.method === 'POST') {
      // Seed test products
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

      // Clear existing products first
      await Product.deleteMany({});
      console.log('[SEED] Cleared existing products');

      // Insert test products
      const inserted = await Product.insertMany(testProducts);
      console.log('[SEED] Inserted', inserted.length, 'products');

      return res.json({
        ok: true,
        message: `Seeded ${inserted.length} test products`,
        products: inserted.map(p => ({ _id: p._id, name: p.name, nameAr: p.nameAr }))
      });
    }

    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('[SEED] Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
