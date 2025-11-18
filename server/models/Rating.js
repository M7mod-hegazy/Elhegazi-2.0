import mongoose from 'mongoose';

const ratingSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
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

// Ensure a user can only rate a product once
ratingSchema.index({ product: 1, user: 1 }, { unique: true });

// Update the updatedAt field before saving
ratingSchema.pre('save', function (next) {
  this.updatedAt = Date.now();
  next();
});

const Rating = mongoose.models.Rating || mongoose.model('Rating', ratingSchema);
export default Rating;