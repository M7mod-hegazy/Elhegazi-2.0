import { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Search, Filter, SortAsc, SortDesc, Grid, List, ArrowRight, Package, Star, ShoppingBag, Eye, Heart, Check, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import whatsappIcon from '@/assets/whatsapp.png';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Navigation, Pagination } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/navigation';
import 'swiper/css/pagination';
import './CategoryPage.css';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Rating from '@/components/product/Rating';
import AuthModal from '@/components/ui/auth-modal';
import { motion } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useCart } from '@/hooks/useCart';
import { useFavorites } from '@/hooks/useFavorites';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import SocialLinks from '@/components/layout/SocialLinks';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import ScrollAnimation from '@/components/ui/scroll-animation';
import { apiGet, type ApiResponse } from '@/lib/api';
import { usePageTitle } from '@/hooks/usePageTitle';
import { WhatsAppContactModal } from '@/components/product/WhatsAppContactModal';
import ProductsDesktop from '@/components/home/ProductsDesktop';
import ProductsMobile from '@/components/home/ProductsMobile';
import type { Product, Category } from '@/types';

type ApiCategory = {
  _id: string;
  name: string;
  nameAr?: string;
  slug: string;
  description?: string;
  featured?: boolean;
  image?: string;
  order?: number;
  productCount?: number;
};

type ApiProduct = {
  _id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  categorySlug?: string;
  price: number;
  description?: string;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
};

const CategoryPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for category and products
  const [categoryData, setCategoryData] = useState<ApiCategory | null>(null);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  
  // Set dynamic page title with category name
  usePageTitle(categoryData ? (categoryData.nameAr || categoryData.name) : 'فئة المنتجات');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating' | 'newest'>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  // Dynamic price range state (dual-thumb)
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [priceTouched, setPriceTouched] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<'all' | '4+' | '3+' >('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null);
  const [hoveredRating, setHoveredRating] = useState<{[key: string]: number}>({});
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedRating, setSelectedRating] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authAction, setAuthAction] = useState<'cart' | 'favorites' | 'general'>('general');
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [selectedProductForWhatsApp, setSelectedProductForWhatsApp] = useState<Product | null>(null);
  const navigate = useNavigate();
  const { isAuthenticated } = useDualAuth();
  const { addItem, isInCart: checkIsInCart, getItemByProductId } = useCart();
  const { favorites, toggleFavorite } = useFavorites();
  const { hidePrices } = usePricingSettings();
  const { toast } = useToast();

  const handleToggleFavorite = (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!isAuthenticated) {

      setAuthAction('favorites');
      setShowAuthModal(true);
      return;
    }


    toggleFavorite(productId);
  };

  const handleAddToCart = async (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!isAuthenticated) {

      setAuthAction('cart');
      setShowAuthModal(true);
      return;
    }


    
    // Check if product is already in cart to show appropriate message
    const wasInCart = checkIsInCart(product.id);
    const currentItem = getItemByProductId(product.id);
    const previousQuantity = currentItem?.quantity || 0;
    
    try {
      await addItem(product, 1);

      
      const newQuantity = previousQuantity + 1;
      
      // Show custom toast with product image and quantity info
      toast({
        title: wasInCart ? "تمت إضافة واحد آخر ✓" : "تمت الإضافة للسلة ✓",
        description: (
          <div className="space-y-3 mt-2" dir="rtl">
            {/* Product Info */}
            <div className="flex items-start gap-3">
              <img
                src={optimizeImage(product.image, { w: 80 })}
                alt={product.nameAr}
                className="w-20 h-20 object-cover rounded-lg shadow-md flex-shrink-0"
              />
              <div className="flex-1 text-right min-w-0">
                <p className="font-bold text-sm text-slate-900 line-clamp-2">{product.nameAr}</p>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <p className="text-sm font-semibold text-primary">{product.price.toLocaleString()} ج.م</p>
                  {product.category && (
                    <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                      {product.categoryAr || product.category}
                    </span>
                  )}
                </div>
                {wasInCart && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <p className="text-xs font-semibold text-green-600">
                      الكمية: {newQuantity} قطعة
                    </p>
                    <span className="text-xs text-slate-500">•</span>
                    <p className="text-xs font-semibold text-slate-700">
                      الإجمالي: {(product.price * newQuantity).toLocaleString()} ج.م
                    </p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Quick Actions */}
            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => navigate('/cart')}
                className="flex-1 bg-primary hover:bg-primary/90 text-white text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                عرض السلة
              </button>
              <button
                onClick={() => {}}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold py-2 px-3 rounded-lg transition-colors"
              >
                متابعة التسوق
              </button>
            </div>
          </div>
        ),
      });
    } catch (error) {
      console.error('Error adding to cart:', error);
    }
  };

  const handleRatingClick = (e: React.MouseEvent, product: Product, rating?: number) => {
    e.preventDefault();
    e.stopPropagation();
    setSelectedProduct(product);
    setSelectedRating(rating || 0);
    setShowRatingModal(true);
  };

  const handleStarHover = (productId: string, rating: number) => {
    setHoveredRating(prev => ({ ...prev, [productId]: rating }));
  };

  const handleStarLeave = (productId: string) => {
    setHoveredRating(prev => ({ ...prev, [productId]: 0 }));
  };

  const handleRatingSubmit = (rating: number, review?: string) => {

    setShowRatingModal(false);
    setSelectedRating(0);
  };
  const pageSize = 12;

  // Live data state
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);

  // Fetch categories and products from backend (live refresh)
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          apiGet<ApiCategory>('/api/categories'),
          apiGet<ApiProduct>(`/api/products${slug ? `?category=${encodeURIComponent(slug)}` : ''}`),
        ]);
        const catItems = (catRes as Extract<ApiResponse<ApiCategory>, { ok: true }>).items ?? [];
        const categories: Category[] = catItems.map((c) => ({
          id: c._id,
          name: c.name,
          nameAr: c.nameAr ?? c.name,
          slug: c.slug,
          image: c.image ?? '',
          description: c.description ?? '',
          descriptionAr: undefined,
          productCount: typeof c.productCount === 'number' ? c.productCount : 0,
          featured: !!c.featured,
          order: typeof c.order === 'number' ? c.order : 0,
        }));

        const prodItems = (prodRes as Extract<ApiResponse<ApiProduct>, { ok: true }>).items ?? [];
        const products: Product[] = prodItems.map((p) => {
          const slugVal = p.categorySlug ?? '';
          const cat = categories.find((c) => c.slug === slugVal);
          return {
            id: p._id,
            name: p.name,
            nameAr: p.nameAr ?? p.name,
            description: p.description ?? '',
            descriptionAr: p.description ?? '',
            price: p.price,
            originalPrice: undefined,
            image: p.image ?? '',
            images: Array.isArray(p.images) ? p.images : (p.image ? [p.image] : []),
            category: slugVal,
            categoryAr: cat?.nameAr ?? slugVal,
            stock: p.stock,
            isHidden: p.active === false,
            featured: !!p.featured,
            discount: undefined,
            rating: 0,
            reviews: 0,
            tags: [],
            sku: p.sku ?? '',
            weight: undefined,
            dimensions: undefined,
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
          };
        });

        if (isMounted) {
          setLiveCategories(categories);
          setLiveProducts(products);
        }
      } catch (e) {
        console.error('Failed to fetch category/products:', e);
        if (isMounted) {
          setLiveCategories([]);
          setLiveProducts([]);
        }
      }
    };

    // initial load
    fetchData();

    // refresh when window regains focus / tab visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    window.addEventListener('focus', fetchData);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', fetchData);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [slug]);

  // Find the category by slug
  const category = liveCategories.find(cat => cat.slug === slug || cat.id === slug);

  // Get category products. Prefer match by id; fallback to name/nameAr
  const categoryProducts = useMemo(() => {
    if (!category) return [] as Product[];
    return liveProducts.filter(product => 
      (product.category === category.slug || product.category === category.id) && 
      product.isHidden !== true
    );
  }, [liveProducts, category]);

  // Base filtered products (exclude price for dynamic bounds)
  const baseFiltered = useMemo(() => {
    let filtered = categoryProducts.filter(product =>
      product.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (ratingFilter !== 'all') {
      filtered = filtered.filter(product => {
        switch (ratingFilter) {
          case '4+': return product.rating >= 4;
          case '3+': return product.rating >= 3;
          default: return true;
        }
      });
    }
    return filtered;
  }, [categoryProducts, searchTerm, ratingFilter]);

  // Dynamic bounds
  const { dynMin, dynMax } = useMemo(() => {
    if (baseFiltered.length === 0) return { dynMin: 0, dynMax: 0 };
    const prices = baseFiltered.map(p => p.price);
    return { dynMin: Math.min(...prices), dynMax: Math.max(...prices) };
  }, [baseFiltered]);

  // Initialize/clamp price range
  useEffect(() => {
    if (baseFiltered.length === 0) {
      setPriceRange([0, 0]);
      return;
    }
    if (!priceTouched) {
      setPriceRange([dynMin, dynMax]);
      return;
    }
    setPriceRange(prev => [
      Math.max(dynMin, Math.min(prev[0], dynMax)),
      Math.max(dynMin, Math.min(prev[1], dynMax)),
    ]);
  }, [dynMin, dynMax, baseFiltered.length, priceTouched]);

  // Final filter and sort
  const filteredAndSortedProducts = useMemo(() => {
    const withinPrice = baseFiltered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    const sorted = [...withinPrice];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.nameAr.localeCompare(b.nameAr);
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'rating':
          comparison = a.rating - b.rating;
          break;
        case 'newest':
          comparison = new Date(b.createdAt || '').getTime() - new Date(a.createdAt || '').getTime();
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [baseFiltered, priceRange, sortBy, sortOrder]);

  // Reset page on filter/sort changes
  useEffect(() => {
    setPage(1);
  }, [searchTerm, ratingFilter, sortBy, sortOrder, priceRange]);

  // Sync page to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (page > 1) params.set('page', String(page)); else params.delete('page');
    setSearchParams(params);
  }, [page, searchParams, setSearchParams]);

  const totalItems = filteredAndSortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedProducts.slice(start, start + pageSize);
  }, [filteredAndSortedProducts, currentPage]);

  if (!category) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-24 h-24 text-slate-300 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-700 mb-4">الفئة غير موجودة</h1>
          <Link to="/categories" className="text-primary hover:text-primary">
            العودة إلى الفئات
          </Link>
        </div>
      </div>
    );
  }

  // Dynamic theme based on category
  const getThemeColors = () => {
    const themes = {
      'electronics': 'from-primary to-cyan-600',
      'fashion': 'from-pink-600 to-purple-600',
      'home': 'from-green-600 to-emerald-600',
      'sports': 'from-orange-600 to-red-600',
      'books': 'from-indigo-600 to-purple-600',
      'beauty': 'from-rose-600 to-pink-600',
    };
    return themes[category.name.toLowerCase() as keyof typeof themes] || 'from-slate-600 to-gray-600';
  };

  const themeGradient = getThemeColors();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5">
      {/* Category Hero with Parallax Background */}
      <section className="py-1 relative overflow-hidden max-h-[300px]" style={{ 
        backgroundImage: `url(${optimizeImage(category.image || '', { w: 1920 })})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        backgroundRepeat: 'no-repeat'
      }}>
        {/* Dynamic opacity overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900/60 via-slate-800/70 to-slate-900/80"></div>
        {/* Breadcrumb */}
        <ScrollAnimation animation="slideUp" delay={100}>
          <div className="container mx-auto px-4 mb-8 relative z-10">
            <nav className="flex items-center gap-3 text-white/80">
              <Link to="/" className="hover:text-white transition-colors">الرئيسية</Link>
              <ArrowRight className="w-4 h-4 rtl-flip" />
              <Link to="/categories" className="hover:text-white transition-colors">الفئات</Link>
              <ArrowRight className="w-4 h-4 rtl-flip" />
              <span className="text-white font-semibold">{category.nameAr}</span>
            </nav>
          </div>
        </ScrollAnimation>

        <div className="container mx-auto px-4 relative z-10">
          <div className="grid grid-cols-2 gap-4 lg:gap-12 items-start">
            {/* Text Content Column */}
            <ScrollAnimation animation="slideUp">
              <div>
                <h1 className="text-2xl lg:text-3xl font-black text-white mb-2">
                  {category.nameAr}
                </h1>
                <p className="text-sm text-white/90 mb-2 leading-snug">
                  {category.descriptionAr}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className="bg-white/20 text-white border-white/30 px-3 lg:px-4 py-1 lg:py-2 text-sm lg:text-lg">
                    {categoryProducts.length} منتج
                  </Badge>
                  {category.featured && (
                    <Badge className="bg-yellow-500 text-black px-3 lg:px-4 py-1 lg:py-2 text-sm lg:text-lg font-bold">
                      فئة مميزة
                    </Badge>
                  )}
                </div>
              </div>
            </ScrollAnimation>

            {/* Ticker Column - Shows on both mobile and desktop */}
            <ScrollAnimation animation="scaleIn" delay={300}>
              <div className="relative -mt-20 -mb-20">
                {/* Responsive Ticker - 1 column on mobile, 3 on desktop */}
                <div className="w-full h-[400px] md:h-[500px] lg:h-[700px] overflow-hidden backdrop-blur-sm bg-white/5 border border-white/10">
                  
                  {categoryProducts.length > 0 ? (
                    <div className="flex h-full gap-1 lg:gap-0 md:flex-row flex-col">
                      {/* Left Ticker - Upward Movement (1 column on mobile, shown on desktop) */}
                      <div className="flex-1 h-full overflow-hidden relative hidden md:block lg:block">
                        <motion.div
                          className="flex flex-col gap-1 lg:gap-3 p-1 lg:p-2"
                          initial={{ y: 0 }}
                          animate={{ y: -4000 }}
                          transition={{
                            duration: 40,
                            repeat: Infinity,
                            ease: "linear",
                            repeatType: "loop"
                          }}
                        >
                          {/* Perfect duplication for seamless loop */}
                          {Array.from({ length: 8 }, (_, setIndex) => 
                            categoryProducts.map((product, productIndex) => (
                              <div
                                key={`left-set${setIndex}-${product.id}-${productIndex}`}
                                className="relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-xl flex-shrink-0 rounded-lg lg:rounded-xl h-[80px] min-h-[80px] lg:h-[180px] lg:min-h-[180px]"
                              >
                                <img
                                  src={optimizeImage(product.image || '', { w: 200 })}
                                  alt={product.nameAr || product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-1 lg:bottom-2 left-1 lg:left-2 right-1 lg:right-2">
                                  <h4 className="text-white font-bold text-[10px] lg:text-sm leading-tight line-clamp-2 drop-shadow-lg">
                                    {product.nameAr || product.name}
                                  </h4>
                                  <div className="mt-0.5 lg:mt-1 h-0.5 w-4 lg:w-8 bg-gradient-to-r from-white/60 to-transparent"></div>
                                </div>
                              </div>
                            ))
                          )}
                        </motion.div>
                      </div>

                      {/* Middle Ticker - Downward Movement - Shows on mobile and desktop */}
                      <div className="flex-1 h-full overflow-hidden relative">
                        <motion.div
                          className="flex flex-col gap-1 lg:gap-3 p-1 lg:p-2"
                          initial={{ y: 0 }}
                          animate={{ y: -4000 }}
                          transition={{
                            duration: 40,
                            repeat: Infinity,
                            ease: "linear",
                            repeatType: "loop"
                          }}
                        >
                          {/* Exact same duplication as left/right */}
                          {Array.from({ length: 8 }, (_, setIndex) => 
                            categoryProducts.slice().reverse().map((product, productIndex) => (
                              <div
                                key={`middle-set${setIndex}-${product.id}-${productIndex}`}
                                className="relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-xl flex-shrink-0 rounded-lg lg:rounded-xl h-[80px] min-h-[80px] lg:h-[180px] lg:min-h-[180px]"
                              >
                                <img
                                  src={optimizeImage(product.image || '', { w: 200 })}
                                  alt={product.nameAr || product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-1 lg:bottom-2 left-1 lg:left-2 right-1 lg:right-2">
                                  <h4 className="text-white font-bold text-[10px] lg:text-sm leading-tight line-clamp-2 drop-shadow-lg">
                                    {product.nameAr || product.name}
                                  </h4>
                                  <div className="mt-0.5 lg:mt-1 h-0.5 w-4 lg:w-8 bg-gradient-to-r from-white/60 to-transparent"></div>
                                </div>
                              </div>
                            ))
                          )}
                        </motion.div>
                      </div>

                      {/* Right Ticker - Upward Movement (hidden on mobile) */}
                      <div className="flex-1 h-full overflow-hidden relative hidden md:block lg:block">
                        <motion.div
                          className="flex flex-col gap-1 lg:gap-3 p-1 lg:p-2"
                          initial={{ y: 0 }}
                          animate={{ y: -4000 }}
                          transition={{
                            duration: 40,
                            repeat: Infinity,
                            ease: "linear",
                            repeatType: "loop"
                          }}
                        >
                          {/* Perfect duplication for seamless loop */}
                          {Array.from({ length: 8 }, (_, setIndex) => 
                            categoryProducts.slice(1).map((product, productIndex) => (
                              <div
                                key={`right-set${setIndex}-${product.id}-${productIndex}`}
                                className="relative overflow-hidden bg-white/10 backdrop-blur-md border border-white/20 shadow-xl flex-shrink-0 rounded-lg lg:rounded-xl h-[80px] min-h-[80px] lg:h-[180px] lg:min-h-[180px]"
                              >
                                <img
                                  src={optimizeImage(product.image || '', { w: 200 })}
                                  alt={product.nameAr || product.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                                <div className="absolute bottom-1 lg:bottom-2 left-1 lg:left-2 right-1 lg:right-2">
                                  <h4 className="text-white font-bold text-[10px] lg:text-sm leading-tight line-clamp-2 drop-shadow-lg">
                                    {product.nameAr || product.name}
                                  </h4>
                                  <div className="mt-0.5 lg:mt-1 h-0.5 w-4 lg:w-8 bg-gradient-to-r from-white/60 to-transparent"></div>
                                </div>
                              </div>
                            ))
                          )}
                        </motion.div>
                      </div>
                    </div>
                  ) : (
                    /* Fallback when no products - Show category image */
                    <div className="w-full h-full relative">
                      <img
                        src={optimizeImage(category.image || '', { w: 900 })}
                        alt={category.nameAr}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                        <div className="text-center text-white">
                          <Package className="w-16 h-16 mx-auto mb-4 opacity-60" />
                          <p className="text-lg font-semibold">لا توجد منتجات حالياً</p>
                          <p className="text-sm opacity-80">سيتم إضافة المنتجات قريباً</p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </ScrollAnimation>
          </div>
        </div>
      </section>

      {/* Search and Filters - 2 Lines Layout */}
      <ScrollAnimation animation="fadeIn" delay={200}>
        <section className="py-6 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-[100] overflow-visible">
        <div className="container mx-auto px-4 overflow-visible">
          {/* Line 1: Search with Suggestions */}
          <div className="mb-4">
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
              <Input
                placeholder="البحث في المنتجات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-12 rounded-full border-2 border-slate-300 focus:border-primary w-full"
              />
            </div>
            
            {/* Search Suggestions Dropdown - Outside relative container */}
            {searchTerm.length > 0 && (
              <div className="fixed left-1/2 -translate-x-1/2 mt-2 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[9999] max-h-96 overflow-y-auto w-[calc(100%-2rem)] max-w-2xl pointer-events-auto" style={{ top: 'calc(100% + 2rem)' }}>
                  {categoryProducts
                    .filter(p => 
                      p.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
                    )
                    .slice(0, 8)
                    .map((product) => (
                      <button
                        key={product.id}
                        onClick={() => {
                          setSearchTerm(product.nameAr);
                          document.querySelector('[data-products-section]')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="w-full px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors flex items-center gap-3 text-right"
                      >
                        {/* Product Image */}
                        <img
                          src={optimizeImage(product.image || '', { w: 60 })}
                          alt={product.nameAr}
                          className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                        />
                        
                        {/* Product Info */}
                        <div className="flex-1 text-right">
                          <h4 className="font-semibold text-slate-900 text-sm line-clamp-1">
                            {product.nameAr}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {product.sku && `كود: ${product.sku}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  
                  {categoryProducts.filter(p => 
                    p.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).length === 0 && (
                    <div className="px-4 py-6 text-center text-slate-500 text-sm">
                      لا توجد نتائج
                    </div>
                  )}
                </div>
              )}
          </div>

          {/* Line 2: All Controls */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {/* Sort */}
            <div className="flex items-center gap-2">
              <span className="text-slate-600 font-medium text-sm">ترتيب:</span>
              <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'rating' | 'newest') => setSortBy(value)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">الأحدث</SelectItem>
                  <SelectItem value="name">الاسم</SelectItem>
                  <SelectItem value="price">السعر</SelectItem>
                  <SelectItem value="rating">التقييم</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>
            </div>

            {/* Filters Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              فلترة
            </Button>

            {/* View Mode */}
            <div className="flex bg-slate-100 rounded-full p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="rounded-full"
              >
                <Grid className="w-4 h-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="rounded-full"
              >
                <List className="w-4 h-4" />
              </Button>
            </div>

            {/* Results Count */}
            <Badge variant="secondary" className="px-3 py-1.5 text-sm">
              {filteredAndSortedProducts.length} منتج
            </Badge>
          </div>

          {/* Expanded Filters */}
          {showFilters && (
            <ScrollAnimation animation="slideUp" className="mt-6 p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Price Range */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">نطاق السعر</label>
                  <div className="space-y-2">
                    <Slider
                      value={priceRange as unknown as number[]}
                      onValueChange={(vals) => { setPriceTouched(true); setPriceRange(vals as [number, number]); }}
                      min={dynMin}
                      max={dynMax}
                      step={Math.max(1, Math.ceil((dynMax - dynMin) / 100))}
                      className="w-full"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 whitespace-nowrap">من</span>
                        <Input
                          type="number"
                          value={priceRange[0]}
                          min={dynMin}
                          max={priceRange[1]}
                          onChange={(e) => { setPriceTouched(true); const n = Number(e.target.value); if (!Number.isNaN(n)) setPriceRange([Math.max(dynMin, Math.min(n, priceRange[1])), priceRange[1]]); }}
                          className="text-sm"
                        />
                        <span className="text-xs text-slate-500">ج.م</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 whitespace-nowrap">إلى</span>
                        <Input
                          type="number"
                          value={priceRange[1]}
                          min={priceRange[0]}
                          max={dynMax}
                          onChange={(e) => { setPriceTouched(true); const n = Number(e.target.value); if (!Number.isNaN(n)) setPriceRange([priceRange[0], Math.min(dynMax, Math.max(n, priceRange[0]))]); }}
                          className="text-sm"
                        />
                        <span className="text-xs text-slate-500">ج.م</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Rating Filter */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">التقييم</label>
                  <Select value={ratingFilter} onValueChange={(value: 'all' | '4+' | '3+') => setRatingFilter(value)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع التقييمات</SelectItem>
                      <SelectItem value="4+">4 نجوم فأكثر</SelectItem>
                      <SelectItem value="3+">3 نجوم فأكثر</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setPriceTouched(false);
                      setPriceRange([dynMin, dynMax]);
                      setRatingFilter('all');
                      setSearchTerm('');
                    }}
                    className="w-full"
                  >
                    مسح الفلاتر
                  </Button>
                </div>
              </div>
            </ScrollAnimation>
          )}
        </div>
        </section>
      </ScrollAnimation>

      {/* Products Grid */}
      <ScrollAnimation animation="slideUp" delay={300}>
        <section className="py-16 bg-gradient-to-br from-primary/5 via-white to-primary/10">
          <div className="container mx-auto px-4">
          {filteredAndSortedProducts.length === 0 ? (
            <ScrollAnimation animation="fadeIn" className="text-center py-20">
              <Package className="w-24 h-24 text-slate-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-slate-700 mb-4">لا توجد منتجات</h3>
              <p className="text-slate-500">لم نجد أي منتجات تطابق معايير البحث</p>
            </ScrollAnimation>
          ) : (
            <div className={`${
              viewMode === 'grid' 
                ? 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-6' 
                : 'flex flex-col gap-4 max-w-6xl mx-auto'
            }`}>
              {paginatedProducts.map((product, index) => (
                viewMode === 'list' ? (
                  // List View - Split Layout
                  <div
                    key={product.id}
                    className="group relative rounded-2xl overflow-hidden bg-white border-2 border-slate-200 hover:border-primary shadow-md hover:shadow-2xl transition-all duration-500 hover:-translate-y-1 cursor-pointer"
                    onClick={() => navigate(`/product/${product.id}`)}
                    onMouseEnter={() => setHoveredProduct(product.id)}
                    onMouseLeave={() => setHoveredProduct(null)}
                  >
                    {/* Shine Effect */}
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none overflow-hidden rounded-2xl z-10">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                    </div>

                    <div className="flex items-start gap-4 p-4">
                      {/* Left: Product Image */}
                      <div className="relative flex-shrink-0">
                        <div className="w-44 h-44 rounded-xl overflow-hidden bg-slate-50">
                          <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()}>
                            <img
                              src={optimizeImage(product.image || `/api/categories/${product.category}/image`, { w: 180 })}
                              alt={product.nameAr}
                              className={`w-full h-full object-cover transition-transform duration-700 ${hoveredProduct === product.id ? 'scale-110' : 'scale-100'}`}
                              loading="lazy"
                            />
                          </Link>
                        </div>

                        {/* Heart Favorite Button - Top Left of Image */}
                        <div className="absolute top-2 left-2 z-10">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={(e) => handleToggleFavorite(e, product.id)}
                                  className={`bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg border border-slate-100 hover:bg-white hover:shadow-2xl transition-all duration-300 ${
                                    favorites.includes(product.id) ? 'heart-active' : ''
                                  }`}
                                >
                                  <Heart 
                                    className={`w-4 h-4 transition-all duration-300 ${
                                      favorites.includes(product.id) 
                                        ? 'fill-primary text-primary' 
                                        : 'text-slate-400 hover:text-primary hover:fill-primary'
                                    }`}
                                  />
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="right">
                                <p>{favorites.includes(product.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>

                        {product.discount && (
                          <Badge className="absolute bottom-2 left-2 bg-destructive text-white font-bold px-2 py-1 text-xs shadow-lg">
                            خصم {product.discount}%
                          </Badge>
                        )}
                      </div>

                      {/* Middle: Product Info */}
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        {/* Top Content */}
                        <div className="space-y-3">
                          {/* Header: Name + Category Badge */}
                          <div className="flex items-start justify-between gap-3">
                            <Link to={`/product/${product.id}`} className="flex-1">
                              <h3 className="font-bold text-lg text-slate-900 line-clamp-2 group-hover:text-primary transition-colors">
                                {product.nameAr}
                              </h3>
                            </Link>
                            <Link 
                              to={`/category/${product.category}`}
                              className="flex-shrink-0 text-xs font-semibold text-white bg-primary/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-lg hover:bg-primary transition-colors"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {product.categoryAr || product.category}
                            </Link>
                          </div>

                          {/* Rating - Only show if rating exists */}
                          {product.rating && product.rating > 0 && (
                            <div 
                              className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                              onMouseLeave={() => handleStarLeave(product.id)}
                            >
                              {Array.from({ length: 5 }, (_, i) => {
                                const starIndex = i + 1;
                                const productHoveredRating = hoveredRating[product.id] || 0;
                                const isHoveredStar = productHoveredRating >= starIndex;
                                const isRated = i < Math.floor(product.rating || 0);
                                const shouldHighlight = productHoveredRating > 0 ? isHoveredStar : isRated;
                                
                                return (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 transition-colors duration-200 cursor-pointer ${
                                      shouldHighlight
                                        ? 'text-yellow-400 fill-yellow-400'
                                        : 'text-slate-300 hover:text-yellow-300'
                                    }`}
                                    onMouseEnter={() => handleStarHover(product.id, starIndex)}
                                    onClick={(e) => handleRatingClick(e, product, starIndex)}
                                  />
                                );
                              })}
                              <span 
                                className="text-sm text-slate-500 mr-1 cursor-pointer hover:text-primary transition-colors"
                                onClick={(e) => handleRatingClick(e, product)}
                              >
                                ({product.reviews || 0} تقييم)
                              </span>
                            </div>
                          )}

                          {/* Description */}
                          {(product.description || product.descriptionAr) && (
                            <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                              {product.description || product.descriptionAr}
                            </p>
                          )}
                        </div>

                        {/* Bottom Content - Pushed to bottom */}
                        <div className="space-y-3">
                          {/* Separation Line */}
                          <div className="relative h-0.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-r from-primary via-secondary to-primary transform -translate-x-full group-hover:translate-x-0 transition-transform duration-700 ease-out"></div>
                          </div>

                        {/* Bottom: Price + Buttons */}
                        <div className="flex items-center justify-between gap-4">
                          {!hidePrices && (
                            <div className="flex items-baseline gap-2">
                              <span className="text-2xl font-black text-primary">{product.price.toLocaleString()}</span>
                              <span className="text-sm text-slate-600">ج.م</span>
                              {product.originalPrice && (
                                <span className="text-sm text-slate-400 line-through">{product.originalPrice.toLocaleString()}</span>
                              )}
                            </div>
                          )}

                          <TooltipProvider>
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(`/product/${product.id}`);
                                    }}
                                    className="h-10 w-24 rounded-xl bg-primary hover:bg-primary/90 text-white transition-all duration-300 flex items-center justify-center gap-2"
                                  >
                                    <Eye className="w-4 h-4" />
                                    <span className="text-sm font-medium">عرض</span>
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent side="top">
                                  <p>عرض التفاصيل</p>
                                </TooltipContent>
                              </Tooltip>
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (hidePrices) {
                                    setSelectedProductForWhatsApp(product);
                                    setShowWhatsAppModal(true);
                                  } else {
                                    handleAddToCart(e, product);
                                  }
                                }}
                                className={`h-10 w-36 rounded-xl text-sm font-semibold transition-all duration-500 group/btn relative overflow-hidden ${
                                  hidePrices
                                    ? 'bg-green-500 hover:bg-green-600 text-white'
                                    : checkIsInCart(product.id)
                                      ? 'bg-green-500 hover:bg-green-600 text-white'
                                      : 'bg-primary hover:bg-primary/90 text-white'
                                }`}
                              >
                                {hidePrices ? (
                                  /* When prices hidden - WhatsApp contact */
                                  <>
                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                                      <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                                      <span>لمعرفة السعر</span>
                                    </span>
                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                                      <img src={whatsappIcon} alt="WhatsApp" className="w-4 h-4" />
                                      <span>اضغط هنا</span>
                                    </span>
                                  </>
                                ) : checkIsInCart(product.id) ? (
                                  /* In Cart - Show checkmark with hover animation (left to right) */
                                  <>
                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                                      <Check className="w-4 h-4" />
                                      <span>في السلة</span>
                                    </span>
                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                                      <Plus className="w-4 h-4" />
                                      <span>إضافة واحد آخر</span>
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    {/* Default content - Cart icon + text */}
                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                                      <ShoppingBag className="w-4 h-4" />
                                      <span>السلة</span>
                                    </span>
                                    
                                    {/* Hover content - Full text with arrow */}
                                    <span className="absolute inset-0 flex items-center justify-center gap-1.5 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                                      <ArrowRight className="w-4 h-4" />
                                      <span>إضافة إلى السلة</span>
                                    </span>
                                  </>
                                )}
                              </Button>
                            </div>
                          </TooltipProvider>
                        </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Grid View - Original Card Design
                <div
                  key={product.id}
                  className="group relative h-full rounded-2xl overflow-hidden bg-gradient-to-br from-white to-slate-50/50 border border-slate-100 shadow-sm hover:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] hover:ring-2 hover:ring-primary/20 hover:ring-offset-2 transition-all duration-500 hover:-translate-y-4 cursor-pointer"
                  onClick={() => navigate(`/product/${product.id}`)}
                  onMouseEnter={() => setHoveredProduct(product.id)}
                  onMouseLeave={() => setHoveredProduct(null)}
                >
                  {/* Shine Effect */}
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none overflow-hidden rounded-2xl">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                  </div>

                  {/* Product Image Slider */}
                  <div className="relative aspect-[4/3] overflow-hidden group/slider">
                    {product.images && product.images.length > 0 ? (
                      /* Multiple Images - Show Swiper */
                      <>
                        <Swiper
                          modules={[Navigation, Pagination]}
                          navigation={{
                            prevEl: `.swiper-button-prev-${product.id}`,
                            nextEl: `.swiper-button-next-${product.id}`,
                          }}
                          pagination={{
                            clickable: true,
                            dynamicBullets: true,
                          }}
                          className="h-full category-product-swiper"
                          speed={600}
                          loop={product.images.length >= 2}
                          watchSlidesProgress={true}
                        >
                          {/* All Images (main image is already in product.images array) */}
                          {product.images.slice(0, 5).map((img, idx) => (
                            <SwiperSlide key={`${product.id}-${idx}`}>
                              <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()} className="block w-full h-full">
                                <img
                                  src={optimizeImage(img, { w: 320 })}
                                  alt={`${product.nameAr} - ${idx + 1}`}
                                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                  loading="lazy"
                                />
                              </Link>
                            </SwiperSlide>
                          ))}
                        </Swiper>
                        
                        {/* Navigation Arrows - Only visible on hover (desktop only) */}
                        <div 
                          className={`swiper-button-prev-${product.id} hidden md:flex absolute left-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-lg items-center justify-center cursor-pointer opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300 hover:bg-white`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChevronLeft className="w-4 h-4 text-slate-700" />
                        </div>
                        <div 
                          className={`swiper-button-next-${product.id} hidden md:flex absolute right-2 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-white/90 backdrop-blur-sm rounded-full shadow-lg items-center justify-center cursor-pointer opacity-0 group-hover/slider:opacity-100 transition-opacity duration-300 hover:bg-white`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <ChevronRight className="w-4 h-4 text-slate-700" />
                        </div>
                      </>
                    ) : (
                      /* Single Image - No Swiper */
                      <Link to={`/product/${product.id}`} onClick={(e) => e.stopPropagation()} className="block w-full h-full">
                        <img
                          src={optimizeImage(product.image || `/api/categories/${product.category}/image`, { w: 320 })}
                          alt={product.nameAr}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          loading="lazy"
                        />
                      </Link>
                    )}

                    {/* Category Badge - Top Right */}
                    <Link 
                      to={`/category/${product.category}`}
                      className="absolute top-3 right-3 text-xs md:text-sm font-bold text-white bg-gradient-to-r from-primary to-secondary backdrop-blur-md px-4 py-2 rounded-lg shadow-xl hover:shadow-2xl transition-all z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      📦 {product.categoryAr || product.category}
                    </Link>

                    {/* Heart Favorite Button - Top Left */}
                    <div className="absolute top-3 left-3 z-10">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={(e) => handleToggleFavorite(e, product.id)}
                              className={`group/heart bg-white/95 backdrop-blur-sm rounded-full p-2 shadow-lg border border-slate-100 hover:bg-white hover:shadow-xl hover:scale-110 transition-all duration-300 relative ${
                                favorites.includes(product.id) ? 'heart-active' : ''
                              }`}
                            >
                              <Heart 
                                className={`w-5 h-5 transition-all duration-300 ${
                                  favorites.includes(product.id) 
                                    ? 'fill-primary text-primary' 
                                    : 'text-slate-400 group-hover/heart:text-primary group-hover/heart:fill-primary'
                                }`}
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom">
                            <p>{favorites.includes(product.id) ? 'إزالة من المفضلة' : 'إضافة للمفضلة'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {product.discount && (
                      <Badge className="absolute bottom-3 left-3 bg-gradient-to-r from-red-500 via-red-600 to-red-700 text-white font-black px-4 py-2 text-sm md:text-base shadow-2xl animate-pulse">
                        🔥 -{product.discount}%
                      </Badge>
                    )}
                  </div>

                  {/* Product Info */}
                  <div className="p-4 md:p-5 space-y-3">
                    <Link to={`/product/${product.id}`} className="block">
                      <h3 className="font-bold text-sm md:text-base lg:text-lg text-slate-900 line-clamp-2 group-hover:text-primary transition-colors leading-tight overflow-hidden">
                        {product.nameAr}
                      </h3>
                    </Link>

                    {/* Product Code Badge */}
                    {(product as any).sku && (product as any).sku !== '0' && (
                      <div className="flex items-center gap-1 text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded-full font-medium w-fit">
                        <span className="font-semibold">الكود: {(product as any).sku}</span>
                      </div>
                    )}

                    {/* Price Section - Only show if prices visible */}
                    {!hidePrices && (
                      <div className="space-y-2">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-2xl md:text-3xl font-black text-primary drop-shadow-sm">{product.price.toLocaleString()}</span>
                          <span className="text-sm md:text-base text-slate-600 font-semibold">ج.م</span>
                          {product.originalPrice && product.originalPrice > product.price && (
                            <span className="text-sm text-slate-400 line-through">{product.originalPrice.toLocaleString()}</span>
                          )}
                        </div>
                        
                        {/* Reviews Badge - Only show if reviews exist */}
                        {product.reviews && product.reviews > 0 && (
                          <Badge 
                            variant="secondary" 
                            className="text-xs cursor-pointer hover:bg-slate-200 transition-colors"
                            onClick={(e) => handleRatingClick(e, product)}
                          >
                            ⭐ {product.reviews} تقييم
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* Full Width Cart Button */}
                    <Button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (hidePrices) {
                          setSelectedProductForWhatsApp(product);
                          setShowWhatsAppModal(true);
                        } else {
                          handleAddToCart(e, product);
                        }
                      }}
                      className={`w-full rounded-xl h-11 md:h-12 text-sm md:text-base font-bold transition-all duration-500 group/btn relative overflow-hidden shadow-lg hover:shadow-xl ${
                        hidePrices
                          ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                          : checkIsInCart(product.id)
                            ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white'
                            : 'bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white'
                      }`}
                    >
                      {hidePrices ? (
                        /* When prices hidden - WhatsApp contact */
                        <>
                          <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                            <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
                            <span>لمعرفة السعر</span>
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                            <img src={whatsappIcon} alt="WhatsApp" className="w-5 h-5" />
                            <span>اضغط هنا</span>
                          </span>
                        </>
                      ) : checkIsInCart(product.id) ? (
                        /* In Cart - Show checkmark with hover animation */
                        <>
                          <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                            <Check className="w-5 h-5" />
                            <span>في السلة ✓</span>
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                            <Plus className="w-5 h-5" />
                            <span>إضافة المزيد</span>
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="absolute inset-0 flex items-center justify-center gap-2 transition-all duration-500 ease-in-out group-hover/btn:opacity-0 group-hover/btn:translate-x-full">
                            <ShoppingBag className="w-5 h-5" />
                            <span>أضف للسلة</span>
                          </span>
                          <span className="absolute inset-0 flex items-center justify-center gap-2 opacity-0 -translate-x-full transition-all duration-500 ease-in-out group-hover/btn:opacity-100 group-hover/btn:translate-x-0">
                            <ShoppingBag className="w-5 h-5" />
                            <span>إضافة إلى السلة 🛒</span>
                          </span>
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                )
              ))}
            </div>
          )}
          {/* Pagination Controls */}
          {filteredAndSortedProducts.length > 0 && (
            <div className="flex items-center justify-center gap-4 mt-8">
              <Button variant="outline" disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                السابق
              </Button>
              <span className="text-slate-600">
                الصفحة {currentPage} من {totalPages}
              </span>
              <Button variant="outline" disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                التالي
              </Button>
            </div>
          )}
          </div>
        </section>
      </ScrollAnimation>

      {/* Rating Modal */}
      {selectedProduct && (
        <Dialog open={showRatingModal} onOpenChange={setShowRatingModal}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-center mb-4">
                تقييم المنتج
              </DialogTitle>
              <div className="text-center mb-4">
                <img
                  src={optimizeImage(selectedProduct.image, { w: 100 })}
                  alt={selectedProduct.nameAr}
                  className="w-16 h-16 object-cover rounded-lg mx-auto mb-2"
                />
                <h4 className="font-semibold text-slate-900">{selectedProduct.nameAr}</h4>
              </div>
            </DialogHeader>
            <Rating
              productId={selectedProduct.id}
              initialRating={selectedRating}
              onRatingSubmit={handleRatingSubmit}
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Auth Modal - Shows when user tries to favorite or add to cart without login */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action={authAction}
      />

      {/* WhatsApp Contact Modal */}
      {selectedProductForWhatsApp && (
        <WhatsAppContactModal
          isOpen={showWhatsAppModal}
          onClose={() => {
            setShowWhatsAppModal(false);
            setSelectedProductForWhatsApp(null);
          }}
          productName={selectedProductForWhatsApp.nameAr || selectedProductForWhatsApp.name}
          productId={selectedProductForWhatsApp.id}
          productCode={(selectedProductForWhatsApp as any).sku}
          productImage={selectedProductForWhatsApp.image}
        />
      )}
    </div>
  );
};

export default CategoryPage;
