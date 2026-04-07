import mongoose from 'mongoose';

const BuilderAccessSessionSchema = new mongoose.Schema(
  {
    actorKey: { type: String, required: true, index: true },
    userId: { type: String, default: null, index: true },
    isAdminBypass: { type: Boolean, default: false },
    status: {
      type: String,
      enum: ['active', 'expired', 'ended', 'revoked'],
      default: 'active',
      index: true,
    },
    sessionType: {
      type: String,
      enum: ['free_trial', 'paid', 'admin_bypass'],
      default: 'free_trial',
    },
    priceEgp: { type: Number, default: 0, min: 0 },
    paymentRef: { type: String, default: '' },
    startAt: { type: Date, default: Date.now, index: true },
    lastActivityAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, required: true, index: true },
    endAt: { type: Date, default: null },
    metadata: {
      ipHash: { type: String, default: '' },
      userAgent: { type: String, default: '' },
      source: { type: String, default: 'web' },
    },
  },
  { timestamps: true }
);

BuilderAccessSessionSchema.index({ actorKey: 1, status: 1, expiresAt: 1 });

export default mongoose.models.BuilderAccessSession
  || mongoose.model('BuilderAccessSession', BuilderAccessSessionSchema);

