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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    await connectMongoDB();
    const { default: User } = await import('../../server/models/User.js');
    
    const { email, password } = req.body || {};
    
    if (!email || !password) {
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }

    const user = await User.findOne({ email }).lean().maxTimeMS(8000);
    
    if (!user || user.password !== password || !user.isActive) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' });
    }

    // Update last login
    await User.updateOne({ _id: user._id }, { $set: { lastLogin: new Date() } }).maxTimeMS(8000);

    return res.json({
      ok: true,
      user: {
        id: String(user._id),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
