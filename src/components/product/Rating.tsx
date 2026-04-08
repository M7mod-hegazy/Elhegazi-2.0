import { useState } from 'react';
import { Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDualAuth } from '@/hooks/useDualAuth';
import AuthModal from '@/components/ui/auth-modal';
import { apiPostJson } from '@/lib/api';

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
  const { isAuthenticated, isAdminAuthenticated } = useDualAuth();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!isAuthenticated && !isAdminAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (rating === 0) {
      toast({
        title: '\u062e\u0637\u0623',
        description: '\u064a\u0631\u062c\u0649 \u0627\u062e\u062a\u064a\u0627\u0631 \u062a\u0642\u064a\u064a\u0645',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await apiPostJson(`/api/products/${productId}/ratings`, {
        rating,
        review: review?.trim() || '',
      });

      onRatingSubmit?.(rating, review);

      toast({
        title: '\u062a\u0645 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645',
        description: '\u0634\u0643\u0631\u064b\u0627 \u0644\u062a\u0642\u064a\u064a\u0645\u0643 \u0644\u0644\u0645\u0646\u062a\u062c',
      });

      setRating(0);
      setReview('');
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (!isAuthenticated || /auth|unauthorized|authentication/i.test(message)) {
        setShowAuthModal(true);
      }
      if (/already rated this product/i.test(message)) {
        toast({
          title: 'تم التقييم مسبقًا',
          description: 'لا يمكنك تقييم هذا المنتج أكثر من مرة',
          variant: 'destructive',
        });
        return;
      }
      toast({
        title: '\u062e\u0637\u0623',
        description: message || '\u062d\u062f\u062b \u062e\u0637\u0623 \u0623\u062b\u0646\u0627\u0621 \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4 relative z-40">
      <div className="flex flex-col gap-2">
        <span className="text-lg font-semibold text-slate-900">
          {'\u062a\u0642\u064a\u064a\u0645\u0643 \u0644\u0644\u0645\u0646\u062a\u062c'}
        </span>
        <div className="flex gap-1 relative z-50">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => {
                if (!isAuthenticated && !isAdminAuthenticated) {
                  setShowAuthModal(true);
                  return;
                }
                setRating(star);
              }}
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              className="focus:outline-none relative z-50"
              aria-label={`\u062a\u0642\u064a\u064a\u0645 ${star} \u0646\u062c\u0648\u0645`}
            >
              <Star
                className={cn(
                  'w-8 h-8 transition-all duration-200 relative z-50',
                  (hoverRating || rating) >= star
                    ? 'text-amber-500 fill-amber-500 scale-110'
                    : 'text-slate-300'
                )}
              />
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="review" className="text-base font-medium text-slate-900">
          {'\u0645\u0644\u0627\u062d\u0638\u0627\u062a\u0643 (\u0627\u062e\u062a\u064a\u0627\u0631\u064a)'}
        </label>
        <Textarea
          id="review"
          value={review}
          onChange={(e) => setReview(e.target.value)}
          placeholder={'\u0634\u0627\u0631\u0643 \u062a\u062c\u0631\u0628\u062a\u0643 \u0645\u0639 \u0647\u0630\u0627 \u0627\u0644\u0645\u0646\u062a\u062c...'}
          className="min-h-[100px] text-base"
          disabled={!isAuthenticated && !isAdminAuthenticated}
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={isSubmitting}
        className="w-full py-3 rounded-lg font-bold text-base"
      >
        {isSubmitting ? (
          <div className="flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
            {'\u062c\u0627\u0631\u064a \u0627\u0644\u0625\u0631\u0633\u0627\u0644...'}
          </div>
        ) : (
          '\u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u062a\u0642\u064a\u064a\u0645'
        )}
      </Button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="general"
        title={'\u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0645\u0637\u0644\u0648\u0628'}
        description={'\u064a\u062c\u0628 \u062a\u0633\u062c\u064a\u0644 \u0627\u0644\u062f\u062e\u0648\u0644 \u0644\u062a\u0642\u064a\u064a\u0645 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a'}
      />
    </div>
  );
};

export default Rating;
