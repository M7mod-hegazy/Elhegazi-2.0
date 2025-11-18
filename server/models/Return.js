import mongoose from 'mongoose';

const ReturnItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    condition: { type: String, enum: ['new', 'used', 'damaged'], default: 'new' },
  },
  { _id: false }
);

const ReturnSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, index: true },
    userId: { type: String, required: true, index: true },
    items: { type: [ReturnItemSchema], default: [] },
    totalAmount: { type: Number, required: true, min: 0 },
    reason: { type: String, required: true },
    status: { 
      type: String, 
      enum: ['requested', 'approved', 'processing', 'shipped', 'delivered', 'completed', 'rejected'],
      default: 'requested',
      index: true,
    },
    refundMethod: { type: String, enum: ['original', 'store_credit'], default: 'original' },
    refundStatus: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' },
    refundAmount: { type: Number, min: 0 },
    refundTransactionId: { type: String },
    shippingAddress: {
      street: String,
      city: String,
      state: String,
      postalCode: String,
      country: String,
    },
    returnShippingTracking: { type: String },
    returnShippingCarrier: { type: String },
    notes: { type: String },
    // Timestamps for different stages
    requestedAt: { type: Date, default: Date.now },
    approvedAt: { type: Date },
    rejectedAt: { type: Date },
    completedAt: { type: Date },
    // Admin fields
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    rejectedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    internalNotes: [{
      text: { type: String },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdByName: { type: String },
      createdAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

// Indexes for frequent queries
ReturnSchema.index({ userId: 1, createdAt: -1 });
ReturnSchema.index({ status: 1, createdAt: -1 });
ReturnSchema.index({ orderId: 1 });
ReturnSchema.index({ refundStatus: 1 });

export default mongoose.models.Return || mongoose.model('Return', ReturnSchema);