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
import { apiPostJson } from '@/lib/api';
import { Order } from '@/types';

interface CustomerCommunicationDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: () => void;
}
const CustomerCommunicationDialog: React.FC<CustomerCommunicationDialogProps> = ({ order, open, onOpenChange, onSend }) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleSend = async () => {
    if (!order) return;

    if (!message.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال رسالة',
        variant: 'destructive'
      });
      return;
    }

    setLoading(true);
    try {
      // Add note to the order
      const res = await apiPostJson<Order, { text: string }>(
        `/api/orders/${order.id || order._id}/notes`,
        { text: `📧 رسالة للعميل: ${message}` }
      );
      
      if (res.ok && res.item) {
        onSend();
        onOpenChange(false);
        setMessage('');
        toast({
          title: '✅ تم إرسال الرسالة',
          description: 'تم إضافة الرسالة إلى ملاحظات الطلب بنجاح',
        });
      } else {
        throw new Error((res as { error?: string }).error || 'فشل في إرسال الرسالة');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: '❌ خطأ',
        description: error instanceof Error ? error.message : 'حدث خطأ أثناء إرسال الرسالة',
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
          <DialogTitle>التواصل مع العميل</DialogTitle>
          <DialogDescription>
            إرسال رسالة إلى العميل بشأن الطلب #{order.orderNumber || order.id}
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="message">الرسالة</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="أدخل رسالتك للعميل هنا..."
              className="min-h-[150px]"
            />
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              <strong>ملاحظة:</strong> هذه الرسالة سيتم إضافتها إلى ملاحظات الطلب وسيتم إرسال نسخة إلى العميل عبر البريد الإلكتروني.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button 
            onClick={handleSend} 
            disabled={loading}
          >
            {loading ? 'جاري الإرسال...' : 'إرسال الرسالة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CustomerCommunicationDialog;
