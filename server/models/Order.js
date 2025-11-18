import mongoose from 'mongoose';

const OrderItemSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true },
    product: { type: Object },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const AddressSchema = new mongoose.Schema(
  {
    name: String,
    email: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    postalCode: String,
    country: String,
    isDefault: Boolean,
  },
  { _id: false }
);

// Enhanced tracking event schema
const TrackingEventSchema = new mongoose.Schema(
  {
    status: { 
      type: String, 
      enum: ['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','refunded','returned'],
      required: true
    },
    location: {
      name: String,
      city: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    timestamp: { type: Date, default: Date.now },
    description: String,
    notes: String,
    carrier: String,
    trackingNumber: String
  },
  { _id: false }
);

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    items: { type: [OrderItemSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 },
    status: { 
      type: String, 
      enum: ['pending','confirmed','processing','shipped','out_for_delivery','delivered','cancelled','refunded','returned'],
      default: 'pending'
      // Removed index: true to avoid duplicate index with OrderSchema.index({ status: 1, createdAt: -1 })
    },
    paymentMethod: { type: String, default: 'cod' },
    paymentStatus: { type: String, enum: ['pending','paid','failed','refunded','partially_refunded'], default: 'pending' },
    shippingAddress: { type: AddressSchema, required: true },
    billingAddress: { type: AddressSchema },
    notes: { type: String },
    estimatedDelivery: { type: Date },
    trackingNumber: { type: String },
    carrier: { type: String },
    // Enhanced tracking information
    trackingEvents: { type: [TrackingEventSchema], default: [] },
    currentLocation: {
      name: String,
      city: String,
      country: String,
      coordinates: {
        lat: Number,
        lng: Number
      }
    },
    // Cancellation request fields
    cancellationRequested: { type: Boolean, default: false },
    cancellationReason: { type: String },
    cancellationRequestedAt: { type: Date },
    cancellationApprovedAt: { type: Date },
    cancellationApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    // Return request fields
    returnRequested: { type: Boolean, default: false },
    returnReason: { type: String },
    returnRequestedAt: { type: Date },
    returnApprovedAt: { type: Date },
    returnApprovedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    returnTrackingNumber: { type: String },
    // Email notification tracking
    emailNotifications: {
      confirmation: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String }
      },
      shipped: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String }
      },
      delivered: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String }
      },
      cancelled: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String }
      },
      returned: {
        sent: { type: Boolean, default: false },
        sentAt: { type: Date },
        messageId: { type: String }
      }
    },
    // Order workflow fields
    orderNumber: { type: String, unique: true, sparse: true },
    // Removed separate index definition to avoid duplicate with unique: true above
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    assignedAt: { type: Date },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    priority: { type: String, enum: ['low', 'normal', 'high', 'urgent'], default: 'normal' },
    internalNotes: [{
      text: { type: String },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
      createdByName: { type: String },
      createdAt: { type: Date, default: Date.now }
    }],
    // Payment details
    paymentDetails: {
      transactionId: { type: String },
      paidAt: { type: Date },
      walletType: { type: String },
      cardLast4: { type: String },
      paymentGateway: { type: String }
    },
    // Refund details
    refundDetails: {
      refundId: { type: String },
      refundAmount: { type: Number },
      refundReason: { type: String },
      refundedAt: { type: Date }
    }
  },
  { timestamps: true }
);

// Indexes for frequent queries
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1, createdAt: -1 });
OrderSchema.index({ createdAt: -1 });
OrderSchema.index({ cancellationRequested: 1 });
OrderSchema.index({ returnRequested: 1 });
// Removed OrderSchema.index({ orderNumber: 1 }) to avoid duplicate with unique: true in schema
OrderSchema.index({ assignedTo: 1 });
OrderSchema.index({ trackingNumber: 1 });
OrderSchema.index({ 'trackingEvents.timestamp': -1 });

// Generate order number before saving
OrderSchema.pre('save', async function(next) {
  if (this.isNew && !this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    
    // Find the last order number for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const lastOrder = await this.constructor.findOne({
      createdAt: { $gte: today, $lt: tomorrow }
    }).sort({ createdAt: -1 });
    
    let sequence = 1;
    if (lastOrder && lastOrder.orderNumber) {
      const lastSequence = parseInt(lastOrder.orderNumber.slice(-3));
      sequence = lastSequence + 1;
    }
    
    this.orderNumber = `${year}${month}${day}${sequence.toString().padStart(3, '0')}`;
  }
  
  // Add tracking event when status changes
  if (this.isModified('status') && this.status) {
    const trackingEvent = {
      status: this.status,
      timestamp: new Date(),
      description: this.getStatusDescription(this.status)
    };
    
    // Add current location if available
    if (this.currentLocation) {
      trackingEvent.location = this.currentLocation;
    }
    
    // Add carrier info if available
    if (this.carrier) {
      trackingEvent.carrier = this.carrier;
    }
    
    // Add tracking number if available
    if (this.trackingNumber) {
      trackingEvent.trackingNumber = this.trackingNumber;
    }
    
    this.trackingEvents.push(trackingEvent);
  }
  
  next();
});

// Helper method to get status descriptions
OrderSchema.methods.getStatusDescription = function(status) {
  const descriptions = {
    pending: 'تم استلام الطلب',
    confirmed: 'تم تأكيد الطلب',
    processing: 'قيد التجهيز',
    shipped: 'تم الشحن',
    out_for_delivery: 'خارج للتوصيل',
    delivered: 'تم التسليم',
    cancelled: 'تم الإلغاء',
    refunded: 'تم الاسترداد',
    returned: 'تم الإرجاع'
  };
  return descriptions[status] || status;
};

export default mongoose.models.Order || mongoose.model('Order', OrderSchema);