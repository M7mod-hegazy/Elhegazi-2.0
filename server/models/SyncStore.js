import mongoose from 'mongoose';

const SyncStoreSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  apiKeyHash: { type: String, required: true },
  apiKeyPrefix: { type: String, required: true },
  isActive: { type: Boolean, default: true },
  lastSeenAt: { type: Date },
  allowedIps: [{ type: String }],
  notes: { type: String, default: '' },
  // Outbound order webhook — the POS registers its /api/webhooks/ecom/order URL here.
  webhookUrl: { type: String, default: '' },
  webhookSecret: { type: String, default: '' },
  webhookActive: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.models.SyncStore || mongoose.model('SyncStore', SyncStoreSchema);
