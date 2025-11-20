import { useState, useRef } from 'react';
import { optimizeImage } from '@/lib/images';
import { Link } from 'react-router-dom';
import { Star, Eye, ShoppingBag, ArrowRight, Check, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AuthModal from '@/components/ui/auth-modal';
import { WhatsAppContactModal } from '@/components/product/WhatsAppContactModal';
import whatsappIcon from '@/assets/whatsapp.png';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useFavorites } from '@/hooks/useFavorites';
import { useToast } from '@/hooks/use-toast';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import type { Product } from '@/types';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Pagination, Autoplay } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';

interface ProductsMobileProps {
  products: Product[];
  loading: boolean;
  redirectUrl?: string;
  hidePrices?: boolean;
}

const ProductsMobile = ({ products, loading, redirectUrl = '/products' }: Omit<ProductsMobileProps, 'hidePrices'>) => {
  const navigate = useNavigate();
  const { hidePrices } = usePricingSettings();
  const { addItem, isInCart: checkIsInCart, getItemByProductId } = useCart();
  const { isAuthenticated } = useDualAuth();
  const { showAuthModal: favoritesAuthModal, setShowAuthModal: setFavoritesAuthModal } = useFavorites();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<'cart' | 'favorites' | 'general'>('general');
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactProduct, setContactProduct] = useState<Product | null>(null);
  const { toast } = useToast();
  const swiperRef = useRef(null);

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

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`${i < Math.floor(rating) ? 'text-yellow-400 fill-current' : 'text-slate-300'}`}
        style={{ width: '8px', height: '8px' }}
      />
    ));
  };

  return (
    <>
      <div className="relative -mx-4 px-4">
        {loading ? (
          <Swiper
            modules={[Pagination, Autoplay]}
            spaceBetween={12}
            slidesPerView="auto"
            className="mobile-products-swiper"
          >
            {Array.from({ length: 3 }).map((_, i) => (
              <SwiperSlide key={i} className="!w-[160px] !bg-transparent" style={{ background: 'transparent !important' }}>
                <div className="rounded-lg overflow-hidden bg-white border border-slate-200 shadow-sm">
                  <div className="relative aspect-square overflow-hidden">
                    <div className="w-full h-full bg-slate-200 animate-pulse" />
                  </div>
                  <div className="p-2">
                    <div className="h-3 w-full bg-slate-200 animate-pulse rounded mb-1" />
                    <div className="h-3 w-2/3 bg-slate-100 animate-pulse rounded mb-2" />
                    <div className="h-8 w-full rounded-lg bg-slate-200 animate-pulse" />
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        ) : products.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-600">
            <span className="text-base font-semibold mb-2 text-slate-900">لا توجد منتجات</span>
            <p className="text-sm mb-4">تحقق لاحقاً</p>
            <Button asChild size="sm" className="bg-primary hover:bg-primary/90 text-white rounded-lg">
              <Link to={redirectUrl}>عرض الكل</Link>
            </Button>
          </div>
        ) : (
          <Swiper
            ref={swiperRef}
            modules={[Pagination, Autoplay]}
            spaceBetween={12}
            slidesPerView="auto"
            autoplay={{
              delay: 4000,
              disableOnInteraction: false,
              pauseOnMouseEnter: true,
            }}
            navigation={false}
            pagination={{
              clickable: true,
              dynamicBullets: true,
            }}
            breakpoints={{
              320: {
                slidesPerView: 2.2,
                spaceBetween: 12,
              },
              480: {
                slidesPerView: 2.5,
                spaceBetween: 12,
              },
              640: {
                slidesPerView: 3.5,
                spaceBetween: 16,
              },
            }}
            className="mobile-products-swiper pb-2"
            style={{
              '--swiper-theme-color': 'hsl(var(--primary))',
              '--swiper-pagination-color': 'hsl(var(--primary))',
            } as React.CSSProperties}
          >
            {carouselProducts.map((product, index) => (
              <SwiperSlide key={`${product.id}-${index}`} className="!w-[160px] !bg-transparent" style={{ background: 'transparent !important' }}>
                <div 
                  className="relative h-full rounded-lg overflow-hidden bg-white border border-slate-200 shadow-sm cursor-pointer active:scale-95 transition-transform"
                  onClick={() => navigate(`/product/${getCleanProductId(product.id)}`)}
                >
                  {/* Image */}
                  <div className="relative aspect-square overflow-hidden">
                    <img
                      src={optimizeImage(product.image || `/api/categories/${product.category}/image`, { w: 200 })}
                      alt={product.nameAr}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.onerror = null;
                        target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23f1f5f9" width="200" height="200"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%2394a3b8"%3Eلا توجد%3C/text%3E%3C/svg%3E';
                      }}
                    />
                    
                    {/* Category Badge - Top Right */}
                    <Link 
                      to={`/category/${product.category}`}
                      className="absolute top-1 right-1 text-[10px] font-semibold text-white bg-primary/90 backdrop-blur-sm px-2 py-1 rounded-md shadow-md z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {product.categoryAr || product.category}
                    </Link>

                    {/* Simple Theme Heart Favorite Button - Top Left */}
                    <div className="absolute top-1 left-1 z-10" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Handle favorite toggle here

                        }}
                        className="group/heart bg-white/95 backdrop-blur-sm rounded-full p-1.5 shadow-md border border-slate-100 hover:bg-white hover:shadow-lg transition-all duration-300 relative heart-button"
                      >
                        {/* Default Heart Outline */}
                        <div className="group-hover/heart:opacity-0 transition-opacity duration-300">
                          <svg className="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                          </svg>
                        </div>
                        
                        {/* Simple Theme Heart on Hover */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 scale-75 group-hover/heart:opacity-100 group-hover/heart:scale-100 transition-all duration-400 ease-out">
                          {/* Shadow */}
                          <svg 
                            className="w-4 h-4 text-primary/20 fill-current absolute"
                            style={{ 
                              transform: 'translate(1.5px, 1.5px)',
                              filter: 'blur(0.3px)'
                            }}
                            viewBox="0 0 24 24"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                          
                          {/* Main heart - theme colored */}
                          <svg 
                            className="w-4 h-4 text-primary fill-current relative"
                            style={{
                              filter: 'drop-shadow(0 0 4px currentColor)',
                              animation: 'heartPulse 2s ease-in-out infinite'
                            }}
                            viewBox="0 0 24 24"
                          >
                            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                          </svg>
                        </div>
                      </button>
                    </div>

                    {product.discount && (
                      <Badge className="absolute bottom-1 left-1 bg-destructive text-white font-bold px-1.5 py-0.5 text-[10px] shadow-md">
                        خصم {product.discount}%
                      </Badge>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-2 space-y-1">
                    <h3 className="font-bold text-xs text-slate-900 line-clamp-2 min-h-[2rem]">
                      {product.nameAr}
                    </h3>

                    {/* Price and Rating on same line */}
                    <div className="flex items-center justify-between gap-1">
                      <div className="flex items-baseline gap-0.5">
                        {!hidePrices && (
                          <>
                            <span className="text-sm font-black text-primary">{product.price ? product.price.toLocaleString() : 'N/A'}</span>
                            <span className="text-[9px] text-slate-600">ج.م</span>
                          </>
                        )}
                        {product.originalPrice && (
                          <span className="text-[9px] text-slate-400 line-through">{product.originalPrice ? product.originalPrice.toLocaleString() : 'N/A'}</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-1">
                        <Link 
                          to={`/product/${getCleanProductId(product.id)}#reviews`}
                          className="flex items-center gap-0.5"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {renderStars(product.rating || 0)}
                          <span className="text-[9px] text-slate-500">({product.reviews || 0})</span>
                        </Link>
                        {(product.sku || product.id) && (
                          <span className="text-[9px] font-semibold text-primary bg-primary/10 px-1.5 py-0.5 rounded-sm border border-primary/30" title={product.sku ? 'Product Code' : 'Product ID'}>
                            {product.sku || product.id.substring(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-1">
                      <Button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/product/${getCleanProductId(product.id)}`);
                        }}
                        size="sm"
                        className="h-8 w-8 p-0 rounded-lg bg-secondary hover:bg-secondary/90 text-white"
                      >
                        <Eye className="w-3 h-3" />
                      </Button>
                      {hidePrices ? (
                        <Button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setContactProduct(product);
                            setShowContactModal(true);
                          }}
                          size="sm"
                          className="flex-1 h-8 rounded-lg text-[10px] font-semibold transition-all duration-300 bg-primary hover:bg-primary/90 text-white"
                        >
                          <img src={whatsappIcon} alt="WhatsApp" className="w-3 h-3 ml-0.5" />
                          لمعرفة السعر
                        </Button>
                      ) : (
                        <Button
                          onClick={(e) => handleAddToCart(product, e)}
                          size="sm"
                          className={`flex-1 h-8 rounded-lg text-[10px] font-semibold transition-all duration-300 ${
                            checkIsInCart(product.id)
                              ? 'bg-green-500 hover:bg-green-600 text-white'
                              : 'bg-primary hover:bg-primary/90 text-white'
                          }`}
                        >
                          {checkIsInCart(product.id) ? (
                            <>
                              <Check className="w-3 h-3 ml-0.5" />
                              في السلة
                            </>
                          ) : (
                            <>
                              <ShoppingBag className="w-3 h-3 ml-0.5" />
                              السلة
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal || favoritesAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          setFavoritesAuthModal(false);
        }}
        action={favoritesAuthModal ? 'favorites' : authAction}
      />

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

export default ProductsMobile;
