import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDualAuth } from '@/hooks/useDualAuth';
import AuthModal from '@/components/ui/auth-modal';

interface RatingProps {
  productId: string;
  initialRating?: number;
  onRatingSubmit?: (rating: number, review?: string) => void;
}

const Rating = ({ productId, initialRating = 0, onRatingSubmit }: RatingProps) => {
  const [rating, setRating] = useState(initialRating);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { isAuthenticated } = useDualAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

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
      // In a real implementation, you would send this to your backend
      // For now, we'll just simulate the API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      onRatingSubmit?.(rating, review);
      
      toast({
        title: 'تم إرسال التقييم',
        description: 'شكرًا لتقييمك للمنتج',
        variant: 'default'
      });
      
      // Reset form
      setRating(0);
      setReview('');
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
    <div className="space-y-4 relative z-40">
      <div className="flex flex-col gap-2">
        <span className="text-lg font-semibold text-slate-900">تقييمك للمنتج</span>
        <div className="flex gap-1 relative z-50">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none relative z-50"
              aria-label={`تقييم ${star} نجوم`}
            >
              <Star
                className={cn(
                  "w-8 h-8 transition-all duration-200 relative z-50",
                  (hoverRating || rating) >= star
                    ? "text-amber-500 fill-amber-500 scale-110"
                    : "text-slate-300"
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="review" className="text-base font-medium text-slate-900">
          ملاحظاتك (اختياري)
        </label>
        <Textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder="شارك تجربتك مع هذا المنتج..."
          className="min-h-[100px] text-base"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-3 rounded-lg font-bold text-base"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
            جاري الإرسال...
          </div>
        ) : (
          'إرسال التقييم'
        )}
      </Button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="general"
        title="تسجيل الدخول مطلوب"
        description="يجب تسجيل الدخول لتقييم المنتجات"
      />
    </div>
  );
};

export default Rating;