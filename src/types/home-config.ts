export interface Slide {
  title: string;
  subtitle: string;
  image: string;
  buttonText: string;
  buttonLink: string;
  productId?: string;
  productIds?: string[];
  enabled: boolean;
  // Additional compatibility properties
  text?: string;
  href?: string;
  button?: string;
  // Enhanced design controls
  theme?: 'premium' | 'sale' | 'quality' | 'custom';
  bgGradient?: string;
  bgColor?: string;
  pattern?: 'grid' | 'circles' | 'waves' | 'dots' | 'diagonals' | 'custom';
  buttonColor?: string;
  textColor?: string;
  badge?: string;
  features?: string[];
}

export interface HeroDesignConfig {
  // Animation settings
  enableAnimations?: boolean;
  animationSpeed?: 'slow' | 'normal' | 'fast';
  enableParallax?: boolean;
  enableMouseTracking?: boolean;
  autoplayEnabled?: boolean;
  autoplayInterval?: number;
  
  // Visual settings
  showProductShowcase?: boolean;
  showNavigationArrows?: boolean;
  showProgressIndicator?: boolean;
  showSlideIndicators?: boolean;
  
  // Device-specific settings
  mobileLayout?: 'stacked' | 'overlay' | 'minimal';
  desktopLayout?: 'split' | 'fullwidth' | 'centered';
  
  // Content settings
  defaultTheme?: 'premium' | 'sale' | 'quality';
  showFeatureBadges?: boolean;
  enableProductIntegration?: boolean;
  maxProducts?: number;
}

export interface SectionToggle {
  key: string; // e.g., 'promoStrip', 'featuredProducts'
  enabled: boolean;
}

export interface HomeConfig {
  heroEnabled: boolean;
  slides: Slide[];
  toggles: SectionToggle[];
  featuredCategorySlugs: string[];
  featuredProductIds: string[];
  // Enhanced hero design configuration
  heroDesign?: HeroDesignConfig;
  // Curated lists
  bestSellerProductIds?: string[];
  saleProductIds?: string[];
  newArrivalProductIds?: string[];
  promoEnabled: boolean;
  promoText: string;
  promoIcon: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords?: string;
  seoPreviewImage?: string;
  // SEO object for compatibility
  seo?: {
    title?: string;
    description?: string;
    keywords?: string;
    previewImage?: string;
  };
  // Per-section content to control Arabic titles/subtitles/icons
  sections?: {
    featuredProducts?: { title?: string; subtitle?: string; icon?: string; products?: string[] };
    bestSellers?: { title?: string; subtitle?: string; icon?: string; products?: string[] };
    sale?: { title?: string; subtitle?: string; icon?: string; products?: string[] };
    newArrivals?: { title?: string; subtitle?: string; icon?: string; products?: string[] };
  };
  // Render order of home sections
  sectionsOrder?: string[]; // e.g. ['hero','promoStrip','categories','featuredProducts','bestSellers','sale','newArrivals','about','locations','workHours']
  // About Us content moved from Settings to HomeConfig
  aboutUsContent?: {
    title?: string;
    description?: string;
    image?: string;
    stats?: { customers?: string; products?: string };
    vision?: string;
    mission?: string;
  };
  // Work hours moved from Settings to HomeConfig (status computed on client)
  workHours?: {
    weekdays?: string;
    friday?: string;
    phone?: string;
    // currentStatus intentionally omitted
  };
  // Hero text and button for compatibility
  heroText?: string;
  heroButton?: string;
  // About content for compatibility  
  aboutTitle?: string;
  aboutText?: string;
  aboutImage?: string;
  // Mongoose timestamps (if returned by API)
  createdAt?: string;
  updatedAt?: string;
  _id?: string;
}

