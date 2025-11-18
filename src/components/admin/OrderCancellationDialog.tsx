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
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { apiPatchJson } from '@/lib/api';
import { Order } from '@/types';

interface OrderCancellationDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedOrder: Order) => void;
}

const OrderCancellationDialog: React.FC<OrderCancellationDialogProps> = ({ order, open, onOpenChange, onSave }) => {
  const [cancellationReason, setCancellationReason] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleCancellation = async () => {
    if (!order) return;

    if (!cancellationReason.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال سبب الإلغاء',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // First, request cancellation with reason
      const requestRes = await apiPatchJson<Order, { 
        cancellationRequested: boolean; 
        cancellationReason: string; 
        cancellationRequestedAt: string 
      }>(
        `/api/orders/${order.id}/request-cancellation`,
        { 
          cancellationRequested: true, 
          cancellationReason,
          cancellationRequestedAt: new Date().toISOString()
        }
      );
      
      if (!requestRes.ok) {
        throw new Error((requestRes as { error?: string }).error || 'فشل في طلب الإلغاء');
      }

      // Then, approve the cancellation
      const approveRes = await apiPatchJson<Order, { status: string; cancellationRequested: boolean }>(
        `/api/orders/${order.id}/cancel`,
        { 
          status: 'cancelled',
          cancellationRequested: false
        }
      );
      
      if (approveRes.ok && approveRes.item) {
        onSave(approveRes.item);
        onOpenChange(false);
        setCancellationReason('');
        toast({
          title: 'نجاح',
          description: 'تم إلغاء الطلب بنجاح',
        });
      } else {
        throw new Error((approveRes as { error?: string }).error || 'فشل في إلغاء الطلب');
      }
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إلغاء الطلب',
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
          <DialogTitle>إلغاء الطلب</DialogTitle>
          <DialogDescription>
            إلغاء الطلب #{order.orderNumber || order.id}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="cancellationReason">سبب الإلغاء</Label>
            <Textarea
              id="cancellationReason"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              placeholder="يرجى تحديد سبب إلغاء الطلب"
              className="min-h-[120px]"
            />
          </div>
          
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>ملاحظة:</strong> سيتم إلغاء الطلب وإرسال إشعار بالبريد الإلكتروني إلى العميل.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button 
            onClick={handleCancellation} 
            disabled={loading}
            variant="destructive"
          >
            {loading ? 'جاري الإلغاء...' : 'تأكيد الإلغاء'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderCancellationDialog;