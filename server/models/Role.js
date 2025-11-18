import mongoose from 'mongoose';

const PermissionSchema = new mongoose.Schema({
  resource: { type: String, required: true }, // e.g., 'products', 'categories', 'orders', 'users', 'reports', 'branches', 'expenses', 'profit-reports'
  actions: [{ type: String, required: true }], // e.g., ['create','read','update','delete','export','approve']
  conditions: { type: mongoose.Schema.Types.Mixed }, // flexible allowed lists/constraints
}, { _id: false });

const RoleSchema = new mongoose.Schema({
  name: { type: String, unique: true, required: true },
  description: { type: String },
  permissions: [PermissionSchema],
}, { timestamps: true });

export default mongoose.model('Role', RoleSchema);
