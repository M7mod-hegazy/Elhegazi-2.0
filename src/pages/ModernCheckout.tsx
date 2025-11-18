import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useCart } from '@/hooks/useCart';
import { useSettings } from '@/hooks/useSettings';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { useToast } from '@/hooks/use-toast';
import { apiPostJson } from '@/lib/api';
import { 
  CreditCard, 
  Truck, 
  MapPin, 
  User, 
  Mail, 
  Phone,
  Wallet,
  Building2,
  CheckCircle2,
  ArrowRight,
  ShoppingBag,
  Edit2,
  Lock,
  Smartphone,
  MessageCircle
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ContactButtons } from '@/components/ui/ContactButtons';

interface OrderData {
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  shippingMethod: 'standard' | 'express';
  paymentMethod: 'cod' | 'credit' | 'wallet' | 'vodafone';
  notes?: string;
  vodafoneNumber?: string; // For Vodafone Cash
}

const ModernCheckout: React.FC = () => {
  const { items: cartItems, total, clearCart, loading: cartLoading, syncToBackend } = useCart();
  const { isAuthenticated, user } = useDualAuth();
  const { shippingCost, expressShippingCost, taxRate } = useSettings();
  const { hidePrices, contactMessage } = usePricingSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<OrderData>({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    shippingMethod: 'standard',
    paymentMethod: 'cod',
    notes: '',
    vodafoneNumber: ''
  });

  const [errors, setErrors] = useState<Partial<Record<keyof OrderData, string>>>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [orderNumber, setOrderNumber] = useState('');

  // Pre-fill user data if authenticated
  useEffect(() => {
    if (user) {
      setFormData(prev => ({
        ...prev,
        name: user.firstName && user.lastName ? `${user.firstName} ${user.lastName}` : '',
        email: user.email || '',
        phone: user.phone || '',
        address: user.address?.street || '',
        city: user.address?.city || ''
      }));
    }
  }, [user]);

  // Redirect if cart empty
  useEffect(() => {
    if (!cartLoading && cartItems.length === 0) {
      toast({
        title: "السلة فارغة",
        description: "يرجى إضافة منتجات إلى السلة أولاً",
        variant: "destructive"
      });
      navigate('/cart');
    }
  }, [cartItems, cartLoading, navigate, toast]);

  // Calculate costs
  const shipping = formData.shippingMethod === 'express' 
    ? (expressShippingCost || 25) 
    : (shippingCost || 15);
  const tax = ((total + shipping) * (taxRate || 15)) / 100;
  const finalTotal = total + shipping + tax;


  // Handle input change
  const handleChange = (field: keyof OrderData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Validate form
  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof OrderData, string>> = {};

    if (!formData.name.trim()) newErrors.name = 'الاسم مطلوب';
    if (!formData.email.trim()) newErrors.email = 'البريد الإلكتروني مطلوب';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'البريد غير صحيح';
    if (!formData.phone.trim()) newErrors.phone = 'رقم الهاتف مطلوب';
    if (!formData.address.trim()) newErrors.address = 'العنوان مطلوب';
    if (!formData.city.trim()) newErrors.city = 'المدينة مطلوبة';
    
    // Validate Vodafone Cash number
    if (formData.paymentMethod === 'vodafone') {
      if (!formData.vodafoneNumber?.trim()) {
        newErrors.vodafoneNumber = 'رقم فودافون كاش مطلوب';
      } else if (!/^01[0-2,5]{1}[0-9]{8}$/.test(formData.vodafoneNumber)) {
        newErrors.vodafoneNumber = 'رقم فودافون كاش غير صحيح';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Submit order
  const handleSubmit = async () => {
    if (!validate()) {
      toast({
        title: "خطأ في البيانات",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    // If prices are hidden, show confirmation page first
    if (hidePrices) {
      const generatedOrderNumber = `ORD-${Date.now().toString().slice(-6)}`;
      setOrderNumber(generatedOrderNumber);
      setShowConfirmation(true);
      return;
    }

    // Otherwise proceed with normal checkout
    await submitOrder();
  };

  // Submit order to backend
  const submitOrder = async () => {
    setIsSubmitting(true);

    try {
      // Sync cart to backend before creating order (for authenticated users)
      if (isAuthenticated) {
        await syncToBackend();
      }

      interface OrderResponse {
        _id: string;
        orderNumber?: string;
      }

      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          price: item.price
        })),
        shippingAddress: {
          street: formData.address,
          city: formData.city,
          country: 'EG',
          phone: formData.phone
        },
        billingAddress: {
          street: formData.address,
          city: formData.city,
          country: 'EG',
          phone: formData.phone
        },
        guestInfo: isAuthenticated ? undefined : {
          name: formData.name,
          email: formData.email,
          phone: formData.phone
        },
        paymentMethod: formData.paymentMethod,
        shippingMethod: formData.shippingMethod,
        subtotal: total,
        shipping: shipping,
        tax,
        total: finalTotal,
        notes: formData.notes,
        vodafoneNumber: formData.paymentMethod === 'vodafone' ? formData.vodafoneNumber : undefined
      };

      const response = await apiPostJson<OrderResponse, typeof orderData>('/api/orders', orderData);

      if (response.ok && response.item) {
        clearCart();
        
        toast({
          title: "✅ تم إنشاء الطلب بنجاح!",
          description: `رقم الطلب: ${response.item.orderNumber || response.item._id}`,
        });

        navigate(`/order-confirmation?orderId=${response.item._id}`);
      } else {
        throw new Error('فشل في إنشاء الطلب');
      }
    } catch (error) {
      toast({
        title: "خطأ في إنشاء الطلب",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">جاري تحميل السلة...</p>
        </div>
      </div>
    );
  }

  // Show confirmation page when prices are hidden
  if (showConfirmation && hidePrices) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-6"
          >
            {/* Success Icon */}
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-green-100 mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">✅ تم إنشاء الطلب بنجاح</h1>
              <p className="text-gray-600">سيتم التواصل معك قريباً</p>
            </div>

            {/* Order Details Card */}
            <Card className="border-2 border-green-200 shadow-lg">
              <CardContent className="p-8 space-y-6">
                
                {/* Order Number */}
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <p className="text-sm text-gray-600 mb-1">رقم الطلب</p>
                  <p className="text-3xl font-bold text-green-600">{orderNumber}</p>
                </div>

                <Separator />

                {/* Customer Info */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">معلومات العميل</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-gray-600">الاسم</p>
                      <p className="font-medium text-gray-900">{formData.name}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-gray-600">البريد الإلكتروني</p>
                      <p className="font-medium text-gray-900">{formData.email}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-gray-600">الهاتف</p>
                      <p className="font-medium text-gray-900">{formData.phone}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-lg">
                      <p className="text-xs text-gray-600">المدينة</p>
                      <p className="font-medium text-gray-900">{formData.city}</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Products List */}
                <div className="space-y-3">
                  <h3 className="font-semibold text-gray-900">المنتجات ({cartItems.length})</h3>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{item.product.nameAr}</p>
                          <p className="text-sm text-gray-600">الكمية: {item.quantity}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                {/* Action Buttons */}
                <div className="space-y-3">
                  <Button
                    onClick={async () => {
                      await submitOrder();
                      setShowConfirmation(false);
                    }}
                    disabled={isSubmitting}
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-6 rounded-xl shadow-lg text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                        جاري الإرسال...
                      </>
                    ) : (
                      <>
                        <MessageCircle className="w-6 h-6 mr-3" />
                        تأكيد وإرسال للواتس
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => setShowConfirmation(false)}
                    variant="outline"
                    className="w-full py-6 rounded-xl text-lg"
                  >
                    العودة للتعديل
                  </Button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg text-center">
                  <p className="text-sm text-blue-800">
                    سيتم إرسال تفاصيل الطلب إلى رقم الواتس المسجل
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 text-center"
        >
          <h1 className="text-4xl font-bold text-gray-900 mb-2">إتمام الطلب</h1>
          <p className="text-gray-600">خطوة واحدة فقط للحصول على طلبك</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Form - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contact Information */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card className="border-2 border-primary/10 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">معلومات الاتصال</h2>
                      <p className="text-sm text-gray-600">سنستخدمها لإرسال تفاصيل الطلب</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-500" />
                        الاسم الكامل *
                      </Label>
                      <Input
                        id="name"
                        placeholder="أدخل اسمك"
                        value={formData.name}
                        onChange={(e) => handleChange('name', e.target.value)}
                        className={errors.name ? 'border-red-500' : ''}
                      />
                      {errors.name && <p className="text-sm text-red-600">{errors.name}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="phone" className="flex items-center gap-2">
                        <Phone className="w-4 h-4 text-gray-500" />
                        رقم الهاتف *
                      </Label>
                      <Input
                        id="phone"
                        placeholder="+966 50 000 0000"
                        value={formData.phone}
                        onChange={(e) => handleChange('phone', e.target.value)}
                        className={errors.phone ? 'border-red-500' : ''}
                      />
                      {errors.phone && <p className="text-sm text-red-600">{errors.phone}</p>}
                    </div>

                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-gray-500" />
                        البريد الإلكتروني *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="email@example.com"
                        value={formData.email}
                        onChange={(e) => handleChange('email', e.target.value)}
                        className={errors.email ? 'border-red-500' : ''}
                      />
                      {errors.email && <p className="text-sm text-red-600">{errors.email}</p>}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Shipping Address */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="border-2 border-green-100 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">عنوان التوصيل</h2>
                      <p className="text-sm text-gray-600">أين تريد استلام طلبك؟</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 space-y-2">
                      <Label htmlFor="address" className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        العنوان التفصيلي *
                      </Label>
                      <Input
                        id="address"
                        placeholder="رقم المبنى، اسم الشارع، الحي"
                        value={formData.address}
                        onChange={(e) => handleChange('address', e.target.value)}
                        className={errors.address ? 'border-red-500' : ''}
                      />
                      {errors.address && <p className="text-sm text-red-600">{errors.address}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city" className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-gray-500" />
                        المدينة *
                      </Label>
                      <Input
                        id="city"
                        placeholder="الرياض، جدة، الخ"
                        value={formData.city}
                        onChange={(e) => handleChange('city', e.target.value)}
                        className={errors.city ? 'border-red-500' : ''}
                      />
                      {errors.city && <p className="text-sm text-red-600">{errors.city}</p>}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="notes">ملاحظات (اختياري)</Label>
                      <Input
                        id="notes"
                        placeholder="أي تعليمات خاصة للتوصيل"
                        value={formData.notes}
                        onChange={(e) => handleChange('notes', e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Shipping Method */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="border-2 border-orange-100 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                      <Truck className="w-6 h-6 text-orange-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">طريقة الشحن</h2>
                      <p className="text-sm text-gray-600">اختر سرعة التوصيل</p>
                    </div>
                  </div>

                  <RadioGroup
                    value={formData.shippingMethod}
                    onValueChange={(value: 'standard' | 'express') => handleChange('shippingMethod', value)}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-lg hover:border-primary cursor-pointer transition-all">
                      <RadioGroupItem value="standard" id="standard" />
                      <Label htmlFor="standard" className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-semibold">الشحن القياسي</p>
                            <p className="text-sm text-gray-600">توصيل خلال 3-5 أيام</p>
                          </div>
                          <p className="font-bold text-primary">{shippingCost || 15} ر.س</p>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-lg hover:border-orange-500 cursor-pointer transition-all">
                      <RadioGroupItem value="express" id="express" />
                      <Label htmlFor="express" className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-semibold">الشحن السريع</p>
                              <Badge variant="destructive" className="text-xs">سريع</Badge>
                            </div>
                            <p className="text-sm text-gray-600">توصيل خلال 1-2 يوم</p>
                          </div>
                          <p className="font-bold text-orange-600">{expressShippingCost || 25} ر.س</p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </motion.div>

            {/* Payment Method */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border-2 border-purple-100 shadow-lg">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                      <CreditCard className="w-6 h-6 text-purple-600" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-gray-900">طريقة الدفع</h2>
                      <p className="text-sm text-gray-600">كيف تفضل الدفع؟</p>
                    </div>
                  </div>

                  <RadioGroup
                    value={formData.paymentMethod}
                    onValueChange={(value: 'cod' | 'credit' | 'wallet' | 'vodafone') => handleChange('paymentMethod', value)}
                    className="space-y-3"
                  >
                    <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-lg hover:border-green-500 cursor-pointer transition-all">
                      <RadioGroupItem value="cod" id="cod" />
                      <Label htmlFor="cod" className="flex-1 cursor-pointer">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <Wallet className="w-5 h-5 text-green-600" />
                            <div>
                              <p className="font-semibold">الدفع عند الاستلام</p>
                              <p className="text-sm text-gray-600">ادفع نقداً للمندوب</p>
                            </div>
                          </div>
                          <Badge variant="outline" className="text-green-600 border-green-600">موصى به</Badge>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-lg hover:border-red-500 cursor-pointer transition-all">
                      <RadioGroupItem value="vodafone" id="vodafone" />
                      <Label htmlFor="vodafone" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Smartphone className="w-5 h-5 text-red-600" />
                          <div>
                            <p className="font-semibold">فودافون كاش</p>
                            <p className="text-sm text-gray-600">محفظة فودافون مصر</p>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-lg hover:border-primary cursor-pointer transition-all">
                      <RadioGroupItem value="credit" id="credit" />
                      <Label htmlFor="credit" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <CreditCard className="w-5 h-5 text-primary" />
                          <div>
                            <p className="font-semibold">بطاقة ائتمانية</p>
                            <p className="text-sm text-gray-600">دفع آمن ومشفر</p>
                          </div>
                        </div>
                      </Label>
                    </div>

                    <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-lg hover:border-purple-500 cursor-pointer transition-all">
                      <RadioGroupItem value="wallet" id="wallet" />
                      <Label htmlFor="wallet" className="flex-1 cursor-pointer">
                        <div className="flex items-center gap-3">
                          <Wallet className="w-5 h-5 text-purple-600" />
                          <div>
                            <p className="font-semibold">محفظة إلكترونية</p>
                            <p className="text-sm text-gray-600">STC Pay, Apple Pay</p>
                          </div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                  
                  {/* Vodafone Cash Number Input */}
                  {formData.paymentMethod === 'vodafone' && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mt-4 p-4 bg-red-50 border-2 border-red-200 rounded-lg"
                    >
                      <Label htmlFor="vodafoneNumber" className="flex items-center gap-2 mb-2">
                        <Phone className="w-4 h-4 text-red-600" />
                        رقم فودافون كاش *
                      </Label>
                      <Input
                        id="vodafoneNumber"
                        placeholder="01XXXXXXXXX"
                        value={formData.vodafoneNumber}
                        onChange={(e) => handleChange('vodafoneNumber', e.target.value)}
                        className={errors.vodafoneNumber ? 'border-red-500' : ''}
                      />
                      {errors.vodafoneNumber && (
                        <p className="text-sm text-red-600 mt-1">{errors.vodafoneNumber}</p>
                      )}
                      <p className="text-xs text-gray-600 mt-2">
                        سيتم إرسال طلب دفع إلى رقم فودافون كاش الخاص بك
                      </p>
                    </motion.div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Order Summary - 1 column */}
          <div className="lg:col-span-1">
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky top-4"
            >
              <Card className="border-2 border-primary/20 shadow-xl">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <ShoppingBag className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold text-gray-900">ملخص الطلب</h2>
                  </div>

                  {/* Cart Items */}
                  <div className="space-y-3 mb-6 max-h-64 overflow-y-auto">
                    {cartItems.map(item => (
                      <div key={item.id} className="flex gap-3 p-3 bg-gray-50 rounded-lg">
                        <img 
                          src={item.product.image || `/api/categories/${item.product.category}/image`} 
                          alt={item.product.nameAr}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            const target = e.target as HTMLImageElement;
                            target.src = 'https://via.placeholder.com/64x64?text=No+Image';
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{item.product.nameAr}</p>
                          <p className="text-sm text-gray-600">الكمية: {item.quantity}</p>
                          {!hidePrices && (
                            <p className="text-sm font-bold text-primary">{item.subtotal.toLocaleString()} ر.س</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <Separator className="my-4" />

                  {/* Price Breakdown */}
                  {hidePrices ? (
                    <div className="space-y-3 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-sm text-amber-800 font-medium">الأسعار مخفية حالياً</p>
                      <p className="text-xs text-amber-700">يرجى اللمعرفة السعر للحصول على الأسعار النهائية</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex justify-between text-gray-700">
                        <span>المجموع الفرعي</span>
                        <span className="font-semibold">{total.toLocaleString()} ر.س</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>الشحن</span>
                        <span className="font-semibold">{shipping.toLocaleString()} ر.س</span>
                      </div>
                      <div className="flex justify-between text-gray-700">
                        <span>الضريبة ({taxRate}%)</span>
                        <span className="font-semibold">{tax.toLocaleString()} ر.س</span>
                      </div>

                      <Separator />

                      <div className="flex justify-between text-xl font-bold text-gray-900">
                        <span>الإجمالي</span>
                        <span className="text-primary">{finalTotal.toLocaleString()} ر.س</span>
                      </div>
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="w-full mt-6 bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white font-bold py-6 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 text-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3" />
                        جاري إنشاء الطلب...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-6 h-6 mr-3" />
                        تأكيد الطلب
                      </>
                    )}
                  </Button>

                  <div className="mt-4 flex items-center justify-center gap-2 text-sm text-gray-600">
                    <Lock className="w-4 h-4" />
                    <span>معاملة آمنة ومشفرة</span>
                  </div>

                  {/* Contact Help - Before Place Order */}
                  <div className="mt-6">
                    <ContactButtons 
                      title="تحتاج مساعدة؟"
                      description="نحن هنا لمساعدتك في إتمام الطلب"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModernCheckout;
