import mongoose from 'mongoose';

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    slug: { type: String, required: true, trim: true, unique: true, index: true },
    description: { type: String, default: '' },
    descriptionAr: { type: String, default: '' }, // Enhanced Arabic description
    featured: { type: Boolean, default: false },
    image: { type: String, default: '' },
    
    // Enhanced category features
    categoryType: { 
      type: String, 
      enum: ['product', 'service', 'digital', 'physical'], 
      default: 'product' 
    },
    icon: { type: String, default: '' }, // Lucide icon name
    color: { type: String, default: '#3B82F6' }, // Category accent color
    
    // Hierarchy support
    parentCategory: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Category',
      default: null 
    },
    
    // Display and ordering
    order: { type: Number, default: 0, index: true },
    productCount: { type: Number, default: 0 }, // Cached product count
    isActive: { type: Boolean, default: true },
    showInMenu: { type: Boolean, default: true },
    
    // SEO fields
    metaTitle: { type: String, default: '' },
    metaDescription: { type: String, default: '' },
    
    // Product preview settings
    useRandomPreview: { type: Boolean, default: true },
    previewProducts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
  },
  { timestamps: true }
);

// Useful index for recent-first listings
CategorySchema.index({ createdAt: -1 });

// Add indexes for new fields
CategorySchema.index({ isActive: 1 });
CategorySchema.index({ parentCategory: 1 });
CategorySchema.index({ categoryType: 1 });

// Method to update product count for a category
CategorySchema.statics.updateProductCount = async function(categoryId) {
  if (!categoryId) return;
  
  try {
    // Import Product model dynamically to avoid circular dependency
    const Product = mongoose.models.Product || (await import('./Product.js')).default;
    
    const count = await Product.countDocuments({ 
      categoryId: categoryId, 
      active: true 
    });
    
    await this.findByIdAndUpdate(categoryId, { 
      productCount: count 
    });
    
    console.log(`Updated category ${categoryId} product count to ${count}`);
  } catch (error) {
    console.error('Error updating category product count:', error);
  }
};

// Method to get category hierarchy (subcategories)
CategorySchema.methods.getSubcategories = async function() {
  return await this.constructor.find({ 
    parentCategory: this._id,
    isActive: true 
  }).sort({ order: 1, nameAr: 1 });
};

// Virtual for subcategories count
CategorySchema.virtual('subcategoryCount', {
  ref: 'Category',
  localField: '_id',
  foreignField: 'parentCategory',
  count: true
});

export default mongoose.models.Category || mongoose.model('Category', CategorySchema);
