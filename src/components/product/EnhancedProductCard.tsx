import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Star, ShoppingCart, Eye, Check, Plus } from 'lucide-react';
import whatsappIcon from '@/assets/whatsapp.png';
import { Product } from '@/types';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { Button } from '@/components/ui/button';
import { Image } from '@/components/ui/image';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { LoadingSpinner } from '@/components/ui/loading';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AuthModal from '@/components/ui/auth-modal';
import Rating from '@/components/product/Rating';
import { useToast } from '@/hooks/use-toast';
import { optimizeImage, buildSrcSet } from '@/lib/images';

interface ProductCardProps {
  product: Product;
  showQuickView?: boolean;
  showFavorite?: boolean;
  className?: string;
}

const EnhancedProductCard = ({ product, showQuickView = true, showFavorite = true, className = '' }: ProductCardProps) => {
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const { addItem, isInCart } = useCart();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { hidePrices, contactMessage } = usePricingSettings();
  const { toast } = useToast();

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

  const handleRatingClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowRatingModal(true);
  };

  const handleRatingSubmit = (rating: number, review?: string) => {
    console.log('Rating submitted:', { productId: product.id, rating, review });
    setShowRatingModal(false);
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`w-4 h-4 transition-all duration-300 cursor-pointer hover:scale-110 ${
          i < Math.floor(rating)
            ? 'text-amber-500 fill-amber-500'
            : 'text-slate-300 hover:text-amber-300'
        }`}
        onClick={handleRatingClick}
      />
    ));
  };

  const inCart = isInCart(product.id);
  const discountPercentage = product.originalPrice 
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  return (
    <>
      {/* Enhanced Modern Card Design */}
      <div 
        className={`relative group rounded-2xl overflow-hidden bg-white border border-slate-100 shadow-sm hover:shadow-2xl transition-all duration-700 transform hover:-translate-y-2 hover:rotate-1 ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div className="relative h-full">
          {/* Interactive Overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 flex items-end p-4 pointer-events-none z-10"></div>
          
          {/* Badges */}
          <div className="absolute top-3 right-3 z-20 flex flex-col gap-2">
            {discountPercentage > 0 && (
              <div className="bg-gradient-to-r from-red-500 to-red-600 text-white font-bold text-xs px-3 py-1.5 rounded-full shadow-lg flex items-center gap-1 animate-pulse transform rotate-12 hover:rotate-0 transition-transform duration-300">
                <span>-{discountPercentage}%</span>
              </div>
            )}
          </div>

          {/* Product Image with Enhanced Hover Effects */}
          <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
            {!imageLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <LoadingSpinner />
              </div>
            )}
            <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="block w-full h-full">
              <img
                src={optimizeImage(product.image, { w: 320 })}
                alt={product.nameAr}
                className={`w-full h-full object-cover transition-all duration-700 ${
                  imageLoaded ? 'opacity-100' : 'opacity-0'
                } ${isHovered ? 'scale-110 brightness-110' : 'scale-100'}`}
                onLoad={() => setImageLoaded(true)}
                loading="lazy"
                decoding="async"
                ref={(el) => { if (el) el.setAttribute('fetchpriority', 'low'); }}
                srcSet={buildSrcSet(product.image, 320)}
                sizes="(max-width: 640px) 50vw, 320px"
              />
            </Link>
            
            {/* Enhanced Visual overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-primary/10 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />

            {/* Top bar controls */}
            <div className="absolute top-0 left-0 right-0 p-4 flex justify-between items-start">
              {/* Category Badge */}
              <Badge variant="secondary" className="text-xs font-medium bg-white/90 text-primary border-primary/20 backdrop-blur-sm">
                {product.categoryAr}
              </Badge>

              {/* Enhanced Favorite Button with Heart Animation */}
              <div className="relative z-10 group/heart" onClick={(e) => e.stopPropagation()}>
                <div className="relative bg-white/90 backdrop-blur-sm rounded-full p-2 shadow-lg border border-slate-100 hover:bg-white transition-all duration-300 hover:scale-110">
                  {/* Animated Heart Background */}
                  <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary to-secondary opacity-0 group-hover/heart:opacity-100 transition-opacity duration-500 animate-pulse"></div>
                  
                  {/* Growing Heart Animation */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Heart className="w-6 h-6 text-primary fill-primary opacity-0 group-hover/heart:opacity-100 scale-0 group-hover/heart:scale-125 transition-all duration-500 animate-bounce" />
                  </div>
                  
                  <FavoriteButton
                    productId={product.id}
                    size="sm"
                    className="w-5 h-5 text-slate-700 hover:text-primary transition-colors duration-300 relative z-10"
                  />
                </div>
              </div>
            </div>

            {/* Bottom action buttons with Enhanced Animations */}
            <div className="absolute bottom-0 left-0 right-0 p-4 flex gap-3 transform translate-y-full group-hover:translate-y-0 transition-transform duration-500">
              {hidePrices ? (
                // When prices hidden: Show hover animation button
                <Button
                  onClick={handleContactWhatsApp}
                  size="sm"
                  className="w-full h-12 rounded-full text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-105 bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white border-2 border-white/20 group/btn"
                >
                  <span className="group-hover/btn:hidden transition-all duration-300">لمزيد من التفاصيل</span>
                  <span className="hidden group-hover/btn:inline transition-all duration-300 flex items-center gap-2">
                    <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                    لمعرفة السعر
                  </span>
                </Button>
              ) : (
                <>
                  {showQuickView && (
                    <div className="group/eye">
                      <Button 
                        size="icon" 
                        variant="outline" 
                        className="w-12 h-12 rounded-full bg-white/95 hover:bg-white border-2 border-slate-200 hover:border-primary/50 hover:ring-4 hover:ring-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-110" 
                        asChild
                      >
                        <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()} aria-label="عرض المنتج" className="w-full h-full flex items-center justify-center relative overflow-hidden">
                          {/* Eye Animation - Closed to Open */}
                          <EyeOff className="w-5 h-5 text-slate-600 absolute transition-all duration-300 group-hover/eye:opacity-0 group-hover/eye:scale-0" />
                          <Eye className="w-5 h-5 text-primary absolute opacity-0 scale-0 group-hover/eye:opacity-100 group-hover/eye:scale-100 transition-all duration-300" />
                        </Link>
                      </Button>
                    </div>
                  )}
                  <Button
                    onClick={handleAddToCart}
                    disabled={isAddingToCart}
                    size="sm"
                    className={`flex-1 h-12 rounded-full text-sm font-bold shadow-lg hover:shadow-xl transition-all duration-500 transform hover:scale-105 ${
                      inCart
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700'
                        : 'bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90'
                    } text-white border-2 border-white/20`}
                  >
                    {isAddingToCart ? (
                      <LoadingSpinner size="sm" />
                    ) : (
                      <ShoppingCart className="w-4 h-4 mr-2 transition-transform duration-300 group-hover:rotate-12" />
                    )}
                    <span className="transition-all duration-300">{inCart ? 'في السلة' : 'أضف للسلة'}</span>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Enhanced Content Section */}
          <div className="p-5 flex flex-col transition-all duration-500 group-hover:bg-gradient-to-br group-hover:from-slate-50 group-hover:to-white relative z-10 bg-white">
            {/* Product Title with Modern Separation Line */}
            <div className="mb-4">
              <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()}>
                <h3 className="font-bold text-slate-900 text-base sm:text-lg line-clamp-2 group-hover:text-primary transition-colors duration-500 leading-tight tracking-tight mb-3">
                  {product.nameAr}
                </h3>
              </Link>
              
              {/* Modern Animated Separation Line */}
              <div className="relative h-0.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
              </div>
            </div>
            
            {/* Interactive Rating Section */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 cursor-pointer" onClick={handleRatingClick}>
                <div className="flex items-center gap-1 hover:scale-105 transition-transform duration-300">
                  {renderStars(product.rating)}
                </div>
                <span className="text-xs text-slate-500 hover:text-primary transition-colors duration-300">
                  ({product.reviews}) تقييم
                </span>
              </div>
            </div>
            
            {/* Enhanced Price Section */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100 mt-auto">
              {hidePrices ? (
                <Button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const whatsappNumber = localStorage.getItem('WHATSAPP_URL') || '';
                    const message = `${contactMessage}\n\nالمنتج: ${product.nameAr}`;
                    const encodedMessage = encodeURIComponent(message);
                    if (whatsappNumber) {
                      window.open(`${whatsappNumber}?text=${encodedMessage}`, '_blank');
                    }
                  }}
                  size="sm"
                  className="flex-1 h-9 rounded-md text-xs font-medium bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg transition-all duration-300"
                >
                  <MessageCircle className="w-3.5 h-3.5 ml-1" />
                  اتصل للحصول على السعر
                </Button>
              ) : (
                <>
                  <div className="flex flex-col gap-1">
                    <span className="font-bold text-xl text-primary group-hover:text-secondary transition-colors duration-500">
                      {product.price.toLocaleString()} ج.م
                    </span>
                    {product.originalPrice && (
                      <span className="text-slate-400 text-sm line-through">
                        {product.originalPrice.toLocaleString()} ج.م
                      </span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-xs text-amber-600 bg-gradient-to-r from-amber-50 to-yellow-50 px-3 py-2 rounded-full font-bold flex-shrink-0 border border-amber-200 hover:from-amber-100 hover:to-yellow-100 transition-all duration-300">
                    <Star className="w-3 h-3 fill-current" />
                    <span>ممتاز</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Hover Glow Effect */}
        <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/10 via-transparent to-secondary/10 blur-xl"></div>
        </div>
      </div>

      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center mb-4">
              تقييم المنتج
            </DialogTitle>
            <div className="text-center mb-4">
              <img
                src={optimizeImage(product.image, { w: 100 })}
                alt={product.nameAr}
                className="w-16 h-16 object-cover rounded-lg mx-auto mb-2"
              />
              <h4 className="font-semibold text-slate-900">{product.nameAr}</h4>
            </div>
          </DialogHeader>
          <Rating
            productId={product.id}
            initialRating={0}
            onRatingSubmit={handleRatingSubmit}
          />
        </DialogContent>
      </Dialog>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="cart"
      />
    </>
  );
};

export default EnhancedProductCard;
