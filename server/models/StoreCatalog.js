import mongoose from 'mongoose';

const StoreCatalogSchema = new mongoose.Schema({
  storeId: { type: mongoose.Schema.Types.ObjectId, ref: 'SyncStore', required: true, index: true },
  sku: { type: String, required: true, trim: true },
  name: { type: String, default: '' },
  nameAr: { type: String, default: '' },
  price: { type: Number, default: 0 },
  stock: { type: Number, default: 0 },
  image: { type: String, default: '' },
  images: [{ type: String }],
  categorySlug: { type: String, default: '' },
  syncedAt: { type: Date, default: Date.now },
});

StoreCatalogSchema.index({ storeId: 1, sku: 1 }, { unique: true });

export default mongoose.models.StoreCatalog || mongoose.model('StoreCatalog', StoreCatalogSchema);
