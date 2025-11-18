import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Star, Zap, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import type { Product } from '@/types';
import type { Slide } from '@/types/home-config';

interface EnhancedHeroSectionProps {
  slides?: Slide[];
  enabled?: boolean;
}

const EnhancedHeroSection = ({ slides, enabled = true }: EnhancedHeroSectionProps) => {
  const { hidePrices } = usePricingSettings();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useMemo(() => {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Live products state via API
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

  // Initial entrance animation trigger
  useEffect(() => {
    if (prefersReducedMotion) {
      setMounted(true);
      return;
    }
    const t = setTimeout(() => setMounted(true), 40);
    return () => clearTimeout(t);
  }, [prefersReducedMotion]);

  // Products already filtered by API
  const featuredProducts = liveProducts.slice(0, 4);

  // Use provided slides from HomeConfig (enabled ones only). Fallback to defaults if not provided or empty.
  const defaultSlides = [
    {
      id: 1,
      title: 'أحدث التقنيات في متناول يدك',
      subtitle: 'اكتشف مجموعة واسعة من الأجهزة الذكية والإلكترونيات المتطورة بأفضل الأسعار',
      buttonText: 'تسوق الآن',
      buttonLink: '/products',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
      bgGradient: 'from-blue-900/95 via-purple-900/90 to-indigo-900/95',
      accentColor: 'blue',
      product: featuredProducts[0]
    },
    {
      id: 2,
      title: 'عروض حصرية لفترة محدودة',
      subtitle: 'خصومات تصل إلى 50% على مجموعة مختارة من أفضل المنتجات',
      buttonText: 'اكتشف العروض',
      buttonLink: '/products?sale=true',
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=2126&q=80',
      bgGradient: 'from-emerald-900/95 via-teal-900/90 to-cyan-900/95',
      accentColor: 'emerald',
      product: featuredProducts[1]
    },
    {
      id: 3,
      title: 'جودة عالية وضمان شامل',
      subtitle: 'منتجات أصلية من أفضل العلامات التجارية العالمية مع ضمان الجودة',
      buttonText: 'تعرف على المزيد',
      buttonLink: '/about',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80',
      bgGradient: 'from-orange-900/95 via-red-900/90 to-pink-900/95',
      accentColor: 'orange',
      product: featuredProducts[2]
    },
    {
      id: 4,
      title: 'تشكيلة واسعة من المنتجات',
      subtitle: 'اكتشف أحدث الإضافات والعروض على أفضل العلامات التجارية',
      buttonText: 'اطلب الآن',
      buttonLink: '/products',
      image: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
      bgGradient: 'from-violet-900/95 via-purple-900/90 to-fuchsia-900/95',
      accentColor: 'violet',
      product: featuredProducts[3]
    }
  ];

  const mappedSlides = (slides || [])
    .filter((s) => s.enabled !== false)
    .map((s, idx) => ({
      id: idx + 1,
      title: s.title,
      subtitle: s.subtitle,
      buttonText: s.buttonText || 'تسوق الآن',
      buttonLink: s.buttonLink || '/products',
      image: s.image,
      // Keep gradients stable even with home-config slides
      bgGradient: ['from-blue-900/95 via-purple-900/90 to-indigo-900/95', 'from-emerald-900/95 via-teal-900/90 to-cyan-900/95', 'from-orange-900/95 via-red-900/90 to-pink-900/95', 'from-violet-900/95 via-purple-900/90 to-fuchsia-900/95'][idx % 4],
      accentColor: ['blue', 'emerald', 'orange', 'violet'][idx % 4],
      product: undefined,
    }));

  const heroSlides = (mappedSlides.length > 0 ? mappedSlides : defaultSlides);

  const currentSlideData = heroSlides[currentSlide];

  const handleNextSlide = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    setTimeout(() => setIsTransitioning(false), 800);
  }, [isTransitioning, heroSlides.length]);

  // Auto-play functionality
  useEffect(() => {
    if (isAutoPlaying) {
      intervalRef.current = setInterval(() => {
        handleNextSlide();
      }, 5000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isAutoPlaying, currentSlide, handleNextSlide]);

  const handlePrevSlide = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
    setTimeout(() => setIsTransitioning(false), 800);
  };

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentSlide) return;
    setIsTransitioning(true);
    setCurrentSlide(index);
    setTimeout(() => setIsTransitioning(false), 800);
  };

  if (!enabled) return null;

  return (
    <section className="relative overflow-hidden" style={{ height: 'calc(100vh - 64px)', minHeight: '600px' }}>
      {/* Simple loading/error overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 text-white">جارِ التحميل...</div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-600/20 text-red-100">{error}</div>
      )}
      {/* Background Slides */}
      <div className="absolute inset-0">
        {heroSlides.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === currentSlide 
                ? 'opacity-100 scale-100' 
                : 'opacity-0 scale-110'
            }`}
          >
            <img
              src={optimizeImage(slide.image || '', { w: 1200 })}
              alt={slide.title}
              className="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
              srcSet={buildSrcSet(slide.image || '', 1200)}
              sizes="100vw"
            />
            <div className={`absolute inset-0 bg-gradient-to-br ${slide.bgGradient}`} />
          </div>
        ))}
      </div>

      {/* Animated Particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 6}s`
            }}
          >
            <Star className="w-3 h-3 text-white" />
          </div>
        ))}
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div
              className={
                prefersReducedMotion
                  ? 'text-center lg:text-right space-y-8'
                  : `text-center lg:text-right space-y-8 transition-all duration-1200 ${
                      !mounted
                        ? 'opacity-0 translate-y-10'
                        : isTransitioning
                        ? 'opacity-0 translate-y-14'
                        : 'opacity-100 translate-y-0'
                    }`
              }
            >
              {/* Animated Badge */}
              <div
                className={
                  prefersReducedMotion
                    ? 'flex justify-center lg:justify-start'
                    : `flex justify-center lg:justify-start transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-8'}`
                }
                style={prefersReducedMotion ? undefined : { transitionDelay: '80ms' }}
              >
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-6 py-3 animate-bounce text-lg">
                  <Zap className="w-5 h-5 mr-3" />
                  عروض حصرية
                </Badge>
              </div>
              
              <h1
                className={
                  prefersReducedMotion
                    ? 'text-5xl lg:text-8xl font-black text-white leading-tight'
                    : `text-5xl lg:text-8xl font-black text-white leading-tight transition-all duration-900 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`
                }
                style={prefersReducedMotion ? undefined : { transitionDelay: '140ms' }}
              >
                <span className="bg-gradient-to-r from-white via-blue-200 to-purple-200 bg-clip-text text-transparent animate-gradient">
                  {prefersReducedMotion
                    ? currentSlideData?.title
                    : Array.from(currentSlideData?.title || '').map((ch, i) => (
                        <span
                          key={`${ch}-${i}`}
                          className={`inline-block transition-all duration-900 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
                          style={{ transitionDelay: `${140 + i * 40}ms` }}
                          aria-hidden="true"
                        >
                          {ch}
                        </span>
                      ))}
                </span>
              </h1>
              
              <p
                className={
                  prefersReducedMotion
                    ? 'text-xl lg:text-3xl text-white/90 max-w-3xl mx-auto lg:mx-0 leading-relaxed'
                    : `text-xl lg:text-3xl text-white/90 max-w-3xl mx-auto lg:mx-0 leading-relaxed transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`
                }
                style={prefersReducedMotion ? undefined : { transitionDelay: '240ms' }}
              >
                {currentSlideData?.subtitle}
              </p>

              {/* Enhanced CTA Buttons */}
              <div
                className={
                  prefersReducedMotion
                    ? 'flex flex-col sm:flex-row gap-6 justify-center lg:justify-start'
                    : `flex flex-col sm:flex-row gap-6 justify-center lg:justify-start transition-all duration-1000 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`
                }
                style={prefersReducedMotion ? undefined : { transitionDelay: '320ms' }}
              >
                <Button 
                  size="lg" 
                  asChild 
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-6 px-10 rounded-full shadow-2xl transform hover:scale-110 transition-all duration-300 animate-glow text-lg"
                >
                  <Link to={currentSlideData?.buttonLink || '/products'}>
                    <ShoppingBag className="w-6 h-6 mr-3" />
                    {currentSlideData?.buttonText}
                    <Star className="w-5 h-5 ml-3" />
                  </Link>
                </Button>
                
                <Button 
                  size="lg" 
                  variant="outline" 
                  asChild 
                  className="border-3 border-white text-white hover:bg-white hover:text-black font-bold py-6 px-10 rounded-full backdrop-blur-sm bg-white/10 transform hover:scale-110 transition-all duration-300 text-lg"
                >
                  <Link to="/products?featured=true">
                    <Star className="w-6 h-6 mr-3" />
                    المنتجات المميزة
                  </Link>
                </Button>
              </div>
            </div>

            {/* Product Showcase */}
            {currentSlideData?.product && (
              <div
                className={
                  prefersReducedMotion
                    ? 'hidden lg:block'
                    : `hidden lg:block transition-all duration-1200 ${
                        !mounted
                          ? 'opacity-0 translate-x-8 scale-95'
                          : isTransitioning
                          ? 'opacity-0 translate-x-14 scale-95'
                          : 'opacity-100 translate-x-0 scale-100'
                      }`
                }
                style={prefersReducedMotion ? undefined : { transitionDelay: '320ms' }}
              >
                <div className="bg-white/10 backdrop-blur-lg rounded-3xl p-8 border border-white/20 hover-lift">
                  <img
                    src={optimizeImage(currentSlideData.product.image, { w: 600 })}
                    alt={currentSlideData.product.nameAr}
                    className="w-full h-64 object-cover rounded-2xl mb-6 shadow-2xl"
                    loading="lazy"
                    decoding="async"
                    srcSet={buildSrcSet(currentSlideData.product.image, 600)}
                    sizes="(max-width: 1024px) 80vw, 600px"
                  />
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {currentSlideData.product.nameAr}
                  </h3>
                  <p className="text-white/80 mb-4 text-lg">
                    {currentSlideData.product.descriptionAr}
                  </p>
                  <div className="flex items-center justify-between">
                    {!hidePrices && (
                      <span className="text-3xl font-bold text-yellow-400">
                        {currentSlideData.product.price.toLocaleString()} ج.م
                      </span>
                    )}
                    <Button asChild className="bg-white text-black hover:bg-gray-100">
                      <Link to={`/product/${currentSlideData.product.id}`}>
                        عرض المنتج
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="flex items-center space-x-4 space-x-reverse">
          {/* Slide Indicators */}
          <div className="flex space-x-2 space-x-reverse">
            {heroSlides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`w-4 h-4 rounded-full transition-all duration-300 ${
                  index === currentSlide 
                    ? 'bg-white scale-125' 
                    : 'bg-white/50 hover:bg-white/75'
                }`}
              />
            ))}
          </div>

          {/* Play/Pause Button */}
          <button
            onClick={() => setIsAutoPlaying(!isAutoPlaying)}
            className="p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all duration-300"
          >
            {isAutoPlaying ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white" />
            )}
          </button>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={handlePrevSlide}
        disabled={isTransitioning}
        className="absolute left-6 top-1/2 transform -translate-y-1/2 z-20 p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all duration-300 disabled:opacity-50"
      >
        <ChevronRight className="w-6 h-6 text-white" />
      </button>

      <button
        onClick={handleNextSlide}
        disabled={isTransitioning}
        className="absolute right-6 top-1/2 transform -translate-y-1/2 z-20 p-4 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-all duration-300 disabled:opacity-50"
      >
        <ChevronLeft className="w-6 h-6 text-white" />
      </button>
    </section>
  );
};

export default EnhancedHeroSection;
