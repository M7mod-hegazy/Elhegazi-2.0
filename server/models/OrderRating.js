import mongoose from 'mongoose';

const orderRatingSchema = new mongoose.Schema({
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  review: {
    type: String,
    trim: true,
    maxlength: 500,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Ensure a user can only rate an order once
orderRatingSchema.index({ order: 1, user: 1 }, { unique: true });

// Update the updatedAt field before saving
orderRatingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const OrderRating = mongoose.models.OrderRating || mongoose.model('OrderRating', orderRatingSchema);
export default OrderRating;