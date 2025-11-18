import mongoose from 'mongoose';

const TransactionSchema = new mongoose.Schema({
  date: { type: Date, required: true, index: true },
  branch: { type: String, required: true, index: true },
  expenseType: { type: String, required: true, index: true },
  amount: { type: Number, required: true },
  note: { type: String, default: '' },
}, { timestamps: true });

TransactionSchema.index({ branch: 1, expenseType: 1, date: 1 });

export default mongoose.models.Transaction || mongoose.model('Transaction', TransactionSchema);
