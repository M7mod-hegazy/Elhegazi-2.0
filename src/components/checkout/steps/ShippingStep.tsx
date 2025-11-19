import React from 'react';
import { motion } from 'framer-motion';
import { Truck, Clock, MapPin, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface ShippingStepProps {
  shippingMethod: string;
  onShippingMethodChange: (method: string) => void;
  shippingCost: number;
  expressShippingCost: number;
  freeShippingThreshold?: number;
  total: number;
  deliveryNotes?: string;
  onDeliveryNotesChange?: (notes: string) => void;
}

const ShippingStep: React.FC<ShippingStepProps> = ({
  shippingMethod,
  onShippingMethodChange,
  shippingCost,
  expressShippingCost,
  freeShippingThreshold,
  total,
  deliveryNotes,
  onDeliveryNotesChange
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

  // Calculate estimated delivery dates
  const getEstimatedDelivery = (method: string) => {
    const today = new Date();
    let days = 3; // Default for standard shipping
    
    if (method === 'express') {
      days = 1;
    } else if (method === 'free') {
      days = 5;
    }
    
    const deliveryDate = new Date(today);
    deliveryDate.setDate(today.getDate() + days);
    
    return deliveryDate.toLocaleDateString('ar-EG', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Get delivery time range
  const getDeliveryTimeRange = (method: string) => {
    switch (method) {
      case 'express':
        return '1-2 أيام عمل';
      case 'free':
        return '5-7 أيام عمل';
      default:
        return '3-5 أيام عمل';
    }
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
              <Truck className="w-5 h-5 text-blue-600" />
              طريقة الشحن
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* Standard Shipping */}
              <div 
                className={`flex items-center space-x-3 space-x-reverse p-4 border rounded-xl transition-all cursor-pointer ${
                  shippingMethod === 'standard' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => onShippingMethodChange('standard')}
              >
                <Checkbox 
                  id="standard" 
                  checked={shippingMethod === 'standard'} 
                  onCheckedChange={() => onShippingMethodChange('standard')} 
                />
                <Label htmlFor="standard" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">الشحن القياسي</span>
                      </div>
                      <span className="text-sm text-slate-600 block mt-1">
                        3-5 أيام عمل - التوصيل إلى باب المنزل
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          التسليم المتوقع: {getEstimatedDelivery('standard')}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900">{shippingCost} ر.س</span>
                  </div>
                </Label>
              </div>
              
              {/* Express Shipping */}
              <div 
                className={`flex items-center space-x-3 space-x-reverse p-4 border rounded-xl transition-all cursor-pointer ${
                  shippingMethod === 'express' 
                    ? 'border-primary bg-primary/5' 
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
                onClick={() => onShippingMethodChange('express')}
              >
                <Checkbox 
                  id="express" 
                  checked={shippingMethod === 'express'} 
                  onCheckedChange={() => onShippingMethodChange('express')} 
                />
                <Label htmlFor="express" className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-500" />
                        <span className="font-medium">الشحن السريع</span>
                      </div>
                      <span className="text-sm text-slate-600 block mt-1">
                        1-2 أيام عمل - توصيل أسرع مع تتبع مباشر
                      </span>
                      <div className="flex items-center gap-2 mt-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">
                          التسليم المتوقع: {getEstimatedDelivery('express')}
                        </span>
                      </div>
                    </div>
                    <span className="font-bold text-slate-900">{expressShippingCost} ر.س</span>
                  </div>
                </Label>
              </div>
              
              {/* Free Shipping (if eligible) */}
              {freeShippingThreshold && total >= freeShippingThreshold && (
                <div 
                  className={`flex items-center space-x-3 space-x-reverse p-4 border-2 rounded-xl transition-all cursor-pointer ${
                    shippingMethod === 'free' 
                      ? 'border-green-500 bg-green-50' 
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                  onClick={() => onShippingMethodChange('free')}
                >
                  <Checkbox 
                    id="free" 
                    checked={shippingMethod === 'free'} 
                    onCheckedChange={() => onShippingMethodChange('free')} 
                  />
                  <Label htmlFor="free" className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center">
                            <span className="text-white text-xs font-bold">★</span>
                          </div>
                          <span className="font-medium">الشحن المجاني</span>
                        </div>
                        <span className="text-sm text-slate-600 block mt-1">
                          للطلبات فوق {freeShippingThreshold} ر.س - توصيل قياسي
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span className="text-xs text-slate-500">
                            التسليم المتوقع: {getEstimatedDelivery('free')}
                          </span>
                        </div>
                      </div>
                      <span className="font-bold text-green-600">مجاني</span>
                    </div>
                  </Label>
                </div>
              )}
              
              {/* Free Shipping Not Eligible */}
              {freeShippingThreshold && total < freeShippingThreshold && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-800"> qualify للشحن المجاني</p>
                      <p className="text-xs text-amber-700 mt-1">
                        أضف {freeShippingThreshold - total} ر.س للحصول على الشحن المجاني
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>
      
      {/* Delivery Notes */}
      <motion.div variants={itemVariants}>
        <Card className="border border-gray-200">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-blue-600" />
              ملاحظات التوصيل
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="deliveryNotes" className="text-sm font-medium">
                تعليمات إضافية للسائق
              </Label>
              <Textarea
                id="deliveryNotes"
                placeholder="مثال: رقم الشقة، اسم المبنى، إلخ..."
                value={deliveryNotes || ''}
                onChange={(e) => onDeliveryNotesChange?.(e.target.value)}
                className="min-h-[100px]"
              />
              <p className="text-xs text-slate-500">
                يمكنك إضافة أي تعليمات خاصة لمساعدتنا في توصيل طلبك بشكل أفضل
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default ShippingStep;
