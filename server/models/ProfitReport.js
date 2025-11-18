import mongoose from 'mongoose';

const BranchValueSchema = new mongoose.Schema({
  name: { type: String, required: true },
  values: { type: Map, of: Number, default: {} }, // key: expense name -> value
}, { _id: false });

const ProfitReportSchema = new mongoose.Schema({
  reportName: { type: String, default: '' }, // Report name field
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  startDate: { type: Date, required: true },
  endDate: { type: Date, required: true },
  branches: [{ type: String, required: true }],
  expenses: [{ type: String, required: true }],
  branchRows: [BranchValueSchema],
  affectedShareholders: [{ type: String }], // IDs of shareholders included in this report
  totals: {
    totalStores: { type: Number, default: 0 },
    totalExpenses: { type: Number, default: 0 },
    totalProfits: { type: Number, default: 0 },
    finalBalance: { type: Number, default: 0 },
    netProfit: { type: Number, default: 0 },
    compareLastMonth: { type: Number, default: 0 },
    lastMonthClosing: { type: Number, default: 0 },
    cashManual: { type: Number, default: 0 },
    sumByExpense: { type: Map, of: Number, default: {} },
    cashBreakdown: {
      outletExpenses: { type: Number, default: 0 },
      home: { type: Number, default: 0 },
      bank: { type: Number, default: 0 },
      drawer: { type: Number, default: 0 },
      customRows: [{ 
        id: { type: String, required: true },
        name: { type: String, required: true },
        amount: { type: Number, required: true }
      }]
    },
  },
}, { timestamps: true });

// Add indexes for better query performance
ProfitReportSchema.index({ startDate: 1, endDate: 1 });
ProfitReportSchema.index({ affectedShareholders: 1 });
ProfitReportSchema.index({ createdAt: -1 });
ProfitReportSchema.index({ branches: 1 });

export default mongoose.models.ProfitReport || mongoose.model('ProfitReport', ProfitReportSchema);
