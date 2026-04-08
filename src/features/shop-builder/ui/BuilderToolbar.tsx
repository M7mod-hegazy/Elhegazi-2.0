import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Ruler, Rotate3D, Scan, Save, Upload, Search, Package, Eye, EyeOff, SlidersHorizontal, Grid3x3, List, ChevronLeft, ChevronRight, TrendingUp, Star, Clock, Settings, Download, FileUp, RotateCcw, X, Palette, Edit2, Printer, LogOut, Camera } from 'lucide-react';
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
import { generateAutoHungProductsList } from '../three/proceduralProducts';

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
import { useNavigate } from 'react-router-dom';

interface BuilderToolbarProps {
  transformMode: TransformMode;
  onTransformModeChange: (mode: TransformMode) => void;
  onResetCamera: () => void;
  onSnapshot: () => void;
  onFullscreen: () => void;
  onClearSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
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

const formatMeters = (value: unknown): string => {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  const rounded = Math.round(n * 100) / 100;
  return rounded.toFixed(2).replace(/\.00$/, '').replace(/(\.\d)0$/, '$1');
};

const BuilderToolbar: React.FC<BuilderToolbarProps> = ({
  transformMode,
  onTransformModeChange,
  onResetCamera,
  onSnapshot,
  onFullscreen,
  onClearSelection,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryColor, secondaryColor } = useTheme();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const importFileRef = useRef<HTMLInputElement | null>(null);
  const {
    layout,
    setProducts,
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
  const [hangProductsOpen, setHangProductsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [isAutoHanging, setIsAutoHanging] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [quitDialogOpen, setQuitDialogOpen] = useState(false);
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
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const addProductLockRef = useRef(false);
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
  const floorSideMeters = layout.floorSize || 24;
  const floorAreaSquareMeters = Number((floorSideMeters * floorSideMeters).toFixed(2));

  const formatProductDims = useCallback(
    (product: Product3D) =>
      `${formatMeters(product.dimensions.width)} x ${formatMeters(product.dimensions.height)} x ${formatMeters(product.dimensions.depth)} m`,
    []
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


        setProducts3D(response.items as unknown as Product3D[]);
      } else {
        console.error('âŒ Failed to fetch products:', response);
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


    setSearchTerm(value);

    if (value.trim().length >= 2) {
      // Filter products for suggestions
      const filtered = products3D.filter(p =>
        p.name.toLowerCase().includes(value.toLowerCase()) ||
        p.nameEn?.toLowerCase().includes(value.toLowerCase()) ||
        p.tags?.some(tag => tag.toLowerCase().includes(value.toLowerCase())) ||
        p.category.toLowerCase().includes(value.toLowerCase())
      ).slice(0, 5);


      setSearchSuggestions(filtered);
      setShowSuggestions(true);

    } else if (value.trim().length === 0) {
      // When search is cleared, show recommendations again

      setSearchSuggestions([]);
      loadRecommendations();
      setShowSuggestions(true);
    } else {

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
      color: layout.defaultWallColor || '#ffffff',
    });
    selectWall(id);
    toast({ title: 'تم إضافة جدار جديد', description: 'يمكنك سحب أطرافه لتغيير الأبعاد.' });
  }, [layout.walls.length, layout.defaultWallColor, selectWall, toast, upsertWall]);
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

  const handleQuitSessionClick = useCallback(() => {
    setSettingsOpen(false);
    setQuitDialogOpen(true);
  }, []);

  const handleConfirmQuitSession = useCallback(() => {
    setQuitDialogOpen(false);
    navigate('/shop-builder/intro', { replace: true });
  }, [navigate]);

  const handleQuitWithSave = useCallback(() => {
    exportToFile();
    toast({ title: 'تم حفظ نسخة من التصميم قبل الخروج' });
    setQuitDialogOpen(false);
    navigate('/shop-builder/intro', { replace: true });
  }, [exportToFile, navigate, toast]);

  const handleQuitSessionSnapshot = useCallback(() => {
    onSnapshot();
  }, [onSnapshot]);

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

  const getModelPath = useCallback((modelUrl: string) => {
    try {
      return new URL(modelUrl, window.location.origin).pathname.toLowerCase();
    } catch {
      return modelUrl.toLowerCase();
    }
  }, []);

  const estimateFootprint = useCallback((candidate: Product3D | { scale?: { x: number; z: number } }) => {
    if ('dimensions' in candidate && candidate.dimensions) {
      return {
        width: Math.max(0.9, candidate.dimensions.width || 1),
        depth: Math.max(0.9, candidate.dimensions.depth || 1),
      };
    }
    return {
      width: Math.max(0.9, candidate.scale?.x || 1),
      depth: Math.max(0.9, candidate.scale?.z || 1),
    };
  }, []);

  const findSpawnPosition = useCallback((candidate: Product3D) => {
    const nextSize = estimateFootprint(candidate);
    const spacing = Math.max(nextSize.width, nextSize.depth) + 0.8;
    const maxRing = 9;

    const cells: Array<{ x: number; z: number }> = [{ x: 0, z: 0 }];
    for (let r = 1; r <= maxRing; r++) {
      for (let cx = -r; cx <= r; cx++) {
        cells.push({ x: cx * spacing, z: r * spacing });
        cells.push({ x: cx * spacing, z: -r * spacing });
      }
      for (let cz = -r + 1; cz <= r - 1; cz++) {
        cells.push({ x: r * spacing, z: cz * spacing });
        cells.push({ x: -r * spacing, z: cz * spacing });
      }
    }

    for (const cell of cells) {
      const hasCollision = layout.products.some((existing) => {
        const currentSize = estimateFootprint(existing);
        const minX = (nextSize.width + currentSize.width) * 0.5 + 0.35;
        const minZ = (nextSize.depth + currentSize.depth) * 0.5 + 0.35;
        return (
          Math.abs((existing.position?.x || 0) - cell.x) < minX &&
          Math.abs((existing.position?.z || 0) - cell.z) < minZ
        );
      });

      if (!hasCollision) {
        return { x: cell.x, y: 0.5, z: cell.z };
      }
    }

    return { x: 0, y: 0.5, z: layout.products.length * 1.4 };
  }, [estimateFootprint, layout.products]);

  const handleAddProduct = useCallback(async (product: Product3D) => {
    if (addProductLockRef.current || isAdding) return;

    addProductLockRef.current = true;
    setIsAdding(true);
    setAddingProductId(product._id);

    try {
      if (!product.modelUrl || product.modelUrl.trim() === '') {
        toast({
          title: 'خطأ',
          description: 'هذا المنتج لا يحتوي على نموذج ثلاثي الأبعاد',
          variant: 'destructive'
        });
        return;
      }

      const modelPath = getModelPath(product.modelUrl);
      const hasValidFormat = /\.(glb|gltf|obj|fbx)$/i.test(modelPath);
      if (!hasValidFormat) {
        toast({
          title: 'خطأ',
          description: 'صيغة النموذج غير مدعومة. استخدم GLB أو GLTF أو OBJ أو FBX',
          variant: 'destructive'
        });
        return;
      }

      // Fire-and-forget analytics call. Insertion should not fail if this endpoint is down.
      apiPostJson(`/api/products-3d/${product._id}/use`, {}).catch((error) => {
        console.warn('Usage counter failed:', error);
      });

      const spawnPosition = findSpawnPosition(product);
      const id = upsertProduct({
        name: product.name,
        modelUrl: product.modelUrl,
        position: spawnPosition,
        rotation: { x: 0, y: 0, z: 0 },
        scale: product.defaultScale,
        metadata: {
          thumbnailUrl: product.thumbnailUrl,
          category: product.category,
          description: product.description,
          dimensions: product.dimensions,
          material: product.material,
          color: product.color,
        }
      });

      // Ensure product controls open immediately after insertion.
      selectWall(null);
      selectColumn(null);
      selectProduct(id);
      setAddProductOpen(false);
      toast({ title: 'تمت الإضافة', description: `${product.name} جاهز الآن داخل المشهد` });
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ title: 'خطأ', description: 'فشل إضافة المنتج', variant: 'destructive' });
    } finally {
      setIsAdding(false);
      setAddingProductId(null);
      addProductLockRef.current = false;
    }
  }, [findSpawnPosition, getModelPath, isAdding, selectColumn, selectProduct, selectWall, toast, upsertProduct]);

  const hangableAccessoriesCount = useMemo(() => {
    return layout.walls.reduce((count, wall) => {
      const slatSystems = wall.slatWalls || [];
      const primoSystems = (wall.primoStands as any[] | undefined) || [];
      const allSystems = [...slatSystems, ...primoSystems];
      return count + allSystems.reduce((sum, sys: any) => sum + ((sys.accessories || []).length || 0), 0);
    }, 0);
  }, [layout.walls]);
  const autoHungProductsCount = useMemo(
    () => layout.products.filter((p) => !!(p.metadata as any)?.autoHangFill).length,
    [layout.products]
  );
  const hiddenAutoHungProductsCount = useMemo(
    () => layout.products.filter((p) => !!(p.metadata as any)?.autoHangFill && !!(p.metadata as any)?.hiddenByGlobalToggle).length,
    [layout.products]
  );
  const hasAutoHungProducts = autoHungProductsCount > 0;
  const isAutoHungHidden = hasAutoHungProducts && hiddenAutoHungProductsCount === autoHungProductsCount;

  const toWorldFromSlatLocal = useCallback((wall: any, slat: any, localX: number, localY: number, localZ: number) => {
    const start = { x: wall.start.x, z: wall.start.y };
    const end = { x: wall.end.x, z: wall.end.y };
    const dx = end.x - start.x;
    const dz = end.z - start.z;
    const wallLength = Math.max(0.001, Math.hypot(dx, dz));
    const wallDir = { x: dx / wallLength, z: dz / wallLength };
    const perp = { x: -wallDir.z, z: wallDir.x };

    const slatHeight = slat.height || 2;
    const slatPosCenter = slat.fillType === 'full' ? 0.5 : (slat.position || 0.5);
    const sideMultiplier = slat.side === 'front' ? 1 : -1;
    const offsetDist = ((wall.thickness || 0.1) / 2 + 0.01) * sideMultiplier;
    const basePos = {
      x: start.x + dx * slatPosCenter,
      z: start.z + dz * slatPosCenter,
    };
    const groupPos = {
      x: basePos.x + perp.x * offsetDist,
      y: (slat.bottomOffset || 0) + slatHeight / 2,
      z: basePos.z + perp.z * offsetDist,
    };

    const angle = Math.atan2(dz, dx);
    const rotY = -angle + (slat.side === 'back' ? Math.PI : 0);
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);

    // Standard THREE.js Y-axis rotation: local -> world
    const xRot = localX * cos + localZ * sin;
    const zRot = -localX * sin + localZ * cos;

    return {
      x: groupPos.x + xRot,
      y: groupPos.y + localY,
      z: groupPos.z + zRot,
      rotY,
    };
  }, []);

  const clearAutoHungProducts = useCallback(() => {
    const remaining = layout.products.filter((p) => !(p.metadata as any)?.autoHangFill);
    const removedCount = layout.products.length - remaining.length;
    setProducts(remaining);
    toast({
      title: 'تم تنظيف المنتجات التلقائية',
      description: removedCount > 0 ? `تم حذف ${removedCount} منتج مولد تلقائيًا` : 'لا يوجد منتجات تلقائية للحذف',
    });
  }, [layout.products, setProducts, toast]);

  const toggleAutoHungProductsVisibility = useCallback(() => {
    if (!hasAutoHungProducts) {
      toast({
        title: 'لا توجد منتجات معلقة',
        description: 'قم بتوليد المنتجات المعلقة أولاً ثم جرّب الإظهار/الإخفاء.',
      });
      return;
    }

    const nextHidden = !isAutoHungHidden;
    const updatedProducts = layout.products.map((product) => {
      if (!(product.metadata as any)?.autoHangFill) return product;
      return {
        ...product,
        metadata: {
          ...(product.metadata || {}),
          hiddenByGlobalToggle: nextHidden,
        },
      };
    });
    setProducts(updatedProducts);

    if (nextHidden && selectedProductId) {
      const selectedProduct = layout.products.find((p) => p.id === selectedProductId);
      if ((selectedProduct?.metadata as any)?.autoHangFill) {
        selectProduct(null);
      }
    }

    toast({
      title: nextHidden ? 'تم إخفاء المنتجات المعلقة' : 'تم إظهار المنتجات المعلقة',
      description: nextHidden
        ? `تم إخفاء ${autoHungProductsCount} منتج معلّق مؤقتًا.`
        : `تمت إعادة إظهار ${autoHungProductsCount} منتج معلّق.`,
    });
  }, [autoHungProductsCount, hasAutoHungProducts, isAutoHungHidden, layout.products, selectProduct, selectedProductId, setProducts, toast]);

  const generateAutoHungProducts = useCallback(async () => {
    if (isAutoHanging) return;
    setIsAutoHanging(true);
    try {
      const manualProducts = layout.products.filter((p) => !(p.metadata as any)?.autoHangFill);
      
      const generated = generateAutoHungProductsList(
        layout.walls,
        layout.products,
        toWorldFromSlatLocal,
        isAutoHungHidden
      );

      if (!generated.length) {
        toast({ title: 'لا توجد ملحقات صالحة', description: 'أضف ملحقات أولاً حتى يتم تعليق المنتجات تلقائيًا.' });
        return;
      }

      setProducts([...manualProducts, ...generated]);
      selectProduct(generated[0].id);
      toast({
        title: 'تم التعليق التلقائي بنجاح',
        description: `تم إضافة ${generated.length} شكل ثلاثي الأبعاد مولد محليًا على الملحقات.`,
      });
      setHangProductsOpen(false);
    } catch (error) {
      console.error('Auto hang generation failed:', error);
      toast({ title: 'فشل توليد الأشكال', description: 'حدث خطأ أثناء التوزيع التلقائي.', variant: 'destructive' });
    } finally {
      setIsAutoHanging(false);
    }
  }, [isAutoHanging, isAutoHungHidden, layout.products, layout.walls, selectProduct, setProducts, toast, toWorldFromSlatLocal]);

  const clearSelection = useCallback(() => {
    onClearSelection();
    toast({ title: 'تم إلغاء التحديد', description: 'لم يتم اختيار أي جدار أو منتج.' });
  }, [onClearSelection, toast]);

  return (
    <div
      className="w-full grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_auto] items-stretch 2xl:items-center gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-br from-white via-zinc-50/70 to-white px-2.5 sm:px-3.5 py-3 shadow-sm"
      style={{ boxShadow: `0 8px 28px -22px ${primaryColor}66` }}
    >
      {/* Right Side - Main Actions */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3 w-full">
        {/* Modern Wall System - Two buttons with divider */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-0 bg-white rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
          {/* Wall Mode / Quit Button */}
          <Button
            onClick={() => setDrawingMode(!isDrawingMode)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 font-bold text-base sm:text-sm rounded-none h-11 sm:h-11 px-5 transition-all duration-500 border-0"
            style={{
              background: isDrawingMode ? `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)` : 'white',
              color: isDrawingMode ? 'white' : primaryColor,
              boxShadow: isDrawingMode ? 'inset 0 2px 4px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            {isDrawingMode ? (
              <>
                <X className="h-5 w-5 sm:h-4 sm:w-4" />
                إنهاء وضع الرسم
              </>
            ) : (
              <>
                <Edit2 className="h-5 w-5 sm:h-4 sm:w-4" />
                وضع الرسم
              </>
            )}
          </Button>

          {/* Divider */}
          <div className="hidden sm:block w-px h-7 bg-zinc-200" />

          {/* Direct Wall Length Input */}
          <div className="flex items-center justify-center gap-2 bg-white px-3 py-2 sm:py-1 border-t sm:border-t-0 border-zinc-200">
            <span className="text-xs font-semibold text-zinc-600">الطول (م)</span>
            <Input
              type="number"
              placeholder="0.5"
              className="w-16 h-8 text-center text-sm border-zinc-300 text-zinc-900 placeholder-zinc-500 font-semibold"
              min="0.5"
              step="0.5"
            />
            <Button
              onClick={handleAddWall}
              size="sm"
              className="h-8 w-8 p-0 text-white transition-all hover:scale-105"
              style={{ background: `linear-gradient(135deg, ${secondaryColor} 0%, ${primaryColor} 100%)` }}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>


        <Dialog open={addProductOpen} onOpenChange={setAddProductOpen}>
          <DialogTrigger asChild>
            <Button className="group relative h-14 min-w-[250px] rounded-2xl overflow-hidden border-0 px-0 text-white shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,#0f172a_0%,#1d4ed8_45%,#0ea5e9_100%)]" />
              <div className="absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/20 blur-2xl transition-all duration-500 group-hover:left-2" />
              <div className="relative z-10 flex w-full items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1.5 ring-1 ring-white/30">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
                      <Package className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
                      <Plus className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <span className="text-right leading-tight">
                    <span className="block text-sm font-black">كتالوج المنتجات 3D</span>
                    <span className="block text-[11px] text-white/85">استعراض تفاعلي ثم إضافة فورية</span>
                  </span>
                </div>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black ring-1 ring-white/30">
                  OPEN
                </span>
              </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] w-[1400px] max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader className="px-6 pt-6 pb-4 border-b">
              <DialogTitle className="text-2xl font-bold">اختر منتج ثلاثي الأبعاد</DialogTitle>
            </DialogHeader>

            <div className="px-4 py-2.5 border-b bg-white">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-[11px] text-zinc-500">1. اختر النموذج</p>
                  <p className="text-xs font-bold text-zinc-800">استعرض البطاقات أو استخدم البحث</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-[11px] text-zinc-500">2. راجع التفاصيل</p>
                  <p className="text-xs font-bold text-zinc-800">معاينة تفاعلية + الأبعاد الكاملة</p>
                </div>
                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                  <p className="text-[11px] text-zinc-500">3. إضافة ذكية</p>
                  <p className="text-xs font-bold text-zinc-800">تموضع تلقائي يمنع التداخل</p>
                </div>
              </div>
            </div>

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
                                    <Badge className="bg-amber-500 text-[10px] px-1 py-0">â­ مميز</Badge>
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
                        ? "bg-zinc-900 text-white shadow-md"
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
                          ? "bg-zinc-900 text-white shadow-md"
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
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-4">
                        {sortedAndPaginatedProducts.items.map((product) => {
                          const isAddingThis = isAdding && addingProductId === product._id;
                          return (
                            <div
                              key={product._id}
                              className="group overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl"
                            >
                              <div className="relative h-44 overflow-hidden bg-zinc-50">
                                <div className="absolute inset-3 rounded-2xl border border-white/80 bg-white/55 backdrop-blur-sm shadow-inner" />
                                <div className="absolute inset-0 z-10 flex items-center justify-center p-4">
                                  <Model3DPreview
                                    modelUrl={product.modelUrl}
                                    thumbnailUrl={product.thumbnailUrl}
                                    className="h-full w-full max-h-[92%] max-w-[92%]"
                                    autoRotate
                                    showThumbnail={false}
                                  />
                                </div>
                                <div className="absolute right-2 top-2 z-20 flex items-center gap-1.5">
                                  {product.isPremium && (
                                    <Badge className="border-0 bg-amber-500 text-[10px] text-white">
                                      <Star className="h-3 w-3 ml-1" />
                                      مميز
                                    </Badge>
                                  )}
                                  {product.usageCount > 0 && (
                                    <Badge variant="secondary" className="border border-zinc-200 bg-white/95 text-[10px]">
                                      <TrendingUp className="ml-1 h-3 w-3 text-emerald-600" />
                                      {product.usageCount}
                                    </Badge>
                                  )}
                                </div>
                                <div className="absolute left-2 top-2 z-20 rounded-full border border-zinc-200 bg-white/95 px-2 py-1 text-[10px] font-bold text-zinc-700 max-w-[85%] truncate">
                                  {formatProductDims(product)}
                                </div>
                              </div>

                              <div className="space-y-3 bg-white p-3">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <h4 className="line-clamp-1 text-sm font-black text-zinc-900 transition-colors group-hover:text-zinc-900">{product.name}</h4>
                                    <p className="mt-0.5 line-clamp-1 text-[11px] text-zinc-500">{product.description || 'منتج جاهز للإضافة داخل المخطط'}</p>
                                  </div>
                                  <Badge variant="outline" className="h-6 shrink-0 rounded-full border-zinc-300 bg-zinc-50 px-2.5 text-[10px] text-zinc-700">
                                    {product.category}
                                  </Badge>
                                </div>

                                <div className="grid grid-cols-[1fr_1.2fr] gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-9 rounded-xl border-zinc-300 bg-white hover:border-zinc-500 hover:bg-zinc-50"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setPreviewProduct(product);
                                      setIsPreviewOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 ml-1" />
                                    معاينة
                                  </Button>
                                  <Button
                                    size="sm"
                                    disabled={isAdding}
                                    className="h-9 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 disabled:opacity-70 whitespace-nowrap px-3 min-w-0"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddProduct(product);
                                    }}
                                  >
                                    {isAddingThis ? (
                                      <>
                                        <div className="h-3.5 w-3.5 rounded-full border-2 border-white/40 border-t-white animate-spin ml-1" />
                                        جاري الإضافة
                                      </>
                                    ) : (
                                      <>
                                        <Plus className="ml-1 h-4 w-4" />
                                        إضافة
                                      </>
                                    )}
                                  </Button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      /* List View - Enhanced */
                      <div className="space-y-4">
                        {sortedAndPaginatedProducts.items.map((product) => (
                          <div key={product._id} className="group flex gap-5 rounded-2xl border border-zinc-200 bg-white p-4 transition-all hover:border-zinc-300 hover:shadow-xl">
                            <div className="h-32 w-32 flex-shrink-0 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-50 p-2">
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
                                <h4 className="text-lg font-black text-zinc-900 transition-colors group-hover:text-zinc-900">{product.name}</h4>
                                <p className="mt-2 line-clamp-2 text-sm text-zinc-600">{product.description || 'منتج ثلاثي الأبعاد عالي الجودة'}</p>
                                <div className="flex items-center gap-3 mt-3 flex-wrap">
                                  <Badge variant="secondary" className="text-sm border border-zinc-200 bg-zinc-100">{product.category}</Badge>
                                  {product.isPremium && <Badge className="bg-amber-500 text-sm"><Star className="h-3 w-3 mr-1" />مميز</Badge>}
                                  <span className="text-sm text-zinc-500">{formatProductDims(product)}</span>
                                  {product.usageCount > 0 && (
                                    <span className="text-sm text-zinc-500 flex items-center gap-1">
                                      <TrendingUp className="h-4 w-4" />
                                      استخدم {product.usageCount} مرة
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col gap-3 justify-center">
                              <Button size="default" variant="outline" className="rounded-xl border-zinc-300 hover:border-zinc-500" onClick={() => { setPreviewProduct(product); setIsPreviewOpen(true); }}>
                                <Eye className="h-4 w-4 ml-2" />
                                معاينة
                              </Button>
                              <Button size="default" disabled={isAdding} className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold whitespace-nowrap px-4" onClick={() => handleAddProduct(product)}>
                                {isAdding && addingProductId === product._id ? (
                                  <>
                                    <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin ml-2" />
                                    جاري الإضافة...
                                  </>
                                ) : (
                                  <>
                                    <Plus className="h-4 w-4 ml-2" />
                                    إضافة
                                  </>
                                )}
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
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col p-0">
            <DialogHeader>
              <div className="px-6 pt-6 pb-3 border-b bg-gradient-to-r from-zinc-50 to-white">
                <DialogTitle className="text-2xl font-black text-zinc-900">{previewProduct?.name}</DialogTitle>
                <DialogDescription className="text-zinc-500 mt-1">
                  معاينة تفاعلية كاملة قبل الإضافة مع تموضع ذكي داخل المشهد
                </DialogDescription>
              </div>
            </DialogHeader>

            {previewProduct && (
              <div className="overflow-y-auto flex-1 px-6 py-5">
                <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] gap-4">
                  <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-slate-100 via-zinc-100 to-slate-200 p-4 min-h-[360px] relative overflow-hidden">
                    <div className="absolute inset-4 rounded-2xl border border-white/70 bg-white/35 backdrop-blur-[1px]" />
                    <div className="relative z-10 h-full flex items-center justify-center">
                      <Model3DPreview
                        modelUrl={previewProduct.modelUrl}
                        thumbnailUrl={previewProduct.thumbnailUrl}
                        className="w-full h-full max-w-[92%] max-h-[92%]"
                        autoRotate
                        showThumbnail
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <p className="text-xs text-zinc-500 mb-1">الفئة</p>
                      <Badge variant="outline" className="mb-2">{previewProduct.category}</Badge>
                      <h4 className="text-lg font-black text-zinc-900">{previewProduct.name}</h4>
                      {previewProduct.nameEn && <p className="text-sm text-zinc-500">{previewProduct.nameEn}</p>}
                    </div>

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 space-y-3">
                      <p className="text-xs text-zinc-500">معلومات النموذج</p>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 py-2 px-1">
                          <p className="text-[11px] text-zinc-500">العرض</p>
                          <p className="text-sm font-black text-zinc-900">{formatMeters(previewProduct.dimensions.width)}م</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 py-2 px-1">
                          <p className="text-[11px] text-zinc-500">الارتفاع</p>
                          <p className="text-sm font-black text-zinc-900">{formatMeters(previewProduct.dimensions.height)}م</p>
                        </div>
                        <div className="rounded-xl bg-zinc-50 border border-zinc-200 py-2 px-1">
                          <p className="text-[11px] text-zinc-500">العمق</p>
                          <p className="text-sm font-black text-zinc-900">{formatMeters(previewProduct.dimensions.depth)}م</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <p className="text-zinc-500">المادة</p>
                          <p className="font-semibold text-zinc-800">{previewProduct.material || 'غير محدد'}</p>
                        </div>
                        <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <p className="text-zinc-500">اللون</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="h-4 w-4 rounded-md border border-zinc-300" style={{ backgroundColor: previewProduct.color || '#f4f4f5' }} />
                            <p className="font-semibold text-zinc-800">{previewProduct.color || 'افتراضي'}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {previewProduct.description && (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs text-zinc-500 mb-1">الوصف</p>
                        <p className="text-sm text-zinc-700 leading-relaxed">{previewProduct.description}</p>
                      </div>
                    )}

                    {previewProduct.tags && previewProduct.tags.length > 0 && (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <p className="text-xs text-zinc-500 mb-2">الوسوم</p>
                        <div className="flex flex-wrap gap-1.5">
                          {previewProduct.tags.map((tag, index) => (
                            <Badge key={index} variant="secondary">{tag}</Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <DialogFooter className="px-6 py-4 border-t bg-white flex items-center gap-2">
              <Button variant="outline" className="rounded-xl" onClick={() => setIsPreviewOpen(false)}>
                إغلاق
              </Button>
              <Button
                disabled={isAdding}
                onClick={() => {
                  if (previewProduct) {
                    handleAddProduct(previewProduct);
                    setIsPreviewOpen(false);
                  }
                }}
                className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 font-semibold whitespace-nowrap px-4"
              >
                {isAdding && addingProductId === previewProduct?._id ? (
                  <>
                    <div className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin ml-2" />
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 ml-2" />
                    إضافة إلى المشهد
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={hangProductsOpen} onOpenChange={setHangProductsOpen}>
          <DialogTrigger asChild>
            <Button className="group relative h-14 min-w-[230px] rounded-2xl overflow-hidden border-0 px-0 text-white shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5">
              <div className="absolute inset-0 bg-[linear-gradient(120deg,#14532d_0%,#059669_50%,#14b8a6_100%)]" />
              <div className="absolute -left-8 top-1/2 h-24 w-24 -translate-y-1/2 rounded-full bg-white/20 blur-2xl transition-all duration-500 group-hover:left-2" />
              <div className="relative z-10 flex w-full items-center justify-between px-4">
                <div className="flex items-center gap-3">
                  <div className="grid grid-cols-2 gap-1 rounded-xl bg-white/15 p-1.5 ring-1 ring-white/30">
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
                      <Package className="h-3.5 w-3.5" />
                    </span>
                    <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/20">
                      <Grid3x3 className="h-3.5 w-3.5" />
                    </span>
                  </div>
                  <span className="text-right leading-tight">
                    <span className="block text-sm font-black">تعليق المنتجات</span>
                    <span className="block text-[11px] text-white/85">إدارة عامة لكل الجدران والأوجه</span>
                  </span>
                </div>
                <span className="rounded-full bg-white/20 px-2.5 py-1 text-[10px] font-black ring-1 ring-white/30">
                  {isAutoHungHidden ? 'مخفي' : 'مرئي'}
                </span>
              </div>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-zinc-900">إدارة تعليق المنتجات على الملحقات</DialogTitle>
              <DialogDescription>
                هذا مدخل عام لكل الجدران وكل الأوجه. سنربط هنا قريبًا التوزيع الذكي والسعة والتوافق.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700 space-y-1">
              <p>الملحقات المتاحة حاليًا: <span className="font-black text-zinc-900">{hangableAccessoriesCount}</span></p>
              <p>سيتم إنشاء منتجات متعددة عشوائيًا لكل ملحق لتجربة عرض واقعية.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-center">
              <Button
                variant="outline"
                onClick={toggleAutoHungProductsVisibility}
                disabled={!hasAutoHungProducts}
                className={cn(
                  "h-10 font-bold rounded-xl justify-start gap-2",
                  isAutoHungHidden
                    ? "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    : "border-amber-300 text-amber-700 hover:bg-amber-50"
                )}
              >
                {isAutoHungHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                <span>{isAutoHungHidden ? 'إظهار المنتجات المعلقة' : 'إخفاء المنتجات المعلقة'}</span>
              </Button>
              <div className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs text-zinc-600 whitespace-nowrap">
                {hasAutoHungProducts
                  ? `الحالة: ${isAutoHungHidden ? 'مخفية' : 'مرئية'} (${hiddenAutoHungProductsCount}/${autoHungProductsCount} مخفي)`
                  : 'لا توجد منتجات معلّقة بعد'}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={clearAutoHungProducts}>تفريغ التوليد التلقائي</Button>
              <Button
                onClick={generateAutoHungProducts}
                disabled={isAutoHanging || hangableAccessoriesCount === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isAutoHanging ? 'جاري التوليد...' : 'توليد منتجات معلقة تلقائيًا'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Center - Wall Controls (only when wall selected) */}


      {/* Left Side - Utility Actions */}
      {/* Left Side - Utility Actions */}
      <div className="flex flex-row items-center gap-2 w-full sm:w-auto">
        <Button
          className="h-10 w-10 p-0 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 shadow-sm disabled:opacity-40"
          onClick={onUndo}
          disabled={!canUndo}
          title="تراجع"
        >
          <RotateCcw className="h-4 w-4" />
        </Button>

        <Button
          className="h-10 w-10 p-0 rounded-xl border border-zinc-200 bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 shadow-sm disabled:opacity-40"
          onClick={onRedo}
          disabled={!canRedo}
          title="إعادة"
        >
          <RotateCcw className="h-4 w-4 scale-x-[-1]" />
        </Button>

        <Button
          className="flex-1 sm:flex-none flex items-center justify-center gap-2 rounded-xl h-10 px-3 transition-all duration-300 font-medium disabled:opacity-50"
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
              <Camera className="h-4 w-4" />
              <span className="hidden sm:inline">حفظ صورة</span>
            </>
          )}
        </Button>

        {/* Floor Settings Dialog - Opened from Settings Dropdown */}
        <Dialog open={floorSettingsOpen} onOpenChange={setFloorSettingsOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold">
                {'\u0625\u0639\u062f\u0627\u062f\u0627\u062a \u0627\u0644\u0623\u0631\u0636\u064a\u0629'}
              </DialogTitle>
              <DialogDescription>
                {'\u062a\u062e\u0635\u064a\u0635 \u062d\u062c\u0645 \u0648\u0646\u0633\u064a\u062c \u0627\u0644\u0623\u0631\u0636\u064a\u0629'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-4 overflow-y-auto flex-1">
                            {/* Floor Size Control */}
              <div>
                <Label className="text-base font-semibold text-slate-900 mb-3 block">
                  {'\u0645\u0633\u0627\u062d\u0629 \u0627\u0644\u0623\u0631\u0636\u064a\u0629'}
                </Label>
                <div className="space-y-3">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-slate-600 w-28">{'\u0627\u0644\u0645\u0633\u0627\u062d\u0629 (\u0645\u00b2):'}</span>
                    <input
                      type="range"
                      min="12"
                      max="100"
                      step="4"
                      value={floorSideMeters}
                      onChange={(e) => setFloorSize(Number(e.target.value))}
                      className="flex-1 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <span className="text-lg font-bold text-primary w-24 text-center">
                      {floorAreaSquareMeters}{'\u0645\u00b2'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 pr-28">
                    {'\u0627\u0644\u0645\u0642\u064a\u0627\u0633 \u0645\u0648\u062d\u062f: \u0643\u0644 1\u0645 \u0641\u064a \u0627\u0644\u0623\u0631\u0636\u064a\u0629 \u064a\u0633\u0627\u0648\u064a 1\u0645 \u0641\u064a \u0627\u0644\u062c\u062f\u0627\u0631 \u0641\u064a \u0639\u0631\u0636 2D \u06483D.'}
                  </p>
                </div>
              </div>

              {/* Floor Texture Selector */}
              <div>
                <Label className="text-base font-semibold text-slate-900 mb-3 block">
                  {'\u0646\u0633\u064a\u062c \u0627\u0644\u0623\u0631\u0636\u064a\u0629'}
                </Label>
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
                        {key === 'tiles_black' && 'بلاط أسود'}
                        {key === 'tiles_checker' && 'شطرنج كلاسيكي'}
                        {key === 'wood_light' && 'خشب فاتح'}
                        {key === 'wood_dark' && 'خشب غامق'}
                        {key === 'wood_parquet' && 'باركيه خشبي'}
                        {key === 'marble_white' && 'رخام أبيض'}
                        {key === 'marble_black' && 'رخام أسود'}
                        {key === 'concrete' && 'خرسانة مصقولة'}
                        {key === 'terrazzo' && 'تيرازو ملوّن'}
                        {key === 'epoxy_grey' && 'إيبوكسي رمادي'}
                        {key === 'carpet_grey' && 'سجاد مكاتب'}
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
                          ? "border-primary bg-primary/10 shadow-md"
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
                    value={layout.defaultWallColor || '#ffffff'}
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
                    <p className="text-xs font-mono text-slate-600 mt-1">{layout.defaultWallColor || '#ffffff'}</p>
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
            <Button
              variant="outline"
              className="flex-1 sm:flex-none h-11 px-4 rounded-2xl border border-zinc-200 bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-50 hover:border-zinc-300 transition-all duration-200 shadow-sm hover:shadow-md"
            >
              <span className="flex items-center justify-center gap-2">
                <Settings className="h-4 w-4" />
                <span className="font-bold">الإعدادات</span>
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-[24rem] max-h-[72vh] overflow-y-auto p-2.5 rounded-2xl border border-zinc-200 bg-white/95 backdrop-blur-xl shadow-[0_24px_80px_-32px_rgba(0,0,0,0.45)]">
            <div className="px-2.5 pb-2 pt-1">
              <p className="text-sm font-black text-zinc-900">مركز الإعدادات</p>
              <p className="text-[11px] text-zinc-500">تحكم سريع في التخصيص والتصدير وإنهاء الجلسة</p>
            </div>

            {wallTextureOpen && (
              <div className="mb-2 flex items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-2">
                <span className="text-xs text-zinc-600">اختر النسيج المطلوب</span>
                <button
                  onClick={() => {
                    setWallTextureOpen(false);
                  }}
                  className="text-xs text-zinc-600 hover:text-zinc-900 px-2 py-1 rounded-lg hover:bg-white transition-colors"
                >
                  إلغاء
                </button>
              </div>
            )}

            <div className="space-y-1.5">
              <DropdownMenuItem
                onClick={() => {
                  setFloorSettingsOpen(true);
                  setSettingsOpen(false);
                }}
                className="group cursor-pointer p-3 rounded-xl border border-transparent hover:border-zinc-200 hover:bg-zinc-50/90 focus:bg-zinc-50 transition-all duration-200"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Palette className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-zinc-900">إعدادات الأرضية</p>
                    <p className="text-xs text-zinc-500">تخصيص الحجم والخامة</p>
                  </div>
                </div>
              </DropdownMenuItem>

              <DropdownMenuItem
                onClick={() => {
                  setWallSettingsOpen(true);
                  setSettingsOpen(false);
                }}
                className="group cursor-pointer p-3 rounded-xl border border-transparent hover:border-zinc-200 hover:bg-zinc-50/90 focus:bg-zinc-50 transition-all duration-200"
              >
                <div className="flex items-center gap-3 w-full">
                  <div className="h-9 w-9 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Palette className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-sm text-zinc-900">إعدادات الجدران</p>
                    <p className="text-xs text-zinc-500">تخصيص اللون والنسيج</p>
                  </div>
                </div>
              </DropdownMenuItem>
            </div>

            {!floorTextureOpen && !wallTextureOpen && (
              <>
                <DropdownMenuSeparator className="my-2" />
                <div className="space-y-1.5">
                  <DropdownMenuItem onClick={handleExportDesign} className="group cursor-pointer rounded-xl px-3 py-2.5 border border-transparent hover:border-zinc-200 hover:bg-zinc-50 focus:bg-zinc-50 transition-all">
                    <Download className="h-4 w-4 ml-2 text-zinc-500 group-hover:text-zinc-800" />
                    <span className="font-medium">تصدير التصميم</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleImportDesign} className="group cursor-pointer rounded-xl px-3 py-2.5 border border-transparent hover:border-zinc-200 hover:bg-zinc-50 focus:bg-zinc-50 transition-all">
                    <FileUp className="h-4 w-4 ml-2 text-zinc-500 group-hover:text-zinc-800" />
                    <span className="font-medium">استيراد تصميم</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleQuitSessionSnapshot} className="group cursor-pointer rounded-xl px-3 py-2.5 border border-transparent hover:border-zinc-200 hover:bg-zinc-50 focus:bg-zinc-50 transition-all">
                    <Camera className="h-4 w-4 ml-2 text-zinc-500 group-hover:text-zinc-800" />
                    <span className="font-medium">التقاط صورة سريعة</span>
                  </DropdownMenuItem>
                </div>

                <DropdownMenuSeparator className="my-2" />
                <div className="space-y-1.5">
                  <DropdownMenuItem onClick={handleResetDesign} className="cursor-pointer rounded-xl px-3 py-2.5 border border-transparent text-red-600 focus:text-red-600 hover:border-red-100 hover:bg-red-50 focus:bg-red-50 transition-all">
                    <RotateCcw className="h-4 w-4 ml-2" />
                    <span className="font-medium">إعادة تعيين للافتراضي</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleQuitSessionClick} className="cursor-pointer rounded-xl px-3 py-2.5 border border-transparent text-red-700 focus:text-red-700 hover:border-red-100 hover:bg-red-50 focus:bg-red-50 transition-all">
                    <LogOut className="h-4 w-4 ml-2" />
                    <span className="font-bold">إنهاء الجلسة</span>
                  </DropdownMenuItem>
                </div>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={quitDialogOpen} onOpenChange={setQuitDialogOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-black text-zinc-900">إنهاء الجلسة؟</DialogTitle>
              <DialogDescription className="text-zinc-600">
                اختر طريقة الخروج المناسبة قبل العودة لصفحة المقدمة.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
              تنبيه: "خروج مع حفظ" ينزّل نسخة JSON من المخطط الحالي على جهازك.
            </div>
            <DialogFooter className="flex gap-2 sm:justify-end">
              <Button variant="outline" onClick={() => setQuitDialogOpen(false)}>رجوع</Button>
              <Button variant="outline" onClick={handleConfirmQuitSession} className="gap-2">
                <LogOut className="h-4 w-4" />
                خروج بدون حفظ
              </Button>
              <Button onClick={handleQuitWithSave} className="gap-2 bg-red-600 hover:bg-red-700 text-white">
                <LogOut className="h-4 w-4" />
                خروج مع حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

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
                  if (!printWindow || !previewImage) return;

                  const escapedSrc = JSON.stringify(previewImage);
                  const html = `
                    <!doctype html>
                    <html dir="rtl">
                      <head>
                        <meta charset="utf-8" />
                        <title>طباعة التصميم</title>
                        <style>
                          @page { size: A4 portrait; margin: 10mm; }
                          html, body { margin: 0; padding: 0; background: #fff; }
                          .print-wrap {
                            width: 100%;
                            min-height: 100vh;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                          }
                          img {
                            display: block;
                            width: 100%;
                            height: auto;
                            max-height: calc(100vh - 20mm);
                            object-fit: contain;
                          }
                          @media print {
                            html, body { background: #fff !important; }
                            .print-wrap { min-height: auto; }
                          }
                        </style>
                      </head>
                      <body>
                        <div class="print-wrap">
                          <img id="print-image" alt="Preview for print" />
                        </div>
                        <script>
                          (function () {
                            const img = document.getElementById('print-image');
                            if (!img) return;
                            const doPrint = function () {
                              setTimeout(function () {
                                window.focus();
                                window.print();
                              }, 120);
                            };
                            window.onafterprint = function () {
                              setTimeout(function () { window.close(); }, 120);
                            };
                            img.onload = doPrint;
                            img.onerror = doPrint;
                            img.src = ${escapedSrc};
                          })();
                        </script>
                      </body>
                    </html>
                  `;
                  printWindow.document.open();
                  printWindow.document.write(html);
                  printWindow.document.close();
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
