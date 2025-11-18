import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiPatchJson } from '@/lib/api';
import { Order, OrderStatus, PaymentStatus } from '@/types';

interface OrderEditDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedOrder: Order) => void;
}

const OrderEditDialog: React.FC<OrderEditDialogProps> = ({ order, open, onOpenChange, onSave }) => {
  const [formData, setFormData] = useState<Partial<Order>>({});
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (order) {
      setFormData({
        status: order.status,
        paymentStatus: order.paymentStatus,
        trackingNumber: order.trackingNumber || '',
        carrier: order.carrier || '',
        estimatedDelivery: order.estimatedDelivery || '',
        notes: order.notes || '',
        priority: order.priority || 'normal',
        assignedTo: order.assignedTo || '',
      });
    }
  }, [order]);

  const handleChange = <T extends keyof Order>(field: T, value: Order[T]) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    if (!order) return;

    setLoading(true);
    try {
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}`, formData);
      
      if (res.ok && res.item) {
        onSave(res.item);
        onOpenChange(false);
        toast({
          title: 'نجاح',
          description: 'تم تحديث تفاصيل الطلب بنجاح',
        });
      } else {
        throw new Error('فشل في تحديث الطلب');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء تحديث الطلب',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعديل تفاصيل الطلب</DialogTitle>
          <DialogDescription>
            تعديل تفاصيل الطلب #{order.orderNumber || order.id}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">حالة الطلب</Label>
              <Select 
                value={formData.status || order.status} 
                onValueChange={(value) => handleChange('status', value as OrderStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد التجهيز</SelectItem>
                  <SelectItem value="confirmed">تم التأكيد</SelectItem>
                  <SelectItem value="processing">قيد التنفيذ</SelectItem>
                  <SelectItem value="shipped">تم الشحن</SelectItem>
                  <SelectItem value="out_for_delivery">خارج للتوصيل</SelectItem>
                  <SelectItem value="delivered">تم التسليم</SelectItem>
                  <SelectItem value="cancelled">ملغي</SelectItem>
                  <SelectItem value="refunded">تم الاسترجاع</SelectItem>
                  <SelectItem value="returned">تم الإرجاع</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentStatus">حالة الدفع</Label>
              <Select 
                value={formData.paymentStatus || order.paymentStatus} 
                onValueChange={(value) => handleChange('paymentStatus', value as PaymentStatus)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">قيد الانتظار</SelectItem>
                  <SelectItem value="paid">مدفوع</SelectItem>
                  <SelectItem value="failed">فشل</SelectItem>
                  <SelectItem value="refunded">مسترد</SelectItem>
                  <SelectItem value="partially_refunded">مسترد جزئياً</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">الأولوية</Label>
              <Select 
                value={formData.priority || order.priority || 'normal'} 
                onValueChange={(value) => handleChange('priority', value as 'low' | 'normal' | 'high' | 'urgent')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">مرتفعة</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="carrier">شركة الشحن</Label>
              <Input
                id="carrier"
                value={formData.carrier || order.carrier || ''}
                onChange={(e) => handleChange('carrier', e.target.value)}
                placeholder="مثال: Aramex"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="trackingNumber">رقم التتبع</Label>
              <Input
                id="trackingNumber"
                value={formData.trackingNumber || order.trackingNumber || ''}
                onChange={(e) => handleChange('trackingNumber', e.target.value)}
                placeholder="رقم التتبع"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estimatedDelivery">التوصيل المتوقع</Label>
              <Input
                id="estimatedDelivery"
                type="date"
                value={formData.estimatedDelivery ? formData.estimatedDelivery.split('T')[0] : ''}
                onChange={(e) => handleChange('estimatedDelivery', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">ملاحظات</Label>
            <Textarea
              id="notes"
              value={formData.notes || order.notes || ''}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="ملاحظات إضافية حول الطلب"
              className="min-h-[120px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleSave} disabled={loading}>
            {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderEditDialog;