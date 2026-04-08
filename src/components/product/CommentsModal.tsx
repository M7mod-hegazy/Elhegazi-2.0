import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import Rating from '@/components/product/Rating';
import AuthModal from '@/components/ui/auth-modal';
import { useDualAuth } from '@/hooks/useDualAuth';

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
    year: 'numeric',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const CommentsModal = ({
  isOpen,
  onClose,
  comments,
  productId,
  onRatingSubmit,
  averageRating,
  totalReviews,
  initialRating = 0,
}: CommentsModalProps) => {
  const [showRatingForm, setShowRatingForm] = useState(initialRating > 0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, adminUser, isAuthenticated, isAdminAuthenticated } = useDualAuth();

  const currentUserId = String(user?.id || adminUser?.id || '');
  const hasCurrentUserRated =
    !!currentUserId && comments.some((comment) => String(comment.userId) === currentUserId);
  const canRate = isAuthenticated || isAdminAuthenticated;

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow || '';
      document.documentElement.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-lg"
      style={{ backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative z-[100000] max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-white p-4">
          <h2 className="text-xl font-bold text-slate-900">تقييمات المنتج</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className="p-6">
          <div className="mb-8 flex items-center gap-8 rounded-xl bg-slate-50 p-4">
            <div className="text-center">
              <div className="text-4xl font-bold text-slate-900">{averageRating.toFixed(1)}</div>
              <div className="mt-1 flex items-center justify-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={cn(
                      'h-5 w-5',
                      i < Math.floor(averageRating) ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                    )}
                  />
                ))}
              </div>
              <div className="mt-1 text-sm text-slate-600">({totalReviews} تقييم)</div>
            </div>

            <div className="flex-1">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = comments.filter((c) => c.rating === star).length;
                const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;
                return (
                  <div key={star} className="mb-2 flex items-center gap-3">
                    <div className="flex w-12 items-center gap-1">
                      <span>{star}</span>
                      <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-amber-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="w-8 text-sm text-slate-600">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-6">
            <Button
              onClick={() => {
                if (!canRate) {
                  setShowAuthModal(true);
                  return;
                }
                if (!hasCurrentUserRated) setShowRatingForm(!showRatingForm);
              }}
              disabled={hasCurrentUserRated}
              className="bg-primary hover:bg-primary/90 disabled:opacity-70"
            >
              {!canRate
                ? 'سجل الدخول لإضافة تقييم'
                : hasCurrentUserRated
                  ? 'تم تقييم هذا المنتج'
                  : showRatingForm
                    ? 'إلغاء التقييم'
                    : 'أضف تقييمك'}
            </Button>

            {!canRate && <p className="mt-2 text-xs text-slate-500">يجب تسجيل الدخول قبل إرسال تقييم.</p>}
            {canRate && hasCurrentUserRated && (
              <p className="mt-2 text-xs text-slate-500">لا يمكنك تقييم هذا المنتج أكثر من مرة.</p>
            )}

            {showRatingForm && canRate && !hasCurrentUserRated && (
              <div className="relative z-30 mt-4 rounded-xl border border-slate-200 p-4">
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

          <div className="space-y-4">
            {comments.length > 0 ? (
              comments.map((comment) => (
                <div key={comment.id} className="rounded-lg bg-slate-50 p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="font-medium text-slate-900">{comment.userName}</div>
                    <div className="text-sm text-slate-500">{formatDate(comment.date)}</div>
                  </div>
                  <div className="mb-2 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'h-4 w-4',
                          i < comment.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'
                        )}
                      />
                    ))}
                  </div>
                  {comment.review && <p className="text-sm text-slate-700">{comment.review}</p>}
                </div>
              ))
            ) : (
              <div className="py-8 text-center text-slate-500">
                <p>لا توجد تقييمات بعد</p>
                <p className="mt-2 text-sm">كن أول من يقيم هذا المنتج</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="general"
        title="تسجيل الدخول مطلوب"
        description="يجب تسجيل الدخول لتقييم المنتجات."
      />
    </div>
  );

  return createPortal(modalContent, document.body);
};

export default CommentsModal;
