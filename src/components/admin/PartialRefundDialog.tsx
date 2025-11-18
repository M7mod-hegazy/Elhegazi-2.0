import React, { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiPatchJson } from '@/lib/api';
import { Order } from '@/types';

interface PartialRefundApiResponse {
  ok: boolean;
  item?: Order;
  message?: string;
  error?: string;
}

interface PartialRefundDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedOrder: Order) => void;
}

const PartialRefundDialog: React.FC<PartialRefundDialogProps> = ({ order, open, onOpenChange, onSave }) => {
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleRefund = async () => {
    if (!order) return;

    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال مبلغ استرداد صحيح',
        variant: 'destructive'
      });
      return;
    }

    if (amount > order.total) {
      toast({
        title: 'خطأ',
        description: 'مبلغ الاسترداد لا يمكن أن يتجاوز إجمالي الطلب',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      const res = await apiPatchJson<PartialRefundApiResponse, { refundAmount: number; refundReason: string }>(
        `/api/orders/${order.id}/partial-refund`,
        { refundAmount: amount, refundReason }
      );
      
      if (res.ok && res.item) {
        onSave(res.item);
        onOpenChange(false);
        setRefundAmount('');
        setRefundReason('');
        toast({
          title: 'نجاح',
          description: res.message || 'تم معالجة الاسترداد الجزئي بنجاح',
        });
      } else {
        throw new Error(res.error || 'فشل في معالجة الاسترداد الجزئي');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء معالجة الاسترداد الجزئي',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>استرداد جزئي</DialogTitle>
          <DialogDescription>
            معالجة استرداد جزئي للطلب #{order.orderNumber || order.id}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="refundAmount">مبلغ الاسترداد (ريال سعودي)</Label>
            <Input
              id="refundAmount"
              type="number"
              value={refundAmount}
              onChange={(e) => setRefundAmount(e.target.value)}
              placeholder="مثال: 100.00"
              min="0"
              max={order.total}
              step="0.01"
            />
            <p className="text-sm text-slate-500">
              إجمالي الطلب: {order.total.toFixed(2)} ريال سعودي
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="refundReason">سبب الاسترداد</Label>
            <Textarea
              id="refundReason"
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              placeholder="يرجى تحديد سبب الاسترداد الجزئي"
              className="min-h-[100px]"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleRefund} disabled={loading}>
            {loading ? 'جاري المعالجة...' : 'معالجة الاسترداد'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PartialRefundDialog;