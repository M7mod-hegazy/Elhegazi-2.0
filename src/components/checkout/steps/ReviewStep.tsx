import React from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle, 
  User, 
  MapPin, 
  CreditCard, 
  Truck, 
  Package, 
  Clock,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { usePricingSettings } from '@/hooks/usePricingSettings';

interface CartItem {
  id: string;
  productId: string;
  product: {
    id: string;
    nameAr: string;
    image?: string;
  };
  quantity: number;
  price: number;
}

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  postalCode: string;
}

interface User {
  id: string;
  email: string;
  phone?: string;
  address?: {
    street: string;
    city: string;
  };
}

interface ReviewStepProps {
  cartItems: CartItem[];
  guestInfo: CustomerInfo;
  isGuestCheckout: boolean;
  user?: User;
  shippingMethod: string;
  paymentMethod: string;
  shippingCost: number;
  taxAmount: number;
  totalAmount: number;
  orderNotes: string;
  onOrderNotesChange: (notes: string) => void;
  termsAccepted: boolean;
  onTermsAcceptedChange: (accepted: boolean) => void;
}

const ReviewStep: React.FC<ReviewStepProps> = ({
  cartItems,
  guestInfo,
  isGuestCheckout,
  user,
  shippingMethod,
  paymentMethod,
  shippingCost,
  taxAmount,
  totalAmount,
  orderNotes,
  onOrderNotesChange,
  termsAccepted,
  onTermsAcceptedChange
}) => {
  const { hidePrices } = usePricingSettings();
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Get shipping method label
  const getShippingMethodLabel = () => {
    switch (shippingMethod) {
      case 'standard':
        return 'الشحن القياسي';
      case 'express':
        return 'الشحن السريع';
      case 'free':
        return 'الشحن المجاني';
      default:
        return 'الشحن القياسي';
    }
  };

  // Get payment method label
  const getPaymentMethodLabel = () => {
    switch (paymentMethod) {
      case 'cod':
        return 'الدفع عند الاستلام';
      case 'credit':
        return 'الدفع بالبطاقة';
      case 'paypal':
        return 'باي بال';
      default:
        return 'الدفع عند الاستلام';
    }
  };

  // Get customer info
  const getCustomerInfo = () => {
    if (isGuestCheckout) {
      return {
        name: guestInfo.name,
        email: guestInfo.email,
        phone: guestInfo.phone,
        address: `${guestInfo.address}, ${guestInfo.city}, ${guestInfo.country}`
      };
    } else if (user) {
      return {
        name: user.email.split('@')[0],
        email: user.email,
        phone: user.phone || 'غير محدد',
        address: user.address ? `${user.address.street}, ${user.address.city}` : 'غير محدد'
      };
    }
    return {
      name: '',
      email: '',
      phone: '',
      address: ''
    };
  };

  const customerInfo = getCustomerInfo();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Order Summary */}
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-600" />
              ملخص الطلب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Cart Items */}
              <div className="space-y-3 max-h-60 overflow-y-auto p-2">
                {cartItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                    <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center">
                      {item.product?.image ? (
                        <img 
                          src={item.product.image} 
                          alt={item.product.nameAr} 
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <Package className="w-6 h-6 text-slate-400" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{item.product?.nameAr}</p>
                      <p className="text-xs text-slate-600">{item.quantity} × {item.price.toLocaleString()} ر.س</p>
                    </div>
                    <div className="font-medium text-slate-900">
                      {(item.quantity * item.price).toLocaleString()} ر.س
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Order Totals */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">الإجمالي</span>
                  <span className="font-medium">
                    {cartItems.reduce((sum, item) => sum + (item.quantity * item.price), 0).toLocaleString()} ر.س
                  </span>
                </div>
                
                <div className="flex justify-between">
                  <span className="text-sm text-slate-600">الشحن</span>
                  <span className="font-medium">
                    {shippingMethod === 'free' ? 'مجاني' : 
                     shippingCost.toLocaleString()} ر.س
                  </span>
                </div>
                
                {taxAmount > 0 && (
                  <div className="flex justify-between">
                    <span className="text-sm text-slate-600">الضريبة</span>
                    <span className="font-medium">{taxAmount.toLocaleString()} ر.س</span>
                  </div>
                )}
                
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200">
                  <span>الإجمالي الكلي</span>
                  <span className="text-primary">{totalAmount.toLocaleString()} ر.س</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      {/* Customer Information */}
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <User className="w-5 h-5 text-blue-600" />
              معلومات العميل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">الاسم</Label>
                <p className="text-sm">{customerInfo.name}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">البريد الإلكتروني</Label>
                <p className="text-sm">{customerInfo.email}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">رقم الهاتف</Label>
                <p className="text-sm">{customerInfo.phone}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">العنوان</Label>
                <p className="text-sm">{customerInfo.address}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      {/* Shipping and Payment */}
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-600" />
              الشحن والدفع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">طريقة الشحن</Label>
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-slate-500" />
                  <p className="text-sm">{getShippingMethodLabel()}</p>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium text-slate-700">طريقة الدفع</Label>
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-slate-500" />
                  <p className="text-sm">{getPaymentMethodLabel()}</p>
                </div>
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label className="text-sm font-medium text-slate-700">ملاحظات الطلب</Label>
                <Textarea
                  placeholder="أي ملاحظات إضافية للطلب"
                  value={orderNotes}
                  onChange={(e) => onOrderNotesChange(e.target.value)}
                  className="min-h-[80px]"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      {/* Terms and Conditions */}
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3 space-x-reverse">
              <Checkbox 
                id="terms" 
                checked={termsAccepted} 
                onCheckedChange={(checked) => onTermsAcceptedChange(checked === true)} 
              />
              <Label htmlFor="terms" className="text-sm">
                أوافق على{' '}
                <a href="/terms" className="font-medium text-primary hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                  الشروط والأحكام
                </a>{' '}
                و
                <a href="/privacy" className="font-medium text-primary hover:text-primary/80" target="_blank" rel="noopener noreferrer">
                  سياسة الخصوصية
                </a>
              </Label>
            </div>
            
            {!termsAccepted && (
              <motion.p
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-sm text-red-600 flex items-center gap-1 mt-2"
              >
                <AlertCircle className="w-3 h-3" />
                يجب قبول الشروط والأحكام لإتمام الطلب
              </motion.p>
            )}
          </CardContent>
        </Card>
      </motion.div>
      
      {/* Final Confirmation */}
      <motion.div variants={itemVariants}>
        <Card className="border-2 border-green-200 bg-gradient-to-r from-green-50 to-emerald-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-800">تأكيد الطلب</p>
                <p className="text-xs text-green-700 mt-1">
                  بالضغط على "إتمام الطلب"، فإنك تؤكد صحة جميع المعلومات المدخلة وتوافق على الشروط والأحكام.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ReviewStep;