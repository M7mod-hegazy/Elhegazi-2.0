import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Eye, Send, Check, Plus } from 'lucide-react';
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
import { optimizeImage, buildSrcSet } from '@/lib/images';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/pagination';
import './ProductCard.css';

interface ProductCardProps {
  product: Product;
  showQuickView?: boolean;
  showFavorite?: boolean;
}

const ProductCard = ({ product, showQuickView = true, showFavorite = true }: ProductCardProps) => {
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const { addItem, isInCart } = useCart();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { toast } = useToast();
  const { hidePrices, contactMessage, loading: pricingLoading } = usePricingSettings();
  
  // Debug logging
  console.log('🎯 ProductCard - hidePrices:', hidePrices, 'type:', typeof hidePrices, 'loading:', pricingLoading, 'product:', product.nameAr);
  console.log('🎯 ProductCard - Conditional check: hidePrices === true?', hidePrices === true);
  console.log('🎯 ProductCard - Price value:', product.price, 'Should show contact?', hidePrices === true);

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Check authentication and user type
    if (!isAuthenticated || isAdmin) {
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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 ${
          i < Math.floor(rating)
            ? 'text-warning fill-warning'
            : 'text-muted-foreground'
        }`}
      />
    ));
  };

  const handleContactWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const whatsappNumber = localStorage.getItem('WHATSAPP_URL') || '';
    const message = `${contactMessage}\n\nالمنتج: ${product.nameAr}`;
    const encodedMessage = encodeURIComponent(message);
    
    if (whatsappNumber) {
      window.open(`${whatsappNumber}?text=${encodedMessage}`, '_blank');
    } else {
      toast({
        title: 'خطأ',
        description: 'رقم الواتس غير متوفر',
        variant: 'destructive'
      });
    }
  };

  const inCart = isInCart(product.id);
  const discountPercentage = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <>
      {/* Modern Card Design */}
      <div className="relative group rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-500 transform hover:-translate-y-1">
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
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
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
                <Link to={`/product/${product.id}`} state={{ product }} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="block w-full h-full">
                  <img
                    src={optimizeImage(product.image, { w: 320 })}
                    alt={product.nameAr}
                    className={`w-full h-full object-cover transition-all duration-700 ${imageLoaded ? 'opacity-100' : 'opacity-0'} group-hover:scale-110`}
                    onLoad={() => setImageLoaded(true)}
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
                  <Link to={`/product/${product.id}`} state={{ product }} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="block w-full h-full">
                    <img
                      src={optimizeImage(img, { w: 320 })}
                      alt={`${product.nameAr} - ${idx + 1}`}
                      className="w-full h-full object-cover transition-all duration-700 group-hover:scale-110"
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
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
              {/* Category Badge */}
              <Badge variant="secondary" className="text-[10px] font-medium bg-blue-50 text-blue-700 border-blue-200">
                {product.categoryAr}
              </Badge>

              {/* Favorite Button */}
              <div className="relative z-10 bg-white/90 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-slate-100 hover:bg-white transition-colors duration-300" onClick={(e) => e.stopPropagation()}>
                <FavoriteButton
                  productId={product.id}
                  size="sm"
                  className="w-5 h-5 text-slate-700 hover:text-primary transition-colors duration-300"
                />
              </div>
            </div>

            {/* Bottom action buttons */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-2">
              {hidePrices ? (
                // When prices hidden: Show hover animation button
                <Button 
                  onClick={handleContactWhatsApp}
                  size="sm"
                  className="w-full h-9 rounded-md text-xs font-medium bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:from-blue-700 hover:to-fuchsia-700 text-white shadow-md hover:shadow-lg transition-all duration-300 group/btn"
                >
                  <span className="group-hover/btn:hidden transition-all duration-300">لمزيد من التفاصيل</span>
                  <span className="hidden group-hover/btn:inline transition-all duration-300 flex items-center gap-1">
                    <img src={whatsappIcon} alt="WhatsApp" className="w-3.5 h-3.5" />
                    لمعرفة السعر
                  </span>
                </Button>
              ) : (
                <>
                  {showQuickView && (
                    <Button size="icon" variant="outline" className="group w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/90 hover:bg-white border border-slate-200 hover:border-primary/30 hover:ring-2 hover:ring-primary/20 shadow-sm hover:shadow-md transition-all" asChild>
                      <Link to={`/product/${product.id}`} state={{ product }} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="w-full h-full flex items-center justify-center">
                        <Eye className="w-4 h-4 text-slate-600 group-hover:text-primary transition-colors" />
                      </Link>
                    </Button>
                  )}
                  <Button
                    onClick={handleAddToCart}
                    disabled={isAddingToCart}
                    size="sm"
                    className={`flex-1 h-9 rounded-md text-xs font-medium ${
                      inCart
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                        : 'bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:from-blue-700 hover:to-fuchsia-700'
                    } text-white shadow-md hover:shadow-lg transition-all duration-300`}
                  >
                    {isAddingToCart ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <ShoppingCart className="w-3.5 h-3.5 mr-1" />
                    )}
                    <span>{inCart ? 'في السلة' : 'سلة'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Content */}
          <div className="p-4 flex flex-col transition-all duration-300 group-hover:bg-slate-50 relative z-10 bg-white h-full">
            <Link to={`/product/${product.id}`} state={{ product }} onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-slate-900 text-sm sm:text-base line-clamp-2 group-hover:text-blue-600 transition-colors duration-300 leading-tight tracking-tight">
                {product.nameAr}
              </h3>
            </Link>
            
            {/* Product Code Badge */}
            {product.sku && product.sku !== '0' && (
              <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full font-medium w-fit">
                <span className="font-semibold">الكود: {product.sku}</span>
              </div>
            )}

            {/* Price Section - Only show if prices visible */}
            {!hidePrices && (
              <div className="space-y-2">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-black text-primary drop-shadow-sm">{product.price.toLocaleString()}</span>
                  <span className="text-sm text-slate-600 font-semibold">ج.م</span>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <span className="text-sm text-slate-400 line-through">{product.originalPrice.toLocaleString()}</span>
                  )}
                </div>
              </div>
            )}

            {/* Full Width Cart Button - Matching Category Page */}
            <Button
              onClick={(e) => {
                e.stopPropagation();
                if (hidePrices) {
                  setShowWhatsAppModal(true);
                } else {
                  handleAddToCart(e);
                }
              }}
              className={`w-full rounded-lg h-9 text-xs font-bold transition-all duration-500 group/btn relative overflow-hidden shadow-md hover:shadow-lg mt-auto ${
                hidePrices
                  ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                  : inCart
                    ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                    : 'bg-gradient-to-r from-blue-600 to-fuchsia-600 hover:from-blue-700 hover:to-fuchsia-700 text-white'
              }`}
            >
              {hidePrices ? (
                /* When prices hidden - WhatsApp contact */
                <>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                    <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                    <span>لمعرفة السعر</span>
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                    <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                    <span>اضغط هنا</span>
                  </span>
                </>
              ) : isAddingToCart ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  جاري الإضافة...
                </>
              ) : inCart ? (
                /* In Cart - Show checkmark with hover animation */
                <>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                    <Check className="w-4 h-4" />
                    <span>في السلة ✓</span>
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                    <Plus className="w-4 h-4" />
                    <span>إضافة المزيد</span>
                  </span>
                </>
              ) : (
                <>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                    <ShoppingCart className="w-4 h-4" />
                    <span>أضف للسلة</span>
                  </span>
                  <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                    <ShoppingCart className="w-4 h-4" />
                    <span>إضافة إلى السلة 🛒</span>
                  </span>
                </>
              )}
            </Button>

            {/* Action buttons moved to image overlay for better UX */}
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="cart"
      />

      {/* WhatsApp Contact Modal */}
      <WhatsAppContactModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        productName={product.nameAr || product.name || ''}
        productId={product.id || ''}
        productCode={product.sku}
        productImage={product.image}
      />
    </>
  );
};

export default ProductCard;