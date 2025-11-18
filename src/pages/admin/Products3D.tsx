import React, { useState, useEffect } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { apiGet, apiPostJson, apiPutJson, apiDelete } from '@/lib/api';
import { Plus, Search, Edit, Trash2, Eye, Package, Filter, X, Copy, Download, CheckSquare, Star, TrendingUp, Settings, GripVertical, Sparkles, BarChart3, FolderTree } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { ProductAnalyticsModal } from '@/components/admin/ProductAnalyticsModal';
import { PNG3DConverter } from '@/components/admin/PNG3DConverter';
import { ShopBuilderDefaultsModal } from '@/components/admin/ShopBuilderDefaultsModal';

interface Product3D {
  _id: string;
  name: string;
  nameEn?: string;
  description: string;
  category: string;
  modelUrl: string;
  thumbnailUrl?: string;
  defaultScale: { x: number; y: number; z: number };
  defaultRotation: { x: number; y: number; z: number };
  dimensions: { width: number; height: number; depth: number };
  tags: string[];
  color: string;
  material: string;
  fileSize: number;
  format: 'glb' | 'gltf' | 'obj' | 'fbx';
  isActive: boolean;
  isPremium: boolean;
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

// Categories are now stored in MongoDB only

const Products3D = () => {
  usePageTitle('نماذج ثلاثية الأبعاد');
  const { toast } = useToast();

  // State
  const [products, setProducts] = useState<Product3D[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showActiveOnly, setShowActiveOnly] = useState(false);
  const [showPremiumOnly, setShowPremiumOnly] = useState(false);
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'usage' | 'size'>('date');
  
  // Bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [tagInput, setTagInput] = useState('');
  
  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product3D | null>(null);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [analyticsProduct, setAnalyticsProduct] = useState<Product3D | null>(null);
  const [isConverterOpen, setIsConverterOpen] = useState(false);
  const [isDefaultsModalOpen, setIsDefaultsModalOpen] = useState(false);
  
  // Category management (MongoDB)
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [isCategoryManagerOpen, setIsCategoryManagerOpen] = useState(false);
  const [editingCategoryIndex, setEditingCategoryIndex] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(false);
  
  // Upload progress
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    nameEn: '',
    description: '',
    category: 'أخرى',
    modelUrl: '',
    thumbnailUrl: '',
    defaultScale: { x: 1, y: 1, z: 1 },
    defaultRotation: { x: 0, y: 0, z: 0 },
    dimensions: { width: 1, height: 1, depth: 1 },
    tags: [] as string[],
    color: '#ffffff',
    material: 'none',
    fileSize: 0,
    format: 'glb' as 'glb' | 'gltf' | 'obj' | 'fbx',
    isActive: true,
    isPremium: false
  });

  // Fetch products
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (selectedCategory !== 'all') params.append('category', selectedCategory);
      if (showActiveOnly) params.append('isActive', 'true');
      if (showPremiumOnly) params.append('isPremium', 'true');
      params.append('sort', sortBy);

      const response = await apiGet<{ items: Product3D[] }>(`/api/products-3d?${params.toString()}`);
      if (response.ok && response.items) {
        setProducts(response.items as unknown as Product3D[]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, showActiveOnly, showPremiumOnly, sortBy]);

  // Load categories from MongoDB
  const fetchCategories = async () => {
    setLoadingCategories(true);
    try {
      const response = await apiGet<{ ok: boolean; categories: string[] }>('/api/products-3d-categories');
      if (response.ok && response.categories) {
        setCategories(response.categories);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoadingCategories(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  // Handle search
  const handleSearch = () => {
    fetchProducts();
  };

  // Handle add category
  const handleAddCategory = async () => {
    if (newCategoryName.trim()) {
      try {
        const updated = [...categories, newCategoryName.trim()];
        const response = await apiPostJson('/api/products-3d-categories', { categories: updated });
        if (response.ok) {
          setCategories(updated);
          setFormData({ ...formData, category: newCategoryName.trim() });
          setNewCategoryName('');
          setIsAddingCategory(false);
          toast({ title: 'نجح', description: 'تم إضافة الفئة بنجاح' });
        }
      } catch (error) {
        toast({ title: 'خطأ', description: 'فشل إضافة الفئة', variant: 'destructive' });
      }
    }
  };

  // Handle edit category
  const handleEditCategory = (index: number) => {
    setEditingCategoryIndex(index);
    setEditingCategoryName(categories[index]);
  };

  // Handle save edited category
  const handleSaveEditCategory = async () => {
    if (editingCategoryIndex !== null && editingCategoryName.trim()) {
      try {
        const updated = [...categories];
        const oldName = updated[editingCategoryIndex];
        updated[editingCategoryIndex] = editingCategoryName.trim();
        
        const response = await apiPostJson('/api/products-3d-categories', { categories: updated });
        if (response.ok) {
          setCategories(updated);
          
          // Update products that use this category
          if (formData.category === oldName) {
            setFormData({ ...formData, category: editingCategoryName.trim() });
          }
          
          setEditingCategoryIndex(null);
          setEditingCategoryName('');
          toast({ title: 'نجح', description: 'تم تحديث الفئة بنجاح' });
        }
      } catch (error) {
        toast({ title: 'خطأ', description: 'فشل تحديث الفئة', variant: 'destructive' });
      }
    }
  };

  // Handle delete category
  const handleDeleteCategory = async (index: number) => {
    if (confirm('هل أنت متأكد من حذف هذه الفئة؟')) {
      try {
        const updated = categories.filter((_, i) => i !== index);
        const response = await apiPostJson('/api/products-3d-categories', { categories: updated });
        if (response.ok) {
          setCategories(updated);
          toast({ title: 'نجح', description: 'تم حذف الفئة بنجاح' });
        }
      } catch (error) {
        toast({ title: 'خطأ', description: 'فشل حذف الفئة', variant: 'destructive' });
      }
    }
  };

  // Handle move category up
  const handleMoveCategoryUp = async (index: number) => {
    if (index > 0) {
      const updated = [...categories];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      try {
        const response = await apiPostJson('/api/products-3d-categories', { categories: updated });
        if (response.ok) {
          setCategories(updated);
        }
      } catch (error) {
        console.error('Error reordering:', error);
      }
    }
  };

  // Handle move category down
  const handleMoveCategoryDown = async (index: number) => {
    if (index < categories.length - 1) {
      const updated = [...categories];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      try {
        const response = await apiPostJson('/api/products-3d-categories', { categories: updated });
        if (response.ok) {
          setCategories(updated);
        }
      } catch (error) {
        console.error('Error reordering:', error);
      }
    }
  };

  // Handle file upload with progress
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);

    // Auto-detect format from file extension
    const fileName = file.name.toLowerCase();
    let detectedFormat: 'glb' | 'gltf' | 'obj' | 'fbx' = 'glb';
    if (fileName.endsWith('.gltf')) detectedFormat = 'gltf';
    else if (fileName.endsWith('.obj')) detectedFormat = 'obj';
    else if (fileName.endsWith('.fbx')) detectedFormat = 'fbx';

    try {
      // Create FormData for file upload
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);
      uploadFormData.append('type', '3d-model');

      // Use XMLHttpRequest for progress tracking
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      xhr.addEventListener('load', () => {
        if (xhr.status === 200) {
          try {
            const response = JSON.parse(xhr.responseText);
            // Update form with uploaded file URL, size, and auto-detected format
            setFormData(prev => ({ 
              ...prev, 
              modelUrl: response.url || response.fileUrl || '',
              fileSize: file.size,
              format: detectedFormat
            }));
            toast({ 
              title: 'نجح', 
              description: `تم رفع الملف بنجاح (${detectedFormat.toUpperCase()})` 
            });
          } catch (error) {
            console.error('Error parsing response:', error);
            toast({ title: 'خطأ', description: 'فشل معالجة الاستجابة', variant: 'destructive' });
          }
        } else {
          toast({ title: 'خطأ', description: `فشل الرفع: ${xhr.statusText}`, variant: 'destructive' });
        }
        setIsUploading(false);
        setUploadProgress(0);
      });

      xhr.addEventListener('error', () => {
        toast({ title: 'خطأ', description: 'فشل رفع الملف', variant: 'destructive' });
        setIsUploading(false);
        setUploadProgress(0);
      });

      // Send request to upload endpoint
      xhr.open('POST', '/api/upload-3d-model');
      xhr.send(uploadFormData);

    } catch (error) {
      console.error('Upload error:', error);
      setIsUploading(false);
      setUploadProgress(0);
      toast({ title: 'خطأ', description: 'فشل رفع الملف', variant: 'destructive' });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      nameEn: '',
      description: '',
      category: 'أخرى',
      modelUrl: '',
      thumbnailUrl: '',
      defaultScale: { x: 1, y: 1, z: 1 },
      defaultRotation: { x: 0, y: 0, z: 0 },
      dimensions: { width: 1, height: 1, depth: 1 },
      tags: [],
      color: '#ffffff',
      material: 'none',
      fileSize: 0,
      format: 'glb',
      isActive: true,
      isPremium: false
    });
  };

  // Handle add product
  const handleAddProduct = async () => {
    if (!formData.name || !formData.modelUrl) {
      toast({ title: 'خطأ', description: 'الرجاء إدخال الاسم ورابط النموذج', variant: 'destructive' });
      return;
    }

    try {
      const response = await apiPostJson('/api/products-3d', formData);
      if (response.ok) {
        toast({ title: 'نجح', description: 'تم إضافة النموذج بنجاح' });
        setIsAddModalOpen(false);
        resetForm();
        fetchProducts();
      }
    } catch (error) {
      console.error('Error adding product:', error);
      toast({ title: 'خطأ', description: 'فشل إضافة النموذج', variant: 'destructive' });
    }
  };

  // Handle edit product
  const handleEditProduct = async () => {
    if (!selectedProduct) return;

    try {
      const response = await apiPutJson(`/api/products-3d/${selectedProduct._id}`, formData);
      if (response.ok) {
        toast({ title: 'نجح', description: 'تم تحديث النموذج بنجاح' });
        setIsEditModalOpen(false);
        setSelectedProduct(null);
        resetForm();
        fetchProducts();
      }
    } catch (error) {
      console.error('Error updating product:', error);
      toast({ title: 'خطأ', description: 'فشل تحديث النموذج', variant: 'destructive' });
    }
  };

  // Handle delete product
  const handleDeleteProduct = async (id: string) => {
    const product = products.find(p => p._id === id);
    const usageWarning = product && product.usageCount > 0 
      ? `\n\n⚠️ تحذير: تم استخدام هذا النموذج ${product.usageCount} مرة في المشاريع.`
      : '';
    
    if (!confirm(`هل أنت متأكد من حذف هذا النموذج؟${usageWarning}`)) return;

    try {
      const response = await apiDelete(`/api/products-3d/${id}`);
      if (response.ok) {
        toast({ title: 'نجح', description: 'تم حذف النموذج بنجاح' });
        fetchProducts();
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      toast({ title: 'خطأ', description: 'فشل حذف النموذج', variant: 'destructive' });
    }
  };

  // Handle duplicate product
  const handleDuplicateProduct = async (product: Product3D) => {
    try {
      const duplicateData = {
        name: `${product.name} (نسخة)`,
        nameEn: product.nameEn ? `${product.nameEn} (Copy)` : '',
        description: product.description,
        category: product.category,
        modelUrl: product.modelUrl,
        thumbnailUrl: product.thumbnailUrl,
        defaultScale: product.defaultScale,
        defaultRotation: product.defaultRotation,
        dimensions: product.dimensions,
        tags: product.tags,
        color: product.color,
        material: product.material,
        fileSize: product.fileSize,
        format: product.format,
        isActive: false, // Start as inactive
        isPremium: product.isPremium
      };
      
      const response = await apiPostJson('/api/products-3d', duplicateData);
      if (response.ok) {
        toast({ title: 'نجح', description: 'تم نسخ النموذج بنجاح' });
        fetchProducts();
      }
    } catch (error) {
      console.error('Error duplicating product:', error);
      toast({ title: 'خطأ', description: 'فشل نسخ النموذج', variant: 'destructive' });
    }
  };

  // Bulk actions handlers
  const toggleSelectProduct = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length && products.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p._id)));
    }
  };

  const handleBulkActivate = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiPutJson(`/api/products-3d/${id}`, { isActive: true })
        )
      );
      toast({ title: 'نجح', description: `تم تفعيل ${selectedIds.size} نموذج` });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل تفعيل النماذج', variant: 'destructive' });
    }
  };

  const handleBulkDeactivate = async () => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiPutJson(`/api/products-3d/${id}`, { isActive: false })
        )
      );
      toast({ title: 'نجح', description: `تم إلغاء تفعيل ${selectedIds.size} نموذج` });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل إلغاء تفعيل النماذج', variant: 'destructive' });
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    
    // Calculate total usage
    const selectedProducts = products.filter(p => selectedIds.has(p._id));
    const totalUsage = selectedProducts.reduce((sum, p) => sum + p.usageCount, 0);
    const usageWarning = totalUsage > 0 ? `\n\n⚠️ تحذير: النماذج المحددة تم استخدامها ${totalUsage} مرة في المشاريع.` : '';
    
    if (!confirm(`هل أنت متأكد من حذف ${selectedIds.size} نموذج؟${usageWarning}`)) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id => apiDelete(`/api/products-3d/${id}`))
      );
      toast({ title: 'نجح', description: `تم حذف ${selectedIds.size} نموذج` });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل حذف النماذج', variant: 'destructive' });
    }
  };

  const handleBulkChangeCategory = async (newCategory: string) => {
    if (selectedIds.size === 0) return;
    
    try {
      await Promise.all(
        Array.from(selectedIds).map(id =>
          apiPutJson(`/api/products-3d/${id}`, { category: newCategory })
        )
      );
      toast({ title: 'نجح', description: `تم تغيير فئة ${selectedIds.size} نموذج إلى "${newCategory}"` });
      setSelectedIds(new Set());
      fetchProducts();
    } catch (error) {
      toast({ title: 'خطأ', description: 'فشل تغيير الفئة', variant: 'destructive' });
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Name', 'Category', 'Format', 'File Size', 'Usage Count', 'Status', 'Premium'];
    const rows = products.map(p => [
      p.name,
      p.category,
      p.format.toUpperCase(),
      formatFileSize(p.fileSize),
      p.usageCount.toString(),
      p.isActive ? 'Active' : 'Inactive',
      p.isPremium ? 'Yes' : 'No'
    ]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `3d-products-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    
    toast({ title: 'نجح', description: 'تم تصدير البيانات بنجاح' });
  };

  // Open edit modal
  const openEditModal = (product: Product3D) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      nameEn: product.nameEn || '',
      description: product.description,
      category: product.category,
      modelUrl: product.modelUrl,
      thumbnailUrl: product.thumbnailUrl || '',
      defaultScale: product.defaultScale,
      defaultRotation: product.defaultRotation,
      dimensions: product.dimensions,
      tags: product.tags,
      color: product.color,
      material: product.material,
      fileSize: product.fileSize,
      format: product.format,
      isActive: product.isActive,
      isPremium: product.isPremium
    });
    setIsEditModalOpen(true);
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Handle save from PNG converter
  const handleSaveFromConverter = async (modelData: {
    name: string;
    modelUrl: string;
    thumbnailUrl: string;
    fileSize: number;
  }) => {
    try {
      const newProduct = {
        name: modelData.name,
        nameEn: '',
        description: 'تم إنشاؤه من محول PNG إلى 3D',
        category: categories[0] || 'أخرى',
        modelUrl: modelData.modelUrl,
        thumbnailUrl: modelData.thumbnailUrl,
        defaultScale: { x: 1, y: 1, z: 1 },
        defaultRotation: { x: 0, y: 0, z: 0 },
        dimensions: { width: 1, height: 1, depth: 1 },
        tags: ['محول-png'],
        color: '#ffffff',
        material: 'none',
        fileSize: modelData.fileSize,
        format: 'glb' as const,
        isActive: true,
        isPremium: false
      };

      const response = await apiPostJson('/api/products-3d', newProduct);
      if (response.ok) {
        toast({ title: 'نجح', description: 'تم حفظ النموذج في قاعدة البيانات بنجاح' });
        fetchProducts();
      }
    } catch (error) {
      console.error('Error saving from converter:', error);
      toast({ title: 'خطأ', description: 'فشل حفظ النموذج', variant: 'destructive' });
    }
  };

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">نماذج ثلاثية الأبعاد</h1>
            <p className="text-slate-600 mt-1">إدارة النماذج ثلاثية الأبعاد للمتجر</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button onClick={() => setIsDefaultsModalOpen(true)} variant="outline" className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white hover:from-blue-600 hover:to-cyan-600 border-0">
              <Settings className="h-4 w-4 ml-2" />
              إعدادات المنشئ الافتراضية
            </Button>
            <Button onClick={() => setIsConverterOpen(true)} variant="outline" className="bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 border-0">
              <Sparkles className="h-4 w-4 ml-2" />
              محول PNG إلى 3D
            </Button>
            {products.length > 0 && (
              <Button onClick={handleExportCSV} variant="outline">
                <Download className="h-4 w-4 ml-2" />
                تصدير CSV
              </Button>
            )}
            <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="bg-primary hover:bg-primary/90">
              <Plus className="h-4 w-4 ml-2" />
              إضافة نموذج جديد
            </Button>
          </div>
        </div>

        {/* Bulk Actions Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-primary/10 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckSquare className="h-5 w-5 text-primary" />
              <span className="font-semibold text-slate-900">{selectedIds.size} نموذج محدد</span>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleBulkActivate}>
                تفعيل
              </Button>
              <Button size="sm" variant="outline" onClick={handleBulkDeactivate}>
                إلغاء التفعيل
              </Button>
              <Select onValueChange={handleBulkChangeCategory}>
                <SelectTrigger className="h-8 w-[140px]">
                  <SelectValue placeholder="تغيير الفئة" />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={5}>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
                <Trash2 className="h-4 w-4 ml-1" />
                حذف
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-4 items-end bg-white p-4 rounded-xl border border-slate-200">
          <div className="flex-1 min-w-[200px]">
            <Label>بحث</Label>
            <div className="flex gap-2 mt-1">
              <Input
                placeholder="ابحث عن نموذج..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <Button onClick={handleSearch} variant="outline">
                <Search className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="min-w-[180px]">
            <Label>الفئة</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={5}>
                <SelectItem value="all">الكل</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="min-w-[180px]">
            <Label>ترتيب حسب</Label>
            <Select value={sortBy} onValueChange={(value: 'name' | 'date' | 'usage' | 'size') => setSortBy(value)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={5}>
                <SelectItem value="date">الأحدث</SelectItem>
                <SelectItem value="name">الاسم</SelectItem>
                <SelectItem value="usage">الأكثر استخداماً</SelectItem>
                <SelectItem value="size">حجم الملف</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={showActiveOnly} onCheckedChange={setShowActiveOnly} />
            <Label>النشطة فقط</Label>
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={showPremiumOnly} onCheckedChange={setShowPremiumOnly} />
            <Label className="flex items-center gap-1">
              <Star className="h-4 w-4 text-amber-500" />
              المميزة فقط
            </Label>
          </div>

          {(searchTerm || selectedCategory !== 'all' || showActiveOnly || showPremiumOnly) && (
            <Button variant="ghost" onClick={() => { setSearchTerm(''); setSelectedCategory('all'); setShowActiveOnly(false); setShowPremiumOnly(false); }}>
              <X className="h-4 w-4 ml-2" />
              مسح الفلاتر
            </Button>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-xl border border-primary/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">إجمالي النماذج</p>
                <p className="text-2xl font-bold text-slate-900">{products.length}</p>
              </div>
              <Package className="h-8 w-8 text-primary" />
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 p-4 rounded-xl border border-emerald-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">النماذج النشطة</p>
                <p className="text-2xl font-bold text-slate-900">{products.filter(p => p.isActive).length}</p>
              </div>
              <Eye className="h-8 w-8 text-emerald-600" />
            </div>
          </div>
          <button 
            onClick={() => window.location.href = '/admin/models-3d-analytics'}
            className="bg-gradient-to-br from-amber-50 to-amber-100/50 p-4 rounded-xl border border-amber-200 hover:shadow-lg transition-all cursor-pointer text-right"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">لوحة التحليلات</p>
                <p className="text-2xl font-bold text-slate-900">{products.reduce((sum, p) => sum + p.usageCount, 0)}</p>
              </div>
              <BarChart3 className="h-8 w-8 text-amber-600" />
            </div>
          </button>
        </div>

        {/* Products Grid */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-slate-600 mt-4">جاري التحميل...</p>
          </div>
        ) : products.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <Package className="h-16 w-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-600">لا توجد نماذج</p>
            <Button onClick={() => { resetForm(); setIsAddModalOpen(true); }} className="mt-4" variant="outline">
              <Plus className="h-4 w-4 ml-2" />
              إضافة نموذج جديد
            </Button>
          </div>
        ) : (
          <>
            {/* Select All */}
            {products.length > 0 && (
              <div className="flex items-center gap-2 px-2">
                <Checkbox
                  checked={selectedIds.size === products.length && products.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
                <Label className="text-sm text-slate-600 cursor-pointer" onClick={toggleSelectAll}>
                  تحديد الكل ({products.length})
                </Label>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {products.map((product) => (
                <div key={product._id} className="bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow group">
                  {/* Thumbnail */}
                  <div className="aspect-square bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center relative overflow-hidden">
                    {/* Checkbox */}
                    <div className="absolute top-2 left-2 z-10">
                      <Checkbox
                        checked={selectedIds.has(product._id)}
                        onCheckedChange={() => toggleSelectProduct(product._id)}
                        className="bg-white"
                      />
                    </div>

                    {product.thumbnailUrl ? (
                      <img 
                        src={product.thumbnailUrl} 
                        alt={product.name} 
                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 group-hover:rotate-3" 
                      />
                    ) : (
                      <Package className="h-16 w-16 text-slate-400 transition-transform duration-700 group-hover:scale-110 group-hover:rotate-12" />
                    )}
                    {!product.isActive && (
                    <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                      <Badge variant="secondary">غير نشط</Badge>
                    </div>
                  )}
                  {product.isPremium && (
                    <Badge className="absolute top-2 right-2 bg-amber-500">Premium</Badge>
                  )}
                </div>

                {/* Content */}
                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-slate-900 truncate">{product.name}</h3>
                    {product.nameEn && <p className="text-xs text-slate-500 truncate">{product.nameEn}</p>}
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">{product.category}</Badge>
                    <Badge variant="outline" className="text-xs">{product.format.toUpperCase()}</Badge>
                  </div>

                  <div className="text-xs text-slate-600 space-y-1">
                    <p>الأبعاد: {product.dimensions.width}×{product.dimensions.height}×{product.dimensions.depth}م</p>
                    <p>الحجم: {formatFileSize(product.fileSize)}</p>
                    <p>الاستخدام: {product.usageCount} مرة</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => { setSelectedProduct(product); setIsPreviewModalOpen(true); }}>
                      <Eye className="h-3.5 w-3.5 ml-1" />
                      معاينة
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setAnalyticsProduct(product); setIsAnalyticsOpen(true); }} title="إحصائيات">
                      <TrendingUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openEditModal(product)} title="تعديل">
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleDuplicateProduct(product)} title="نسخ">
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteProduct(product._id)} title="حذف">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          </>
        )}

        {/* Add/Edit Modal */}
        <Dialog open={isAddModalOpen || isEditModalOpen} onOpenChange={(open) => { setIsAddModalOpen(open); setIsEditModalOpen(open); if (!open) resetForm(); }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEditModalOpen ? 'تعديل النموذج' : 'إضافة نموذج جديد'}</DialogTitle>
              <DialogDescription>
                {isEditModalOpen ? 'تعديل بيانات النموذج ثلاثي الأبعاد' : 'إضافة نموذج ثلاثي الأبعاد جديد إلى المكتبة'}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">الاسم (عربي) *</Label>
                  <Input id="name" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="ثلاجة عرض" />
                </div>
                <div>
                  <Label htmlFor="nameEn">الاسم (English)</Label>
                  <Input id="nameEn" value={formData.nameEn} onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })} placeholder="Display Fridge" />
                </div>
              </div>

              <div>
                <Label htmlFor="description">الوصف</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف النموذج..." rows={3} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label htmlFor="category">الفئة *</Label>
                    <Button 
                      type="button"
                      variant="ghost" 
                      size="sm"
                      onClick={() => setIsCategoryManagerOpen(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Settings className="h-3 w-3 ml-1" />
                      إدارة الفئات
                    </Button>
                  </div>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5} className="z-[9999]">
                      {categories.filter(cat => cat && cat.trim()).map(cat => (
                        <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                      ))}
                      <div className="p-2 border-t">
                        <Button 
                          type="button"
                          variant="outline" 
                          size="sm" 
                          className="w-full"
                          onClick={() => setIsAddingCategory(true)}
                        >
                          <Plus className="h-4 w-4 ml-2" />
                          إضافة فئة جديدة
                        </Button>
                      </div>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="format">صيغة الملف *</Label>
                  <Select value={formData.format} onValueChange={(value: 'glb' | 'gltf' | 'obj' | 'fbx') => setFormData({ ...formData, format: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5} className="z-[9999]">
                      <SelectItem value="glb">GLB</SelectItem>
                      <SelectItem value="gltf">GLTF</SelectItem>
                      <SelectItem value="obj">OBJ</SelectItem>
                      <SelectItem value="fbx">FBX</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Model Upload - Drag & Drop */}
              <div>
                <Label>رابط النموذج أو رفع ملف *</Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center transition-colors cursor-pointer hover:border-primary/50"
                  onClick={() => document.getElementById('model-file-input')?.click()}
                >
                  {formData.modelUrl ? (
                    <div className="space-y-2">
                      <Package className="h-8 w-8 text-green-600 mx-auto" />
                      <p className="text-sm font-medium text-slate-700">تم رفع الملف</p>
                      <p className="text-xs text-slate-500 break-all">{formData.modelUrl}</p>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, modelUrl: '' });
                        }}
                      >
                        <X className="h-3 w-3 ml-1" />
                        إزالة
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Package className="h-12 w-12 text-slate-400 mx-auto" />
                      <div>
                        <p className="text-sm font-medium text-slate-700">اسحب وأفلت الملف هنا</p>
                        <p className="text-xs text-slate-500">أو انقر للتحديد</p>
                      </div>
                      <p className="text-xs text-slate-400">GLB, GLTF, OBJ, FBX</p>
                    </div>
                  )}
                  <input
                    id="model-file-input"
                    type="file"
                    accept=".glb,.gltf,.obj,.fbx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileUpload(file);
                    }}
                    className="hidden"
                  />
                </div>
                {isUploading && (
                  <div className="mt-2">
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${uploadProgress}%` }}
                      />
                    </div>
                    <p className="text-sm text-center text-slate-600 mt-1">{uploadProgress.toFixed(0)}%</p>
                  </div>
                )}
                <Input 
                  className="mt-2" 
                  value={formData.modelUrl} 
                  onChange={(e) => setFormData({ ...formData, modelUrl: e.target.value })} 
                  placeholder="أو الصق رابط مباشر"
                />
              </div>

              {/* Thumbnail Upload - Drag & Drop */}
              <div>
                <Label>رابط الصورة المصغرة أو رفع صورة</Label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.add('border-primary', 'bg-primary/5');
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                  }}
                  onDrop={async (e) => {
                    e.preventDefault();
                    e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                    const file = e.dataTransfer.files?.[0];
                    if (file && file.type.startsWith('image/')) {
                      const formData = new FormData();
                      formData.append('file', file);
                      try {
                        const response = await fetch('/api/cloudinary/upload-file', {
                          method: 'POST',
                          body: formData
                        });
                        const data = await response.json();
                        if (data.ok && data.result) {
                          setFormData(prev => ({ ...prev, thumbnailUrl: data.result.secure_url }));
                          toast({ title: 'نجح', description: 'تم رفع الصورة بنجاح' });
                        }
                      } catch (error) {
                        toast({ title: 'خطأ', description: 'فشل رفع الصورة', variant: 'destructive' });
                      }
                    }
                  }}
                  className="border-2 border-dashed border-slate-300 rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-primary/50"
                  onClick={() => document.getElementById('thumbnail-file-input')?.click()}
                >
                  {formData.thumbnailUrl ? (
                    <div className="space-y-2">
                      <img src={formData.thumbnailUrl} alt="Thumbnail" className="h-20 w-20 object-cover rounded mx-auto" />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setFormData({ ...formData, thumbnailUrl: '' });
                        }}
                      >
                        <X className="h-3 w-3 ml-1" />
                        إزالة
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Eye className="h-8 w-8 text-slate-400 mx-auto" />
                      <p className="text-xs text-slate-600">اسحب صورة أو انقر للتحديد</p>
                    </div>
                  )}
                  <input
                    id="thumbnail-file-input"
                    type="file"
                    accept="image/*"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        const formData = new FormData();
                        formData.append('file', file);
                        try {
                          const response = await fetch('/api/cloudinary/upload-file', {
                            method: 'POST',
                            body: formData
                          });
                          const data = await response.json();
                          if (data.ok && data.result) {
                            setFormData(prev => ({ ...prev, thumbnailUrl: data.result.secure_url }));
                            toast({ title: 'نجح', description: 'تم رفع الصورة بنجاح' });
                          }
                        } catch (error) {
                          toast({ title: 'خطأ', description: 'فشل رفع الصورة', variant: 'destructive' });
                        }
                      }
                    }}
                    className="hidden"
                  />
                </div>
                <Input 
                  className="mt-2" 
                  value={formData.thumbnailUrl} 
                  onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })} 
                  placeholder="أو الصق رابط مباشر"
                />
              </div>

              {/* File Size */}
              <div>
                <Label htmlFor="fileSize">حجم الملف (بالبايت)</Label>
                <Input 
                  id="fileSize" 
                  type="number" 
                  value={formData.fileSize} 
                  onChange={(e) => setFormData({ ...formData, fileSize: Number(e.target.value) })} 
                  placeholder="مثال: 2048576 (2MB)"
                  className={formData.fileSize > 10485760 ? 'border-amber-500' : ''}
                />
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-slate-500">
                    {formData.fileSize > 0 && `≈ ${(formData.fileSize / 1024 / 1024).toFixed(2)} MB`}
                  </p>
                  {formData.fileSize > 10485760 && (
                    <p className="text-xs text-amber-600 font-medium">
                      ⚠️ الحد الموصى به: 10 MB
                    </p>
                  )}
                  {formData.fileSize > 0 && formData.fileSize <= 10485760 && (
                    <p className="text-xs text-green-600">
                      ✓ حجم مناسب
                    </p>
                  )}
                </div>
              </div>

              {/* Tags */}
              <div>
                <Label htmlFor="tags">الوسوم (Tags)</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    id="tags"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
                          setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
                          setTagInput('');
                        }
                      }
                    }}
                    placeholder="اضغط Enter للإضافة"
                  />
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {formData.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <X
                          className="h-3 w-3 cursor-pointer hover:text-red-500"
                          onClick={() => setFormData({ ...formData, tags: formData.tags.filter((_, i) => i !== index) })}
                        />
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Material and Color */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="material">المادة</Label>
                  <Select value={formData.material} onValueChange={(value) => setFormData({ ...formData, material: value })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="اختر المادة" />
                    </SelectTrigger>
                    <SelectContent position="popper" sideOffset={5} className="z-[9999]">
                      <SelectItem value="none">بدون</SelectItem>
                      <SelectItem value="خشب">خشب</SelectItem>
                      <SelectItem value="معدن">معدن</SelectItem>
                      <SelectItem value="زجاج">زجاج</SelectItem>
                      <SelectItem value="بلاستيك">بلاستيك</SelectItem>
                      <SelectItem value="قماش">قماش</SelectItem>
                      <SelectItem value="حجر">حجر</SelectItem>
                      <SelectItem value="أخرى">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="color">اللون الافتراضي</Label>
                  <div className="flex gap-2 mt-1">
                    <input
                      type="color"
                      id="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-20 rounded border border-slate-300 cursor-pointer"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      placeholder="#ffffff"
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              {/* Dimensions */}
              <div>
                <Label>الأبعاد (بالمتر)</Label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  <Input type="number" step="0.1" value={formData.dimensions.width} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, width: Number(e.target.value) } })} placeholder="العرض" />
                  <Input type="number" step="0.1" value={formData.dimensions.height} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, height: Number(e.target.value) } })} placeholder="الارتفاع" />
                  <Input type="number" step="0.1" value={formData.dimensions.depth} onChange={(e) => setFormData({ ...formData, dimensions: { ...formData.dimensions, depth: Number(e.target.value) } })} placeholder="العمق" />
                </div>
              </div>

              {/* Scale Sliders */}
              <div>
                <Label>المقياس الافتراضي (Scale)</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-slate-600">X: {formData.defaultScale.x.toFixed(1)}</Label>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={formData.defaultScale.x}
                      onChange={(e) => setFormData({ ...formData, defaultScale: { ...formData.defaultScale, x: Number(e.target.value) } })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Y: {formData.defaultScale.y.toFixed(1)}</Label>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={formData.defaultScale.y}
                      onChange={(e) => setFormData({ ...formData, defaultScale: { ...formData.defaultScale, y: Number(e.target.value) } })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Z: {formData.defaultScale.z.toFixed(1)}</Label>
                    <input
                      type="range"
                      min="0.1"
                      max="10"
                      step="0.1"
                      value={formData.defaultScale.z}
                      onChange={(e) => setFormData({ ...formData, defaultScale: { ...formData.defaultScale, z: Number(e.target.value) } })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Rotation Sliders */}
              <div>
                <Label>الدوران الافتراضي (Rotation)</Label>
                <div className="grid grid-cols-3 gap-4 mt-2">
                  <div>
                    <Label className="text-xs text-slate-600">X: {formData.defaultRotation.x}°</Label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={formData.defaultRotation.x}
                      onChange={(e) => setFormData({ ...formData, defaultRotation: { ...formData.defaultRotation, x: Number(e.target.value) } })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Y: {formData.defaultRotation.y}°</Label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={formData.defaultRotation.y}
                      onChange={(e) => setFormData({ ...formData, defaultRotation: { ...formData.defaultRotation, y: Number(e.target.value) } })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-600">Z: {formData.defaultRotation.z}°</Label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="15"
                      value={formData.defaultRotation.z}
                      onChange={(e) => setFormData({ ...formData, defaultRotation: { ...formData.defaultRotation, z: Number(e.target.value) } })}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer mt-2"
                    />
                  </div>
                </div>
              </div>

              {/* Status */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch checked={formData.isActive} onCheckedChange={(checked) => setFormData({ ...formData, isActive: checked })} />
                  <Label>نشط</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={formData.isPremium} onCheckedChange={(checked) => setFormData({ ...formData, isPremium: checked })} />
                  <Label>مميز</Label>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddModalOpen(false); setIsEditModalOpen(false); resetForm(); }}>
                إلغاء
              </Button>
              <Button onClick={isEditModalOpen ? handleEditProduct : handleAddProduct}>
                {isEditModalOpen ? 'حفظ التغييرات' : 'إضافة النموذج'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Preview Modal */}
        <Dialog open={isPreviewModalOpen} onOpenChange={setIsPreviewModalOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedProduct?.name}</DialogTitle>
              <DialogDescription>{selectedProduct?.description}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 rounded-lg flex items-center justify-center">
                {selectedProduct?.thumbnailUrl ? (
                  <img src={selectedProduct.thumbnailUrl} alt={selectedProduct.name} className="w-full h-full object-contain rounded-lg" />
                ) : (
                  <Package className="h-24 w-24 text-slate-400" />
                )}
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-slate-600">الفئة</p>
                  <p className="font-semibold">{selectedProduct?.category}</p>
                </div>
                <div>
                  <p className="text-slate-600">الصيغة</p>
                  <p className="font-semibold">{selectedProduct?.format.toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-slate-600">الأبعاد</p>
                  <p className="font-semibold">{selectedProduct?.dimensions.width}×{selectedProduct?.dimensions.height}×{selectedProduct?.dimensions.depth}م</p>
                </div>
                <div>
                  <p className="text-slate-600">عدد الاستخدامات</p>
                  <p className="font-semibold">{selectedProduct?.usageCount} مرة</p>
                </div>
              </div>
              <div>
                <p className="text-slate-600 text-sm mb-1">رابط النموذج</p>
                <a href={selectedProduct?.modelUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm break-all">
                  {selectedProduct?.modelUrl}
                </a>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Analytics Modal */}
        <ProductAnalyticsModal 
          open={isAnalyticsOpen}
          onOpenChange={setIsAnalyticsOpen}
          product={analyticsProduct}
        />

        {/* Add Category Dialog */}
        <Dialog open={isAddingCategory} onOpenChange={setIsAddingCategory}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة فئة جديدة</DialogTitle>
              <DialogDescription>أدخل اسم الفئة الجديدة</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="newCategory">اسم الفئة</Label>
                <Input
                  id="newCategory"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="مثال: إكسسوارات"
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setIsAddingCategory(false); setNewCategoryName(''); }}>
                إلغاء
              </Button>
              <Button onClick={handleAddCategory}>
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Category Manager Modal */}
        <Dialog open={isCategoryManagerOpen} onOpenChange={setIsCategoryManagerOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle>إدارة الفئات</DialogTitle>
              <DialogDescription>
                إضافة، تعديل، حذف وترتيب الفئات المخصصة
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto space-y-4">
              {/* All Categories (Editable) */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    جميع الفئات ({categories.length})
                  </h3>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setIsAddingCategory(true)}
                  >
                    <Plus className="h-3 w-3 ml-1" />
                    إضافة فئة
                  </Button>
                </div>

                {categories.length === 0 ? (
                  <div className="text-center py-8 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                    <Package className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-sm text-slate-500">لا توجد فئات</p>
                    <Button 
                      size="sm" 
                      variant="outline"
                      className="mt-3"
                      onClick={() => setIsAddingCategory(true)}
                    >
                      <Plus className="h-3 w-3 ml-1" />
                      إضافة أول فئة
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {categories.map((cat, index) => (
                      <div key={index} className="flex items-center gap-2 p-3 bg-white rounded-lg border border-slate-200 hover:border-primary/50 transition-colors group">
                        {/* Drag Handle */}
                        <div className="flex flex-col gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => handleMoveCategoryUp(index)}
                            disabled={index === 0}
                          >
                            <GripVertical className="h-3 w-3 rotate-90" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100"
                            onClick={() => handleMoveCategoryDown(index)}
                            disabled={index === categories.length - 1}
                          >
                            <GripVertical className="h-3 w-3 -rotate-90" />
                          </Button>
                        </div>

                        {/* Category Name */}
                        {editingCategoryIndex === index ? (
                          <Input
                            value={editingCategoryName}
                            onChange={(e) => setEditingCategoryName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEditCategory();
                              if (e.key === 'Escape') setEditingCategoryIndex(null);
                            }}
                            className="flex-1"
                            autoFocus
                          />
                        ) : (
                          <span className="flex-1 text-sm font-medium">{cat}</span>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {editingCategoryIndex === index ? (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-green-600 hover:text-green-700 hover:bg-green-50"
                                onClick={handleSaveEditCategory}
                              >
                                <CheckSquare className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-slate-600 hover:text-slate-700 hover:bg-slate-50"
                                onClick={() => setEditingCategoryIndex(null)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                onClick={() => handleEditCategory(index)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                onClick={() => handleDeleteCategory(index)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  💡 <strong>نصيحة:</strong> يمكنك إعادة ترتيب الفئات باستخدام الأسهم. جميع الفئات محفوظة في قاعدة البيانات.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={() => setIsCategoryManagerOpen(false)}>
                إغلاق
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* PNG to 3D Converter Modal */}
        <PNG3DConverter
          isOpen={isConverterOpen}
          onClose={() => setIsConverterOpen(false)}
          onSave={handleSaveFromConverter}
        />

        {/* Shop Builder Defaults Modal */}
        <ShopBuilderDefaultsModal
          isOpen={isDefaultsModalOpen}
          onClose={() => setIsDefaultsModalOpen(false)}
        />
      </div>
    </AdminLayout>
  );
};

export default Products3D;
