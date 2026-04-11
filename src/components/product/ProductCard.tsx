import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Eye, Send, Check, Plus, Heart } from 'lucide-react';
import whatsappIcon from '@/assets/whatsapp.png';
import { Product } from '@/types';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AuthModal from '@/components/ui/auth-modal';
import { WhatsAppContactModal } from '@/components/product/WhatsAppContactModal';
import { useToast } from '@/hooks/use-toast';
import { optimizeImage, buildSrcSet, applyProductImageFallback } from '@/lib/images';
import { buildCategoryPath } from '@/lib/category-link';
import { buildProductPath } from '@/lib/product-link';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import { useFavorites } from '@/hooks/useFavorites';
import { favoriteProductKey } from '@/lib/favorite-ids';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import 'swiper/css';
import 'swiper/css/pagination';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  showQuickView?: boolean;
  showFavorite?: boolean;
  className?: string;
  compactMobile?: boolean;
}

const ProductCard = ({ product, showQuickView = true, showFavorite = true, className = "", compactMobile = false }: ProductCardProps) => {
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<'cart' | 'favorites'>('cart');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const { addItem, isInCart } = useCart();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { toast } = useToast();
  const { hidePrices, loading: pricingLoading } = usePricingSettings();
  const { isFavorite, toggleFavorite: toggleFavoriteHook } = useFavorites();
  const favKey = favoriteProductKey(product);

  const categoryPath = (() => {
    return buildCategoryPath({
      slug: product.categorySlug,
      nameAr: product.categoryAr,
      name: product.category,
      id: product.categoryId || product.category,
    });
  })();
  const productPath = buildProductPath(product.id);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check authentication and user type
    if (!isAuthenticated || isAdmin) {
      setAuthAction('cart');
      setShowAuthModal(true);
      return;
    }

    setIsAddingToCart(true);

    const result = await addItem(product, 1);

    if (result.success) {
      toast({
        title: "تمت الإضافة!",
        description: `تم إضافة ${product.nameAr} إلى السلة`,
        variant: "default"
      });
    } else {
      toast({
        title: "خطأ",
        description: result.error || "فشل في إضافة المنتج",
        variant: "destructive"
      });
    }

    setIsAddingToCart(false);
  };

  const handleToggleFavorite = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Show auth modal if not authenticated or is admin
    if (!isAuthenticated || isAdmin) {
      setAuthAction('favorites');
      setShowAuthModal(true);
      return;
    }
    if (favKey) toggleFavoriteHook(favKey);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const starIndex = i + 1;
      const isHoveredStar = hoveredRating >= starIndex;
      const isRated = i < Math.floor(rating || 0);
      const shouldHighlight = hoveredRating > 0 ? isHoveredStar : isRated;

      return (
        <Star
          key={i}
          className={`w-4 h-4 transition-colors duration-200 cursor-pointer ${shouldHighlight
            ? 'text-yellow-400 fill-yellow-400'
            : 'text-slate-300 hover:text-yellow-300'
            }`}
          onMouseEnter={() => setHoveredRating(starIndex)}
          onMouseLeave={() => setHoveredRating(0)}
        />
      );
    });
  };

  const handleContactWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowWhatsAppModal(true);
  };

  const inCart = isInCart(product.id);
  const discountPercentage = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <>
      {/* Premium Card Design - Matching ProductsDesktop */}
      <div className={`relative group overflow-hidden bg-white border-2 border-slate-200 hover:border-primary shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] cursor-pointer ${compactMobile ? 'rounded-xl' : 'rounded-2xl'} ${className}`}>
        <div className="relative h-full">
          {/* Interactive Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-transparent to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-4 pointer-events-none"></div>

          {/* Badges */}
          <div className="absolute top-2 right-2 z-20 flex flex-col gap-2">
            {discountPercentage > 0 && (
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white font-semibold text-xs px-2 py-1 rounded-md shadow-md flex items-center gap-1 animate-pulse">
                <span>-{discountPercentage}%</span>
              </div>
            )}
          </div>

          {/* Product Image Slider */}
          <div className={`relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 ${compactMobile ? 'aspect-[10/7]' : 'aspect-[4/3]'}`}>
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center z-10">
                <LoadingSpinner />
              </div>
            )}

            {/* Image Swiper */}
            <Swiper
              modules={[Pagination]}
              pagination={{
                clickable: true,
                dynamicBullets: true,
              }}
              className="h-full product-card-swiper"
              onSlideChange={() => setImageLoaded(true)}
            >
              {/* Main Image */}
              <SwiperSlide>
                <Link to={productPath} state={{ product }} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="block w-full h-full">
                  <img
                    src={optimizeImage(product.image, { w: 320 })}
                    alt={product.nameAr}
                    className={`w-full h-full object-cover transition-all duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'} group-hover:scale-110`}
                    onLoad={() => setImageLoaded(true)}
                    onError={applyProductImageFallback}
                    loading="lazy"
                    decoding="async"
                    srcSet={buildSrcSet(product.image, 320)}
                    sizes="(max-width: 640px) 33vw, 320px"
                  />
                </Link>
              </SwiperSlide>

              {/* Additional Images */}
              {product.images && product.images.length > 0 && product.images.slice(0, 4).map((img, idx) => (
                <SwiperSlide key={idx}>
                  <Link to={productPath} state={{ product }} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="block w-full h-full">
                    <img
                      src={optimizeImage(img, { w: 320 })}
                      alt={`${product.nameAr} - ${idx + 1}`}
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
                      onError={applyProductImageFallback}
                      loading="lazy"
                      decoding="async"
                    />
                  </Link>
                </SwiperSlide>
              ))}
            </Swiper>

            {/* Visual overlay (non-interactive) */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/0 via-transparent to-black/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-10" />

            {/* Top bar controls */}
            <div className="absolute top-0 inset-x-0 p-3 flex justify-between items-start z-20">
              {/* Category Badge - Top Right */}
              <Link
                to={categoryPath}
                className="text-xs font-semibold text-white bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary transition-colors"
                onClick={(e) => e.stopPropagation()}
              >
                {product.categoryAr || product.category}
              </Link>

              {/* Advanced 3D Heart Favorite Button - Top Left */}
              <TooltipProvider delayDuration={400} skipDelayDuration={0}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleToggleFavorite}
                      className={`group/heart bg-white/95 backdrop-blur-sm rounded-full p-2.5 shadow-lg border border-slate-100 hover:bg-white hover:shadow-2xl transition-all duration-300 relative z-30 heart-button ${favKey && isFavorite(favKey) ? 'heart-active' : ''
                        }`}
                    >
                      {/* 3D Heart with State-Based Rendering */}
                      <div className="relative heart-3d-advanced" style={{
                        transformStyle: 'preserve-3d',
                        transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}>
                        {favKey && isFavorite(favKey) ? (
                          // Active State - Theme Colored Heart
                          <div className="relative">
                            <svg
                              className="w-6 h-6 absolute"
                              style={{
                                transform: 'translate(2px, 2px)',
                                filter: 'blur(0.5px)',
                                fill: 'hsl(var(--primary) / 0.2)'
                              }}
                              viewBox="0 0 24 24"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            <svg
                              className="w-6 h-6 relative"
                              style={{
                                fill: 'hsl(var(--primary))',
                                filter: 'drop-shadow(0 0 8px hsl(var(--primary)))',
                                animation: 'heartBeat 1.5s ease-in-out infinite'
                              }}
                              viewBox="0 0 24 24"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </div>
                        ) : (
                          // Inactive State - Gray Outline
                          <div className="group-hover/heart:opacity-0 transition-opacity duration-300">
                            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </div>
                        )}

                        {/* Hover State - Theme Preview */}
                        {!(favKey && isFavorite(favKey)) && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 group-hover/heart:opacity-100 group-hover/heart:scale-100 transition-all duration-400 ease-out">
                            <svg
                              className="w-6 h-6 absolute"
                              style={{
                                transform: 'translate(2px, 2px)',
                                filter: 'blur(0.5px)',
                                fill: 'hsl(var(--primary) / 0.2)'
                              }}
                              viewBox="0 0 24 24"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                            <svg
                              className="w-6 h-6 relative"
                              style={{
                                fill: 'hsl(var(--primary))',
                                filter: 'drop-shadow(0 0 6px hsl(var(--primary)))',
                                animation: 'heartPulse 2s ease-in-out infinite'
                              }}
                              viewBox="0 0 24 24"
                            >
                              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                            </svg>
                          </div>
                        )}
                      </div>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent
                    side="left"
                    align="center"
                    sideOffset={10}
                    collisionPadding={16}
                    className="max-w-[13rem] whitespace-normal text-center leading-snug z-[200]"
                  >
                    <p className="text-sm">
                      {favKey && isFavorite(favKey) ? 'إزالة من المفضلة' : 'إضافة إلى المفضلة'}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

          </div>

          {/* Content */}
          <div className={`${compactMobile ? 'p-2 space-y-1.5' : 'p-3 space-y-2'} flex flex-col ${compactMobile ? '' : 'h-full'}`}>
            <Link to={productPath} className="block">
              <h3 className={`font-bold text-slate-900 group-hover:text-primary transition-colors ${compactMobile ? 'text-[15px] line-clamp-1 min-h-[1.5rem]' : 'text-sm line-clamp-2 min-h-[2.5rem]'}`}>
                {product.nameAr}
              </h3>
            </Link>

            {/* Modern Separation Line */}
            <div className={`relative bg-slate-100 rounded-full overflow-hidden ${compactMobile ? 'h-px' : 'h-0.5'}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
            </div>

            {/* Price and Rating on same line */}
            <div className={`flex items-center gap-2 ${hidePrices ? 'justify-end' : 'justify-between'}`}>
              <div className="flex items-baseline gap-1">
                {!hidePrices && (
                  <>
                    <span className="text-lg font-black text-primary">{product.price ? product.price.toLocaleString() : 'N/A'}</span>
                    <span className="text-xs text-slate-600">ج.م</span>
                  </>
                )}
                {product.originalPrice && (
                  <span className="text-xs text-slate-400 line-through">{product.originalPrice ? product.originalPrice.toLocaleString() : 'N/A'}</span>
                )}
              </div>

              <div
                className={`flex items-center hover:opacity-80 transition-opacity ${compactMobile ? 'gap-1' : 'gap-2'}`}
                onMouseLeave={() => setHoveredRating(0)}
              >
                <div className="flex items-center gap-0.5">
                  {renderStars(product.rating || 0)}
                  <span className={`text-slate-500 cursor-pointer hover:text-primary transition-colors ${compactMobile ? 'text-[11px]' : 'text-xs'}`}>
                    ({product.reviews || 0})
                  </span>
                </div>
                {product.sku && (
                  <span className={`font-semibold text-primary bg-primary/10 rounded-md border border-primary/30 hover:border-primary/60 transition-colors ${compactMobile ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2.5 py-1'}`}>
                    {product.sku}
                  </span>
                )}
              </div>
            </div>

            {/* Bottom action buttons - Eye + Action button (aligned height & radius) */}
            <div
              className={`flex items-stretch gap-2 ${compactMobile ? 'pt-1' : 'mt-auto pt-2'}`}
            >
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        window.location.href = productPath;
                      }}
                      className={`${compactMobile ? 'h-8 w-8 min-h-8 min-w-8 rounded-md' : 'h-10 w-10 min-h-10 min-w-10 shrink-0 rounded-xl'} bg-secondary hover:bg-secondary/90 text-white transition-all duration-300 group/eye flex items-center justify-center p-0`}
                    >
                      <Eye className={`${compactMobile ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-all duration-300 group-hover/eye:scale-110`} />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top" sideOffset={5}>
                    <p>عرض التفاصيل</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              {hidePrices ? (
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleContactWhatsApp(e);
                  }}
                  className={`flex-1 min-w-0 min-h-0 ${compactMobile ? 'h-8 rounded-md text-[11px]' : 'h-10 min-h-10 rounded-xl text-xs'} font-semibold bg-green-500 hover:bg-green-600 text-white inline-flex items-center justify-center gap-1.5`}
                >
                  <img src={whatsappIcon} alt="WhatsApp" className={`${compactMobile ? 'w-2.5 h-2.5' : 'w-3 h-3'} shrink-0`} />
                  <span className="truncate">لمعرفة السعر</span>
                </Button>
              ) : (
                <Button
                  onClick={(e) => handleAddToCart(e)}
                  className={`flex-1 min-w-0 relative overflow-hidden font-semibold transition-all duration-500 group/btn ${compactMobile ? 'h-8 min-h-8 rounded-md text-[11px]' : 'h-10 min-h-10 rounded-xl text-xs'} ${inCart
                    ? 'bg-green-500 hover:bg-green-600 text-white'
                    : 'bg-primary hover:bg-primary/90 text-white'
                    }`}
                >
                  {inCart ? (
                    <>
                      <span className="absolute inset-0 flex items-center justify-center gap-1 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                        <Check className="w-3 h-3" />
                        <span>في السلة</span>
                      </span>
                      <span className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                        <Plus className="w-3 h-3" />
                        <span>إضافة</span>
                      </span>
                    </>
                  ) : (
                    <>
                      <span className="absolute inset-0 flex items-center justify-center gap-1 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                        <ShoppingCart className="w-3 h-3" />
                        <span>أضف للسلة</span>
                      </span>
                      <span className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                        <ShoppingCart className="w-3 h-3" />
                        <span>أضف للسلة</span>
                      </span>
                    </>
                  )}
                </Button>
              )}
            </div>

            {/* Action buttons moved to image overlay for better UX */}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action={authAction}
      />

      {/* WhatsApp Contact Modal */}
      <WhatsAppContactModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        productName={product.nameAr || product.name || ''}
        productId={favKey || product.id || ''}
        productCode={product.sku}
        productImage={product.image}
      />
    </>
  );
};

export default ProductCard;
