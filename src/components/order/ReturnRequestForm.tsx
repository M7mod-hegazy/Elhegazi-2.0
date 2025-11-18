import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Order, CartItem } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { apiPatchJson } from '@/lib/api';
import { 
  Package, 
  AlertCircle, 
  FileText, 
  CreditCard, 
  Truck,
  CheckCircle
} from 'lucide-react';

interface ReturnRequestFormProps {
  order: Order;
  onReturnRequested: () => void;
}

const ReturnRequestForm: React.FC<ReturnRequestFormProps> = ({ order, onReturnRequested }) => {
  const { toast } = useToast();
  const { hidePrices } = usePricingSettings();
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>({});
  const [returnReason, setReturnReason] = useState('');
  const [returnReasonDetails, setReturnReasonDetails] = useState('');
  const [refundMethod, setRefundMethod] = useState<'original' | 'store_credit'>('original');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState(1); // 1: Select items, 2: Reason, 3: Review, 4: Confirmation

  const returnReasons = [
    { value: 'defective', label: 'المنتج تالف' },
    { value: 'not_as_described', label: 'المنتج غير مطابق للوصف' },
    { value: 'wrong_item', label: 'المنتج خاطئ' },
    { value: 'changed_mind', label: 'غيرت رأيي' },
    { value: 'other', label: 'أخرى' }
  ];

  const toggleItemSelection = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const areItemsSelected = Object.values(selectedItems).some(selected => selected);

  const handleSubmit = async () => {
    if (!areItemsSelected) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار منتج واحد على الأقل للإرجاع',
        variant: 'destructive'
      });
      return;
    }

    if (!returnReason) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار سبب الإرجاع',
        variant: 'destructive'
      });
      return;
    }

    if (returnReason === 'other' && !returnReasonDetails.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى توضيح سبب الإرجاع',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      // In a real implementation, this would create a return request
      // For now, we'll just update the order with return request info
      const reason = returnReason === 'other' ? returnReasonDetails : returnReason;
      
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}/request-return`, {
        returnReason: reason
      });
      
      if (res.ok && res.item) {
        toast({
          title: 'نجاح',
          description: 'تم إرسال طلب الإرجاع بنجاح وسينتظر موافقة الإدارة',
        });
        onReturnRequested();
      } else {
        throw new Error((res as { error?: string }).error || 'فشل في إرسال طلب الإرجاع');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إرسال طلب الإرجاع',
        variant: 'destructive'
      });
      console.error('Error requesting return:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedItemsCount = Object.values(selectedItems).filter(Boolean).length;
  const selectedItemsTotal = order.items
    .filter(item => selectedItems[item.id])
    .reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8">
        {[1, 2, 3, 4].map((stepNum) => (
          <div key={stepNum} className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              step >= stepNum 
                ? 'bg-primary text-white' 
                : 'bg-gray-200 text-gray-500'
            }`}>
              {step > stepNum ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                stepNum
              )}
            </div>
            <div className="mt-2 text-xs text-center">
              {stepNum === 1 && 'اختيار المنتجات'}
              {stepNum === 2 && 'سبب الإرجاع'}
              {stepNum === 3 && 'مراجعة'}
              {stepNum === 4 && 'تأكيد'}
            </div>
          </div>
        ))}
        <div className="flex-1 h-1 bg-gray-200 -mx-4">
          <div 
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${(step - 1) * 33.33}%` }}
          ></div>
        </div>
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              اختيار المنتجات للإرجاع
            </CardTitle>
            <CardDescription>
              يرجى اختيار المنتجات التي ترغب في إرجاعها
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {order.items.map((item) => (
              <div 
                key={item.id} 
                className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                  selectedItems[item.id] 
                    ? 'border-primary bg-primary/5' 
                    : 'border-gray-200 hover:bg-gray-50'
                }`}
                onClick={() => toggleItemSelection(item.id)}
              >
                <Checkbox 
                  checked={!!selectedItems[item.id]} 
                  onCheckedChange={() => toggleItemSelection(item.id)}
                />
                <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                  {item.product.image ? (
                    <img 
                      src={item.product.image} 
                      alt={item.product.nameAr} 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <Package className="w-6 h-6 text-gray-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className="font-medium text-gray-900">{item.product.nameAr}</h3>
                  <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-900">{item.price.toLocaleString()} ر.س</p>
                  <p className="text-sm text-gray-500">الإجمالي: {(item.price * item.quantity).toLocaleString()} ر.س</p>
                </div>
              </div>
            ))}
            
            <div className="flex justify-between pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  // Select all items
                  const newSelectedItems: Record<string, boolean> = {};
                  order.items.forEach(item => {
                    newSelectedItems[item.id] = true;
                  });
                  setSelectedItems(newSelectedItems);
                }}
              >
                اختيار الكل
              </Button>
              <Button 
                onClick={() => setStep(2)}
                disabled={!areItemsSelected}
              >
                التالي
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              سبب الإرجاع
            </CardTitle>
            <CardDescription>
              يرجى توضيح سبب الإرجاع للمنتجات المختارة
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>سبب الإرجاع</Label>
              <Select value={returnReason} onValueChange={setReturnReason}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر سبب الإرجاع" />
                </SelectTrigger>
                <SelectContent>
                  {returnReasons.map((reason) => (
                    <SelectItem key={reason.value} value={reason.value}>
                      {reason.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {returnReason === 'other' && (
              <div className="space-y-2">
                <Label>تفاصيل السبب</Label>
                <Textarea
                  placeholder="يرجى توضيح سبب الإرجاع..."
                  value={returnReasonDetails}
                  onChange={(e) => setReturnReasonDetails(e.target.value)}
                  rows={4}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>طريقة الاسترداد</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    refundMethod === 'original' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setRefundMethod('original')}
                >
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    <span className="font-medium">الاسترداد للبطاقة الأصلية</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    سيتم استرداد المبلغ إلى طريقة الدفع الأصلية خلال 5-7 أيام عمل
                  </p>
                </div>
                <div 
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    refundMethod === 'store_credit' 
                      ? 'border-primary bg-primary/5' 
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => setRefundMethod('store_credit')}
                >
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="font-medium">رصيد في المتجر</span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    سيتم إضافة المبلغ كرصيد في حسابك للاستخدام لاحقاً
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)}>
                السابق
              </Button>
              <Button 
                onClick={() => setStep(3)}
                disabled={!returnReason || (returnReason === 'other' && !returnReasonDetails.trim())}
              >
                التالي
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              مراجعة طلب الإرجاع
            </CardTitle>
            <CardDescription>
              يرجى مراجعة تفاصيل طلب الإرجاع قبل الإرسال
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium text-gray-900 mb-3">المنتجات المختارة</h3>
              <div className="space-y-3">
                {order.items
                  .filter(item => selectedItems[item.id])
                  .map((item) => (
                    <div key={item.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-lg">
                      <div className="w-12 h-12 bg-white rounded-lg border border-gray-200 flex items-center justify-center">
                        {item.product.image ? (
                          <img 
                            src={item.product.image} 
                            alt={item.product.nameAr} 
                            className="w-full h-full object-cover rounded-lg"
                          />
                        ) : (
                          <Package className="w-5 h-5 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{item.product.nameAr}</h4>
                        <p className="text-sm text-gray-500">الكمية: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">{item.price.toLocaleString()} ر.س</p>
                        <p className="text-sm text-gray-500">الإجمالي: {(item.price * item.quantity).toLocaleString()} ر.س</p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            <div>
              <h3 className="font-medium text-gray-900 mb-3">تفاصيل الإرجاع</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">سبب الإرجاع</p>
                  <p className="font-medium">
                    {returnReason === 'other' ? returnReasonDetails : returnReasons.find(r => r.value === returnReason)?.label}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">طريقة الاسترداد</p>
                  <p className="font-medium">
                    {refundMethod === 'original' ? 'الاسترداد للبطاقة الأصلية' : 'رصيد في المتجر'}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-primary">إجمالي المبلغ المسترد</p>
                  <p className="text-2xl font-bold text-primary">{selectedItemsTotal.toLocaleString()} ر.س</p>
                </div>
                <Truck className="w-8 h-8 text-primary" />
              </div>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)}>
                السابق
              </Button>
              <Button onClick={() => setStep(4)}>
                تأكيد الطلب
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              تأكيد طلب الإرجاع
            </CardTitle>
            <CardDescription>
              تم إرسال طلب الإرجاع بنجاح
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-green-500" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">تم إرسال طلب الإرجاع!</h3>
              <p className="text-gray-600 mb-6">
                تم إرسال طلب الإرجاع بنجاح وسينتظر موافقة الإدارة. سيتم إعلامك بحالة الطلب عبر البريد الإلكتروني.
              </p>
              
              <div className="bg-primary/5 rounded-lg p-4 mb-6">
                <p className="font-medium text-primary">رقم الطلب: #{order.orderNumber || order.id}</p>
                <p className="text-sm text-primary">تاريخ الطلب: {new Date().toLocaleDateString('ar-EG')}</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">عدد المنتجات</p>
                  <p className="font-medium">{selectedItemsCount}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600">المبلغ المسترد</p>
                  <p className="font-medium">{selectedItemsTotal.toLocaleString()} ر.س</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                className="flex-1" 
                onClick={handleSubmit}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'جاري الإرسال...' : 'إرسال الطلب'}
              </Button>
              <Button 
                variant="outline" 
                className="flex-1" 
                onClick={() => setStep(3)}
              >
                تعديل الطلب
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ReturnRequestForm;