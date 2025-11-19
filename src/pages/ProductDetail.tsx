import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  ArrowLeft, 
  Star, 
  ShoppingCart, 
  Plus, 
  Minus, 
  Heart, 
  Truck, 
  Shield, 
  RotateCw,
  Ruler,
  Scale,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight,
  Package,
  CreditCard,
  Share2,
  Tag,
  MapPin,
  Phone,
  Mail,
  Clock,
  Zap,
  Award,
  Gift,
  CheckCircle,
  X,
  MessageCircle,
  Send,
  Check,
  ShoppingBag,
  Eye
} from 'lucide-react';
import { Product } from '@/types';
import { apiGet, type ApiResponse } from '@/lib/api';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import ProductCard from '@/components/product/ProductCard';
import Rating from '@/components/product/Rating';
import CommentsModal from '@/components/product/CommentsModal';
import { WhatsAppContactModal } from '@/components/product/WhatsAppContactModal';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LoadingButton } from '@/components/ui/loading';
import FavoriteButton from '@/components/ui/FavoriteButton';
import AuthModal from '@/components/ui/auth-modal';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { cn } from '@/lib/utils';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import { useSettings } from '@/hooks/useSettings';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useDualAuth } from '@/hooks/useDualAuth';

type ApiProduct = {
  id: string;
  _id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  categorySlug?: string;
  price: number;
  originalPrice?: number;
  description?: string;
  descriptionAr?: string;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  rating?: number;
  reviews?: number;
  discount?: number;
  isHidden?: boolean;
  inStock?: boolean;
  category: string;
  categoryAr?: string;
  tags: string[];
};

// Add this type for rating history
type RatingHistory = {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  review?: string;
  date: string;
};

type ApiCategory = {
  _id: string;
  name: string;
  nameAr?: string;
  slug: string;
  image?: string;
};

// Helper function to format date
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

