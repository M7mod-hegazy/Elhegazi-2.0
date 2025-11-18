import mongoose from 'mongoose';

const ShopSetupSchema = new mongoose.Schema(
  {
    // User Information
    ownerName: { type: String, required: true },
    shopName: { type: String, required: true },
    phone: { type: String, required: true },
    
    // Shop Field/Category
    field: { type: String, required: true },
    isCustomField: { type: Boolean, default: false },
    customField: { type: String, default: '' },
    
    // Theme Color (primary color from user's theme)
    themeColor: { type: String, default: '#3b82f6' },
    
    // Status
    isActive: { type: Boolean, default: true },
    
    // Metadata
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.ShopSetup || mongoose.model('ShopSetup', ShopSetupSchema);
