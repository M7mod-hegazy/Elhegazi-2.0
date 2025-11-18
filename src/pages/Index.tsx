import { useEffect, useMemo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Truck, Shield, Award, Eye, TrendingUp, Crown, Flame, Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ModernHeroSlider from '@/components/home/ModernHeroSlider';
import CreativeCategoriesSlider from '@/components/home/CreativeCategoriesSlider';
import CreativeProductsSlider from '@/components/home/CreativeProductsSlider';
import PromoStrip from '@/components/home/PromoStrip';
import ScrollAnimation from '@/components/ui/scroll-animation';
import EnhancedScrollAnimation from '@/components/ui/enhanced-scroll-animation';
import ParallaxSection from '@/components/ui/parallax-section';
import InteractiveBackground from '@/components/ui/interactive-background';
import SectionDivider from '@/components/ui/section-divider';
import { useHomeConfig } from '@/hooks/useHomeConfig';
import { useSettings } from '@/hooks/useSettings';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ResponsiveProvider } from '@/context/ResponsiveContext';

const Index = () => {
  // Only locations come from Settings now; About/WorkHours are provided by HomeConfig
  const { getBranchLocations } = useSettings();
  const [selectedBranch, setSelectedBranch] = useState('riyadh');
  const [pageEnter, setPageEnter] = useState(false);
  const [tick, setTick] = useState(0);

  // Set page title (home page uses just site name)
  usePageTitle();
  
  // HomeConfig via hook
  const { homeConfig: homeCfg, about, workHours, getCurrentStatus } = useHomeConfig();
  const prefersReducedMotion = useMemo(() => {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  // Page enter animation trigger (fade container in)
  useEffect(() => {
    const t = setTimeout(() => setPageEnter(true), 40);
    return () => { clearTimeout(t); };
  }, []);

  // Live status tick (each minute)
  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  // Force periodic re-render so getCurrentStatus reflects time without duplicating logic
  const [_live, _setLive] = useState(0);
  useEffect(() => {
    const id = setInterval(() => _setLive((v) => v + 1), 60000);
    return () => clearInterval(id);
  }, []);

  const toggles = useMemo(() => {
    const map: Record<string, boolean> = {};
    (homeCfg?.toggles || []).forEach((t) => { map[t.key] = !!t.enabled; });
    return map;
  }, [homeCfg]);

  // Section content config and icon mapping
  const sectionCfg = homeCfg?.sections || {};
  const iconMap: Record<string, JSX.Element> = {
    'crown': <Crown className="w-12 h-12 text-white" />,
    'trending-up': <TrendingUp className="w-12 h-12 text-white" />,
    'flame': <Flame className="w-12 h-12 text-white" />,
    'gift': <Gift className="w-12 h-12 text-white" />,
  };
  const getIcon = (name?: string, fallback: JSX.Element = <Crown className="w-12 h-12 text-white" />) => {
    const key = (name || '').toLowerCase();
    return iconMap[key] || fallback;
  };

  // Sections order
  const defaultOrder = useMemo(() => ['hero','promoStrip','categories','featuredProducts','bestSellers','sale','newArrivals','about','locations'], []);
  const sectionsOrder = useMemo(() => (homeCfg?.sectionsOrder && homeCfg.sectionsOrder.length ? homeCfg.sectionsOrder : defaultOrder), [homeCfg, defaultOrder]);
  // Merge configured order with defaults to avoid missing sections
  const sectionsOrderSafe = useMemo(() => {
    const fromCfg = Array.isArray(sectionsOrder) ? sectionsOrder : [];
    const seen = new Set<string>();
    const merged: string[] = [];
    // keep configured order but only valid keys
    for (const key of fromCfg) {
      if (defaultOrder.includes(key) && !seen.has(key)) {
        merged.push(key);
        seen.add(key);
      }
    }
    // append any missing default sections
    for (const key of defaultOrder) {
      if (!seen.has(key)) merged.push(key);
    }
    return merged;
  }, [sectionsOrder, defaultOrder]);

  // Apply SEO from HomeConfig
  useEffect(() => {
    if (!homeCfg) return;
    if (homeCfg.seoTitle) {
      document.title = homeCfg.seoTitle;
    }
    if (homeCfg.seoDescription) {
      let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
      if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'description';
        document.head.appendChild(meta);
      }
      meta.content = homeCfg.seoDescription;
    }
  }, [homeCfg]);

  // Get dynamic branch locations from admin settings
  const branchLocations = getBranchLocations();
  const branchKeys = Object.keys(branchLocations);
  // Ensure selectedBranch is a valid key; default to first available
  useEffect(() => {
    if (!branchKeys.length) return;
    if (!branchLocations[selectedBranch]) {
      setSelectedBranch(branchKeys[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchKeys.join('|')]);
  const currentBranch = branchLocations[selectedBranch] || (branchKeys.length ? branchLocations[branchKeys[0]] : undefined);

  // Note: Featured products/categories are now sourced within their own components via API.

  const features = [
    {
      icon: <Truck className="w-10 h-10 text-white" />,
      title: 'شحن سريع ومجاني',
      description: 'توصيل مجاني للطلبات أكثر من 200 ريال في جميع أنحاء المملكة',
      color: 'from-primary to-cyan-500',
      delay: 0
    },
    {
      icon: <Shield className="w-10 h-10 text-white" />,
      title: 'ضمان الجودة',
      description: 'جميع منتجاتنا أصلية ومضمونة مع ضمان شامل',
      color: 'from-success to-success',
      delay: 200
    },
    {
      icon: <Award className="w-10 h-10 text-white" />,
      title: 'أفضل الأسعار',
      description: 'أسعار تنافسية مع ضمان أفضل قيمة مقابل المال',
      color: 'from-secondary to-secondary',
      delay: 600
    }
  ];

  const stats = [
    { number: '50,000+', label: 'عميل راضي' },
    { number: '10,000+', label: 'منتج متاح' },
    { number: '100+', label: 'علامة تجارية' }
  ];

  // Build per-section blocks
  const heroBlock = (
    <div className={`page-transition ${pageEnter ? 'loaded' : ''} relative overflow-hidden`}>
      <ModernHeroSlider />
    </div>
  );
  const promoStripBlock = homeCfg?.promoEnabled && homeCfg?.promoText ? (
    <EnhancedScrollAnimation animation="slideInDown" duration={700} delay={60}>
      <PromoStrip text={homeCfg.promoText} icon={homeCfg.promoIcon} />
    </EnhancedScrollAnimation>
  ) : null;
  const categoriesBlock = (
    <EnhancedScrollAnimation animation="slideInUp" duration={900} delay={100}>
      <CreativeCategoriesSlider selectedSlugs={homeCfg?.featuredCategorySlugs} />
    </EnhancedScrollAnimation>
  );
  const featuredBlock = toggles['featuredProducts'] !== false ? (
    <section className="relative py-8 md:py-12 bg-white overflow-hidden">
      {/* Simple gradient line divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      {/* MEGA Enhanced Background with Mesh Gradient */}
      <div className="absolute inset-0 opacity-30" style={{backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(var(--primary-rgb, 59, 130, 246), 0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(var(--secondary-rgb, 168, 85, 247), 0.1) 0%, transparent 50%)'}}></div>
      
      {/* Multi-layer Parallax Orbs */}
      <ParallaxSection speed={-0.2} intensity="strong" scale className="absolute inset-0 opacity-50">
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-full blur-3xl animate-pulse"></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.4} intensity="strong" scale className="absolute inset-0 opacity-40">
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-gradient-to-tl from-secondary/10 via-secondary/5 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.6} className="absolute inset-0 opacity-30">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-r from-primary/8 to-secondary/8 rounded-full blur-2xl"></div>
      </ParallaxSection>
      
      {/* Floating Particles System */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(25)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-float"
            style={{
              width: `${Math.random() * 4 + 2}px`,
              height: `${Math.random() * 4 + 2}px`,
              background: i % 3 === 0 ? 'hsl(var(--primary))' : i % 3 === 1 ? 'hsl(var(--secondary))' : 'hsl(var(--primary))',
              opacity: Math.random() * 0.3 + 0.1,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${5 + Math.random() * 15}s`
            }}
          />
        ))}
      </div>
      
      {/* Interactive Crown/Star Effect */}
      <InteractiveBackground type="featured" className="opacity-60" />
      
      {/* Geometric Shapes Instead of Icons */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${10 + i * 12}%`,
              top: `${20 + (i % 3) * 25}%`,
              animationDelay: `${i * 1.2}s`,
              animationDuration: `${12 + i * 2}s`
            }}
          >
            <div className="w-16 h-16 border-4 border-primary rounded-lg rotate-45" style={{animation: 'spin 10s linear infinite'}} />
          </div>
        ))}
      </div>
      <EnhancedScrollAnimation animation="slideInRight" duration={1000} delay={120}>
        <CreativeProductsSlider
          title={sectionCfg.featuredProducts?.title || 'المنتجات المميزة'}
          subtitle={sectionCfg.featuredProducts?.subtitle || 'اكتشف أفضل منتجاتنا المختارة بعناية لتلبية احتياجاتك'}
          filterType="featured"
          gradientFrom="from-primary"
          gradientTo="to-secondary"
          icon={getIcon(sectionCfg.featuredProducts?.icon, <Crown className="w-12 h-12 text-white" />)}
          selectedIds={homeCfg?.featuredProductIds}
        />
      </EnhancedScrollAnimation>
    </section>
  ) : null;
  const bestSellersBlock = toggles['bestSellers'] !== false ? (
    <section className="relative py-8 md:py-12 bg-slate-50 overflow-hidden">
      {/* Simple gradient line divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
      {/* MEGA Grid Pattern with Parallax */}
      <ParallaxSection speed={-0.15} intensity="medium" className="absolute inset-0 opacity-[0.04]" style={{backgroundImage: 'radial-gradient(circle, #000 1.5px, transparent 1.5px)', backgroundSize: '30px 30px'}}></ParallaxSection>
      <ParallaxSection speed={-0.25} intensity="medium" className="absolute inset-0 opacity-[0.02]" style={{backgroundImage: 'linear-gradient(90deg, rgba(0,0,0,0.02) 1px, transparent 1px), linear-gradient(rgba(0,0,0,0.02) 1px, transparent 1px)', backgroundSize: '50px 50px'}}></ParallaxSection>
      
      {/* Trending Fire Effect */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-3 h-3 bg-gradient-to-t from-success via-yellow-400 to-transparent rounded-full blur-sm animate-pulse"
            style={{
              left: `${10 + i * 12}%`,
              bottom: '10%',
              animationDelay: `${i * 0.2}s`,
              animationDuration: '1.5s'
            }}
          />
        ))}
      </div>
      
      {/* Multi-layer Success Orbs */}
      <ParallaxSection speed={-0.35} scale className="absolute inset-0 opacity-25">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] bg-gradient-to-br from-success/40 via-success/20 to-transparent rounded-full blur-3xl animate-pulse"></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.5} scale className="absolute inset-0 opacity-20">
        <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] bg-gradient-to-tl from-primary/30 via-success/15 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </ParallaxSection>
      
      {/* Interactive Trophy Trail */}
      <InteractiveBackground type="bestseller" className="opacity-70" />
      
      {/* Success Circles */}
      <div className="absolute inset-0 pointer-events-none opacity-8">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${8 + i * 10}%`,
              top: `${15 + (i % 2) * 40}%`,
              animationDelay: `${i * 0.9}s`,
              animationDuration: `${8 + i * 1.5}s`
            }}
          >
            <div className="w-12 h-12 border-4 border-success rounded-full" style={{animation: 'ping 3s cubic-bezier(0, 0, 0.2, 1) infinite', animationDelay: `${i * 0.3}s`}} />
          </div>
        ))}
      </div>
      <EnhancedScrollAnimation animation="slideInLeft" duration={1000} delay={120}>
        <CreativeProductsSlider
          title={sectionCfg.bestSellers?.title || 'الأكثر مبيعاً'}
          subtitle={sectionCfg.bestSellers?.subtitle || 'المنتجات الأكثر طلباً من قبل عملائنا الكرام'}
          filterType="trending"
          gradientFrom="from-success"
          gradientTo="to-success"
          icon={getIcon(sectionCfg.bestSellers?.icon, <TrendingUp className="w-12 h-12 text-white" />)}
          selectedIds={homeCfg?.bestSellerProductIds}
        />
      </EnhancedScrollAnimation>
    </section>
  ) : null;
  const aboutBlock = (
    <EnhancedScrollAnimation
      animation="slideInUp"
      duration={1500}
      pauseOnHover={true}
      autoSlide={false}
    >
      <section className="py-8 md:py-14 bg-white relative overflow-hidden">
        {/* Simple gradient line divider */}
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
        {/* MEGA Decorative Border System */}
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent"></div>
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-secondary to-transparent"></div>
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-gradient-to-b from-transparent via-primary/50 to-transparent"></div>
          <div className="absolute top-0 bottom-0 right-0 w-1 bg-gradient-to-b from-transparent via-secondary/50 to-transparent"></div>
        </div>
        
        {/* 3-Layer Parallax System */}
        <ParallaxSection speed={-0.3} intensity="strong" scale className="absolute inset-0 pointer-events-none">
          <div className="absolute top-20 left-10 w-[450px] h-[450px] bg-gradient-to-br from-primary/12 via-primary/6 to-transparent rounded-full blur-3xl animate-pulse"></div>
        </ParallaxSection>
        <ParallaxSection speed={-0.5} intensity="strong" scale className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-20 right-10 w-[550px] h-[550px] bg-gradient-to-tl from-secondary/12 via-secondary/6 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
        </ParallaxSection>
        <ParallaxSection speed={-0.7} className="absolute inset-0 pointer-events-none opacity-40">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] bg-gradient-to-r from-primary/15 via-secondary/15 to-primary/15 rounded-full blur-2xl"></div>
        </ParallaxSection>
        
        {/* Animated Rings */}
        <div className="absolute inset-0 pointer-events-none opacity-10">
          <div className="absolute top-1/4 right-1/4 w-64 h-64 border-4 border-primary rounded-full animate-ping" style={{animationDuration: '4s'}}></div>
          <div className="absolute bottom-1/3 left-1/3 w-48 h-48 border-4 border-secondary rounded-full animate-ping" style={{animationDuration: '5s', animationDelay: '1s'}}></div>
        </div>
        
        {/* Interactive Connection Lines */}
        <InteractiveBackground type="about" className="opacity-50" />
        
        {/* Hexagon Pattern */}
        <div className="absolute inset-0 pointer-events-none opacity-6">
          {[...Array(12)].map((_, i) => (
            <div
              key={i}
              className="absolute animate-float"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
                animationDuration: `${10 + Math.random() * 8}s`
              }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40">
                <polygon points="20,2 35,12 35,28 20,38 5,28 5,12" fill="none" stroke="hsl(var(--primary))" strokeWidth="2" />
              </svg>
            </div>
          ))}
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <ScrollAnimation animation="slideLeft" delay={200}>
              <div className="space-y-6">
                <div className="inline-block mb-4">
                  <span className="text-sm font-semibold text-primary uppercase tracking-wider">من نحن</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-6 leading-tight">
                  {about.title}
                </h2>
                <p className="text-base md:text-lg text-slate-600 leading-relaxed mb-8">
                  {about.description}
                </p>
                <Button
                  asChild
                  className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-base font-semibold rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-105"
                >
                  <Link to="/about" className="flex items-center gap-2">
                    اعرف المزيد عنا
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </ScrollAnimation>
            <ScrollAnimation animation="slideRight" delay={400}>
              <div className="relative">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                  <img src={about.image} alt="عن الشركة" className="relative w-full h-80 md:h-96 object-cover rounded-2xl shadow-xl" />
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-6 rounded-b-2xl">
                    <div className="grid grid-cols-2 gap-4 text-white">
                      <div>
                        <div className="text-2xl md:text-3xl font-black">{about?.stats?.customers ? String(about.stats.customers) : 'N/A'}</div>
                        <div className="text-sm text-white/80">عميل راضي</div>
                      </div>
                      <div>
                        <div className="text-2xl md:text-3xl font-black">{about?.stats?.products ? String(about.stats.products) : 'N/A'}</div>
                        <div className="text-sm text-white/80">منتج متنوع</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>
    </EnhancedScrollAnimation>
  );
  const saleBlock = toggles['sale'] !== false ? (
    <section className="relative py-8 md:py-12 bg-slate-50 overflow-hidden">
      {/* Simple gradient line divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red-200 to-transparent"></div>
      {/* MEGA SALE Background Effect */}
      <div className="absolute inset-0 opacity-20" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(239, 68, 68, 0.05) 35px, rgba(239, 68, 68, 0.05) 70px)'}}></div>
      
      {/* Fire/Heat Wave Effect */}
      <ParallaxSection speed={-0.3} intensity="strong" scale className="absolute inset-0 opacity-50">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-red-500/20 via-orange-500/15 to-transparent rounded-full blur-3xl animate-pulse"></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.45} intensity="strong" scale className="absolute inset-0 opacity-45">
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-gradient-to-tl from-pink-500/20 via-red-500/15 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1s'}}></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.6} className="absolute inset-0 opacity-35">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-gradient-to-r from-orange-500/15 to-pink-500/15 rounded-full blur-2xl"></div>
      </ParallaxSection>
      
      {/* Explosive Sparkles */}
      <div className="absolute inset-0 pointer-events-none">
        {[...Array(30)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full animate-pulse"
            style={{
              width: `${Math.random() * 3 + 1}px`,
              height: `${Math.random() * 3 + 1}px`,
              background: i % 3 === 0 ? '#ef4444' : i % 3 === 1 ? '#f97316' : '#ec4899',
              opacity: Math.random() * 0.5 + 0.2,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1 + Math.random() * 2}s`
            }}
          />
        ))}
      </div>
      
      {/* Interactive Fire/Explosion Effect */}
      <InteractiveBackground type="sale" className="opacity-80" />
      
      {/* Star Burst Shapes */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${10 + i * 10}%`,
              top: `${20 + (i % 3) * 20}%`,
              animationDelay: `${i * 0.5}s`,
              animationDuration: `${6 + i}s`
            }}
          >
            <svg width="50" height="50" viewBox="0 0 50 50">
              <path d="M25,5 L30,20 L45,20 L33,28 L38,43 L25,35 L12,43 L17,28 L5,20 L20,20 Z" fill="none" stroke="#ef4444" strokeWidth="2" />
            </svg>
          </div>
        ))}
      </div>
      
      {/* Percentage Signs */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="absolute text-6xl font-black text-red-500 animate-pulse"
            style={{
              left: `${15 + i * 15}%`,
              top: `${10 + (i % 2) * 40}%`,
              animationDelay: `${i * 0.3}s`,
              transform: `rotate(${-15 + Math.random() * 30}deg)`
            }}
          >
            %
          </div>
        ))}
      </div>
      <EnhancedScrollAnimation animation="scaleIn" duration={1000}>
        <CreativeProductsSlider
        title={sectionCfg.sale?.title || 'عروض خاصة'}
        subtitle={sectionCfg.sale?.subtitle || 'خصومات حصرية وعروض لا تُفوت لفترة محدودة'}
        filterType="sale"
        gradientFrom="from-red-600"
        gradientTo="to-pink-600"
        icon={getIcon(sectionCfg.sale?.icon, <Flame className="w-12 h-12 text-white" />)}
        selectedIds={homeCfg?.saleProductIds}
      />
      </EnhancedScrollAnimation>
    </section>
  ) : null;
  const newArrivalsBlock = toggles['newArrivals'] !== false ? (
    <section className="relative py-8 md:py-12 bg-white overflow-hidden">
      {/* Simple gradient line divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent"></div>
      {/* MEGA Pattern Overlay */}
      <ParallaxSection speed={-0.2} intensity="medium" className="absolute inset-0 opacity-[0.025]" style={{backgroundImage: 'repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '25px 25px'}}></ParallaxSection>
      <ParallaxSection speed={-0.3} intensity="medium" className="absolute inset-0 opacity-[0.015]" style={{backgroundImage: 'repeating-linear-gradient(-45deg, #000 0, #000 1px, transparent 0, transparent 50%)', backgroundSize: '25px 25px'}}></ParallaxSection>
      
      {/* New Badge Glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-10 w-32 h-32 bg-gradient-to-r from-primary to-secondary rounded-full blur-2xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-10 left-10 w-32 h-32 bg-gradient-to-r from-secondary to-primary rounded-full blur-2xl opacity-30 animate-pulse" style={{animationDelay: '1s'}}></div>
      </div>
      
      {/* Multi-layer Gradient Orbs */}
      <ParallaxSection speed={-0.4} scale className="absolute inset-0 opacity-30">
        <div className="absolute top-1/3 right-1/3 w-[450px] h-[450px] bg-gradient-to-br from-primary/25 via-primary/12 to-transparent rounded-full blur-3xl animate-pulse"></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.6} scale className="absolute inset-0 opacity-25">
        <div className="absolute bottom-1/3 left-1/3 w-[500px] h-[500px] bg-gradient-to-tl from-secondary/25 via-secondary/12 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '1.5s'}}></div>
      </ParallaxSection>
      
      {/* Interactive Gift Unwrapping */}
      <InteractiveBackground type="new" className="opacity-65" />
      
      {/* Diamond Shapes */}
      <div className="absolute inset-0 pointer-events-none opacity-8">
        {[...Array(10)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${12 + i * 10}%`,
              top: `${15 + (i % 3) * 25}%`,
              animationDelay: `${i * 0.7}s`,
              animationDuration: `${7 + i * 1.5}s`
            }}
          >
            <div className="w-14 h-14 border-3 border-primary rotate-45 transform" style={{borderWidth: '3px'}} />
          </div>
        ))}
      </div>
      
      {/* NEW Badge Stamps */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="absolute px-4 py-2 border-4 border-primary rounded-full text-primary font-black text-2xl animate-pulse"
            style={{
              left: `${20 + i * 20}%`,
              top: `${20 + (i % 2) * 40}%`,
              animationDelay: `${i * 0.5}s`,
              transform: `rotate(${-10 + i * 7}deg)`
            }}
          >
            NEW
          </div>
        ))}
      </div>
      <EnhancedScrollAnimation animation="scaleIn" duration={1000}>
        <CreativeProductsSlider
        title={sectionCfg.newArrivals?.title || 'أحدث المنتجات'}
        subtitle={sectionCfg.newArrivals?.subtitle || 'آخر الإضافات إلى مجموعتنا من المنتجات المتميزة'}
        filterType="new"
        gradientFrom="from-primary"
        gradientTo="to-secondary"
        icon={getIcon(sectionCfg.newArrivals?.icon, <Gift className="w-12 h-12 text-white" />)}
        selectedIds={homeCfg?.newArrivalProductIds}
      />
      </EnhancedScrollAnimation>
    </section>
  ) : null;
  const locationsBlock = (
    <section className="py-8 md:py-14 bg-slate-50 relative overflow-hidden">
      {/* Simple gradient line divider */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-300 to-transparent"></div>
      {/* MEGA Map-Inspired Background */}
      <div className="absolute inset-0 opacity-10" style={{backgroundImage: 'radial-gradient(circle, rgba(0,0,0,0.1) 1px, transparent 1px)', backgroundSize: '40px 40px'}}></div>
      
      {/* Enhanced Border System */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-primary via-50% to-transparent"></div>
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-gradient-to-r from-transparent via-secondary via-50% to-transparent"></div>
      </div>
      
      {/* 3-Layer Location Orbs */}
      <ParallaxSection speed={-0.25} intensity="strong" scale className="absolute inset-0 pointer-events-none">
        <div className="absolute top-10 right-20 w-[500px] h-[500px] bg-gradient-to-br from-primary/15 via-primary/8 to-transparent rounded-full blur-3xl animate-pulse"></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.4} intensity="strong" scale className="absolute inset-0 pointer-events-none">
        <div className="absolute bottom-10 left-20 w-[600px] h-[600px] bg-gradient-to-tl from-secondary/15 via-secondary/8 to-transparent rounded-full blur-3xl animate-pulse" style={{animationDelay: '2s'}}></div>
      </ParallaxSection>
      <ParallaxSection speed={-0.6} className="absolute inset-0 pointer-events-none opacity-50">
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[450px] h-[450px] bg-gradient-to-r from-primary/20 via-secondary/20 to-primary/20 rounded-full blur-2xl"></div>
      </ParallaxSection>
      
      {/* Interactive Map Routes */}
      <InteractiveBackground type="location" className="opacity-60" />
      
      {/* Map Pin Shapes */}
      <div className="absolute inset-0 pointer-events-none opacity-10">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute animate-float"
            style={{
              left: `${12 + i * 12}%`,
              top: `${20 + (i % 2) * 30}%`,
              animationDelay: `${i * 0.8}s`,
              animationDuration: `${8 + i * 1.5}s`
            }}
          >
            <svg width="40" height="50" viewBox="0 0 40 50">
              <path d="M20,5 C12,5 5,12 5,20 C5,30 20,45 20,45 C20,45 35,30 35,20 C35,12 28,5 20,5 Z" fill="none" stroke="#ef4444" strokeWidth="2" />
              <circle cx="20" cy="20" r="5" fill="#ef4444" />
            </svg>
          </div>
        ))}
      </div>
      
      {/* Compass Rings */}
      <div className="absolute inset-0 pointer-events-none opacity-5">
        <div className="absolute top-1/4 left-1/4 w-48 h-48 border-8 border-dashed border-primary rounded-full animate-spin" style={{animationDuration: '30s'}}></div>
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 border-8 border-dashed border-secondary rounded-full animate-spin" style={{animationDuration: '40s', animationDirection: 'reverse'}}></div>
      </div>
      <div className="container mx-auto px-4 relative">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          <EnhancedScrollAnimation animation="slideInLeft" duration={1100} delay={150}>
            <div className="space-y-6">
              <div>
                <div className="inline-block mb-4">
                  <span className="text-sm font-semibold text-primary uppercase tracking-wider">مواقعنا</span>
                </div>
                <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-slate-900 mb-6 leading-tight">
                  نخدمك في كل مكان
                </h2>
                <p className="text-base md:text-lg text-slate-600 leading-relaxed mb-6">نخدمك في جميع أنحاء المملكة من خلال فروعنا في المدن الرئيسية.</p>
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  {/* Live status pill */}
                  <span className={`inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-full ${
                    getCurrentStatus() === 'مفتوح الآن' ? 'bg-success/10 text-success border border-success/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
                  }`}>
                    <span className={`w-2 h-2 rounded-full ${getCurrentStatus() === 'مفتوح الآن' ? 'bg-success animate-pulse' : 'bg-destructive'}`}></span>
                    {getCurrentStatus()}
                  </span>
                  {/* Inline work hours */}
                  <span className="text-xs text-slate-500">
                    السبت - الخميس: {workHours.weekdays} • الجمعة: {workHours.friday}
                  </span>
                </div>
              </div>
              <div className="pt-4">
                <Button asChild className="bg-slate-900 hover:bg-slate-800 text-white px-8 py-6 text-base font-semibold rounded-xl transition-all duration-300 hover:shadow-xl hover:scale-105">
                  <Link to="/locations" className="flex items-center gap-2">
                    اكتشف جميع المواقع
                    <ArrowLeft className="w-5 h-5" />
                  </Link>
                </Button>
              </div>
            </div>
          </EnhancedScrollAnimation>
          <EnhancedScrollAnimation animation="slideInRight" duration={1100} delay={250}>
            <div className="relative">
              <div className="relative bg-white rounded-2xl p-4 shadow-xl border border-slate-200">
                <div className="flex flex-wrap gap-2 mb-4">
                  {branchKeys.length ? (
                    branchKeys.map((key) => {
                      const branch = branchLocations[key];
                      return (
                        <button
                          key={key}
                          onClick={() => setSelectedBranch(key)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                            selectedBranch === key 
                              ? 'bg-slate-900 text-white shadow-md' 
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                          title={branch?.name || key}
                        >
                          {branch?.name || key}
                        </button>
                      );
                    })
                  ) : (
                    <span className="text-slate-500 text-sm">لا توجد فروع متاحة حالياً</span>
                  )}
                </div>
                <div className="relative h-80 rounded-2xl overflow-hidden shadow-lg">
                  {/* Google Maps iframe with graceful fallback */}
                  {currentBranch?.mapUrl ? (
                    <iframe
                      src={currentBranch.mapUrl}
                      width="100%"
                      height="100%"
                      style={{ border: 0 }}
                      allowFullScreen
                      loading="lazy"
                      referrerPolicy="no-referrer-when-downgrade"
                      className="rounded-2xl"
                      title="map"
                    />
                  ) : (
                    <div className="w-full h-full rounded-2xl bg-white/10 backdrop-blur-sm border border-white/20 flex flex-col items-center justify-center text-white p-6 text-center">
                      <Sparkles className="w-6 h-6 mb-2 opacity-80" />
                      <p className="font-semibold mb-1">تعذر تحميل الخريطة</p>
                      <p className="text-sm opacity-90 mb-4">يمكنك فتح الموقع في خرائط جوجل</p>
                      <Button asChild variant="secondary" className="bg-white/20 hover:bg-white/30 text-white">
                        <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(currentBranch?.name || 'store')}`} target="_blank" rel="noopener noreferrer">افتح في الخرائط</a>
                      </Button>
                    </div>
                  )}
                  {currentBranch && (
                    <div className="absolute bottom-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl max-w-xs">
                      <h4 className="font-bold text-slate-900 mb-2">{currentBranch?.name || 'فرع'}</h4>
                      <p className="text-sm text-slate-600 mb-2">{currentBranch?.address || ''}</p>
                      <p className="text-xs text-slate-500">{currentBranch?.phone || ''}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </EnhancedScrollAnimation>
        </div>
      </div>
    </section>
  );
  // Removed work hours section from homepage as requested

  const blocks: Record<string, JSX.Element | null> = {
    hero: heroBlock,
    promoStrip: promoStripBlock,
    categories: categoriesBlock,
    featuredProducts: featuredBlock,
    bestSellers: bestSellersBlock,
    sale: saleBlock,
    newArrivals: newArrivalsBlock,
    about: aboutBlock,
    locations: locationsBlock,
  };

  return (
    <ResponsiveProvider>
      <div className={`min-h-screen transition-all duration-900 ease-out ${pageEnter ? 'opacity-100' : 'opacity-0'}`}>
        {sectionsOrderSafe.map((key, idx) => {
          const isTogglable = ['featuredProducts','bestSellers','sale','newArrivals','promoStrip','categories','about','locations'].includes(key);
          if (isTogglable && toggles[key] === false) return null;
          const el = blocks[key] ?? null;
          if (!el) return null;
          const delayMs = prefersReducedMotion ? 0 : Math.min(120 * idx, 720);
          return (
            <div
              key={key}
              className={
                prefersReducedMotion
                  ? ''
                  : `transition-all duration-900 ease-out ${pageEnter ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`
              }
              style={prefersReducedMotion ? undefined : { transitionDelay: `${delayMs}ms` }}
            >
              {el}
            </div>
          );
        })}
      </div>
    </ResponsiveProvider>
  );
};

export default Index;