import mongoose from 'mongoose';

const BackupJobSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['export', 'import-preview', 'import-apply'], required: true },
    status: { type: String, enum: ['pending', 'running', 'done', 'failed'], default: 'pending' },
    mode: { type: String, default: '' },
    selectedModules: { type: [String], default: [] },
    summary: { type: mongoose.Schema.Types.Mixed, default: {} },
    error: { type: String, default: '' },
    actorUserId: { type: String, default: '' },
    actorEmail: { type: String, default: '' },
  },
  { timestamps: true }
);

BackupJobSchema.index({ createdAt: -1 });
BackupJobSchema.index({ actorUserId: 1, createdAt: -1 });

const BackupJob = mongoose.models.BackupJob || mongoose.model('BackupJob', BackupJobSchema);
export default BackupJob;

