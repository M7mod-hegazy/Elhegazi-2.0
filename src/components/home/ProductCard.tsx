import React, { useState } from 'react';
import { Star, Heart, Eye, EyeOff, ShoppingBag, ArrowRight, Check, Plus } from 'lucide-react';
import whatsappIcon from '@/assets/whatsapp.png';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Rating from '@/components/product/Rating';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { optimizeImage, buildSrcSet } from '@/lib/images';

interface Product {
  id: string;
  name: string;
  nameAr: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviews: number;
  discount?: number;
  badge?: string;
}

interface ProductCardProps {
  product: Product;
  index: number;
  isActive: boolean;
  isHovered: boolean;
  onHover: (id: string | null) => void;
  isMobile: boolean;
}

const ProductCard: React.FC<ProductCardProps> = ({ 
  product, 
  index, 
  isActive, 
  isHovered, 
  onHover, 
  isMobile 
}) => {
  const { hidePrices } = usePricingSettings();
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(0);

  const handleRatingClick = (e: React.MouseEvent, rating?: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (rating) {
      setSelectedRating(rating);
    }
    setShowRatingModal(true);
  };

  const handleStarHover = (rating: number) => {
    setHoveredRating(rating);
  };

  const handleStarLeave = () => {
    setHoveredRating(0);
  };

  const handleRatingSubmit = (rating: number, review?: string) => {

    setShowRatingModal(false);
    setSelectedRating(0);
  };

  const handleModalClose = (open: boolean) => {
    setShowRatingModal(open);
    if (!open) {
      setSelectedRating(0);
    }
  };

  const handleContactWhatsApp = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // This will be handled by parent component or modal
    // For now, just prevent default
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => {
      const starIndex = i + 1;
      const isHoveredStar = hoveredRating >= starIndex;
      const isRated = i < Math.floor(rating);
      const shouldHighlight = hoveredRating > 0 ? isHoveredStar : isRated;
      
      return (
        <Star
          key={i}
          className={`w-4 h-4 transition-colors duration-200 cursor-pointer ${
            shouldHighlight
              ? 'text-yellow-400 fill-yellow-400'
              : 'text-white/30 hover:text-yellow-300'
          }`}
          onMouseEnter={() => handleStarHover(starIndex)}
          onMouseLeave={handleStarLeave}
          onClick={(e) => handleRatingClick(e, starIndex)}
        />
      );
    });
  };
  return (
    <div
      className={`bg-white/10 backdrop-blur-lg rounded-3xl p-4 border border-white/20 hover:bg-white/20 transition-all duration-700 transform group ${
        isActive 
          ? 'opacity-100 translate-y-0 scale-100 rotate-0' 
          : 'opacity-0 translate-y-12 scale-95 rotate-2'
      } ${isHovered ? 'scale-105 -translate-y-2' : ''}`}
      style={{ transitionDelay: isActive ? `${900 + index * 200}ms` : '0ms' }}
      onMouseEnter={() => onHover(product.id)}
      onMouseLeave={() => onHover(null)}
    >
      {isMobile ? (
        // Mobile Layout - Horizontal
        <div className="flex items-center gap-4">
          <div className="relative flex-shrink-0">
            <AspectRatio ratio={1} className="w-16 h-16">
              <div className="w-full h-full rounded-xl overflow-hidden bg-white/5">
                <img
                  src={optimizeImage(product.image, { w: 160 })}
                  alt={`${product.nameAr} - ${product.name} by photographer on Unsplash`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  loading="lazy"
                  decoding="async"
                  srcSet={buildSrcSet(product.image, 160)}
                  sizes="(max-width: 640px) 25vw, 160px"
                />
              </div>
            </AspectRatio>
            
            {product.discount && (
              <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                -{product.discount}%
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-white font-bold text-sm mb-1 truncate">
              {product.nameAr}
            </h3>
            
            {/* Modern Separation Line */}
            <div className="relative h-0.5 bg-white/10 rounded-full overflow-hidden mb-2">
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
            </div>
            
            <div className="flex items-center gap-2 mb-2" onMouseLeave={handleStarLeave}>
              <div className="flex items-center gap-1">
                {renderStars(product.rating)}
                <span 
                  className="text-xs text-white/60 ml-1 cursor-pointer hover:text-white/80 transition-colors"
                  onClick={(e) => handleRatingClick(e)}
                >
                  ({product.reviews})
                </span>
              </div>
              {product.sku && (
                <span className="text-xs font-semibold text-white bg-white/20 px-1.5 py-0.5 rounded-sm border border-white/30 hover:border-white/60 transition-colors">
                  {product.sku}
                </span>
              )}
            </div>
            
            <div className="flex items-center justify-between">
              {!hidePrices && (
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold text-white">
                    {product.price ? product.price.toLocaleString() : 'N/A'} ج.م
                  </span>
                  {product.originalPrice && (
                    <span className="text-xs text-white/60 line-through">
                      {product.originalPrice.toLocaleString()}
                    </span>
                  )}
                </div>
              )}
              
              <div className={`flex gap-1 transition-all duration-300 ${
                isHovered ? 'opacity-100 scale-100' : 'opacity-70 scale-90'
              }`}>
                {hidePrices ? (
                  // When prices hidden: Show animated contact button with slide transition
                  <button onClick={handleContactWhatsApp} className="flex-1 p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300 group/btn relative overflow-hidden flex items-center justify-center">
                    <span className="absolute inset-0 flex items-center justify-center gap-1 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                      <img src={whatsappIcon} alt="WhatsApp" className="w-3 h-3" />
                      <span className="text-xs text-white font-medium">لمعرفة السعر</span>
                    </span>
                    <span className="absolute inset-0 flex items-center justify-center gap-1 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                      <img src={whatsappIcon} alt="WhatsApp" className="w-3 h-3" />
                      <span className="text-xs text-white font-medium">اضغط هنا</span>
                    </span>
                  </button>
                ) : (
                  <>
                    {/* 3D Heart Button */}
                    <button className="group/heart p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300 relative">
                      <Heart className="w-3 h-3 text-white transition-all duration-300" />
                      {/* 3D Colored Heart on Hover */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/heart:opacity-100 transition-opacity duration-300">
                        <Heart className="w-3 h-3 text-red-500 fill-red-500 drop-shadow-[0_2px_4px_rgba(239,68,68,0.5)] shadow-red-500/50" 
                               style={{
                                 filter: 'drop-shadow(0 0 6px rgba(239, 68, 68, 0.8)) drop-shadow(0 2px 4px rgba(239, 68, 68, 0.4))'
                               }} />
                      </div>
                    </button>
                    
                    {/* Eye Button with Open/Close Animation */}
                    <button className="group/eye p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300 relative">
                      <EyeOff className="w-3 h-3 text-white absolute transition-all duration-300 group-hover/eye:opacity-0 group-hover/eye:scale-0" />
                      <Eye className="w-3 h-3 text-white absolute opacity-0 scale-0 group-hover/eye:opacity-100 group-hover/eye:scale-100 transition-all duration-300" />
                    </button>
                    
                    <button className="p-1.5 bg-white/20 hover:bg-white/30 rounded-full transition-all duration-300">
                      <ShoppingCart className="w-3 h-3 text-white" />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        // Desktop Layout - Vertical
        <div>
          <div className="relative mb-4">
            <AspectRatio ratio={4/3} className="w-full">
              <div className="w-full h-full rounded-2xl overflow-hidden bg-white/5">
                <img
                  src={product.image}
                  alt={`${product.nameAr} - ${product.name} by photographer on Unsplash`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
              </div>
            </AspectRatio>
            
            {product.discount && (
              <div className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                -{product.discount}%
              </div>
            )}
            
            {product.badge && (
              <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                {product.badge}
              </div>
            )}
          </div>

          <h3 className="text-white font-bold text-lg mb-2 line-clamp-2">
            {product.nameAr}
          </h3>
          
          {/* Modern Separation Line */}
          <div className="relative h-0.5 bg-white/10 rounded-full overflow-hidden mb-3">
            <div className="absolute inset-0 bg-gradient-to-r from-yellow-400 via-orange-400 to-yellow-400 transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
          </div>
          
          <div className="flex items-center gap-2 mb-3" onMouseLeave={handleStarLeave}>
            <div className="flex items-center gap-1">
              {renderStars(product.rating)}
            </div>
            <span 
              className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors"
              onClick={(e) => handleRatingClick(e)}
            >
              ({product.reviews})
            </span>
          </div>
          
          <div className="flex items-center justify-between mb-4">
            {!hidePrices && (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-bold text-white">
                  {product.price ? product.price.toLocaleString() : 'N/A'} ج.م
                </span>
                {product.originalPrice && (
                  <span className="text-sm text-white/60 line-through">
                    {product.originalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className={`flex gap-2 transition-all duration-300 ${
            isHovered ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
          }`}>
            {hidePrices ? (
              // When prices hidden: Show animated contact button with slide transition
              <button onClick={handleContactWhatsApp} className="flex-1 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 group/btn relative overflow-hidden flex items-center justify-center">
                <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                  <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                  <span className="text-white text-sm font-medium">لمعرفة السعر</span>
                </span>
                <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                  <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                  <span className="text-white text-sm font-medium">اضغط هنا</span>
                </span>
              </button>
            ) : (
              <button className="flex-1 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 flex items-center justify-center gap-2">
                <ShoppingCart className="w-4 h-4 text-white" />
                <span className="text-white text-sm font-medium">أضف للسلة</span>
              </button>
            )}
            
            {/* 3D Heart Button */}
            <button className="group/heart p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 relative">
              <Heart className="w-4 h-4 text-white transition-all duration-300" />
              {/* 3D Colored Heart on Hover */}
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/heart:opacity-100 transition-opacity duration-300">
                <Heart className="w-4 h-4 text-red-500 fill-red-500 drop-shadow-[0_2px_4px_rgba(239,68,68,0.5)] shadow-red-500/50" 
                       style={{
                         filter: 'drop-shadow(0 0 8px rgba(239, 68, 68, 0.8)) drop-shadow(0 3px 6px rgba(239, 68, 68, 0.4))'
                       }} />
              </div>
            </button>
            
            {/* Eye Button with Open/Close Animation */}
            <button className="group/eye p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 relative">
              <EyeOff className="w-4 h-4 text-white absolute transition-all duration-300 group-hover/eye:opacity-0 group-hover/eye:scale-0" />
              <Eye className="w-4 h-4 text-white absolute opacity-0 scale-0 group-hover/eye:opacity-100 group-hover/eye:scale-100 transition-all duration-300" />
            </button>
          </div>
        </div>
      )}
      
      {/* Rating Modal */}
      <Dialog open={showRatingModal} onOpenChange={handleModalClose}>
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
            initialRating={selectedRating}
            onRatingSubmit={handleRatingSubmit}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductCard;
