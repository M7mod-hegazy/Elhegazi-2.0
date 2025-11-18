import mongoose from 'mongoose';

const Product3DSchema = new mongoose.Schema({
  // Basic Information
  name: { type: String, required: true },
  nameEn: { type: String, default: '' },
  description: { type: String, default: '' },
  category: { type: String, required: true, default: 'أخرى' },
  
  // 3D Model Files
  modelUrl: { type: String, required: true },
  thumbnailUrl: { type: String, default: '' },
  
  // Default Properties
  defaultScale: {
    x: { type: Number, default: 1 },
    y: { type: Number, default: 1 },
    z: { type: Number, default: 1 }
  },
  defaultRotation: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    z: { type: Number, default: 0 }
  },
  
  // Dimensions (in meters)
  dimensions: {
    width: { type: Number, default: 1 },
    height: { type: Number, default: 1 },
    depth: { type: Number, default: 1 }
  },
  
  // Metadata
  tags: [{ type: String }],
  color: { type: String, default: '#ffffff' },
  material: { type: String, default: '' },
  
  // File Info
  fileSize: { type: Number, default: 0 },
  format: { type: String, enum: ['glb', 'gltf', 'obj', 'fbx'], default: 'glb' },
  
  // Status
  isActive: { type: Boolean, default: true },
  isPremium: { type: Boolean, default: false },
  
  // Usage Stats
  usageCount: { type: Number, default: 0 }
}, { timestamps: true });

// Indexes for better query performance
Product3DSchema.index({ name: 1 });
Product3DSchema.index({ category: 1 });
Product3DSchema.index({ isActive: 1 });
Product3DSchema.index({ tags: 1 });

export default mongoose.models.Product3D || mongoose.model('Product3D', Product3DSchema);
