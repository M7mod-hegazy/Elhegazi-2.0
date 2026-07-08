import mongoose from 'mongoose';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import SyncStore from '../models/SyncStore.js';

// Accept both hash schemes so a key minted by either admin backend verifies here.
async function verifyKeyAny(apiKey, encoded) {
  if (!encoded) return false;
  if (String(encoded).startsWith('sync_scrypt$')) {
    const parts = String(encoded).split('$');
    if (parts.length !== 3) return false;
    const incoming = crypto.scryptSync(apiKey, parts[1], 64);
    const stored = Buffer.from(parts[2], 'hex');
    return stored.length === incoming.length && crypto.timingSafeEqual(stored, incoming);
  }
  return bcrypt.compare(apiKey, encoded);
}

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 30;
const ipHits = new Map();

setInterval(() => ipHits.clear(), RATE_LIMIT_WINDOW);

export default async function validateSyncRequest(req, res, next) {
  try {
    const storeId = req.header('x-store-id');
    const apiKey = req.header('x-api-key');

    if (!storeId || !apiKey) {
      return res.status(401).json({ ok: false, error: 'Missing x-store-id or x-api-key headers' });
    }

    if (!mongoose.Types.ObjectId.isValid(storeId)) {
      return res.status(401).json({ ok: false, error: 'Invalid store ID format' });
    }

    const store = await SyncStore.findById(storeId).lean();
    if (!store) {
      return res.status(403).json({ ok: false, error: 'Store not found' });
    }

    if (!store.isActive) {
      return res.status(403).json({ ok: false, error: 'Store is deactivated. Contact admin.' });
    }

    const keyOk = await verifyKeyAny(apiKey, store.apiKeyHash);
    if (!keyOk) {
      return res.status(403).json({ ok: false, error: 'Invalid API key' });
    }

    if (store.allowedIps?.length) {
      const clientIp = req.ip || req.connection?.remoteAddress;
      if (!store.allowedIps.some(p => clientIp?.includes(p))) {
        return res.status(403).json({ ok: false, error: 'IP not allowed' });
      }
    }

    const ip = req.ip || 'unknown';
    const hits = (ipHits.get(ip) || 0) + 1;
    ipHits.set(ip, hits);
    if (hits > RATE_LIMIT_MAX) {
      return res.status(429).json({ ok: false, error: 'Too many requests. Slow down.' });
    }

    req.syncStore = store;

    await SyncStore.findByIdAndUpdate(storeId, { lastSeenAt: new Date() });

    next();
  } catch (err) {
    console.error('validateSyncRequest error:', err);
    return res.status(500).json({ ok: false, error: 'Sync auth error' });
  }
}
