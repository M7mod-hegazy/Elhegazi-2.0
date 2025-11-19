import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Search, Grid, List, ArrowRight, Package, X, TrendingUp, Folder, Tag, FileText, MoreHorizontal } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import ScrollAnimation from '@/components/ui/scroll-animation';
import { apiGet } from '@/lib/api';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import { usePageTitle } from '@/hooks/usePageTitle';
import type { Category } from '@/types';

const Categories = () => {
  // Set page title
  usePageTitle('الفئات');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const [animatedCounts, setAnimatedCounts] = useState<{[key: string]: number}>({});
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;
  const searchRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Animate counter from 0 to target number
  const animateCounter = (categoryId: string, target: number) => {
    if (animatedCounts[categoryId] === target) return; // Already animated
    
    let start = 0;
    const duration = 800;
    const increment = target / (duration / 16);
    
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        start = target;
        clearInterval(timer);
      }
      setAnimatedCounts(prev => ({ ...prev, [categoryId]: Math.floor(start) }));
    }, 16);
  };

  // Get preview products for a category
  // Helper function to generate consistent category URLs
  const getCategoryUrl = (category: Category): string => {
    // Priority: slug > id > generated from nameAr > fallback
    if (category.slug && category.slug.trim()) {
      return `/category/${category.slug}`;
    }
    if (category.id) {
      return `/category/${category.id}`;
    }
    if (category.nameAr) {
      const generatedSlug = category.nameAr
        .toLowerCase()
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '');
      return `/category/${generatedSlug}`;
    }
    return `/category/category-${Date.now()}`;
  };

  const getCategoryPreviewProducts = (category: Category): Product[] => {
    if (!products.length) return [];
    
    // Get products from this category only - be more specific with filtering
    const categoryProducts = products.filter(product => {
      const matchesId = product.categoryId === category.id;
      const matchesSlug = product.categorySlug === category.slug;
      const matchesCategory = product.category === category.id;
      
      return matchesId || matchesSlug || matchesCategory;
    });
    
    
    if (category.useRandomPreview === false && category.previewProducts?.length) {
      // Use manually selected products - but ensure they're from this category
      const selectedProducts = category.previewProducts
        .map(productId => products.find(p => p._id === productId))
        .filter(product => {
          if (!product) return false;
          // Double-check that selected products are from this category
          return product.categoryId === category.id || 
                 product.categorySlug === category.slug || 
                 product.category === category.id;
        })
        .slice(0, 4);
      
      return selectedProducts;
    } else {
      // Use random products from category only
      const shuffled = [...categoryProducts].sort(() => 0.5 - Math.random());
      const randomProducts = shuffled.slice(0, 4);
      return randomProducts;
    }
  };

  useEffect(() => {
    let mounted = true;
    const fetchCategories = async () => {
      try {
        setLoading(true);
        const [categoriesResp, productsResp] = await Promise.all([
          apiGet<Category>(`/api/categories?limit=100`),
          apiGet<any>(`/api/products?limit=200&fields=_id,name,nameAr,image,category,categoryId,categorySlug`)
        ]);
        
        let categoryItems: any[] = [];
        
        if (categoriesResp.ok) {
          categoryItems = (categoriesResp.items || []) as any[];
          if (mounted) setCategories(categoryItems as Category[]);
        } else {
          const errMsg = ('error' in categoriesResp ? categoriesResp.error : undefined) || 'Failed to load categories';
          if (mounted) setError(errMsg);
        }
        
        if (productsResp.ok) {
          const productItems = (productsResp.items || []) as any[];
          if (mounted) {
            setProducts(productItems);
            
            // Update category product counts manually if they're showing 0
            if (categoryItems.length > 0) {
              const updatedCategories = categoryItems.map((category: any) => {
                const categoryProductCount = productItems.filter((product: any) => 
                  product.categoryId === category._id || 
                  product.categorySlug === category.slug || 
                  product.category === category._id
                ).length;
                
                
                return {
                  ...category,
                  id: category._id,
                  productCount: categoryProductCount > 0 ? categoryProductCount : category.productCount
                };
              });
              
              setCategories(updatedCategories as Category[]);
            }
          }
        }
      } catch (err) {
        if (mounted) setError((err as Error).message);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    // initial load
    fetchCategories();

    // refresh on focus/visibility
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCategories();
    };
    window.addEventListener('focus', fetchCategories);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      mounted = false;
      window.removeEventListener('focus', fetchCategories);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  const filteredCategories = categories.filter(category =>
    category.nameAr.toLowerCase().includes(searchTerm.toLowerCase()) ||
    category.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredCategories.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedCategories = filteredCategories.slice(startIndex, startIndex + itemsPerPage);
  
  const searchSuggestions = searchTerm.length > 0 ? filteredCategories.slice(0, 5) : [];

  // Reset to first page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current && 
        !searchRef.current.contains(event.target as Node) &&
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
        setSearchFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchTerm(value);
    setShowSuggestions(value.length > 0 && searchFocused);
  };

  const handleSearchFocus = () => {
    setSearchFocused(true);
    setShowSuggestions(searchTerm.length > 0);
  };

  const selectSuggestion = (category: Category) => {
    setSearchTerm(category.nameAr);
    setShowSuggestions(false);
    setSearchFocused(false);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile-Optimized Hero Section */}
      <section className="bg-white border-b border-slate-200">
        <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8">
          <ScrollAnimation animation="slideUp" delay={0}>
            <div className="flex flex-col sm:flex-row lg:items-center lg:justify-between gap-3 sm:gap-4 lg:gap-6">
              {/* Left Side - Title & Description */}
              <div className="flex-1 text-center sm:text-right">
                <ScrollAnimation animation="slideRight" delay={100}>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:gap-4 mb-2">
                    <h1 className="text-lg sm:text-xl lg:text-4xl font-bold text-slate-900 tracking-tight">
                      جميع الفئات
                    </h1>
                    <div className="w-8 sm:w-12 h-0.5 bg-primary rounded-full mx-auto sm:mx-0 my-1 sm:my-0" />
                  </div>
                  <p className="text-xs sm:text-sm lg:text-base text-slate-600 leading-relaxed px-2 sm:px-0">
                    استكشف مجموعتنا الكاملة من الفئات المتنوعة
                  </p>
                </ScrollAnimation>
              </div>

              {/* Right Side - Compact Mobile Stats */}
              <div className="flex gap-3 sm:gap-4 lg:gap-6 justify-center sm:justify-end flex-shrink-0">
                <ScrollAnimation animation="scaleIn" delay={200}>
                  <div className="text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900">{categories.length}</div>
                    <div className="text-xs text-slate-600">فئة</div>
                  </div>
                </ScrollAnimation>
                
                <ScrollAnimation animation="scaleIn" delay={300}>
                  <div className="text-center">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-1 sm:mb-2">
                      <Package className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                    </div>
                    <div className="text-lg sm:text-xl font-bold text-slate-900">
                      {categories.reduce((sum, cat) => sum + (cat.productCount || 0), 0)}
                    </div>
                    <div className="text-xs text-slate-600">منتج</div>
                  </div>
                </ScrollAnimation>
              </div>
            </div>
          </ScrollAnimation>
        </div>
      </section>

      {/* Mobile-Optimized Search and Controls */}
      <section className="py-3 sm:py-4 lg:py-6 bg-slate-50/50 border-b border-slate-200">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-6 items-center justify-between">
            {/* Mobile-Enhanced Search with Suggestions */}
            <ScrollAnimation animation="slideUp" delay={0} className="w-full sm:flex-1 lg:max-w-2xl relative z-[99999]">
              <div className="relative">
                <Search className="absolute right-3 sm:right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4 sm:w-5 sm:h-5 z-10" />
                <Input
                  ref={searchRef}
                  placeholder="البحث في الفئات..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={handleSearchFocus}
                  className="pr-10 sm:pr-12 py-2.5 sm:py-3 text-sm sm:text-base rounded-lg sm:rounded-xl border border-slate-300 focus:border-primary bg-white shadow-sm focus:shadow-md transition-all duration-200 hover:border-slate-400 w-full"
                />
                {searchTerm && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSearchTerm('');
                      setShowSuggestions(false);
                    }}
                    className="absolute left-1.5 sm:left-2 top-1/2 transform -translate-y-1/2 h-6 w-6 sm:h-7 sm:w-7 p-0 hover:bg-slate-100 rounded-lg"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                )}
              </div>

              {/* Search Suggestions */}
              {showSuggestions && searchSuggestions.length > 0 && (
                <Card 
                  ref={suggestionsRef}
                  className="absolute top-full left-0 right-0 mt-2 shadow-xl border-0 bg-white/95 backdrop-blur-sm animate-in slide-in-from-top-2 duration-200"
                  style={{ zIndex: 99999 }}
                >
                  <CardContent className="p-2">
                    {searchSuggestions.map((category, index) => (
                      <ScrollAnimation key={category.id} animation="slideUp" delay={index * 50}>
                        <button
                          onClick={() => selectSuggestion(category)}
                          className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-lg transition-colors duration-200 text-right"
                        >
                          <img
                            src={optimizeImage(category.image || '', { w: 64 })}
                            alt={category.nameAr}
                            className="w-12 h-12 object-cover rounded-lg flex-shrink-0"
                          />
                          <div className="flex-1 text-right">
                            <div className="font-medium text-slate-900">{category.nameAr}</div>
                            <div className="text-sm text-slate-500">{category.productCount} منتج</div>
                          </div>
                          <ArrowRight className="w-4 h-4 text-slate-400 rtl-flip" />
                        </button>
                      </ScrollAnimation>
                    ))}
                  </CardContent>
                </Card>
              )}
            </ScrollAnimation>

            {/* Mobile-Optimized Controls */}
            <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto justify-between sm:justify-end flex-shrink-0">
              {/* View Mode Toggle - Mobile Optimized */}
              <ScrollAnimation animation="scaleIn" delay={100}>
                <div className="flex bg-slate-100 rounded-lg sm:rounded-xl p-0.5 sm:p-1 shadow-sm">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-md sm:rounded-lg w-8 h-8 sm:w-10 sm:h-10 p-0 transition-all duration-200"
                    title="عرض شبكة"
                  >
                    <Grid className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-md sm:rounded-lg w-8 h-8 sm:w-10 sm:h-10 p-0 transition-all duration-200"
                    title="عرض قائمة"
                  >
                    <List className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </Button>
                </div>
              </ScrollAnimation>

              {/* Results Count - Mobile Optimized */}
              <ScrollAnimation animation="slideLeft" delay={200}>
                <Badge variant="secondary" className="text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl shadow-sm whitespace-nowrap">
                  {filteredCategories.length} فئة
                </Badge>
              </ScrollAnimation>
            </div>
          </div>
        </div>
      </section>

      {/* Loading / Error */}
      {loading && (
        <div className="py-12 text-center text-slate-600">جارِ التحميل...</div>
      )}
      {error && !loading && (
        <div className="py-12 text-center text-red-600">{error}</div>
      )}

      {/* Mobile-Optimized Categories Grid/List */}
      <section className="py-4 sm:py-6 lg:py-8 bg-slate-50">
        <div className="container mx-auto px-3 sm:px-4">
          {filteredCategories.length === 0 ? (
            <ScrollAnimation animation="fadeIn" className="text-center py-8 sm:py-12 lg:py-16">
              <div className="bg-white rounded-xl sm:rounded-2xl p-6 sm:p-8 lg:p-12 shadow-sm border border-slate-200 max-w-sm sm:max-w-md mx-auto">
                <Package className="w-12 h-12 sm:w-16 sm:h-16 text-slate-300 mx-auto mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-bold text-slate-700 mb-1 sm:mb-2">لا توجد فئات</h3>
                <p className="text-slate-500 text-xs sm:text-sm">لم نجد أي فئات تطابق بحثك</p>
              </div>
            </ScrollAnimation>
          ) : (
            <div className={`grid ${
              viewMode === 'grid' 
                ? 'grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 divide-y sm:divide-y-0 divide-slate-200' 
                : 'grid-cols-1 max-w-7xl mx-auto gap-3 sm:gap-4 lg:gap-6 divide-y divide-slate-200'
            }`}>
              {paginatedCategories.map((category, index) => (
                <ScrollAnimation
                  key={category.id}
                  animation={viewMode === 'grid' ? 'scaleIn' : 'slideUp'}
                  delay={index * 30}
                >
                  {viewMode === 'grid' ? (
                    // Mobile-Optimized Category Card
                    <Link
                      to={`/category/${category.slug || category.id || category.nameAr?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || 'category'}`}
                      className="group block bg-white rounded-2xl sm:rounded-3xl overflow-hidden shadow-md sm:shadow-lg hover:shadow-xl sm:hover:shadow-2xl transition-all duration-500 sm:duration-700 transform hover:-translate-y-1 sm:hover:-translate-y-3 border-2 sm:border border-slate-300 sm:border-slate-200/60 hover:border-primary/40 relative touch-manipulation hover:scale-[1.02] cursor-pointer  sm:py-0"
                    >
                      {/* Featured Badge */}
                      {category.featured && (
                        <div className="absolute top-6 right-6 z-30">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-medium shadow-xl animate-pulse px-3 py-1.5">
                            مميزة ⭐
                          </Badge>
                        </div>
                      )}

                      {/* Mobile: Vertical Layout | Desktop: Split Screen Layout */}
                      <div className="flex flex-col sm:flex-row h-auto sm:h-80">
                        {/* Left Side - Category Info (100% on mobile, 40% on desktop) */}
                        <div className="w-full sm:w-2/5 bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8 flex flex-col justify-between relative overflow-hidden">
                          {/* Category Image Background Overlay - 20% opacity behind text */}
                          {category.image && (
                            <div className="absolute inset-0 opacity-20 z-0">
                              <img
                                src={optimizeImage(category.image, { w: 600 })}
                                alt={category.nameAr}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/70" />
                            </div>
                          )}
                          
                          {/* Background Pattern */}
                          <div className="absolute inset-0 opacity-5 z-1">
                            <div className="w-full h-full" style={{
                              backgroundImage: `radial-gradient(circle at 20px 20px, currentColor 2px, transparent 0)`,
                              backgroundSize: '40px 40px'
                            }} />
                          </div>
                          
                          <div className="relative z-10">
                            {/* Mobile-Optimized Category Badge */}
                            <div className="mb-2 sm:mb-3 animate-slide-in-left" style={{ animationDelay: '100ms', animationDuration: '800ms', animationFillMode: 'both' }}>
                              <Badge className="bg-slate-900/90 text-white text-xs font-medium backdrop-blur-sm flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 shadow-lg w-fit">
                                <Tag className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                                فئة
                              </Badge>
                            </div>
                            
                            {/* Mobile-Optimized Category Name with Product Count */}
                            <div className="flex items-start sm:items-center gap-2 sm:gap-3 mb-2 sm:mb-3 animate-slide-in-left group-hover:translate-x-1 transition-transform duration-300" style={{ animationDelay: '300ms', animationDuration: '800ms', animationFillMode: 'both' }}>
                              <h3 className="text-base sm:text-lg lg:text-xl font-bold text-slate-900 group-hover:text-primary transition-all duration-300 leading-tight flex-1 min-w-0 group-hover:scale-105">
                                {category.nameAr}
                              </h3>
                              <div 
                                className="bg-primary/10 text-primary px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-semibold flex-shrink-0 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300"
                                ref={(el) => {
                                  if (el && animatedCounts[category.id] === undefined) {
                                    setTimeout(() => animateCounter(category.id, category.productCount), 600);
                                  }
                                }}
                              >
                                {animatedCounts[category.id] ?? 0}
                              </div>
                            </div>
                            <p className="text-slate-600 text-xs sm:text-sm mb-3 sm:mb-4 lg:mb-6 opacity-80 group-hover:opacity-100 group-hover:text-slate-700 transition-all duration-300">{category.name}</p>
                            
                            {/* Mobile-Optimized Category Description - Hidden on mobile, shown on desktop */}
                            {(category.descriptionAr || category.description) && (
                              <div className="hidden sm:block bg-white/60 rounded-lg sm:rounded-xl p-2 sm:p-3 animate-slide-in-left group-hover:bg-white/80 group-hover:shadow-md group-hover:scale-105 transition-all duration-300" style={{ animationDelay: '500ms', animationDuration: '800ms', animationFillMode: 'both' }}>
                                <div className="text-xs font-medium text-slate-700 mb-1 sm:mb-2 group-hover:text-primary transition-colors duration-300">الوصف</div>
                                <div className="text-xs sm:text-sm text-slate-600 line-clamp-2 leading-relaxed group-hover:text-slate-800 transition-colors duration-300">
                                  {category.descriptionAr || category.description}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Enhanced Action Button with Invitation - Responsive sizing */}
                          <div className="relative z-10 animate-slide-in-left group-hover:translate-x-2 transition-transform duration-300" style={{ animationDelay: '700ms', animationDuration: '800ms', animationFillMode: 'both' }}>
                            <div className="bg-gradient-to-r from-primary/10 to-primary/20 rounded-lg sm:rounded-xl p-2 sm:p-3 group-hover:from-primary group-hover:to-primary/80 group-hover:shadow-lg transition-all duration-300">
                              <div className="flex items-center gap-2 sm:gap-3 text-primary group-hover:text-white font-bold group-hover:gap-4 transition-all duration-300">
                                <span className="text-sm sm:text-lg group-hover:scale-110 transition-transform duration-300">استكشف الآن</span>
                                <ArrowRight className="w-4 h-4 sm:w-6 sm:h-6 rtl-flip transform group-hover:scale-125 group-hover:translate-x-2 group-hover:rotate-12 transition-all duration-300" />
                              </div>
                              <div className="hidden sm:block text-xs text-slate-600 group-hover:text-white/90 mt-1 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-2 group-hover:translate-y-0">
                                اكتشف {category.productCount} منتج مميز
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Side - Product Mosaic (100% on mobile, 60% on desktop) */}
                        <div className="w-full sm:w-3/5 relative overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100 min-h-48 sm:min-h-auto">
                          
                          {/* Flexible Product Grid - Responsive Padding */}
                          <div className="h-full p-2 sm:p-3 relative z-10">
                            {(() => {
                              const previewProducts = getCategoryPreviewProducts(category);
                              const totalProducts = category.productCount || 0;
                              const selectedProducts = previewProducts.length;
                              
                              // Show "+X more" only if there are more products than what we can show
                              const maxVisibleProducts = 3; // We show max 3 products, 4th slot for "+X more"
                              const showMoreIndicator = totalProducts > maxVisibleProducts;
                              const moreCount = Math.max(0, totalProducts - maxVisibleProducts);
                              
                              
                              // If we have selected products, show them first, then "+X more" if needed
                              const visibleProducts = Math.min(selectedProducts, maxVisibleProducts);
                              
                              const colors = [
                                'from-primary/20 to-primary/40',
                                'from-emerald-100 to-emerald-300',
                                'from-purple-100 to-purple-300',
                                'from-rose-100 to-rose-300'
                              ];
                              
                              // Dynamic grid based on available products
                              const hasProducts = selectedProducts > 0;
                              
                              // SIMPLIFIED LOGIC: Show "+X more" if there are more products in category than selected
                              const categoryProductsCount = products.filter(p => 
                                p.categoryId === category.id || 
                                p.categorySlug === category.slug || 
                                p.category === category.id
                              ).length;
                              
                              const shouldShowMoreSlot = categoryProductsCount > selectedProducts && selectedProducts > 0;
                              const actualSlotsNeeded = selectedProducts + (shouldShowMoreSlot ? 1 : 0);
                              const remainingCount = categoryProductsCount - selectedProducts;
                              
                              // Special case: if exactly 2 products selected and more available, show full-width "+X more"
                              const showFullWidthMore = selectedProducts === 2 && categoryProductsCount > 2;
                              
                              const gridClass = actualSlotsNeeded <= 2 ? 'grid-cols-2' : 'grid-cols-2';
                              
                              return (
                                <div className="h-full relative">
                                  {/* Dynamic Floating Network Background */}
                                  <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{zIndex: 0}}>
                                    {/* Floating Animated Dots with Random Movement */}
                                    <div className="absolute w-3 h-3 bg-primary/25 rounded-full animate-bounce" 
                                         style={{
                                           top: '20%', 
                                           left: '10%',
                                           animationDuration: '3s',
                                           animationDelay: '0s'
                                         }}>
                                    </div>
                                    <div className="absolute w-2 h-2 bg-primary/30 rounded-full animate-pulse" 
                                         style={{
                                           top: '30%', 
                                           left: '80%',
                                           animationDuration: '2s',
                                           animationDelay: '1s'
                                         }}>
                                    </div>
                                    <div className="absolute w-4 h-4 bg-primary/20 rounded-full animate-ping" 
                                         style={{
                                           top: '70%', 
                                           left: '20%',
                                           animationDuration: '4s',
                                           animationDelay: '2s'
                                         }}>
                                    </div>
                                    <div className="absolute w-2.5 h-2.5 bg-primary/35 rounded-full animate-bounce" 
                                         style={{
                                           top: '80%', 
                                           left: '70%',
                                           animationDuration: '2.5s',
                                           animationDelay: '0.5s'
                                         }}>
                                    </div>
                                    <div className="absolute w-1.5 h-1.5 bg-primary/15 rounded-full animate-pulse" 
                                         style={{
                                           top: '45%', 
                                           left: '50%',
                                           animationDuration: '3.5s',
                                           animationDelay: '1.5s'
                                         }}>
                                    </div>
                                    <div className="absolute w-1 h-1 bg-primary/40 rounded-full animate-ping" 
                                         style={{
                                           top: '60%', 
                                           left: '90%',
                                           animationDuration: '2.8s',
                                           animationDelay: '3s'
                                         }}>
                                    </div>
                                    <div className="absolute w-2 h-2 bg-primary/18 rounded-full animate-bounce" 
                                         style={{
                                           top: '15%', 
                                           left: '60%',
                                           animationDuration: '3.2s',
                                           animationDelay: '2.5s'
                                         }}>
                                    </div>
                                    <div className="absolute w-1.5 h-1.5 bg-primary/22 rounded-full animate-pulse" 
                                         style={{
                                           top: '35%', 
                                           left: '25%',
                                           animationDuration: '2.3s',
                                           animationDelay: '4s'
                                         }}>
                                    </div>
                                    
                                  </div>
                                  
                                  {/* Show selected products */}
                                  <div className={`grid ${gridClass} ${showFullWidthMore ? 'h-3/4' : 'h-full'} gap-2 relative`} style={{zIndex: 1}}>
                                  {Array.from({ length: showFullWidthMore ? selectedProducts : actualSlotsNeeded }, (_, index) => {
                                    const isLastSlot = index === actualSlotsNeeded - 1;
                                    const shouldShowMore = shouldShowMoreSlot && isLastSlot && !showFullWidthMore;
                                    const product = shouldShowMore ? null : previewProducts[index];
                                    const animationDelay = index * 200; // Stagger timing
                                    
                                    // Different slide directions for treasure box effect
                                    const slideDirections = [
                                      'animate-slide-in-left',    // Top-left slides from left
                                      'animate-slide-in-right',   // Top-right slides from right  
                                      'animate-slide-in-bottom',  // Bottom-left slides from bottom
                                      'animate-slide-in-top'      // Bottom-right slides from top
                                    ];
                                    
                                    const slideDirection = slideDirections[index % slideDirections.length];
                                    
                                    return (
                                      <div 
                                        key={`${category.id}-${index}`} 
                                        className={`relative overflow-hidden group/item bg-gradient-to-br from-blue-50 via-purple-50 to-pink-50 rounded-lg shadow-sm ${slideDirection} group-hover:scale-95 group-hover:brightness-75 transition-all duration-300`}
                                        style={{ 
                                          animationDelay: `${animationDelay}ms`,
                                          animationDuration: '800ms',
                                          animationFillMode: 'both'
                                        }}
                                        title={shouldShowMore ? `انقر لرؤية جميع المنتجات الـ ${categoryProductsCount}` : undefined}
                                      >
                                        
                                        {shouldShowMore ? (
                                          // Facebook-style "+X more" overlay
                                          <div className="w-full h-full bg-gradient-to-br from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                                            <div className="text-center text-white">
                                              <MoreHorizontal className="w-8 h-8 mx-auto mb-2 opacity-80" />
                                              <div className="text-lg font-bold">+{remainingCount}</div>
                                              <div className="text-xs opacity-80">المزيد</div>
                                            </div>
                                          </div>
                                        ) : product && product.image ? (
                                          // Show actual product image with name above
                                          <div className="w-full h-full relative flex flex-col">
                                            {/* Product Name Above Image - Themed */}
                                            <div className="px-2 py-1 bg-primary/90 backdrop-blur-sm flex-shrink-0 mx-2 mt-2 rounded-lg">
                                              <div className="text-xs font-medium text-white truncate text-center animate-pulse">
                                                <span className="inline-block animate-bounce" style={{animationDelay: `${index * 100}ms`}}>
                                                  {product.nameAr || product.name}
                                                </span>
                                              </div>
                                            </div>
                                            {/* Product Image - Optimized for space with hover effects */}
                                            <div className="flex-1 min-h-0 flex items-center justify-center p-1 group-hover:scale-110 transition-transform duration-500">
                                              <img
                                                src={optimizeImage(product.image, { w: 300 })}
                                                alt={product.nameAr || product.name}
                                                className="max-w-full max-h-full object-contain group-hover:brightness-110 group-hover:contrast-110 transition-all duration-300"
                                                loading="lazy"
                                              />
                                            </div>
                                          </div>
                                        ) : (
                                          // Fallback placeholder
                                          <div className={`w-full h-full bg-gradient-to-br ${colors[index % colors.length]} flex items-center justify-center rounded-lg`}>
                                            <div className="text-center">
                                              <Package className="w-10 h-10 text-slate-600 mx-auto mb-2 opacity-60" />
                                              <div className="text-xs text-slate-700 font-medium">منتج {index + 1}</div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  </div>
                                  
                                  {/* Full-width "+X more" overlay when exactly 2 products selected */}
                                  {showFullWidthMore && (
                                    <div className="h-1/4 mt-4 px-4">
                                      <div 
                                        className="w-full h-full bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-xl backdrop-blur-sm animate-slide-in-bottom mx-2 my-2"
                                        style={{ 
                                          animationDelay: '400ms',
                                          animationDuration: '800ms',
                                          animationFillMode: 'both'
                                        }}
                                        title={`انقر لرؤية جميع المنتجات الـ ${categoryProductsCount}`}
                                      >
                                        <div className="flex items-center gap-3 text-white">
                                          <MoreHorizontal className="w-8 h-8 opacity-90" />
                                          <div className="text-xl font-bold">+{remainingCount}</div>
                                          <div className="text-sm opacity-90 font-medium">المزيد</div>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>

                          {/* Hover Overlay with Blur Effect and Explore Button */}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-500 bg-black/40 backdrop-blur-md z-20">
                            <div className="text-center text-white transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500">
                              <div className="bg-white/20 backdrop-blur-sm rounded-2xl px-6 py-4 border border-white/30">
                                <div className="text-xl font-bold mb-2">استكشف المنتجات</div>
                                <div className="text-sm opacity-90 mb-4">اكتشف مجموعة {category.nameAr}</div>
                                <div className="flex items-center justify-center gap-2 text-white font-semibold">
                                  <span>استكشف الآن</span>
                                  <ArrowRight className="w-5 h-5 rtl-flip" />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                    </Link>
                  ) : (
                    // Simplified List Card with Product Preview
                    <Link
                      to={`/category/${category.slug || category.id || category.nameAr?.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]+/g, '') || 'category'}`}
                      className="group block bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-300 border border-slate-200/60 hover:border-primary/30 relative hover:scale-[1.01] hover:-translate-y-1 cursor-pointer"
                    >
                      {/* Featured Badge */}
                      {category.featured && (
                        <div className="absolute top-3 right-3 z-10">
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-medium shadow-lg">
                            مميزة ⭐
                          </Badge>
                        </div>
                      )}

                      <div className="flex items-stretch">
                        {/* Left Side - Category Info */}
                        <div className="flex-1 p-4 flex flex-col justify-between">
                          {/* Category Name and Counter */}
                          <div className="mb-3 group-hover:translate-x-2 transition-transform duration-300">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-lg font-bold text-slate-900 group-hover:text-primary group-hover:scale-105 transition-all duration-300">
                                {category.nameAr}
                              </h3>
                              <Badge className="bg-primary/10 text-primary text-sm font-bold px-2 py-1 group-hover:bg-primary group-hover:text-white group-hover:scale-110 transition-all duration-300">
                                {category.productCount} منتج
                              </Badge>
                            </div>
                            <p className="text-sm text-slate-500 group-hover:text-slate-700 group-hover:font-medium transition-all duration-300">{category.name}</p>
                            
                            {/* Description Space */}
                            {(category.descriptionAr || category.description) && (
                              <p className="text-xs text-slate-600 mt-2 line-clamp-2 group-hover:text-slate-800 group-hover:scale-105 transition-all duration-300">
                                {category.descriptionAr || category.description}
                              </p>
                            )}
                          </div>

                          {/* Enhanced Action Button */}
                          <div className="bg-gradient-to-r from-primary/5 to-primary/10 rounded-lg p-2 group-hover:from-primary group-hover:to-primary/80 group-hover:shadow-md transition-all duration-300">
                            <div className="flex items-center gap-2 text-primary group-hover:text-white font-medium group-hover:gap-3 transition-all duration-300">
                              <span className="text-sm group-hover:font-bold transition-all duration-300">استكشف الآن</span>
                              <ArrowRight className="w-4 h-4 rtl-flip transform group-hover:scale-110 group-hover:translate-x-1 group-hover:rotate-12 transition-all duration-300" />
                            </div>
                            <div className="text-xs text-slate-500 group-hover:text-white/90 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-y-1 group-hover:translate-y-0 mt-1">
                              اكتشف المنتجات المميزة
                            </div>
                          </div>
                        </div>

                        {/* Right Side - Product Preview Grid */}
                        <div className="w-48 bg-gradient-to-br from-slate-50 to-slate-100 p-3 relative">
                          {(() => {
                            const previewProducts = getCategoryPreviewProducts(category);
                            const totalProducts = category.productCount || 0;
                            const selectedProducts = previewProducts.length;
                            const maxVisibleProducts = 3;
                            const showMoreIndicator = totalProducts > maxVisibleProducts;
                            const moreCount = Math.max(0, totalProducts - maxVisibleProducts);
                            const visibleProducts = Math.min(selectedProducts, maxVisibleProducts);
                            const shouldShowMoreSlot = totalProducts > selectedProducts && selectedProducts > 0;
                            const remainingCount = totalProducts - selectedProducts;
                            const showFullWidthMore = selectedProducts === 2 && totalProducts > 2;

                            return (
                              <div className="h-full relative">
                                <div className={`grid gap-1 h-full ${
                                  visibleProducts <= 2 ? 'grid-cols-2 grid-rows-2' : 'grid-cols-2 grid-rows-2'
                                }`}>
                                  {/* Display visible products */}
                                  {previewProducts.slice(0, maxVisibleProducts).map((product, idx) => (
                                    <div key={product._id} className="relative overflow-hidden rounded-lg bg-white shadow-sm">
                                      <img
                                        src={optimizeImage(product.image || '', { w: 100 })}
                                        alt={product.nameAr || product.name}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                  ))}

                                  {/* Show +X more if needed */}
                                  {shouldShowMoreSlot && !showFullWidthMore && (
                                    <div className="bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                                      <div className="text-center text-white">
                                        <div className="text-sm font-bold">+{remainingCount}</div>
                                        <div className="text-xs opacity-90">المزيد</div>
                                      </div>
                                    </div>
                                  )}
                                </div>

                                {/* Full-width +X more for 2 products */}
                                {showFullWidthMore && (
                                  <div className="absolute bottom-0 left-0 right-0 h-8">
                                    <div className="w-full h-full bg-gradient-to-r from-slate-800/90 to-slate-900/90 flex items-center justify-center rounded-lg backdrop-blur-sm">
                                      <div className="flex items-center gap-2 text-white">
                                        <MoreHorizontal className="w-4 h-4 opacity-90" />
                                        <div className="text-sm font-bold">+{remainingCount}</div>
                                        <div className="text-xs opacity-90">المزيد</div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </Link>
                  )}
                </ScrollAnimation>
              ))}
            </div>
          )}

          {/* Pagination Controls */}
          {filteredCategories.length > itemsPerPage && (
            <ScrollAnimation animation="slideUp" delay={100} className="mt-12">
              <div className="flex items-center justify-center gap-4">
                <Button 
                  variant="outline" 
                  disabled={currentPage <= 1} 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="rounded-xl px-6 py-2 border-slate-300 hover:border-primary hover:text-primary transition-all duration-200"
                >
                  السابق
                </Button>
                
                <div className="flex items-center gap-2">
                  {/* Page Numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }
                    
                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "ghost"}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`w-10 h-10 rounded-xl transition-all duration-200 ${
                          currentPage === pageNum 
                            ? 'bg-primary text-white shadow-lg' 
                            : 'hover:bg-slate-100 text-slate-600'
                        }`}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>
                
                <Button 
                  variant="outline" 
                  disabled={currentPage >= totalPages} 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  className="rounded-xl px-6 py-2 border-slate-300 hover:border-primary hover:text-primary transition-all duration-200"
                >
                  التالي
                </Button>
              </div>
              
              {/* Page Info */}
              <div className="text-center mt-4">
                <span className="text-sm text-slate-500">
                  عرض {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredCategories.length)} من {filteredCategories.length} فئة
                </span>
              </div>
            </ScrollAnimation>
          )}
        </div>
      </section>
    </div>
  );
};

export default Categories;
