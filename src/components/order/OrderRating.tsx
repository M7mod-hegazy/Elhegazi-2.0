import React, { useState } from 'react';
import { Star, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface OrderRatingProps {
  orderId: string;
  onRatingSubmit: (rating: number, review: string) => Promise<void>;
}

const OrderRating: React.FC<OrderRatingProps> = ({ orderId, onRatingSubmit }) => {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار تقييم',
        variant: 'destructive'
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onRatingSubmit(rating, review);
      toast({
        title: 'تم إرسال التقييم',
        description: 'شكرًا لتقييمك للطلب',
      });
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'حدث خطأ أثناء إرسال التقييم',
        variant: 'destructive'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-slate-900">تقييم طلبك</h3>
        <p className="text-slate-600">شارك تجربتك مع هذا الطلب لتُساعدنا في تحسين الخدمة</p>
        
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-slate-700">تقييمك للطلب</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                className="focus:outline-none"
              >
                <Star
                  className={cn(
                    "w-8 h-8 transition-all duration-200",
                    (hoverRating || rating) >= star
                      ? "text-amber-500 fill-amber-500 scale-110"
                      : "text-slate-300"
                  )}
                />
              </button>
            ))}
          </div>
          <div className="text-slate-600 text-sm">
            {rating === 1 && 'سيء جدًا'}
            {rating === 2 && 'سيء'}
            {rating === 3 && 'مقبول'}
            {rating === 4 && 'جيد'}
            {rating === 5 && 'ممتاز'}
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="review" className="text-sm font-medium text-slate-700">
            ملاحظاتك (اختياري)
          </label>
          <Textarea
            id="review"
            value={review}
            onChange={(e) => setReview(e.target.value)}
            placeholder="شارك تجربتك مع هذا الطلب... ما الذي أعجبك؟ وما الذي يمكن تحسينه؟"
            className="min-h-[100px] text-sm p-3"
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full py-3 rounded-lg font-bold flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
              جاري الإرسال...
            </>
          ) : (
            <>
              <Send className="w-4 h-4 ml-2" />
              إرسال التقييم
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default OrderRating;
