import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Ruler, Rotate3D, Scan, Save, Upload, Wand2, Search, Package, Eye, SlidersHorizontal, Grid3x3, List, ChevronLeft, ChevronRight, TrendingUp, Star, Clock, Settings, Download, FileUp, RotateCcw, X, Palette, Edit2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';
import { useTheme } from '@/context/ThemeContext';
import { useShopBuilder, useShopBuilderLayout } from '../store';
import type { TransformMode } from '../three/ThreeScene';
import { WALL_TEXTURES, FLOOR_TEXTURES } from '../three/ThreeScene';

// Wall texture options - mapped from WALL_TEXTURES
const WALL_TEXTURE_OPTIONS = [
  { key: '', label: 'افتراضي', preview: null },
  ...Object.entries(WALL_TEXTURES).map(([key, config]) => ({
    key,
    label: key.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
    preview: config.preview || config.map,
  })),
];
import { downloadLayout, readLayoutFile } from '../utils/layoutIO';
import { apiGet, apiPostJson } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Model3DPreview from './Model3DPreview';

interface BuilderToolbarProps {
  transformMode: TransformMode;
  onTransformModeChange: (mode: TransformMode) => void;
  onResetCamera: () => void;
  onSnapshot: () => void;
  onFullscreen: () => void;
  onClearSelection: () => void;
}

const modeLabels: Record<TransformMode, { label: string; icon: React.ReactNode }> = {
  translate: { label: 'تحريك', icon: <Scan className="h-4 w-4" /> },
  rotate: { label: 'تدوير', icon: <Rotate3D className="h-4 w-4" /> },
  scale: { label: 'تحجيم', icon: <Ruler className="h-4 w-4" /> },
};

interface Product3D {
  _id: string;
  name: string;
  nameEn?: string;
  description: string;
  category: string;
  modelUrl: string;
  thumbnailUrl?: string;
  defaultScale: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  isActive: boolean;
  isPremium: boolean;
  tags?: string[];
  color?: string;
  material?: string;
  usageCount: number;
  createdAt?: string;
}

