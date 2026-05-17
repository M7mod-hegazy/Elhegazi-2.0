import mongoose from 'mongoose';

const QRPresetSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    settings: { type: mongoose.Schema.Types.Mixed, required: true },
    productIds: { type: [String], default: null },
  },
  { timestamps: true }
);

const QRPreset = mongoose.models.QRPreset || mongoose.model('QRPreset', QRPresetSchema);
export default QRPreset;
