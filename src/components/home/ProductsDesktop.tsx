import { useState, useEffect, useRef, useCallback } from 'react';
import { optimizeImage } from '@/lib/images';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Star, Eye, EyeOff, Heart, ArrowRight, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import CommentsModal from '@/components/product/CommentsModal';
import AuthModal from '@/components/ui/auth-modal';
import { WhatsAppContactModal } from '@/components/product/WhatsAppContactModal';
import whatsappIcon from '@/assets/whatsapp.png';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import FavoriteButton from '@/components/ui/FavoriteButton';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/use-toast';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import type { Product } from '@/types';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface ProductsDesktopProps {
  products: Product[];
  loading: boolean;
  hoveredProduct: string | null;
  setHoveredProduct: (id: string | null) => void;
  hidePrices?: boolean;
}

const ProductsDesktop = ({ products, loading, hoveredProduct, setHoveredProduct }: Omit<ProductsDesktopProps, 'hidePrices'>) => {
  const { hidePrices } = usePricingSettings();
  const [scrollProgress, setScrollProgress] = useState(0);
  const [isHovering, setIsHovering] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactProduct, setContactProduct] = useState<Product | null>(null);
  const [hoveredRating, setHoveredRating] = useState<{[key: string]: number}>({});
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const navigate = useNavigate();
  const { addItem, isInCart: checkIsInCart, getItemByProductId } = useCart();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { 
    showAuthModal: favoritesAuthModal, 
    setShowAuthModal: setFavoritesAuthModal,
    favorites,
    toggleFavorite: toggleFavoriteHook
  } = useFavorites();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<'cart' | 'favorites' | 'general'>('general');
  const { toast } = useToast();

  // Extract clean product ID (remove carousel suffix)
  const getCleanProductId = (id: string) => {
    return id.replace(/-set-\d+-\d+$/, '');
  };

  // Prepare products for true infinite scrolling
  const prepareProductsForCarousel = (products: Product[]) => {
    if (products.length === 0) return [];
    
    // Create multiple copies for true infinite scrolling
    // We need at least 3 full sets to ensure seamless infinite loop
    const minSets = 3;
    const duplicatedProducts = [];
    
    for (let setIndex = 0; setIndex < minSets; setIndex++) {
      products.forEach((product, productIndex) => {
        duplicatedProducts.push({
          ...product,
          id: `${product.id}-set-${setIndex}-${productIndex}`,
        });
      });
    }
    
    return duplicatedProducts;
  };

  const carouselProducts = prepareProductsForCarousel(products);

  const handleAddToCart = async (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      setAuthAction('cart');
      setShowAuthModal(true);
      return;
    }

    // Check if product is already in cart
    const wasInCart = checkIsInCart(product.id);
    const currentItem = getItemByProductId(product.id);
    const previousQuantity = currentItem?.quantity || 0;
    
    try {
      await addItem(product, 1);
      
      const newQuantity = previousQuantity + 1;
      
      // Show enhanced toast with product image and quantity info
      toast({
        title: wasInCart ? "تمت إضافة واحد آخر ✓" : "تمت الإضافة للسلة ✓",
        description: (
          <div className="space-y-3 mt-2" dir="rtl">
            {/* Product Info */}
            <div className="flex items-start gap-3">
              <img
                src={optimizeImage(product.image, { w: 80 })}
                alt={product.nameAr}
                className="w-20 h-20 object-cover rounded-lg shadow-md flex-shrink-0"
              />
              <div className="flex-1 text-right min-w-0">
                <p className="font-bold text-sm text-slate-900 line-clamp-2">{product.nameAr}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {!hidePrices && <p className="text-sm font-semibold text-primary">{product.price ? product.price.toLocaleString() : 'N/A'} ج.م</p>}
                  {product.category && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {product.categoryAr || product.category}
                    </span>
                  )}
                </div>
                {wasInCart && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-xs font-semibold text-green-600">
                      الكمية: {newQuantity} قطعة
                    </p>
                    {!hidePrices && (
                      <>
                        <span className="text-xs text-slate-500">•</span>
                        <p className="text-xs font-semibold text-slate-700">
                          الإجمالي: {product.price ? (product.price * newQuantity).toLocaleString() : 'N/A'} ج.م
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => navigate('/cart')}
                className="flex-1 bg-primary hover:bg-primary/90 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                عرض السلة
              </button>
              <button
                onClick={() => {}}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                متابعة التسوق
              </button>
            </div>
          </div>
        ),
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleRatingClick = (e: React.MouseEvent, product: Product, rating?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProduct(product);
    setSelectedRating(rating || 0);
    setShowCommentsModal(true);
  };

  const handleStarHover = (productId: string, rating: number) => {
    setHoveredRating(prev => ({ ...prev, [productId]: rating }));
  };

  const handleStarLeave = (productId: string) => {
    setHoveredRating(prev => ({ ...prev, [productId]: 0 }));
  };

  const handleToggleFavorite = async (productId: string) => {
    try {
      await toggleFavoriteHook(productId);
    } catch (error) {
      console.error('Error toggling favorite:', error);
    }
  };

  const handleRatingSubmit = (rating: number, review?: string) => {
    console.log('Rating submitted:', { productId: selectedProduct?.id, rating, review });
    // Here you would typically make an API call to save the rating
    // For now, just close the modal
    setShowCommentsModal(false);
    setSelectedProduct(null);
  };

  const handleCommentsModalClose = () => {
    setShowCommentsModal(false);
    setSelectedProduct(null);
  };

  // Generate mock comments for demo purposes
  const generateMockComments = (productId: string) => {
    return [
      {
        id: '1',
        userId: 'user1',
        userName: 'أحمد محمد',
        rating: 5,
        review: 'منتج ممتاز وجودة عالية، أنصح بشرائه',
        date: '2024-01-15'
      },
      {
        id: '2',
        userId: 'user2',
        userName: 'فاطمة علي',
        rating: 4,
        review: 'جيد جداً ولكن التوصيل كان متأخر قليلاً',
        date: '2024-01-10'
      },
      {
        id: '3',
        userId: 'user3',
        userName: 'محمود حسن',
        rating: 5,
        review: 'رائع! تماماً كما هو موضح في الصور',
        date: '2024-01-08'
      }
    ];
  };

  const renderStars = (product: Product) => {
    const productHoveredRating = hoveredRating[product.id] || 0;
    
    return Array.from({ length: 5 }, (_, i) => {
      const starIndex = i + 1;
      const isHoveredStar = productHoveredRating >= starIndex;
      const isRated = i < Math.floor(product.rating || 0);
      const shouldHighlight = productHoveredRating > 0 ? isHoveredStar : isRated;
      
      return (
        <Star
          key={i}
          className={`w-4 h-4 transition-colors duration-200 cursor-pointer ${
            shouldHighlight
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-slate-300 hover:text-yellow-300'
          }`}
          onMouseEnter={() => handleStarHover(product.id, starIndex)}
          onMouseLeave={() => handleStarLeave(product.id)}
          onClick={(e) => handleRatingClick(e, product, starIndex)}
        />
      );
    });
  };

  return (
    <>
      <div className="relative">

        <div
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
          className="px-1"
        >
          {loading ? (
            <div className="overflow-hidden">
              <div className="flex gap-6">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="min-w-[32%] lg:min-w-[24%] xl:min-w-[19%]">
                    <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <div className="w-full h-full bg-slate-200 animate-pulse" />
                      </div>
                      <div className="p-4">
                        <div className="h-4 w-3/4 bg-slate-200 animate-pulse rounded mb-2" />
                        <div className="h-3 w-1/2 bg-slate-100 animate-pulse rounded mb-4" />
                        <div className="flex gap-2">
                          <div className="h-10 flex-1 rounded-lg bg-slate-200 animate-pulse" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : products.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-slate-600">
              <span className="text-xl font-semibold mb-2 text-slate-900">لا توجد منتجات متاحة حالياً</span>
              <p className="text-base mb-6">تحقق لاحقاً أو استعرض جميع المنتجات</p>
              <Button asChild className="bg-primary hover:bg-primary/90 text-white px-8 py-6 rounded-xl">
                <Link to="/products">عرض جميع المنتجات</Link>
              </Button>
            </div>
          ) : (
            <div className="py-4">
              <Swiper
                modules={[Navigation, Pagination, Autoplay]}
                spaceBetween={20}
                slidesPerView="auto"
                loop={carouselProducts.length > 1}
                autoplay={{
                  delay: 4000,
                  disableOnInteraction: false,
                  pauseOnMouseEnter: true,
                  waitForTransition: false,
                }}
                navigation={{
                  nextEl: '.swiper-button-next-custom',
                  prevEl: '.swiper-button-prev-custom',
                }}
                pagination={{
                  clickable: true,
                  dynamicBullets: true,
                  el: '.products-pagination',
                }}
                breakpoints={{
                  640: {
                    slidesPerView: 2,
                    spaceBetween: 20,
                  },
                  768: {
                    slidesPerView: 3,
                    spaceBetween: 24,
                  },
                  1024: {
                    slidesPerView: 4,
                    spaceBetween: 24,
                  },
                  1280: {
                    slidesPerView: 5,
                    spaceBetween: 24,
                  },
                }}
                className="products-swiper"
                style={{
                  '--swiper-theme-color': 'hsl(var(--primary))',
                  '--swiper-pagination-color': 'hsl(var(--primary))',
                } as React.CSSProperties}
              >
                {carouselProducts.map((product, index) => (
                  <SwiperSlide 
                    key={`${product.id}-${index}`} 
                    className="!w-80 lg:!w-72 xl:!w-80 !bg-transparent"
                    style={{ background: 'transparent !important' }}
                  >
                    <div
                      className="py-4"
                      onMouseEnter={() => setHoveredProduct(product.id)}
                      onMouseLeave={() => setHoveredProduct(null)}
                    >
                      <div 
                        className="group relative h-full rounded-2xl overflow-hidden bg-white border-2 border-slate-200 hover:border-primary shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 hover:scale-[1.02] cursor-pointer"
                        onClick={() => navigate(`/product/${getCleanProductId(product.id)}`)}
                      >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none overflow-hidden rounded-2xl">
                          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                        </div>

                        <div className="relative aspect-[4/3] overflow-hidden">
                          <Link to={`/product/${getCleanProductId(product.id)}`} onClick={(e) => e.stopPropagation()}>
                            <img
                              src={optimizeImage(product.image || `/api/categories/${product.category}/image`, { w: 320 })}
                              alt={product.nameAr}
                              className={`w-full h-full object-cover transition-transform duration-700 ${hoveredProduct === product.id ? 'scale-110' : 'scale-100'}`}
                              loading="lazy"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="320" height="240"%3E%3Crect fill="%23f1f5f9" width="320" height="240"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="14" fill="%2394a3b8"%3Eلا توجد صورة%3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </Link>

                          {/* Category Badge - Top Right */}
                          <Link 
                            to={`/category/${product.category}`}
                            className="absolute top-3 right-3 text-xs font-semibold text-white bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary transition-colors z-10"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {product.categoryAr || product.category}
                          </Link>

                          {/* Advanced 3D Heart Favorite Button - Top Left */}
                          <div className="absolute top-3 left-3 z-10">
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleToggleFavorite(product.id);
                                    }}
                                    className={`group/heart bg-white/95 backdrop-blur-sm rounded-full p-2.5 shadow-lg border border-slate-100 hover:bg-white hover:shadow-2xl transition-all duration-300 relative heart-button ${
                                      favorites.includes(product.id) ? 'heart-active' : ''
                                    }`}
                                  >
                                    {/* Single Heart with State-Based Rendering */}
                                    <div className="relative heart-3d-advanced" style={{ 
                                      transformStyle: 'preserve-3d',
                                      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
                                    }}>
                                      {/* Conditional rendering based on state */}
                                      {favorites.includes(product.id) ? (
                                        // Active State - Theme Colored Heart
                                        <div className="relative">
                                          {/* Shadow */}
                                          <svg 
                                            className="w-6 h-6 absolute"
                                            style={{ 
                                              transform: 'translate(2px, 2px)',
                                              filter: 'blur(0.5px)',
                                              fill: 'hsl(var(--primary) / 0.2)'
                                            }}
                                            viewBox="0 0 24 24"
                                          >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                          </svg>
                                          
                                          {/* Main heart - theme colored */}
                                          <svg 
                                            className="w-6 h-6 relative"
                                            style={{
                                              fill: 'hsl(var(--primary))',
                                              filter: 'drop-shadow(0 0 8px hsl(var(--primary)))',
                                              animation: 'heartBeat 1.5s ease-in-out infinite'
                                            }}
                                            viewBox="0 0 24 24"
                                          >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
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
                                      {!favorites.includes(product.id) && (
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 group-hover/heart:opacity-100 group-hover/heart:scale-100 transition-all duration-400 ease-out">
                                          {/* Shadow */}
                                          <svg 
                                            className="w-6 h-6 absolute"
                                            style={{ 
                                              transform: 'translate(2px, 2px)',
                                              filter: 'blur(0.5px)',
                                              fill: 'hsl(var(--primary) / 0.2)'
                                            }}
                                            viewBox="0 0 24 24"
                                          >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                          </svg>
                                          
                                          {/* Main heart - theme colored */}
                                          <svg 
                                            className="w-6 h-6 relative"
                                            style={{
                                              fill: 'hsl(var(--primary))',
                                              filter: 'drop-shadow(0 0 6px hsl(var(--primary)))',
                                              animation: 'heartPulse 2s ease-in-out infinite'
                                            }}
                                            viewBox="0 0 24 24"
                                          >
                                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                                          </svg>
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <p>{favorites.includes(product.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>

                          {product.discount && (
                            <Badge className="absolute bottom-3 left-3 bg-destructive text-white font-bold px-3 py-1 text-sm shadow-lg">
                              خصم {product.discount}%
                            </Badge>
                          )}
                        </div>

                        <div className="p-3 space-y-2">
                          <Link to={`/product/${getCleanProductId(product.id)}`} className="block">
                            <h3 className="font-bold text-sm text-slate-900 line-clamp-2 group-hover:text-primary transition-colors min-h-[2.5rem]">
                              {product.nameAr}
                            </h3>
                          </Link>
                          
                          {/* Modern Separation Line */}
                          <div className="relative h-0.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
                          </div>

                          {/* Price and Rating on same line */}
                          <div className="flex items-center justify-between gap-2">
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
                              className="flex items-center gap-0.5 hover:opacity-80 transition-opacity"
                              onMouseLeave={() => handleStarLeave(product.id)}
                            >
                              {renderStars(product)}
                              <span 
                                className="text-xs text-slate-500 cursor-pointer hover:text-primary transition-colors"
                                onClick={(e) => handleRatingClick(e, product)}
                              >
                                ({product.reviews || 0})
                              </span>
                            </div>
                          </div>

                          <TooltipProvider>
                            <div className="flex gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/product/${getCleanProductId(product.id)}`);
                                    }}
                                    className="h-10 w-10 rounded-xl bg-secondary hover:bg-secondary/90 text-white transition-all duration-300 group/eye flex items-center justify-center p-0 relative"
                                  >
                                    {/* Normal Eye (Default) */}
                                    <Eye className="w-4 h-4 absolute transition-all duration-300 group-hover/eye:scale-110" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top" sideOffset={5}>
                                  <p>عرض التفاصيل</p>
                                </TooltipContent>
                              </Tooltip>
                              {hidePrices ? (
                                <Button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setContactProduct(product);
                                    setShowContactModal(true);
                                  }}
                                  className="flex-1 rounded-xl h-10 text-sm font-semibold transition-all duration-500 group/btn relative overflow-hidden bg-primary hover:bg-primary/90 text-white"
                                >
                                  <span className="absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                                    <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                                    <span>لمعرفة السعر</span>
                                  </span>
                                  <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                                    <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                                    <span>اضغط هنا</span>
                                  </span>
                                </Button>
                              ) : (
                                <Button
                                  onClick={(e) => handleAddToCart(product, e)}
                                  className={`flex-1 rounded-xl h-10 text-sm font-semibold transition-all duration-500 group/btn relative overflow-hidden ${
                                    checkIsInCart(product.id)
                                      ? 'bg-green-500 hover:bg-green-600 text-white'
                                      : 'bg-primary hover:bg-primary/90 text-white'
                                  }`}
                                >
                                  {checkIsInCart(product.id) ? (
                                    /* In Cart - Show checkmark with hover animation (left to right) */
                                    <>
                                      <span className="absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                                        <Check className="w-4 h-4" />
                                        <span>في السلة</span>
                                      </span>
                                      <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                                        <Plus className="w-4 h-4" />
                                        <span>إضافة واحد آخر</span>
                                      </span>
                                    </>
                                  ) : (
                                    <>
                                      {/* Default content - Cart icon + text */}
                                      <span className="absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                                        <ShoppingBag className="w-4 h-4" />
                                        <span>السلة</span>
                                      </span>
                                      
                                      {/* Hover content - Full text with arrow */}
                                      <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                                        <ArrowRight className="w-4 h-4" />
                                        <span>إضافة إلى السلة</span>
                                      </span>
                                    </>
                                  )}
                                </Button>
                              )}
                            </div>
                          </TooltipProvider>
                        </div>
                      </div>
                    </div>
                  </SwiperSlide>
                ))}
              </Swiper>
              
              {/* Custom Navigation Buttons */}
              <div className="swiper-button-prev-custom absolute left-2 top-1/2 -translate-y-1/2 z-30 w-14 h-14 bg-white/95 backdrop-blur-sm rounded-full shadow-2xl border-2 border-slate-300 flex items-center justify-center cursor-pointer hover:bg-primary hover:border-primary hover:shadow-xl hover:scale-110 transition-all duration-300">
                <ChevronLeft className="w-7 h-7 text-slate-800" />
              </div>
              <div className="swiper-button-next-custom absolute right-2 top-1/2 -translate-y-1/2 z-30 w-14 h-14 bg-white/95 backdrop-blur-sm rounded-full shadow-2xl border-2 border-slate-300 flex items-center justify-center cursor-pointer hover:bg-primary hover:border-primary hover:shadow-xl hover:scale-110 transition-all duration-300">
                <ChevronRight className="w-7 h-7 text-slate-800" />
              </div>
            </div>
          )}
        </div>
      </div>

      <AuthModal
        isOpen={showAuthModal || favoritesAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setFavoritesAuthModal(false);
        }}
        action={favoritesAuthModal ? 'favorites' : authAction}
      />

      {/* Comments Modal with Rating System */}
      {selectedProduct && (
        <CommentsModal
          isOpen={showCommentsModal}
          onClose={handleCommentsModalClose}
          comments={generateMockComments(selectedProduct.id)}
          productId={selectedProduct.id}
          productName={selectedProduct.nameAr}
          onRatingSubmit={handleRatingSubmit}
          averageRating={selectedProduct.rating || 0}
          totalReviews={selectedProduct.reviews || 0}
          initialRating={selectedRating}
        />
      )}

      {/* Contact Modal */}
      {contactProduct && (
        <WhatsAppContactModal
          isOpen={showContactModal}
          onClose={() => setShowContactModal(false)}
          productName={contactProduct.nameAr}
          productId={contactProduct.id}
          productImage={optimizeImage(contactProduct.image, { w: 100 })}
          defaultMessage="السلام عليكم، أود الاستفسار عن هذا المنتج"
        />
      )}
    </>
  );
};

export default ProductsDesktop;
