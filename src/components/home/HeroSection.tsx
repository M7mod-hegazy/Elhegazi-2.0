import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ShoppingBag, Tag, Sparkles, Zap, Star, Play, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import type { Product } from '@/types';

const HeroSection = () => {
  const { hidePrices } = usePricingSettings();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Live products state via API
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const resp = await apiGet<Product>(`/api/products?featured=true&limit=5`);
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

  // Get featured products for carousel
  const featuredProducts = liveProducts.slice(0, 5);

  const heroSlides = [
    {
      title: 'أفضل المنتجات',
      subtitle: 'اكتشف مجموعتنا المميزة من المنتجات عالية الجودة',
      buttonText: 'تسوق الآن',
      buttonLink: '/products',
      image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200',
      product: featuredProducts[0]
    },
    {
      title: 'أسعار منافسة',
      subtitle: 'احصل على أفضل الأسعار مع ضمان الجودة والموثوقية',
      buttonText: 'العروض الخاصة',
      buttonLink: '/products?featured=true',
      image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=1200',
      product: featuredProducts[1]
    },
    {
      title: 'خدمة متميزة',
      subtitle: 'شحن سريع وخدمة عملاء على مدار الساعة',
      buttonText: 'اعرف المزيد',
      buttonLink: '/about',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=1200',
      product: featuredProducts[2]
    },
    {
      title: 'تكنولوجيا حديثة',
      subtitle: 'أحدث الأجهزة والتقنيات بين يديك',
      buttonText: 'تسوق التقنية',
      buttonLink: '/category/electronics',
      image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=1200',
      product: featuredProducts[3]
    },
    {
      title: 'أزياء عصرية',
      subtitle: 'أناقة وموضة تواكب أحدث الاتجاهات',
      buttonText: 'تسوق الأزياء',
      buttonLink: '/category/fashion',
      image: 'https://images.unsplash.com/photo-1445205170230-053b83016050?w=1200',
      product: featuredProducts[4]
    }
  ];

  // Auto-play functionality
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    }, 4000);

    return () => clearInterval(interval);
  }, [isAutoPlaying, heroSlides.length]);

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % heroSlides.length);
    setIsAutoPlaying(false);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + heroSlides.length) % heroSlides.length);
    setIsAutoPlaying(false);
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
  };

  const currentSlideData = heroSlides[currentSlide];

  return (
    <section className="relative overflow-hidden" style={{ height: 'calc(100vh - 64px)', minHeight: '600px' }}>
      {/* Simple loading/error overlay */}
      {loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/20 text-white">جارِ التحميل...</div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-red-600/20 text-red-100">{error}</div>
      )}
      {/* Animated Background Particles */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-pulse opacity-20"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 3}s`,
              animationDuration: `${3 + Math.random() * 4}s`
            }}
          >
            <Sparkles className="w-4 h-4 text-white" />
          </div>
        ))}
      </div>

      {/* Background with Enhanced Gradient Overlay */}
      <div className="absolute inset-0">
        <img
          src={optimizeImage(currentSlideData?.image || '', { w: 1200 })}
          alt={currentSlideData?.title}
          className="w-full h-full object-cover transition-all duration-1000 scale-105 animate-pulse"
          loading="lazy"
          decoding="async"
          srcSet={buildSrcSet(currentSlideData?.image || '', 1200)}
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/90 via-purple-900/80 to-blue-800/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      {/* Content */}
      <div className="relative z-10 h-full flex items-center">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text Content */}
            <div className="text-center lg:text-right space-y-8 animate-fade-in">
              {/* Animated Badge */}
              <div className="flex justify-center lg:justify-start">
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-bold px-4 py-2 animate-bounce">
                  <Zap className="w-4 h-4 mr-2" />
                  عروض حصرية
                </Badge>
              </div>

              <h1 className="text-5xl lg:text-7xl font-black text-white leading-tight">
                <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent animate-pulse">
                  {currentSlideData?.title}
                </span>
              </h1>

              <p className="text-xl lg:text-2xl text-white/90 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
                {currentSlideData?.subtitle}
              </p>
              
              <div className="flex flex-col sm:flex-row gap-6 justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full shadow-2xl transform hover:scale-105 transition-all duration-300 animate-pulse"
                  asChild
                >
                  <Link to={currentSlideData?.buttonLink || '/products'}>
                    <ShoppingBag className="w-6 h-6 ml-3" />
                    {currentSlideData?.buttonText}
                    <Star className="w-4 h-4 mr-2" />
                  </Link>
                </Button>

                <Button
                  size="lg"
                  variant="outline"
                  className="border-2 border-white text-white hover:bg-white hover:text-black font-bold py-4 px-8 rounded-full backdrop-blur-sm bg-white/10 transform hover:scale-105 transition-all duration-300"
                  asChild
                >
                  <Link to="/products?featured=true">
                    <Tag className="w-6 h-6 ml-3" />
                    العروض الخاصة
                  </Link>
                </Button>
              </div>

              {/* Product Preview */}
              {currentSlideData?.product && (
                <div className="bg-primary-foreground/10 backdrop-blur-sm rounded-card p-4 border border-primary-foreground/20">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <img
                      src={optimizeImage(currentSlideData.product.image, { w: 128 })}
                      alt={currentSlideData.product.nameAr}
                      className="w-16 h-16 object-cover rounded-button"
                      loading="lazy"
                      decoding="async"
                      srcSet={buildSrcSet(currentSlideData.product.image, 128)}
                      sizes="128px"
                    />
                    <div className="flex-1 text-right">
                      <h3 className="font-semibold text-primary-foreground">
                        {currentSlideData.product.nameAr}
                      </h3>
                      {!hidePrices && (
                        <div className="flex items-center space-x-2 space-x-reverse">
                          <span className="font-bold text-primary-foreground">
                            {currentSlideData.product.price ? currentSlideData.product.price.toLocaleString() : 'N/A'} ج.م
                          </span>
                          {currentSlideData.product.originalPrice && (
                            <span className="text-sm text-primary-foreground/70 line-through">
                              {currentSlideData.product.originalPrice.toLocaleString()} ج.م
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <Button 
                      size="sm" 
                      className="btn-primary bg-primary-foreground text-primary"
                      asChild
                    >
                      <Link to={`/product/${currentSlideData.product.id}`}>
                        عرض
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Featured Product Display */}
            <div className="hidden lg:block">
              {currentSlideData?.product && (
                <div className="card-elegant bg-card/90 backdrop-blur-sm animate-bounce-in">
                  <div className="aspect-square mb-4 overflow-hidden rounded-button">
                    <img
                      src={optimizeImage(currentSlideData.product.image, { w: 600 })}
                      alt={currentSlideData.product.nameAr}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      decoding="async"
                      srcSet={buildSrcSet(currentSlideData.product.image, 600)}
                      sizes="(max-width: 1024px) 80vw, 600px"
                    />
                  </div>
                  <h3 className="heading-3 mb-2">{currentSlideData.product.nameAr}</h3>
                  <p className="body-text mb-4 line-clamp-2">{currentSlideData.product.descriptionAr}</p>
                  <div className="flex items-center justify-between">
                    {!hidePrices && (
                      <div>
                        <span className="font-bold text-xl text-primary">
                          {currentSlideData.product.price ? currentSlideData.product.price.toLocaleString() : 'N/A'} ج.م
                        </span>
                        {currentSlideData.product.originalPrice && (
                          <span className="text-sm text-muted-foreground line-through mr-2">
                            {currentSlideData.product.originalPrice.toLocaleString()} ج.م
                          </span>
                        )}
                      </div>
                    )}
                    <Button size="sm" asChild>
                      <Link to={`/product/${currentSlideData.product.id}`}>
                        عرض التفاصيل
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        onClick={prevSlide}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 w-12 h-12 bg-primary-foreground/20 hover:bg-primary-foreground/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 ease-out"
      >
        <ChevronRight className="w-6 h-6 text-primary-foreground" />
      </button>
      
      <button
        onClick={nextSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 w-12 h-12 bg-primary-foreground/20 hover:bg-primary-foreground/30 backdrop-blur-sm rounded-full flex items-center justify-center transition-all duration-300 ease-out"
      >
        <ChevronLeft className="w-6 h-6 text-primary-foreground" />
      </button>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2 space-x-reverse">
        {heroSlides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ease-out ${
              index === currentSlide
                ? 'bg-primary-foreground'
                : 'bg-primary-foreground/40 hover:bg-primary-foreground/60'
            }`}
          />
        ))}
      </div>

      {/* Auto-play Indicator */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className="text-primary-foreground/80 hover:text-primary-foreground transition-all duration-300 ease-out text-sm"
        >
          {isAutoPlaying ? '⏸️ إيقاف' : '▶️ تشغيل'}
        </button>
      </div>
    </section>
  );
};

export default HeroSection;