// Add this new component for image gallery modal
const ImageGalleryModal = ({ 
  images, 
  currentIndex, 
  onClose, 
  onNext, 
  onPrev 
}: {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNext: () => void;
  onPrev: () => void;
}) => {
  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-lg z-[100] flex items-center justify-center p-4">
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
      >
        <X className="w-6 h-6 text-white" />
      </button>
      
      <button 
        onClick={onPrev}
        className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
      >
        <ChevronLeftIcon className="w-6 h-6 text-white" />
      </button>
      
      <button 
        onClick={onNext}
        className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/20 rounded-full hover:bg-white/30 transition-colors"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>
      
      <div className="relative max-w-4xl max-h-[90vh] w-full">
        <img
          src={images[currentIndex]}
          alt={`Product image ${currentIndex + 1}`}
          className="w-full h-auto max-h-[90vh] object-contain"
        />
        
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {images.map((_, index) => (
            <div 
              key={index}
              className={cn(
                "w-3 h-3 rounded-full transition-all",
                index === currentIndex ? "bg-white w-6" : "bg-white/50"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

// Mobile Product Detail Component
const MobileProductDetail = ({ 
  product, 
  relatedProducts, 
  ratingHistory,
  selectedImage, 
  setSelectedImage, 
  quantity, 
  setQuantity, 
  addingToCart, 
  handleAddToCart, 
  inCart,
  setShowAuthModal,
  sendMessageToMessenger,
  sendMessageToWhatsApp,
  showCommentsModal,
  setShowCommentsModal,
  social,
  hidePrices
}: {
  product: ApiProduct;
  relatedProducts: ApiProduct[];
  ratingHistory: RatingHistory[];
  selectedImage: number;
  setSelectedImage: (index: number) => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  addingToCart: boolean;
  handleAddToCart: () => void;
  inCart: boolean;
  setShowAuthModal: (show: boolean) => void;
  sendMessageToMessenger: () => void;
  sendMessageToWhatsApp: () => void;
  showCommentsModal: boolean;
  setShowCommentsModal: (show: boolean) => void;
  social: any;
  hidePrices: boolean;
}) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'reviews'>('details');
  const [showGallery, setShowGallery] = useState(false);
  
  const discountPercentage = product.discount || (product.originalPrice && product.originalPrice > product.price)
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  const handleImageClick = () => {
    setShowGallery(true);
  };

  const closeGallery = () => {
    setShowGallery(false);
  };

  const nextGalleryImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevGalleryImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-primary/5 pb-24">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="icon" className="rounded-full" asChild>
            <Link to={product.categorySlug ? `/category/${product.categorySlug}` : "/products"}>
              <ArrowLeft className="w-6 h-6" />
            </Link>
          </Button>
          
          <h1 className="text-lg font-bold text-slate-900 truncate max-w-[60%]">
            {product.nameAr}
          </h1>
          
          <div className="flex items-center gap-2">
            <FavoriteButton
              productId={product._id}
              size="sm"
              className="w-10 h-10 rounded-full bg-white border border-slate-200 hover:border-indigo-300 shadow-sm"
            />
            <Button variant="ghost" size="icon" className="rounded-full w-10 h-10">
              <Share2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Breadcrumb for mobile */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-xs py-3">
            <Link to="/" className="text-primary hover:text-primary transition-colors font-medium">
              الرئيسية
            </Link>
            <ChevronLeftIcon className="w-3 h-3 text-slate-400" />
            <Link to={product.categorySlug ? `/category/${product.categorySlug}` : '/products'} className="text-primary hover:text-primary transition-colors font-medium">
              {product.categoryAr || 'المنتجات'}
            </Link>
            <ChevronLeftIcon className="w-3 h-3 text-slate-400" />
            <span className="text-slate-900 font-semibold truncate max-w-[100px]">{product.nameAr}</span>
          </nav>
        </div>
      </div>

      {/* Image Gallery */}
      <div className="relative aspect-square overflow-hidden bg-white" onClick={handleImageClick}>
        <div 
          className="flex transition-transform duration-300 ease-in-out h-full cursor-pointer"
          style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
        >
          {product.images.map((image, index) => (
            <div key={index} className="w-full flex-shrink-0 h-full">
              <img
                src={optimizeImage(image, { w: 800 })}
                alt={`${product.nameAr} - ${index + 1}`}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          ))}
        </div>
        
        {/* Navigation Arrows */}
        {product.images.length > 1 && (
          <>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white"
              onClick={prevImage}
            >
              <ChevronLeftIcon className="w-6 h-6" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 backdrop-blur-sm rounded-full shadow-lg hover:bg-white"
              onClick={nextImage}
            >
              <ChevronRight className="w-6 h-6" />
            </Button>
          </>
        )}
        
        {/* Image Indicators */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
          {product.images.map((_, index) => (
            <div 
              key={index}
              className={cn(
                "w-2 h-2 rounded-full transition-all",
                index === currentImageIndex ? "bg-white w-6" : "bg-white/50"
              )}
            />
          ))}
        </div>
      </div>

      {/* Product Info - Completely redesigned layout */}
      <div className="px-4 py-6 space-y-6">
        {/* Category, SKU, and Product Name - Modified to put category alone on the far left and code on the far right */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            {/* Category alone on the far left */}
            <Badge className="bg-gradient-to-r from-primary to-secondary text-white px-3 py-1 text-xs font-medium">
              {product.categoryAr}
            </Badge>
            {/* SKU on the far right */}
            {product.sku && (
              <div className="flex items-center gap-1 mr-0 ml-auto">
                <span className="text-xs text-slate-600">رمز المنتج:</span>
                <div className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full font-mono">
                  {product.sku}
                </div>
              </div>
            )}
          </div>
          {/* Product name on its own line */}
          <h1 className="text-2xl font-bold text-slate-900 leading-tight">
            {product.nameAr}
          </h1>
        </div>

        {/* Rating and Reviews - Fixed to not show fake records */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {[...Array(5)].map((_, i) => (
              <Star
                key={i}
                className={cn(
                  "w-5 h-5",
                  i < Math.floor(product.rating || 0)
                    ? "text-amber-500 fill-amber-500"
                    : "text-slate-300"
                )}
              />
            ))}
          </div>
          <Button 
            variant="ghost" 
            className="text-base text-slate-600 p-0 h-auto"
            onClick={() => setShowCommentsModal(true)}
          >
            ({product.reviews || 0})
          </Button>
        </div>

        {/* Price and Discount */}
        {hidePrices ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-slate-500">
              السعر مخفي
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-primary">
              {product.price.toLocaleString()} ج.م
            </span>
            {product.originalPrice && product.originalPrice > product.price && (
              <span className="text-lg text-slate-500 line-through">
                {product.originalPrice.toLocaleString()} ج.م
              </span>
            )}
            {discountPercentage > 0 && (
              <Badge className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-2 py-1 text-sm font-bold">
                -{discountPercentage}%
              </Badge>
            )}
          </div>
        )}

        {/* Action Hub - Completely redesigned for better integration */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          
          {/* Communication Button - WhatsApp Only */}
          {social?.whatsappUrl && (
            <div className="p-4">
              <Button
                onClick={sendMessageToWhatsApp}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all font-medium"
              >
                <Send className="w-5 h-5" />
                <span>لمعرفة السعر </span>
              </Button>
            </div>
          )}
        </div>

        {/* Price and Quantity - Only show if prices are visible */}
        {!hidePrices && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
            {/* Price Summary */}
            <div className="p-4 border-b border-slate-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-600">السعر</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-primary">
                    {product.price.toLocaleString()} ج.م
                  </div>
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="text-sm text-slate-500 line-through">
                      {product.originalPrice.toLocaleString()} ج.م
                    </div>
                  )}
                </div>
              </div>
              
              {product.originalPrice && product.originalPrice > product.price && (
                <div className="flex items-center justify-between bg-green-50 p-2 rounded-lg">
                  <span className="text-sm font-medium text-green-700">توفير</span>
                  <span className="text-sm font-bold text-green-700">
                    {(product.originalPrice - product.price).toLocaleString()} ج.م
                  </span>
                </div>
              )}
            </div>
            
            {/* Quantity Selector and Add to Cart Button */}
            <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-base font-semibold text-slate-900">الكمية</span>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center border-2 border-slate-300 rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="w-4 h-4" />
                </Button>
                <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="w-10 h-10"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <Button
                onClick={handleAddToCart}
                disabled={addingToCart}
                className={cn(
                  "flex-1 py-3 rounded-lg font-bold text-base",
                  inCart 
                    ? "bg-green-500 hover:bg-green-600" 
                    : "bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
                )}
              >
                {addingToCart ? (
                  <div className="flex items-center justify-center">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                    جاري الإضافة...
                  </div>
                ) : inCart ? (
                  <>
                    <CheckCircle className="w-5 h-5 ml-2" />
                    في السلة
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-5 h-5 ml-2" />
                    أضف للسلة
                  </>
                )}
              </Button>
            </div>
          </div>
          </div>
        )}

        {/* Tabs - Keeping the existing tabs for التفاصيل والتقييمات */}
        <div className="flex border-b border-slate-200">
          <button
            className={cn(
              "flex-1 py-3 text-center font-medium",
              activeTab === 'details' 
                ? "text-primary border-b-2 border-primary" 
                : "text-slate-500"
            )}
            onClick={() => setActiveTab('details')}
          >
            التفاصيل
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-center font-medium",
              activeTab === 'specs' 
                ? "text-primary border-b-2 border-primary" 
                : "text-slate-500"
            )}
            onClick={() => setActiveTab('specs')}
          >
            المواصفات
          </button>
          <button
            className={cn(
              "flex-1 py-3 text-center font-medium",
              activeTab === 'reviews' 
                ? "text-primary border-b-2 border-primary" 
                : "text-slate-500"
            )}
            onClick={() => setActiveTab('reviews')}
          >
            التقييمات
          </button>
        </div>

        {/* Tab Content - Keeping the existing content for التفاصيل والمواصفات والتقييمات */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          {activeTab === 'details' && (
            <div>
              <h3 className="font-bold text-slate-900 mb-2">وصف المنتج</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                {showFullDescription 
                  ? (product.descriptionAr || product.description) 
                  : (product.descriptionAr || product.description)?.slice(0, 150) + '...'}
              </p>
              {(product.descriptionAr || product.description)?.length > 150 && (
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="p-0 h-auto text-primary font-medium mt-2"
                  onClick={() => setShowFullDescription(!showFullDescription)}
                >
                  {showFullDescription ? 'عرض أقل' : 'عرض المزيد'}
                </Button>
              )}
            </div>
          )}
          
          {activeTab === 'specs' && (
            <div className="space-y-4">
              <h3 className="font-bold text-slate-900 mb-3">تفاصيل المنتج</h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between py-2 border-b border-slate-100">
                  <span className="text-slate-600">رقم المنتج:</span>
                  <span className="font-medium">{product.sku || 'N/A'}</span>
                </div>
                
                {product.weight && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">الوزن:</span>
                    <span className="font-medium">{product.weight} كجم</span>
                  </div>
                )}
                
                {product.dimensions && (
                  <div className="flex items-center justify-between py-2 border-b border-slate-100">
                    <span className="text-slate-600">الأبعاد:</span>
                    <span className="font-medium">
                      {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} سم
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
          
          {activeTab === 'reviews' && (
            <div>
              <h3 className="font-bold text-slate-900 mb-4">تقييم العملاء</h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="text-center">
                  <div className="text-3xl font-bold text-slate-900">{product.rating || 4.5}</div>
                  <div className="flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          "w-4 h-4",
                          i < Math.floor(product.rating || 4.5)
                            ? "text-amber-500 fill-amber-500"
                            : "text-slate-300"
                        )}
                      />
                    ))}
                  </div>
                  <div className="text-sm text-slate-600 mt-1">
                    {product.reviews || 150} تقييم
                  </div>
                </div>
                <div className="flex-1">
                  {[5, 4, 3, 2, 1].map((star) => (
                    <div key={star} className="flex items-center gap-2 mb-1">
                      <div className="flex items-center gap-1 w-10">
                        <span className="text-sm">{star}</span>
                        <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                      </div>
                      <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-amber-500 rounded-full"
                          style={{ width: `${star === 5 ? 70 : star === 4 ? 20 : star === 3 ? 7 : star === 2 ? 2 : 1}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Rating History button */}
              <div className="border-t border-slate-200 pt-6 mb-6">
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => setShowCommentsModal(true)}
                >
                  عرض جميع التقييمات
                </Button>
              </div>
              
              <div className="border-t border-slate-200 pt-6">
                <Rating 
                  productId={product._id} 
                  onRatingSubmit={(rating, review) => {
                    // In a real implementation, you would update the product rating

                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Divider with decorative element */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-slate-200"></div>
        </div>
        <div className="relative flex justify-center">
          <span className="bg-gradient-to-br from-slate-50 to-primary/5 px-4 text-lg font-bold text-slate-900">منتجات ذات صلة</span>
        </div>
      </div>
      
      {/* Related Products */}
      {relatedProducts.length > 0 && (
        <div className="px-4 py-6">
          <div className="grid grid-cols-2 gap-4">
            {relatedProducts.map((relatedProduct) => {
              const productForCard: Product = {
                id: relatedProduct.id,
                name: relatedProduct.name,
                nameAr: relatedProduct.nameAr,
                description: relatedProduct.description,
                descriptionAr: relatedProduct.descriptionAr,
                price: relatedProduct.price,
                originalPrice: relatedProduct.originalPrice,
                image: relatedProduct.image || '',
                images: relatedProduct.images || [],
                category: relatedProduct.category,
                categoryAr: relatedProduct.categoryAr || '',
                stock: relatedProduct.stock,
                isHidden: relatedProduct.isHidden,
                featured: relatedProduct.featured,
                discount: relatedProduct.discount,
                rating: relatedProduct.rating,
                reviews: relatedProduct.reviews,
                tags: relatedProduct.tags,
                sku: relatedProduct.sku || '',
                weight: relatedProduct.weight,
                dimensions: relatedProduct.dimensions,
                createdAt: relatedProduct.createdAt,
                updatedAt: relatedProduct.updatedAt
              };
              
              return (
                <div key={relatedProduct.id} className="w-full">
                  <ProductCard product={productForCard} showQuickView={false} showFavorite={false} />
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// Desktop Product Detail Component
const DesktopProductDetail = ({ 
  product, 
  relatedProducts, 
  ratingHistory,
  selectedImage, 
  setSelectedImage, 
  quantity, 
  setQuantity, 
  addingToCart, 
  handleAddToCart, 
  inCart,
  setShowAuthModal,
  sendMessageToMessenger,
  sendMessageToWhatsApp,
  showCommentsModal,
  setShowCommentsModal,
  social,
  hidePrices
}: {
  product: ApiProduct;
  relatedProducts: ApiProduct[];
  ratingHistory: RatingHistory[];
  selectedImage: number;
  setSelectedImage: (index: number) => void;
  quantity: number;
  setQuantity: (qty: number) => void;
  addingToCart: boolean;
  handleAddToCart: () => void;
  inCart: boolean;
  setShowAuthModal: (show: boolean) => void;
  sendMessageToMessenger: () => void;
  sendMessageToWhatsApp: () => void;
  showCommentsModal: boolean;
  setShowCommentsModal: (show: boolean) => void;
  social: any;
  hidePrices: boolean;
}) => {
  const [activeTab, setActiveTab] = useState<'details' | 'specs' | 'reviews'>('details');
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [showGallery, setShowGallery] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  
  const discountPercentage = product.discount || (product.originalPrice && product.originalPrice > product.price)
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleImageClick = () => {
    setCurrentImageIndex(selectedImage);
    setShowGallery(true);
  };

  const closeGallery = () => {
    setShowGallery(false);
  };

  const nextGalleryImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % product.images.length);
  };

  const prevGalleryImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + product.images.length) % product.images.length);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5">
      {/* Image Gallery Modal */}
      {showGallery && (
        <ImageGalleryModal
          images={product.images}
          currentIndex={currentImageIndex}
          onClose={closeGallery}
          onNext={nextGalleryImage}
          onPrev={prevGalleryImage}
        />
      )}
      
      {/* Header */}
      {/* Breadcrumb */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <nav className="flex items-center gap-2 text-sm py-4">
            <Link to="/" className="text-primary hover:text-primary transition-colors font-medium">
              الرئيسية
            </Link>
            <ChevronLeftIcon className="w-4 h-4 text-slate-400" />
            <Link to={product.categorySlug ? `/category/${product.categorySlug}` : '/products'} className="text-primary hover:text-primary transition-colors font-medium">
              {product.categoryAr || 'المنتجات'}
            </Link>
            <ChevronLeftIcon className="w-4 h-4 text-slate-400" />
            <span className="text-slate-900 font-semibold truncate max-w-xs">{product.nameAr}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Product Images */}
          <div className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-xl bg-white shadow border border-slate-200 cursor-pointer" onClick={handleImageClick}>
              <img
                src={optimizeImage(product.images[selectedImage], { w: 800 })}
                alt={product.nameAr}
                className="w-full h-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
            
            <div className="grid grid-cols-4 gap-2">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  onClick={() => setSelectedImage(index)}
                  className={cn(
                    "aspect-square overflow-hidden rounded border-2 transition-all",
                    selectedImage === index
                      ? "border-primary ring-2 ring-primary/30" 
                      : "border-slate-200 hover:border-primary/30"
                  )}
                >
                  <img
                    src={optimizeImage(image, { w: 200 })}
                    alt={`${product.nameAr} - ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Product Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {/* Category alone on the far left */}
                <Badge className="bg-gradient-to-r from-primary to-secondary text-white px-2 py-1 text-xs font-medium">
                  {product.categoryAr}
                </Badge>
                {product.featured && (
                  <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2 py-1 text-xs font-medium">
                    مميز
                  </Badge>
                )}
                {discountPercentage > 0 && (
                  <Badge className="bg-gradient-to-r from-red-500 to-pink-600 text-white px-2 py-1 text-xs font-medium animate-pulse">
                    -{discountPercentage}%
                  </Badge>
                )}
                {/* SKU on the far right */}
                {product.sku && (
                  <div className="flex items-center gap-1 mr-0 ml-auto">
                    <span className="text-xs text-slate-600">رمز المنتج:</span>
                    <div className="bg-slate-100 text-slate-800 text-xs px-2 py-1 rounded-full font-mono">
                      {product.sku}
                    </div>
                  </div>
                )}
              </div>

              {/* Product name on its own line */}
              <h1 className="text-2xl font-bold text-slate-900 leading-tight">
                {product.nameAr}
              </h1>

              {/* Rating and Reviews - Fixed to not show fake records */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        "w-4 h-4",
                        i < Math.floor(product.rating || 0)
                          ? "text-amber-500 fill-amber-500"
                          : "text-slate-300"
                      )}
                    />
                  ))}
                </div>
                <span className="text-sm font-bold text-slate-900">
                  {product.rating || 0}
                </span>
                <Button 
                  variant="ghost" 
                  className="text-slate-600 p-0 h-auto text-xs"
                  onClick={() => setShowCommentsModal(true)}
                >
                  ({product.reviews || 0} تقييم)
                </Button>
              </div>
            </div>

            {/* Communication Button - WhatsApp Only */}
            {social?.whatsappUrl && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
                <Button
                  onClick={sendMessageToWhatsApp}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-all font-medium"
                >
                  <Send className="w-5 h-5" />
                  <span>لمعرفة السعر </span>
                </Button>
              </div>
            )}

            {/* Price and Quantity - Only show if prices are visible */}
            {!hidePrices && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
                {/* Price Summary */}
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-base text-slate-600">السعر</span>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-primary">
                        {product.price.toLocaleString()} ج.م
                      </div>
                      {product.originalPrice && product.originalPrice > product.price && (
                        <div className="text-base text-slate-500 line-through">
                          {product.originalPrice.toLocaleString()} ج.م
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {product.originalPrice && product.originalPrice > product.price && (
                    <div className="flex items-center justify-between bg-green-50 p-2 rounded-lg">
                      <span className="text-sm font-medium text-green-700">توفير</span>
                      <span className="text-sm font-bold text-green-700">
                        {(product.originalPrice - product.price).toLocaleString()} ج.م
                      </span>
                    </div>
                  )}
                </div>
              
              {/* Quantity Selector and Add to Cart Button */}
              <div className="p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-base font-semibold text-slate-900">الكمية</span>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className="flex items-center border-2 border-slate-300 rounded-lg overflow-hidden">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="w-4 h-4" />
                    </Button>
                    <span className="w-12 text-center font-bold text-lg">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-10 h-10"
                      onClick={() => setQuantity(quantity + 1)}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <Button
                    onClick={handleAddToCart}
                    disabled={addingToCart}
                    className={cn(
                      "flex-1 py-3 rounded-lg font-bold text-base",
                      inCart 
                        ? "bg-green-500 hover:bg-green-600" 
                        : "bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary"
                    )}
                  >
                    {addingToCart ? (
                      <div className="flex items-center justify-center">
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        جاري الإضافة...
                      </div>
                    ) : inCart ? (
                      <>
                        <CheckCircle className="w-5 h-5 ml-2" />
                        في السلة
                      </>
                    ) : (
                      <>
                        <ShoppingCart className="w-5 h-5 ml-2" />
                        أضف للسلة
                      </>
                    )}
                  </Button>
                </div>
              </div>
              </div>
            )}

            {/* Tabs - Keeping the existing tabs for التفاصيل والتقييمات */}
            <div className="flex border-b border-slate-200">
              <button
                className={cn(
                  "flex-1 py-3 text-center font-medium",
                  activeTab === 'details' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-slate-500"
                )}
                onClick={() => setActiveTab('details')}
              >
                التفاصيل
              </button>
              <button
                className={cn(
                  "flex-1 py-3 text-center font-medium",
                  activeTab === 'specs' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-slate-500"
                )}
                onClick={() => setActiveTab('specs')}
              >
                المواصفات
              </button>
              <button
                className={cn(
                  "flex-1 py-3 text-center font-medium",
                  activeTab === 'reviews' 
                    ? "text-primary border-b-2 border-primary" 
                    : "text-slate-500"
                )}
                onClick={() => setActiveTab('reviews')}
              >
                التقييمات
              </button>
            </div>

            {/* Tab Content - Keeping the existing content for التفاصيل والمواصفات والتقييمات */}
            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              {activeTab === 'details' && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-2">وصف المنتج</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {showFullDescription 
                      ? (product.descriptionAr || product.description) 
                      : (product.descriptionAr || product.description)?.slice(0, 150) + '...'}
                  </p>
                  {(product.descriptionAr || product.description)?.length > 150 && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="p-0 h-auto text-primary font-medium mt-2"
                      onClick={() => setShowFullDescription(!showFullDescription)}
                    >
                      {showFullDescription ? 'عرض أقل' : 'عرض المزيد'}
                    </Button>
                  )}
                </div>
              )}
              
              {activeTab === 'specs' && (
                <div className="space-y-4">
                  <h3 className="font-bold text-slate-900 mb-3">تفاصيل المنتج</h3>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-600">رقم المنتج:</span>
                      <span className="font-medium">{product.sku || 'N/A'}</span>
                    </div>
                    
                    {product.weight && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600">الوزن:</span>
                        <span className="font-medium">{product.weight} كجم</span>
                      </div>
                    )}
                    
                    {product.dimensions && (
                      <div className="flex items-center justify-between py-2 border-b border-slate-100">
                        <span className="text-slate-600">الأبعاد:</span>
                        <span className="font-medium">
                          {product.dimensions.length} × {product.dimensions.width} × {product.dimensions.height} سم
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {activeTab === 'reviews' && (
                <div>
                  <h3 className="font-bold text-slate-900 mb-4">تقييم العملاء</h3>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-slate-900">{product.rating || 4.5}</div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn(
                              "w-4 h-4",
                              i < Math.floor(product.rating || 4.5)
                                ? "text-amber-500 fill-amber-500"
                                : "text-slate-300"
                            )}
                          />
                        ))}
                      </div>
                      <div className="text-sm text-slate-600 mt-1">
                        {product.reviews || 150} تقييم
                      </div>
                    </div>
                    <div className="flex-1">
                      {[5, 4, 3, 2, 1].map((star) => (
                        <div key={star} className="flex items-center gap-2 mb-1">
                          <div className="flex items-center gap-1 w-10">
                            <span className="text-sm">{star}</span>
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                          </div>
                          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${star === 5 ? 70 : star === 4 ? 20 : star === 3 ? 7 : star === 2 ? 2 : 1}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Rating History button */}
                  <div className="border-t border-slate-200 pt-6 mb-6">
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setShowCommentsModal(true)}
                    >
                      عرض جميع التقييمات
                    </Button>
                  </div>
                  
                  <div className="border-t border-slate-200 pt-6">
                    <Rating 
                      productId={product._id} 
                      onRatingSubmit={(rating, review) => {
                        // In a real implementation, you would update the product rating

                      }}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Divider with decorative element */}
        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gradient-to-br from-slate-50 to-primary/5 px-4 text-lg font-bold text-slate-900">منتجات ذات صلة</span>
          </div>
        </div>
        
        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <section className="mt-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {relatedProducts.map((relatedProduct) => {
                const productForCard: Product = {
                  id: relatedProduct.id,
                  name: relatedProduct.name,
                  nameAr: relatedProduct.nameAr || relatedProduct.name,
                  description: relatedProduct.description || '',
                  descriptionAr: relatedProduct.descriptionAr || relatedProduct.description || '',
                  price: relatedProduct.price,
                  originalPrice: relatedProduct.originalPrice,
                  image: relatedProduct.image || '',
                  images: relatedProduct.images || [],
                  category: relatedProduct.category,
                  categoryAr: relatedProduct.categoryAr || '',
                  stock: relatedProduct.stock,
                  isHidden: relatedProduct.isHidden,
                  featured: relatedProduct.featured,
                  discount: relatedProduct.discount,
                  rating: relatedProduct.rating,
                  reviews: relatedProduct.reviews,
                  tags: relatedProduct.tags,
                  sku: relatedProduct.sku || '',
                  weight: relatedProduct.weight,
                  dimensions: relatedProduct.dimensions,
                  createdAt: relatedProduct.createdAt,
                  updatedAt: relatedProduct.updatedAt
                };
                
                return (
                  <div key={relatedProduct.id} className="w-full">
                    <ProductCard product={productForCard} />
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { addItem, isInCart, getItemByProductId } = useCart();
  const { toast } = useToast();
  const { isMobile } = useDeviceDetection();
  const { social } = useSettings();
  const { isAuthenticated } = useDualAuth();
  const { hidePrices, contactMessage } = usePricingSettings();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  
  const [product, setProduct] = useState<ApiProduct | null>(null);
  const [related, setRelated] = useState<ApiProduct[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [addingToCart, setAddingToCart] = useState(false);
  const [ratingHistory, setRatingHistory] = useState<RatingHistory[]>([]);

  // Set dynamic page title with product name
  usePageTitle(product ? (product.nameAr || product.name) : 'تفاصيل المنتج');

  // Fetch product and related items from backend
  useEffect(() => {
    let isMounted = true;
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        
        // Try to get product from location state first (passed from product list)
        let item: ApiProduct | undefined = (location.state as any)?.product;
        
        // If not in state, fetch from API
        if (!item) {
          const res = await apiGet<ApiProduct>(`/api/products/${id}`);
          item = (res as Extract<ApiResponse<ApiProduct>, { ok: true }>).item as ApiProduct | undefined;
        }
        
        if (!item) throw new Error('Product not found');

        // Fetch categories to resolve Arabic name and fetch related products by category slug
        const [catsRes, relRes] = await Promise.all([
          apiGet<ApiCategory>('/api/categories'),
          apiGet<ApiProduct>(item.categorySlug ? `/api/products?categorySlug=${encodeURIComponent(item.categorySlug)}` : '/api/products'),
        ]);
        const catItems = (catsRes as Extract<ApiResponse<ApiCategory>, { ok: true }>).items ?? [];
        const catBySlug = new Map(catItems.map((c) => [c.slug, c]));

        const mapped: ApiProduct = {
          ...item,
          id: item._id,
          name: item.name,
          nameAr: item.nameAr ?? item.name,
          description: item.description ?? '',
          descriptionAr: item.descriptionAr ?? item.description ?? '',
          category: item.categorySlug ?? '',
          categoryAr: catBySlug.get(item.categorySlug ?? '')?.nameAr ?? (item.categorySlug ?? ''),
          rating: item.rating || 0,
          reviews: item.reviews || 0,
          discount: item.discount || 0,
          isHidden: item.active === false,
          inStock: item.inStock ?? (item.stock !== undefined ? item.stock > 0 : true),
          tags: item.tags || []
        };

        const relItems = (relRes as Extract<ApiResponse<ApiProduct>, { ok: true }>).items ?? [];
        const relatedProducts: ApiProduct[] = relItems
          .filter((p) => p._id !== item._id && p.active !== false)
          .map((p) => ({
            ...p,
            id: p._id,
            name: p.name,
            nameAr: p.nameAr ?? p.name,
            description: p.description ?? '',
            descriptionAr: p.descriptionAr ?? p.description ?? '',
            category: p.categorySlug ?? '',
            categoryAr: catBySlug.get(p.categorySlug ?? '')?.nameAr ?? (p.categorySlug ?? ''),
            rating: p.rating || 0,
            reviews: p.reviews || 0,
            discount: p.discount || 0,
            isHidden: p.active === false,
            inStock: p.inStock ?? (p.stock !== undefined ? p.stock > 0 : true),
            tags: p.tags || []
          }))
          .slice(0, 4);

        // Fetch real rating history from backend
        let realRatingHistory: RatingHistory[] = [];
        try {

          const ratingsRes = await apiGet<RatingHistory>(`/api/products/${item._id}/ratings`);

          
          // Check if the response has items
          if ('items' in ratingsRes && ratingsRes.ok) {
            const ratingsItems = ratingsRes.items ?? [];

            
            realRatingHistory = ratingsItems.map(rating => ({
              ...rating,
              // Ensure date is in the correct format
              date: new Date(rating.date).toISOString()
            }));
            

          } else {

          }
        } catch (ratingError) {
          console.warn('Failed to fetch ratings from backend:', ratingError);
          // We'll use empty array instead of fallback data to make it clear there are no ratings

        }

        if (isMounted) {
          setProduct(mapped);
          setRelated(relatedProducts);
          setRatingHistory(realRatingHistory);
          setSelectedImage(0);
        }
      } catch (e) {
        console.error('Failed to fetch product:', e);
        if (isMounted) setProduct(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    })();
    return () => { isMounted = false; };
  }, [id]);

  // Derived related products from fetched list
  const relatedProducts = related
    .filter(p => product ? p.categorySlug === product.categorySlug && p._id !== product._id && !p.isHidden : true)
    .slice(0, 4);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="space-y-6">
              {/* Skeleton Image */}
              <div className="aspect-square bg-white rounded-3xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="w-full h-full bg-muted animate-pulse" />
              </div>
              {/* Skeleton Thumbnails */}
              <div className="grid grid-cols-4 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
                ))}
              </div>
            </div>
            <div className="space-y-6">
              {/* Skeleton Category Badge */}
              <div className="flex items-center gap-3">
                <div className="h-8 bg-muted rounded-lg w-24 animate-pulse" />
                <div className="h-8 bg-muted rounded-lg w-16 animate-pulse" />
              </div>
              {/* Skeleton Title */}
              <div className="h-12 bg-muted rounded-lg w-3/4 animate-pulse" />
              {/* Skeleton Rating */}
              <div className="h-16 bg-muted rounded-xl animate-pulse" />
              {/* Skeleton Price */}
              <div className="h-14 bg-muted rounded-xl animate-pulse" />
              {/* Skeleton Description */}
              <div className="h-24 bg-muted rounded-xl animate-pulse" />
              {/* Skeleton Details */}
              <div className="h-32 bg-muted rounded-xl animate-pulse" />
              {/* Skeleton Quantity and Actions */}
              <div className="h-24 bg-muted rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-4">المنتج غير موجود</h1>
          <p className="text-lg text-slate-600 mb-6">عذراً، لم نتمكن من العثور على المنتج المطلوب</p>
          <Button asChild>
            <Link to="/products">العودة للمنتجات</Link>
          </Button>
        </div>
      </div>
    );
  }

  const handleAddToCart = async () => {
    // If user is not authenticated, show auth modal instead of adding to cart
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    setAddingToCart(true);
    
    // Check if product is already in cart
    const wasInCart = isInCart(product._id);
    const currentItem = getItemByProductId(product._id);
    const previousQuantity = currentItem?.quantity || 0;
    
    // Convert ApiProduct to Product for addItem
    const productForCart: Product = {
      id: product.id,
      name: product.name,
      nameAr: product.nameAr,
      description: product.description,
      descriptionAr: product.descriptionAr,
      price: product.price,
      originalPrice: product.originalPrice,
      image: product.image || '',
      images: product.images || [],
      category: product.category,
      categoryAr: product.categoryAr || '',
      stock: product.stock,
      isHidden: product.isHidden,
      featured: product.featured,
      discount: product.discount,
      rating: product.rating,
      reviews: product.reviews,
      tags: product.tags,
      sku: product.sku || '',
      weight: product.weight,
      dimensions: product.dimensions,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
    
    const result = await addItem(productForCart, quantity);
    
    if (result.success) {
      const newQuantity = previousQuantity + quantity;
      
      // Show enhanced toast with product image and quantity info
      toast({
        title: wasInCart ? "تمت إضافة المزيد ✓" : "تمت الإضافة للسلة ✓",
        description: (
          <div className="space-y-3 mt-2" dir="rtl">
            {/* Product Info */}
            <div className="flex items-start gap-3">
              <img
                src={optimizeImage(product.image || '', { w: 80 })}
                alt={product.nameAr}
                className="w-20 h-20 object-cover rounded-lg shadow-md flex-shrink-0"
              />
              <div className="flex-1 text-right min-w-0">
                <p className="font-bold text-sm text-slate-900 line-clamp-2">{product.nameAr}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-sm font-semibold text-primary">{product.price.toLocaleString()} ج.م</p>
                  {product.category && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {product.categoryAr || product.category}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <p className="text-xs font-semibold text-green-600">
                    الكمية: {newQuantity} قطعة
                  </p>
                  <span className="text-xs text-slate-500">•</span>
                  <p className="text-xs font-semibold text-slate-700">
                    الإجمالي: {(product.price * newQuantity).toLocaleString()} ج.م
                  </p>
                </div>
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
    } else if (result.error) {
      toast({
        title: "خطأ",
        description: result.error,
        variant: "destructive"
      });
    }
    
    setAddingToCart(false);
  };

  const inCart = isInCart(product._id);

  // Create message functions that use settings
  const sendMessageToMessenger = () => {
    if (!product) return;
    const message = `أود الاستفسار عن المنتج: ${product.nameAr || product.name}\n${window.location.href}`;
    const encodedMessage = encodeURIComponent(message);
    
    // Use configured Messenger URL if available, otherwise use default
    if (social?.messengerUrl) {
      window.open(`${social.messengerUrl}?text=${encodedMessage}`, '_blank');
    } else {
      window.open(`https://m.me/?text=${encodedMessage}`, '_blank');
    }
  };

  const sendMessageToWhatsApp = () => {
    if (!product) return;
    setShowWhatsAppModal(true);
  };

  // Render mobile or desktop version based on device detection
  return (
    <>
      {isMobile ? (
        <MobileProductDetail
          product={product}
          relatedProducts={relatedProducts}
          ratingHistory={ratingHistory}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          quantity={quantity}
          setQuantity={setQuantity}
          addingToCart={addingToCart}
          handleAddToCart={handleAddToCart}
          inCart={inCart}
          setShowAuthModal={setShowAuthModal}
          sendMessageToMessenger={sendMessageToMessenger}
          sendMessageToWhatsApp={sendMessageToWhatsApp}
          showCommentsModal={showCommentsModal}
          setShowCommentsModal={setShowCommentsModal}
          social={social}
          hidePrices={hidePrices}
        />
      ) : (
        <DesktopProductDetail
          product={product}
          relatedProducts={relatedProducts}
          ratingHistory={ratingHistory}
          selectedImage={selectedImage}
          setSelectedImage={setSelectedImage}
          quantity={quantity}
          setQuantity={setQuantity}
          addingToCart={addingToCart}
          handleAddToCart={handleAddToCart}
          inCart={inCart}
          setShowAuthModal={setShowAuthModal}
          sendMessageToMessenger={sendMessageToMessenger}
          sendMessageToWhatsApp={sendMessageToWhatsApp}
          showCommentsModal={showCommentsModal}
          setShowCommentsModal={setShowCommentsModal}
          social={social}
          hidePrices={hidePrices}
        />
      )}
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="cart"
      />
      <CommentsModal
        isOpen={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        comments={ratingHistory}
        productId={product._id}
        productName={product.nameAr || product.name}
        onRatingSubmit={(rating, review) => {
          // In a real implementation, you would update the product rating

        }}
        averageRating={product.rating || 0}
        totalReviews={product.reviews || 0}
      />
      <WhatsAppContactModal
        isOpen={showWhatsAppModal}
        onClose={() => setShowWhatsAppModal(false)}
        productName={product?.nameAr || product?.name || ''}
        productId={product?._id || ''}
        productCode={(product as any)?.sku}
        productImage={product?.image}
      />
    </>
  );
};

export default ProductDetail;
