import { useState, useEffect, useCallback, memo } from 'react';
import { Plus, Edit, Trash2, Search, Filter, Grid, List, Image, Star, Package, Eye, Download, TrendingUp, Tag, FileText, Link2, CheckCircle, Sparkles, Settings, Globe, FolderTree, ToggleLeft, ToggleRight } from 'lucide-react';
import { SelectionModal } from '@/components/admin/home-config/SelectionModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { LoadingSpinner } from '@/components/ui/loading';
import ImageUpload from '@/components/ui/image-upload';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import { apiGet, apiPostJson, apiPutJson, apiDelete } from '@/lib/api';
import { logHistory } from '@/lib/history';
import { useAutosave } from '@/hooks/useAutosave';
import type { Category } from '@/types';
import AdminLayout from '@/components/admin/AdminLayout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface BackendCategory {
  _id: string;
  name: string;
  nameAr: string;
  slug: string;
  description?: string;
  descriptionAr?: string;
  image?: string;
  featured?: boolean;
  productCount?: number;
  order?: number;
  categoryType?: 'product' | 'service' | 'digital' | 'physical';
  icon?: string;
  color?: string;
  parentCategory?: string;
  isActive?: boolean;
  showInMenu?: boolean;
  metaTitle?: string;
  metaDescription?: string;
  useRandomPreview?: boolean;
  previewProducts?: string[];
  createdAt?: string;
  updatedAt?: string;
};

interface Product {
  _id: string;
  name?: string;
  nameAr?: string;
  sku?: string;
  image?: string;
  category?: string;
  categoryId?: string;
  categorySlug?: string;
  price?: number;
}

type CategoriesListResponse = {
  ok: true;
  items: BackendCategory[];
  total: number;
  page: number;
  pages: number;
};

type CategoryItemResponse = { ok: true; item: BackendCategory };
interface CategoryFormData {
  nameAr: string;
  slug: string;
  descriptionAr: string;
  image: string;
  featured: boolean;
  previewProducts: string[]; // Array of product IDs for preview
}

