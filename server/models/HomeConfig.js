import mongoose from 'mongoose';

const SlideSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    subtitle: { type: String, default: '' },
    image: { type: String, default: '' },
    buttonText: { type: String, default: '' },
    buttonLink: { type: String, default: '' },
    productId: { type: String, default: '' },
    productIds: { type: [String], default: [] },
    enabled: { type: Boolean, default: true },
    // Enhanced design controls
    theme: { type: String, enum: ['premium', 'sale', 'quality', 'custom'], default: 'premium' },
    bgGradient: { type: String, default: '' },
    pattern: { type: String, enum: ['grid', 'circles', 'waves', 'dots', 'diagonals', 'custom'], default: undefined },
    buttonColor: { type: String, default: '' },
  bgColor: { type: String, default: '' },
    textColor: { type: String, default: '' },
    badge: { type: String, default: '' },
    features: { type: [String], default: [] },
  },
  { _id: false }
);

const HeroDesignSchema = new mongoose.Schema(
  {
    // Animation settings
    enableAnimations: { type: Boolean, default: true },
    animationSpeed: { type: String, enum: ['slow', 'normal', 'fast'], default: 'normal' },
    enableParallax: { type: Boolean, default: true },
    enableMouseTracking: { type: Boolean, default: true },
    autoplayEnabled: { type: Boolean, default: true },
    autoplayInterval: { type: Number, default: 5000 },
    
    // Visual settings
    showProductShowcase: { type: Boolean, default: true },
    showNavigationArrows: { type: Boolean, default: true },
    showProgressIndicator: { type: Boolean, default: true },
    showSlideIndicators: { type: Boolean, default: true },
    
    // Device-specific settings
    mobileLayout: { type: String, enum: ['stacked', 'overlay', 'minimal'], default: 'stacked' },
    desktopLayout: { type: String, enum: ['split', 'fullwidth', 'centered'], default: 'split' },
    
    // Content settings
    defaultTheme: { type: String, enum: ['premium', 'sale', 'quality'], default: 'premium' },
    showFeatureBadges: { type: Boolean, default: true },
    enableProductIntegration: { type: Boolean, default: true },
    maxProducts: { type: Number, default: 4, min: 1, max: 8 },
  },
  { _id: false }
);

const SectionToggleSchema = new mongoose.Schema(
  {
    key: { type: String, required: true }, // e.g., 'promoStrip', 'featuredProducts'
    enabled: { type: Boolean, default: true },
  },
  { _id: false }
);

const HomeConfigSchema = new mongoose.Schema(
  {
    // Hero
    heroEnabled: { type: Boolean, default: true },
    slides: { type: [SlideSchema], default: [] },
    heroDesign: { type: HeroDesignSchema, default: {} },

    // Feature blocks / toggles
    toggles: { type: [SectionToggleSchema], default: [] },

    // Featured carousels
    featuredCategorySlugs: { type: [String], default: [] },
    featuredProductIds: { type: [String], default: [] },
    // Additional curated product lists per section
    bestSellerProductIds: { type: [String], default: [] },
    saleProductIds: { type: [String], default: [] },
    newArrivalProductIds: { type: [String], default: [] },

    // Promo strip
    promoEnabled: { type: Boolean, default: false },
    promoText: { type: String, default: '' },
    promoIcon: { type: String, default: 'zap' },

    // Per-section content controls
    sections: {
      type: new mongoose.Schema(
        {
          featuredProducts: {
            title: { type: String, default: 'المنتجات المميزة' },
            subtitle: { type: String, default: 'اكتشف أفضل منتجاتنا المختارة بعناية لتلبية احتياجاتك' },
            icon: { type: String, default: 'crown' },
          },
          bestSellers: {
            title: { type: String, default: 'الأكثر مبيعاً' },
            subtitle: { type: String, default: 'المنتجات الأكثر طلباً من قبل عملائنا الكرام' },
            icon: { type: String, default: 'trending-up' },
          },
          sale: {
            title: { type: String, default: 'عروض خاصة' },
            subtitle: { type: String, default: 'خصومات حصرية وعروض لا تُفوت لفترة محدودة' },
            icon: { type: String, default: 'flame' },
          },
          newArrivals: {
            title: { type: String, default: 'أحدث المنتجات' },
            subtitle: { type: String, default: 'آخر الإضافات إلى مجموعتنا من المنتجات المتميزة' },
            icon: { type: String, default: 'gift' },
          },
        },
        { _id: false }
      ),
      default: undefined,
    },

    // SEO/meta for home
    seoTitle: { type: String, default: '' },
    seoDescription: { type: String, default: '' },
    // Sections render order
    sectionsOrder: { type: [String], default: undefined },

    // Home specific content moved from global Settings
    aboutUsContent: {
      title: { type: String, default: 'من نحن؟' },
      description: {
        type: String,
        default:
          'شركة رائدة في التجارة الإلكترونية، نقدم أفضل المنتجات وأجود الخدمات بجودة عالية وخدمة متميزة.',
      },
      image: {
        type: String,
        default:
          'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop',
      },
      vision: { type: String, default: '' },
      mission: { type: String, default: '' },
      stats: {
        customers: { type: String, default: '1000+' },
        products: { type: String, default: '500+' },
      },
    },
    workHours: {
      weekdays: { type: String, default: '9:00 ص - 10:00 م' },
      friday: { type: String, default: '2:00 م - 10:00 م' },
      phone: { type: String, default: '+966 12 345 6789' },
      // currentStatus intentionally omitted; status will be computed dynamically on the client
    },
  },
  { timestamps: true }
);

export default mongoose.models.HomeConfig || mongoose.model('HomeConfig', HomeConfigSchema);
