import mongoose from 'mongoose';

const PortfolioMediaSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    type: { type: String, enum: ['image', 'video'], required: true },
    order: { type: Number, default: 0 },
    publicId: { type: String, default: '' },
  },
  { _id: false }
);

const PortfolioPostSchema = new mongoose.Schema(
  {
    titleAr: { type: String, default: '' },
    bodyAr: { type: String, default: '' },
    media: { type: [PortfolioMediaSchema], default: [] },
    published: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

PortfolioPostSchema.index({ published: 1, sortOrder: -1, createdAt: -1 });

const PortfolioPost = mongoose.models.PortfolioPost || mongoose.model('PortfolioPost', PortfolioPostSchema);
export default PortfolioPost;
