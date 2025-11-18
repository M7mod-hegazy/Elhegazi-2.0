import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useCart } from '@/hooks/useCart';
import { useSettings } from '@/hooks/useSettings';
import { useToast } from '@/hooks/use-toast';
import { apiPostJson } from '@/lib/api';
import { 
  User, 
  Truck, 
  CreditCard, 
  CheckCircle,
  ArrowRight,
  ShoppingCart,
  Smartphone,
  Wallet,
  Clock,
  Zap,
  Gift
} from 'lucide-react';

// Import our new components
import CheckoutWizard from '@/components/checkout/CheckoutWizard';
import CustomerInfoStep from '@/components/checkout/steps/CustomerInfoStep';
import ShippingStep from '@/components/checkout/steps/ShippingStep';
import PaymentStep from '@/components/checkout/steps/PaymentStep';
import ReviewStep from '@/components/checkout/steps/ReviewStep';

interface CustomerInfo {
  name: string;
  email: string;
  phone: string;
  country: string;
  address: string;
  city: string;
  postalCode: string;
}

const EnhancedCheckout: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isGuestCheckout, setIsGuestCheckout] = useState(false);
  const [selectedShipping, setSelectedShipping] = useState('standard');
  const [selectedPayment, setSelectedPayment] = useState('cod');
  const [orderNotes, setOrderNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [customerInfo, setCustomerInfo] = useState<CustomerInfo>({
    name: '',
    email: '',
    phone: '',
    country: 'sa',
    address: '',
    city: '',
    postalCode: ''
  });

  const { isAuthenticated, user } = useDualAuth();
  const { items: cartItems, total, clearCart, loading: cartLoading } = useCart();
  const { checkoutEnabled, shippingCost, expressShippingCost, freeShippingThreshold, taxRate } = useSettings();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  // Redirect if cart is empty or checkout disabled (but wait for cart to load first)
  useEffect(() => {
    // Don't redirect while cart is still loading
    if (cartLoading) {
      return;
    }
    
    if (cartItems.length === 0) {
      toast({
        title: "السلة فارغة",
        description: "يرجى إضافة منتجات إلى السلة أولاً",
        variant: "destructive"
      });
      navigate('/cart');
      return;
    }
    
    if (!checkoutEnabled) {
      toast({
        title: "غير متاح",
        description: "عملية الشراء غير متاحة حالياً",
        variant: "destructive"
      });
      navigate('/cart');
      return;
    }

    if (!isAuthenticated && !isGuestCheckout) {
      // Allow them to choose guest checkout instead of forcing login
    }
  }, [cartItems, checkoutEnabled, isAuthenticated, isGuestCheckout, navigate, cartLoading, toast]);

  // Shipping options
  const shippingOptions = [
    {
      id: 'standard',
      name: 'الشحن القياسي',
      description: 'توصيل خلال 3-5 أيام عمل',
      price: shippingCost || 15,
      estimatedDays: '3-5 أيام عمل',
      icon: <Truck className="w-5 h-5 text-blue-600" />,
      features: ['تتبع مجاني', 'تأمين شامل']
    },
    {
      id: 'express',
      name: 'الشحن السريع',
      description: 'توصيل خلال 1-2 أيام عمل',
      price: expressShippingCost || 25,
      estimatedDays: '1-2 أيام عمل',
      icon: <Zap className="w-5 h-5 text-orange-600" />,
      badge: 'سريع',
      features: ['تتبع مباشر', 'أولوية في التوصيل', 'تأمين شامل']
    }
  ];

  // Add free shipping option if eligible
  if (freeShippingThreshold && total >= freeShippingThreshold) {
    shippingOptions.unshift({
      id: 'free',
      name: 'الشحن المجاني',
      description: `للطلبات فوق ${freeShippingThreshold.toLocaleString()} ريال`,
      price: 0,
      estimatedDays: '3-5 أيام عمل',
      icon: <Gift className="w-5 h-5 text-green-600" />,
      badge: 'مجاني',
      features: ['توفير في التكلفة', 'تتبع مجاني']
    });
  }

  // Payment options
  const paymentOptions = [
    {
      id: 'cod',
      name: 'الدفع عند الاستلام',
      description: 'ادفع نقداً عند استلام الطلب',
      icon: <Wallet className="w-5 h-5 text-green-600" />,
      badges: ['آمن', 'مضمون'],
      features: ['لا حاجة لبطاقة', 'دفع مباشر للمندوب', 'فحص المنتج قبل الدفع'],
      processingTime: 'فوري'
    },
    {
      id: 'credit',
      name: 'بطاقة ائتمانية',
      description: 'فيزا، ماستركارد، أو مدى',
      icon: <CreditCard className="w-5 h-5 text-blue-600" />,
      badges: ['سريع', 'آمن'],
      features: ['دفع فوري', 'تشفير آمن', 'حماية من الاحتيال'],
      processingTime: 'فوري'
    },
    {
      id: 'stc',
      name: 'STC Pay',
      description: 'الدفع عبر محفظة STC Pay',
      icon: <Smartphone className="w-5 h-5 text-purple-600" />,
      badges: ['سهل', 'سريع'],
      features: ['دفع بالهاتف', 'بدون رسوم', 'تأكيد فوري'],
      processingTime: 'فوري'
    }
  ];

  // Validation functions
  const validateCustomerInfo = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (isGuestCheckout) {
      if (!customerInfo.name.trim()) {
        newErrors.name = 'الاسم مطلوب';
      }
      if (!customerInfo.email.trim()) {
        newErrors.email = 'البريد الإلكتروني مطلوب';
      } else if (!/\S+@\S+\.\S+/.test(customerInfo.email)) {
        newErrors.email = 'البريد الإلكتروني غير صحيح';
      }
      if (!customerInfo.phone.trim()) {
        newErrors.phone = 'رقم الهاتف مطلوب';
      }
      if (!customerInfo.address.trim()) {
        newErrors.address = 'العنوان مطلوب';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const canProceedToNextStep = (): boolean => {
    switch (currentStep) {
      case 0: // Customer Info
        return isAuthenticated || (isGuestCheckout && validateCustomerInfo());
      case 1: // Shipping
        return !!selectedShipping;
      case 2: // Payment
        return !!selectedPayment;
      case 3: // Review
        return true;
      default:
        return false;
    }
  };

  // Calculate totals
  const calculateShippingCost = () => {
    const option = shippingOptions.find(opt => opt.id === selectedShipping);
    return option?.price || 0;
  };

  const calculateTaxAmount = () => {
    if (!taxRate) return 0;
    const subtotal = total + calculateShippingCost();
    return (subtotal * taxRate) / 100;
  };

  const calculateTotal = () => {
    const subtotal = total;
    const shipping = calculateShippingCost();
    const tax = calculateTaxAmount();
    return subtotal + shipping + tax;
  };

  // Handle customer info change
  const handleCustomerInfoChange = (field: keyof CustomerInfo, value: string) => {
    setCustomerInfo(prev => ({
      ...prev,
      [field]: value
    }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  // Handle step navigation
  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handlePlaceOrder();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleStepChange = (step: number) => {
    setCurrentStep(step);
  };

  // Place order
  const handlePlaceOrder = async () => {
    setIsLoading(true);
    
    try {
      const orderData = {
        items: cartItems.map(item => ({
          productId: item.productId || item.id,
          quantity: item.quantity,
          price: item.price
        })),
        customer: isGuestCheckout ? customerInfo : {
          name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email?.split('@')[0] || '',
          email: user?.email || '',
          phone: user?.phone || '',
          address: user?.address?.street || customerInfo.address,
          city: user?.address?.city || customerInfo.city,
          country: user?.address?.country || customerInfo.country
        },
        shipping: {
          method: selectedShipping,
          cost: calculateShippingCost()
        },
        payment: {
          method: selectedPayment
        },
        subtotal: total,
        shippingCost: calculateShippingCost(),
        tax: calculateTaxAmount(),
        total: calculateTotal(),
        notes: orderNotes,
        isGuestOrder: isGuestCheckout
      };

      interface OrderResponse {
        _id: string;
        orderNumber?: string;
      }
      
      const response = await apiPostJson<OrderResponse, typeof orderData>('/api/orders', orderData);
      
      if (response.ok && response.item) {
        // Clear cart
        clearCart();
        
        // Show success message
        toast({
          title: "تم إنشاء الطلب بنجاح!",
          description: `رقم الطلب: ${response.item.orderNumber || response.item._id}`,
        });

        // Navigate to order confirmation
        navigate(`/order-confirmation?orderId=${response.item._id}`);
      } else {
        const errorResponse = response as { ok: false; error: string };
        throw new Error(errorResponse.error || 'فشل في إنشاء الطلب');
      }
    } catch (error) {
      console.error('Order creation error:', error);
      toast({
        title: "خطأ في إنشاء الطلب",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Define checkout steps
  const steps = [
    {
      id: 'customer',
      title: 'معلومات العميل',
      description: 'البيانات الشخصية',
      icon: <User className="w-5 h-5" />,
      component: (
        <CustomerInfoStep
          isGuestCheckout={isGuestCheckout}
          onGuestCheckoutChange={setIsGuestCheckout}
          customerInfo={customerInfo}
          onCustomerInfoChange={handleCustomerInfoChange}
          user={user}
          errors={errors}
        />
      )
    },
    {
      id: 'shipping',
      title: 'طريقة الشحن',
      description: 'اختر التوصيل',
      icon: <Truck className="w-5 h-5" />,
      component: (
        <ShippingStep
          selectedShipping={selectedShipping}
          onShippingChange={setSelectedShipping}
          shippingOptions={shippingOptions}
          orderTotal={total}
          freeShippingThreshold={freeShippingThreshold}
        />
      )
    },
    {
      id: 'payment',
      title: 'طريقة الدفع',
      description: 'اختر الدفع',
      icon: <CreditCard className="w-5 h-5" />,
      component: (
        <PaymentStep
          selectedPayment={selectedPayment}
          onPaymentChange={setSelectedPayment}
          paymentOptions={paymentOptions}
        />
      )
    },
    {
      id: 'review',
      title: 'مراجعة الطلب',
      description: 'تأكيد البيانات',
      icon: <CheckCircle className="w-5 h-5" />,
      component: (
        <ReviewStep
          orderSummary={{
            items: cartItems,
            subtotal: total,
            shipping: calculateShippingCost(),
            tax: calculateTaxAmount(),
            total: calculateTotal()
          }}
          customerInfo={isGuestCheckout ? customerInfo : {
            name: user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}` : user?.email?.split('@')[0] || '',
            email: user?.email || '',
            phone: user?.phone || '',
            address: user?.address?.street || '',
            city: user?.address?.city || '',
            country: user?.address?.country || 'sa'
          }}
          shippingMethod={selectedShipping}
          paymentMethod={selectedPayment}
          orderNotes={orderNotes}
          onEditStep={handleStepChange}
          isLoading={isLoading}
        />
      )
    }
  ];

  if (cartItems.length === 0) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Breadcrumb */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 text-sm text-slate-600 mb-6"
        >
          <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <ArrowRight className="w-4 h-4" />
          <Link to="/cart" className="hover:text-primary transition-colors">السلة</Link>
          <ArrowRight className="w-4 h-4" />
          <span className="text-slate-900 font-medium">إتمام الطلب</span>
        </motion.div>
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900">إتمام الطلب</h1>
          <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm">
            <ShoppingCart className="w-5 h-5 text-primary" />
            <span className="text-sm text-slate-600">العربة:</span>
            <span className="font-bold">{cartItems.length} منتج</span>
          </div>
        </motion.div>
        
        {/* Checkout Wizard */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <CheckoutWizard
            steps={steps}
            currentStep={currentStep}
            onStepChange={handleStepChange}
            onNext={handleNext}
            onPrevious={handlePrevious}
            canProceed={canProceedToNextStep()}
            isLoading={isLoading}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default EnhancedCheckout;
