import mongoose from 'mongoose';

const UserRoleSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true, required: true },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role', index: true, required: true },
}, { timestamps: true });

UserRoleSchema.index({ userId: 1, roleId: 1 }, { unique: true });

export default mongoose.model('UserRole', UserRoleSchema);
