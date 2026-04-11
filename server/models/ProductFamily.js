import mongoose from 'mongoose';

const OptionSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, trim: true },
    label: { type: String, default: '' },
    labelAr: { type: String, default: '' },
  },
  { _id: false }
);

const MemberSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    values: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const ProductFamilySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    nameAr: { type: String, required: true, trim: true },
    memberProductIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
    options: { type: [OptionSchema], default: [] },
    members: { type: [MemberSchema], default: [] },
    defaultProductId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
  },
  { timestamps: true }
);

ProductFamilySchema.index({ memberProductIds: 1 });

export default mongoose.models.ProductFamily || mongoose.model('ProductFamily', ProductFamilySchema);
