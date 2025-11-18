import mongoose from 'mongoose';

const HistorySchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userEmail: { type: String },
    section: { type: String, required: true },
    action: { type: String, required: true },
    note: { type: String },
    meta: { type: Object },
    important: { type: Boolean, default: true },
    level: { type: String, enum: ['info', 'warning', 'critical'], default: 'info' },
    details: { type: String },
  },
  { timestamps: true }
);

export default mongoose.models.History || mongoose.model('History', HistorySchema);
