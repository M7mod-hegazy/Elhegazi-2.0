import mongoose from 'mongoose';

const SyncActivitySchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SyncStore', required: true, index: true },
  storeName: { type: String, required: true },
  type: { type: String, enum: ['sync', 'error', 'warning'], required: true, index: true },
  description: { type: String, required: true },
  descriptionAr: { type: String, required: true },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

SyncActivitySchema.index({ createdAt: -1 });
SyncActivitySchema.index({ storeId: 1, createdAt: -1 });

export default mongoose.models.SyncActivity || mongoose.model('SyncActivity', SyncActivitySchema);
