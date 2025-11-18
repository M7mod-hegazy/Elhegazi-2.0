import { useState, useMemo, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Star, Award, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ProductCard from '@/components/product/ProductCard';
import ProductsFilterBar from '@/components/product/ProductsFilterBar';
import SocialLinks from '@/components/layout/SocialLinks';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import ScrollAnimation from '@/components/ui/scroll-animation';
import { apiGet, type ApiResponse } from '@/lib/api';
import { SectionGuard } from '@/components/common/SectionGuard';
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

const FeaturedProductsContent = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'rating' | 'newest'>('newest');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [priceTouched, setPriceTouched] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<'all' | '4+' | '3+'>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const [products, setProducts] = useState<ApiProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch featured products based on admin panel selection
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        
        // First, get the selected product IDs from HomeConfig
        const configResponse = await apiGet<{ featuredProductIds?: string[] }>('/api/home-config');
        
        if (!configResponse.ok || !configResponse.item) {
          setError('فشل في تحميل إعدادات المنتجات');
          return;
        }
        
        const selectedIds = configResponse.item.featuredProductIds || [];
        
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
          setError('فشل في تحميل المنتجات المميزة');
        }
      } catch (err) {
        setError('حدث خطأ في تحميل المنتجات');
        console.error('Error fetching featured products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Base filtered products (exclude price for dynamic bounds)
  const baseFiltered = useMemo(() => {
    let filtered = products.filter(product => {
      const matchesSearch = !searchTerm || 
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.nameAr && product.nameAr.includes(searchTerm));
      return matchesSearch;
    });
    
    if (ratingFilter !== 'all') {
      filtered = filtered.filter(product => {
        // Default rating for featured products
        const rating = 4.5;
        switch (ratingFilter) {
          case '4+': return rating >= 4;
          case '3+': return rating >= 3;
          default: return true;
        }
      });
    }
    return filtered;
  }, [products, searchTerm, ratingFilter]);

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
  const filteredProducts = useMemo(() => {
    const withinPrice = baseFiltered.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);
    const sorted = [...withinPrice];
    sorted.sort((a, b) => {
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
          comparison = 0;
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [baseFiltered, priceRange, sortBy, sortOrder]);


  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg text-muted-foreground">جاري تحميل المنتجات المميزة...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <Star className="w-8 h-8 text-destructive" />
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
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary to-secondary text-white py-16 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/20"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20"></div>
        
        {/* Decorative Elements */}
        <div className="absolute top-10 right-10 w-20 h-20 bg-white/10 rounded-full animate-pulse"></div>
        <div className="absolute bottom-10 left-10 w-16 h-16 bg-white/10 rounded-full animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-12 h-12 bg-white/10 rounded-full animate-pulse delay-500"></div>
        
        <div className="container mx-auto px-4 relative z-10">
          <ScrollAnimation>
            <div className="text-center">
              <div className="flex items-center justify-center mb-6">
                <div className="bg-white/20 p-4 rounded-full ml-4">
                  <Award className="w-12 h-12" />
                </div>
                <div className="bg-white/20 p-3 rounded-full">
                  <Sparkles className="w-10 h-10" />
                </div>
              </div>
              <h1 className="text-4xl md:text-6xl font-bold mb-4 bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
                المنتجات المميزة
              </h1>
              <p className="text-xl md:text-2xl text-white/90 mb-6 max-w-2xl mx-auto">
                اكتشف مجموعتنا المختارة بعناية من أفضل المنتجات وأكثرها تميزاً
              </p>
              <div className="flex items-center justify-center gap-2 text-white/80">
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <Star className="w-5 h-5 fill-current" />
                <span className="mr-2">منتجات مختارة بعناية فائقة</span>
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
            <span className="text-primary font-medium">المنتجات المميزة</span>
          </nav>
        </div>
      </div>

      {/* Search and Filters - Category Page Style */}
      <ProductsFilterBar
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        searchPlaceholder="البحث في المنتجات المميزة..."
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        showFilters={showFilters}
        setShowFilters={setShowFilters}
        priceRange={priceRange}
        setPriceRange={setPriceRange}
        setPriceTouched={setPriceTouched}
        dynMin={dynMin}
        dynMax={dynMax}
        ratingFilter={ratingFilter}
        setRatingFilter={setRatingFilter}
        viewMode={viewMode}
        setViewMode={setViewMode}
        resultsCount={filteredProducts.length}
        onClearFilters={() => {
          setPriceTouched(false);
          setPriceRange([dynMin, dynMax]);
          setRatingFilter('all');
          setSearchTerm('');
        }}
      />

      {/* Products Grid */}
      <div className="container mx-auto px-4 py-8">
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
                      originalPrice: undefined,
                      discount: undefined,
                      image: product.image || '',
                      images: product.images || [],
                      category: product.categorySlug || '',
                      categoryAr: product.categorySlug || '',
                      description: product.description || '',
                      descriptionAr: product.description || '',
                      rating: 4.5,
                      reviews: 0,
                      stock: product.stock || 0,
                      featured: product.featured || false,
                      tags: [],
                      sku: product.sku || '',
                      createdAt: product.createdAt,
                      updatedAt: product.updatedAt
                    }}
                    className="h-full hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
                  />
                  {/* Featured Badge */}
                  <div className="absolute top-3 right-3 z-10">
                    <Badge className="bg-gradient-to-r from-primary to-secondary text-white border-0 shadow-lg">
                      <Star className="w-3 h-3 ml-1 fill-current" />
                      مميز
                    </Badge>
                  </div>
                </div>
              </ScrollAnimation>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-24 h-24 bg-muted rounded-full flex items-center justify-center mx-auto mb-6">
              <Star className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">لا توجد منتجات مميزة</h3>
            <p className="text-muted-foreground mb-6">
              لم نتمكن من العثور على منتجات مميزة تطابق معايير البحث الخاصة بك
            </p>
            <Button onClick={() => {
              setSearchTerm('');
              setPriceTouched(false);
              setPriceRange([dynMin, dynMax]);
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

const FeaturedProducts = () => {
  return (
    <SectionGuard section="featuredProducts">
      <FeaturedProductsContent />
    </SectionGuard>
  );
};

export default FeaturedProducts;
