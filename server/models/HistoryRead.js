import mongoose from 'mongoose';

const HistoryReadSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    lastSeenAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.HistoryRead || mongoose.model('HistoryRead', HistoryReadSchema);
