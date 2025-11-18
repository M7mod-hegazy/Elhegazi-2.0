import mongoose from 'mongoose';

const CartItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    quantity: { type: Number, default: 1 },
    price: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    // Optional denormalized product fields
    product: { type: Object },
  },
  { _id: false }
);

// Delivery preferences schema
const DeliveryPreferencesSchema = new mongoose.Schema(
  {
    preferredDeliveryTime: { 
      type: String, 
      enum: ['morning', 'afternoon', 'evening', 'anytime'],
      default: 'anytime'
    },
    deliveryInstructions: { type: String },
    preferredContactMethod: { 
      type: String, 
      enum: ['phone', 'email', 'sms', 'none'],
      default: 'phone'
    },
    allowLeaveAtDoor: { type: Boolean, default: false },
    requireSignature: { type: Boolean, default: false },
    specialHandling: { type: String } // For fragile items, etc.
  },
  { _id: false }
);

const UserSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // NOTE: For demo only. Do NOT use plaintext in production.
    firstName: { type: String },
    lastName: { type: String },
    phone: { type: String },
    role: { type: String, enum: ['customer', 'admin'], default: 'customer' },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date },

    favorites: { type: [String], default: [] }, // array of product IDs
    cart: { type: [CartItemSchema], default: [] },
    
    // Delivery preferences
    deliveryPreferences: { type: DeliveryPreferencesSchema, default: {} },
    notificationPreferences: {
      email: { type: Boolean, default: true },
      sms: { type: Boolean, default: false }
    }
  },
  { timestamps: true }
);

const User = mongoose.models.User || mongoose.model('User', UserSchema);
// Useful indexes
UserSchema.index({ role: 1, isActive: 1 });
UserSchema.index({ createdAt: -1 });
export default User;