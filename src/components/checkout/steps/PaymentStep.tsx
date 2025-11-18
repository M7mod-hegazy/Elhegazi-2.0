import React from 'react';
import { motion } from 'framer-motion';
import { CreditCard, Wallet, Shield, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PaymentStepProps {
  paymentMethod: string;
  onPaymentMethodChange: (method: string) => void;
  cardInfo?: {
    number: string;
    name: string;
    expiry: string;
    cvv: string;
  };
  onCardInfoChange?: (field: string, value: string) => void;
  errors?: Record<string, string>;
}

const PaymentStep: React.FC<PaymentStepProps> = ({
  paymentMethod,
  onPaymentMethodChange,
  cardInfo,
  onCardInfoChange,
  errors = {}
}) => {
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

  // Format credit card number
  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches && matches[0] || '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  // Format expiry date
  const formatExpiry = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length >= 3) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-primary" />
              طريقة الدفع
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Cash on Delivery */}
              <div 
                className={`flex items-center space-x-3 space-x-reverse p-4 border rounded-xl transition-all cursor-pointer ${
                  paymentMethod === 'cod' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => onPaymentMethodChange('cod')}
              >
                <Checkbox 
                  id="cod" 
                  checked={paymentMethod === 'cod'} 
                  onCheckedChange={() => onPaymentMethodChange('cod')} 
                />
                <Label htmlFor="cod" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Wallet className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">الدفع عند الاستلام</span>
                      </div>
                      <span className="text-sm text-slate-600 block mt-1">
                        يمكنك الدفع نقداً عند استلام الطلب
                      </span>
                    </div>
                    <Shield className="w-5 h-5 text-slate-500" />
                  </div>
                </Label>
              </div>
              
              {/* Credit Card */}
              <div 
                className={`flex items-center space-x-3 space-x-reverse p-4 border rounded-xl transition-all cursor-pointer ${
                  paymentMethod === 'credit' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => onPaymentMethodChange('credit')}
              >
                <Checkbox 
                  id="credit" 
                  checked={paymentMethod === 'credit'} 
                  onCheckedChange={() => onPaymentMethodChange('credit')} 
                />
                <Label htmlFor="credit" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">الدفع بالبطاقة</span>
                      </div>
                      <span className="text-sm text-slate-600 block mt-1">
                        الدفع الآمن عبر البطاقات الائتمانية
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <div className="w-8 h-5 bg-primary rounded-sm"></div>
                      <div className="w-8 h-5 bg-red-600 rounded-sm"></div>
                    </div>
                  </div>
                </Label>
              </div>
              
              {/* PayPal */}
              <div 
                className={`flex items-center space-x-3 space-x-reverse p-4 border rounded-xl transition-all cursor-pointer ${
                  paymentMethod === 'paypal' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => onPaymentMethodChange('paypal')}
              >
                <Checkbox 
                  id="paypal" 
                  checked={paymentMethod === 'paypal'} 
                  onCheckedChange={() => onPaymentMethodChange('paypal')} 
                />
                <Label htmlFor="paypal" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 bg-primary rounded-sm flex items-center justify-center">
                          <span className="text-white text-xs font-bold">P</span>
                        </div>
                        <span className="font-medium">باي بال</span>
                      </div>
                      <span className="text-sm text-slate-600 block mt-1">
                        الدفع عبر حساب باي بال
                      </span>
                    </div>
                    <div className="w-8 h-5 bg-primary rounded-sm flex items-center justify-center">
                      <span className="text-white text-xs font-bold">P</span>
                    </div>
                  </div>
                </Label>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      {/* Credit Card Form (if credit card selected) */}
      {paymentMethod === 'credit' && (
        <motion.div variants={itemVariants}>
          <Card className="border border-gray-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-primary" />
                معلومات البطاقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Alert className="border-primary/20 bg-primary/5">
                  <AlertCircle className="h-4 w-4 text-primary" />
                  <AlertDescription className="text-primary">
                    جميع المعاملات مشفرة بأمان. لن يتم حفظ معلومات بطاقتك.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="cardNumber" className="text-sm font-medium">
                      رقم البطاقة *
                    </Label>
                    <Input
                      id="cardNumber"
                      placeholder="1234 5678 9012 3456"
                      value={cardInfo?.number ? formatCardNumber(cardInfo.number) : ''}
                      onChange={(e) => onCardInfoChange?.('number', e.target.value.replace(/\s/g, ''))}
                      className={`font-mono ${
                        errors.number ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                      }`}
                    />
                    {errors.number && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.number}
                      </p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="cardName" className="text-sm font-medium">
                      الاسم على البطاقة *
                    </Label>
                    <Input
                      id="cardName"
                      placeholder="كما يظهر على البطاقة"
                      value={cardInfo?.name || ''}
                      onChange={(e) => onCardInfoChange?.('name', e.target.value)}
                      className={
                        errors.name ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                      }
                    />
                    {errors.name && (
                      <p className="text-sm text-red-600 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.name}
                      </p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardExpiry" className="text-sm font-medium">
                        تاريخ الانتهاء *
                      </Label>
                      <Input
                        id="cardExpiry"
                        placeholder="MM/YY"
                        value={cardInfo?.expiry ? formatExpiry(cardInfo.expiry) : ''}
                        onChange={(e) => onCardInfoChange?.('expiry', e.target.value)}
                        className={`font-mono ${
                          errors.expiry ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                        }`}
                      />
                      {errors.expiry && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.expiry}
                        </p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="cardCvv" className="text-sm font-medium">
                        CVV *
                      </Label>
                      <Input
                        id="cardCvv"
                        placeholder="123"
                        value={cardInfo?.cvv || ''}
                        onChange={(e) => onCardInfoChange?.('cvv', e.target.value)}
                        className={`font-mono ${
                          errors.cvv ? 'border-red-500 focus:border-red-500' : 'focus:border-primary'
                        }`}
                      />
                      {errors.cvv && (
                        <p className="text-sm text-red-600 flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" />
                          {errors.cvv}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
      
      {/* Security Notice */}
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200 bg-gradient-to-r from-slate-50 to-blue-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Shield className="w-5 h-5 text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-900">مدفوعات آمنة</p>
                <p className="text-xs text-slate-600 mt-1">
                  نستخدم تقنيات تشفير متقدمة لحماية معلوماتك المالية. جميع المعاملات آمنة ومحمية.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default PaymentStep;