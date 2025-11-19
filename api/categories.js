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
    const { default: Category } = await import('../server/models/Category.js');
    const { limit, featured, fields } = req.query;

    let query = Category.find({});
    if (featured === 'true') query = query.where('featured').equals(true);
    if (fields) query = query.select(fields);
    if (limit) query = query.limit(parseInt(limit));

    const categories = await query.lean().maxTimeMS(8000);
    return res.json({ ok: true, items: categories });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
