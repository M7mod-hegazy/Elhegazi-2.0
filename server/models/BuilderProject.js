import mongoose from 'mongoose';

const BuilderProjectSchema = new mongoose.Schema(
  {
    ownerUserId: { type: String, default: null, index: true },
    ownerActorKey: { type: String, required: true, index: true },
    ownerEmailSnapshot: { type: String, default: '' },

    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', trim: true, maxlength: 1000 },

    layout: { type: mongoose.Schema.Types.Mixed, required: true },

    previewImageUrl: { type: String, default: '' },
    previewImagePublicId: { type: String, default: '' },

    stats: {
      wallsCount: { type: Number, default: 0 },
      productsCount: { type: Number, default: 0 },
      floorSize: { type: Number, default: 24 },
    },

    version: { type: Number, default: 1 },
    schemaVersion: { type: Number, default: 1 },

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: String, default: null },

    lastOpenedAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

BuilderProjectSchema.index({ ownerUserId: 1, updatedAt: -1 });
BuilderProjectSchema.index({ ownerActorKey: 1, updatedAt: -1 });
BuilderProjectSchema.index({ isDeleted: 1, deletedAt: 1 });
BuilderProjectSchema.index({ title: 'text', description: 'text' });

export default mongoose.models.BuilderProject
  || mongoose.model('BuilderProject', BuilderProjectSchema);
