import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { SectionGuard } from '@/components/common/SectionGuard';
import { ArrowRight, Clock, Sparkles, Zap, Search, Filter, SortAsc, SortDesc, Grid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import ProductCard from '@/components/product/ProductCard';
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
  createdAt: string;
  updatedAt: string;
  rating?: number;
  reviews?: number;
};

const LatestProductsContent = () => {
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

  // Fetch latest products based on admin panel selection
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);

        // First, get the selected product IDs from HomeConfig
        const configResponse = await apiGet<{ newArrivalProductIds?: string[] }>('/api/home-config');

        if (!configResponse.ok || !configResponse.item) {
          setError('فشل في تحميل إعدادات المنتجات');
          return;
        }

        const selectedIds = configResponse.item.newArrivalProductIds || [];

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
          setError('فشل في تحميل أحدث المنتجات');
        }
      } catch (err) {
        setError('حدث خطأ في تحميل المنتجات');
        console.error('Error fetching latest products:', err);
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

      const matchesRating = ratingFilter === 'all' ||
        (ratingFilter === '4+' && (product.rating || 0) >= 4) ||
        (ratingFilter === '3+' && (product.rating || 0) >= 3);

      return matchesSearch && matchesPrice && matchesRating;
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
        case 'newest':
          comparison = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
          break;
        case 'rating':
          // Default rating comparison (can be enhanced with actual ratings)
          comparison = 0;
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [products, searchTerm, priceRange, sortBy, sortOrder, ratingFilter]);

  const maxPrice = useMemo(() => {
    return Math.max(...products.map(p => p.price), 10000);
  }, [products]);

  // Helper function to check if product is very new (within last 7 days)
  const isVeryNew = (createdAt: string) => {
    const productDate = new Date(createdAt);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return productDate > weekAgo;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg text-muted-foreground">جاري تحميل أحدث المنتجات...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Clock className="w-8 h-8 text-destructive" />
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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-indigo-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 to-indigo-700/20"></div>

        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-white/10 rounded-full animate-pulse"></div>
        <div className="absolute bottom-10 left-10 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500"></div>

        <div className="container mx-auto px-4 relative z-10">
          <ScrollAnimation>
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-white/20 p-4 rounded-full ml-4">
                  <Clock className="w-12 h-12" />
                </div>
                <div className="bg-white/20 p-3 rounded-full">
                  <Zap className="w-10 h-10" />
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                أحدث المنتجات
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-6 max-w-2xl mx-auto">
                اكتشف آخر إضافاتنا من المنتجات الجديدة والمبتكرة
              </p>
              <div className="flex items-center justify-center gap-4 text-white/80">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5" />
                  <span>منتجات جديدة كل يوم</span>
                </div>
                <div className="w-1 h-6 bg-white/30"></div>
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span>أحدث الابتكارات</span>
                </div>
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
            <span className="text-purple-600 font-medium">أحدث المنتجات</span>
          </nav>
        </div>
      </div>

      {/* Compact Search and Filters */}
      <section className="py-6 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="container mx-auto px-4">
          <div className="space-y-4">
            {/* Search Bar */}
            <div className="mb-4">
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
                <Input
                  placeholder="البحث في أحدث المنتجات..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-12 rounded-full border-2 border-slate-300 focus:border-primary w-full"
                />
              </div>
            </div>

            {/* Controls Row */}
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
              </div>

              {/* Filter Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsFilterOpen(!isFilterOpen)}
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
                {filteredProducts.length} منتج
              </Badge>
            </div>

            {/* Expandable Filters */}
            {isFilterOpen && (
              <div className="mt-6 p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Price Range */}
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-3">نطاق السعر</label>
                    <div className="space-y-2">
                      <Slider
                        value={priceRange}
                        onValueChange={(values) => {
                          setPriceTouched(true);
                          setPriceRange(values as [number, number]);
                        }}
                        max={maxPrice}
                        min={0}
                        step={50}
                        className="w-full"
                      />
                      <div className="flex items-center justify-between text-sm text-slate-600">
                        <span>{priceRange[0]} ج.م</span>
                        <span>{priceRange[1]} ج.م</span>
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
                        <SelectItem value="all">الكل</SelectItem>
                        <SelectItem value="4+">4+ نجوم</SelectItem>
                        <SelectItem value="3+">3+ نجوم</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Clear Filters */}
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setPriceTouched(false);
                        setPriceRange([0, maxPrice]);
                        setRatingFilter('all');
                        setSearchTerm('');
                      }}
                      className="w-full"
                    >
                      مسح الفلاتر
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

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
                      image: product.image,
                      category: product.categorySlug,
                      featured: product.featured,
                      rating: product.rating || 0,
                      reviews: product.reviews || 0,
                    }}
                    className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  />
                  {/* New Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-gradient-to-r from-purple-600 to-indigo-700 text-white border-0 shadow-lg">
                      <Sparkles className="w-3 h-3 ml-1 fill-current" />
                      جديد
                    </Badge>
                  </div>
                  {/* Very New Badge for products within last week */}
                  {isVeryNew(product.createdAt) && (
                    <div className="absolute top-3 left-3 z-10">
                      <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white border-0 shadow-lg animate-pulse">
                        <Zap className="w-3 h-3 ml-1 fill-current" />
                        وصل حديثاً
                      </Badge>
                    </div>
                  )}
                </div>
              </ScrollAnimation>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Clock className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">لا توجد منتجات جديدة</h3>
            <p className="text-muted-foreground mb-6">
              لم نتمكن من العثور على منتجات جديدة تطابق معايير البحث الخاصة بك
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

const LatestProducts = () => {
  return (
    <SectionGuard section="newArrivals">
      <LatestProductsContent />
    </SectionGuard>
  );
};

export default LatestProducts;
