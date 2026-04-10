import React, { useState, useMemo, useCallback, useRef } from 'react';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Search,
  Package,
  Check,
  ChevronUp,
  ChevronDown,
  Layers,
  Sparkles,
  CheckCircle2,
  Circle,
  LayoutGrid,
  List,
  X,
  SlidersHorizontal,
  ArrowUpDown,
  GripVertical,
  Trash2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Product, Category } from '@/types';
import { applyProductImageFallback } from '@/lib/images';

interface SmartProductSelectorProps {
  products: Product[];
  categories: Category[];
  selectedProductIds: string[];
  onSelectionChange: (ids: string[]) => void;
}

type SortField = 'name' | 'price' | 'sku' | 'date';

const SmartProductSelector: React.FC<SmartProductSelectorProps> = ({
  products,
  categories,
  selectedProductIds,
  onSelectionChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortAsc, setSortAsc] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...products];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(p => 
        p.nameAr?.toLowerCase().includes(query) ||
        p.sku?.toLowerCase().includes(query)
      );
    }

    if (selectedCategory !== 'all') {
      result = result.filter(p => 
        String(p.category) === String(selectedCategory) ||
        String(p.categoryId) === String(selectedCategory) ||
        String(p.categorySlug) === String(selectedCategory)
      );
    }

    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'name':
          comparison = (a.nameAr || '').localeCompare(b.nameAr || '');
          break;
        case 'price':
          comparison = (a.price || 0) - (b.price || 0);
          break;
        case 'sku':
          comparison = (a.sku || '').localeCompare(b.sku || '');
          break;
        case 'date':
          comparison = new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime();
          break;
      }
      return sortAsc ? comparison : -comparison;
    });

    return result;
  }, [products, searchQuery, selectedCategory, sortField, sortAsc]);

  // Toggle single product selection
  const toggleProduct = useCallback((productId: string) => {
    const isSelected = selectedProductIds.includes(productId);
    if (isSelected) {
      onSelectionChange(selectedProductIds.filter(id => id !== productId));
    } else {
      onSelectionChange([...selectedProductIds, productId]);
    }
  }, [selectedProductIds, onSelectionChange]);

  // Quick actions
  const selectAll = useCallback(() => {
    onSelectionChange(filteredProducts.map(p => p.id));
  }, [filteredProducts, onSelectionChange]);

  const clearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  // Move item in order
  const moveItem = useCallback((productId: string, direction: 'up' | 'down') => {
    const currentIndex = selectedProductIds.indexOf(productId);
    if (currentIndex === -1) return;
    
    const newOrder = [...selectedProductIds];
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    
    if (newIndex >= 0 && newIndex < newOrder.length) {
      [newOrder[currentIndex], newOrder[newIndex]] = [newOrder[newIndex], newOrder[currentIndex]];
      onSelectionChange(newOrder);
    }
  }, [selectedProductIds, onSelectionChange]);

  const getCategoryCount = useCallback((categoryIdOrSlug: string) => {
    return products.filter(p => 
      String(p.category) === String(categoryIdOrSlug) ||
      String(p.categoryId) === String(categoryIdOrSlug) ||
      String(p.categorySlug) === String(categoryIdOrSlug)
    ).length;
  }, [products]);

  return (
    <Card className="bg-white border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <CardHeader className="bg-slate-50 border-b border-slate-200/80 py-4 px-5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3 text-lg font-bold text-slate-800">
            <div className="p-2 bg-gradient-to-br from-primary to-purple-600 rounded-lg shadow-sm">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <span>اختيار المنتجات</span>
              <p className="text-xs font-normal text-slate-500 mt-0.5">
                {filteredProducts.length} من {products.length} منتج
              </p>
            </div>
          </CardTitle>
          
          {/* View Toggle */}
          <div className="flex items-center gap-2">
            <div className="flex bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'p-1.5 rounded-md transition-all',
                  viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Search & Filters Row */}
        <div className="p-4 border-b border-slate-100 bg-white">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Search */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="ابحث بالاسم أو الكود..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-9 h-10 bg-white border-slate-200"
              />
            </div>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-[160px] h-10 bg-white border-slate-200">
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <SelectValue placeholder="الفئة" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  <span>جميع الفئات</span>
                  <Badge variant="secondary" className="mr-2 text-xs">{products.length}</Badge>
                </SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.slug || cat.id || cat.name}>
                    <span>{cat.nameAr}</span>
                    <Badge variant="outline" className="mr-2 text-xs">
                      {getCategoryCount(cat.id || cat.slug || cat.name)}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Sort */}
            <Select value={sortField} onValueChange={(v) => setSortField(v as SortField)}>
              <SelectTrigger className="w-[130px] h-10 bg-white border-slate-200">
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-4 h-4 text-slate-500" />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">الاسم</SelectItem>
                <SelectItem value="price">السعر</SelectItem>
                <SelectItem value="sku">الكود</SelectItem>
                <SelectItem value="date">التاريخ</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Direction */}
            <button
              onClick={() => setSortAsc(!sortAsc)}
              className="h-10 px-3 bg-white border border-slate-200 rounded-md flex items-center gap-2 hover:bg-slate-50 transition-colors"
            >
              {sortAsc ? (
                <ChevronUp className="w-4 h-4 text-slate-600" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-600" />
              )}
            </button>
          </div>
        </div>

        {/* Selection Bar */}
        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {selectedProductIds.length > 0 ? (
              <div className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-sm font-medium">
                <CheckCircle2 className="w-4 h-4" />
                <span>{selectedProductIds.length} محدد</span>
              </div>
            ) : (
              <span className="text-sm text-slate-500">لم يتم تحديد منتجات</span>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={selectAll}
              className="h-8 text-xs text-primary hover:text-primary hover:bg-primary/10"
            >
              تحديد الكل
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={selectedProductIds.length === 0}
              className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              مسح التحديد
            </Button>
          </div>
        </div>

        {/* Reorder Panel - Shows when products are selected */}
        {selectedProductIds.length > 1 && (
          <div className="px-4 py-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-blue-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <GripVertical className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">ترتيب المنتجات</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="h-6 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                مسح
              </Button>
            </div>
            <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide">
              {selectedProductIds.map((id, idx) => {
                const product = products.find(p => p.id === id);
                if (!product) return null;
                return (
                  <div
                    key={`${id}-${idx}`}
                    className="flex-shrink-0 flex items-center gap-1 bg-white border border-blue-200 rounded-full px-2 py-1 shadow-sm"
                  >
                    <span className="text-xs font-bold text-blue-600 w-4">{idx + 1}</span>
                    <div className="w-4 h-4 rounded-full bg-slate-100 overflow-hidden">
                      {product.image ? (
                        <img src={product.image} alt="" className="w-full h-full object-cover" onError={applyProductImageFallback} />
                      ) : (
                        <Package className="w-3 h-3 text-slate-400" />
                      )}
                    </div>
                    <button
                      onClick={() => moveItem(id, 'up')}
                      disabled={idx === 0}
                      className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => moveItem(id, 'down')}
                      disabled={idx === selectedProductIds.length - 1}
                      className="p-0.5 text-slate-400 hover:text-blue-600 disabled:opacity-30 disabled:hover:text-slate-400"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Products Grid/List */}
        <div className="p-3 max-h-[400px] overflow-y-auto">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-10">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">لا توجد منتجات</p>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                const selectionIndex = selectedProductIds.indexOf(product.id);
                
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      "relative group cursor-pointer rounded-lg border transition-all duration-150 overflow-hidden",
                      isSelected
                        ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                        : "border-slate-200 bg-white hover:border-primary/40 hover:shadow-sm"
                    )}
                  >
                    {/* Selection Badge - Clickable for inline reorder */}
                    {isSelected && (
                      <>
                        <div 
                          className="absolute top-1.5 right-1.5 z-10 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center text-[10px] font-bold shadow-sm cursor-pointer hover:bg-primary/80 transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            const newOrder = prompt(`أدخل الترتيب الجديد (1-${selectedProductIds.length}):`, String(selectionIndex + 1));
                            if (newOrder) {
                              const targetOrder = parseInt(newOrder) - 1;
                              if (targetOrder >= 0 && targetOrder < selectedProductIds.length && targetOrder !== selectionIndex) {
                                const newIds = [...selectedProductIds];
                                newIds.splice(selectionIndex, 1);
                                newIds.splice(targetOrder, 0, product.id);
                                onSelectionChange(newIds);
                              }
                            }
                          }}
                          title="انقر لتغيير الترتيب"
                        >
                          {selectionIndex + 1}
                        </div>
                        <div className="absolute top-1.5 left-1.5 z-10 flex gap-0.5">
                          <button
                            onClick={(e) => { e.stopPropagation(); moveItem(product.id, 'up'); }}
                            className="p-1 bg-white/90 rounded-full shadow-sm text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400"
                            disabled={selectionIndex === 0}
                          >
                            <ChevronUp className="w-3 h-3" />
                          </button>
                          <button
                            onClick={(e) => { e.stopPropagation(); moveItem(product.id, 'down'); }}
                            className="p-1 bg-white/90 rounded-full shadow-sm text-slate-400 hover:text-primary disabled:opacity-30 disabled:hover:text-slate-400"
                            disabled={selectionIndex === selectedProductIds.length - 1}
                          >
                            <ChevronDown className="w-3 h-3" />
                          </button>
                        </div>
                      </>
                    )}

                    {/* Product Image */}
                    <div className="aspect-square bg-slate-100 relative overflow-hidden">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.nameAr}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                          onError={applyProductImageFallback}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-8 h-8 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="p-2">
                      <h4 className="font-medium text-xs text-slate-800 truncate" title={product.nameAr}>
                        {product.nameAr}
                      </h4>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-[10px] text-slate-400">{product.sku}</span>
                        <span className="text-xs font-bold text-primary">
                          {(product.price || 0).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List View */
            <div className="space-y-1">
              {filteredProducts.map((product) => {
                const isSelected = selectedProductIds.includes(product.id);
                const selectionIndex = selectedProductIds.indexOf(product.id);
                
                return (
                  <div
                    key={product.id}
                    onClick={() => toggleProduct(product.id)}
                    className={cn(
                      "flex items-center gap-3 p-2 rounded-lg border cursor-pointer transition-all duration-150",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-slate-200 bg-white hover:border-primary/40 hover:bg-slate-50"
                    )}
                  >
                    {/* Reorder Buttons */}
                    {isSelected && (
                      <div className="flex flex-col gap-0.5">
                        <button
                          onClick={(e) => { e.stopPropagation(); moveItem(product.id, 'up'); }}
                          className="p-0.5 text-slate-400 hover:text-primary disabled:opacity-30"
                          disabled={selectionIndex === 0}
                        >
                          <ChevronUp className="w-3 h-3" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); moveItem(product.id, 'down'); }}
                          className="p-0.5 text-slate-400 hover:text-primary disabled:opacity-30"
                          disabled={selectionIndex === selectedProductIds.length - 1}
                        >
                          <ChevronDown className="w-3 h-3" />
                        </button>
                      </div>
                    )}

                    {/* Selection Indicator */}
                    <div className={cn(
                      "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
                      isSelected
                        ? "bg-primary border-primary"
                        : "bg-white border-slate-300"
                    )}>
                      {isSelected ? (
                        <span className="text-[10px] font-bold text-white">{selectionIndex + 1}</span>
                      ) : (
                        <Circle className="w-2 h-2 text-slate-300" />
                      )}
                    </div>

                    {/* Product Image */}
                    <div className="w-10 h-10 rounded-md overflow-hidden bg-slate-100 flex-shrink-0">
                      {product.image ? (
                        <img src={product.image} alt="" className="w-full h-full object-cover" onError={applyProductImageFallback} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Package className="w-4 h-4 text-slate-300" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm text-slate-800 truncate">{product.nameAr}</h4>
                      <span className="text-xs text-slate-400">{product.sku}</span>
                    </div>

                    {/* Price */}
                    <div className="text-right flex-shrink-0">
                      <span className="text-sm font-bold text-primary">
                        {(product.price || 0).toLocaleString()} ج.م
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default SmartProductSelector;
