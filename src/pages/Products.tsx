import { useState, useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, Filter, Grid, List, SortAsc, SortDesc, Package } from 'lucide-react';
import ProductCard from '@/components/product/ProductCard';
import { ProductGridSkeleton } from '@/components/ui/loading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { apiGet, type ApiResponse } from '@/lib/api';
import { Product, ProductFilters, SortOption, Category } from '@/types';
import { usePageTitle } from '@/hooks/usePageTitle';
import SocialLinks from '@/components/layout/SocialLinks';

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

const sortOptions: SortOption[] = [
  { value: 'newest', label: 'الأحدث', labelAr: 'الأحدث' },
  { value: 'price-low', label: 'السعر: الأقل أولاً', labelAr: 'السعر: الأقل أولاً' },
  { value: 'price-high', label: 'السعر: الأعلى أولاً', labelAr: 'السعر: الأعلى أولاً' },
  { value: 'name', label: 'الاسم: أ-ي', labelAr: 'الاسم: أ-ي' },
  { value: 'rating', label: 'التقييم: الأعلى أولاً', labelAr: 'التقييم: الأعلى أولاً' },
  { value: 'popularity', label: 'الأكثر شعبية', labelAr: 'الأكثر شعبية' }
];

const DEFAULT_MIN_PRICE = 0;
const DEFAULT_MAX_PRICE = 10000;

