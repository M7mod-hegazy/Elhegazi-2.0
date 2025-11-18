import { Search, Filter, SortAsc, SortDesc, Grid, List } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import ScrollAnimation from '@/components/ui/scroll-animation';

interface ProductsFilterBarProps {
  // Search
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  searchPlaceholder?: string;
  
  // Sort
  sortBy: 'name' | 'price' | 'rating' | 'newest';
  setSortBy: (value: 'name' | 'price' | 'rating' | 'newest') => void;
  sortOrder: 'asc' | 'desc';
  setSortOrder: (value: 'asc' | 'desc') => void;
  
  // Filters
  showFilters: boolean;
  setShowFilters: (value: boolean) => void;
  
  // Price Range
  priceRange: [number, number];
  setPriceRange: (value: [number, number]) => void;
  setPriceTouched: (value: boolean) => void;
  dynMin: number;
  dynMax: number;
  
  // Rating Filter
  ratingFilter: 'all' | '4+' | '3+';
  setRatingFilter: (value: 'all' | '4+' | '3+') => void;
  
  // View Mode
  viewMode: 'grid' | 'list';
  setViewMode: (value: 'grid' | 'list') => void;
  
  // Results
  resultsCount: number;
  
  // Clear filters function
  onClearFilters: () => void;
}

const ProductsFilterBar = ({
  searchTerm,
  setSearchTerm,
  searchPlaceholder = "البحث في المنتجات...",
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  showFilters,
  setShowFilters,
  priceRange,
  setPriceRange,
  setPriceTouched,
  dynMin,
  dynMax,
  ratingFilter,
  setRatingFilter,
  viewMode,
  setViewMode,
  resultsCount,
  onClearFilters
}: ProductsFilterBarProps) => {
  return (
    <section className="py-8 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
      <div className="container mx-auto px-4">
        <div className="flex flex-col lg:flex-row gap-6 items-center">
          {/* Search */}
          <div className="flex-1 max-w-md relative">
            <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder={searchPlaceholder}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-12 rounded-full border-2 border-slate-300 focus:border-primary"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-slate-600 font-medium">ترتيب:</span>
            <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'rating' | 'newest') => setSortBy(value)}>
              <SelectTrigger className="w-40">
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
          <Badge variant="secondary" className="px-4 py-2">
            {resultsCount} منتج
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
                  onClick={onClearFilters}
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
  );
};

export default ProductsFilterBar;
