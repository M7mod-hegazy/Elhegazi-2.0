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
};

const LatestProductsContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'newest' | 'rating'>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
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
  }, [products, searchTerm, priceRange, sortBy, sortOrder]);

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

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Filters Sidebar */}
          <div className={`lg:w-80 ${showFilters ? 'block' : 'hidden lg:block'}`}>
            <div className="bg-white rounded-2xl shadow-lg border p-6 sticky top-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Filter className="w-5 h-5 text-purple-600" />
                  تصفية النتائج
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setShowFilters(false)}
                >
                  إغلاق
                </Button>
              </div>

              {/* Search */}
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">البحث</Label>
                <div className="relative">
                  <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="ابحث في أحدث المنتجات..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10"
                  />
                </div>
              </div>

              {/* Price Range */}
              <div className="mb-6">
                <Label className="text-sm font-medium mb-4 block">نطاق السعر</Label>
                <Slider
                  value={priceRange}
                  onValueChange={setPriceRange}
                  max={maxPrice}
                  step={50}
                  className="mb-4"
                />
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>{priceRange[0]} ج.م</span>
                  <span>{priceRange[1]} ج.م</span>
                </div>
              </div>

              {/* Sort Options */}
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">ترتيب حسب</Label>
                <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'newest') => setSortBy(value)}>
                  <SelectTrigger>
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

              {/* Latest Products Badge */}
              <div className="bg-gradient-to-r from-purple-100 to-indigo-100 rounded-xl p-4 border border-purple-200">
                <div className="flex items-center gap-3 mb-2">
                  <Clock className="w-6 h-6 text-purple-600" />
                  <span className="font-semibold text-purple-600">أحدث المنتجات</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  آخر إضافاتنا من المنتجات الجديدة والمبتكرة
                </p>
              </div>
            </div>
          </div>

          {/* Products Grid */}
          <div className="flex-1">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">
                  أحدث المنتجات ({filteredProducts.length})
                </h2>
                <p className="text-muted-foreground">
                  آخر إضافاتنا من المنتجات الجديدة والمميزة
                </p>
              </div>

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  className="lg:hidden"
                  onClick={() => setShowFilters(true)}
                >
                  <Filter className="w-4 h-4 ml-2" />
                  تصفية
                </Button>

                <div className="flex items-center gap-1 bg-white rounded-lg border p-1">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            {/* Products */}
            {filteredProducts.length > 0 ? (
              <div className={`grid gap-6 ${
                viewMode === 'grid' 
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
                }}>
                  مسح التصفية
                </Button>
              </div>
            )}
          </div>
        </div>
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
