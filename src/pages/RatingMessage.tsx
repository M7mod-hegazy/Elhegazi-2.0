import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Star, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useDualAuth } from '@/hooks/useDualAuth';
import AuthModal from '@/components/ui/auth-modal';
import { cn } from '@/lib/utils';

const RatingMessage = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
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
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setIsSubmitted(true);
      
      toast({
        title: 'تم إرسال التقييم',
        description: 'شكرًا لتقييمك للمنتج',
        variant: 'default'
      });
      
      // Redirect to product page after 2 seconds
      setTimeout(() => {
        navigate(`/product/${productId}`);
      }, 2000);
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

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-md mx-auto bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-4">تم إرسال التقييم</h1>
            <p className="text-slate-600 mb-6">
              شكرًا لتقييمك للمنتج. سيتم نشر تقييمك بعد المراجعة.
            </p>
            <Button 
              onClick={() => navigate(`/product/${productId}`)}
              className="w-full py-3 rounded-lg font-bold"
            >
              العودة للمنتج
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
      <div className="container mx-auto px-4">
        <div className="max-w-2xl mx-auto">
          <Button 
            variant="ghost" 
            onClick={() => navigate(-1)}
            className="mb-6 flex items-center gap-2 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
            العودة
          </Button>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 md:p-8">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900 mb-2">
              تقييم المنتج
            </h1>
            <p className="text-slate-600 mb-8">
              شارك تجربتك مع هذا المنتج لتُساعد الآخرين
            </p>
            
            <div className="space-y-8">
              <div className="flex flex-col gap-4">
                <span className="text-lg font-semibold text-slate-900">تقييمك للمنتج</span>
                <div className="flex gap-2">
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
                          "w-12 h-12 transition-all duration-200",
                          (hoverRating || rating) >= star
                            ? "text-amber-500 fill-amber-500 scale-110"
                            : "text-slate-300"
                        )}
                      />
                    </button>
                  ))}
                </div>
                <div className="text-slate-600">
                  {rating === 1 && 'سيء جدًا'}
                  {rating === 2 && 'سيء'}
                  {rating === 3 && 'مقبول'}
                  {rating === 4 && 'جيد'}
                  {rating === 5 && 'ممتاز'}
                </div>
              </div>

              <div className="space-y-4">
                <label htmlFor="review" className="text-lg font-semibold text-slate-900">
                  ملاحظاتك (اختياري)
                </label>
                <Textarea
                  id="review"
                  value={review}
                  onChange={(e) => setReview(e.target.value)}
                  placeholder="شارك تجربتك مع هذا المنتج... ما الذي أعجبك؟ وما الذي يمكن تحسينه؟"
                  className="min-h-[150px] text-base p-4"
                />
                <p className="text-sm text-slate-500">
                  لن يتم نشر معلوماتك الشخصية مع التقييم
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="flex-1 py-4 rounded-lg font-bold text-base"
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
                
                <Button
                  variant="outline"
                  onClick={() => navigate(-1)}
                  className="flex-1 py-4 rounded-lg font-bold text-base"
                >
                  إلغاء
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
      
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

export default RatingMessage;
