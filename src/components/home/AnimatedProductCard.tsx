import React, { useRef, useState } from 'react';
import { Star, Heart, Eye, EyeOff, ShoppingCart, Phone, Mail } from 'lucide-react';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Rating from '@/components/product/Rating';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import whatsappIcon from '@/assets/whatsapp.png';

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

interface AnimatedProductCardProps {
  product: Product;
  index: number;
  className?: string;
  hidePrices?: boolean;
}

const AnimatedProductCard: React.FC<Omit<AnimatedProductCardProps, 'hidePrices'>> = ({ 
  product, 
  index, 
  className = ""
}) => {
  const { hidePrices } = usePricingSettings();
  const cardRef = useRef<HTMLDivElement>(null);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showContactModal, setShowContactModal] = useState(false);
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
      ref={cardRef}
      data-product-id={product.id}
      className={`bg-white/10 backdrop-blur-lg rounded-3xl p-3 border border-white/20 cursor-pointer relative overflow-hidden ${className}`}
      style={{ opacity: 1 }}
    >
      <div className="relative z-10 pointer-events-none">
        <div className="relative mb-2 pointer-events-auto">
          <AspectRatio ratio={4/3} className="w-full pointer-events-auto">
            <div className="w-full h-full rounded-2xl overflow-hidden bg-white/5">
              <img
                src={optimizeImage(product.image, { w: 280 })}
                alt={`${product.nameAr} - ${product.name}`}
                className="w-full h-full object-cover pointer-events-none"
                loading="lazy"
                decoding="async"
                ref={(el) => {
                  if (el) el.setAttribute('fetchpriority', 'low');
                }}
                srcSet={buildSrcSet(product.image, 280)}
                sizes="(max-width: 640px) 45vw, 280px"
              />
            </div>
          </AspectRatio>
          
          {product.discount && (
            <div 
              className="absolute -top-2 -right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg"
            >
              -{product.discount}%
            </div>
          )}
          
          {product.badge && (
            <div 
              className="absolute top-2 left-2 bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg"
            >
              {product.badge}
            </div>
          )}
        </div>

        <h3 
          className="text-white font-bold text-sm mb-1 line-clamp-2"
        >
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
              className="text-sm text-white/60 cursor-pointer hover:text-white/80 transition-colors"
              onClick={(e) => handleRatingClick(e)}
            >
              ({product.reviews})
            </span>
          </div>
          {product.sku && (
            <span className="text-xs font-semibold text-white bg-white/20 px-1.5 py-0.5 rounded-sm border border-white/30 hover:border-white/60 transition-colors ml-auto">
              {product.sku}
            </span>
          )}
        </div>
        
        {!hidePrices && (
          <div className="flex items-center gap-2 mb-2">
            <span 
              className="text-lg font-bold text-white"
            >
              {product.price.toLocaleString()} ج.م
            </span>
            {product.originalPrice && (
              <span 
                className="text-sm text-white/60 line-through"
              >
                {product.originalPrice.toLocaleString()}
              </span>
            )}
          </div>
        )}
        
        {/* Enhanced Action Buttons */}
        <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-all duration-300">
          {hidePrices ? (
            <button 
              onClick={() => setShowContactModal(true)}
              className="flex-1 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 flex items-center justify-center gap-2"
            >
              <img src={whatsappIcon} alt="WhatsApp" className="w-3 h-3" />
              <span className="text-white text-xs font-medium">لمعرفة السعر</span>
            </button>
          ) : (
            <button className="flex-1 p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 flex items-center justify-center gap-2">
              <ShoppingCart className="w-3 h-3 text-white" />
              <span className="text-white text-xs font-medium">أضف</span>
            </button>
          )}
          
          {!hidePrices && (
            <>
              {/* 3D Heart Button */}
              <button className="group/heart p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 relative">
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
              <button className="group/eye p-2 bg-white/20 hover:bg-white/30 rounded-xl transition-all duration-300 relative">
                <EyeOff className="w-3 h-3 text-white absolute transition-all duration-300 group-hover/eye:opacity-0 group-hover/eye:scale-0" />
                <Eye className="w-3 h-3 text-white absolute opacity-0 scale-0 group-hover/eye:opacity-100 group-hover/eye:scale-100 transition-all duration-300" />
              </button>
            </>
          )}
        </div>
      </div>

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

      {/* Contact Modal */}
      <Dialog open={showContactModal} onOpenChange={setShowContactModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-center mb-4">
              لمعرفة السعر
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
          <div className="space-y-3">
            <a
              href="https://wa.me/201000000000?text=السلام عليكم، أود الاستفسار عن المنتج"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full p-3 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
            >
              <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
              <span>تواصل عبر WhatsApp</span>
            </a>
            <a
              href="tel:+201000000000"
              className="flex items-center justify-center gap-2 w-full p-3 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>اتصل بنا</span>
            </a>
            <a
              href="mailto:info@example.com"
              className="flex items-center justify-center gap-2 w-full p-3 bg-slate-500 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <Mail className="w-4 h-4" />
              <span>أرسل بريد إلكتروني</span>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AnimatedProductCard;
