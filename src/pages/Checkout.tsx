import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useCart } from '@/hooks/useCart';
import { useSettings } from '@/hooks/useSettings';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { apiPostJson } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { LoadingButton } from '@/components/ui/loading';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Toggle } from '@/components/ui/toggle';
import { 
  ShoppingCart, 
  User, 
  MapPin, 
  CreditCard, 
  Truck, 
  Shield, 
  CheckCircle, 
  AlertCircle,
  ArrowRight,
  Phone,
  Mail,
  Package,
  Clock,
  Wallet
} from 'lucide-react';
import CheckoutWizard from '@/components/checkout/CheckoutWizard';
import CustomerInfoStep from '@/components/checkout/steps/CustomerInfoStep';
import ShippingStep from '@/components/checkout/steps/ShippingStep';
import PaymentStep from '@/components/checkout/steps/PaymentStep';
import ReviewStep from '@/components/checkout/steps/ReviewStep';

const Checkout = () => {
  const [loading, setLoading] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');
  const [shippingMethod, setShippingMethod] = useState('standard');
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isGuestCheckout, setIsGuestCheckout] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Guest checkout form fields
  const [guestInfo, setGuestInfo] = useState({
    name: '',
    email: '',
    phone: '',
    country: 'sa',
    address: '',
    city: '',
    postalCode: ''
  });
  
  // Form validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const { isAuthenticated, user } = useDualAuth();
  const { items: cartItems, total, clearCart } = useCart();
  const { checkoutEnabled, shippingCost, expressShippingCost, freeShippingThreshold, taxRate } = useSettings();
  const { hidePrices } = usePricingSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if not authenticated or cart is empty
  useEffect(() => {
    if (!isAuthenticated && !isGuestCheckout) {
      navigate('/login', { state: { from: location } });
      return;
    }
    
    if (cartItems.length === 0) {
      navigate('/cart');
    }
  }, [isAuthenticated, cartItems, navigate, location, isGuestCheckout]);

  // Check if checkout is enabled in settings
  useEffect(() => {
    if (!checkoutEnabled) {
      navigate('/cart');
    }
  }, [checkoutEnabled, navigate]);

  const handleGuestInfoChange = (field: string, value: string) => {
    setGuestInfo(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const calculateShippingCost = () => {
    if (shippingMethod === 'free') return 0;
    if (shippingMethod === 'express') return expressShippingCost;
    return shippingCost;
  };

  const calculateTaxAmount = () => {
    if (!taxRate) return 0;
    const subtotal = total + calculateShippingCost();
    return (subtotal * taxRate) / 100;
  };

  const calculateTotal = () => {
    const subtotal = total + calculateShippingCost();
    const tax = calculateTaxAmount();
    return subtotal + tax;
  };

  const validateStep = (step: number) => {
    const newErrors: Record<string, string> = {};
    
    switch (step) {
      case 0: // Customer Info Step
        if (isGuestCheckout) {
          if (!guestInfo.name.trim()) {
            newErrors.name = 'الاسم مطلوب';
          }
          if (!guestInfo.email.trim()) {
            newErrors.email = 'البريد الإلكتروني مطلوب';
          } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestInfo.email)) {
            newErrors.email = 'البريد الإلكتروني غير صحيح';
          }
          if (!guestInfo.phone.trim()) {
            newErrors.phone = 'رقم الهاتف مطلوب';
          }
          if (!guestInfo.address.trim()) {
            newErrors.address = 'العنوان مطلوب';
          }
        }
        break;
        
      case 1: // Shipping Step
        // Add shipping validation if needed
        break;
        
      case 2: // Payment Step
        if (paymentMethod === 'credit') {
          // Add credit card validation if needed
        }
        break;
        
      case 3: // Review Step
        if (!termsAccepted) {
          newErrors.terms = 'يجب ق.accept الشروط والأحكام';
        }
        break;
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCheckout = async () => {
    if (!termsAccepted) {
      toast({
        title: 'خطأ',
        description: 'يرجى قبول الشروط والأحكام',
        variant: 'destructive'
      });
      return;
    }
    
    setLoading(true);
    
    try {
      // Prepare shipping address
      const shippingAddress = isGuestCheckout ? {
        street: guestInfo.address,
        city: guestInfo.city,
        state: '',
        postalCode: guestInfo.postalCode,
        country: guestInfo.country
      } : {
        street: (user as any)?.address || '',
        city: (user as any)?.city || '',
        state: (user as any)?.state || '',
        postalCode: (user as any)?.postalCode || '',
        country: (user as any)?.country || 'sa'
      };

      // Prepare order items
      const orderItems = cartItems.map(item => ({
        productId: item.id,
        quantity: item.quantity,
        price: item.price
      }));

      // Calculate costs
      const shippingCostValue = calculateShippingCost();
      const taxAmount = calculateTaxAmount();
      const totalAmount = calculateTotal();

      // Prepare order data
      const orderData = {
        items: orderItems,
        shippingAddress,
        billingAddress: shippingAddress,
        paymentMethod,
        shippingMethod,
        notes: orderNotes,
        subtotal: total,
        shipping: shippingCostValue,
        tax: taxAmount,
        total: totalAmount,
        ...(isGuestCheckout && {
          guestInfo: {
            name: guestInfo.name,
            email: guestInfo.email,
            phone: guestInfo.phone
          }
        })
      };

      // Create order via API
      const response = await apiPostJson('/api/orders', orderData) as any;
      
      if (response.ok && response.orderId) {
        // Clear cart
        clearCart();
        
        // Show success message
        toast({
          title: 'تم إنشاء الطلب بنجاح',
          description: `رقم الطلب: ${response.orderNumber}`,
          variant: 'default'
        });
        
        // Navigate to confirmation page
        navigate(`/order-confirmation?orderId=${response.orderId}&orderNumber=${response.orderNumber}`);
      } else {
        throw new Error(response.error || 'فشل في إنشاء الطلب');
      }
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'خطأ في إتمام الطلب',
        description: error.message || 'فشل في إتمام الطلب. يرجى المحاولة مرة أخرى',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  // Wizard navigation handlers
  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (currentStep < 3) {
        setCurrentStep(prev => prev + 1);
      } else {
        handleCheckout();
      }
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  };

  const handleStepChange = (step: number) => {
    if (validateStep(currentStep)) {
      setCurrentStep(step);
    }
  };

  if (cartItems.length === 0) {
    return null; // Will redirect in useEffect
  }

  const shippingCostValue = calculateShippingCost();
  const taxAmount = calculateTaxAmount();
  const totalAmount = calculateTotal();

  // Define checkout steps
  const checkoutSteps = [
    {
      id: 'customer-info',
      title: 'معلومات العميل',
      description: 'بيانات الاتصال',
      icon: <User className="w-5 h-5" />,
      component: (
        <CustomerInfoStep
          isGuestCheckout={isGuestCheckout}
          onGuestCheckoutChange={setIsGuestCheckout}
          customerInfo={guestInfo}
          onCustomerInfoChange={handleGuestInfoChange}
          user={user}
          errors={errors}
        />
      )
    },
    {
      id: 'shipping',
      title: 'الشحن',
      description: 'عنوان التوصيل',
      icon: <MapPin className="w-5 h-5" />,
      component: (
        <ShippingStep
          shippingMethod={shippingMethod}
          onShippingMethodChange={setShippingMethod}
          shippingCost={shippingCost}
          expressShippingCost={expressShippingCost}
          freeShippingThreshold={freeShippingThreshold}
          total={total}
        />
      )
    },
    {
      id: 'payment',
      title: 'الدفع',
      description: 'طريقة الدفع',
      icon: <CreditCard className="w-5 h-5" />,
      component: (
        <PaymentStep
          paymentMethod={paymentMethod}
          onPaymentMethodChange={setPaymentMethod}
        />
      )
    },
    {
      id: 'review',
      title: 'مراجعة',
      description: 'تأكيد الطلب',
      icon: <CheckCircle className="w-5 h-5" />,
      component: (
        <ReviewStep
          cartItems={cartItems}
          guestInfo={guestInfo}
          isGuestCheckout={isGuestCheckout}
          user={user}
          shippingMethod={shippingMethod}
          paymentMethod={paymentMethod}
          shippingCost={shippingCostValue}
          taxAmount={taxAmount}
          totalAmount={totalAmount}
          orderNotes={orderNotes}
          onOrderNotesChange={setOrderNotes}
          termsAccepted={termsAccepted}
          onTermsAcceptedChange={setTermsAccepted}
        />
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
          <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <ArrowRight className="w-4 h-4" />
          <Link to="/cart" className="hover:text-primary transition-colors">السلة</Link>
          <ArrowRight className="w-4 h-4" />
          <span className="text-slate-900 font-medium">إتمام الطلب</span>
        </div>
        
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-slate-900">إتمام الطلب</h1>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <span className="text-sm text-slate-600">العربة:</span>
            <span className="font-bold">{cartItems.length} منتج</span>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Checkout Wizard */}
          <div className="lg:col-span-2">
            <CheckoutWizard
              steps={checkoutSteps}
              currentStep={currentStep}
              onStepChange={handleStepChange}
              onNext={handleNext}
              onPrevious={handlePrevious}
              canProceed={true}
              isLoading={loading}
            />
          </div>
          
          {/* Right Column - Order Summary */}
          <div className="lg:col-span-1">
            <Card className="border border-slate-200 rounded-2xl shadow-sm sticky top-6">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-primary" />
                  ملخص الطلب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Cart Items Summary */}
                  <div className="space-y-3 max-h-60 overflow-y-auto p-2">
                    {cartItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg">
                        <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center">
                          {item.product?.image || item.product?.category ? (
                            <img 
                              src={item.product.image || `/api/categories/${item.product.category}/image`} 
                              alt={item.product.nameAr} 
                              className="w-full h-full object-cover rounded-lg"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'https://via.placeholder.com/48x48?text=No+Image';
                              }}
                            />
                          ) : (
                            <span className="text-xs text-slate-500">صورة</span>
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
                  
                  <div className="border-t border-slate-200 pt-4 space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">الإجمالي</span>
                      <span className="font-medium">{total.toLocaleString()} ر.س</span>
                    </div>
                    
                    <div className="flex justify-between">
                      <span className="text-sm text-slate-600">الشحن</span>
                      <span className="font-medium">
                        {shippingMethod === 'free' ? 'مجاني' : 
                         shippingCostValue.toLocaleString()} ر.س
                      </span>
                    </div>
                    
                    {taxRate > 0 && (
                      <div className="flex justify-between">
                        <span className="text-sm text-slate-600">الضريبة ({taxRate}%)</span>
                        <span className="font-medium">{taxAmount.toLocaleString()} ر.س</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-200">
                      <span>الإجمالي الكلي</span>
                      <span className="text-primary">{totalAmount.toLocaleString()} ر.س</span>
                    </div>
                  </div>
                  
                  {/* Progress indicator for mobile */}
                  <div className="lg:hidden pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-slate-700">تقدم الطلب</span>
                      <span className="text-sm text-slate-500">{currentStep + 1} من 4</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${((currentStep + 1) / 4) * 100}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Security Badges */}
            <div className="mt-6 space-y-4">
              <div className="flex items-center justify-center gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-lg">
                <Shield className="w-4 h-4 text-green-600" />
                <span>مدفوعات آمنة ومشفرة</span>
              </div>
              <div className="flex justify-center">
                <div className="flex gap-3">
                  <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700">VISA</span>
                  </div>
                  <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700">MC</span>
                  </div>
                  <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700">PP</span>
                  </div>
                  <div className="w-10 h-6 bg-slate-200 rounded flex items-center justify-center">
                    <span className="text-xs font-bold text-slate-700">AP</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;