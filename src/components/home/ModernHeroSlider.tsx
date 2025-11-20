import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  Users, Package, Star, Percent, Clock, Gift, Shield, Zap, Crown
} from 'lucide-react';
import SlideContent from './SlideContent';
import AnimatedProductCard from './AnimatedProductCard';
import NavigationControls from './NavigationControls';
import BackgroundPattern from './BackgroundPattern';
import MobileHeroSection from './MobileHeroSection';
import { useHomeConfig } from '@/hooks/useHomeConfig';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import type { Slide as ConfigSlide } from '@/types/home-config';
import { type CachedProduct } from '@/lib/productCache';
import { useProductsByIds } from '@/hooks/useProductsByIds';

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

interface HeroSlide {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  ctaText: string;
  ctaLink: string;
  bgGradient: string;
  bgColor?: string;
  badge: string;
  features: string[];
  products: Product[];
  stats: {
    label: string;
    value: string;
    icon: React.ReactNode;
  }[];
}

const ModernHeroSlider: React.FC = () => {
  // ANIMATION SYSTEM (no hover effects)
  const { hidePrices } = usePricingSettings();
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [isMobile, setIsMobile] = useState(false);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { homeConfig, loading } = useHomeConfig();
  const HERO_CACHE_KEY = 'hero_slides_cache_v1';

  // Data used by slides must be declared before any callbacks that might reference them
  const fakeProducts: Product[] = [
    {
      id: '1',
      name: 'Premium Smartphone',
      nameAr: 'هاتف ذكي متميز',
      price: 2999,
      originalPrice: 3499,
      image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwbW9iaWxlJTIw cGhvbmUlMjB0ZWNobm9sb2d5fGVufDB8MXx8fDE3NTY4OTQ5NDB8MA&ixlib=rb-4.1.0&q=85',
      rating: 4.8,
      reviews: 1250,
      discount: 15,
      badge: 'الأكثر مبيعاً'
    },
    {
      id: '2',
      name: 'Wireless Headphones',
      nameAr: 'سماعات لاسلكية',
      price: 899,
      originalPrice: 1199,
      image: 'https://images.unsplash.com/photo-1608148118722-56da485f9e84?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxoZWFkcGhvbmVzJTIwd2lyZWxlc3MlMjBhdWRpb3xlbnwwfDB8fHwxNzU2ODk0OTQwfDA&ixlib=rb-4.1.0&q=85',
      rating: 4.6,
      reviews: 890,
      discount: 25,
      badge: 'عرض محدود'
    },
    {
      id: '3',
      name: 'Luxury Watch',
      nameAr: 'ساعة فاخرة',
      price: 1599,
      originalPrice: 1999,
      image: 'https://images.unsplash.com/photo-1623391306881-7bdb8f98f738?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwzfHx3YXRjaCUyMGx1eHVyeSUyMHRpbWVwaWVjZXxlbnwwfDJ8fHwxNzU2ODk0OTQwfDA&ixlib=rb-4.1.0&q=85',
      rating: 4.9,
      reviews: 456,
      discount: 20,
      badge: 'جديد'
    },
    {
      id: '4',
      name: 'Gaming Laptop',
      nameAr: 'لابتوب ألعاب',
      price: 4999,
      originalPrice: 5999,
      image: 'https://images.unsplash.com/photo-1627560270549-5c77fcde0ed3?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw4fHxsYXB0b3AlMjBnYW1pbmclMjBjb21wdXRlcnxlbnwwfDB8fHwxNzU2ODk0OTQwfDA&ixlib=rb-4.1.0&q=85',
      rating: 4.7,
      reviews: 678,
      discount: 17,
      badge: 'أداء عالي'
    },
    {
      id: '5',
      name: 'Athletic Sneakers',
      nameAr: 'حذاء رياضي',
      price: 599,
      originalPrice: 799,
      image: 'https://images.unsplash.com/photo-1610664676282-55c8de64f746?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxzbmVha2VycyUyMHNob2VzJTIwYXRobGV0aWN8ZW58MHwwfHx8MTc1Njg5NDk0MHww&ixlib=rb-4.1.0&q=85',
      rating: 4.5,
      reviews: 1123,
      discount: 25,
      badge: 'راحة فائقة'
    },
    {
      id: '6',
      name: 'Digital Camera',
      nameAr: 'كاميرا رقمية',
      price: 3299,
      originalPrice: 3799,
      image: 'https://images.unsplash.com/photo-1692300660883-c9e5c0fb8e26?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxjYW1lcmElMjBwaG90b2dyYXBoeSUyMGRpZ2l0YWx8ZW58MHwwfHx8MTc1Njg5NDk0MHww&ixlib=rb-4.1.0&q=85',
      rating: 4.8,
      reviews: 334,
      discount: 13,
      badge: 'احترافي'
    }
  ];

  const statsDefault: { label: string; value: string; icon: React.ReactNode }[] = useMemo(() => ([
    { label: "ضمان", value: "2 سنة", icon: <Shield className="w-5 h-5" /> },
    { label: "دعم فني", value: "24/7", icon: <Zap className="w-5 h-5" /> },
    { label: "علامة تجارية", value: "100+", icon: <Crown className="w-5 h-5" /> },
  ]), []);

  const defaultSlidesInit: HeroSlide[] = [
    {
      id: 1,
      title: "اكتشف عالم التكنولوجيا",
      subtitle: "أحدث المنتجات التقنية بأفضل الأسعار",
      description: "تشكيلة حصرية من الهواتف الذكية والأجهزة الإلكترونية المتطورة",
      ctaText: "تسوق الآن",
      ctaLink: "/products",
      bgGradient: "from-indigo-900 via-purple-900 to-pink-900",
      badge: "تقنية متطورة",
      features: ["ضمان سنتين", "شحن مجاني", "دعم فني 24/7"],
      products: [fakeProducts[0], fakeProducts[1], fakeProducts[5]],
      stats: [
        { label: "عميل راضي", value: "50K+", icon: <Users className="w-5 h-5" /> },
        { label: "منتج متاح", value: "10K+", icon: <Package className="w-5 h-5" /> },
        { label: "تقييم العملاء", value: "4.9★", icon: <Star className="w-5 h-5" /> }
      ]
    },
    {
      id: 2,
      title: "عروض لا تُفوت",
      subtitle: "خصومات هائلة تصل إلى 70%",
      description: "عروض محدودة الوقت على أفضل المنتجات العالمية",
      ctaText: "اشتري الآن",
      ctaLink: "/products?sale=true",
      bgGradient: "from-red-900 via-orange-800 to-amber-900",
      badge: "خصم 70%",
      features: ["عرض محدود", "خصم فوري", "توفير مضمون"],
      products: [fakeProducts[1], fakeProducts[3], fakeProducts[4]],
      stats: [
        { label: "خصم أقصى", value: "70%", icon: <Percent className="w-5 h-5" /> },
        { label: "وقت متبقي", value: "24:00", icon: <Clock className="w-5 h-5" /> },
        { label: "مبلغ موفر", value: "2500 ج.م", icon: <Gift className="w-5 h-5" /> }
      ]
    },
    {
      id: 3,
      title: "جودة عالمية مضمونة",
      subtitle: "منتجات أصلية من العلامات التجارية الرائدة",
      description: "ضمان شامل وخدمة عملاء متميزة على مدار الساعة",
      ctaText: "اطلع على الضمان",
      ctaLink: "/about",
      bgGradient: "from-emerald-900 via-teal-800 to-cyan-900",
      badge: "ضمان شامل",
      features: ["منتجات أصلية", "ضمان سنتين", "إرجاع مجاني"],
      products: [fakeProducts[2], fakeProducts[0], fakeProducts[3]],
      stats: [
        { label: "ضمان", value: "2 سنة", icon: <Shield className="w-5 h-5" /> },
        { label: "دعم فني", value: "24/7", icon: <Zap className="w-5 h-5" /> },
        { label: "علامة تجارية", value: "100+", icon: <Crown className="w-5 h-5" /> }
      ]
    }
  ];

  const cfgSlides = useMemo<HeroSlide[]>(() => {
    const s: ConfigSlide[] = (homeConfig?.slides || []) as ConfigSlide[];
    if (!s.length) return [];
    const themeMap: Record<string, string> = {
      premium: 'from-indigo-900 via-purple-900 to-pink-900',
      sale: 'from-red-900 via-orange-800 to-amber-900',
      quality: 'from-emerald-900 via-teal-800 to-cyan-900',
      custom: '',
    };
    return s
      .filter(x => x && x.enabled !== false)
      .map((x, i) => ({
        id: i + 1,
        title: x.title || '',
        subtitle: x.subtitle || '',
        description: '',
        ctaText: x.buttonText || 'تسوق الآن',
        ctaLink: x.buttonLink || '/products',
        bgGradient: x.bgGradient || themeMap[x.theme || 'premium'] || themeMap.premium,
        bgColor: x.bgColor || '',
        badge: x.badge || '',
        features: x.features || [],
        products: [],
        stats: statsDefault,
      }));
  }, [homeConfig, statsDefault]);

  // Prefill slides from cache to avoid initial blank while config loads
  const [cachedSlides, setCachedSlides] = useState<HeroSlide[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(HERO_CACHE_KEY);
      if (!raw) return [];
      const data = JSON.parse(raw) as { slides?: ConfigSlide[] };
      const s = (data?.slides || []) as ConfigSlide[];
      if (!s.length) return [];
      const themeMap: Record<string, string> = {
        premium: 'from-indigo-900 via-purple-900 to-pink-900',
        sale: 'from-red-900 via-orange-800 to-amber-900',
        quality: 'from-emerald-900 via-teal-800 to-cyan-900',
        custom: '',
      };
      return s
        .filter(x => x && x.enabled !== false)
        .map((x, i) => ({
          id: i + 1,
          title: x.title || '',
          subtitle: x.subtitle || '',
          description: '',
          ctaText: x.buttonText || 'تسوق الآن',
          ctaLink: x.buttonLink || '/products',
          bgGradient: x.bgGradient || themeMap[x.theme || 'premium'] || themeMap.premium,
          bgColor: x.bgColor || '',
          badge: x.badge || '',
          features: x.features || [],
          products: [],
          stats: statsDefault,
        }));
    } catch {
      return [];
    }
  });

  // Persist latest slides to cache when config updates
  useEffect(() => {
    const s: ConfigSlide[] = (homeConfig?.slides || []) as ConfigSlide[];
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(HERO_CACHE_KEY, JSON.stringify({ slides: s }));
      // Also hydrate cachedSlides once when empty and server has slides
      if (!cachedSlides.length && s.length) {
        const themeMap: Record<string, string> = {
          premium: 'from-indigo-900 via-purple-900 to-pink-900',
          sale: 'from-red-900 via-orange-800 to-amber-900',
          quality: 'from-emerald-900 via-teal-800 to-cyan-900',
          custom: '',
        };
        setCachedSlides(
          s.filter(x => x && x.enabled !== false).map((x, i) => ({
            id: i + 1,
            title: x.title || '',
            subtitle: x.subtitle || '',
            description: '',
            ctaText: x.buttonText || 'تسوق الآن',
            ctaLink: x.buttonLink || '/products',
            bgGradient: x.bgGradient || themeMap[x.theme || 'premium'] || themeMap.premium,
            bgColor: x.bgColor || '',
            badge: x.badge || '',
            features: x.features || [],
            products: [],
            stats: statsDefault,
          }))
        );
      }
    } catch {
      // ignore
    }
  }, [homeConfig?.slides, statsDefault, cachedSlides.length]);

  const noSlides = (homeConfig?.slides?.length || 0) === 0;

  // Choose the best available slides immediately: server -> cache -> defaults
  const heroSlides: HeroSlide[] = cfgSlides.length ? cfgSlides : (cachedSlides.length ? cachedSlides : defaultSlidesInit);

  const currentSlideData = heroSlides[currentSlide];

  // Also dispatch readiness if there are slides but no products required
  useEffect(() => {
    // Only dispatch if NOT loading (waiting for config)
    if (!loading && heroSlides.length > 0 && !heroReadyDispatchedRef.current) {
      heroReadyDispatchedRef.current = true;
      window.dispatchEvent(new Event('hero-ready'));
    }
  }, [heroSlides.length, loading]);

  // Ensure currentSlide is always within range when slides change
  useEffect(() => {
    const len = heroSlides.length;
    if (len === 0) return;
    if (currentSlide >= len) setCurrentSlide(0);
  }, [heroSlides.length, currentSlide]);

  // Fetch per-slide products by IDs (maintain chosen order) via React Query
  const heroReadyDispatchedRef = useRef(false);
  const slideIds = useMemo(() => {
    const slides = homeConfig?.slides || [];
    return Array.from(new Set(slides.flatMap(s => (s.productIds || []).filter(Boolean)))).map(String);
  }, [homeConfig?.slides]);
  const { map: productMapRQ, products: listRQ } = useProductsByIds(slideIds);

  const slideProducts = useMemo<Record<number, Product[]>>(() => {
    const slides = homeConfig?.slides || [];
    const out: Record<number, Product[]> = {};
    slides.forEach((s, idx) => {
      const ids = (s.productIds || []) as string[];
      out[idx] = ids
        .map((id) => productMapRQ.get(String(id)))
        .filter(Boolean)
        .map((p) => ({
          id: String(p!.id),
          name: p!.name,
          nameAr: p!.nameAr,
          price: p!.price,
          originalPrice: p!.originalPrice,
          image: p!.image,
          rating: p!.rating,
          reviews: p!.reviews,
        })) as Product[];
    });
    return out;
  }, [homeConfig?.slides, productMapRQ]);

  useEffect(() => {
    // Notify readiness once we have either some products or zero required IDs
    const slides = homeConfig?.slides || [];
    const need = slides.flatMap(s => (s.productIds || [])).length;
    const have = listRQ.length;

    // Only dispatch if NOT loading config
    if (!loading && !heroReadyDispatchedRef.current && (need === 0 || have > 0)) {
      heroReadyDispatchedRef.current = true;
      window.dispatchEvent(new Event('hero-ready'));
    }
  }, [homeConfig?.slides, listRQ.length, loading]);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Slide navigation with dramatic transitions
  const handleNextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setProgress(0);
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, heroSlides.length]);

  const handlePrevSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setProgress(0);
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, heroSlides.length]);

  const goToSlide = useCallback((index: number) => {
    if (isTransitioning || index === currentSlide) return;
    setIsTransitioning(true);
    setProgress(0);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 500);
  }, [isTransitioning, currentSlide]);

  // Touch gesture handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNextSlide();
    } else if (isRightSwipe) {
      handlePrevSlide();
    }
  }, [touchStart, touchEnd, handleNextSlide, handlePrevSlide]);

  // If mobile, use the dedicated mobile component - AFTER all hooks
  if (isMobile) {
    return <MobileHeroSection />;
  }

  const activeProducts = (() => {
    const configured = slideProducts[currentSlide];
    if (configured && configured.length) return configured;
    const preset = heroSlides[currentSlide]?.products;
    if (preset && preset.length) return preset;
    return fakeProducts.slice(0, 3);
  })();

  // Loading state or empty state with skeleton
  if (loading || noSlides) {
    return (
      <section className="relative h-[calc(100vh-64px)] overflow-hidden bg-slate-50">
        <div className="container mx-auto px-4 h-full">
          <div className="grid grid-cols-1 lg:grid-cols-12 h-full gap-8 items-center">
            {/* Left Column Skeleton (Product Marquee) */}
            <div className="hidden lg:block lg:col-span-5 h-[80%] relative">
              <div className="absolute inset-0 bg-slate-200/50 rounded-3xl animate-pulse overflow-hidden">
                <div className="h-full w-full flex flex-col gap-4 p-4 opacity-50">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex gap-4 items-center p-3 bg-white/40 rounded-xl">
                      <div className="w-16 h-16 bg-slate-300 rounded-lg" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-slate-300 rounded w-3/4" />
                        <div className="h-3 bg-slate-300 rounded w-1/2" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column Skeleton (Content) */}
            <div className="col-span-1 lg:col-span-7 space-y-8 text-center lg:text-right px-4 lg:px-12">
              <div className="space-y-4">
                <div className="h-4 bg-slate-200 rounded-full w-32 mx-auto lg:mx-0 animate-pulse" />
                <div className="h-12 md:h-16 bg-slate-200 rounded-2xl w-3/4 mx-auto lg:mx-0 animate-pulse" />
                <div className="h-12 md:h-16 bg-slate-200 rounded-2xl w-1/2 mx-auto lg:mx-0 animate-pulse" />
              </div>

              <div className="space-y-3 pt-4">
                <div className="h-4 bg-slate-200 rounded-full w-full animate-pulse" />
                <div className="h-4 bg-slate-200 rounded-full w-5/6 animate-pulse" />
              </div>

              <div className="pt-8 flex gap-4 justify-center lg:justify-start">
                <div className="h-14 w-40 bg-slate-200 rounded-xl animate-pulse" />
                <div className="h-14 w-40 bg-slate-200 rounded-xl animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      className="relative overflow-hidden"
      style={{
        height: isMobile ? 'min(100vh, 600px)' : 'calc(100vh - 64px)'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Background Slides with Dramatic Transitions */}
      <div className="absolute inset-0">
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${index === currentSlide
              ? 'opacity-100 scale-100 rotate-0'
              : 'opacity-0 scale-105 rotate-1'
              }`}
          >
            {(() => {
              const cfgSlide = homeConfig?.slides?.[index] as ConfigSlide | undefined;
              const col = cfgSlide?.bgColor;
              if (col && col.trim()) {
                return <div className="w-full h-full" style={{ backgroundColor: col }} />;
              }
              return (
                <div 
                  className={`w-full h-full bg-gradient-to-br ${slide.bgGradient}`} 
                  style={{ backgroundAttachment: 'fixed' }}
                />
              );
            })()}

            {/* Subtle overlay */}
            <div className={`absolute inset-0 bg-black/20 transition-opacity duration-1000 ${index === currentSlide ? 'opacity-100' : 'opacity-0'
              }`} />

            {/* Background Pattern per slide based on configured pattern key (deferred until mount) */}
            {mounted && (() => {
              const key = homeConfig?.slides?.[index]?.pattern as ("grid" | "circles" | "waves" | "custom" | undefined);
              if (key === 'custom') return null;
              const map: Record<string, number> = { grid: 0, circles: 1, waves: 2, dots: 3, diagonals: 4 };
              const pIndex = key ? map[key] : index % 3;
              return (
                <BackgroundPattern
                  slideIndex={pIndex}
                  isActive={index === currentSlide}
                />
              );
            })()}
          </div>
        ))}
      </div>

      {/* Main Content */}
      <div className="relative z-10 h-full flex items-stretch">
        <div className="container mx-auto px-6 h-full">
          {/* Desktop/Tablet Layout - Two Columns from md and up */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 lg:gap-12 items-stretch h-full" style={{ direction: 'ltr' }}>
            {/* Left Content - Products, animated vertical marquee */}
            <div className="md:col-start-1 md:col-end-6 relative h-full">
              <div className="h-full overflow-hidden flex items-center">
                <style>
                  {`
                  @keyframes hero-vertical-scroll {
                    from { transform: translate(-50%, -50%); }
                    to { transform: translate(-50%, calc(-50% - 100vh)); }
                  }
                  `}
                </style>
                <style>
                  {`.animated-product-hero { transform: scale(1.5); }`}
                </style>
                <div className="relative w-full" style={{ height: '100%' }}>
                  <div
                    className="absolute top-1/2 left-1/2"
                    style={{
                      animation: 'hero-vertical-scroll 8s linear infinite',
                      width: '100%',
                    }}
                  >
                    {[...activeProducts, ...activeProducts, ...activeProducts, ...activeProducts].map((product, index) => (
                      <div key={`${product.id}-${index}`} className="flex justify-center py-16 animated-product-hero">
                        <AnimatedProductCard
                          product={product}
                          index={index}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Content - Text, vertically centered */}
            <div className="md:col-start-6 md:col-end-13 flex items-center h-full" dir="rtl">
              {currentSlideData && (
                <SlideContent
                  slide={currentSlideData}
                  isActive={!isTransitioning}
                  isMobile={false}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <NavigationControls
        currentSlide={currentSlide}
        totalSlides={heroSlides.length}
        progress={progress}
        isAutoPlaying={isAutoPlaying}
        isTransitioning={isTransitioning}
        onPrevSlide={handlePrevSlide}
        onNextSlide={handleNextSlide}
        onGoToSlide={goToSlide}
        onToggleAutoPlay={() => setIsAutoPlaying(!isAutoPlaying)}
        isMobile={isMobile}
      />
    </section>
  );
};

export default ModernHeroSlider;