const BuilderToolbar: React.FC<BuilderToolbarProps> = ({
  transformMode,
  onTransformModeChange,
  onResetCamera,
  onSnapshot,
  onFullscreen,
  onClearSelection,
}) => {
  const { toast } = useToast();
  const { primaryColor, secondaryColor } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const {
    layout,
    upsertWall,
    selectWall,
    selectedWallId,
    removeWall,
    addColumnToWall,
    updateColumn,
    removeColumn,
    selectedColumnId,
    selectColumn,
    selectedProductId,
    selectProduct,
    upsertProduct,
    removeProduct,
    isDrawingMode,
    setDrawingMode,
    defaultWallThickness,
    setDefaultWallThickness,
    exportToFile,
    exportLayout,
    importFromFile,
    reset,
    importLayout,
    setFloorTexture,
    setFloorSize,
    setGlobalWallTexture,
  } = useShopBuilder();
  const [wallColor, setWallColor] = useState<string>('#ffffff');
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [floorSettingsOpen, setFloorSettingsOpen] = useState(false);
  const [wallSettingsOpen, setWallSettingsOpen] = useState(false);
  const [floorTextureOpen, setFloorTextureOpen] = useState(false);
  const [wallTextureOpen, setWallTextureOpen] = useState(false);
  
  // 3D Products from database
  const [products3D, setProducts3D] = useState<Product3D[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [previewProduct, setPreviewProduct] = useState<Product3D | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'popular' | 'recent'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 12;
  
  // Search suggestions and recommendations
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchSuggestions, setSearchSuggestions] = useState<Product3D[]>([]);
  const [recommendedProducts, setRecommendedProducts] = useState<Product3D[]>([]);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedWall = useMemo(
    () => layout.walls.find((wall) => wall.id === selectedWallId) ?? null,
    [layout.walls, selectedWallId]
  );

  useEffect(() => {
    if (selectedWall) {
      setWallColor(selectedWall.color);
    }
  }, [selectedWall]);

  // Fetch 3D products from database
  const fetchProducts = useCallback(async () => {
    setLoadingProducts(true);
    try {
      const params = new URLSearchParams();
      params.append('isActive', 'true'); // Only show active products
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (searchTerm) params.append('search', searchTerm);
      
      const response = await apiGet<{ items: Product3D[] }>(`/api/products-3d?${params.toString()}`);
      if (response.ok && response.items) {
        console.log('✅ Fetched 3D products:', response.items.length, 'products');
        console.log('📦 Products:', response.items);
        setProducts3D(response.items as unknown as Product3D[]);
      } else {
        console.error('❌ Failed to fetch products:', response);
      }
    } catch (error) {
      console.error('Error fetching 3D products:', error);
    } finally {
      setLoadingProducts(false);
    }
  }, [selectedCategory, searchTerm]);

  // Fetch categories
  const fetchCategories = useCallback(async () => {
    try {
      const response = await apiGet('/api/products-3d-categories') as { ok: boolean; categories?: string[] };
      if (response.ok && response.categories) {
        setCategories(response.categories);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  }, []);

  // Load products when modal opens
  useEffect(() => {
    if (addProductOpen) {
      fetchProducts();
      fetchCategories();
      loadRecommendations();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [addProductOpen]);

  // Load recommended products (most popular)
  const loadRecommendations = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('isActive', 'true');
      params.append('sort', 'popular');
      params.append('limit', '6');
      
      const response = await apiGet<{ items: Product3D[] }>(`/api/products-3d?${params.toString()}`);
      if (response.ok && response.items) {
        setRecommendedProducts(response.items as unknown as Product3D[]);
      }
    } catch (error) {
      console.error('Error loading recommendations:', error);
    }
  }, []);

  // Handle search input with suggestions
  const handleSearchChange = (value: string) => {
    console.log('🔍 Search changed:', value);
    console.log('📦 Products3D available:', products3D.length);
    setSearchTerm(value);
    
    if (value.trim().length >= 2) {
      // Filter products for suggestions
      const filtered = products3D.filter(p => 
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.nameEn?.toLowerCase().includes(value.toLowerCase()) ||
        p.tags?.some(tag => tag.toLowerCase().includes(value.toLowerCase())) ||
        p.category.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);
      
      console.log('✅ Filtered suggestions:', filtered.length, filtered);
      setSearchSuggestions(filtered);
      setShowSuggestions(true);
      console.log('👁️ showSuggestions set to TRUE');
    } else if (value.trim().length === 0) {
      // When search is cleared, show recommendations again
      console.log('🔄 Search cleared, loading recommendations');
      setSearchSuggestions([]);
      loadRecommendations();
      setShowSuggestions(true);
    } else {
      console.log('❌ Search too short, hiding suggestions');
      setShowSuggestions(false);
      setSearchSuggestions([]);
    }
  };

  // Select suggestion
  const selectSuggestion = (product: Product3D) => {
    setSearchTerm(product.name);
    setShowSuggestions(false);
    fetchProducts();
  };

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchInputRef.current && !searchInputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter, sort and paginate products
  const sortedAndPaginatedProducts = useMemo(() => {
    // Filter by category
    let filtered = [...products3D];
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(p => p.category === selectedCategory);
    }
    
    // Filter by search term
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(search) ||
        p.nameEn?.toLowerCase().includes(search) ||
        p.category.toLowerCase().includes(search) ||
        p.description?.toLowerCase().includes(search)
      );
    }
    
    // Sort
    switch (sortBy) {
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name, 'ar'));
        break;
      case 'popular':
        filtered.sort((a, b) => b.usageCount - a.usageCount);
        break;
      case 'recent':
        filtered.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
        break;
    }
    
    // Paginate
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    
    return {
      items: filtered.slice(startIndex, endIndex),
      total: filtered.length,
      totalPages: Math.ceil(filtered.length / itemsPerPage)
    };
  }, [products3D, selectedCategory, searchTerm, sortBy, currentPage, itemsPerPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCategory, searchTerm]);

  const handleAddWall = useCallback(() => {
    const offset = layout.walls.length * 2.4;
    const id = upsertWall({
      start: { x: -2 + offset, y: -1.5 },
      end: { x: -2 + offset, y: 1.5 },
      height: 3,
      thickness: 0.25,
      color: '#ffffff',
    });
    selectWall(id);
    toast({ title: 'تم إضافة جدار جديد', description: 'يمكنك سحب أطرافه لتغيير الأبعاد.' });
  }, [layout.walls.length, selectWall, toast, upsertWall]);
  const handleWallColorChange = useCallback(
    (value: string) => {
      setWallColor(value);
      if (!selectedWall) return;
      upsertWall({ ...selectedWall, color: value });
    },
    [selectedWall, upsertWall]
  );

  const handleExportLayout = useCallback(() => {
    const layoutData = exportLayout();
    downloadLayout(layoutData);
    toast({ title: 'تم حفظ المخطط', description: 'تم تنزيل ملف JSON يحتوي على تفاصيل التخطيط.' });
  }, [exportLayout, toast]);

  const handleImportClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleImportLayout = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        const layoutData = await readLayoutFile(file);
        importLayout(layoutData);
        toast({ title: 'تم استيراد المخطط', description: 'تم تحميل الجدران والمنتجات من الملف.' });
      } catch (error) {
        console.error(error);
        toast({ title: 'فشل الاستيراد', description: 'تأكد من أن الملف يحتوي على صيغة JSON صحيحة.', variant: 'destructive' });
      }
    },
    [importLayout, toast]
  );

  // Settings menu handlers
  const handleExportDesign = useCallback(() => {
    exportToFile();
    toast({ title: 'تم التصدير', description: 'تم تنزيل ملف التصميم بنجاح' });
    setSettingsOpen(false);
  }, [exportToFile, toast]);

  const handleImportDesign = useCallback(() => {
    importFileRef.current?.click();
    setSettingsOpen(false);
  }, []);

  const handleImportDesignFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      try {
        await importFromFile(file);
        toast({ title: 'تم الاستيراد', description: 'تم تحميل التصميم بنجاح' });
      } catch (error) {
        console.error(error);
        toast({ title: 'فشل الاستيراد', description: 'تأكد من أن الملف صحيح', variant: 'destructive' });
      }
    },
    [importFromFile, toast]
  );

  const handleResetDesign = useCallback(() => {
    if (confirm('هل أنت متأكد من إعادة التعيين؟ سيتم حذف جميع التصميمات.')) {
      reset();
      toast({ title: 'تم إعادة التعيين', description: 'تم حذف التصميم والعودة للوضع الافتراضي' });
      setSettingsOpen(false);
    }
  }, [reset, toast]);

  const handleAddProduct = useCallback(async (product: Product3D) => {
    setIsAdding(true);
    try {
      // Validate model URL
      if (!product.modelUrl || product.modelUrl.trim() === '') {
        toast({ 
          title: 'خطأ', 
          description: 'هذا المنتج لا يحتوي على نموذج ثلاثي الأبعاد', 
          variant: 'destructive' 
        });
        setIsAdding(false);
        return;
      }

      // Validate model format
      const url = product.modelUrl.toLowerCase();
      const validFormats = ['.glb', '.gltf', '.obj', '.fbx'];
      const hasValidFormat = validFormats.some(format => url.endsWith(format));
      
      if (!hasValidFormat) {
        toast({ 
          title: 'خطأ', 
          description: 'صيغة النموذج غير مدعومة. يجب أن يكون GLB أو GLTF أو OBJ أو FBX', 
          variant: 'destructive' 
        });
        setIsAdding(false);
        return;
      }

      // Increment usage count
      await apiPostJson(`/api/products-3d/${product._id}/use`, {});
      
      const id = upsertProduct({
        name: product.name,
        modelUrl: product.modelUrl,
        // Don't override position - let store.tsx default (y: 0.5) handle it
        rotation: { x: 0, y: 0, z: 0 },
        scale: product.defaultScale,
        metadata: {
          thumbnailUrl: product.thumbnailUrl,
          category: product.category,
          description: product.description
        }
      });
      selectProduct(id);
      toast({ title: 'تم إضافة المنتج', description: `تم إضافة ${product.name} إلى المشهد` });
      setAddProductOpen(false);
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ title: 'خطأ', description: 'فشل إضافة المنتج', variant: 'destructive' });
    } finally {
      setIsAdding(false);
    }
  }, [selectProduct, toast, upsertProduct]);

  const clearSelection = useCallback(() => {
    onClearSelection();
    toast({ title: 'تم إلغاء التحديد', description: 'لم يتم اختيار أي جدار أو منتج.' });
  }, [onClearSelection, toast]);

  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border bg-white/95 px-4 py-3 shadow-lg backdrop-blur-sm" style={{ borderColor: primaryColor }}>
      {/* Right Side - Main Actions */}
      <div className="flex items-center gap-3">
        {/* Modern Wall System - Two buttons with divider */}
        <div className="flex items-center gap-0 bg-white rounded-xl overflow-hidden shadow-sm" style={{ border: `2px solid ${primaryColor}` }}>
          {/* Wall Mode / Quit Button */}
          <Button 
            onClick={() => setDrawingMode(!isDrawingMode)} 
            className="flex items-center gap-2 font-semibold rounded-none h-11 px-5 transition-all duration-700 border-0"
            style={{
              background: isDrawingMode ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` : 'white',
              color: isDrawingMode ? 'white' : primaryColor,
              boxShadow: isDrawingMode ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {isDrawingMode ? (
              <>
                <X className="h-4 w-4" />
                إنهاء وضع الرسم
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                وضع الرسم
              </>
            )}
          </Button>
          
          {/* Divider */}
          <div className="w-px h-8" style={{ backgroundColor: primaryColor }} />
          
          {/* Direct Wall Length Input */}
          <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg">
            <span className="text-xs font-semibold" style={{ color: primaryColor }}>الطول (م)</span>
            <Input
              type="number"
              placeholder="0.5"
              className="w-16 h-8 text-center text-sm border-slate-300 text-slate-900 placeholder-slate-600 font-medium"
              min="0.5"
              step="0.5"
            />
            <Button 
              onClick={handleAddWall}
              size="sm"
              className="h-8 w-8 p-0 text-white transition-all"
              style={{ backgroundColor: secondaryColor }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>
        

        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2 text-white font-medium rounded-xl h-10 px-4 transition-all" style={{ background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}>
              <Plus className="h-4 w-4" />
              إضافة منتج ثلاثي الأبعاد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="text-2xl font-bold">اختر منتج ثلاثي الأبعاد</DialogTitle>
            </DialogHeader>

            {/* Enhanced Search Bar with Live Suggestions */}
            <div className="px-4 py-2 border-b" style={{ background: `linear-gradient(135deg, ${primaryColor}08 0%, ${secondaryColor}08 100%)` }}>
              <div className="flex gap-2">
                <div className="flex-1 relative" ref={searchInputRef}>
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 z-10" />
                  <Input
                    placeholder="ابحث عن منتج..."
                    value={searchTerm}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchProducts()}
                    onFocus={() => {
                      // Don't auto-show suggestions on focus
                      // User must type to see suggestions
                    }}
                    className="pr-10 h-9 text-sm border-2 border-slate-200 focus:border-primary shadow-sm"
                  />
                  
                  {/* Live Search Suggestions with Images */}
                  {showSuggestions && (searchSuggestions.length > 0 || (searchTerm.length === 0 && recommendedProducts.length > 0)) && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-slate-200 rounded-xl shadow-2xl z-50 max-h-[280px] overflow-y-auto">
                      {searchTerm.length === 0 && recommendedProducts.length > 0 && (
                        <>
                          <div className="p-2 border-b bg-gradient-to-r from-emerald-50 to-teal-50 sticky top-0 z-10">
                            <div className="flex items-center gap-1.5">
                              <TrendingUp className="h-3 w-3 text-emerald-600" />
                              <p className="text-xs font-bold text-slate-800">الأكثر استخداماً - اقتراحات لك</p>
                            </div>
                          </div>
                          {recommendedProducts.map((product) => (
                            <div
                              key={product._id}
                              onClick={() => {
                                handleAddProduct(product);
                                setShowSuggestions(false);
                              }}
                              className="flex items-center gap-2 p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 cursor-pointer border-b border-slate-100 last:border-0 transition-all group"
                            >
                              <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-shadow border border-slate-200">
                                {product.thumbnailUrl ? (
                                  <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Model3DPreview
                                    modelUrl={product.modelUrl}
                                    thumbnailUrl={product.thumbnailUrl}
                                    className="w-full h-full"
                                    autoRotate={false}
                                    showThumbnail={false}
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">{product.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Badge variant="secondary" className="text-[10px] px-1 py-0">{product.category}</Badge>
                                  {product.usageCount > 0 && (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                      <TrendingUp className="h-2.5 w-2.5" />
                                      {product.usageCount}
                                    </span>
                                  )}
                                  {product.isPremium && (
                                    <Badge className="bg-amber-500 text-[10px] px-1 py-0">⭐ مميز</Badge>
                                  )}
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-primary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </>
                      )}
                      
                      {searchTerm.length >= 2 && searchSuggestions.length > 0 && (
                        <>
                          <div className="p-2 border-b bg-slate-50 sticky top-0 z-10">
                            <p className="text-xs font-bold text-slate-700">نتائج البحث ({searchSuggestions.length})</p>
                          </div>
                          {searchSuggestions.map((product) => (
                            <div
                              key={product._id}
                              onClick={() => {
                                handleAddProduct(product);
                                setShowSuggestions(false);
                              }}
                              className="flex items-center gap-2 p-2 hover:bg-gradient-to-r hover:from-blue-50 hover:to-purple-50 cursor-pointer border-b border-slate-100 last:border-0 transition-all group"
                            >
                              <div className="w-12 h-12 flex-shrink-0 bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center overflow-hidden shadow-sm group-hover:shadow-md transition-shadow border border-slate-200">
                                {product.thumbnailUrl ? (
                                  <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                                ) : (
                                  <Model3DPreview
                                    modelUrl={product.modelUrl}
                                    thumbnailUrl={product.thumbnailUrl}
                                    className="w-full h-full"
                                    autoRotate={false}
                                    showThumbnail={false}
                                  />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-slate-900 text-sm truncate group-hover:text-primary transition-colors">{product.name}</p>
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Badge variant="outline" className="text-[10px] px-1 py-0">{product.category}</Badge>
                                  {product.usageCount > 0 && (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
                                      <TrendingUp className="h-2.5 w-2.5" />
                                      {product.usageCount}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <Plus className="h-4 w-4 text-primary flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
                <Select value={sortBy} onValueChange={(value: 'name' | 'popular' | 'recent') => setSortBy(value)}>
                  <SelectTrigger className="w-[130px] h-9 border-2 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recent">الأحدث</SelectItem>
                    <SelectItem value="popular">الأكثر استخداماً</SelectItem>
                    <SelectItem value="name">الاسم</SelectItem>
                  </SelectContent>
                </Select>
                <div className="flex border-2 rounded-lg overflow-hidden">
                  <Button 
                    variant={viewMode === 'grid' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setViewMode('grid')}
                    className="rounded-none h-9 px-2"
                  >
                    <Grid3x3 className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant={viewMode === 'list' ? 'default' : 'ghost'} 
                    size="sm"
                    onClick={() => setViewMode('list')}
                    className="rounded-none h-9 px-2"
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            {/* Sidebar Layout with Categories */}
            <div className="flex-1 flex overflow-hidden">
              {/* Left Sidebar - Categories */}
              <div className="w-40 border-r bg-slate-50 overflow-y-auto">
                <div className="p-2 space-y-1">
                  <button
                    onClick={() => setSelectedCategory('all')}
                    className={cn(
                      "w-full text-right px-3 py-2 rounded-lg text-sm font-medium transition-all",
                      selectedCategory === 'all'
                        ? "bg-primary text-white shadow-md"
                        : "text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    الكل
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "w-full text-right px-3 py-2 rounded-lg text-sm font-medium transition-all",
                        selectedCategory === cat
                          ? "bg-primary text-white shadow-md"
                          : "text-slate-700 hover:bg-slate-200"
                      )}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Side - Products Grid */}
              <div className="flex-1 overflow-y-auto py-4 px-4 bg-white">
              {loadingProducts ? (
                <div className="flex flex-col items-center justify-center h-96">
                  <div className="animate-spin rounded-full h-16 w-16 border-4 border-primary border-t-transparent"></div>
                  <p className="mt-4 text-slate-600 font-medium">جاري التحميل...</p>
                </div>
              ) : sortedAndPaginatedProducts.total === 0 ? (
                <div className="flex flex-col items-center justify-center h-96 text-center">
                  <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center mb-6">
                    <Package className="h-12 w-12 text-slate-400" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-700 mb-2">لا توجد نتائج</h3>
                  <p className="text-slate-500">جرب تغيير الفئة أو البحث عن منتج آخر</p>
                </div>
              ) : (
                <>
                  {viewMode === 'grid' ? (
                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                      {sortedAndPaginatedProducts.items.map((product) => (
                    <div
                      key={product._id}
                      className="group bg-slate-50 rounded-lg border-2 border-slate-200 overflow-hidden hover:border-primary hover:bg-white hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1"
                    >
                      {/* 3D Preview - Always show 3D model */}
                      <div className="relative aspect-[4/3] bg-gradient-to-br from-slate-50 via-slate-100 to-slate-200 flex items-center justify-center overflow-hidden">
                        <Model3DPreview
                          modelUrl={product.modelUrl}
                          thumbnailUrl={product.thumbnailUrl}
                          className="w-full h-full"
                          autoRotate={true}
                          showThumbnail={false}
                        />
                        
                        {/* Thumbnail overlay - bottom left */}
                        {product.thumbnailUrl && (
                          <div className="absolute bottom-2 left-2 w-12 h-12 rounded-lg overflow-hidden border-2 border-white shadow-lg bg-white">
                            <img 
                              src={product.thumbnailUrl} 
                              alt={product.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        )}
                        
                        {/* Badges Overlay */}
                        <div className="absolute top-3 right-3 flex flex-col gap-2">
                          {product.isPremium && (
                            <Badge className="bg-gradient-to-r from-amber-400 to-amber-600 text-white shadow-lg border-0">
                              <Star className="h-3 w-3 mr-1" />
                              مميز
                            </Badge>
                          )}
                          {product.usageCount > 5 && (
                            <Badge className="bg-gradient-to-r from-emerald-400 to-emerald-600 text-white shadow-lg border-0">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              شائع
                            </Badge>
                          )}
                        </div>

                        {/* Removed hover overlay button */}
                      </div>

                      {/* Info Section - Compact */}
                      <div className="p-2 space-y-1.5">
                        <div>
                          <h4 className="font-semibold text-xs text-slate-900 truncate group-hover:text-primary transition-colors leading-tight">{product.name}</h4>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">{product.category}</Badge>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-1 pt-0.5">
                          <Button 
                            size="sm" 
                            variant="outline" 
                            className="flex-1 h-7 text-[10px] px-1 border hover:border-primary hover:text-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPreviewProduct(product);
                              setIsPreviewOpen(true);
                            }}
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                          <Button 
                            size="sm" 
                            className="flex-1 h-7 text-[10px] px-1 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleAddProduct(product);
                            }}
                          >
                            <Plus className="h-3 w-3 ml-0.5" />
                            إضافة
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                  ) : (
                    /* List View - Enhanced */
                    <div className="space-y-4">
                      {sortedAndPaginatedProducts.items.map((product) => (
                        <div key={product._id} className="flex gap-6 p-5 bg-white rounded-2xl border-2 border-slate-200 hover:border-primary hover:shadow-xl transition-all group">
                          <div className="w-32 h-32 bg-gradient-to-br from-slate-100 to-slate-200 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-md">
                            {product.thumbnailUrl ? (
                              <img src={product.thumbnailUrl} alt={product.name} className="w-full h-full object-cover" />
                            ) : (
                              <Model3DPreview
                                modelUrl={product.modelUrl}
                                thumbnailUrl={product.thumbnailUrl}
                                className="w-full h-full"
                                autoRotate={true}
                                showThumbnail={false}
                              />
                            )}
                          </div>
                          <div className="flex-1 min-w-0 flex flex-col justify-between">
                            <div>
                              <h4 className="font-bold text-lg text-slate-900 group-hover:text-primary transition-colors">{product.name}</h4>
                              <p className="text-sm text-slate-600 line-clamp-2 mt-2">{product.description || 'منتج ثلاثي الأبعاد عالي الجودة'}</p>
                              <div className="flex items-center gap-3 mt-3 flex-wrap">
                                <Badge variant="secondary" className="text-sm">{product.category}</Badge>
                                {product.isPremium && <Badge className="bg-amber-500 text-sm"><Star className="h-3 w-3 mr-1" />مميز</Badge>}
                                <span className="text-sm text-slate-500">{product.dimensions.width}×{product.dimensions.height}×{product.dimensions.depth}م</span>
                                {product.usageCount > 0 && (
                                  <span className="text-sm text-slate-500 flex items-center gap-1">
                                    <TrendingUp className="h-4 w-4" />
                                    استخدم {product.usageCount} مرة
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-3 justify-center">
                            <Button size="default" variant="outline" className="border-2 hover:border-primary" onClick={() => { setPreviewProduct(product); setIsPreviewOpen(true); }}>
                              <Eye className="h-4 w-4 ml-2" />
                              معاينة
                            </Button>
                            <Button size="default" className="bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-primary" onClick={() => handleAddProduct(product)}>
                              <Plus className="h-4 w-4 ml-2" />
                              إضافة للمتجر
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Pagination */}
                  {sortedAndPaginatedProducts.totalPages > 1 && (
                    <div className="flex items-center justify-center gap-2 mt-4 pt-4 border-t">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-slate-600">
                        صفحة {currentPage} من {sortedAndPaginatedProducts.totalPages}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setCurrentPage(p => Math.min(sortedAndPaginatedProducts.totalPages, p + 1))}
                        disabled={currentPage === sortedAndPaginatedProducts.totalPages}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </>
              )}
              </div>
            </div>

            <DialogFooter className="border-t pt-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                {sortedAndPaginatedProducts.total} نموذج متاح
              </span>
              <Button variant="outline" onClick={() => setAddProductOpen(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Modal */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>{previewProduct?.name}</DialogTitle>
              <DialogDescription>
                معاينة تفاصيل النموذج ثلاثي الأبعاد
              </DialogDescription>
            </DialogHeader>

            {previewProduct && (
              <div className="space-y-4 overflow-y-auto flex-1">
                {/* 3D Preview with Thumbnail - Scrollable */}
                <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center overflow-hidden relative">
                  <div className="absolute inset-0 flex items-center justify-center p-4">
                    <Model3DPreview
                      modelUrl={previewProduct.modelUrl}
                      thumbnailUrl={previewProduct.thumbnailUrl}
                      className="w-full h-full max-w-full max-h-full object-contain"
                      autoRotate={true}
                      showThumbnail={true}
                    />
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-slate-600">الاسم</Label>
                    <p className="font-semibold">{previewProduct.name}</p>
                  </div>
                  {previewProduct.nameEn && (
                    <div>
                      <Label className="text-slate-600">Name (EN)</Label>
                      <p className="font-semibold">{previewProduct.nameEn}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-slate-600">الفئة</Label>
                    <Badge variant="outline">{previewProduct.category}</Badge>
                  </div>
                  <div>
                    <Label className="text-slate-600">الأبعاد</Label>
                    <p className="font-mono text-sm">
                      {previewProduct.dimensions.width}×{previewProduct.dimensions.height}×{previewProduct.dimensions.depth}م
                    </p>
                  </div>
                  {previewProduct.material && (
                    <div>
                      <Label className="text-slate-600">المادة</Label>
                      <p>{previewProduct.material}</p>
                    </div>
                  )}
                  {previewProduct.color && (
                    <div>
                      <Label className="text-slate-600">اللون</Label>
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-6 h-6 rounded border border-slate-300" 
                          style={{ backgroundColor: previewProduct.color }}
                        />
                        <span className="text-sm font-mono">{previewProduct.color}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Description */}
                {previewProduct.description && (
                  <div>
                    <Label className="text-slate-600">الوصف</Label>
                    <p className="text-sm text-slate-700 mt-1">{previewProduct.description}</p>
                  </div>
                )}

                {/* Tags */}
                {previewProduct.tags && previewProduct.tags.length > 0 && (
                  <div>
                    <Label className="text-slate-600">الوسوم</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {previewProduct.tags.map((tag, index) => (
                        <Badge key={index} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsPreviewOpen(false)}>
                إغلاق
              </Button>
              <Button 
                onClick={() => {
                  if (previewProduct) {
                    handleAddProduct(previewProduct);
                    setIsPreviewOpen(false);
                  }
                }}
                className="bg-primary"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة إلى المشهد
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Center - Wall Controls (only when wall selected) */}


      {/* Left Side - Utility Actions */}
      <div className="flex items-center gap-2">
        <Button 
          className="flex items-center gap-2 rounded-xl h-10 px-3 transition-all duration-300 font-medium disabled:opacity-50"
          style={{
            border: `2px solid ${primaryColor}`,
            color: primaryColor,
            backgroundColor: 'white',
          }}
          disabled={isCapturing}
          onMouseEnter={(e) => {
            if (!isCapturing) {
              e.currentTarget.style.backgroundColor = `${primaryColor}15`;
              e.currentTarget.style.boxShadow = `0 0 12px ${primaryColor}40`;
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'white';
            e.currentTarget.style.boxShadow = 'none';
          }}
          onClick={async () => {
            if (onSnapshot && !isCapturing) {
              setIsCapturing(true);
              try {
                const dataUrl = await onSnapshot();
                if (dataUrl) {
                  setPreviewImage(dataUrl);
                  setPreviewOpen(true);
                }
              } finally {
                setIsCapturing(false);
              }
            }
          }}
        >
          {isCapturing ? (
            <>
              <div className="animate-spin h-4 w-4 border-2 border-transparent rounded-full" style={{ borderTopColor: primaryColor }}></div>
              <span className="hidden sm:inline">جاري الالتقاط...</span>
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              <span className="hidden sm:inline">حفظ صورة</span>
            </>
          )}
        </Button>

        {/* Floor Settings Dialog - Opened from Settings Dropdown */}
        <Dialog open={floorSettingsOpen} onOpenChange={setFloorSettingsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">إعدادات الأرضية</DialogTitle>
              <DialogDescription>
                تخصيص حجم ونسيج الأرضية
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 overflow-y-auto flex-1">
              {/* Floor Size Control */}
              <div>
                <Label className="text-base font-semibold text-slate-900 mb-3 block">حجم الأرضية</Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 w-24">الحجم (متر):</span>
                    <input
                      type="range"
                      min="12"
                      max="48"
                      step="4"
                      value={layout.floorSize || 24}
                      onChange={(e) => setFloorSize(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-lg font-bold text-primary w-16 text-center">
                      {layout.floorSize || 24}م
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 pr-28">
                    سيتم تطبيق الحجم على كل من العرض 2D والعرض 3D
                  </p>
                </div>
              </div>

              {/* Floor Texture Selector */}
              <div>
                <Label className="text-base font-semibold text-slate-900 mb-3 block">نسيج الأرضية</Label>
                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {Object.entries(FLOOR_TEXTURES).map(([key, texture]) => (
                    <button
                      key={key}
                      onClick={() => {
                        setFloorTexture(key);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all hover:shadow-md",
                        layout.floorTexture === key || (!layout.floorTexture && key === 'tiles_white')
                          ? "border-primary bg-primary/10 shadow-md"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-300 flex-shrink-0 shadow-sm">
                        <img 
                          src={texture.preview} 
                          alt={key}
                          className="w-full h-full object-cover"
                          crossOrigin="anonymous"
                        />
                      </div>
                      <span className="text-sm font-medium text-slate-700 text-right flex-1">
                        {key === 'tiles_white' && 'بلاط أبيض'}
                        {key === 'tiles_grey' && 'بلاط رمادي'}
                        {key === 'tiles_black' && 'بلاط أسود'}
                        {key === 'wood_light' && 'خشب فاتح'}
                        {key === 'wood_dark' && 'خشب غامق'}
                        {key === 'wood_parquet' && 'باركيه'}
                        {key === 'marble_white' && 'رخام أبيض'}
                        {key === 'marble_black' && 'رخام أسود'}
                        {key === 'vinyl_grey' && 'فينيل'}
                        {key === 'concrete' && 'خرسانة'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setFloorSettingsOpen(false)} className="w-full">
                تم
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Wall Settings Dialog - Global Wall Texture and Color */}
        <Dialog open={wallSettingsOpen} onOpenChange={setWallSettingsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">إعدادات الجدران</DialogTitle>
              <DialogDescription>
                تخصيص نسيج ولون جميع الجدران
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 overflow-y-auto flex-1">
              {/* Wall Texture Selector */}
              <div>
                <Label className="text-base font-semibold text-slate-900 mb-3 block">نسيج الجدران</Label>
                <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto p-2 border border-slate-200 rounded-lg">
                  {WALL_TEXTURE_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => {
                        setGlobalWallTexture(option.key);
                      }}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border-2 transition-all hover:shadow-md",
                        layout.defaultWallTexture === option.key || (!layout.defaultWallTexture && option.key === '')
                          ? "border-emerald-500 bg-emerald-50 shadow-md"
                          : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
                      )}
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden border-2 border-slate-300 flex-shrink-0 shadow-sm">
                        {option.preview ? (
                          <img 
                            src={option.preview} 
                            alt={option.label}
                            className="w-full h-full object-cover"
                            crossOrigin="anonymous"
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-500">
                            افتراضي
                          </div>
                        )}
                      </div>
                      <span className="text-sm font-medium text-slate-700 text-right flex-1">
                        {option.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Global Wall Color Control */}
              <div>
                <Label className="text-base font-semibold text-slate-900 mb-3 block">لون الجدران</Label>
                <div className="flex items-center gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50">
                  <input 
                    type="color" 
                    value={layout.walls[0]?.color || '#64748b'} 
                    onChange={(e) => {
                      // Apply color to all walls
                      layout.walls.forEach(w => {
                        upsertWall({ id: w.id, color: e.target.value });
                      });
                    }} 
                    className="w-20 h-20 rounded-lg border-2 border-slate-300 cursor-pointer shadow-md" 
                    title="اختر لون الجدران"
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-700 mb-1">لون جميع الجدران</p>
                    <p className="text-xs text-slate-500">سيتم تطبيق اللون على جميع الجدران</p>
                    <p className="text-xs font-mono text-slate-600 mt-1">{layout.walls[0]?.color || '#64748b'}</p>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setWallSettingsOpen(false)} className="w-full">
                تم
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        
        {/* Settings Dropdown Menu */}
        <DropdownMenu open={settingsOpen} onOpenChange={setSettingsOpen}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="flex items-center gap-2 border border-slate-200 hover:bg-slate-100 hover:text-slate-900 rounded-xl h-10 px-3">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">الإعدادات</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-96 max-h-[600px] overflow-y-auto p-3">
            {/* Wall Texture Selector Header */}
            {wallTextureOpen && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs text-slate-500">اختر النسيج المطلوب</span>
                <button
                  onClick={() => {
                    setWallTextureOpen(false);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 rounded hover:bg-slate-100"
                >
                  ✕ إلغاء
                </button>
              </div>
            )}
            
            {/* Floor Settings Button */}
            <DropdownMenuItem 
              onClick={() => {
                setFloorSettingsOpen(true);
                setSettingsOpen(false);
              }}
              className="cursor-pointer p-3 hover:bg-slate-100 rounded-lg mb-2"
            >
              <div className="flex items-center gap-3 w-full">
                <Palette className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">إعدادات الأرضية</p>
                  <p className="text-xs text-slate-500">تخصيص حجم ونسيج الأرضية</p>
                </div>
              </div>
            </DropdownMenuItem>

            {/* Wall Settings Button */}
            <DropdownMenuItem 
              onClick={() => {
                setWallSettingsOpen(true);
                setSettingsOpen(false);
              }}
              className="cursor-pointer p-3 hover:bg-slate-100 rounded-lg mb-3"
            >
              <div className="flex items-center gap-3 w-full">
                <Palette className="h-5 w-5 text-emerald-600" />
                <div className="flex-1">
                  <p className="font-semibold text-sm">إعدادات الجدران</p>
                  <p className="text-xs text-slate-500">تخصيص نسيج ولون جميع الجدران</p>
                </div>
              </div>
            </DropdownMenuItem>
            
            {!floorTextureOpen && !wallTextureOpen && (
              <>
                <DropdownMenuSeparator />
                
                <DropdownMenuItem onClick={handleExportDesign} className="cursor-pointer">
                  <Download className="h-4 w-4 ml-2" />
                  <span>تصدير التصميم</span>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleImportDesign} className="cursor-pointer">
                  <FileUp className="h-4 w-4 ml-2" />
                  <span>استيراد تصميم</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleResetDesign} className="cursor-pointer text-red-600 focus:text-red-600">
                  <RotateCcw className="h-4 w-4 ml-2" />
                  <span>إعادة تعيين للافتراضي</span>
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Hidden file inputs */}
        <input
          type="file"
          accept="application/json"
          className="hidden"
          ref={fileInputRef}
          onChange={handleImportLayout}
        />
        <input
          type="file"
          accept="application/json"
          className="hidden"
          ref={importFileRef}
          onChange={handleImportDesignFile}
        />

        {/* Preview Modal */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b" style={{ borderColor: primaryColor }}>
              <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                <Eye className="h-5 w-5" style={{ color: primaryColor }} />
                معاينة الصورة
              </DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-auto p-6 flex items-center justify-center bg-slate-50">
              {previewImage && (
                <img 
                  src={previewImage} 
                  alt="Preview" 
                  className="max-w-full max-h-full rounded-lg shadow-xl border-2"
                  style={{ borderColor: primaryColor }}
                />
              )}
            </div>

            <DialogFooter className="px-6 py-4 border-t bg-white flex gap-3" style={{ borderColor: primaryColor }}>
              <Button
                variant="outline"
                className="flex items-center gap-2"
                style={{
                  borderColor: primaryColor,
                  color: primaryColor,
                }}
                onClick={() => setPreviewOpen(false)}
              >
                إغلاق
              </Button>
              
              <Button
                className="flex items-center gap-2 text-white"
                style={{ background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` }}
                onClick={() => {
                  const link = document.createElement('a');
                  link.href = previewImage || '';
                  link.download = `shop-builder-${Date.now()}.png`;
                  link.click();
                }}
              >
                <Download className="h-4 w-4" />
                تحميل
              </Button>

              <Button
                className="flex items-center gap-2 text-white"
                style={{ background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}
                onClick={() => {
                  const printWindow = window.open('', '', 'width=800,height=600');
                  if (printWindow) {
                    printWindow.document.write(`
                      <html>
                        <head>
                          <title>طباعة التصميم</title>
                          <style>
                            body { margin: 0; padding: 20px; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f8fafc; }
                            img { max-width: 100%; height: auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1); border-radius: 8px; }
                            @media print { body { background: white; } }
                          </style>
                        </head>
                        <body>
                          <img src="${previewImage}" alt="Print" />
                          <script>window.print(); window.close();</script>
                        </body>
                      </html>
                    `);
                    printWindow.document.close();
                  }
                }}
              >
                <Printer className="h-4 w-4" />
                طباعة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

export default BuilderToolbar;
