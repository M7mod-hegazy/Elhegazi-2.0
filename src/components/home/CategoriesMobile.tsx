import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Package, Grid3x3, Sparkles, ArrowRight, Tag, MoreHorizontal, Hand } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { apiGet, type ApiResponse } from '@/lib/api';
import type { Category } from '@/types';
import { optimizeImage } from '@/lib/images';
import { motion } from 'framer-motion';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Mousewheel } from 'swiper/modules';
import 'swiper/css';

interface CategoriesMobileProps {
  selectedSlugs?: string[];
}

// Simplified Product interface for mobile
interface HomeProduct {
  id: string;
  name: string;
  nameAr: string;
  image: string;
}

const CategoriesMobile = ({ selectedSlugs }: CategoriesMobileProps) => {
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<HomeProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [animatedCounts, setAnimatedCounts] = useState<{[key: string]: number}>({});
  const [swiperInstance, setSwiperInstance] = useState<any>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
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
    const duration = 600;
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
      .slice(0, 4); // Mobile shows max 4 products like desktop
    
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
    category?: string;
    categoryId?: string;
    categorySlug?: string;
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

        // Build product counts by category for fallback
        const countsById = new Map<string, number>();
        const countsBySlug = new Map<string, number>();
        for (const p of productItems as ApiProduct[]) {
          const idKey = p.categoryId || p.category;
          if (idKey) countsById.set(idKey, (countsById.get(idKey) || 0) + 1);
          if (p.categorySlug) countsBySlug.set(p.categorySlug, (countsBySlug.get(p.categorySlug) || 0) + 1);
        }

        const categories: Category[] = categoryItems.map((c) => {
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
    const maxCount = 8;
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

  // Ultra smooth continuous auto-scroll for mobile
  useEffect(() => {
    if (!swiperInstance || isHovered || displayCategories.length === 0) return;
    
    let translateX = 0;
    let lastTime = 0;
    const slideWidth = swiperInstance.slidesSizesGrid?.[0] || 250;
    const pixelsPerSecond = 30; // Slightly slower for mobile
    
    const animate = (currentTime: number) => {
      if (!isHovered && swiperInstance) {
        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;
        
        // Time-based movement for consistent speed
        const movement = (pixelsPerSecond * deltaTime) / 1000;
        translateX += movement;
        
        // Reset when we've moved a full slide width
        if (translateX >= slideWidth + 16) { // +16 for mobile spaceBetween
          translateX = 0;
          swiperInstance.slideNext();
        } else {
          // Apply ultra smooth translation
          if (swiperInstance.wrapperEl) {
            const currentTransform = swiperInstance.getTranslate();
            swiperInstance.setTranslate(currentTransform - movement);
          }
        }
        
        // Update progress and current slide for dots
        const progress = (translateX / (slideWidth + 16));
        setScrollProgress(progress);
        
        // Update current slide for dot indication
        const slideProgress = (translateX / (slideWidth + 16)) + currentSlide;
        const actualSlideIndex = Math.floor(slideProgress) % displayCategories.length;
        setCurrentSlide(actualSlideIndex);
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

  return (
    <div className="space-y-4">
      {/* Fixed Cards - Mobile Optimized: Stack vertically */}
      <div className="flex flex-col gap-2 px-3">
        <Link
          to="/products"
          className="w-full bg-gradient-to-br from-primary to-primary/80 rounded-lg p-3 flex items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white truncate">جميع المنتجات</h3>
            <p className="text-xs text-white/80 truncate">تصفح الكل</p>
          </div>
        </Link>

        <Link
          to="/categories"
          className="w-full bg-gradient-to-br from-secondary to-secondary/80 rounded-lg p-3 flex items-center gap-2 active:scale-95 transition-transform"
        >
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
            <Grid3x3 className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white truncate">كل الأقسام</h3>
          </div>
        </Link>
      </div>

      {/* Mobile Categories Carousel - No padding to allow full animation */}
      <div className="relative w-screen overflow-hidden -ml-3 -mr-3">
        {loading ? (
          <div className="grid grid-cols-1 gap-4 px-3">
            {Array.from({ length: 2 }).map((_, idx) => (
              <div key={idx} className="bg-white rounded-xl overflow-hidden shadow-lg border border-slate-200 w-full h-40">
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
              className="mb-4 !overflow-hidden px-3"
              style={{ overflow: 'hidden' } as React.CSSProperties}
              speed={0}
              spaceBetween={12}
              loop={true}
              loopAdditionalSlides={8}
              centeredSlides={false}
              allowTouchMove={true}
              freeMode={true}
              mousewheel={{ forceToAxis: true }}
              onSwiper={(swiper) => {
                setSwiperInstance(swiper);
              }}
              onSlideChange={(swiper) => {
                // Map realIndex to actual category index for dots
                const actualIndex = swiper.realIndex % displayCategories.length;
                setCurrentSlide(actualIndex);
              }}
              breakpoints={{
                0: { slidesPerView: 1.05, spaceBetween: 8 },
                480: { slidesPerView: 1.1, spaceBetween: 10 },
              }}
            >
              {[...displayCategories, ...displayCategories, ...displayCategories, ...displayCategories].map((category, categoryIndex) => (
                <SwiperSlide key={`${category.id}-${Math.floor(categoryIndex / displayCategories.length)}`} className="!h-auto">
                  <motion.div
                    className="h-full"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: (categoryIndex % 3) * 0.1 }}
                    onTouchStart={() => setIsHovered(true)}
                    onTouchEnd={() => setIsHovered(false)}
                  >
                    <Link
                      to={`/category/${category.slug || category.id}`}
                      className="group block bg-white rounded-xl sm:rounded-2xl overflow-hidden shadow-lg border-2 border-slate-200/80 relative cursor-pointer w-full h-full active:scale-95 active:shadow-xl active:border-primary/60 transition-all duration-200 ring-1 ring-slate-100"
                    >

                      {/* Featured Badge */}
                      {category.featured && (
                        <div className="absolute top-3 right-3 z-30">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium shadow-xl animate-bounce px-2 py-1">
                            مميزة ⭐
                          </Badge>
                        </div>
                      )}

                      {/* Mobile Hover Overlay */}
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-active:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-md z-20">
                        <div className="text-center text-white transform scale-95 group-active:scale-100 transition-transform duration-300">
                          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-4 py-3 border border-white/30">
                            <div className="text-lg font-bold mb-1">استكشف المنتجات</div>
                            <div className="text-sm opacity-90 mb-3">اكتشف مجموعة {category.nameAr}</div>
                            <div className="flex items-center justify-center gap-2 text-white font-semibold">
                              <span>استكشف الآن</span>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Mobile Split Screen Layout - 50/50 - Smaller card */}
                      <div className="flex h-40">
                        {/* Left Side - Category Info (50% on mobile) - Compact */}
                        <div className="w-1/2 bg-gradient-to-br from-slate-50 to-slate-100 p-2 flex flex-col justify-between relative overflow-hidden">
                          {/* Category Image Background Overlay */}
                          {category.image && (
                            <div className="absolute inset-0 opacity-15 z-0">
                              <img
                                src={optimizeImage(category.image, { w: 300 })}
                                alt={category.nameAr}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/70" />
                            </div>
                          )}
                          
                          {/* Background Pattern */}
                          <div className="absolute inset-0 opacity-5 z-1">
                            <div className="w-full h-full" style={{
                              backgroundImage: `radial-gradient(circle at 15px 15px, currentColor 1.5px, transparent 0)`,
                              backgroundSize: '30px 30px'
                            }} />
                          </div>
                          
                          <div className="relative z-10">
                            {/* Category Badge - Smaller */}
                            <div className="mb-1">
                              <Badge className="bg-slate-900/90 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1 px-2 py-0.5 shadow-lg w-fit">
                                <Tag className="w-2 h-2" />
                                فئة
                              </Badge>
                            </div>
                            
                            {/* Category Name with Product Count - Smaller text */}
                            <div className="flex items-center gap-1 mb-1">
                              <h3 className="text-xs font-bold text-slate-900 group-hover:text-primary transition-all duration-300 leading-tight flex-1 min-w-0">
                                {category.nameAr}
                              </h3>
                              <div 
                                className="bg-primary/10 text-primary px-1.5 py-0.5 rounded-full text-xs font-semibold flex-shrink-0 group-hover:bg-primary group-hover:text-white transition-all duration-300"
                                ref={(el) => {
                                  if (el && animatedCounts[category.id] === undefined) {
                                    setTimeout(() => animateCounter(category.id, category.productCount), 400);
                                  }
                                }}
                              >
                                {animatedCounts[category.id] ?? (category.productCount || 0)}
                              </div>
                            </div>
                            <p className="text-slate-600 text-xs mb-2 opacity-80 line-clamp-1">{category.name}</p>
                            
                            {/* Category Description - Hidden on mobile to save space */}
                            {/* Hidden for mobile compact view */}
                          </div>

                          {/* Enhanced Action Button - Compact */}
                          <div className="relative z-10">
                            <div className="bg-primary/10 hover:bg-primary/20 active:bg-primary/30 rounded-lg px-2 py-1 border border-primary/20 transition-all duration-200">
                              <div className="flex items-center justify-center gap-1 text-primary font-bold">
                                <span className="text-xs">اضغط</span>
                                <ArrowRight className="w-3 h-3" />
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Side - Product Mosaic (50% on mobile) */}
                        <div className="w-1/2 relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
                          {/* Product Grid - Same as Desktop */}
                          <div className="h-full p-2 relative z-10">
                            {(() => {
                              const previewProducts = getCategoryPreviewProducts(category);
                              const totalProducts = category.productCount || 0;
                              const selectedProducts = previewProducts.length;
                              const maxVisibleProducts = selectedProducts > 0 ? Math.min(selectedProducts, 3) : 0;
                              const shouldShowMoreSlot = totalProducts > selectedProducts && selectedProducts > 0;
                              const remainingCount = totalProducts - selectedProducts;
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
                                    {/* Display selected products */}
                                    {previewProducts.map((product) => (
                                      <div key={product.id} className="relative overflow-hidden rounded-lg bg-white shadow-sm transition-all duration-300">
                                        <img
                                          src={optimizeImage(product.image || '', { w: 150 })}
                                          alt={product.nameAr || product.name}
                                          className="w-full h-full object-cover group-hover:brightness-110 group-hover:scale-110 transition-all duration-500"
                                          loading="lazy"
                                        />
                                        {/* Product name overlay - Always visible on top with theme color */}
                                        <div className="absolute top-1 left-1 right-1 z-10">
                                          <div className="bg-primary text-white text-[9px] font-medium text-center leading-tight py-0.5 px-1 rounded shadow-lg truncate">
                                            {product.nameAr || product.name}
                                          </div>
                                        </div>
                                      </div>
                                    ))}

                                    {/* Show +X more if there are more products in category than selected */}
                                    {shouldShowMoreSlot && (
                                      <div className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                                        <div className="text-center text-white">
                                          <div className="text-xs font-bold">+{remainingCount}</div>
                                          <div className="text-[10px] opacity-90">المزيد</div>
                                        </div>
                                      </div>
                                    )}

                                    {/* Show placeholder if no products selected but category has products */}
                                    {selectedProducts === 0 && totalProducts > 0 && (
                                      <div className="bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center rounded-lg">
                                        <div className="text-slate-500 text-center">
                                          <Package className="w-6 h-6 mx-auto mb-1 opacity-50" />
                                          <div className="text-[10px] font-medium">{totalProducts} منتج</div>
                                          <div className="text-[9px] opacity-75">غير محدد</div>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {/* Full-width +X more for 2 products */}
                                  {showFullWidthMore && (
                                    <div className="absolute bottom-0 left-0 right-0 h-6">
                                      <div className="w-full h-full bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                                        <div className="flex items-center gap-1 text-white">
                                          <MoreHorizontal className="w-3 h-3 opacity-90" />
                                          <div className="text-xs font-bold">+{remainingCount}</div>
                                          <div className="text-[10px] opacity-90">المزيد</div>
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
            {displayCategories.length > 0 && (
              <div className="flex justify-center gap-2 mt-4">
                {displayCategories.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => swiperInstance?.slideTo(index)}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentSlide
                        ? 'bg-primary w-8'
                        : 'bg-slate-300 w-2 hover:bg-slate-400'
                    }`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
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

export default CategoriesMobile;
