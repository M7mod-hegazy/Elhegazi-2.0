import mongoose from 'mongoose';

const SyncStoreSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  apiKeyHash: { type: String, required: true },
  apiKeyPrefix: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastSeenAt: { type: Date },
  allowedIps: [{ type: String }],
  notes: { type: String, default: '' },
}, { timestamps: true });

export default mongoose.models.SyncStore || mongoose.model('SyncStore', SyncStoreSchema);
