import mongoose from 'mongoose';

const BuilderPricingConfigSchema = new mongoose.Schema(
  {
    isFreeNow: { type: Boolean, default: true },
    currentPriceEgp: { type: Number, default: 0, min: 0 },
    nextPriceEgp: { type: Number, default: 100, min: 0 },
    sessionMinutes: { type: Number, default: 90, min: 15, max: 480 },
    idleTimeoutMinutes: { type: Number, default: 15, min: 5, max: 120 },
    singleActiveSessionPerActor: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.models.BuilderPricingConfig
  || mongoose.model('BuilderPricingConfig', BuilderPricingConfigSchema);