const Products = () => {
  // Set page title
  usePageTitle('المنتجات');
  
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState<number>(Number(searchParams.get('page')) || 1);
  const pageSize = 12;

  // Live data
  const [liveProducts, setLiveProducts] = useState<Product[]>([]);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);

  // Fetch categories and products from backend
  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        const [catRes, prodRes] = await Promise.all([
          apiGet<ApiCategory>('/api/categories'),
          apiGet<ApiProduct>('/api/products'),
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
        const catBySlug = new Map(categories.map((c) => [c.slug, c]));

        const prodItems = (prodRes as Extract<ApiResponse<ApiProduct>, { ok: true }>).items ?? [];
        const products: Product[] = prodItems.map((p) => {
          const slug = p.categorySlug ?? '';
          const cat = catBySlug.get(slug);
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
            category: slug, // use slug for filtering
            categoryAr: cat?.nameAr ?? slug,
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
        console.error('Failed to fetch products/categories:', e);
        if (isMounted) {
          setLiveCategories([]);
          setLiveProducts([]);
        }
      }
    })();
    return () => {
      isMounted = false;
    };
  }, []);

  // Price range state
  const spMin = searchParams.get('minPrice');
  const spMax = searchParams.get('maxPrice');
  const urlMin = spMin !== null && spMin !== '' ? Number(spMin) : NaN;
  const urlMax = spMax !== null && spMax !== '' ? Number(spMax) : NaN;
  const [priceTouched, setPriceTouched] = useState<boolean>(
    (spMin !== null && spMin !== '') || (spMax !== null && spMax !== '')
  );
  const [priceRange, setPriceRange] = useState<number[]>([
    !isNaN(urlMin) ? urlMin : DEFAULT_MIN_PRICE,
    !isNaN(urlMax) ? urlMax : DEFAULT_MAX_PRICE
  ]);
  const handlePriceRangeChange = (values: number[]) => {
    setPriceTouched(true);
    setPriceRange(values);
    setFilters(prev => ({ ...prev, minPrice: values[0], maxPrice: values[1] }));
  };

  // Filter state
  const [filters, setFilters] = useState<ProductFilters>({
    search: searchParams.get('search') || '',
    category: searchParams.get('category') || '',
    minPrice: Number(searchParams.get('minPrice')) || 0,
    maxPrice: Number(searchParams.get('maxPrice')) || 10000,
    featured: searchParams.get('featured') === 'true',
    rating: Number(searchParams.get('rating')) || 0
  });

  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'newest');

  // Simulate loading
  useEffect(() => {
    setLoading(true);
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, [filters, sortBy]);

  // Update URL params when filters change (defined after dynamic bounds)
  // Moved below dynamicMinPrice/dynamicMaxPrice

  // Products filtered by everything EXCEPT price (for dynamic min/max)
  const baseFilteredProducts = useMemo(() => {
    let filtered = [...liveProducts];

    // Apply filters
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(product =>
        product.nameAr.toLowerCase().includes(searchTerm) ||
        product.name.toLowerCase().includes(searchTerm) ||
        product.descriptionAr.toLowerCase().includes(searchTerm) ||
        product.categoryAr.toLowerCase().includes(searchTerm)
      );
    }

    if (filters.category) {
      // filter by category slug (we store slug in product.category)
      filtered = filtered.filter(product => product.category === filters.category);
    }

    // Exclude hidden products from storefront
    filtered = filtered.filter(product => product.isHidden !== true);

    // Note: do not apply price filter here

    if (filters.featured) {
      filtered = filtered.filter(product => product.featured);
    }

    if (filters.rating > 0) {
      filtered = filtered.filter(product => product.rating >= filters.rating);
    }
    return filtered;
  }, [liveProducts, filters.search, filters.category, filters.featured, filters.rating]);

  // Dynamic min/max price from allowed (base) products
  const { dynamicMinPrice, dynamicMaxPrice } = useMemo(() => {
    if (baseFilteredProducts.length === 0) {
      return { dynamicMinPrice: DEFAULT_MIN_PRICE, dynamicMaxPrice: DEFAULT_MAX_PRICE };
    }
    const prices = baseFilteredProducts.map(p => p.price);
    return {
      dynamicMinPrice: Math.min(...prices),
      dynamicMaxPrice: Math.max(...prices)
    };
  }, [baseFilteredProducts]);

  // Adaptive slider step based on current range
  const priceStep = useMemo(() => {
    const range = Math.max(1, dynamicMaxPrice - dynamicMinPrice);
    // Aim for ~100 steps, rounded to nearest 5
    const raw = Math.ceil(range / 100);
    const step = Math.max(1, raw);
    // snap to 5/10 when larger
    if (step >= 50) return 50;
    if (step >= 20) return 20;
    if (step >= 10) return 10;
    if (step >= 5) return 5;
    return step;
  }, [dynamicMinPrice, dynamicMaxPrice]);

  // Keep priceRange within dynamic bounds, unless the user already set it
  useEffect(() => {
    // If not touched, initialize to full dynamic range
    if (!priceTouched) {
      const next = [dynamicMinPrice, dynamicMaxPrice] as [number, number];
      setPriceRange(next);
      setFilters(prev => ({ ...prev, minPrice: next[0], maxPrice: next[1] }));
      return;
    }
    // Clamp user selection to new bounds
    setPriceRange(prev => {
      const clamped: [number, number] = [
        Math.max(dynamicMinPrice, prev[0]),
        Math.min(dynamicMaxPrice, prev[1])
      ];
      // Ensure min <= max
      const fixed: [number, number] = [
        Math.min(clamped[0], clamped[1]),
        Math.max(clamped[0], clamped[1])
      ];
      setFilters(prevFilters => ({ ...prevFilters, minPrice: fixed[0], maxPrice: fixed[1] }));
      return fixed;
    });
  }, [dynamicMinPrice, dynamicMaxPrice, priceTouched]);

  // Update URL params when filters change (now that dynamic bounds are known)
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.search) params.set('search', filters.search);
    if (filters.category) params.set('category', filters.category);
    if (filters.minPrice > dynamicMinPrice) params.set('minPrice', filters.minPrice.toString());
    if (filters.maxPrice < dynamicMaxPrice) params.set('maxPrice', filters.maxPrice.toString());
    if (filters.featured) params.set('featured', 'true');
    if (filters.rating > 0) params.set('rating', filters.rating.toString());
    if (sortBy !== 'newest') params.set('sort', sortBy);
    if (page > 1) params.set('page', String(page));
    setSearchParams(params);
  }, [filters, sortBy, page, dynamicMinPrice, dynamicMaxPrice, setSearchParams]);

  // Apply price filtering and sorting for final list
  const filteredProducts = useMemo(() => {
    const withinPrice = baseFilteredProducts.filter(product =>
      product.price >= priceRange[0] && product.price <= priceRange[1]
    );

    // Apply sorting on a cloned array
    const sorted = [...withinPrice];
    switch (sortBy) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'name':
        sorted.sort((a, b) => a.nameAr.localeCompare(b.nameAr, 'ar'));
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'popularity':
        sorted.sort((a, b) => b.reviews - a.reviews);
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return sorted;
  }, [baseFilteredProducts, priceRange, sortBy]);

  // Reset page when filters/sort change
  useEffect(() => {
    setPage(1);
  }, [filters, sortBy]);

  const totalItems = filteredProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const currentPage = Math.min(page, totalPages);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, currentPage]);

  const handleSearchChange = (value: string) => {
    setFilters(prev => ({ ...prev, search: value }));
  };

  const handleCategoryFilter = (categoryId: string, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      category: checked ? categoryId : ''
    }));
  };

  // Handlers for typing min/max price
  const handleMinPriceInput = (val: string) => {
    const n = Number(val);
    if (Number.isNaN(n)) return;
    setPriceTouched(true);
    const clamped = Math.max(dynamicMinPrice, Math.min(n, priceRange[1]));
    setPriceRange([clamped, priceRange[1]]);
    setFilters(prev => ({ ...prev, minPrice: clamped }));
  };

  const handleMaxPriceInput = (val: string) => {
    const n = Number(val);
    if (Number.isNaN(n)) return;
    setPriceTouched(true);
    const clamped = Math.min(dynamicMaxPrice, Math.max(n, priceRange[0]));
    setPriceRange([priceRange[0], clamped]);
    setFilters(prev => ({ ...prev, maxPrice: clamped }));
  };

  const clearFilters = () => {
    setFilters({
      search: '',
      category: '',
      minPrice: dynamicMinPrice,
      maxPrice: dynamicMaxPrice,
      featured: false,
      rating: 0
    });
    setPriceTouched(false);
    setPriceRange([dynamicMinPrice, dynamicMaxPrice]);
    setSortBy('newest');
  };

  const activeFiltersCount = [
    filters.search,
    filters.category,
    filters.minPrice > dynamicMinPrice,
    filters.maxPrice < dynamicMaxPrice,
    filters.featured,
    filters.rating > 0
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5">
      {/* Hero Section - Clean Themed Design */}
      <section className="py-16 bg-gradient-to-br from-slate-900 to-slate-800 relative overflow-hidden">
        {/* Subtle background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-transparent"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center">
            <h1 className="text-4xl lg:text-5xl font-black text-white mb-4">
              جميع المنتجات
            </h1>
            <p className="text-lg text-white/80 max-w-2xl mx-auto leading-relaxed">
              اكتشف مجموعتنا الكاملة من المنتجات عالية الجودة
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4">

        {/* Search and Controls - 2 Lines Layout */}
        <section className="py-6 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40 overflow-visible">
          <div className="space-y-4">
            {/* Line 1: Search Bar */}
            <div className="mb-4">
              <div className="relative max-w-2xl mx-auto">
                <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 z-10" />
                <Input
                  placeholder="البحث في المنتجات..."
                  value={filters.search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="pr-12 rounded-full border-2 border-slate-300 focus:border-primary w-full"
                />
              </div>
            </div>

            {/* Line 2: All Controls */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {/* Sort */}
              <div className="flex items-center gap-2">
                <span className="text-slate-600 font-medium text-sm">ترتيب:</span>
                <Select value={sortBy} onValueChange={(value: 'newest' | 'price-low' | 'price-high' | 'name' | 'rating' | 'popularity') => setSortBy(value)}>
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.labelAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Filters Toggle */}
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
          </div>

          {/* Expanded Filters */}
          {isFilterOpen && (
            <div className="mt-6 p-6 bg-white rounded-2xl shadow-lg border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Category Filter */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">الفئة</label>
                  <Select
                    value={filters.category}
                    onValueChange={(value) => {
                      setFilters(prev => ({ ...prev, category: value === 'all' ? '' : value }))
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="جميع الفئات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الفئات</SelectItem>
                      {liveCategories.map((category) => (
                        <SelectItem key={category.id} value={category.slug}>
                          {category.nameAr}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Price Range */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">نطاق السعر</label>
                  <div className="space-y-2">
                    <Slider
                      value={priceRange}
                      onValueChange={handlePriceRangeChange}
                      max={dynamicMaxPrice}
                      min={dynamicMinPrice}
                      step={priceStep}
                      className="w-full"
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-slate-600 whitespace-nowrap">من</span>
                        <Input
                          type="number"
                          value={priceRange[0]}
                          min={dynamicMinPrice}
                          max={priceRange[1]}
                          step={priceStep}
                          onChange={(e) => handleMinPriceInput(e.target.value)}
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
                          max={dynamicMaxPrice}
                          step={priceStep}
                          onChange={(e) => handleMaxPriceInput(e.target.value)}
                          className="text-sm"
                        />
                        <span className="text-xs text-slate-500">ج.م</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Visibility is handled automatically: hidden products are excluded */}

                {/* Clear Filters */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={clearFilters}
                    className="w-full"
                  >
                    مسح الفلاتر
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Products Grid */}
        <section className="py-16">
          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : filteredProducts.length > 0 ? (
            <div className={`grid gap-8 ${
              viewMode === 'grid'
                ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1 max-w-4xl mx-auto'
            }`}>
              {paginatedProducts.map((product, index) => (
                <div
                  key={product.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <ProductCard product={product} />
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Package className="w-24 h-24 text-slate-300 mx-auto mb-6" />
              <h3 className="text-2xl font-bold text-slate-700 mb-4">لا توجد منتجات</h3>
              <p className="text-slate-500 mb-8">لم نجد أي منتجات تطابق معايير البحث</p>
              <Button onClick={clearFilters}>
                مسح جميع الفلاتر
              </Button>
            </div>
          )}
          {/* Pagination Controls */}
          {filteredProducts.length > 0 && (
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
        </section>
      </div>
    </div>
  );
};

export default Products;
