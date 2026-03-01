import { useState } from 'react';
import { Search, Filter, SortAsc, SortDesc, Grid, List, X, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters = ratingFilter !== 'all' || priceRange[0] !== dynMin || priceRange[1] !== dynMax;

  const ratingOptions = [
    { value: 'all', label: 'الكل', stars: 0 },
    { value: '4+', label: '4+', stars: 4 },
    { value: '3+', label: '3+', stars: 3 },
  ];

  const FilterContent = () => (
    <div className="space-y-6">
      {/* Price Range Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <label className="text-sm font-bold text-slate-800">نطاق السعر</label>
          <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
            {priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} ج.م
          </span>
        </div>

        {/* Custom Slider with gradient */}
        <div className="relative pt-2 pb-4">
          <div className="absolute inset-x-0 h-2 rounded-full bg-gradient-to-l from-primary/20 to-slate-200" />
          <Slider
            value={priceRange as unknown as number[]}
            onValueChange={(vals) => { setPriceTouched(true); setPriceRange(vals as [number, number]); }}
            min={dynMin}
            max={dynMax}
            step={Math.max(1, Math.ceil((dynMax - dynMin) / 100))}
            className="relative z-10"
          />
        </div>

        {/* Price Inputs */}
        <div className="grid grid-cols-2 gap-3">
          <div className="relative">
            <Input
              type="number"
              value={priceRange[0]}
              min={dynMin}
              max={priceRange[1]}
              onChange={(e) => {
                setPriceTouched(true);
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) setPriceRange([Math.max(dynMin, Math.min(n, priceRange[1])), priceRange[1]]);
              }}
              className="pl-10 text-sm h-10 rounded-xl border-slate-200 focus:border-primary"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">ج.م</span>
          </div>
          <div className="relative">
            <Input
              type="number"
              value={priceRange[1]}
              min={priceRange[0]}
              max={dynMax}
              onChange={(e) => {
                setPriceTouched(true);
                const n = Number(e.target.value);
                if (!Number.isNaN(n)) setPriceRange([priceRange[0], Math.min(dynMax, Math.max(n, priceRange[0]))]);
              }}
              className="pl-10 text-sm h-10 rounded-xl border-slate-200 focus:border-primary"
            />
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">ج.م</span>
          </div>
        </div>
      </div>

      {/* Rating Filter Section */}
      <div className="space-y-3">
        <label className="text-sm font-bold text-slate-800">التقييم</label>
        <div className="flex flex-wrap gap-2">
          {ratingOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setRatingFilter(option.value as 'all' | '4+' | '3+')}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                ratingFilter === option.value
                  ? "bg-primary text-white shadow-lg shadow-primary/25 scale-105"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              )}
            >
              {option.stars > 0 && (
                <div className="flex items-center">
                  {Array.from({ length: option.stars }).map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-current" />
                  ))}
                </div>
              )}
              <span>{option.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <Button
          variant="outline"
          onClick={onClearFilters}
          className="w-full rounded-xl h-11 border-2 border-dashed border-slate-300 text-slate-600 hover:border-destructive hover:text-destructive hover:bg-destructive/5 transition-all duration-300"
        >
          <X className="w-4 h-4 ml-2" />
          مسح الفلاتر
        </Button>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Filter Bar */}
      <section className="py-4 bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-16 z-40 shadow-sm">
        <div className="container mx-auto px-4">
          {/* Main Controls Row */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center">
            {/* Search - Full width on mobile */}
            <div className="flex-1 lg:max-w-md relative group">
              <Search className="absolute right-4 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5 transition-colors group-focus-within:text-primary" />
              <Input
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-12 h-12 rounded-2xl border-2 border-slate-200 focus:border-primary bg-slate-50/50 focus:bg-white transition-all duration-300"
              />
            </div>

            {/* Desktop Controls */}
            <div className="hidden lg:flex items-center gap-3">
              {/* Sort */}
              <div className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-1">
                <span className="text-slate-500 text-sm font-medium">ترتيب:</span>
                <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'rating' | 'newest') => setSortBy(value)}>
                  <SelectTrigger className="w-32 border-0 bg-transparent focus:ring-0 h-10">
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
                  variant="ghost"
                  size="sm"
                  onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                  className="h-8 w-8 p-0 rounded-lg hover:bg-white"
                >
                  {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
                </Button>
              </div>

              {/* Filters Toggle */}
              <Button
                variant={showFilters ? "default" : "outline"}
                onClick={() => setShowFilters(!showFilters)}
                className={cn(
                  "flex items-center gap-2 rounded-xl h-10 px-4 transition-all duration-300",
                  showFilters && "shadow-lg shadow-primary/25"
                )}
              >
                <Filter className="w-4 h-4" />
                <span>فلترة</span>
                {hasActiveFilters && (
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                )}
                {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>

              {/* View Mode */}
              <div className="flex bg-slate-100 rounded-xl p-1">
                <Button
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('grid')}
                  className="rounded-lg h-8 w-8 p-0"
                >
                  <Grid className="w-4 h-4" />
                </Button>
                <Button
                  variant={viewMode === 'list' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setViewMode('list')}
                  className="rounded-lg h-8 w-8 p-0"
                >
                  <List className="w-4 h-4" />
                </Button>
              </div>

              {/* Results Count */}
              <Badge variant="secondary" className="px-4 py-2 rounded-xl bg-gradient-to-l from-primary/10 to-primary/5 text-primary font-semibold">
                {resultsCount} منتج
              </Badge>
            </div>

            {/* Mobile Controls Row */}
            <div className="flex lg:hidden items-center gap-2">
              {/* Mobile Filter Button */}
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                onClick={() => setMobileFiltersOpen(true)}
                className="flex-1 rounded-xl h-11"
              >
                <Filter className="w-4 h-4 ml-2" />
                فلترة
                {hasActiveFilters && (
                  <Badge className="mr-2 bg-white text-primary h-5 px-1.5">!</Badge>
                )}
              </Button>

              {/* Mobile Sort */}
              <Select value={sortBy} onValueChange={(value: 'name' | 'price' | 'rating' | 'newest') => setSortBy(value)}>
                <SelectTrigger className="flex-1 rounded-xl h-11">
                  <SelectValue placeholder="ترتيب" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">الأحدث</SelectItem>
                  <SelectItem value="name">الاسم</SelectItem>
                  <SelectItem value="price">السعر</SelectItem>
                  <SelectItem value="rating">التقييم</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort Order */}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="rounded-xl h-11 w-11"
              >
                {sortOrder === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
              </Button>

              {/* Results Badge */}
              <Badge variant="secondary" className="px-3 py-2 rounded-xl shrink-0">
                {resultsCount}
              </Badge>
            </div>
          </div>

          {/* Desktop Expanded Filters */}
          {showFilters && (
            <div className="hidden lg:block mt-6 p-6 bg-gradient-to-bl from-slate-50 to-white rounded-2xl border border-slate-200 shadow-inner animate-in slide-in-from-top-2 duration-300">
              <div className="grid grid-cols-3 gap-8">
                {/* Price Range */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-bold text-slate-800">نطاق السعر</label>
                    <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded-full">
                      {priceRange[0].toLocaleString()} - {priceRange[1].toLocaleString()} ج.م
                    </span>
                  </div>
                  <Slider
                    value={priceRange as unknown as number[]}
                    onValueChange={(vals) => { setPriceTouched(true); setPriceRange(vals as [number, number]); }}
                    min={dynMin}
                    max={dynMax}
                    step={Math.max(1, Math.ceil((dynMax - dynMin) / 100))}
                    className="w-full"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="relative">
                      <Input
                        type="number"
                        value={priceRange[0]}
                        min={dynMin}
                        max={priceRange[1]}
                        onChange={(e) => {
                          setPriceTouched(true);
                          const n = Number(e.target.value);
                          if (!Number.isNaN(n)) setPriceRange([Math.max(dynMin, Math.min(n, priceRange[1])), priceRange[1]]);
                        }}
                        className="pl-10 text-sm rounded-xl"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">ج.م</span>
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        value={priceRange[1]}
                        min={priceRange[0]}
                        max={dynMax}
                        onChange={(e) => {
                          setPriceTouched(true);
                          const n = Number(e.target.value);
                          if (!Number.isNaN(n)) setPriceRange([priceRange[0], Math.min(dynMax, Math.max(n, priceRange[0]))]);
                        }}
                        className="pl-10 text-sm rounded-xl"
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">ج.م</span>
                    </div>
                  </div>
                </div>

                {/* Rating Filter */}
                <div className="space-y-4">
                  <label className="text-sm font-bold text-slate-800">التقييم</label>
                  <div className="flex flex-wrap gap-2">
                    {ratingOptions.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setRatingFilter(option.value as 'all' | '4+' | '3+')}
                        className={cn(
                          "flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
                          ratingFilter === option.value
                            ? "bg-primary text-white shadow-lg shadow-primary/25"
                            : "bg-white border border-slate-200 text-slate-600 hover:border-primary hover:text-primary"
                        )}
                      >
                        {option.stars > 0 && (
                          <div className="flex items-center">
                            {Array.from({ length: option.stars }).map((_, i) => (
                              <Star key={i} className="w-3.5 h-3.5 fill-current" />
                            ))}
                          </div>
                        )}
                        <span>{option.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Clear Filters */}
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={onClearFilters}
                    disabled={!hasActiveFilters}
                    className="w-full rounded-xl h-12 border-2 border-dashed transition-all duration-300 disabled:opacity-40"
                  >
                    <X className="w-4 h-4 ml-2" />
                    مسح الفلاتر
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Mobile Filter Bottom Sheet */}
      {mobileFiltersOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={() => setMobileFiltersOpen(false)}
          />

          {/* Bottom Sheet */}
          <div className="absolute bottom-0 left-0 right-0 bg-white rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300 max-h-[85vh] overflow-hidden">
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1.5 rounded-full bg-slate-300" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-slate-100">
              <h3 className="text-lg font-bold text-slate-900">فلترة المنتجات</h3>
              <button
                onClick={() => setMobileFiltersOpen(false)}
                className="p-2 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[calc(85vh-120px)]">
              <FilterContent />
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-white">
              <Button
                onClick={() => setMobileFiltersOpen(false)}
                className="w-full h-12 rounded-xl text-base font-semibold"
              >
                عرض النتائج ({resultsCount} منتج)
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductsFilterBar;
