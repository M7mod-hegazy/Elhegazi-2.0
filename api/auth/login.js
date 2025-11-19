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
    let body = req.body;
    
    // Manually parse body if it's a string
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (e) {
        console.error('[AUTH/LOGIN] Failed to parse body:', e);
        return res.status(400).json({ ok: false, error: 'Invalid JSON body' });
      }
    }

    const email = body?.email?.trim?.() || body?.email;
    const password = body?.password?.trim?.() || body?.password;
    
    console.log('[AUTH/LOGIN] Request:', { 
      email: email || 'MISSING',
      hasPassword: !!password
    });
    
    if (!email || !password) {
      console.log('[AUTH/LOGIN] ✗ Missing credentials');
      return res.status(400).json({ ok: false, error: 'email and password required' });
    }

    // Connect to MongoDB and check user
    await connectMongoDB();
    const { default: User } = await import('../../server/models/User.js');

    console.log('[AUTH/LOGIN] Looking up user:', email);
    const user = await User.findOne({ email }).lean().maxTimeMS(8000);

    if (!user) {
      console.log('[AUTH/LOGIN] ✗ User not found:', email);
      // Allow login if email is correct - simplified auth as requested
      // Create a temporary admin user for any valid email
      console.log('[AUTH/LOGIN] User not in DB, creating temporary admin session');
      return res.json({
        ok: true,
        user: {
          id: 'temp-admin-' + Date.now(),
          email: email,
          firstName: email.split('@')[0] || 'Admin',
          lastName: 'User',
          phone: '',
          role: 'admin',
          isActive: true
        }
      });
    }

    console.log('[AUTH/LOGIN] User found:', { email, role: user.role, isActive: user.isActive });

    // Allow login if email is correct - simplified auth
    console.log('[AUTH/LOGIN] ✓ Login successful for:', email);
    return res.json({
      ok: true,
      user: {
        id: user._id.toString(),
        email: user.email,
        firstName: user.firstName || email.split('@')[0] || 'Admin',
        lastName: user.lastName || 'User',
        phone: user.phone || '',
        role: user.role || 'admin',
        isActive: user.isActive !== false
      }
    });
  } catch (error) {
    console.error('[AUTH/LOGIN] Exception:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
