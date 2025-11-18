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

    const { default: User } = await import('../../server/models/User.js');

    const userId = req.header('x-user-id');
    if (!userId) return res.status(401).json({ ok: false, error: 'Unauthorized' });

    const user = await User.findById(userId).lean().maxTimeMS(8000);
    const isSuperAdmin = user && (user.role === 'SuperAdmin' || user.role === 'super_admin');

    return res.status(200).json({ 
      ok: true, 
      isSuperAdmin: isSuperAdmin || false,
      role: user?.role || 'user'
    });
  } catch (error) {
    console.error('Error checking super admin:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
