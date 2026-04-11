import { useState, useMemo } from 'react';
import { Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useFavorites } from '@/hooks/useFavorites';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useToast } from '@/hooks/use-toast';
import AuthModal from '@/components/ui/auth-modal';
import { cn } from '@/lib/utils';
import { normalizeFavoriteProductId } from '@/lib/favorite-ids';

interface FavoriteButtonProps {
  productId: string;
  /**
   * Extra product ids that count as the same “favorite” for display/toggle (e.g. all variants in a family).
   * Primary `productId` is used when adding; removing clears every id in this group that is favorited.
   */
  favoriteGroupIds?: string[];
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'ghost' | 'outline';
  className?: string;
  showToast?: boolean;
  /** When the parent already renders AuthModal bound to useFavorites().showAuthModal */
  suppressAuthModal?: boolean;
}

const FavoriteButton = ({ 
  productId, 
  favoriteGroupIds,
  size = 'md', 
  variant = 'ghost',
  className,
  showToast = true,
  suppressAuthModal = false,
}: FavoriteButtonProps) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const { isFavorite, addToFavorites, removeFromFavorites, isAuthenticated, showAuthModal, setShowAuthModal } =
    useFavorites();
  const { isAdmin } = useDualAuth();
  const { toast } = useToast();

  const candidateIds = useMemo(() => {
    const set = new Set<string>();
    const p = normalizeFavoriteProductId(productId);
    if (p) set.add(p);
    for (const x of favoriteGroupIds ?? []) {
      const n = normalizeFavoriteProductId(x);
      if (n) set.add(n);
    }
    return [...set];
  }, [productId, favoriteGroupIds]);

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check if user is authenticated and not admin
    if (!isAuthenticated || isAdmin) {
      setShowAuthModal(true);
      return;
    }

    const wasFav = candidateIds.some((id) => isFavorite(id));
    let success = false;
    if (wasFav) {
      const toRemove = candidateIds.filter((id) => isFavorite(id));
      for (const id of toRemove) {
        const ok = await removeFromFavorites(id);
        success = success || ok;
      }
    } else {
      const primary = normalizeFavoriteProductId(productId);
      if (primary) success = await addToFavorites(primary);
    }

    if (success) {
      setIsAnimating(true);
      setTimeout(() => setIsAnimating(false), 300);

      if (showToast) {
        const isNowFavorite = !wasFav;
        toast({
          title: isNowFavorite ? "تمت الإضافة للمفضلة" : "تم الحذف من المفضلة",
          description: isNowFavorite ? "تم إضافة المنتج لقائمة المفضلة" : "تم حذف المنتج من قائمة المفضلة",
        });
      }
    }
  };

  const isFav = candidateIds.some((id) => isFavorite(id));
  
  const sizeClasses = {
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-12 h-12'
  };

  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <>
    <Button
      variant={variant}
      size="icon"
      onClick={handleToggleFavorite}
      className={cn(
        sizeClasses[size],
        'relative transition-all duration-300 group',
        'rounded-full shadow-lg hover:shadow-xl will-change-transform',
        'hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400',
        isFav
          ? 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-700 hover:to-indigo-700 border-0'
          : 'bg-white/90 hover:bg-white border border-slate-200 hover:border-indigo-300',
        isAnimating && 'animate-pulse',
        className
      )}
      aria-label={isFav ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      aria-pressed={isFav}
    >
      <Heart
        className={cn(
          iconSizes[size],
          'transition-all duration-300 ease-out',
          isFav
            ? 'fill-white text-white scale-110 drop-shadow'
            : 'text-slate-500 group-hover:text-primary group-hover:scale-110',
          isAnimating && 'animate-bounce'
        )}
      />

      {/* Animated heart effect */}
      {isAnimating && isFav && (
        <div className="absolute inset-0 flex items-center justify-center">
          <Heart
            className={cn(
              iconSizes[size],
              'fill-primary/30 text-primary/30 animate-ping opacity-75'
            )}
          />
        </div>
      )}

      {/* Floating hearts animation */}
      {isAnimating && isFav && (
        <>
          <div className="absolute -top-1 -right-1 animate-bounce" style={{ animationDelay: '0.1s' }}>
            <Heart className="w-2 h-2 fill-sky-400 text-sky-400 opacity-80" />
          </div>
          <div className="absolute -top-1 -left-1 animate-bounce" style={{ animationDelay: '0.2s' }}>
            <Heart className="w-2 h-2 fill-violet-400 text-violet-400 opacity-80" />
          </div>
        </>
      )}
    </Button>

    {!suppressAuthModal ? (
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="favorites"
      />
    ) : null}
  </>
  );
};

export default FavoriteButton;
