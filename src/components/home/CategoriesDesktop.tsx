import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Package, Grid3x3, Sparkles, ArrowRight, ChevronLeft, ChevronRight, Tag, MoreHorizontal } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { apiGet, type ApiResponse } from '@/lib/api';
import type { Category } from '@/types';

// Simplified Product interface for home page
interface HomeProduct {
  id: string;
  name: string;
  nameAr: string;
  image: string;
}
import { motion } from 'framer-motion';
import { optimizeImage } from '@/lib/images';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/scrollbar';

interface CategoriesDesktopProps {
  selectedSlugs?: string[];
}

const CategoriesDesktop = ({ selectedSlugs }: CategoriesDesktopProps) => {
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [animatedCounts, setAnimatedCounts] = useState<{[key: string]: number}>({});
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [totalSlides, setTotalSlides] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const animationRef = useRef<number>();

  // Helper function to animate counter
  const animateCounter = (categoryId: string, target: number) => {
    if (target === 0) {
      setAnimatedCounts(prev => ({ ...prev, [categoryId]: 0 }));
      return;
    }
    
    let start = 0;
    const duration = 800;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        start = target;
        clearInterval(timer);
      }
      setAnimatedCounts(prev => ({ ...prev, [categoryId]: Math.floor(start) }));
    }, 16);
  };

  // Get preview products for a category - ONLY manually selected products
  const getCategoryPreviewProducts = (category: Category): HomeProduct[] => {
    if (!products.length || !category.previewProducts?.length) return [];
    
    // Only show manually selected products from admin
    const selectedProducts = category.previewProducts
      .map(productId => products.find(p => p.id === productId))
      .filter(product => product !== undefined)
      .slice(0, 4);
    
    return selectedProducts;
  };

  type ApiCategory = {
    _id: string;
    name: string;
    nameAr?: string;
    slug: string;
    description?: string;
    descriptionAr?: string;
    featured?: boolean;
    image?: string;
    order?: number;
    productCount?: number;
    useRandomPreview?: boolean;
    previewProducts?: string[];
  };

  type ApiProduct = {
    _id: string;
    name: string;
    nameAr?: string;
    image?: string;
    category?: string;      // Mongo ObjectId as string
    categoryId?: string;    // explicit category id
    categorySlug?: string;  // category slug
  };

  useEffect(() => {
    let mounted = true;
    const fetchData = async () => {
      try {
        const [categoriesRes, productsRes] = await Promise.all([
          apiGet<ApiCategory>('/api/categories?limit=200'),
          apiGet<ApiProduct>('/api/products?limit=200&fields=_id,name,nameAr,image,category,categoryId,categorySlug')
        ]);
        
        const categoryItems = (categoriesRes as Extract<ApiResponse<ApiCategory>, { ok: true }>).items ?? [];
        const productItems = (productsRes as Extract<ApiResponse<ApiProduct>, { ok: true }>).items ?? [];

        // Build product counts by category (id and slug) for fallback
        const countsById = new Map<string, number>();
        const countsBySlug = new Map<string, number>();
        for (const p of productItems as ApiProduct[]) {
          const idKey = p.categoryId || p.category;
          if (idKey) countsById.set(idKey, (countsById.get(idKey) || 0) + 1);
          if (p.categorySlug) countsBySlug.set(p.categorySlug, (countsBySlug.get(p.categorySlug) || 0) + 1);
        }

        const categories: Category[] = categoryItems.map((c) => {
          // Prefer API productCount when positive, otherwise fallback to counts from products, then previewProducts length
          const productCountFromApi = typeof c.productCount === 'number' ? c.productCount : undefined;
          const productCountFromProducts = countsById.get(c._id) ?? countsBySlug.get(c.slug) ?? 0;
          const productCount = (productCountFromApi && productCountFromApi > 0)
            ? productCountFromApi
            : (productCountFromProducts > 0 ? productCountFromProducts : (Array.isArray(c.previewProducts) ? c.previewProducts.length : 0));
          
          return {
            id: c._id,
            name: c.name,
            nameAr: c.nameAr ?? c.name,
            slug: c.slug,
            image: c.image ?? '',
            description: c.description ?? '',
            descriptionAr: c.descriptionAr ?? c.description ?? '',
            productCount: productCount,
            featured: !!c.featured,
            order: typeof c.order === 'number' ? c.order : 0,
            useRandomPreview: c.useRandomPreview ?? true,
            previewProducts: c.previewProducts || []
          };
        });

        const products: HomeProduct[] = productItems.map((p: ApiProduct) => ({
          id: p._id,
          name: p.name || '',
          nameAr: p.nameAr || p.name || '',
          image: p.image || ''
        }));
        
        if (mounted) {
          setLiveCategories(categories);
          setProducts(products);
        }
      } catch (e) {
        console.error('Failed to fetch data:', e);
        if (mounted) {
          setLiveCategories([]);
          setProducts([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchData();
    return () => { mounted = false; };
  }, []);

  const displayCategories = (() => {
    const minCount = 3;
    const maxCount = 12;
    // Respect explicit selection if provided, but fill to at least minCount
    if (Array.isArray(selectedSlugs) && selectedSlugs.length > 0) {
      const map = new Map(liveCategories.map(c => [c.slug, c] as const));
      const picked = selectedSlugs.map(slug => map.get(slug)).filter((c): c is Category => !!c);
      if (picked.length > 0) {
        const pickedSlugSet = new Set(picked.map(p => p.slug));
        const remaining = liveCategories.filter(c => !pickedSlugSet.has(c.slug));
        const need = Math.max(minCount - picked.length, 0);
        const fill = remaining.slice(0, Math.min(maxCount - picked.length, need));
        return [...picked, ...fill];
      }
    }
    // Default: show all live categories (no featured gating)
    const all = [...liveCategories];
    return all.slice(0, Math.max(minCount, Math.min(maxCount, all.length)));
  })();

  // Swiper will page through displayCategories directly


  // Ultra smooth continuous auto-scroll
  useEffect(() => {
    if (!swiperInstance || isHovered || displayCategories.length === 0) return;
    
    let translateX = 0;
    let lastTime = 0;
    const slideWidth = swiperInstance.slidesSizesGrid?.[0] || 300;
    const pixelsPerSecond = 40; // Smooth 40 pixels per second
    
    const animate = (currentTime: number) => {
      if (!isHovered && swiperInstance) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Time-based movement for consistent speed
        const movement = (pixelsPerSecond * deltaTime) / 1000;
        translateX += movement;
        
        // Reset when we've moved a full slide width
        if (translateX >= slideWidth + 20) { // +20 for spaceBetween
          translateX = 0;
          swiperInstance.slideNext();
        } else {
          // Apply ultra smooth translation
          if (swiperInstance.wrapperEl) {
            const currentTransform = swiperInstance.getTranslate();
            swiperInstance.setTranslate(currentTransform - movement);
          }
        }
        
        // Update progress for dots
        const progress = (translateX / (slideWidth + 20));
        setScrollProgress(progress);
      } else {
        lastTime = currentTime; // Keep time sync even when paused
      }
      
      animationRef.current = requestAnimationFrame(animate);
    };
    
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [swiperInstance, isHovered, displayCategories.length]);

  // (Swiper provides mouse wheel paging, autoplay and scrollbar)


  return (
    <div className="space-y-6">
      {/* Fixed Cards Row - Responsive: Stack on mobile, side-by-side on desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* All Products Card */}
        <Link
          to="/products"
          className="group relative bg-gradient-to-br from-primary to-primary/80 rounded-lg sm:rounded-xl p-3 sm:p-5 overflow-hidden hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500 hover:-translate-y-1"
        >
          <div className="relative z-10 flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
              <Package className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1 text-right">
              <h3 className="text-sm sm:text-lg font-bold text-white">جميع المنتجات</h3>
              <p className="text-xs sm:text-sm text-white/90">تصفح كامل المتجر</p>
            </div>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </Link>

        {/* All Categories Card */}
        <Link
          to="/categories"
          className="group relative bg-gradient-to-br from-secondary to-secondary/80 rounded-lg sm:rounded-xl p-3 sm:p-5 overflow-hidden hover:shadow-2xl hover:shadow-secondary/20 transition-all duration-500 hover:-translate-y-1"
        >
          <div className="relative z-10 flex items-center gap-2 sm:gap-4">
            <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform duration-300 flex-shrink-0">
              <Grid3x3 className="w-5 h-5 sm:w-7 sm:h-7 text-white" />
            </div>
            <div className="flex-1 text-right">
              <h3 className="text-sm sm:text-lg font-bold text-white">كل الأقسام</h3>
              <p className="text-xs sm:text-sm text-white/90">استعرض حسب القسم</p>
            </div>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </Link>
      </div>

      {/* Categories Carousel (Swiper) */}
      <div className="relative w-full overflow-hidden">
        {loading ? (
          <div className="w-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-2xl overflow-hidden shadow-lg border border-slate-200 w-full h-64">
                <div className="flex h-full">
                  <div className="w-2/5 bg-slate-200 animate-pulse" />
                  <div className="w-3/5 bg-slate-100 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <>
            <Swiper
            modules={[Mousewheel]}
            className="mb-6 !overflow-hidden"
            style={{ overflow: 'hidden' } as React.CSSProperties}
            speed={0}
            spaceBetween={12}
            loop={true}
            loopAdditionalSlides={6}
            centeredSlides={false}
            allowTouchMove={true}
            freeMode={true}
            mousewheel={{ forceToAxis: true }}
            onSwiper={(swiper) => {
              setSwiperInstance(swiper);
              setTotalSlides(displayCategories.length);
            }}
            onSlideChange={(swiper) => {
              setCurrentSlide(swiper.realIndex);
            }}
            breakpoints={{
              0: { slidesPerView: 1.05, spaceBetween: 8 },
              480: { slidesPerView: 1.1, spaceBetween: 10 },
              768: { slidesPerView: 2, spaceBetween: 16 },
              1024: { slidesPerView: 3, spaceBetween: 20 },
            }}
          >
            {[...displayCategories, ...displayCategories, ...displayCategories].map((category, categoryIndex) => (
              <SwiperSlide key={`${category.id}-${Math.floor(categoryIndex / displayCategories.length)}`} className="!h-auto">
                <motion.div
                  className="h-full"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (categoryIndex % 3) * 0.1 }}
                  whileHover={{ scale: 1.02 }}
                  onMouseEnter={() => {
                    setIsHovered(true);
                    if (swiperInstance) {
                      swiperInstance.autoplay?.pause();
                    }
                  }}
                  onMouseLeave={() => {
                    setIsHovered(false);
                    if (swiperInstance) {
                      swiperInstance.autoplay?.resume();
                    }
                  }}
                >
                  <Link
                    to={`/category/${category.slug || category.id}`}
                    className="group block bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-500 sm:duration-700 border border-slate-200/60 hover:border-primary/40 relative touch-manipulation cursor-pointer w-full h-full"
                  >
                {/* Featured Badge */}
                {category.featured && (
                  <div className="absolute top-4 right-4 z-30">
                    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium shadow-xl animate-pulse px-2 py-1">
                      مميزة ⭐
                    </Badge>
                  </div>
                )}


                {/* Split Screen Layout - Responsive height */}
                <div className="flex h-48 sm:h-56 lg:h-64">
                  {/* Left Side - Category Info (40%) - Responsive padding */}
                  <div className="w-2/5 bg-gradient-to-br from-slate-50 to-slate-100 p-3 sm:p-4 lg:p-6 flex flex-col justify-between relative overflow-hidden">
                {/* Category Image Background Overlay */}
                {category.image && (
                  <div className="absolute inset-0 opacity-20 z-0">
                    <img
                      src={optimizeImage(category.image, { w: 400 })}
                      alt={category.nameAr}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/70" />
                  </div>
                )}
                
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5 z-1">
                  <div className="w-full h-full" style={{
                    backgroundImage: `radial-gradient(circle at 20px 20px, currentColor 2px, transparent 0)`,
                    backgroundSize: '40px 40px'
                  }} />
                </div>
                
                <div className="relative z-10">
                  {/* Category Badge - Responsive sizing */}
                  <div className="mb-1 sm:mb-2 animate-slide-in-left">
                    <Badge className="bg-slate-900/90 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1 px-2 py-0.5 sm:py-1 shadow-lg w-fit">
                      <Tag className="w-2 h-2 sm:w-2.5 sm:h-2.5" />
                      فئة
                    </Badge>
                  </div>
                  
                  {/* Category Name with Product Count - Responsive sizing */}
                  <div className="flex items-center gap-1 sm:gap-2 mb-1 sm:mb-2 animate-slide-in-left group-hover:translate-x-1 transition-transform duration-300">
                    <h3 className="text-xs sm:text-sm lg:text-lg font-bold text-slate-900 group-hover:text-primary transition-all duration-300 leading-tight flex-1 min-w-0 group-hover:scale-105">
                      {category.nameAr}
                    </h3>
                    <div 
                      className="bg-primary/10 text-primary px-1.5 sm:px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300"
                      ref={(el) => {
                        if (el && animatedCounts[category.id] === undefined) {
                          setTimeout(() => animateCounter(category.id, category.productCount), 600);
                        }
                      }}
                    >
                      {animatedCounts[category.id] ?? (category.productCount || 0)}
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs mb-1 sm:mb-3 opacity-80 group-hover:opacity-100 group-hover:text-slate-700 transition-all duration-300">{category.name}</p>
                  
                  {/* Category Description - Hidden on mobile */}
                  {(category.descriptionAr || category.description) && (
                    <div className="hidden sm:block bg-white/60 rounded-lg p-2 animate-slide-in-left group-hover:bg-white/80 group-hover:shadow-md group-hover:scale-105 transition-all duration-300">
                      <div className="text-xs font-medium text-slate-700 mb-1 group-hover:text-primary transition-colors duration-300">الوصف</div>
                      <div className="text-xs text-slate-600 line-clamp-2 leading-relaxed group-hover:text-slate-800 transition-colors duration-300">
                        {category.descriptionAr || category.description}
                      </div>
                    </div>
                  )}
                </div>

                {/* Simple Action Button - Responsive sizing */}
                <div className="relative z-10">
                  <div className="flex items-center gap-1 sm:gap-2 text-primary font-medium">
                    <span className="text-xs sm:text-sm">استكشف الآن</span>
                    <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 rtl-flip" />
                  </div>
                </div>
              </div>

              {/* Right Side - Product Mosaic (60%) */}
              <div className="w-3/5 relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                {/* Hover Overlay - Only on Product Section */}
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/40 backdrop-blur-md z-20">
                  <div className="text-center text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                    <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/30">
                      <div className="text-xl font-bold mb-2">استكشف المنتجات</div>
                      <div className="text-sm opacity-90 mb-4">اكتشف مجموعة {category.nameAr}</div>
                      <div className="flex items-center justify-center gap-2 text-white font-semibold">
                        <span>استكشف الآن</span>
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Product Grid - Responsive padding */}
                <div className="h-full p-2 sm:p-3 relative z-10">
                  {(() => {
                    const previewProducts = getCategoryPreviewProducts(category);
                    const totalProducts = category.productCount || 0;
                    const selectedProducts = previewProducts.length;
                    
                    // Always show at least 1 product if available, reserve space for +X more
                    const maxVisibleProducts = selectedProducts > 0 ? Math.min(selectedProducts, 3) : 0;
                    const shouldShowMoreSlot = totalProducts > selectedProducts && selectedProducts > 0;
                    const remainingCount = totalProducts - selectedProducts; // Total - Selected = Remaining
                    const showFullWidthMore = selectedProducts === 2 && totalProducts > selectedProducts;


                    return (
                      <div className="h-full relative">
                        <div className={`grid gap-1 h-full ${
                          selectedProducts === 0 ? 'grid-cols-1' :
                          selectedProducts === 1 && shouldShowMoreSlot ? 'grid-cols-2' :
                          selectedProducts === 1 ? 'grid-cols-1' : 
                          selectedProducts === 2 && shouldShowMoreSlot ? 'grid-cols-2 grid-rows-2' :
                          selectedProducts === 2 ? 'grid-cols-2' : 
                          'grid-cols-2 grid-rows-2'
                        }`}>
                          {/* Display only selected products */}
                          {previewProducts.map((product, idx) => (
                            <div key={product.id} className="relative overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300">
                              <img
                                src={optimizeImage(product.image || '', { w: 200 })}
                                alt={product.nameAr || product.name}
                                className="w-full h-full object-cover group-hover:brightness-110 group-hover:scale-110 transition-all duration-500"
                                loading="lazy"
                              />
                              {/* Product name overlay - Always visible on top with theme color */}
                              <div className="absolute top-2 left-2 right-2 z-10">
                                <div className="bg-primary text-white text-[10px] font-medium text-center leading-tight py-1 px-2 rounded-lg shadow-lg truncate">
                                  {product.nameAr || product.name}
                                </div>
                              </div>
                            </div>
                          ))}

                          {/* Show +X more if there are more products in category than selected */}
                          {shouldShowMoreSlot && (
                            <div className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                              <div className="text-center text-white">
                                <div className="text-sm font-bold">+{remainingCount}</div>
                                <div className="text-xs opacity-90">المزيد</div>
                              </div>
                            </div>
                          )}

                          {/* Show placeholder if no products selected but category has products */}
                          {selectedProducts === 0 && totalProducts > 0 && (
                            <div className="bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center rounded-lg">
                              <div className="text-slate-500 text-center">
                                <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <div className="text-xs font-medium">{totalProducts} منتج</div>
                                <div className="text-xs opacity-75">غير محدد</div>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Full-width +X more for 2 products */}
                        {showFullWidthMore && (
                          <div className="absolute bottom-0 left-0 right-0 h-8">
                            <div className="w-full h-full bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                              <div className="flex items-center gap-2 text-white">
                                <MoreHorizontal className="w-4 h-4 opacity-90" />
                                <div className="text-sm font-bold">+{remainingCount}</div>
                                <div className="text-xs opacity-90">المزيد</div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
                  </Link>
                </motion.div>
              </SwiperSlide>
            ))}
          </Swiper>
          
          {/* Navigation Dots */}
          {displayCategories.length > 0 && (
            <div className="mt-8 flex justify-center gap-3">
              {displayCategories.map((category, index) => (
                <div
                  key={category.id}
                  className="relative group cursor-pointer"
                  onClick={() => {
                    if (swiperInstance) {
                      swiperInstance.slideTo(index);
                    }
                  }}
                >
                  <div
                    className={`w-4 h-4 rounded-full transition-all duration-300 ${
                      Math.floor(currentSlide) % displayCategories.length === index
                        ? 'bg-primary scale-125 shadow-lg'
                        : 'bg-slate-300 hover:bg-slate-400'
                    }`}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-10">
                    <div className="bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
                      {category.nameAr || category.name}
                      {/* Tooltip arrow */}
                      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-800"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          </>
        )}
      </div>
    </div>
  );
};

// Hide scrollbar on mobile for Swiper
const styles = `
  .swiper {
    overflow: hidden !important;
  }
  
  .swiper-scrollbar {
    display: none !important;
  }
  
  .swiper-scrollbar-drag {
    display: none !important;
  }
  
  /* Hide scrollbar for Chrome, Safari and Opera */
  .swiper::-webkit-scrollbar {
    display: none;
  }
  
  /* Hide scrollbar for IE, Edge and Firefox */
  .swiper {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}

export default CategoriesDesktop;
