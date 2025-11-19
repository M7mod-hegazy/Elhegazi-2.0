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
    console.log('[DB-STATUS] Connecting to MongoDB...');
    await connectMongoDB();
    console.log('[DB-STATUS] Connected!');

    const { default: Product } = await import('../../server/models/Product.js');
    const { default: Category } = await import('../../server/models/Category.js');
    const { default: User } = await import('../../server/models/User.js');

    const [productCount, categoryCount, userCount] = await Promise.all([
      Product.countDocuments({}),
      Category.countDocuments({}),
      User.countDocuments({})
    ]);

    console.log('[DB-STATUS] Counts:', { productCount, categoryCount, userCount });

    // Get first product as sample
    const firstProduct = await Product.findOne({}).lean();
    const firstCategory = await Category.findOne({}).lean();

    return res.json({
      ok: true,
      status: 'connected',
      counts: { productCount, categoryCount, userCount },
      samples: {
        product: firstProduct ? { _id: firstProduct._id, name: firstProduct.name } : null,
        category: firstCategory ? { _id: firstCategory._id, name: firstCategory.name } : null
      }
    });
  } catch (error) {
    console.error('[DB-STATUS] Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
