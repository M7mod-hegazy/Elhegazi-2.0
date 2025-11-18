import mongoose from 'mongoose';

const ProfitSettingsSchema = new mongoose.Schema(
  {
    globalBranches: { type: [String], default: [] },
    globalExpenses: { type: [String], default: [] },
    shareholders: { type: mongoose.Schema.Types.Mixed, default: [] },
    shareHistory: { type: mongoose.Schema.Types.Mixed, default: {} },
    expenseTypes: { type: mongoose.Schema.Types.Mixed, default: {} },
    cashBreakdown: { type: mongoose.Schema.Types.Mixed, default: { outletExpenses: 0, home: 0, bank: 0, drawer: 0, customRows: [] } },
  },
  { timestamps: true }
);

const ProfitSettings = mongoose.models.ProfitSettings || mongoose.model('ProfitSettings', ProfitSettingsSchema);
export default ProfitSettings;
