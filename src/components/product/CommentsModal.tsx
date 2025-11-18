import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Rating from '@/components/product/Rating';

type Comment = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  review?: string;
  date: string;
};

export type CommentsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  productId: string;
  productName: string;
  onRatingSubmit: (rating: number, review?: string) => void;
  averageRating: number;
  totalReviews: number;
  initialRating?: number;
};

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-EG', {
    month: 'long',
    day: 'numeric'
  });
};

const CommentsModal = ({ 
  isOpen, 
  onClose, 
  comments, 
  productId,
  productName,
  onRatingSubmit,
  averageRating,
  totalReviews,
  initialRating = 0
}: CommentsModalProps) => {
  const [showRatingForm, setShowRatingForm] = useState(initialRating > 0);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      // Store original overflow value
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      document.documentElement.style.overflow = 'hidden';
      
      // Cleanup function to restore scroll when component unmounts or modal closes
      return () => {
        document.body.style.overflow = originalOverflow || '';
        document.documentElement.style.overflow = '';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div 
      className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[99999] flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div 
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 relative z-[100000]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-white border-b border-slate-200 p-4 flex items-center justify-between rounded-t-2xl">
          <h2 className="text-xl font-bold text-slate-900">تقييمات المنتج</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="p-6">
          {/* Product Rating Summary */}
          <div className="flex items-center gap-8 mb-8 p-4 bg-slate-50 rounded-xl">
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-900">{averageRating.toFixed(1)}</div>
              <div className="flex items-center gap-1 justify-center mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      "w-5 h-5",
                      i < Math.floor(averageRating)
                        ? "text-amber-500 fill-amber-500"
                        : "text-slate-300"
                    )}
                  />
                ))}
              </div>
              <div className="text-slate-600 text-sm mt-1">
                ({totalReviews} تقييم)
              </div>
            </div>
            
            <div className="flex-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = comments.filter(c => c.rating === star).length;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                
                return (
                  <div key={star} className="flex items-center gap-3 mb-2">
                    <div className="flex items-center gap-1 w-12">
                      <span>{star}</span>
                      <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    </div>
                    <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-amber-500 rounded-full"
                        style={{ width: `${percentage}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-slate-600 w-8">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Add Rating Button */}
          <div className="mb-6">
            <Button 
              onClick={() => setShowRatingForm(!showRatingForm)}
              className="bg-primary hover:bg-primary/90"
            >
              {showRatingForm ? 'إلغاء التقييم' : 'أضف تقييمك'}
            </Button>
            
            {showRatingForm && (
              <div className="mt-4 p-4 border border-slate-200 rounded-xl relative z-30">
                <Rating 
                  productId={productId}
                  initialRating={initialRating}
                  onRatingSubmit={(rating, review) => {
                    onRatingSubmit(rating, review);
                    setShowRatingForm(false);
                  }}
                />
              </div>
            )}
          </div>
          
          {/* Comments List */}
          <div className="space-y-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="bg-slate-50 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="font-medium text-slate-900">{comment.userName}</div>
                    <div className="text-sm text-slate-500">{formatDate(comment.date)}</div>
                  </div>
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < comment.rating
                            ? "text-amber-500 fill-amber-500"
                            : "text-slate-300"
                        )}
                      />
                    ))}
                  </div>
                  {comment.review && (
                    <p className="text-slate-700 text-sm">{comment.review}</p>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <p>لا توجد تقييمات بعد</p>
                <p className="text-sm mt-2">كن أول من يقيم هذا المنتج</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CommentsModal;