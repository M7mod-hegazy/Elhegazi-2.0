import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SectionGuard } from '@/components/common/SectionGuard';
import { ArrowRight, TrendingUp, Crown, Flame, Filter, Search, Grid, List, SortAsc, SortDesc } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import ProductCard from '@/components/product/ProductCard';
import ProductsFilterBar from '@/components/product/ProductsFilterBar';
import SocialLinks from '@/components/layout/SocialLinks';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import ScrollAnimation from '@/components/ui/scroll-animation';
import { apiGet, type ApiResponse } from '@/lib/api';
import type { Product } from '@/types';

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
  salesCount?: number;
  createdAt: string;
  updatedAt: string;
};

const BestSellersContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating' | 'newest'>('newest');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [priceTouched, setPriceTouched] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<'all' | '4+' | '3+'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch best sellers based on admin panel selection
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        // First, get the selected product IDs from HomeConfig
        const configResponse = await apiGet<{ bestSellerProductIds?: string[] }>('/api/home-config');

        if (!configResponse.ok || !configResponse.item) {
          setError('فشل في تحميل إعدادات المنتجات');
          return;
        }

        const selectedIds = configResponse.item.bestSellerProductIds || [];

        if (selectedIds.length === 0) {
          setProducts([]);
          return;
        }

        // Fetch products by IDs
        const idsParam = encodeURIComponent(selectedIds.join(','));
        const response = await apiGet<ApiProduct>(`/api/products?ids=${idsParam}`);

        if (response.ok && response.items) {
          const activeProducts = response.items.filter((product: ApiProduct) =>
            product.active !== false
          );
          setProducts(activeProducts);
        } else {
          setError('فشل في تحميل المنتجات الأكثر مبيعاً');
        }
      } catch (err) {
        setError('حدث خطأ في تحميل المنتجات');
        console.error('Error fetching best sellers:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    const filtered = products.filter(product => {
      const matchesSearch = !searchTerm ||
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.nameAr && product.nameAr.includes(searchTerm));

      const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];

      return matchesSearch && matchesPrice;
    });

    // Sort products
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'name':
          comparison = (a.nameAr || a.name).localeCompare(b.nameAr || b.name, 'ar');
          break;
        case 'price':
          comparison = a.price - b.price;
          break;
        case 'rating':
          comparison = 0; // Default rating
          break;
        case 'newest':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [products, searchTerm, priceRange, sortBy, sortOrder]);

  const maxPrice = useMemo(() => {
    return Math.max(...products.map(p => p.price), 10000);
  }, [products]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg text-muted-foreground">جاري تحميل المنتجات الأكثر مبيعاً...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <TrendingUp className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-lg text-destructive mb-4">{error}</p>
              <Button onClick={() => window.location.reload()}>
                إعادة المحاولة
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-red-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-orange-500 to-red-600 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-orange-500/20 to-red-600/20"></div>

        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-white/10 rounded-full animate-bounce"></div>
        <div className="absolute bottom-10 left-10 w-16 h-16 bg-white/10 rounded-full animate-bounce delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-bounce delay-500"></div>

        <div className="container mx-auto px-4 relative z-10">
          <ScrollAnimation>
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-white/20 p-4 rounded-full ml-4">
                  <Crown className="w-12 h-12" />
                </div>
                <div className="bg-white/20 p-3 rounded-full">
                  <Flame className="w-10 h-10" />
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                الأكثر مبيعاً
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-6 max-w-2xl mx-auto">
                المنتجات الأكثر شعبية وإقبالاً من عملائنا الكرام
              </p>
              <div className="flex items-center justify-center gap-2 text-white/80">
                <TrendingUp className="w-5 h-5" />
                <span className="mr-2">منتجات محبوبة من الآلاف</span>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </div>

      {/* Breadcrumb */}
      <div className="bg-white/80 backdrop-blur-sm border-b">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/" className="text-muted-foreground hover:text-primary transition-colors">
              الرئيسية
            </Link>
            <ArrowRight className="w-4 h-4 text-muted-foreground" />
            <span className="text-orange-600 font-medium">الأكثر مبيعاً</span>
          </nav>
        </div>
      </div>

      {/* Filter Bar */}
      <ProductsFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchPlaceholder="البحث في الأكثر مبيعاً..."
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        setPriceTouched={setPriceTouched}
        dynMin={0}
        dynMax={maxPrice}
        ratingFilter={ratingFilter}
        setRatingFilter={setRatingFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        resultsCount={filteredProducts.length}
        onClearFilters={() => {
          setPriceTouched(false);
          setPriceRange([0, maxPrice]);
          setRatingFilter('all');
          setSearchTerm('');
        }}
      />

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
        {filteredProducts.length > 0 ? (
          <div className={`grid gap-6 ${viewMode === 'grid'
              ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'grid-cols-1'
            }`}>
            {filteredProducts.map((product, index) => (
              <ScrollAnimation key={product._id} delay={index * 0.1}>
                <div className="relative group">
                  <ProductCard
                    product={{
                      id: product._id,
                      nameAr: product.nameAr || product.name,
                      name: product.name,
                      price: product.price,
                      originalPrice: product.originalPrice,
                      image: product.image,
                      category: product.categorySlug,
                      featured: product.featured,
                      rating: product.rating || 0,
                      reviews: product.reviews || 0,
                    }}
                    className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  />
                  {/* Best Seller Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-gradient-to-r from-orange-500 to-red-600 text-white border-0 shadow-lg">
                      <Crown className="w-3 h-3 ml-1 fill-current" />
                      الأكثر مبيعاً
                    </Badge>
                  </div>
                  {/* Ranking Badge */}
                  {index < 3 && (
                    <div className="absolute top-3 left-3 z-10">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${index === 0 ? 'bg-yellow-500' :
                          index === 1 ? 'bg-gray-400' :
                            'bg-orange-600'
                        }`}>
                        {index + 1}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollAnimation>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <TrendingUp className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">لا توجد منتجات</h3>
            <p className="text-muted-foreground mb-6">
              لم نتمكن من العثور على منتجات تطابق معايير البحث الخاصة بك
            </p>
            <Button onClick={() => {
              setSearchTerm('');
              setPriceRange([0, maxPrice]);
              setRatingFilter('all');
            }}>
              مسح التصفية
            </Button>
          </div>
        )}
      </div>

      {/* Social Links */}
      <SocialLinks />
    </div>
  );
};

const BestSellers = () => {
  return (
    <SectionGuard section="bestSellers">
      <BestSellersContent />
    </SectionGuard>
  );
};

export default BestSellers;