const Categories = () => {
  // Set page title
  usePageTitle('إدارة الفئات');
  
  const { isMobile, isTablet } = useDeviceDetection();
  const [categoriesList, setCategoriesList] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);
  const [inlineProductSearch, setInlineProductSearch] = useState('');
  const [productsLoading, setProductsLoading] = useState(false);
  const [productsLoaded, setProductsLoaded] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<CategoryFormData>({
    nameAr: '',
    slug: '',
    descriptionAr: '',
    image: '',
    featured: false,
    previewProducts: []
  });
  const { toast } = useToast();

  // Monitor and enforce 3-product limit whenever previewProducts changes
  useEffect(() => {
    if (formData.previewProducts.length > 3) {
      console.warn('Detected more than 3 products, trimming to 3');
      setFormData(prev => ({
        ...prev,
        previewProducts: prev.previewProducts.slice(0, 3)
      }));
    }
  }, [formData.previewProducts]);

  // Lazy load products when product picker is opened
  const loadProductsLazily = useCallback(async () => {
    if (productsLoaded || productsLoading) return;
    
    setProductsLoading(true);
    try {
      const productsRes = await apiGet<any>('/api/products?limit=100&fields=_id,name,nameAr,sku,image,category,categoryId,categorySlug');
      if (productsRes && productsRes.ok && productsRes.items) {
        setAvailableProducts(productsRes.items as Product[]);
        setProductsLoaded(true);
        
      }
    } catch (error) {
      console.warn('Failed to load products for preview:', error);
      setAvailableProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [productsLoaded, productsLoading]);

  // Load products when editing category to enable product selection
  useEffect(() => {
    if (editingCategory && !productsLoaded) {
      loadProductsLazily();
    }
  }, [editingCategory, productsLoaded, loadProductsLazily]);

  const filteredCategories = categoriesList.filter(category =>
    category.nameAr.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Fetch categories and products from API
  useEffect(() => {
    const load = async () => {
      try {
        // Load categories
        const res = await apiGet<BackendCategory>('/api/categories');
        if (res && res.ok && res.items) {
          const items = res.items;
          const mapped: Category[] = items.map((c) => {
            console.log('📥 LOADING CATEGORY FROM API:', {
              id: c._id,
              name: c.nameAr,
              useRandomPreview: c.useRandomPreview,
              previewProducts: c.previewProducts,
              previewProductsLength: c.previewProducts?.length || 0
            });
            
            console.log('📥 RAW API CATEGORY DATA:', JSON.stringify({
              id: c._id,
              nameAr: c.nameAr,
              useRandomPreview: c.useRandomPreview,
              previewProducts: c.previewProducts
            }, null, 2));
            
            return {
              id: c._id,
              name: c.name,
              nameAr: c.nameAr,
              slug: c.slug,
              description: c.description || '',
              descriptionAr: c.descriptionAr || '',
              image: c.image || '',
              featured: !!c.featured,
              productCount: c.productCount ?? 0,
              order: c.order ?? 0,
              
              // Enhanced category features
              categoryType: c.categoryType || 'product',
              icon: c.icon || '',
              color: c.color || '#3B82F6',
              parentCategory: c.parentCategory || undefined,
              isActive: c.isActive !== undefined ? c.isActive : true,
              showInMenu: c.showInMenu !== undefined ? c.showInMenu : true,
              metaTitle: c.metaTitle || '',
              metaDescription: c.metaDescription || '',
              
              // Product preview settings
              useRandomPreview: c.useRandomPreview !== undefined ? c.useRandomPreview : false,
              previewProducts: c.previewProducts || [],
              
              createdAt: c.createdAt,
              updatedAt: c.updatedAt
            };
          });
          setCategoriesList(mapped);
          // audit: page load with count
          void logHistory({ section: 'categories', action: 'page_loaded', note: `Loaded categories`, meta: { count: mapped.length } });
        }

        // Products will be loaded lazily when needed
      } catch (e) {
        console.error('Failed to load data', e);
      }
    };
    load();
  }, []);

  const refetch = async () => {
    try {
      const res = await apiGet<BackendCategory>('/api/categories');
      if (res && res.ok && res.items) {
        const mapped: Category[] = res.items.map((c) => ({
          id: c._id,
          name: c.name,
          nameAr: c.nameAr,
          slug: c.slug,
          description: c.description || '',
          descriptionAr: c.descriptionAr || '',
          image: c.image || '',
          featured: !!c.featured,
          productCount: c.productCount ?? 0,
          order: c.order ?? 0,
          
          // Product preview settings - MISSING FIELDS ADDED!
          useRandomPreview: c.useRandomPreview !== undefined ? c.useRandomPreview : false,
          previewProducts: c.previewProducts || [],
          
          // Enhanced category features
          categoryType: c.categoryType || 'product',
          icon: c.icon || '',
          color: c.color || '#3B82F6',
          parentCategory: c.parentCategory || undefined,
          isActive: c.isActive !== undefined ? c.isActive : true,
          showInMenu: c.showInMenu !== undefined ? c.showInMenu : true,
          metaTitle: c.metaTitle || '',
          metaDescription: c.metaDescription || '',
          createdAt: c.createdAt,
          updatedAt: c.updatedAt
        }));
        setCategoriesList(mapped);
      }
    } catch (e) {
      console.error('Failed to refetch categories', e);
    }
  };

  const handleImageChange = (images: string[]) => {
    setFormData(prev => ({
      ...prev,
      image: images[0] || ''
    }));
  };

  // Product selection modal functions - filtered by category
  const getCategoryProducts = (category?: Category | null) => {
    const targetCategory = category || editingCategory;
    if (!targetCategory || !availableProducts.length) return [];
    
    // Filter products by current category
    return availableProducts.filter(product => 
      product.category === targetCategory.id || 
      product.categoryId === targetCategory.id ||
      product.categorySlug === targetCategory.slug
    );
  };

  const categoryProducts = getCategoryProducts(editingCategory);
  

  // Get random products for preview when useRandomPreview is true
  const getRandomProducts = (products: Product[], count: number = 3) => {
    if (products.length <= count) return products.map(p => p._id);
    
    const shuffled = [...products].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count).map(p => p._id);
  };


  const handleProductToggle = (productId: string) => {
    const currentProducts = formData.previewProducts;
    console.log('🔄 TOGGLING PRODUCT:', {
      productId,
      currentProducts,
      isSelected: currentProducts.includes(productId),
      currentCount: currentProducts.length
    });
    
    if (currentProducts.includes(productId)) {
      // Remove product
      const newProducts = currentProducts.filter(id => id !== productId);

      setFormData(prev => ({
        ...prev,
        previewProducts: newProducts
      }));
    } else if (currentProducts.length < 3) {
      // Add product only if under limit of 3
      const newProducts = [...currentProducts, productId];

      setFormData(prev => ({
        ...prev,
        previewProducts: newProducts
      }));
    } else {
      // Show toast when trying to select more than 3

      toast({
        title: "تحذير",
        description: "يمكن اختيار 3 منتجات كحد أقصى للمعاينة",
        variant: "destructive"
      });
    }
  };


  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  };

  const handleInputChange = (field: keyof CategoryFormData, value: string | boolean | string[]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const resetForm = () => {
    setFormData({
      nameAr: '',
      slug: '',
      descriptionAr: '',
      image: '',
      featured: false,
      previewProducts: [] // Always start with empty array
    });
    setEditingCategory(null);
    setShowForm(false);
  };

  const handleEdit = (category: Category) => {
    console.log('🔍 LOADING CATEGORY FOR EDIT:', {
      id: category.id,
      nameAr: category.nameAr,
      useRandomPreview: category.useRandomPreview,
      previewProducts: category.previewProducts,
      previewProductsLength: category.previewProducts?.length || 0,
      fullCategory: category
    });
    
    console.log('🔍 DETAILED CATEGORY DATA:', JSON.stringify({
      id: category.id,
      nameAr: category.nameAr,
      useRandomPreview: category.useRandomPreview,
      previewProducts: category.previewProducts
    }, null, 2));
    
    // Ensure we never load more than 3 products from existing data
    const existingProducts = category.previewProducts || [];
    const limitedProducts = existingProducts.slice(0, 3);
    
    console.log('📝 SETTING FORM DATA:', {
      nameAr: category.nameAr,
      previewProducts: limitedProducts,
      limitedProductsLength: limitedProducts.length,
      originalProducts: category.previewProducts,
      originalProductsLength: category.previewProducts?.length || 0
    });
    
    setFormData({
      nameAr: category.nameAr,
      slug: category.slug || '',
      descriptionAr: category.descriptionAr || '',
      image: category.image,
      featured: category.featured,
      previewProducts: limitedProducts
    });
    setEditingCategory(category);
    setShowForm(true);
    
    // Load products immediately when editing to show selected products correctly
    if (!productsLoaded) {
      loadProductsLazily();
    }
    
    
    // audit: open edit dialog
    void logHistory({ section: 'categories', action: 'edit_opened', note: `Opened edit for category ${category.id}`, meta: { id: category.id } });
  };

  // Debounced autosave when editing an existing category
  const saveEditedCategory = useCallback(
    async (quiet = true) => {
      if (!editingCategory) return;
      const payload = {
        nameAr: formData.nameAr,
        name: formData.nameAr, // Use Arabic name for English field too
        slug: formData.nameAr.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        descriptionAr: formData.descriptionAr || '',
        description: formData.descriptionAr || '', // Use Arabic description for English field too
        featured: formData.featured,
        image: formData.image,
        useRandomPreview: false, // Always false since we removed the choice
        previewProducts: formData.previewProducts,
      };
      if (!quiet) {
        console.log('Auto-saving category with preview settings:', {
          useRandomPreview: payload.useRandomPreview,
          previewProducts: payload.previewProducts
        });
      }
      const headers: Record<string, string> = {};
      const adminSecret = localStorage.getItem('ADMIN_SECRET');
      if (adminSecret) headers['x-admin-secret'] = adminSecret;
      try {
        await apiPutJson<CategoryItemResponse, typeof payload>(`/api/categories/${editingCategory.id}`, payload, headers);
        if (!quiet) {
          toast({ title: 'تم الحفظ', description: 'تم تحديث الفئة تلقائياً' });
        }
      } catch (error) {
        if (!quiet) {
          toast({ title: 'خطأ', description: 'تعذر حفظ التغييرات تلقائياً', variant: 'destructive' });
        }
      }
    },
    [editingCategory, formData, toast]
  );

  useAutosave(
    { formData, id: editingCategory?.id || null },
    saveEditedCategory,
    {
      delay: 1000,
      enabled: !!editingCategory,
      validate: (d) => !!editingCategory && !!d.formData.nameAr,
    }
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingCategory) {
        // Update existing category via API
        const payload = {
          nameAr: formData.nameAr,
          name: formData.nameAr, // Use Arabic name for English field too
          slug: formData.slug || generateSlug(formData.nameAr),
          descriptionAr: formData.descriptionAr || '',
          description: formData.descriptionAr || '', // Use Arabic description for English field too
          featured: formData.featured,
          image: formData.image,
          useRandomPreview: false, // Always false since we removed the choice
          previewProducts: formData.previewProducts,
        };



        
        const response = await apiPutJson<CategoryItemResponse, typeof payload>(`/api/categories/${editingCategory.id}`, payload);

        
        if (response && response.ok) {
          const item = (response as any).item;
          console.log('📦 Saved category data from API:', {
            id: item._id,
            previewProducts: item.previewProducts,
            useRandomPreview: item.useRandomPreview
          });
        }
        
        // Update local state immediately
        setCategoriesList(prev => prev.map(cat => 
          cat.id === editingCategory.id 
            ? { ...cat, ...payload, id: editingCategory.id }
            : cat
        ));
        
        await refetch();

        toast({
          title: "تم التحديث بنجاح",
          description: "تم تحديث الفئة بنجاح",
        });
        // audit: category updated
        void logHistory({ section: 'categories', action: 'category_updated', note: `Updated category ${editingCategory.id}`, meta: { id: editingCategory.id, nameAr: formData.nameAr, featured: formData.featured } });
      } else {
        // Add new category via API
        const nextOrder = categoriesList.length
          ? Math.max(...categoriesList.map(c => c.order)) + 1
          : 1;
        const payload = {
          nameAr: formData.nameAr,
          name: formData.nameAr, // Use Arabic name for English field too
          slug: formData.slug || generateSlug(formData.nameAr),
          descriptionAr: formData.descriptionAr || '',
          description: formData.descriptionAr || '', // Use Arabic description for English field too
          featured: formData.featured,
          image: formData.image,
          order: nextOrder,
          productCount: 0,
          useRandomPreview: false, // Always false since we removed the choice
          previewProducts: formData.previewProducts,
        };
        await apiPostJson<CategoryItemResponse, typeof payload>('/api/categories', payload);
        await refetch();
        toast({
          title: "تم الإضافة بنجاح",
          description: "تم إضافة الفئة الجديدة بنجاح",
        });
        // audit: category created
        void logHistory({ section: 'categories', action: 'category_created', note: `Created category ${formData.nameAr}`, meta: { nameAr: formData.nameAr, featured: formData.featured } });
      }

      resetForm();
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حفظ الفئة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (categoryId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذه الفئة؟')) return;

    setLoading(true);
    try {
      await apiDelete(`/api/categories/${categoryId}`);
      await refetch();
      toast({
        title: "تم الحذف بنجاح",
        description: "تم حذف الفئة بنجاح",
      });
      // audit: category deleted
      void logHistory({ section: 'categories', action: 'category_deleted', note: `Deleted category ${categoryId}`, meta: { id: categoryId } });
    } catch (error) {
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء حذف الفئة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Audit: search interactions (debounced logging)
  useEffect(() => {
    const t = window.setTimeout(() => {
      const term = searchTerm.trim();
      void logHistory({ section: 'categories', action: 'search', note: term ? `Search term: ${term}` : 'Search cleared', meta: { term } });
    }, 500);
    return () => window.clearTimeout(t);
  }, [searchTerm]);

  // Helper to open create dialog with audit log
  const openCreateForm = () => {
    setShowForm(true);
    void logHistory({ section: 'categories', action: 'create_opened', note: 'Opened create category dialog' });
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        {/* Enhanced Mobile-First Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              إدارة الفئات
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium mt-1 sm:mt-2">إدارة فئات المنتجات والتصنيفات</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className="flex-1 sm:flex-none bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 shadow-md text-xs sm:text-sm"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">تصدير الفئات</span>
              <span className="sm:hidden">تصدير</span>
            </Button>
            <Button 
              onClick={openCreateForm} 
              size={isMobile ? "sm" : "default"}
              className="flex-1 sm:flex-none bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary shadow-lg text-xs sm:text-sm"
            >
              <Plus className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">إضافة فئة جديدة</span>
              <span className="sm:hidden">إضافة</span>
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards - Mobile Responsive */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
          <div className="group bg-gradient-to-br from-primary/5 via-white to-primary/10 border border-primary/20 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-primary mb-1">إجمالي الفئات</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900">
                  {categoriesList.length.toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                  <TrendingUp className="w-3 h-3 text-green-500" />
                  +{((categoriesList.length / Math.max(categoriesList.length - 1, 1)) * 100 - 100).toFixed(1)}% هذا الشهر
                </p>
              </div>
              <div className="p-2 md:p-3 bg-primary/10 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Package className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-green-50 via-white to-green-50/30 border border-green-200/50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-green-600 mb-1">الفئات المميزة</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900">
                  {categoriesList.filter(c => c.featured).length}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  {((categoriesList.filter(c => c.featured).length / Math.max(categoriesList.length, 1)) * 100).toFixed(1)}% من إجمالي الفئات
                </p>
              </div>
              <div className="p-2 md:p-3 bg-green-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Star className="w-5 h-5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-purple-50 via-white to-purple-50/30 border border-purple-200/50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-purple-600 mb-1">إجمالي المنتجات</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900">
                  {categoriesList.reduce((sum, cat) => sum + cat.productCount, 0).toLocaleString()}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  في جميع الفئات
                </p>
              </div>
              <div className="p-2 md:p-3 bg-purple-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Eye className="w-5 h-5 md:w-6 md:h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="group bg-gradient-to-br from-orange-50 via-white to-orange-50/30 border border-orange-200/50 rounded-xl md:rounded-2xl p-4 md:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs md:text-sm font-medium text-orange-600 mb-1">متوسط المنتجات</p>
                <p className="text-2xl md:text-3xl font-black text-slate-900">
                  {categoriesList.length > 0 ? Math.round(categoriesList.reduce((sum, cat) => sum + cat.productCount, 0) / categoriesList.length) : 0}
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  منتج لكل فئة
                </p>
              </div>
              <div className="p-2 md:p-3 bg-orange-100 rounded-xl group-hover:scale-110 transition-transform duration-300">
                <Image className="w-5 h-5 md:w-6 md:h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Enhanced Search and Controls - Mobile Responsive */}
        <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-xl md:rounded-2xl shadow-lg p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex flex-col lg:flex-row gap-3 md:gap-4 items-stretch lg:items-center justify-between">
            <div className="flex-1 relative order-2 lg:order-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-primary w-4 h-4 md:w-5 md:h-5" />
              <Input
                placeholder="البحث في الفئات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 md:pr-12 h-10 md:h-12 bg-white/80 border-primary/20 focus:border-primary focus:ring-primary/20 shadow-md text-sm md:text-base"
              />
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-3 order-1 lg:order-2">
              <Button 
                variant="outline" 
                className="h-10 md:h-12 px-3 md:px-4 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 shadow-md text-xs md:text-sm"
              >
                <Filter className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                <span className="hidden sm:inline">تصفية</span>
                <span className="sm:hidden">فلتر</span>
              </Button>
              <div className="flex items-center bg-slate-100 rounded-lg p-1">
                <Button
                  size="sm"
                  variant={viewMode === 'grid' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('grid')}
                  className={`${viewMode === 'grid' ? 'bg-white shadow-md' : ''} text-xs md:text-sm px-2 md:px-3`}
                >
                  <Grid className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline ml-1">شبكة</span>
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === 'table' ? 'default' : 'ghost'}
                  onClick={() => setViewMode('table')}
                  className={`${viewMode === 'table' ? 'bg-white shadow-md' : ''} text-xs md:text-sm px-2 md:px-3`}
                >
                  <List className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline ml-1">جدول</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Revolutionary Mobile vs Desktop Categories Display */}
        {isMobile ? (
          <div className="space-y-4">
            {/* Mobile: Category Management Cards */}
            {filteredCategories.map((category) => (
              <div key={category.id} className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg overflow-hidden">
                {/* Mobile Category Header */}
                <div className="bg-gradient-to-r from-primary/5 to-secondary/5 p-4 border-b border-slate-200/50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {category.image ? (
                        <img 
                          src={optimizeImage(category.image || '', { w: 80 })} 
                          alt={category.nameAr}
                          className="w-12 h-12 object-cover rounded-xl border-2 border-white shadow-lg"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gradient-to-br from-slate-200 to-slate-300 rounded-xl flex items-center justify-center">
                          <Image className="w-6 h-6 text-slate-500" />
                        </div>
                      )}
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{category.nameAr}</h3>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      {category.featured && (
                        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-2 py-1 rounded-full text-xs font-bold shadow-md">
                          <Star className="w-3 h-3 inline mr-1" />
                          مميزة
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(category)}
                        className="bg-white hover:bg-primary/5 border-primary/20 text-primary shadow-md px-2"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Category Content */}
                <div className="p-4 space-y-3">
                  {/* Description */}
                  {(category.descriptionAr || category.description) && (
                    <div className="bg-slate-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <FileText className="w-4 h-4 text-slate-600" />
                        <span className="text-xs font-semibold text-slate-600">الوصف</span>
                      </div>
                      <div className="text-sm text-slate-700 leading-relaxed line-clamp-2">
                        {category.descriptionAr || category.description}
                      </div>
                    </div>
                  )}
                  
                  {/* Stats and Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 text-center">
                      <div className="text-lg font-bold text-primary">{category.productCount}</div>
                      <div className="text-xs text-primary">عدد المنتجات</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-3 text-center">
                      <div className="text-sm font-bold text-purple-800 truncate">{category.slug}</div>
                      <div className="text-xs text-purple-600">الرابط</div>
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-2 pt-3 border-t border-slate-200">
                    <Button
                      size="sm"
                      onClick={() => handleEdit(category)}
                      className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-xs h-8"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDelete(category.id)}
                      className="flex-1 bg-white hover:bg-red-50 border-red-200 text-red-700 text-xs h-8"
                    >
                      <Trash2 className="w-3 h-3 mr-1" />
                      حذف
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            
            {filteredCategories.length === 0 && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Package className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">لا توجد فئات</h3>
                <p className="text-slate-600 mb-4">قم بإضافة فئة جديدة لبدء تنظيم منتجاتك</p>
                <Button onClick={openCreateForm} className="bg-gradient-to-r from-primary to-secondary">
                  <Plus className="w-4 h-4 mr-2" />
                  إضافة فئة جديدة
                </Button>
              </div>
            )}
          </div>
        ) : (
          // Desktop: Original Layout Choice (Table or Grid)
          viewMode === 'table' ? (
            <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-xl md:rounded-2xl shadow-lg overflow-hidden">
              <div className="overflow-x-auto">
                <div className="min-w-[600px] md:min-w-0"> {/* Ensure minimum width for mobile horizontal scroll */}
                  <Table>
                    <TableHeader className="bg-gradient-to-r from-slate-100 via-blue-50/30 to-indigo-50/30">
                      <TableRow className="border-b-2 border-slate-200/50">
                        <TableHead className="text-right font-bold text-slate-700 text-xs md:text-sm">الاسم</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 text-xs md:text-sm hidden md:table-cell">الوصف</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 text-xs md:text-sm">عدد المنتجات</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 text-xs md:text-sm">الحالة</TableHead>
                        <TableHead className="text-right font-bold text-slate-700 text-xs md:text-sm">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCategories.map((category) => (
                        <TableRow key={category.id} className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 border-l-4 border-l-transparent hover:border-l-primary/30">
                          <TableCell>
                            <div className="flex items-center gap-2 md:gap-3">
                              {category.image && (
                                <img 
                                  src={optimizeImage(category.image || '', { w: 64 })} 
                                  alt={category.nameAr} 
                                  className="w-8 h-8 md:w-12 md:h-12 object-cover rounded-lg md:rounded-xl border-2 border-slate-200 shadow-md"
                                  loading="lazy"
                                  decoding="async"
                                  srcSet={buildSrcSet(category.image || '', 64)}
                                  sizes="64px"
                                />
                              )}
                              <div>
                                <div className="font-semibold text-slate-900 text-sm md:text-base">{category.nameAr}</div>
                                {/* Show description on mobile when table cell is hidden */}
                                <div className="md:hidden text-xs text-slate-600 mt-1 line-clamp-1">
                                  {category.descriptionAr}
                                </div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="max-w-xs">
                              <p className="text-sm text-slate-600 line-clamp-2">
                                {category.descriptionAr}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="font-medium text-xs md:text-sm">
                              {category.productCount} منتج
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {category.featured ? (
                              <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white border-0 shadow-md text-xs md:text-sm">
                                <Star className="w-2 h-2 md:w-3 md:h-3 mr-1" />
                                مميزة
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-slate-300 text-xs md:text-sm">عادية</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1 md:gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(category)}
                                className="bg-white hover:bg-primary/5 border-primary/20 text-primary shadow-md px-2 md:px-3 text-xs md:text-sm"
                              >
                                <Edit className="w-3 h-3 md:w-4 md:h-4 md:mr-2" />
                                <span className="hidden md:inline">تعديل</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(category.id)}
                                className="bg-white hover:bg-red-50 border-red-200 text-red-700 shadow-md px-2 md:px-3 text-xs md:text-sm"
                              >
                                <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredCategories.map((category) => (
                <div key={category.id} className="group bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 overflow-hidden">
                  <div className="relative">
                    {category.image ? (
                      <img 
                        src={optimizeImage(category.image || '', { w: 640 })} 
                        alt={category.nameAr}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                        decoding="async"
                        srcSet={buildSrcSet(category.image || '', 640)}
                        sizes="(max-width: 1024px) 90vw, 640px"
                      />
                    ) : (
                      <div className="w-full h-48 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                        <Image className="w-16 h-16 text-slate-400" />
                      </div>
                    )}
                    {category.featured && (
                      <div className="absolute top-3 right-3 bg-gradient-to-r from-yellow-500 to-yellow-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg">
                        <Star className="w-3 h-3 inline mr-1" />
                        مميزة
                      </div>
                    )}
                    <div className="absolute bottom-3 left-3">
                      <Badge className="bg-white/90 text-slate-700 border-0 shadow-md">
                        {category.productCount} منتج
                      </Badge>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="font-bold text-lg text-slate-900 mb-2 group-hover:text-primary transition-colors">
                      {category.nameAr}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-2 mb-4">
                      {category.descriptionAr || 'لا يوجد وصف'}
                    </p>
                    <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEdit(category)}
                          className="bg-white hover:bg-primary/5 border-primary/20 text-primary shadow-md"
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDelete(category.id)}
                          className="bg-white hover:bg-red-50 border-red-200 text-red-700 shadow-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      <Badge variant="outline" className="text-xs border-slate-300">
                        {category.slug}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <Dialog open={showForm} onOpenChange={setShowForm} modal={false}>
          <DialogContent
            className={isMobile 
              ? 'max-w-[95vw] w-[95vw] max-h-[90vh] overflow-y-auto bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 backdrop-blur-3xl border border-slate-200/30 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] rounded-3xl' 
              : 'max-w-4xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-white/95 via-white/90 to-slate-50/95 backdrop-blur-3xl border border-slate-200/30 shadow-[0_32px_64px_-12px_rgba(0,0,0,0.25)] rounded-3xl'}
            key={editingCategory ? String(editingCategory.id) : 'new'}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader className="border-b border-slate-200/30 pb-6">
              <DialogTitle className="text-3xl font-black bg-gradient-to-r from-primary via-purple-600 to-secondary bg-clip-text text-transparent flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-r from-primary via-purple-500 to-secondary rounded-2xl flex items-center justify-center shadow-xl">
                  {editingCategory ? <Edit className="w-6 h-6 text-white" /> : <Plus className="w-6 h-6 text-white" />}
                </div>
                {editingCategory ? 'تعديل الفئة' : 'إضافة فئة جديدة'}
              </DialogTitle>
              <DialogDescription className="text-lg text-slate-600 font-medium mt-2 mr-15">
                {editingCategory ? 'تعديل بيانات الفئة المحددة' : 'إضافة فئة جديدة لتنظيم المنتجات'}
              </DialogDescription>
            </DialogHeader>

            <CategoryForm 
              formData={formData}
              setFormData={setFormData}
              editingCategory={editingCategory}
              handleSubmit={handleSubmit}
              loading={loading}
              resetForm={resetForm}
              handleInputChange={handleInputChange}
              handleImageChange={handleImageChange}
              generateSlug={generateSlug}
              categoriesList={categoriesList}
              availableProducts={availableProducts}
              categoryProducts={categoryProducts}
              productsLoading={productsLoading}
              inlineProductSearch={inlineProductSearch}
              setInlineProductSearch={setInlineProductSearch}
              handleProductToggle={handleProductToggle}
            />
          </DialogContent>
        </Dialog>

      </div>
    </AdminLayout>
  );
};

// Ultra-Modern Category Form Component with glassmorphism effects
interface CategoryFormProps {
  formData: CategoryFormData;
  setFormData: React.Dispatch<React.SetStateAction<CategoryFormData>>;
  editingCategory: Category | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  loading: boolean;
  resetForm: () => void;
  handleInputChange: (field: keyof CategoryFormData, value: string | boolean | string[]) => void;
  handleImageChange: (images: string[]) => void;
  generateSlug: (name: string) => string;
  categoriesList: Category[];
  availableProducts: Product[];
  categoryProducts: Product[];
  productsLoading: boolean;
  inlineProductSearch: string;
  setInlineProductSearch: (search: string) => void;
  handleProductToggle: (productId: string) => void;
}

const CategoryForm = memo(function CategoryForm({ 
  formData, 
  setFormData, 
  editingCategory, 
  handleSubmit, 
  loading, 
  resetForm, 
  handleInputChange, 
  handleImageChange, 
  generateSlug,
  categoriesList,
  availableProducts,
  categoryProducts,
  productsLoading,
  inlineProductSearch,
  setInlineProductSearch,
  handleProductToggle
}: CategoryFormProps) {
  
  // Safety check to prevent rendering before data is loaded
  if (!formData) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex items-center gap-3 text-slate-600">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          جاري تحميل البيانات...
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Tag className="w-5 h-5 text-primary" />
          المعلومات الأساسية
        </h3>
        
        <div className="space-y-2">
          <Label htmlFor="nameAr" className="text-sm font-medium text-slate-700">
            اسم الفئة *
          </Label>
          <Input
            id="nameAr"
            value={formData.nameAr}
            onChange={(e) => {
              handleInputChange('nameAr', e.target.value);
              // Auto-generate slug if slug field is empty
              if (!formData.slug) {
                handleInputChange('slug', generateSlug(e.target.value));
              }
            }}
            placeholder="اكتب اسم الفئة"
            required
            className="h-11"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="slug" className="text-sm font-medium text-slate-700 flex items-center gap-2">
            <Link2 className="w-4 h-4" />
            الرابط (Slug) *
          </Label>
          <Input
            id="slug"
            value={formData.slug}
            onChange={(e) => handleInputChange('slug', e.target.value)}
            placeholder="category-slug"
            required
            className="h-11 font-mono text-sm"
            dir="ltr"
          />
          <p className="text-xs text-slate-500">
            الرابط المستخدم في URL الفئة. يجب أن يكون باللغة الإنجليزية ويحتوي على أحرف وأرقام وشرطات فقط.
          </p>
        </div>
      </div>

      {/* Descriptions */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" />
          الوصف
        </h3>
        
        <div className="space-y-2">
          <Label htmlFor="descriptionAr" className="text-sm font-medium text-slate-700">
            الوصف
          </Label>
          <textarea
            id="descriptionAr"
            value={formData.descriptionAr}
            onChange={(e) => handleInputChange('descriptionAr', e.target.value)}
            className="w-full p-3 border border-slate-300 rounded-lg resize-none h-24 focus:border-primary focus:ring-1 focus:ring-primary"
            placeholder="وصف مختصر للفئة..."
          />
        </div>
      </div>

      {/* Image Upload */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Image className="w-5 h-5 text-primary" />
          صورة الفئة
        </h3>
        
        <ImageUpload
          onImagesChange={handleImageChange}
          maxImages={1}
          multiple={false}
          initialImages={formData.image ? [formData.image] : []}
          className="rounded-lg border-2 border-dashed border-slate-300 hover:border-primary transition-colors"
        />
      </div>

      {/* Product Preview Settings */}
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <Package className="w-5 h-5 text-primary" />
          معاينة المنتجات في البطاقة
        </h3>
        
        <div className="space-y-6">
          {/* Category Products Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                منتجات هذه الفئة: {categoryProducts.length} منتج
              </span>
              {categoryProducts.length === 0 && (
                <span className="text-xs text-amber-600 bg-amber-100 px-2 py-1 rounded-full">
                  لا توجد منتجات في هذه الفئة
                </span>
              )}
              {categoryProducts.length > 0 && categoryProducts.length < 3 && (
                <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                  أقل من 3 منتجات متاحة
                </span>
              )}
            </div>
          </div>


          {/* Product Selection Interface */}
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm font-medium text-slate-700">
                  المنتجات المختارة ({formData.previewProducts.length}/3)
                </span>
              </div>

                {/* Inline Product Search */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <Input
                      placeholder="ابحث عن المنتجات في هذه الفئة..."
                      value={inlineProductSearch}
                      onChange={(e) => setInlineProductSearch(e.target.value)}
                      className="pr-10"
                    />
                  </div>
                  
                  {/* Product List - Always Visible */}
                  <div className="mt-2 max-h-48 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                    {availableProducts.filter(p => {
                      // Filter by category first
                      const inCategory = editingCategory ? (
                        p.category === editingCategory.id || 
                        p.categoryId === editingCategory.id ||
                        p.categorySlug === editingCategory.slug
                      ) : true;
                      
                      // Then filter by search if there's a search term
                      const matchesSearch = inlineProductSearch ? 
                        (p.nameAr || p.name || '').toLowerCase().includes(inlineProductSearch.toLowerCase()) : 
                        true;
                      
                      return inCategory && matchesSearch;
                    }).slice(0, 8).map((product) => (
                        <div
                          key={product._id}
                          className={`flex items-center gap-3 p-3 hover:bg-slate-50 cursor-pointer border-b last:border-b-0 ${
                            formData.previewProducts.includes(product._id) ? 'bg-blue-50' : ''
                          }`}
                          onClick={() => handleProductToggle(product._id)}
                        >
                          <div className="flex-shrink-0">
                            <input 
                              type="checkbox" 
                              checked={formData.previewProducts.includes(product._id)}
                              onChange={() => {}}
                              className="w-4 h-4"
                            />
                          </div>
                          {product.image && (
                            <img 
                              src={product.image} 
                              alt={product.nameAr || product.name}
                              className="w-10 h-10 object-cover rounded"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-900 truncate">
                              {product.nameAr || product.name}
                            </div>
                          </div>
                          {formData.previewProducts.includes(product._id) && (
                            <div className="text-xs text-blue-600 font-medium">
                              مختار
                            </div>
                          )}
                        </div>
                      ))}
                      
                      {availableProducts.filter(p => {
                        const inCategory = editingCategory ? (
                          p.category === editingCategory.id || 
                          p.categoryId === editingCategory.id ||
                          p.categorySlug === editingCategory.slug
                        ) : true;
                        
                        const matchesSearch = inlineProductSearch ? 
                          (p.nameAr || p.name || '').toLowerCase().includes(inlineProductSearch.toLowerCase()) : 
                          true;
                        
                        return inCategory && matchesSearch;
                      }).length === 0 && (
                        <div className="p-4 text-center text-slate-500 text-sm">
                          {inlineProductSearch ? 'لا توجد منتجات مطابقة للبحث' : 'لا توجد منتجات في هذه الفئة'}
                        </div>
                      )}
                    </div>
                </div>

                {formData.previewProducts.length === 0 ? (
                  <div className="text-center py-6 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">لم يتم اختيار منتجات بعد</p>
                    <p className="text-xs mt-1">ابحث أعلاه لإضافة منتجات للمعاينة</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {formData.previewProducts.slice(0, 3).map((productId, index) => {
                      const product = availableProducts.find(p => p._id === productId);
                      return (
                        <div key={productId} className="bg-white border border-slate-200 rounded-lg p-3 relative group">
                          {product ? (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center overflow-hidden">
                                {product.image ? (
                                  <img 
                                    src={product.image} 
                                    alt={product.nameAr || product.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <Package className="w-5 h-5 text-slate-400" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 truncate">
                                  {product.nameAr || product.name}
                                </p>
                                <p className="text-xs text-slate-500 truncate">{product.sku}</p>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                                <Package className="w-5 h-5 text-slate-400" />
                              </div>
                              <span className="text-sm text-slate-500">منتج غير موجود</span>
                            </div>
                          )}
                          
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const newProducts = formData.previewProducts.filter(id => id !== productId);
                              setFormData(prev => ({ ...prev, previewProducts: newProducts }));
                            }}
                            className="absolute -top-2 -right-2 h-6 w-6 p-0 bg-red-500 hover:bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Featured Category Toggle */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="featured"
                checked={formData.featured}
                onChange={(e) => handleInputChange('featured', e.target.checked)}
                className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
              />
              <Label htmlFor="featured" className="text-sm font-medium text-slate-700 cursor-pointer">
                فئة مميزة
              </Label>
            </div>
          </div>
        </div>

      {/* Form Actions */}
      <div className="flex gap-3 pt-6 border-t border-slate-200">
        <Button
          type="button"
          variant="outline"
          onClick={resetForm}
          disabled={loading}
          className="flex-1"
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          disabled={loading || !formData.nameAr}
          className="flex-1"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              جاري الحفظ...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {editingCategory ? (
                <>
                  <Edit className="w-4 h-4" />
                  تحديث الفئة
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  إضافة الفئة
                </>
              )}
            </span>
          )}
        </Button>
      </div>
    </form>
  );
});

export default Categories;
