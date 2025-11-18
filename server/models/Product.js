import mongoose from 'mongoose';

const ProductSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    sku: { type: String, trim: true, index: true },
    categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
    categorySlug: { type: String, index: true },
    price: { type: Number, required: true, min: 0 },
    description: { type: String, default: '' },
    image: { type: String, default: '' },
    images: [{ type: String }],
    stock: { type: Number, default: 0 },
    featured: { type: Boolean, default: false },
    active: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Indexes for common query patterns
ProductSchema.index({ featured: 1 });
ProductSchema.index({ active: 1 });
ProductSchema.index({ createdAt: -1 });
// Remove the text index to avoid duplicate schema index warning
// Optional text search on names (Arabic + English)
// ProductSchema.index({ name: 'text', nameAr: 'text' });

// Middleware to update category product counts
ProductSchema.post('save', async function(doc) {
  if (doc.categoryId) {
    try {
      // Import Category model dynamically to avoid circular dependency
      const Category = mongoose.models.Category || (await import('./Category.js')).default;
      await Category.updateProductCount(doc.categoryId);
    } catch (error) {
      console.error('Error updating category count after product save:', error);
    }
  }
});

ProductSchema.post('findOneAndUpdate', async function(doc) {
  if (doc && doc.categoryId) {
    try {
      const Category = mongoose.models.Category || (await import('./Category.js')).default;
      await Category.updateProductCount(doc.categoryId);
    } catch (error) {
      console.error('Error updating category count after product update:', error);
    }
  }
});

ProductSchema.post('findOneAndDelete', async function(doc) {
  if (doc && doc.categoryId) {
    try {
      const Category = mongoose.models.Category || (await import('./Category.js')).default;
      await Category.updateProductCount(doc.categoryId);
    } catch (error) {
      console.error('Error updating category count after product delete:', error);
    }
  }
});

export default mongoose.models.Product || mongoose.model('Product', ProductSchema);