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

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    await connectMongoDB();

    const { default: History } = await import('../../server/models/History.js');
    const { default: HistoryRead } = await import('../../server/models/HistoryRead.js');

    const userId = req.query.userId || req.header('x-user-id');
    if (!userId) return res.json({ ok: true, count: 0 });

    const seen = await HistoryRead.findOne({ userId }).lean().maxTimeMS(8000);
    const since = seen?.lastSeenAt || new Date(0);
    const count = await History.countDocuments({ important: true, createdAt: { $gt: since } }).maxTimeMS(8000);

    return res.status(200).json({ ok: true, count, lastSeenAt: since });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
