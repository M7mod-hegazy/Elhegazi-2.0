import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { gsap } from 'gsap';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { type CachedProduct } from '@/lib/productCache';
import { useProductsByIds } from '@/hooks/useProductsByIds';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import type { Product } from '@/types';
import { 
  ShoppingBag, 
  Crown,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import AnimatedProductCard from './AnimatedProductCard';
import BackgroundPattern from './BackgroundPattern';
import { useHomeConfig } from '@/hooks/useHomeConfig';
import type { Slide as ConfigSlide } from '@/types/home-config';

// Using shared Product type from '@/types'

interface MobileSlide {
  id: number;
  title: string;
  subtitle: string;
  ctaText: string;
  ctaLink: string;
  bgGradient: string;
  badge: string;
  product: Product;
  products: Product[];
}

// Single-track infinite belt powered by GSAP (matches PC hero approach)
const Belt: React.FC<{ products: Product[]; speedPxPerSec?: number; sets?: number; hidePrices?: boolean }> = ({ products, speedPxPerSec = 140, sets, hidePrices = false }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const tlRef = useRef<gsap.core.Tween | null>(null);
  const proxyRef = useRef<{ value: number }>({ value: 0 });
  const isVisibleRef = useRef<boolean>(true);
  const SPACING = 10;
  const CARD_W = 190; // match rendered card container width
  const CARD_H = 208; // match rendered card container height
  const prefersReducedMotion = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPEED = prefersReducedMotion ? Math.max(60, speedPxPerSec * 0.6) : speedPxPerSec;
  const SETS = Math.max(3, sets ?? 8); // allow caller to control sets
  const [containerH, setContainerH] = useState<number>(245);

  useEffect(() => {
    const layer = layerRef.current;
    const container = containerRef.current;
    if (!layer || !container) return;

    const items = itemRefs.current.filter(Boolean) as HTMLDivElement[];
    if (items.length === 0) return;

    // Measure width from first card
    const first = items[0];
    // Use fixed known card dimensions to avoid measuring before images load
    const cardWidthOnly = CARD_W;
    const cardHeightOnly = CARD_H;
    const itemWidth = cardWidthOnly + SPACING;
    const containerRect = container.getBoundingClientRect();
    const containerWidth = Math.max(300, Math.round(containerRect.width || 300));
    const measuredContainerH = Math.max(220, cardHeightOnly + 20);
    setContainerH(measuredContainerH);

    // Place items horizontally with absolute transform
    const offsetY = (measuredContainerH - cardHeightOnly) / 2;
    items.forEach((el, idx) => {
      gsap.set(el, {
        x: idx * itemWidth,
        y: offsetY,
        top: 0,
        left: 0,
        position: 'absolute',
        opacity: 1,
        willChange: 'transform',
        force3D: true,
      });
    });

    const loopDistance = items.length * itemWidth + containerWidth;

    // Start from current value if exists
    proxyRef.current.value = proxyRef.current.value % loopDistance;

    tlRef.current?.kill();
    tlRef.current = gsap.to(proxyRef.current, {
      value: "+=" + loopDistance,
      duration: loopDistance / SPEED,
      ease: 'none',
      repeat: -1,
      onUpdate: () => {
        const v = proxyRef.current.value % loopDistance;
        items.forEach((el, idx) => {
          const rawX = idx * itemWidth - v;
          const x = rawX < -cardWidthOnly ? rawX + loopDistance : rawX;
          gsap.set(el, { x });
        });
      },
    });

    // Pause/resume when off-screen
    const io = new IntersectionObserver((entries) => {
      const vis = entries.some(e => e.isIntersecting);
      isVisibleRef.current = vis;
      if (tlRef.current) {
        if (vis) tlRef.current.play();
        else tlRef.current.pause();
      }
    }, { root: null, threshold: 0.05 });
    io.observe(container);

    return () => {
      tlRef.current?.kill();
      tlRef.current = null;
      io.disconnect();
    };
  }, [products, SPEED]);

  // Build minimal virtualized sequence: only what's visible + buffer
  const virtualCount = Math.max(3, Math.ceil((typeof window !== 'undefined' ? window.innerWidth : 360) / (CARD_W + SPACING)) + 4);
  const seq = Array.from({ length: Math.max(virtualCount, products.length) }, (_, i) => products[i % products.length]);

  // reset refs length to seq length to avoid stale refs
  itemRefs.current = Array(seq.length).fill(null);

  if (products.length === 0) {
    return (
      <section 
        className="relative overflow-hidden h-[calc(100vh-4rem)] max-h-[700px] min-h-[450px] flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
        <div className="relative z-10 px-6 py-8 bg-black/30 rounded-xl border border-white/10 text-white/90 text-center">
          لا توجد شرائح مضافة بعد. يرجى إضافة شريحة من لوحة التحكم.
        </div>
      </section>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{ width: '100dvw', marginLeft: 'calc(50% - 50dvw)', marginRight: 'calc(50% - 50dvw)' }}
    >
      <div ref={containerRef} className="relative py-3 px-0" style={{ height: containerH }}>
        <div ref={layerRef} className="absolute inset-0" style={{ pointerEvents: 'auto' }}>
          {seq.map((p, idx) => {
            type CardProduct = {
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
            };
            type Loose = Partial<{
              image: string;
              images: string[];
              rating: number;
              reviews: number;
              discount: number;
              badge: string;
              originalPrice: number;
            }>;
            const lp = (p as unknown as Loose) || {};
            const imageSrc = lp.image ?? (Array.isArray(lp.images) ? lp.images[0] : undefined) ?? '';
            const cardProduct: CardProduct = {
              id: String(p.id),
              name: p.name || p.nameAr || '',
              nameAr: p.nameAr || p.name || '',
              price: Number((p as Product).price ?? 0),
              originalPrice: lp.originalPrice,
              image: imageSrc,
              rating: Number(lp.rating ?? 4.7),
              reviews: Number(lp.reviews ?? 0),
              discount: lp.discount,
              badge: lp.badge,
            };
            return (
              <div
                key={`${p.id}-${idx}`}
                ref={(el) => (itemRefs.current[idx] = el)}
                className="w-[190px]"
                style={{ height: 208 }}
              >
                <AnimatedProductCard product={cardProduct} index={idx} className="scale-100 origin-center" hidePrices={hidePrices} />
              </div>
            );
          })}
        </div>
        {/* Edge fades removed for true full-bleed */}
      </div>
    </div>
  );
};

const MobileHeroSection: React.FC = () => {
  const { hidePrices } = usePricingSettings();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [beltSets, setBeltSets] = useState(4); // start light, hydrate later
  const heroReadyDispatchedRef = useRef(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  

  // (removed: marquee sizing logic)

  // (moved below currentSlideData)

  // Mobile-optimized fake products (fallback if API is empty)
  const mobileProducts: Product[] = [
    {
      id: '1',
      name: 'Premium Smartphone',
      nameAr: 'هاتف ذكي متميز',
      description: 'High-end smartphone with advanced features',
      descriptionAr: 'هاتف ذكي رائد بمميزات متقدمة',
      price: 2999,
      originalPrice: 3499,
      image: 'https://images.unsplash.com/photo-1598327105666-5b89351aff97?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwxfHxzbWFydHBob25lJTIwbW9iaWxlJTIwcGhvbmUlMjB0ZWNobm9sb2d5fGVufDB8MXx8fDE3NTY4OTQ5NDB8MA&ixlib=rb-4.1.0&q=85',
      images: [],
      category: 'electronics',
      categoryAr: 'إلكترونيات',
      featured: true,
      discount: 15,
      rating: 4.8,
      reviews: 1250,
      tags: ['phone'],
      sku: 'SKU-1',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '2',
      name: 'Wireless Headphones',
      nameAr: 'سماعات لاسلكية',
      description: 'Comfortable wireless headphones with long battery life',
      descriptionAr: 'سماعات مريحة بعمر بطارية طويل',
      price: 899,
      originalPrice: 1199,
      image: 'https://images.unsplash.com/photo-1608148118722-56da485f9e84?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHw0fHxoZWFkcGhvbmVzJTIwd2lyZWxlc3MlMjBhdWRpb3xlbnwwfDB8fHwxNzU2ODk0OTQwfDA&ixlib=rb-4.1.0&q=85',
      images: [],
      category: 'audio',
      categoryAr: 'صوتيات',
      featured: true,
      discount: 25,
      rating: 4.6,
      reviews: 890,
      tags: ['audio'],
      sku: 'SKU-2',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: '3',
      name: 'Luxury Watch',
      nameAr: 'ساعة فاخرة',
      description: 'Elegant luxury watch with premium materials',
      descriptionAr: 'ساعة فاخرة بمواد متميزة',
      price: 1599,
      originalPrice: 1999,
      image: 'https://images.unsplash.com/photo-1623391306881-7bdb8f98f738?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTAwNDR8MHwxfHNlYXJjaHwzfHx3YXRjaCUyMGx1eHVyeSUyMHRpbWVwaWVjZXxlbnwwfDJ8fHwxNzU2ODk0OTQwfDA&ixlib=rb-4.1.0&q=85',
      images: [],
      category: 'accessories',
      categoryAr: 'إكسسوارات',
      featured: true,
      discount: 20,
      rating: 4.9,
      reviews: 456,
      tags: ['watch'],
      sku: 'SKU-3',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
  ];

  // Live products state via API (to match desktop)
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await apiGet<Product>(`/api/products?featured=true&limit=4`);
        if (resp.ok) {
          const items = (resp.items || []) as Product[];
          if (mounted) setLiveProducts(items);
        } else {
          if (mounted) setError(('error' in resp && resp.error) || 'Failed to load products');
        }
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Mobile-specific slides (fallback only; will not be used when admin slides exist)
  const fallbackSlides: MobileSlide[] = [
    {
      id: 1,
      title: "تكنولوجيا متطورة",
      subtitle: "أحدث الهواتف الذكية",
      ctaText: "تسوق الآن",
      ctaLink: "/products",
      bgGradient: "from-indigo-600 via-purple-600 to-pink-600",
      badge: "جديد",
      product: mobileProducts[0],
      products: [mobileProducts[0], mobileProducts[1], mobileProducts[2]]
    },
    {
      id: 2,
      title: "عروض حصرية",
      subtitle: "خصومات تصل إلى 70%",
      ctaText: "اشتري الآن",
      ctaLink: "/products?sale=true",
      bgGradient: "from-red-500 via-orange-500 to-yellow-500",
      badge: "خصم 70%",
      product: mobileProducts[1],
      products: [mobileProducts[1], mobileProducts[2], mobileProducts[0]]
    },
    {
      id: 3,
      title: "جودة مضمونة",
      subtitle: "منتجات أصلية فقط",
      ctaText: "اطلع على الضمان",
      ctaLink: "/about",
      bgGradient: "from-emerald-500 via-teal-500 to-cyan-500",
      badge: "ضمان شامل",
      product: mobileProducts[2],
      products: [mobileProducts[2], mobileProducts[0], mobileProducts[1]]
    }
  ];

  // Load slides from HomeConfig (shared with desktop). Fallback to local defaults
  const { homeConfig } = useHomeConfig();
  const cfgSlides: MobileSlide[] = (homeConfig?.slides || [])
    .filter((s: ConfigSlide) => s && s.enabled !== false)
    .map((s: ConfigSlide, i: number) => ({
      id: i + 1,
      title: s.title || '',
      subtitle: s.subtitle || '',
      ctaText: s.buttonText || 'تسوق الآن',
      ctaLink: s.buttonLink || '/products',
      bgGradient: (s.bgGradient || (s.theme === 'sale' ? 'from-red-500 via-orange-500 to-yellow-500' : s.theme === 'quality' ? 'from-emerald-500 via-teal-500 to-cyan-500' : 'from-indigo-600 via-purple-600 to-pink-600')),
      badge: s.badge || '',
      product: mobileProducts[0],
      products: [mobileProducts[0], mobileProducts[1], mobileProducts[2]],
    }));
  const mobileSlides: MobileSlide[] = cfgSlides;
  const noSlides = mobileSlides.length === 0;
  const clampedIndex = noSlides ? 0 : Math.min(currentSlide, mobileSlides.length - 1);
  const currentSlideData: MobileSlide | null = noSlides ? null : mobileSlides[clampedIndex];
  const currentProduct: Product | undefined =
    (liveProducts[clampedIndex] as Product) || (currentSlideData ? currentSlideData.product : undefined);

  // Fetch per-slide products (maintain chosen order per admin) via React Query
  const slideIds = useMemo(() => {
    const slides = (homeConfig?.slides || []) as ConfigSlide[];
    return Array.from(new Set(slides.flatMap(s => (s.productIds || []).filter(Boolean)))).map(String);
  }, [homeConfig?.slides]);
  const { map: productMapRQ, products: listRQ } = useProductsByIds(slideIds);
  const slideProducts = useMemo<Record<number, Product[]>>(() => {
    const slides = (homeConfig?.slides || []) as ConfigSlide[];
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

  // Mark hero ready once we have data or none is needed
  useEffect(() => {
    const slides = (homeConfig?.slides || []) as ConfigSlide[];
    const need = slides.flatMap(s => (s.productIds || [])).length;
    const have = listRQ.length;
    if (!heroReadyDispatchedRef.current && (need === 0 || have > 0)) {
      heroReadyDispatchedRef.current = true;
      window.dispatchEvent(new Event('hero-ready'));
    }
  }, [homeConfig?.slides, listRQ.length]);

  // If there are slides but no products are required, mark hero ready
  useEffect(() => {
    const slides = (homeConfig?.slides || []) as ConfigSlide[];
    if (slides.length > 0 && !heroReadyDispatchedRef.current) {
      heroReadyDispatchedRef.current = true;
      window.dispatchEvent(new Event('hero-ready'));
    }
  }, [homeConfig?.slides]);

  // Products for animated belt: use per-slide selection; fallback to slide products
  const beltProducts: Product[] = (slideProducts[clampedIndex]?.length
    ? slideProducts[clampedIndex]
    : (currentSlideData ? currentSlideData.products : [])) as Product[];

  // (removed: marquee duration computation)

  // (mobileSlides moved above)

  useEffect(() => {
    setMounted(true);
    // Persist a splash (reload screen) until the site fully loads
    const onWindowLoad = () => {
      // Hide splash on next frame to ensure everything painted
      requestAnimationFrame(() => setShowSplash(false));
    };
    // If already loaded (e.g., SPA navigation), still delay one frame to avoid flashes
    if (document.readyState === 'complete') {
      requestAnimationFrame(() => setShowSplash(false));
    } else {
      window.addEventListener('load', onWindowLoad, { once: true });
    }
    // Safety fallback: never keep splash forever (in case 'load' doesn't fire)
    const fallback = setTimeout(() => setShowSplash(false), 5000);
    // Progressive hydration for belt items (simple timeout to avoid vendor types)
    const hydrateTimer = setTimeout(() => setBeltSets(8), 1200);
    return () => {
      window.removeEventListener('load', onWindowLoad);
      clearTimeout(fallback);
      clearTimeout(hydrateTimer);
    };
  }, []);

  // Auto-play for mobile with progress tracking (keep same timing as desktop feel)
  useEffect(() => {
    if (isAutoPlaying && mounted) {
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            setCurrentSlide((prevSlide) => (prevSlide + 1) % mobileSlides.length);
            return 0;
          }
          return prev + (100 / (30000 / 50)); // 30 seconds total, update every 50ms
        });
      }, 50);
      return () => clearInterval(progressInterval);
    } else {
      setProgress(0);
    }
  }, [isAutoPlaying, mounted, mobileSlides.length]);

  // Pure CSS marquee requires no JS setup or cleanup

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
      // Next slide
      setCurrentSlide((prev) => (prev + 1) % mobileSlides.length);
      setProgress(0);
    } else if (isRightSwipe) {
      // Previous slide
      setCurrentSlide((prev) => (prev - 1 + mobileSlides.length) % mobileSlides.length);
      setProgress(0);
    }
  }, [touchStart, touchEnd, mobileSlides.length]);

  const handleSlideClick = (index: number) => {
    setCurrentSlide(index);
    setProgress(0);
  };

  const toggleAutoPlay = () => {
    setIsAutoPlaying(!isAutoPlaying);
    if (isAutoPlaying) {
      setProgress(0);
    }
  };

  // Render empty state after all hooks are declared
  if (noSlides || !currentSlideData) {
    return (
      <section 
        className="relative overflow-hidden h-[calc(100vh-4rem)] max-h-[700px] min-h-[450px] flex items-center justify-center"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-800 to-slate-900" />
        <div className="relative z-10 px-6 py-8 bg-black/30 rounded-xl border border-white/10 text-white/90 text-center">
          لا توجد شرائح مضافة بعد. يرجى إضافة شريحة من لوحة التحكم.
        </div>
      </section>
    );
  }

  return (
    <section 
      className="relative overflow-hidden h-[calc(100vh-4rem)] max-h-[700px] min-h-[450px]"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Persistent Reload Splash: stays until window 'load' or fallback timeout */}
      {showSplash && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gradient-to-br from-slate-900 to-black">
          <div className="text-center">
            <div className="w-14 h-14 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <div className="text-white/90 font-semibold">جاري تحميل الصفحة...</div>
          </div>
        </div>
      )}
      {/* Background with Enhanced Animations */}
      <div className="absolute inset-0">
        {mobileSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === currentSlide 
                ? 'opacity-100 scale-100 rotate-0' 
                : 'opacity-0 scale-105 rotate-1'
            }`}
          >
            {(() => {
              const cfgSlide = (homeConfig?.slides?.[index] as ConfigSlide | undefined);
              const col = cfgSlide?.bgColor;
              if (col && col.trim()) {
                return <div className="w-full h-full" style={{ backgroundColor: col }} />;
              }
              return <div className={`w-full h-full bg-gradient-to-br ${slide.bgGradient}`} />;
            })()}
            <div className="absolute inset-0 bg-black/30" />
            {/* Match desktop hero background pattern via admin pattern key (render only for current slide) */}
            {mounted && index === currentSlide && (() => {
              const key = (homeConfig?.slides?.[index] as ConfigSlide | undefined)?.pattern;
              if (key === 'custom') return null;
              const map: Record<string, number> = { grid: 0, circles: 1, waves: 2, dots: 3, diagonals: 4 };
              const pIndex = key ? map[key] : index % 3;
              return (
                <BackgroundPattern slideIndex={pIndex} isActive={index === currentSlide} />
              );
            })()}
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-center px-4 pt-2 pb-16" dir="rtl">
        {/* Auto-play toggle removed on mobile */}

        {/* Progress bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-white/20 z-20">
          <div 
            className="h-full bg-white transition-all duration-75 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex-1 grid grid-rows-[auto_1fr] place-items-center gap-1">
          <div className="text-center space-y-1 max-w-sm mx-auto row-start-1 self-center">
          {/* Badge */}
          <div 
            className={`transition-all duration-500 ${
              mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/25 backdrop-blur-sm rounded-full border border-white/20">
              <Crown className="w-3 h-3 text-white" />
              <span className="text-white font-medium text-xs">
                {currentSlideData?.badge || ''}
              </span>
            </div>
          </div>

            {/* Title (RTL animation: right-to-left word entrance) */}
            <h1 className="text-2xl md:text-3xl font-black text-white leading-tight">
              {(currentSlideData?.title ?? '').split(' ').map((word, idx) => (
                <span
                  key={`${word}-${idx}`}
                  className={`inline-block mx-1 transition-all duration-700 ${
                    mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-8'
                  }`}
                  style={{ transitionDelay: `${150 + idx * 60}ms` }}
                >
                  {word}
                </span>
              ))}
            </h1>

            {/* Subtitle (RTL slide-in) */}
            <p 
              className={`text-base text-white/90 leading-relaxed transition-all duration-700 ${
                mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
              }`}
              style={{ transitionDelay: '350ms' }}
            >
              {currentSlideData?.subtitle || ''}
            </p>

            {/* Product RTL Animated Belt (single track, seamless loop via rAF) */}
            <div
              className={`mt-2 transition-all duration-800 ${
                mounted ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
              }`}
              style={{ transitionDelay: '500ms' }}
            >
              {/* Loading/Error banners (non-blocking) */}
              {loading && (
                <div className="mb-2 text-white/80 text-xs">جاري تحميل المنتجات المميزة...</div>
              )}
              {error && !loading && (
                <div className="mb-2 text-red-200 text-xs">تعذر تحميل المنتجات ({error}) — سيتم عرض منتجات افتراضية</div>
              )}
              <Belt products={beltProducts} speedPxPerSec={200} sets={beltSets} hidePrices={hidePrices} />
            </div>
          </div>
          {/* New brand animation row removed; focus on RTL animated heading/subtitle only */}

          <div className="text-center space-y-3 max-w-sm mx-auto row-start-2 self-center">
            {/* Enhanced CTA Button */}
            <div 
              className={`transition-all duration-1000 ${
                mounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-95'
              }`}
              style={{ transitionDelay: '800ms' }}
            >
              <Button
                asChild
                className="relative z-10 mt-2 bg-white text-black hover:bg-gray-100 font-semibold rounded-xl shadow-lg transition-all duration-300 px-6 py-3 text-sm hover:scale-105 hover:shadow-xl"
              >
                <Link to={currentSlideData?.ctaLink || '/products'} className="flex items-center gap-2 text-black hover:text-black">
                  <ShoppingBag className="w-4 h-4 text-black" />
                  <span className="text-black">{currentSlideData?.ctaText || 'تسوق الآن'}</span>
                  <ArrowRight className="w-3 h-3 text-black transition-transform duration-300 group-hover:translate-x-1" />
                </Link>
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom-centered controls: arrows flanking bullets */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-full flex items-center justify-center gap-4 px-4">
          <button
            onClick={() => { setCurrentSlide((s) => (s + 1) % mobileSlides.length); setProgress(0); }}
            className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/30 transition-all duration-300"
          >
            <ChevronRight className="w-5 h-5 text-white" />
          </button>

          <div className="flex items-center gap-3">
            {mobileSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => handleSlideClick(index)}
                className={`h-2 rounded-full transition-all duration-500 hover:scale-125 ${
                  index === currentSlide
                    ? 'bg-white w-8 shadow-lg'
                    : 'bg-white/40 w-2 hover:bg-white/60'
                }`}
              />
            ))}
          </div>

          <button
            onClick={() => { setCurrentSlide((s) => (s - 1 + mobileSlides.length) % mobileSlides.length); setProgress(0); }}
            className="p-3 bg-white/20 backdrop-blur-md rounded-full border border-white/30 hover:bg-white/30 transition-all duration-300"
          >
            <ChevronLeft className="w-5 h-5 text-white" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default MobileHeroSection;