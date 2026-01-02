import { useState, useEffect, Fragment, useCallback, memo, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { optimizeImage, buildSrcSet } from '@/lib/images';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import ImageUpload from '@/components/ui/image-upload';
import { Checkbox } from '@/components/ui/checkbox';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  VisuallyHidden,
} from '@/components/ui/dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import AdminLayout from '@/components/admin/AdminLayout';
import { ModernTable, ModernTableRow, ModernTableHeader, ModernTableCell } from '@/components/admin/ModernTable';
import { apiGet, apiPostJson, apiPutJson, apiDelete } from '@/lib/api';
import { Product, Category } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip';
import { ToastAction } from '@/components/ui/toast';
import { logHistory } from '@/lib/history';
import {
  extractTextFromImage,
  extractTextFromPDF,
  generateColumnMapping,
  validateTableData,
  formatDataForPreview,
  type TableData
} from '@/lib/ocr-utils';
import {
  Plus,
  Search,
  Edit,
  Copy,
  Trash2,
  Eye,
  Upload,
  FileText,
  FileImage,
  FileSpreadsheet,
  Scan,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Star,
  Clock,
  ShoppingBag,
  Tag,
  EyeOff,
  Package,
  DollarSign
} from 'lucide-react';

// Small progress bar to visualize countdown (used in delete toasts)
const DeleteCountdownBar = ({ durationMs = 6000 }: { durationMs?: number }) => {
  const barRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;
    // animate width from 100% to 0% over duration
    requestAnimationFrame(() => {
      el.style.width = '0%';
    });
  }, []);
  return (
    <div className="mt-2 h-1 w-full bg-slate-200 rounded">
      <div
        ref={barRef}
        className="h-1 bg-slate-500 rounded"
        style={{ width: '100%', transition: `width ${durationMs}ms linear` }}
      />
    </div>
  );
};

interface ProductFormData {
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  originalPrice?: number;
  category: string;
  categoryAr: string;
  // manual visibility toggle
  isHidden?: boolean;
  featured: boolean;
  image: string;
  images: string[];
  tags: string[];
  sku: string;
  weight?: number;
}

// Backend types
type BackendProduct = {
  _id: string;
  name: string;
  nameAr: string;
  sku?: string;
  categoryId?: string;
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

type ProductsListResponse = {
  ok: true;
  items: BackendProduct[];
  total: number;
  page: number;
  pages: number;
};

type ProductItemResponse = { ok: true; item: BackendProduct };

type BackendCategory = {
  _id: string;
  name: string;
  nameAr: string;
  slug: string;
  image?: string;
  description?: string;
  featured?: boolean;
  order?: number;
};

type CategoriesListResponse = {
  ok: true;
  items: BackendCategory[];
  total: number;
  page: number;
  pages: number;
};

type ImportItem = Partial<ProductFormData> & {
  // allow extra fields if present from parsing
  [key: string]: string | number | boolean | string[] | undefined;
};

// Memoized top-level ProductForm to avoid remounts on parent re-render (prevents input focus loss)
type ProductFormProps = {
  formData: ProductFormData;
  setFormData: React.Dispatch<React.SetStateAction<ProductFormData>>;
  categories: Category[];
  editingProduct: Product | null;
  handleSubmit: (e: React.FormEvent) => Promise<void>;
  generateSKU: () => string;
  hidePrices?: boolean;
};

const ProductForm = memo(function ProductForm({ formData, setFormData, categories, editingProduct, handleSubmit, generateSKU, hidePrices = false }: ProductFormProps) {
  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-6">
        {/* Product Name Section */}
        <div className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/10 backdrop-blur-sm rounded-2xl p-6 border border-primary/20 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              معلومات المنتج الأساسية
            </h3>
          </div>

          <div className="space-y-3">
            <Label htmlFor="name" className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              اسم المنتج
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  name: e.target.value,
                  nameAr: e.target.value,
                }))
              }
              placeholder="اكتب اسم المنتج بأي لغة"
              required
              className="h-12 text-lg bg-white/80 backdrop-blur border-primary/20 focus:border-primary focus:ring-primary/20 shadow-sm transition-all duration-200 hover:shadow-md"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50/60 to-orange-50/60 rounded-xl border border-amber-200/50 shadow-sm">
                <Checkbox
                  id="isHidden"
                  checked={!!formData.isHidden}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isHidden: Boolean(checked) }))
                  }
                  className="w-5 h-5 border-2 border-amber-400 text-amber-600 focus:ring-amber-500/20"
                />
                <Label htmlFor="isHidden" className="text-base font-semibold text-amber-800 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <EyeOff className="w-4 h-4" />
                    إخفاء المنتج من المتجر
                  </div>
                </Label>
              </div>
            </div>

            <div className="space-y-3">
              <Label htmlFor="price" className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-green-600" />
                السعر
                {hidePrices && <span className="text-xs text-amber-600 font-normal">(للتتبع الداخلي فقط)</span>}
              </Label>
              {hidePrices && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg mb-2">
                  <p className="text-xs text-amber-800">
                    <strong>ملاحظة:</strong> الأسعار مخفية حالياً. أدخل السعر للتتبع الداخلي فقط - لن يظهر على الموقع.
                  </p>
                </div>
              )}
              <div className="relative">
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))
                  }
                  required={!hidePrices}
                  className="h-12 text-lg pr-12 bg-white/80 backdrop-blur border-green-200/50 focus:border-green-500 focus:ring-green-500/20 shadow-sm transition-all duration-200 hover:shadow-md"
                  placeholder={hidePrices ? "اختياري - للتتبع الداخلي فقط" : "0.00"}
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-lg">
                  ج.م
                </div>
              </div>
            </div>

            {/* Original Price (Before Discount) */}
            <div className="space-y-2">
              <label htmlFor="originalPrice" className="block text-sm font-semibold text-slate-700">
                السعر الأصلي (قبل الخصم) - اختياري
              </label>
              <div className="relative">
                <Input
                  id="originalPrice"
                  type="number"
                  value={formData.originalPrice || ''}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, originalPrice: e.target.value ? Number(e.target.value) : undefined }))
                  }
                  className="h-12 text-lg pr-12 bg-white/80 backdrop-blur border-slate-200/50 focus:border-slate-400 focus:ring-slate-400/20 shadow-sm transition-all duration-200 hover:shadow-md"
                  placeholder="0.00"
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-lg">
                  ج.م
                </div>
              </div>
              <p className="text-xs text-slate-500">سيظهر السعر الأصلي مشطوب إذا كان أكبر من السعر الحالي</p>
            </div>
          </div>
        </div>

        {/* Category and SKU Section */}
        <div className="bg-gradient-to-r from-purple-50/60 via-pink-50/40 to-rose-50/60 backdrop-blur-sm rounded-2xl p-6 border border-purple-200/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <Tag className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              تصنيف والترميز
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <Label htmlFor="category" className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Package className="w-4 h-4 text-purple-600" />
                الفئة
              </Label>
              <select
                id="category"
                className="w-full border-purple-200/50 rounded-xl h-12 px-4 bg-white/80 backdrop-blur shadow-sm text-lg focus:border-purple-500 focus:ring-purple-500/20 transition-all duration-200 hover:shadow-md"
                value={formData.category}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) {
                    setFormData((prev) => ({ ...prev, category: '', categoryAr: '' }));
                    return;
                  }
                  const selectedCat = categories.find((c) => String(c.id) === String(value));
                  setFormData((prev) => ({
                    ...prev,
                    category: value,
                    categoryAr: selectedCat?.nameAr || selectedCat?.name || '',
                  }));
                }}
              >
                <option value="">
                  {categories.length === 0 ? 'لا توجد فئات متاحة — أنشئ فئة أولاً' : 'اختر الفئة'}
                </option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.nameAr || category.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <Label htmlFor="sku" className="text-base font-semibold text-slate-700 flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                كود المنتج
              </Label>
              <div className="flex gap-3">
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  required
                  className="h-12 text-lg bg-white/80 backdrop-blur border-purple-200/50 focus:border-purple-500 focus:ring-purple-500/20 shadow-sm transition-all duration-200 hover:shadow-md"
                  placeholder="SKU123"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormData((prev) => ({ ...prev, sku: generateSKU() }))}
                  className="h-12 px-6 bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-pink-100 shadow-sm transition-all duration-200 hover:shadow-md"
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  توليد تلقائي
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Image Upload Section */}
        <div className="bg-gradient-to-r from-green-50/60 via-emerald-50/40 to-teal-50/60 backdrop-blur-sm rounded-2xl p-6 border border-green-200/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileImage className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              صور المنتج
            </h3>
          </div>

          <div className="space-y-4">
            <ImageUpload
              onImagesChange={(images) =>
                setFormData((prev) => ({
                  ...prev,
                  images: images,
                  image: images[0] || '',
                }))
              }
              maxImages={5}
              multiple={true}
              initialImages={formData.images}
              className="rounded-xl border-2 border-dashed border-green-300 bg-green-50/30 hover:bg-green-50/50 transition-all duration-200"
            />
            <div className="bg-green-100/50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-800 font-medium flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                يمكنك رفع حتى 5 صور للمنتج. الصورة الأولى ستكون الصورة الرئيسية.
              </p>
            </div>
          </div>
        </div>

        {/* Description Section */}
        <div className="bg-gradient-to-r from-slate-50/60 via-gray-50/40 to-zinc-50/60 backdrop-blur-sm rounded-2xl p-6 border border-slate-200/30 shadow-lg">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-gradient-to-r from-slate-500 to-gray-600 rounded-xl flex items-center justify-center shadow-lg">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 bg-gradient-to-r from-slate-600 to-gray-600 bg-clip-text text-transparent">
              وصف المنتج
            </h3>
          </div>

          <div className="space-y-3">
            <Label htmlFor="description" className="text-base font-semibold text-slate-700 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-600" />
              الوصف
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={4}
              className="text-lg bg-white/80 backdrop-blur border-slate-200/50 focus:border-slate-500 focus:ring-slate-500/20 shadow-sm transition-all duration-200 hover:shadow-md rounded-xl"
              placeholder="اكتب وصفاً مفصلاً للمنتج..."
            />
          </div>
        </div>

        <DialogFooter className="pt-6 border-t border-slate-200/50">
          <Button
            type="submit"
            className="h-12 px-8 text-lg bg-gradient-to-r from-primary via-secondary to-primary hover:from-primary hover:via-secondary hover:to-primary shadow-xl transition-all duration-300 hover:shadow-2xl transform hover:scale-105"
          >
            <div className="flex items-center gap-3">
              {editingProduct ? (
                <>
                  <Edit className="w-5 h-5" />
                  تحديث المنتج
                </>
              ) : (
                <>
                  <Plus className="w-5 h-5" />
                  إضافة المنتج
                </>
              )}
            </div>
          </Button>
        </DialogFooter>
      </div>
    </form>
  );
});

const AdminProducts = () => {
  // Set page title
  usePageTitle('إدارة المنتجات');

  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isMobile, isTablet } = useDeviceDetection();
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const didInitFromParams = useRef(false);
  const lastBulkDeleteIdsRef = useRef<string[]>([]);
  const { hidePrices } = usePricingSettings();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    nameAr: '',
    description: '',
    descriptionAr: '',
    price: 0,
    category: '',
    categoryAr: '',
    isHidden: false,
    featured: false,
    image: '',
    images: [],
    tags: [],
    sku: '',
  });

  // moved below pagination memo

  // Inline edit helpers
  const startInlineEdit = (p: Product, field: 'name' | 'sku' | 'price') => {
    const v = field === 'price' ? String(p.price) : field === 'name' ? (p.nameAr || p.name) : p.sku;
    setEditingField({ id: p.id, field, value: v });
  };

  const commitInlineEdit = async () => {
    if (!editingField) return;
    const { id, field, value } = editingField;
    try {
      // capture old value for audit before optimistic change
      const prevProduct = products.find(p => p.id === id);
      const oldValue = prevProduct ? (field === 'price' ? prevProduct.price : (field === 'name' ? (prevProduct.nameAr || prevProduct.name) : prevProduct.sku)) : undefined;
      // Validation
      if (field === 'price') {
        const num = Number(value);
        if (!Number.isFinite(num) || num <= 0) {
          toast({ title: 'السعر غير صالح', description: 'يجب أن يكون السعر أكبر من 0', variant: 'destructive' });
          setEditingField(null);
          return;
        }
      }
      if (field === 'sku') {
        const nextSku = String(value).trim();
        const duplicate = products.some(p => p.id !== id && p.sku && p.sku.toLowerCase() === nextSku.toLowerCase());
        if (duplicate) {
          toast({ title: 'الكود مكرر', description: 'SKU مستخدم بالفعل لمنتج آخر', variant: 'destructive' });
          setEditingField(null);
          return;
        }
      }

      // Optimistic update
      setSavingCell({ id, field });
      setProducts(prev => prev.map(p => {
        if (p.id !== id) return p;
        if (field === 'name') return { ...p, name: value, nameAr: value };
        if (field === 'sku') return { ...p, sku: value };
        if (field === 'price') return { ...p, price: Number(value) };
        return p;
      }));
      const payload: Partial<BackendProduct> = {};
      if (field === 'name') {
        payload.name = value;
        payload.nameAr = value;
      } else if (field === 'sku') {
        payload.sku = value;
      } else if (field === 'price') {
        const num = Number(value);
        payload.price = num;
      }
      await apiPutJson<BackendProduct, Partial<BackendProduct>>(`/api/products/${id}`, payload);
      // audit log: inline edit committed
      void logHistory({
        section: 'products',
        action: 'inline_edit',
        note: `Edited field ${field} for product ${id}`,
        meta: { id, field, old: oldValue, new: field === 'price' ? Number(value) : value }
      });
      setEditingField(null);
      setSavingCell(null);
    } catch (e) {
      // Rollback by refetching
      await refetchProducts();
      setEditingField(null);
      setSavingCell(null);
      toast({ title: 'فشل حفظ التعديل', variant: 'destructive' });
    }
  };

  const cancelInlineEdit = () => setEditingField(null);

  // Toggle product visibility
  const handleToggleVisibility = async (productId: string, hidden: boolean) => {
    try {
      // optimistic
      const prev = products.find(p => p.id === productId);
      if (prev) {
        setProducts(prevList => prevList.map(p => p.id === productId ? { ...p, isHidden: Boolean(hidden) } : p));
        // schedule undo window
        if (pendingVisibilityUndo?.timer) window.clearTimeout(pendingVisibilityUndo.timer);
        const t = window.setTimeout(() => setPendingVisibilityUndo(null), 8000);
        setPendingVisibilityUndo({ productId, prevHidden: !!prev.isHidden, timer: t });
      }
      await apiPutJson<BackendProduct, Partial<BackendProduct>>(`/api/products/${productId}`, { active: !hidden });
      // audit log: visibility toggled
      void logHistory({
        section: 'products',
        action: 'visibility_toggled',
        note: `${hidden ? 'Hide' : 'Show'} product ${productId}`,
        meta: { id: productId, hidden }
      });
      toast({
        title: hidden ? 'تم إخفاء المنتج' : 'تم إظهار المنتج',
        description: 'يمكنك التراجع خلال ثوانٍ قليلة',
        action: (
          <ToastAction altText="تراجع" onClick={undoVisibility}>
            تراجع
          </ToastAction>
        ),
      });
    } catch (e) {
      toast({ title: 'فشل تحديث الظهور', variant: 'destructive' });
      await refetchProducts();
    }
  };

  const undoVisibility = async () => {
    if (!pendingVisibilityUndo) return;
    const { productId, prevHidden, timer } = pendingVisibilityUndo;
    window.clearTimeout(timer);
    setPendingVisibilityUndo(null);
    try {
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, isHidden: prevHidden } : p));
      await apiPutJson<BackendProduct, Partial<BackendProduct>>(`/api/products/${productId}`, { active: !prevHidden });
      // audit log: visibility undo
      void logHistory({
        section: 'products',
        action: 'visibility_undone',
        note: `Undo visibility change for product ${productId}`,
        meta: { id: productId, hidden: prevHidden }
      });
      toast({ title: 'تم التراجع عن التغيير' });
    } catch {
      await refetchProducts();
    }
  };

  const toggleSelectOne = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const applyBulkChangeCategoryList = async () => {
    if (selectedIds.size === 0 || !bulkListCategoryId) return;
    const cat = categories.find(c => String(c.id) === String(bulkListCategoryId));
    if (!cat) {
      toast({ title: 'لم يتم العثور على الفئة', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`سيتم تغيير فئة ${selectedIds.size} منتج إلى "${cat.nameAr || cat.name}". هل أنت متأكد؟`)) return;
    // optimistic update with undo window
    void logHistory({
      section: 'products',
      action: 'bulk_category_change_scheduled',
      note: `Scheduled category change for ${selectedIds.size} products`,
      meta: { ids: Array.from(selectedIds), toCategoryId: String(cat.id), toCategorySlug: cat.slug }
    });
    setBackupProducts(prev => prev ?? products);
    const ids = new Set(selectedIds);
    setProducts(prev => prev.map(p => ids.has(String(p.id)) ? { ...p, category: String(cat.id), categoryAr: cat.nameAr || cat.name } : p));
    setSelectedIds(new Set());
    const timer = window.setTimeout(async () => {
      try {
        await Promise.all(Array.from(ids).map(id =>
          apiPutJson<BackendProduct, Partial<BackendProduct>>(`/api/products/${id}`,
            { categoryId: String(cat.id), categorySlug: cat.slug })
        ));
        void logHistory({
          section: 'products',
          action: 'bulk_category_change_finalized',
          note: `Finalized category change`,
          meta: { ids: Array.from(ids), toCategoryId: String(cat.id), toCategorySlug: cat.slug }
        });
        await refetchProducts();
      } catch (e) {
        await refetchProducts();
      } finally {
        setScheduledDeletes(new Map());
        setBackupProducts(null);
      }
    }, 6000);
    setScheduledDeletes(map => new Map(map).set('__bulk_cat__', timer));
    setBulkAction('none');
    setBulkListCategoryId('');
    toast({
      title: 'تم جدولة تغيير الفئة',
      description: 'سيتم التنفيذ خلال 6 ثوانٍ — يمكنك التراجع الآن',
      action: (
        <ToastAction altText="تراجع" onClick={undoBulkOps}>
          تراجع
        </ToastAction>
      ),
    });
  };

  // Bulk price adjust (+/- by percent or absolute)
  const applyBulkPriceAdjust = async () => {
    if (selectedIds.size === 0) return;
    const numeric = Number(priceAdjustValue);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      toast({ title: 'قيمة غير صالحة', description: 'الرجاء إدخال قيمة أكبر من 0', variant: 'destructive' });
      return;
    }
    const label = `${priceAdjustSign === 'increase' ? 'زيادة' : 'خفض'} ${priceAdjustMode === 'percent' ? `${numeric}%` : `${numeric}`}`;
    if (!window.confirm(`سيتم ${label} على أسعار ${selectedIds.size} منتج. هل أنت متأكد؟`)) return;
    // Prepare optimistic update
    void logHistory({
      section: 'products',
      action: 'bulk_price_adjust_scheduled',
      note: `Scheduled ${label} for ${selectedIds.size} products`,
      meta: { ids: Array.from(selectedIds), mode: priceAdjustMode, sign: priceAdjustSign, value: numeric }
    });
    const ids = new Set(selectedIds);
    const prevProducts = products;
    const factor = priceAdjustMode === 'percent' ? numeric / 100 : numeric;
    const sign = priceAdjustSign === 'increase' ? 1 : -1;
    // compute new prices and validate > 0
    const nextProducts = products.map(p => {
      if (!ids.has(String(p.id))) return p;
      let newPrice = p.price;
      if (priceAdjustMode === 'percent') {
        newPrice = Math.max(0, Math.round((p.price + sign * p.price * factor) * 100) / 100);
      } else {
        newPrice = Math.max(0, Math.round((p.price + sign * factor) * 100) / 100);
      }
      if (newPrice <= 0) newPrice = 0.01; // minimal > 0
      return { ...p, price: newPrice } as Product;
    });

    // optimistic UI + schedule commit with undo window
    setBackupProducts(prev => prev ?? prevProducts);
    setProducts(nextProducts);
    setIsApplyingBulk(true);
    const timer = window.setTimeout(async () => {
      try {
        await Promise.all(Array.from(ids).map(async (id) => {
          const p = nextProducts.find(pp => String(pp.id) === String(id));
          if (!p) return;
          await apiPutJson<BackendProduct, Partial<BackendProduct>>(`/api/products/${id}`, { price: p.price });
        }));
        void logHistory({
          section: 'products',
          action: 'bulk_price_adjust_finalized',
          note: `Finalized price adjustments`,
          meta: { ids: Array.from(ids) }
        });
        toast({ title: 'تم تحديث الأسعار', description: 'تم تعديل أسعار المنتجات المحددة' });
      } catch (e) {
        await refetchProducts();
      } finally {
        setSelectedIds(new Set());
        setBulkAction('none');
        setIsApplyingBulk(false);
        setScheduledDeletes(new Map());
        setBackupProducts(null);
      }
    }, 6000);
    setScheduledDeletes(map => new Map(map).set('__bulk_price__', timer));
    toast({
      title: 'تم جدولة تعديل الأسعار',
      description: 'سيتم التنفيذ خلال 6 ثوانٍ — يمكنك التراجع الآن',
      action: (
        <ToastAction altText="تراجع" onClick={undoBulkOps}>
          تراجع
        </ToastAction>
      ),
    });
  };

  // Unified undo for pending bulk ops (category/price and delete bulk markers)
  function undoBulkOps() {
    if (scheduledDeletes.size === 0 || !backupProducts) return;
    const hadCat = scheduledDeletes.has('__bulk_cat__');
    const hadPrice = scheduledDeletes.has('__bulk_price__');
    scheduledDeletes.forEach((t) => window.clearTimeout(t));
    setScheduledDeletes(new Map());
    setProducts(backupProducts);
    setBackupProducts(null);
    setIsApplyingBulk(false);
    // audit log: bulk undo
    if (hadCat) {
      void logHistory({ section: 'products', action: 'bulk_category_change_undone', note: 'Undid scheduled category change' });
    }
    if (hadPrice) {
      void logHistory({ section: 'products', action: 'bulk_price_adjust_undone', note: 'Undid scheduled price adjustments' });
    }
    toast({ title: 'تم التراجع عن العملية' });
  }

  // Smart Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<{ [key: number]: string }>({});
  const [importPreview, setImportPreview] = useState<ImportItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importStep, setImportStep] = useState<'upload' | 'mapping' | 'preview' | 'complete'>('upload');
  // Bulk selection/action state for list table
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<'none' | 'delete' | 'change_category' | 'price_adjust'>('none');
  const [bulkListCategoryId, setBulkListCategoryId] = useState('');
  const [priceAdjustMode, setPriceAdjustMode] = useState<'percent' | 'absolute'>('percent');
  const [priceAdjustSign, setPriceAdjustSign] = useState<'increase' | 'decrease'>('increase');
  const [priceAdjustValue, setPriceAdjustValue] = useState<string>('10');
  const [isApplyingBulk, setIsApplyingBulk] = useState(false);
  // Preview controls
  const [previewPerPage, setPreviewPerPage] = useState<number | 'all'>(10);
  const [previewPage, setPreviewPage] = useState(1);
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  // Matching strategy for Smart Update
  const [matchStrategy, setMatchStrategy] = useState<'auto' | 'sku' | 'name' | 'nameAr'>('auto');
  // Ensure category select opens inside dialog reliably
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  // Inline edit state
  const [editingField, setEditingField] = useState<null | { id: string; field: 'name' | 'sku' | 'price'; value: string }>(null);
  const [savingCell, setSavingCell] = useState<null | { id: string; field: 'name' | 'sku' | 'price' }>(null);
  // Undo / delete scheduling
  const [pendingVisibilityUndo, setPendingVisibilityUndo] = useState<null | { productId: string; prevHidden: boolean; timer: number }>(null);
  const [scheduledDeletes, setScheduledDeletes] = useState<Map<string, number>>(new Map());
  const [backupProducts, setBackupProducts] = useState<Product[] | null>(null);
  // Guard set to prevent late timers from executing delete after undo
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    pendingDeleteIdsRef.current = pendingDeleteIds;
  }, [pendingDeleteIds]);
  // Fullscreen image preview
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Helpers to map backend -> frontend
  const mapBackendProduct = (bp: BackendProduct): Product => {
    return {
      id: bp._id,
      name: bp.name,
      nameAr: bp.nameAr,
      description: bp.description || '',
      descriptionAr: '',
      price: bp.price,
      originalPrice: undefined,
      image: bp.image || '',
      images: bp.images || [],
      category: bp.categoryId || bp.categorySlug || '',
      categoryAr: '',
      stock: bp.stock,
      isHidden: bp.active === false ? true : false,
      featured: !!bp.featured,
      discount: undefined,
      rating: 0,
      reviews: 0,
      tags: [],
      sku: bp.sku || '',
      weight: undefined,
      dimensions: undefined,
      createdAt: bp.createdAt,
      updatedAt: bp.updatedAt,
    };
  };

  const refetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    const res = await apiGet<BackendProduct>('/api/products');
    if (res.ok && res.items) {
      setProducts(res.items.map(mapBackendProduct));
    }
    setIsLoadingProducts(false);
  }, []);

  const refetchCategories = useCallback(async () => {
    const res = await apiGet<BackendCategory>('/api/categories');
    if (res.ok && res.items) {
      const mapped: Category[] = res.items.map(c => ({
        id: c._id,
        name: c.name,
        nameAr: c.nameAr,
        slug: c.slug,
        image: c.image || '',
        description: c.description || '',
        descriptionAr: undefined,
        productCount: 0,
        featured: !!c.featured,
        order: c.order ?? 0,
      }));
      setCategories(mapped);
    }
  }, []);

  const undoDelete = useCallback(() => {
    // Clear any pending timers, if present
    if (scheduledDeletes.size > 0) {
      scheduledDeletes.forEach((t) => window.clearTimeout(t));
    }
    setScheduledDeletes(new Map());
    // Disarm pending deletes so any late timers become no-ops
    setPendingDeleteIds(new Set());
    pendingDeleteIdsRef.current = new Set();
    // Log undo action for audit
    const undoneIds = lastBulkDeleteIdsRef.current || [];
    if (undoneIds.length > 0) {
      void logHistory({
        section: 'products',
        action: 'bulk_delete_undone',
        note: `Undid scheduled delete for ${undoneIds.length} products`,
        meta: { ids: undoneIds, count: undoneIds.length }
      });
    } else {
      const pending = Array.from(pendingDeleteIdsRef.current || []);
      if (pending.length > 0) {
        void logHistory({
          section: 'products',
          action: 'delete_undone',
          note: `Undid scheduled delete`,
          meta: { ids: pending, count: pending.length }
        });
      }
    }
    // Prefer restoring from backup snapshot if available
    if (backupProducts) {
      setProducts(backupProducts);
      setBackupProducts(null);
      toast({ title: 'تم إلغاء الحذف' });
    } else {
      // Fallback: refetch if no backup snapshot exists (e.g., after HMR/remount)
      void refetchProducts();
      toast({ title: 'تم إلغاء الحذف' });
    }
  }, [scheduledDeletes, backupProducts, toast, refetchProducts]);

  const applyBulkDelete = useCallback(async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`سيتم حذف ${selectedIds.size} منتج. هل أنت متأكد؟`)) return;
    const ids = Array.from(selectedIds);
    lastBulkDeleteIdsRef.current = ids;
    void logHistory({
      section: 'products',
      action: 'bulk_delete_scheduled',
      note: `Scheduled delete for ${ids.length} products`,
      meta: { ids, count: ids.length }
    });
    setBackupProducts(prev => prev ?? products);
    // optimistic remove
    setProducts(prev => prev.filter(p => !ids.includes(String(p.id))));
    setSelectedIds(new Set());
    // Arm pending ids for guard
    setPendingDeleteIds(prev => {
      const next = new Set(prev);
      ids.forEach(id => next.add(String(id)));
      return next;
    });
    const timer = window.setTimeout(async () => {
      try {
        // Only delete those still pending (not undone)
        const stillPending = ids.filter(id => pendingDeleteIdsRef.current.has(String(id)));
        if (stillPending.length > 0) {
          await Promise.all(stillPending.map(id => apiDelete(`/api/products/${id}`)));
        }
        void logHistory({
          section: 'products',
          action: 'bulk_delete_finalized',
          note: `Finalized delete for ${stillPending.length} products`,
          meta: { ids: stillPending, count: stillPending.length }
        });
        await refetchProducts();
      } catch {
        await refetchProducts();
      } finally {
        // Disarm processed ids
        setPendingDeleteIds(prev => {
          const next = new Set(prev);
          ids.forEach(id => next.delete(String(id)));
          return next;
        });
        setScheduledDeletes(new Map());
        setBackupProducts(null);
      }
    }, 6000);
    // store a single marker timer (bulk)
    setScheduledDeletes(new Map([["__bulk__", timer]]));
    toast({
      title: 'تم جدولة الحذف الجماعي',
      description: (
        <div>
          سيتم الحذف خلال 6 ثوانٍ — يمكنك التراجع الآن
          <DeleteCountdownBar durationMs={6000} />
        </div>
      ),
      action: (
        <ToastAction altText="تراجع" onClick={undoDelete}>
          تراجع
        </ToastAction>
      ),
    });
  }, [selectedIds, products, refetchProducts, toast, undoDelete]);

  // Load data
  useEffect(() => {
    (async () => {
      await Promise.all([refetchProducts(), refetchCategories()]);
    })();
  }, [refetchProducts, refetchCategories]);

  // Ensure categories are available when opening import modal
  useEffect(() => {
    if (isImportModalOpen && categories.length === 0) {
      // derive from current products as a fallback
      const seen = new Map<string, Category>();
      const slugify = (s: string) => s.toString().trim().toLowerCase().replace(/\s+/g, '-').slice(0, 32);
      products.forEach((p: Product) => {
        const name = p.categoryAr || p.category || '';
        if (name) {
          const id = p.category || slugify(String(name));
          if (!seen.has(id)) {
            seen.set(id, { id, name: String(name), nameAr: String(name), slug: slugify(String(name)), image: '', productCount: 0, featured: false, order: 0 });
          }
        }
      });
      const derived = Array.from(seen.values());
      if (derived.length > 0) setCategories(derived);
    }
  }, [isImportModalOpen, categories.length, products]);

  // When preview is generated and categories are still empty, derive from preview rows
  useEffect(() => {
    if (isImportModalOpen && importStep === 'preview' && categories.length === 0 && importPreview.length > 0) {
      const seen = new Map<string, Category>();
      const slug = (s: string) => s.toString().trim().toLowerCase().replace(/\s+/g, '-').slice(0, 32);
      importPreview.forEach((p) => {
        const name = p.categoryAr || (typeof p.category === 'string' ? p.category : '') || '';
        if (name) {
          const id = (typeof p.category === 'string' && p.category) ? p.category : slug(String(name));
          if (!seen.has(id)) {
            seen.set(id, { id, name: String(name), nameAr: String(name), slug: slug(String(name)), image: '', productCount: 0, featured: false, order: 0 });
          }
        }
      });
      const derived = Array.from(seen.values());
      if (derived.length > 0) setCategories(derived);
    }
  }, [isImportModalOpen, importStep, importPreview, categories.length]);

  // Notify if categories are empty when user reaches preview
  useEffect(() => {
    if (isImportModalOpen && importStep === 'preview' && categories.length === 0) {
      toast({
        title: 'لا توجد فئات حالياً',
        description: 'يمكنك إنشاء فئات من صفحة الفئات، أو سنحاول استنتاجها من المنتجات والمدخلات الحالية.',
        variant: 'default'
      });
    }
  }, [isImportModalOpen, importStep, categories.length, toast]);

  // Filter products (memoized)
  const filteredProducts = useMemo(() => {
    return products.filter(product => {
      const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.nameAr.includes(searchTerm) ||
        product.sku.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = !selectedCategory || selectedCategory === 'all' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, selectedCategory]);

  // Pagination calculations (memoized)
  const totalPages = useMemo(() => {
    return Math.ceil(filteredProducts.length / itemsPerPage);
  }, [filteredProducts.length, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredProducts.slice(startIndex, endIndex);
  }, [filteredProducts, currentPage, itemsPerPage]);

  // Resolve product main image with category fallback
  const getProductPrimaryImage = useCallback((p: Product): string => {
    const cat = categories.find(
      (c) => String(c.id) === String(p.category) || String(c.slug) === String(p.category)
    );
    return p.image || cat?.image || '';
  }, [categories]);

  // Select all on current page
  const toggleSelectAllOnPage = useCallback(() => {
    const ids = paginatedProducts.map(p => String(p.id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }, [paginatedProducts]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // Toggle row expansion
  const toggleRowExpansion = useCallback((productId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(productId)) {
      newExpanded.delete(productId);
    } else {
      newExpanded.add(productId);
    }
    setExpandedRows(newExpanded);
  }, [expandedRows]);

  const enhancePreviewFromTable = (tableData: TableData, mapping: { [key: number]: string }, formattedData: ImportItem[]): ImportItem[] => {
    const lcHeaders = tableData.headers.map(h => h.trim().toLowerCase());
    const text64Index = lcHeaders.findIndex(h => /\btext\s*64\b/i.test(h));
    const text62Index = lcHeaders.findIndex(h => /\btext\s*62\b/i.test(h));
    const anyTextIdx = lcHeaders.findIndex(h => /\btext\s*\d+\b/i.test(h));
    const preferredIndex = text64Index >= 0 ? text64Index : (text62Index >= 0 ? text62Index : anyTextIdx);
    // capture the mapped price column index explicitly to preserve raw text
    const priceColIndex = Number(Object.entries(mapping).find(([idx, f]) => f === 'price')?.[0] ?? NaN);
    const result = formattedData.map((product, index) => {
      const row = tableData.rows[index] || [];
      const cloned: ImportItem = { ...product } as ImportItem;

      // Determine a name candidate
      const isInvalid = (v?: string) => {
        if (!v) return true;
        const s = String(v).trim();
        if (s.length < 2) return true;
        if (/^\d+(\.\d+)?$/.test(s)) return true; // purely numeric
        const bads = ['اسم المنتج', 'السعر', 'المخزون', 'الكود', 'الفئة', 'price', 'stock', 'sku', 'category'];
        if (bads.includes(s.toLowerCase())) return true;
        return false;
      };

      let nameCandidate: string | undefined = cloned.nameAr || cloned.name;
      if (isInvalid(nameCandidate)) {
        // try preferred (Text64 -> Text62 -> any TextNN)
        if (preferredIndex >= 0) nameCandidate = row[preferredIndex];
        if (isInvalid(nameCandidate) && text62Index >= 0) nameCandidate = row[text62Index];
        if (isInvalid(nameCandidate) && anyTextIdx >= 0) nameCandidate = row[anyTextIdx];
        if (isInvalid(nameCandidate)) {
          // fallback: first meaningful non-numeric, non-empty cell
          const found = row.find((v) => {
            const s = (v ?? '').toString().trim();
            return s.length > 1 && !/^\d+(\.\d+)?$/.test(s);
          });
          nameCandidate = (found as string | undefined) || '';
        }
      }

      if (!cloned.name && nameCandidate) cloned.name = String(nameCandidate);
      if (!cloned.nameAr && nameCandidate) cloned.nameAr = String(nameCandidate);

      // Override price using RAW cell text if mapping provided, parsed by parsePriceValue for locale/digits
      if (Number.isFinite(priceColIndex)) {
        const raw = row[priceColIndex as number];
        if (raw !== undefined) {
          // parse to number immediately
          const parsed = parsePriceValue(raw);
          cloned.price = Number.isFinite(parsed) ? parsed : cloned.price;
        }
      }

      if (!cloned.sku) cloned.sku = generateSKU();
      if (!cloned.categoryAr && cloned.category) cloned.categoryAr = String(cloned.category);
      if (!cloned.category && cloned.categoryAr) cloned.category = String(cloned.categoryAr);
      if (!cloned.description) cloned.description = `Product ${index + 1}`;
      if (!cloned.descriptionAr) cloned.descriptionAr = `منتج ${index + 1}`;
      return cloned;
    });
    // Deduplicate similar to generatePreview
    const seen = new Set<string>();
    return result.filter((p) => {
      const key = normalizeKey(p.sku) || normalizeKey(p.name) || normalizeKey(p.nameAr);
      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };

  const updateImportItem = (absoluteIndex: number, field: keyof ImportItem, value: string) => {
    setImportPreview(prev => prev.map((item, idx) => {
      if (idx !== absoluteIndex) return item;
      // coerce types for known numeric/boolean fields
      if (field === 'price' || field === 'originalPrice' || field === 'weight') {
        return { ...item, [field]: value === '' ? undefined : Number(value) };
      }
      if (field === 'featured' || field === 'isHidden') {
        return { ...item, [field]: value === 'true' };
      }
      return { ...item, [field]: value };
    }));
  };

  const applyBulkCategory = (idOverride?: string) => {
    const id = idOverride ?? bulkCategoryId;
    if (!id) return;
    const cat = categories.find(c => String(c.id) === String(id));
    setBulkCategoryId(String(id));
    setImportPreview(prev => prev.map(item => ({
      ...item,
      category: cat ? String(cat.id) : item.category,
      categoryAr: cat?.nameAr || item.categoryAr,
    })));
    if (cat) {
      toast({ title: 'تم تعيين الفئة جماعياً', description: `تم تعيين الفئة "${cat.nameAr || cat.name}" لجميع العناصر` });
    }
  };

  // Auto-generate SKU
  const generateSKU = () => {
    const count = products.length + 1;
    return `AUTO-${count.toString().padStart(3, '0')}`;
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const categoryObj = categories.find(c => String(c.id) === String(formData.category));
      const payload: Partial<BackendProduct> = {
        name: formData.name,
        nameAr: formData.nameAr,
        price: formData.price,
        originalPrice: formData.originalPrice,
        description: formData.description,
        image: formData.image,
        images: formData.images,
        featured: formData.featured,
        active: formData.isHidden ? false : true,
        sku: formData.sku,
        categoryId: formData.category || undefined,
        categorySlug: categoryObj?.slug,
      };
      if (editingProduct) {
        await apiPutJson<BackendProduct, Partial<BackendProduct>>(`/api/products/${editingProduct.id}`, payload);
        void logHistory({
          section: 'products',
          action: 'product_updated',
          note: `Updated product ${editingProduct.id}`,
          meta: { id: editingProduct.id, name: formData.name, sku: formData.sku }
        });
        toast({ title: 'تم تحديث المنتج', description: 'تم تحديث المنتج بنجاح' });
        setIsEditModalOpen(false);
      } else {
        await apiPostJson<BackendProduct, Partial<BackendProduct>>('/api/products', payload);
        void logHistory({
          section: 'products',
          action: 'product_created',
          note: `Created product`,
          meta: { name: formData.name, sku: formData.sku }
        });
        toast({ title: 'تم إضافة المنتج', description: 'تم إضافة المنتج بنجاح' });
        setIsCreateModalOpen(false);
      }
      await refetchProducts();
      resetForm();
    } catch (e) {
      toast({ title: 'فشل حفظ المنتج', variant: 'destructive' });
    }
  };

  // Handle product deletion
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    open: boolean;
    product: Product | null;
    loading: boolean;
  }>({ open: false, product: null, loading: false });

  const openDeleteConfirm = (product: Product) => {
    setDeleteConfirmModal({ open: true, product, loading: false });
  };

  const closeDeleteConfirm = () => {
    setDeleteConfirmModal({ open: false, product: null, loading: false });
  };

  const confirmDelete = async () => {
    const product = deleteConfirmModal.product;
    if (!product) return;

    setDeleteConfirmModal(prev => ({ ...prev, loading: true }));

    // schedule delete with undo window
    void logHistory({
      section: 'products',
      action: 'delete_scheduled',
      note: `Scheduled delete for product ${product.id}`,
      meta: { id: product.id }
    });
    setBackupProducts(prev => prev ?? products);
    setProducts(prev => prev.filter(p => p.id !== product.id));
    // Arm pending id for guard
    setPendingDeleteIds(prev => {
      const next = new Set(prev);
      next.add(String(product.id));
      return next;
    });
    const timer = window.setTimeout(async () => {
      try {
        // Only delete if still pending (not undone)
        if (pendingDeleteIdsRef.current.has(String(product.id))) {
          await apiDelete(`/api/products/${product.id}`);
          void logHistory({
            section: 'products',
            action: 'delete_finalized',
            note: `Finalized delete for product ${product.id}`,
            meta: { id: product.id }
          });
        }
        await refetchProducts();
      } catch {
        await refetchProducts();
      } finally {
        // Disarm processed id
        setPendingDeleteIds(prev => {
          const next = new Set(prev);
          next.delete(String(product.id));
          return next;
        });
        setScheduledDeletes(map => {
          const next = new Map(map);
          next.delete(product.id);
          return next;
        });
      }
    }, 6000);

    setScheduledDeletes(map => new Map(map).set(product.id, timer));
    toast({
      title: 'تم جدولة حذف المنتج',
      description: (
        <div className="space-y-3">
          <p>سيتم حذف المنتج خلال 6 ثوانٍ - يمكنك التراجع</p>
          <DeleteCountdownBar />
        </div>
      ),
      action: (
        <ToastAction altText="تراجع" onClick={undoDelete}>
          تراجع
        </ToastAction>
      ),
    });

    closeDeleteConfirm();
  };

  const handleDelete = async (productId: string) => {
    const product = products.find(p => p.id === productId);
    if (product) {
      openDeleteConfirm(product);
    }
  };
  // Handle product duplication
  const handleDuplicate = async (product: Product) => {
    try {
      const categoryObj = categories.find(c => String(c.id) === String(product.category));
      const payload: Partial<BackendProduct> = {
        name: `نسخة من ${product.name}`,
        nameAr: `نسخة من ${product.nameAr}`,
        price: product.price,
        description: product.description,
        image: product.image,
        images: product.images,
        featured: product.featured,
        active: product.isHidden ? false : true,
        sku: generateSKU(),
        categoryId: product.category,
        categorySlug: categoryObj?.slug,
      };
      await apiPostJson<ProductItemResponse, Partial<BackendProduct>>('/api/products', payload);
      await refetchProducts();
      void logHistory({
        section: 'products',
        action: 'product_duplicated',
        note: `Duplicated product ${product.id}`,
        meta: { sourceId: product.id }
      });
      toast({ title: 'تم نسخ المنتج', description: 'تم إنشاء نسخة من المنتج بنجاح' });
    } catch (e) {
      toast({ title: 'فشل نسخ المنتج', variant: 'destructive' });
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      nameAr: '',
      description: '',
      descriptionAr: '',
      price: 0,
      category: '',
      categoryAr: '',
      isHidden: false,
      featured: false,
      image: '',
      images: [],
      tags: [],
      sku: '',
    });
    setEditingProduct(null);
  };

  // Open edit modal
  const handleEdit = (product: Product) => {
    setFormData({
      name: product.name,
      nameAr: product.nameAr,
      description: product.description,
      descriptionAr: product.descriptionAr,
      price: product.price,
      originalPrice: product.originalPrice,
      category: product.category,
      categoryAr: product.categoryAr,
      isHidden: product.isHidden ?? false,
      featured: product.featured,
      image: product.image,
      images: product.images || [],
      tags: product.tags || [],
      sku: product.sku,
      weight: product.weight,
    });
    setEditingProduct(product);
    setIsEditModalOpen(true);
  };

  // Export products as CSV
  const handleExport = () => {
    const csvContent = [
      ['ID', 'Name', 'Category', 'Price', 'Hidden', 'SKU'].join(','),
      ...products.map(p => [p.id, p.name, p.category, p.price, p.isHidden ? 'true' : 'false', p.sku].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'products.csv';
    a.click();
    URL.revokeObjectURL(url);
    // audit log: export
    void logHistory({ section: 'products', action: 'export_downloaded', note: `Exported ${products.length} products`, meta: { count: products.length } });
  };

  // Smart Import Functions
  const handleFileUpload = async (file: File) => {
    setImportFile(file);
    setIsProcessing(true);

    try {
      if (
        file.name.toLowerCase().endsWith('.xlsx') ||
        file.name.toLowerCase().endsWith('.xls') ||
        file.name.toLowerCase().endsWith('.csv') ||
        file.type.includes('spreadsheet') ||
        file.type.includes('excel') ||
        file.type === 'text/csv'
      ) {
        await processExcelFile(file);
      } else {
        throw new Error('نوع الملف غير مدعوم. يسمح فقط بملفات Excel/CSV');
      }
    } catch (error) {
      toast({
        title: "خطأ في معالجة الملف",
        description: error instanceof Error ? error.message : "حدث خطأ غير متوقع",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processExcelFile = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

      if (!aoa || aoa.length === 0) {
        throw new Error('الملف فارغ أو غير صالح');
      }

      // Normalize header values to strings
      const headers = (aoa[0] || []).map((h) => String(h));
      const rows = aoa.slice(1);
      const rowsStr: string[][] = rows.map((row) => row.map((v) => String(v)));
      const extractedArray: string[][] = [headers, ...rowsStr];
      setExtractedData(extractedArray);

      // Auto-map columns based on headers
      const smartMapping = generateColumnMapping(headers);
      setColumnMapping(smartMapping);

      // Simpler UX: auto-generate preview immediately
      const tableData: TableData = { headers, rows: rowsStr, confidence: 0.9 };
      const formatted = formatDataForPreview(tableData, smartMapping);
      const enhanced = enhancePreviewFromTable(tableData, smartMapping, formatted as ImportItem[]);
      setImportPreview(enhanced);
      setPreviewPage(1);
      setImportStep('preview');

      toast({
        title: 'تم قراءة ملف Excel/CSV',
        description: `تم العثور على ${rows.length} صف من البيانات في الورقة ${firstSheetName}`,
      });
    } catch (error) {
      throw new Error(`فشل في معالجة ملف Excel/CSV: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const normalizeKey = (v?: string) => {
    let s = (v || '').toString();
    // Normalize spaces, remove Tatweel and Arabic diacritics
    // Arabic diacritics: \u064B-\u0652, Tatweel: \u0640
    s = s
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/\u0640/g, '')
      .replace(/[\s\u00A0]+/g, ' ')
      .trim()
      .toLowerCase();
    // Remove surrounding quotes and extra punctuation
    s = s.replace(/^["'\u200f\u200e]+|["'\u200f\u200e]+$/g, '');
    return s;
  };
  const normalizeSku = (v?: string) => {
    // normalize sku: lower, remove spaces/punctuations, drop leading zeros
    let s = normalizeKey(v).replace(/[^a-z0-9]/g, '');
    s = s.replace(/^0+/, '');
    return s;
  };

  const isSameProduct = (a: { sku?: string; name?: string; nameAr?: string }, b: { sku?: string; name?: string; nameAr?: string }) => {
    const aSku = normalizeSku(a.sku);
    const bSku = normalizeSku(b.sku);
    if (aSku && bSku && aSku === bSku) return true;
    const aName = normalizeKey(a.name);
    const bName = normalizeKey(b.name);
    if (aName && bName && aName === bName) return true;
    const aNameAr = normalizeKey(a.nameAr);
    const bNameAr = normalizeKey(b.nameAr);
    if (aNameAr && bNameAr && aNameAr === bNameAr) return true;
    return false;
  };

  const findExistingByStrategy = (item: { sku?: string; name?: string; nameAr?: string }) => {
    if (matchStrategy === 'sku') {
      const key = normalizeSku(item.sku);
      if (!key) return undefined;
      return products.find(p => normalizeSku(p.sku) === key);
    }
    if (matchStrategy === 'name') {
      const key = normalizeKey(item.name);
      if (!key) return undefined;
      return products.find(p => normalizeKey(p.name) === key);
    }
    if (matchStrategy === 'nameAr') {
      const key = normalizeKey(item.nameAr);
      if (!key) return undefined;
      return products.find(p => normalizeKey(p.nameAr) === key);
    }
    // auto
    return products.find(p => isSameProduct(p, item));
  };

  const isMatchByStrategy = (p: { sku?: string; name?: string; nameAr?: string }, item: { sku?: string; name?: string; nameAr?: string }) => {
    if (matchStrategy === 'sku') return normalizeSku(p.sku) === normalizeSku(item.sku);
    if (matchStrategy === 'name') return normalizeKey(p.name) === normalizeKey(item.name);
    if (matchStrategy === 'nameAr') return normalizeKey(p.nameAr) === normalizeKey(item.nameAr);
    return isSameProduct(p, item);
  };

  // Parse prices robustly from various formats (e.g., "1,234.50", "1.234,50", "1٬234٫50", with currency symbols)
  const parsePriceValue = (val: unknown): number => {
    if (val == null) return NaN;
    let s = String(val).trim();
    if (!s) return NaN;
    // Convert Arabic-Indic digits to Western 0-9
    const arabicIndicMap: Record<string, string> = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
      '۰': '0', '۱': '1', '۲': '2', '۳': '3', '۴': '4', '۵': '5', '۶': '6', '۷': '7', '۸': '8', '۹': '9'
    };
    s = s.replace(/[٠-٩۰-۹]/g, ch => arabicIndicMap[ch] || ch);
    if (!s) return NaN;
    // Remove currency and any non-digit/sep chars, keep digits, comma, dot, minus
    s = s.replace(/[^0-9,.-]/g, '');
    // If both comma and dot exist, decide decimal by last occurrence
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma !== -1 && lastDot !== -1) {
      if (lastComma > lastDot) {
        // comma as decimal, remove dots as thousand
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        // dot as decimal, remove commas as thousand
        s = s.replace(/,/g, '');
      }
    } else if (lastComma !== -1 && lastDot === -1) {
      // Only comma -> treat as decimal
      s = s.replace(',', '.');
    } else {
      // Only dot or none -> leave as is, but remove grouping commas if any remain
      s = s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const processImageFile = async (file: File) => {
    try {
      const tableData: TableData = await extractTextFromImage(file);

      // Validate extracted data
      const validation = validateTableData(tableData);

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        toast({
          title: "تحذيرات",
          description: validation.warnings.join(', '),
          variant: "default"
        });
      }

      // Convert to array format for compatibility
      const extractedArray: string[][] = [tableData.headers, ...tableData.rows];
      setExtractedData(extractedArray);

      // Auto-generate smart column mapping
      const smartMapping = generateColumnMapping(tableData.headers);
      setColumnMapping(smartMapping);

      // Simpler UX: auto-generate preview immediately
      const formatted = formatDataForPreview(tableData, smartMapping);
      const enhanced = enhancePreviewFromTable(tableData, smartMapping, formatted as ImportItem[]);
      setImportPreview(enhanced);
      setPreviewPage(1);
      setImportStep('preview');

      toast({
        title: "تم استخراج البيانات بنجاح",
        description: `تم العثور على ${tableData.rows.length} منتج في الصورة (ثقة: ${Math.round(tableData.confidence * 100)}%)`,
      });
    } catch (error) {
      throw new Error(`فشل في معالجة الصورة: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const processPDFFile = async (file: File) => {
    try {
      const tableData: TableData = await extractTextFromPDF(file);

      // Validate extracted data
      const validation = validateTableData(tableData);

      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Show warnings if any
      if (validation.warnings.length > 0) {
        toast({
          title: "تحذيرات",
          description: validation.warnings.join(', '),
          variant: "default"
        });
      }

      // Convert to array format for compatibility
      const extractedArray: string[][] = [tableData.headers, ...tableData.rows];
      setExtractedData(extractedArray);

      // Auto-generate smart column mapping
      const smartMapping = generateColumnMapping(tableData.headers);
      setColumnMapping(smartMapping);

      // Auto preview with enhanced names
      const formatted = formatDataForPreview(tableData, smartMapping);
      const enhanced = enhancePreviewFromTable(tableData, smartMapping, formatted as ImportItem[]);
      setImportPreview(enhanced);
      setPreviewPage(1);
      setImportStep('preview');

      toast({
        title: "تم استخراج البيانات بنجاح",
        description: `تم العثور على ${tableData.rows.length} منتج في ملف PDF (ثقة: ${Math.round(tableData.confidence * 100)}%)`,
      });
    } catch (error) {
      throw new Error(`فشل في معالجة ملف PDF: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    }
  };

  const handleColumnMapping = (columnIndex: number, field: string) => {
    setColumnMapping(prev => ({
      ...prev,
      [columnIndex]: field
    }));
  };

  const generatePreview = () => {
    if (extractedData.length < 2) return;

    // Create TableData object for the utility function
    const tableData: TableData = {
      headers: extractedData[0],
      rows: extractedData.slice(1),
      confidence: 0.9 // Default confidence
    };

    // Format + enhance (ensures name from TextNN/first cell)
    const formattedData = formatDataForPreview(tableData, columnMapping) as ImportItem[];
    const enhancedPreview = enhancePreviewFromTable(tableData, columnMapping, formattedData);

    // Deduplicate within the imported dataset (prefer first occurrence)
    const seen = new Set<string>();
    const uniquePreview = enhancedPreview.filter((p) => {
      const key = normalizeKey(p.sku) || normalizeKey(p.name) || normalizeKey(p.nameAr);
      if (!key) return true; // keep if no key info
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    setImportPreview(uniquePreview);
    setPreviewPage(1);
    setImportStep('preview');

    toast({
      title: "تم إنشاء المعاينة",
      description: `تم تحضير ${uniquePreview.length} منتج للاستيراد (تم إزالة التكرارات)`,
    });
  };

  const executeImport = async () => {
    // Skip items that already exist in current products by sku/name/nameAr
    const incoming = importPreview.filter((item) => {
      const exists = products.some((p) => isSameProduct(p, item));
      return !exists;
    });

    try {
      await Promise.all(incoming.map(async (productData, index) => {
        const categoryId = productData.category ? String(productData.category) : undefined;
        const categoryObj = categoryId ? categories.find(c => String(c.id) === categoryId) : undefined;
        const payload: Partial<BackendProduct> = {
          name: productData.name || `Imported ${index + 1}`,
          nameAr: productData.nameAr || productData.name || `منتج ${index + 1}`,
          price: Number(productData.price) || 0,
          description: productData.description,
          image: (productData.images && productData.images[0]) || productData.image,
          images: productData.images as string[] | undefined,
          featured: Boolean(productData.featured),
          active: productData.isHidden ? false : true,
          sku: productData.sku || `IMP-${Date.now()}-${index}`,
          categoryId,
          categorySlug: categoryObj?.slug,
        };
        await apiPostJson<ProductItemResponse, Partial<BackendProduct>>('/api/products', payload);
      }));
      await refetchProducts();
      toast({ title: 'تم استيراد المنتجات', description: `تمت إضافة ${incoming.length} منتج جديد` });
      void logHistory({ section: 'products', action: 'import_completed', note: `Imported ${incoming.length} products`, meta: { count: incoming.length } });
      setImportStep('complete');
      setTimeout(() => {
        resetImportState();
        setIsImportModalOpen(false);
      }, 1500);
    } catch (e) {
      toast({ title: 'فشل استيراد بعض المنتجات', variant: 'destructive' });
    }
  };

  const executeUpdate = async () => {
    let updatedCount = 0;
    try {
      await Promise.all(products.map(async (existingProduct) => {
        const updateData = importPreview.find(item => isMatchByStrategy(existingProduct, item));
        if (!updateData) return;
        const rawUpdatePrice: unknown = (updateData as unknown as { price?: unknown }).price;
        const incomingPrice = parsePriceValue(rawUpdatePrice);
        const hasNewPrice = Number.isFinite(incomingPrice);
        if (hasNewPrice && incomingPrice !== existingProduct.price) {
          updatedCount++;
          await apiPutJson<ProductItemResponse, Partial<BackendProduct>>(`/api/products/${existingProduct.id}`, {
            price: incomingPrice,
          });
        }
      }));
      await refetchProducts();
      toast({ title: 'تم تحديث الأسعار', description: `تم تحديث أسعار ${updatedCount} منتج` });
      void logHistory({ section: 'products', action: 'import_update_completed', note: `Updated prices for ${updatedCount} products`, meta: { count: updatedCount } });
      setImportStep('complete');
      setTimeout(() => {
        resetImportState();
        setIsUpdateModalOpen(false);
      }, 1500);
    } catch (e) {
      toast({ title: 'فشل تحديث الأسعار لبعض المنتجات', variant: 'destructive' });
    }
  };

  const resetImportState = () => {
    setImportFile(null);
    setExtractedData([]);
    setColumnMapping({});
    setImportPreview([]);
    setImportStep('upload');
    setIsProcessing(false);
    setPreviewPerPage(10);
    setPreviewPage(1);
    setBulkCategoryId('');
  };

  const [columnWidths, setColumnWidths] = useState({
    image: 90,
    name: 240,
    sku: 120,
    category: 180,
    price: 120,
    visibility: 120,
    status: 120,
    actions: 160,
  });

  const [density, setDensity] = useState<'compact' | 'comfortable'>('comfortable');

  // Initialize state from URL params once on mount
  useEffect(() => {
    if (didInitFromParams.current) return;
    didInitFromParams.current = true;
    try {
      const q = searchParams.get('search') || '';
      const cat = searchParams.get('category') || '';
      const pageStr = searchParams.get('page');
      const perStr = searchParams.get('perPage');
      if (q) setSearchTerm(q);
      if (cat) setSelectedCategory(cat);
      if (pageStr) {
        const n = Number(pageStr);
        if (Number.isFinite(n) && n > 0) setCurrentPage(n);
      }
      if (perStr) {
        const n = Number(perStr);
        if (Number.isFinite(n) && n > 0) setItemsPerPage(n);
      }
    } catch {
      // ignore malformed URL params
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync state -> URL params
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const setOrDelete = (key: string, val: string | number | undefined) => {
      const str = val === undefined || val === null ? '' : String(val);
      if (str && str !== 'all' && str !== '0') next.set(key, str);
      else next.delete(key);
    };
    setOrDelete('search', searchTerm.trim());
    setOrDelete('category', selectedCategory);
    setOrDelete('page', currentPage);
    setOrDelete('perPage', itemsPerPage);
    // Only update if changed to avoid re-renders
    const changed = next.toString() !== searchParams.toString();
    if (changed) setSearchParams(next, { replace: true });
  }, [searchTerm, selectedCategory, currentPage, itemsPerPage, searchParams, setSearchParams]);

  // Keyboard shortcuts: N (add), E (edit selected), Del (delete), F (focus search)
  useEffect(() => {
    const isTyping = (el: EventTarget | null) => {
      if (!(el instanceof HTMLElement)) return false;
      const tag = el.tagName.toLowerCase();
      const editable = el.getAttribute('contenteditable');
      return tag === 'input' || tag === 'textarea' || tag === 'select' || editable === 'true';
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (isTyping(e.target)) return;
      const key = e.key.toLowerCase();
      if (key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (key === 'n') {
        e.preventDefault();
        resetForm();
        setIsCreateModalOpen(true);
      } else if (key === 'e') {
        if (selectedIds.size === 1) {
          e.preventDefault();
          const id = Array.from(selectedIds)[0];
          const p = products.find(p => String(p.id) === String(id)) || paginatedProducts.find(p => String(p.id) === String(id));
          if (p) handleEdit(p);
        }
      } else if (e.key === 'Delete') {
        if (selectedIds.size > 0) {
          e.preventDefault();
          applyBulkDelete();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, products, paginatedProducts, applyBulkDelete]);

  // Keep sticky header exactly under the toolbar by syncing the toolbar height to a CSS var
  useEffect(() => {
    const updateStickyVars = () => {
      const toolbar = document.querySelector('.sticky-toolbar') as HTMLElement | null;
      const height = toolbar ? toolbar.offsetHeight : 52; // ~3.25rem fallback
      const top = toolbar ? toolbar.offsetTop : 56; // ~3.5rem fallback
      const theadTop = top + height;
      document.documentElement.style.setProperty('--sticky-toolbar-height', `${height}px`);
      document.documentElement.style.setProperty('--sticky-thead-top', `${theadTop}px`);
    };
    updateStickyVars();
    window.addEventListener('resize', updateStickyVars);
    return () => window.removeEventListener('resize', updateStickyVars);
  }, [density]);

  const startResize = (key: keyof typeof columnWidths) => (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = columnWidths[key];
    const onMove = (me: MouseEvent) => {
      const delta = me.clientX - startX;
      // RTL: dragging left should increase width, so subtract delta
      const next = Math.max(72, startWidth - delta);
      setColumnWidths((prev) => ({ ...prev, [key]: next }));
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary/5 to-secondary/10">
        {/* Enhanced Mobile-First Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              إدارة المنتجات
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium mt-1 sm:mt-2">إدارة كتالوج المنتجات والمخزون</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={() => window.location.reload()}
              className="flex-1 sm:flex-none bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 shadow-md text-xs sm:text-sm"
            >
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">تحديث البيانات</span>
              <span className="sm:hidden">تحديث</span>
            </Button>
            <Button
              variant="outline"
              size={isMobile ? "sm" : "default"}
              onClick={() => navigate('/admin/categories')}
              className="flex-1 sm:flex-none bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-primary hover:from-primary/10 hover:to-primary/20 shadow-md text-xs sm:text-sm"
            >
              <Tag className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">إدارة الفئات</span>
              <span className="sm:hidden">الفئات</span>
            </Button>
          </div>
        </div>

        {/* Revolutionary Mobile-First Stats Cards */}
        {isMobile ? (
          <div className="space-y-4 mb-6">
            {/* Mobile: Horizontal Scroll Stats */}
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
              <div className="flex-shrink-0 w-64 bg-gradient-to-br from-primary to-secondary text-white rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <Package className="w-8 h-8 text-white/80" />
                  <div className="text-right">
                    <p className="text-white/80 text-sm font-medium">إجمالي المنتجات</p>
                    <p className="text-3xl font-black">{filteredProducts.length}</p>
                  </div>
                </div>
                <div className="bg-white/20 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-white/80 text-sm">نشط</span>
                    <span className="text-white font-bold">{filteredProducts.filter(p => !p.isHidden).length}</span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-64 bg-gradient-to-br from-green-500 to-emerald-600 text-white rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <DollarSign className="w-8 h-8 text-green-100" />
                  <div className="text-right">
                    <p className="text-green-100 text-sm font-medium">قيمة المخزون</p>
                    <p className="text-3xl font-black">{(filteredProducts.reduce((sum, p) => sum + (p.price * p.stock), 0)).toLocaleString()}</p>
                  </div>
                </div>
                <div className="bg-green-400/30 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-green-100 text-sm">ج.م</span>
                    <span className="text-white font-bold">إجمالي</span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-64 bg-gradient-to-br from-purple-500 to-violet-600 text-white rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <Tag className="w-8 h-8 text-purple-100" />
                  <div className="text-right">
                    <p className="text-purple-100 text-sm font-medium">الفئات النشطة</p>
                    <p className="text-3xl font-black">{categories.length}</p>
                  </div>
                </div>
                <div className="bg-purple-400/30 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-purple-100 text-sm">فئة</span>
                    <span className="text-white font-bold">متاح</span>
                  </div>
                </div>
              </div>

              <div className="flex-shrink-0 w-64 bg-gradient-to-br from-orange-500 to-red-600 text-white rounded-2xl p-4 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <AlertTriangle className="w-8 h-8 text-orange-100" />
                  <div className="text-right">
                    <p className="text-orange-100 text-sm font-medium">مخزون منخفض</p>
                    <p className="text-3xl font-black">{filteredProducts.filter(p => p.stock < 10).length}</p>
                  </div>
                </div>
                <div className="bg-orange-400/30 rounded-xl p-3">
                  <div className="flex justify-between items-center">
                    <span className="text-orange-100 text-sm">تنبيه</span>
                    <span className="text-white font-bold">عاجل</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
            <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-primary text-xs md:text-sm font-semibold">إجمالي المنتجات</p>
                    <p className="text-2xl md:text-3xl font-black text-primary">{filteredProducts.length}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-primary rounded-xl flex items-center justify-center shadow-lg">
                    <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-green-600 text-xs md:text-sm font-semibold">المنتجات المرئية</p>
                    <p className="text-2xl md:text-3xl font-black text-green-900">
                      {filteredProducts.filter(p => !p.isHidden).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Eye className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-amber-600 text-xs md:text-sm font-semibold">المنتجات المميزة</p>
                    <p className="text-2xl md:text-3xl font-black text-amber-900">
                      {filteredProducts.filter(p => p.featured).length}
                    </p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Star className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300">
              <CardContent className="p-4 md:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-purple-600 text-xs md:text-sm font-semibold">الفئات النشطة</p>
                    <p className="text-2xl md:text-3xl font-black text-purple-900">{categories.length}</p>
                  </div>
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                    <Tag className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Redesigned Control Section - Clean & Organized */}
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-2xl shadow-xl mb-6 overflow-hidden">
          {/* Top Row: Title + Product Count + Primary Actions */}
          <div className="p-4 md:p-5 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              {/* Title & Count */}
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-secondary rounded-xl flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold text-slate-900">جدول المنتجات</h2>
                  <p className="text-xs md:text-sm text-slate-500">
                    {filteredProducts.length} منتج {selectedCategory && selectedCategory !== 'all' ? 'في الفئة المحددة' : 'إجمالي'}
                  </p>
                </div>
              </div>

              {/* Primary Actions - Desktop */}
              <div className="hidden md:flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { resetImportState(); setIsImportModalOpen(true); }}
                  className="bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700 shadow-sm"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  استيراد
                </Button>
                <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen} modal={false}>
                  <Button
                    onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                    className="bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg text-white font-medium px-5"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    إضافة منتج
                  </Button>
                  <DialogContent
                    className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-3xl"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                  >
                    <DialogHeader className="pb-6 border-b border-slate-200/50">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-gradient-to-r from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
                          <Plus className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <DialogTitle className="text-3xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                            إضافة منتج جديد
                          </DialogTitle>
                          <DialogDescription className="text-lg text-slate-600 font-medium mt-1">
                            أدخل تفاصيل المنتج الجديد وقم بإضافته إلى المتجر
                          </DialogDescription>
                        </div>
                      </div>
                    </DialogHeader>
                    <ProductForm
                      formData={formData}
                      setFormData={setFormData}
                      categories={categories}
                      editingProduct={editingProduct}
                      handleSubmit={handleSubmit}
                      generateSKU={generateSKU}
                      hidePrices={hidePrices}
                      key="create"
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </div>

          {/* Bottom Row: Filters & Search */}
          <div className="p-4 md:p-5 bg-slate-50/50">
            <div className="flex flex-col md:flex-row gap-3">
              {/* Category Filter */}
              <div className="w-full md:w-48">
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm">
                    <SelectValue placeholder="جميع الفئات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الفئات</SelectItem>
                    {categories.map(category => (
                      <SelectItem key={category.id} value={category.id}>
                        {category.nameAr}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="البحث بالاسم أو الكود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 h-10 bg-white border-slate-200 shadow-sm"
                  ref={searchInputRef}
                />
              </div>

              {/* Per Page Selector */}
              <div className="w-full md:w-28">
                <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
                  <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10 / صفحة</SelectItem>
                    <SelectItem value="25">25 / صفحة</SelectItem>
                    <SelectItem value="50">50 / صفحة</SelectItem>
                    <SelectItem value="100">100 / صفحة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Export Button */}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-10 w-10 bg-white border-slate-200 shadow-sm hidden md:flex"
                      onClick={() => {
                        const data = filteredProducts.map(p => ({
                          الاسم: p.nameAr,
                          الكود: p.sku,
                          السعر: p.price,
                          الفئة: categories.find(c => c.id === p.category)?.nameAr || '',
                          الحالة: p.isHidden ? 'مخفي' : 'ظاهر'
                        }));
                        const ws = XLSX.utils.json_to_sheet(data);
                        const wb = XLSX.utils.book_new();
                        XLSX.utils.book_append_sheet(wb, ws, 'Products');
                        XLSX.writeFile(wb, 'products-export.xlsx');
                      }}
                    >
                      <FileSpreadsheet className="w-4 h-4 text-slate-600" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>تصدير Excel</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>

            {/* Mobile Actions Row */}
            <div className="flex md:hidden gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetImportState(); setIsImportModalOpen(true); }}
                className="flex-1 h-10 bg-white border-slate-200"
              >
                <Upload className="w-4 h-4 mr-2" />
                استيراد
              </Button>
              <Button
                onClick={() => { resetForm(); setIsCreateModalOpen(true); }}
                className="flex-1 h-10 bg-gradient-to-r from-primary to-secondary text-white"
              >
                <Plus className="w-4 h-4 mr-2" />
                إضافة منتج
              </Button>
            </div>
          </div>
        </div>

        {/* Revolutionary Mobile vs Desktop Layout */}
        {isMobile ? (
          <div className="space-y-4">
            {/* Mobile: Revolutionary Card-Based Layout with Bigger Image Space */}
            {paginatedProducts.map((product) => (
              <div key={product.id} className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg overflow-hidden">
                {/* Mobile Layout: Image-First Design */}
                <div className="flex">
                  {/* Large Image Section - Takes More Space */}
                  <div className="w-32 flex-shrink-0 relative">
                    <div className="w-full h-32 relative">
                      {product.image ? (
                        <img
                          src={optimizeImage(product.image, { w: 256 })}
                          alt={product.nameAr}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center">
                          <Package className="w-8 h-8 text-slate-500" />
                        </div>
                      )}
                      {/* Selection Checkbox */}
                      <div className="absolute bottom-2 right-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(product.id)}
                          onChange={(e) => {
                            const newSet = new Set(selectedIds);
                            if (e.target.checked) newSet.add(product.id);
                            else newSet.delete(product.id);
                            setSelectedIds(newSet);
                          }}
                          className="w-4 h-4 text-primary rounded border-slate-300 shadow-md"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Product Details Section */}
                  <div className="flex-1 p-4 flex flex-col justify-between">
                    {/* Top Row: Name, Price, and Status in same line */}
                    <div className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-bold text-slate-900 text-base leading-tight">{product.nameAr}</h3>
                          <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
                        </div>
                      </div>

                      {/* Second Row: Price and Active Status with Featured Flag */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <DollarSign className="w-5 h-5 text-green-600" />
                          <span className="font-bold text-xl text-green-600">{product.price.toFixed(2)} ج.م</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {product.featured && (
                            <Badge className="bg-yellow-500 text-white text-xs">
                              <Star className="w-3 h-3 mr-1" />
                              مميز
                            </Badge>
                          )}
                          <Badge
                            variant={!product.isHidden ? "default" : "secondary"}
                            className={`text-xs ${!product.isHidden
                                ? 'bg-green-500 hover:bg-green-600 text-white'
                                : 'bg-slate-400 text-white'
                              }`}
                          >
                            {!product.isHidden ? 'نشط' : 'غير نشط'}
                          </Badge>
                        </div>
                      </div>

                      {/* Third Row: Category */}
                      <div className="flex items-center">
                        <Badge variant="secondary" className="text-xs">
                          {categories.find(c => c.id === product.category)?.nameAr || 'غير محدد'}
                        </Badge>
                      </div>
                    </div>

                    {/* Bottom Row: All Action Buttons */}
                    <div className="flex items-center gap-1 mt-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newProducts = products.map(p =>
                            p.id === product.id
                              ? { ...p, isHidden: !p.isHidden, updatedAt: new Date().toISOString() }
                              : p
                          );
                          setProducts(newProducts);
                        }}
                        className="flex-1 text-xs h-8"
                      >
                        {!product.isHidden ? 'إخفاء' : 'إظهار'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const newProducts = products.map(p =>
                            p.id === product.id
                              ? { ...p, featured: !p.featured, updatedAt: new Date().toISOString() }
                              : p
                          );
                          setProducts(newProducts);
                        }}
                        className="flex-1 text-xs h-8"
                      >
                        {product.featured ? 'إزالة التمييز' : 'جعل مميز'}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleEdit(product)}
                        className="flex-1 p-1.5 text-xs h-8"
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          if (confirm('هل أنت متأكد من حذف هذا المنتج؟')) {
                            void handleDelete(product.id);
                          }
                        }}
                        className="flex-1 p-1.5 text-red-600 hover:bg-red-50 text-xs h-8"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Desktop: Traditional Table Layout */
          <Card className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-2xl rounded-xl md:rounded-2xl overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-slate-50 via-primary/5 to-secondary/5 border-b border-slate-200/50 p-4 md:p-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 md:gap-4">
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-secondary rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                    <ShoppingBag className="w-5 h-5 md:w-6 md:h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-lg md:text-2xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      جدول المنتجات ({filteredProducts.length})
                    </CardTitle>
                    <CardDescription className="text-sm md:text-lg text-slate-600 font-medium">
                      <span className="hidden sm:inline">
                        عرض {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} من أصل {filteredProducts.length} منتج
                      </span>
                      <span className="sm:hidden">
                        {filteredProducts.length} منتج
                      </span>
                    </CardDescription>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs md:text-sm font-semibold text-slate-700 whitespace-nowrap">لكل صفحة:</Label>
                    <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                      <SelectTrigger className="w-16 md:w-20 bg-white/80 border-slate-300 shadow-md text-xs md:text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5</SelectItem>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="20">20</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 shadow-md"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    تصدير
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-6">
              {selectedIds.size > 0 && (
                <div className="sticky top-0 z-20 mb-6 p-4 rounded-2xl border-2 border-primary/20 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/10 backdrop-blur-sm shadow-xl flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-r from-primary to-secondary rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-white text-sm font-bold">{selectedIds.size}</span>
                    </div>
                    <span className="text-lg font-bold text-primary">تم تحديد {selectedIds.size} منتج</span>
                  </div>
                  <Select value={bulkAction} onValueChange={(v: string) => setBulkAction(v === 'delete' ? 'delete' : v === 'change_category' ? 'change_category' : v === 'price_adjust' ? 'price_adjust' : 'none')}>
                    <SelectTrigger className="w-48 bg-white/80 border-primary/20 shadow-md">
                      <SelectValue placeholder="اختر إجراءً" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="delete">حذف</SelectItem>
                      <SelectItem value="change_category">تغيير الفئة</SelectItem>
                      <SelectItem value="price_adjust">تعديل السعر</SelectItem>
                    </SelectContent>
                  </Select>

                  {bulkAction === 'change_category' && (
                    <Select value={bulkListCategoryId} onValueChange={setBulkListCategoryId}>
                      <SelectTrigger className="w-60 bg-white/80 border-slate-200 shadow-md">
                        <SelectValue placeholder="اختر الفئة الجديدة" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={String(cat.id)} value={String(cat.id)}>
                            {cat.nameAr || cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  {bulkAction === 'price_adjust' && (
                    <div className="flex items-center gap-2">
                      <Select value={priceAdjustSign} onValueChange={(v) => setPriceAdjustSign(v as 'increase' | 'decrease')}>
                        <SelectTrigger className="w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="increase">زيادة</SelectItem>
                          <SelectItem value="decrease">تخفيض</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select value={priceAdjustMode} onValueChange={(v) => setPriceAdjustMode(v as 'percent' | 'absolute')}>
                        <SelectTrigger className="w-28">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percent">٪ نسبة</SelectItem>
                          <SelectItem value="absolute">قيمة ثابتة</SelectItem>
                        </SelectContent>
                      </Select>

                      <div className="relative">
                        <Input
                          type="number"
                          className="w-28 text-center pr-6"
                          value={priceAdjustValue}
                          onChange={(e) => setPriceAdjustValue(e.target.value)}
                          placeholder={priceAdjustMode === 'percent' ? '10' : '5'}
                          min={0}
                          step={priceAdjustMode === 'percent' ? 1 : 0.5}
                        />
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                          {priceAdjustMode === 'percent' ? '%' : 'ج.م'}
                        </span>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => bulkAction === 'delete' ? applyBulkDelete() : bulkAction === 'change_category' ? applyBulkChangeCategoryList() : applyBulkPriceAdjust()}
                    disabled={isApplyingBulk || bulkAction === 'none' || (bulkAction === 'change_category' && !bulkListCategoryId)}
                    className="bg-slate-900 hover:bg-slate-800"
                  >
                    {isApplyingBulk ? (
                      <span className="inline-flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التنفيذ
                      </span>
                    ) : (
                      'تنفيذ'
                    )}
                  </Button>
                  <Button variant="outline" onClick={() => { setSelectedIds(new Set()); setBulkAction('none'); setBulkListCategoryId(''); }}>إلغاء التحديد</Button>
                </div>
              )}
              {/* Mobile-Responsive Table Container */}
              <div className="overflow-x-auto rounded-xl md:rounded-2xl border border-slate-200/50 shadow-lg">
                <div className="min-w-[800px] md:min-w-0"> {/* Ensure minimum width for mobile horizontal scroll */}
                  <TooltipProvider>
                    <Table className={`table-zebra table-fixed bg-white/50 ${density === 'compact' ? 'density-compact' : 'density-comfortable'}`}>
                      <TableHeader className="sticky-thead bg-gradient-to-r from-slate-100 via-primary/5 to-secondary/5">
                        <TableRow className="border-b-2 border-slate-200/50">
                          <TableHead className="w-12 text-center whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold"></TableHead>
                          <TableHead className="w-10 text-center whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold">
                            <input
                              type="checkbox"
                              aria-label="تحديد الكل"
                              checked={paginatedProducts.length > 0 && paginatedProducts.every(p => selectedIds.has(String(p.id)))}
                              onChange={toggleSelectAllOnPage}
                              className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                            />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.image }}>
                            <div className="flex items-center justify-center gap-2">
                              <FileImage className="w-4 h-4 text-primary" />
                              <span>صورة المنتج</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('image')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.name }}>
                            <div className="flex items-center justify-center gap-2">
                              <Package className="w-4 h-4 text-primary" />
                              <span>اسم المنتج</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('name')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.sku }}>

                            <div className="flex items-center justify-center gap-2">
                              <Tag className="w-4 h-4 text-primary" />
                              <span>الكود</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('sku')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.category }}>
                            <div className="flex items-center justify-center gap-2">
                              <FileText className="w-4 h-4 text-primary" />
                              <span>الفئة</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('category')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.price }}>
                            <div className="flex items-center justify-center gap-2">
                              <DollarSign className="w-4 h-4 text-primary" />
                              <span>السعر</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('price')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.visibility }}>
                            <div className="flex items-center justify-center gap-2">
                              <EyeOff className="w-4 h-4 text-primary" />
                              <span>الظهور</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('visibility')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.status }}>
                            <div className="flex items-center justify-center gap-2">
                              <Clock className="w-4 h-4 text-primary" />
                              <span>الحالة</span>
                            </div>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('status')} />
                          </TableHead>
                          <TableHead className="text-center relative select-none whitespace-nowrap bg-gradient-to-r from-slate-100 to-primary/5 font-bold text-slate-700"
                            style={{ width: columnWidths.actions }}>
                            <span>الإجراءات</span>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('actions')} />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedProducts.map((product) => (
                          <Fragment key={product.id}>
                            {/* Enhanced Main Row */}
                            <TableRow
                              key={product.id}
                              className={`hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-300 border-l-4 ${expandedRows.has(product.id) ? 'bg-gradient-to-r from-primary/5 to-secondary/5 border-l-primary shadow-md' : 'border-l-transparent hover:border-l-primary/30'}`}
                            >
                              <TableCell className="w-12">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => toggleRowExpansion(product.id)}
                                  className="p-2 hover:bg-primary/10 rounded-xl transition-all duration-200 hover:shadow-md"
                                >
                                  {expandedRows.has(product.id) ? (
                                    <ChevronDown className="w-4 h-4 text-primary" />
                                  ) : (
                                    <ChevronRight className="w-4 h-4 text-slate-600 hover:text-primary" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="w-10 text-center">
                                <input
                                  type="checkbox"
                                  aria-label={`تحديد ${product.nameAr}`}
                                  checked={selectedIds.has(String(product.id))}
                                  onChange={() => toggleSelectOne(String(product.id))}
                                  className="w-4 h-4 text-primary bg-gray-100 border-gray-300 rounded focus:ring-primary focus:ring-2"
                                />
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.image }}>
                                <div className="relative inline-block group">
                                  <img
                                    src={optimizeImage(getProductPrimaryImage(product) || '', { w: 64 })}
                                    alt={product.nameAr}
                                    className="w-14 h-14 object-cover rounded-2xl border-2 border-slate-200 shadow-lg transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl cursor-zoom-in ring-2 ring-transparent group-hover:ring-blue-200"
                                    loading="lazy"
                                    decoding="async"
                                    srcSet={buildSrcSet(getProductPrimaryImage(product) || '', 64)}
                                    sizes="64px"
                                    onClick={() => {
                                      const src = getProductPrimaryImage(product);
                                      if (src) setImagePreview(src);
                                    }}
                                  />
                                  {product.featured && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                      <Star className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.name }}>
                                <div className="space-y-1">
                                  {editingField && editingField.id === product.id && editingField.field === 'name' ? (
                                    <Input
                                      autoFocus
                                      value={editingField.value}
                                      onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                                      onBlur={commitInlineEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitInlineEdit();
                                        if (e.key === 'Escape') cancelInlineEdit();
                                      }}
                                      className="h-8 text-center"
                                    />
                                  ) : (
                                    <div
                                      className="group inline-flex items-center justify-center gap-1 cursor-text"
                                      onClick={() => startInlineEdit(product, 'name')}
                                      title="انقر للتعديل"
                                    >
                                      <p className="font-medium text-slate-900 whitespace-nowrap overflow-hidden text-ellipsis">
                                        {product.nameAr || product.name}
                                      </p>
                                      <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  )}
                                  {product.tags && product.tags.length > 0 && (
                                    <div className="flex gap-1 justify-center">
                                      {product.tags.slice(0, 2).map((tag, index) => (
                                        <Badge key={index} variant="secondary" className="text-xs">
                                          {tag}
                                        </Badge>
                                      ))}
                                      {product.tags.length > 2 && (
                                        <Badge variant="secondary" className="text-xs">
                                          +{product.tags.length - 2}
                                        </Badge>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.sku }}>
                                {editingField && editingField.id === product.id && editingField.field === 'sku' ? (
                                  <Input
                                    autoFocus
                                    value={editingField.value}
                                    onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                                    onBlur={commitInlineEdit}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') commitInlineEdit();
                                      if (e.key === 'Escape') cancelInlineEdit();
                                    }}
                                    className="h-8 text-center font-mono"
                                  />
                                ) : (
                                  <div className="group inline-flex items-center justify-center gap-1 cursor-text" onClick={() => startInlineEdit(product, 'sku')} title="انقر للتعديل">
                                    <Badge variant="outline" className="font-mono">
                                      {product.sku}
                                    </Badge>
                                    <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                  </div>
                                )}
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.category }}>
                                <div className="space-y-1">
                                  {(() => {
                                    const cat = categories.find(c => String(c.id) === String(product.category) || c.slug === product.category);
                                    const displayName = cat ? (cat.nameAr || cat.name) : (product.categoryAr || '—');
                                    const displayCode = cat ? (cat.slug || String(cat.id)) : String(product.category || '');
                                    return (
                                      <>
                                        <p className="text-sm font-medium whitespace-nowrap overflow-hidden text-ellipsis">{displayName}</p>
                                        <p className="text-xs text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis">{displayCode}</p>
                                      </>
                                    );
                                  })()}
                                </div>
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.price }}>
                                <div className="space-y-1">
                                  {editingField && editingField.id === product.id && editingField.field === 'price' ? (
                                    <Input
                                      autoFocus
                                      type="number"
                                      value={editingField.value}
                                      onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
                                      onBlur={commitInlineEdit}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') commitInlineEdit();
                                        if (e.key === 'Escape') cancelInlineEdit();
                                      }}
                                      className="h-8 text-center"
                                    />
                                  ) : (
                                    <div className="group inline-flex items-center justify-center gap-1 cursor-text" onClick={() => startInlineEdit(product, 'price')} title="انقر للتعديل">
                                      <p className="font-medium text-green-600">{product.price.toLocaleString()} ج.م</p>
                                      <Edit className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </div>
                                  )}
                                  {product.originalPrice && (
                                    <p className="text-sm text-slate-500 line-through">
                                      {product.originalPrice.toLocaleString()} ج.م
                                    </p>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.visibility }}>
                                <div className="flex items-center justify-center gap-2">
                                  <Checkbox
                                    id={`hidden-${product.id}`}
                                    checked={!!product.isHidden}
                                    onCheckedChange={(checked) => handleToggleVisibility(product.id, Boolean(checked))}
                                  />
                                  <Label htmlFor={`hidden-${product.id}`}>مخفي</Label>
                                </div>
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.status }}>
                                <div className="flex items-center justify-center gap-2">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`dot ${product.isHidden ? 'dot-warning' : 'dot-success'}`} />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                      {product.isHidden ? 'هذا المنتج مخفي' : 'هذا المنتج ظاهر'}
                                    </TooltipContent>
                                  </Tooltip>
                                  <span className="text-sm">
                                    {product.isHidden ? 'مخفي' : 'ظاهر'}
                                  </span>
                                  {product.featured && (
                                    <Badge variant="secondary" className="bg-amber-50 text-amber-700 border-amber-200">
                                      مميز
                                    </Badge>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="text-center" style={{ width: columnWidths.actions }}>
                                <div className="flex items-center justify-center gap-1">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleEdit(product)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>تحرير</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDuplicate(product)}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Copy className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>نسخ</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => window.open(`/product/${product.id}`, '_blank')}
                                        className="h-8 w-8 p-0"
                                      >
                                        <Eye className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>عرض</TooltipContent>
                                  </Tooltip>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => handleDelete(product.id)}
                                        className="h-8 w-8 p-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>حذف</TooltipContent>
                                  </Tooltip>
                                </div>
                              </TableCell>
                            </TableRow>

                            {/* Expanded Row Details */}
                            {expandedRows.has(product.id) && (
                              <TableRow className="bg-primary/5">
                                <TableCell colSpan={10} className="p-0">
                                  <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                      {/* Product Details */}
                                      <div className="space-y-3">
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                          <FileText className="w-4 h-4" />
                                          تفاصيل المنتج
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">الوصف:</span>
                                            <span className="font-medium max-w-48 truncate">{product.description || product.descriptionAr || 'غير محدد'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">الوزن:</span>
                                            <span className="font-medium">{product.weight || 'غير محدد'}</span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">منتج مميز:</span>
                                            <Badge variant={product.featured ? "default" : "secondary"}>
                                              {product.featured ? 'نعم' : 'لا'}
                                            </Badge>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Timestamps */}
                                      <div className="space-y-3">
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                          <Clock className="w-4 h-4" />
                                          التواريخ
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">تاريخ الإنشاء:</span>
                                            <span className="font-medium">
                                              {product.createdAt ? new Date(product.createdAt).toLocaleDateString('ar-EG-u-ca-gregory') : 'غير محدد'}
                                            </span>
                                          </div>
                                          <div className="flex justify-between">
                                            <span className="text-slate-600">آخر تحديث:</span>
                                            <span className="font-medium">
                                              {product.updatedAt ? new Date(product.updatedAt).toLocaleDateString('ar-EG-u-ca-gregory') : 'غير محدد'}
                                            </span>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Additional Images */}
                                      <div className="space-y-3">
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                          <FileImage className="w-4 h-4" />
                                          الصور الإضافية
                                        </h4>
                                        {product.images && product.images.length > 0 ? (
                                          <div className="flex gap-2 flex-wrap">
                                            {product.images.slice(0, 4).map((image, index) => (
                                              <img
                                                key={index}
                                                src={optimizeImage(image || '', { w: 120 })}
                                                alt={product.nameAr}
                                                className="w-14 h-14 object-cover rounded-md border"
                                                loading="lazy"
                                                decoding="async"
                                                srcSet={buildSrcSet(image || '', 120)}
                                                sizes="120px"
                                              />
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-slate-500">لا توجد صور إضافية</p>
                                        )}
                                      </div>

                                      {/* Actions */}
                                      <div className="space-y-3">
                                        <h4 className="font-semibold text-slate-900 flex items-center gap-2">
                                          <Tag className="w-4 h-4" />
                                          الوسوم
                                        </h4>
                                        {product.tags && product.tags.length > 0 ? (
                                          <div className="flex gap-2 flex-wrap">
                                            {product.tags.map((tag, index) => (
                                              <Badge key={index} variant="secondary">
                                                {tag}
                                              </Badge>
                                            ))}
                                          </div>
                                        ) : (
                                          <p className="text-sm text-slate-500">لا توجد وسوم</p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </Fragment>
                        ))}
                      </TableBody>
                    </Table>
                  </TooltipProvider>
                </div> {/* End min-width container */}
              </div>

              {/* Mobile-Responsive Pagination */}
              {totalPages > 1 && (
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-4 md:mt-6 pt-3 md:pt-4 border-t">
                  <div className="text-xs md:text-sm text-slate-600 flex flex-col sm:flex-row items-center gap-2 md:gap-3">
                    <span className="text-center sm:text-left">
                      صفحة {currentPage} من {totalPages} • إجمالي {filteredProducts.length} منتج
                    </span>
                    {/* Mobile-friendly per-page control */}
                    <div className="flex items-center gap-1 md:gap-2">
                      <span className="text-slate-600 text-xs md:text-sm whitespace-nowrap">لكل صفحة:</span>
                      <Select
                        value={String(itemsPerPage)}
                        onValueChange={(val) => { setItemsPerPage(Number(val)); setCurrentPage(1); }}
                      >
                        <SelectTrigger className="h-7 md:h-8 w-16 md:w-[88px] text-xs md:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent align="end">
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 md:gap-2">
                    {/* Mobile: Show only essential navigation */}
                    <div className="flex sm:hidden items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="h-8 px-2 text-xs"
                      >
                        السابق
                      </Button>
                      <span className="px-2 py-1 text-xs bg-primary/10 text-primary rounded">
                        {currentPage}/{totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="h-8 px-2 text-xs"
                      >
                        التالي
                      </Button>
                    </div>

                    {/* Desktop: Full pagination controls */}
                    <div className="hidden sm:flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                        className="text-xs md:text-sm"
                      >
                        الأولى
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="text-xs md:text-sm"
                      >
                        السابق
                      </Button>

                      {/* Page Numbers - Responsive */}
                      <div className="flex gap-1">
                        {Array.from({ length: Math.min(window.innerWidth < 640 ? 3 : 5, totalPages) }, (_, i) => {
                          let pageNum;
                          const maxVisible = window.innerWidth < 640 ? 3 : 5;
                          if (totalPages <= maxVisible) {
                            pageNum = i + 1;
                          } else if (currentPage <= Math.floor(maxVisible / 2) + 1) {
                            pageNum = i + 1;
                          } else if (currentPage >= totalPages - Math.floor(maxVisible / 2)) {
                            pageNum = totalPages - maxVisible + 1 + i;
                          } else {
                            pageNum = currentPage - Math.floor(maxVisible / 2) + i;
                          }

                          return (
                            <Button
                              key={pageNum}
                              variant={currentPage === pageNum ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(pageNum)}
                              className="w-7 h-7 md:w-8 md:h-8 p-0 text-xs md:text-sm"
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="text-xs md:text-sm"
                      >
                        التالي
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="text-xs md:text-sm"
                      >
                        الأخيرة
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Empty State */}
              {filteredProducts.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">لا توجد منتجات</h3>
                  <p className="text-slate-500 mb-4">
                    {searchTerm || selectedCategory !== 'all'
                      ? 'لم يتم العثور على منتجات تطابق البحث أو الفلتر المحدد'
                      : 'لم يتم إضافة أي منتجات بعد'
                    }
                  </p>
                  {!searchTerm && selectedCategory === 'all' && (
                    <Button onClick={() => { resetForm(); setIsCreateModalOpen(true); }}>
                      <Plus className="w-4 h-4 mr-2" />
                      إضافة أول منتج
                    </Button>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mobile-Responsive Sticky bulk action footer */}
        {selectedIds.size > 0 && (
          <div className="fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/75 border-t shadow-lg">
            <div className="max-w-7xl mx-auto px-3 md:px-4 sm:px-6 lg:px-8 py-2 md:py-3 flex flex-col sm:flex-row items-center justify-between gap-2 md:gap-3">
              <div className="text-xs md:text-sm font-medium text-slate-800 text-center sm:text-left">
                تم تحديد {selectedIds.size} عنصر
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={applyBulkDelete}
                  className="gap-1 md:gap-2 flex-1 sm:flex-none text-xs md:text-sm"
                >
                  <Trash2 className="w-3 h-3 md:w-4 md:h-4" />
                  <span className="hidden sm:inline">حذف المحدد</span>
                  <span className="sm:hidden">حذف</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedIds(new Set())}
                  className="flex-1 sm:flex-none text-xs md:text-sm"
                >
                  <span className="hidden sm:inline">إلغاء التحديد</span>
                  <span className="sm:hidden">إلغاء</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        <Dialog open={deleteConfirmModal.open} onOpenChange={(open) => !deleteConfirmModal.loading && setDeleteConfirmModal(prev => ({ ...prev, open }))} modal={true}>
          <DialogContent
            className="max-w-md bg-gradient-to-br from-white/95 via-white/90 to-red-50/95 backdrop-blur-3xl border border-red-200/30 shadow-[0_32px_64px_-12px_rgba(220,38,38,0.25)] rounded-3xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader className="text-center pb-4">
              <div className="flex justify-center mb-4">
                <div className="w-16 h-16 bg-gradient-to-r from-red-500 to-red-600 rounded-full flex items-center justify-center shadow-xl animate-pulse">
                  <Trash2 className="w-8 h-8 text-white" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-black text-slate-900 mb-2">
                تأكيد حذف المنتج
              </DialogTitle>
              <DialogDescription className="text-lg text-slate-600 font-medium leading-relaxed">
                هل أنت متأكد من حذف هذا المنتج؟<br />
                <span className="text-red-600 font-bold">لا يمكن التراجع عن هذه العملية!</span>
              </DialogDescription>
            </DialogHeader>

            {deleteConfirmModal.product && (
              <div className="py-4">
                <div className="bg-gradient-to-r from-slate-50/80 to-primary/5 backdrop-blur-sm rounded-2xl p-4 border border-slate-200/50">
                  <div className="flex items-center gap-4">
                    {deleteConfirmModal.product.image && (
                      <img
                        src={optimizeImage(deleteConfirmModal.product.image || '', { w: 64 })}
                        alt={deleteConfirmModal.product.nameAr}
                        className="w-16 h-16 object-cover rounded-xl border-2 border-slate-200 shadow-md"
                        loading="lazy"
                        decoding="async"
                        srcSet={buildSrcSet(deleteConfirmModal.product.image || '', 64)}
                        sizes="64px"
                      />
                    )}
                    <div className="flex-1">
                      <h4 className="font-bold text-lg text-slate-900 mb-1">
                        {deleteConfirmModal.product.nameAr}
                      </h4>
                      <p className="text-sm text-slate-600 mb-1">
                        {deleteConfirmModal.product.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        SKU: {deleteConfirmModal.product.sku}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-center gap-3 pt-4">
              <Button
                variant="outline"
                onClick={closeDeleteConfirm}
                disabled={deleteConfirmModal.loading}
                className="h-12 px-6 text-lg bg-gradient-to-r from-slate-50 to-slate-100 border-slate-300 text-slate-700 hover:from-slate-100 hover:to-slate-200 shadow-md transition-all duration-200 hover:shadow-lg"
              >
                إلغاء
              </Button>
              <Button
                onClick={confirmDelete}
                disabled={deleteConfirmModal.loading}
                className="h-12 px-8 text-lg bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 shadow-xl transition-all duration-300 hover:shadow-2xl transform hover:scale-105"
              >
                {deleteConfirmModal.loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    جاري الحذف...
                  </span>
                ) : (
                  <div className="flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    حذف المنتج
                  </div>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Edit Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen} modal={false}>
          <DialogContent
            className="max-w-4xl max-h-[95vh] overflow-y-auto bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-3xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <DialogHeader className="pb-6 border-b border-slate-200/50">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-r from-amber-500 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <Edit className="w-6 h-6 text-white" />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-black text-slate-900 bg-gradient-to-r from-amber-600 to-orange-600 bg-clip-text text-transparent">
                    تعديل المنتج
                  </DialogTitle>
                  <DialogDescription className="text-lg text-slate-600 font-medium mt-1">
                    تعديل تفاصيل المنتج وحفظ التغييرات
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <ProductForm
              formData={formData}
              setFormData={setFormData}
              categories={categories}
              editingProduct={editingProduct}
              handleSubmit={handleSubmit}
              generateSKU={generateSKU}
              hidePrices={hidePrices}
              key={editingProduct?.id || 'edit'}
            />
          </DialogContent>
        </Dialog>

        {/* Smart Import Modal */}
        <Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen} modal={false}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] w-[90vw] overflow-visible" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Scan className="w-5 h-5" />
                استيراد المنتجات الذكي
              </DialogTitle>
              <DialogDescription>
                ارفع ملف Excel/CSV يحتوي على جدول المنتجات وسيقوم النظام بقراءته تلقائياً
              </DialogDescription>
            </DialogHeader>

            {importStep === 'upload' && (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="flex gap-4">
                      <FileSpreadsheet className="w-12 h-12 text-green-500" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">ارفع ملف المنتجات</h3>
                      <p className="text-slate-600 mb-4">
                        يدعم النظام فقط ملفات Excel/CSV التي تحتوي على جداول
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                        id="import-file"
                      />
                      <label htmlFor="import-file">
                        <Button asChild disabled={isProcessing}>
                          <span>
                            {isProcessing ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                جاري المعالجة...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                اختر ملف
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>

                {importFile && (
                  <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-green-600" />
                      <span className="font-medium">{importFile.name}</span>
                      <span className="text-sm text-slate-600">
                        ({(importFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {importStep === 'mapping' && extractedData.length > 0 && (
              <div className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="font-medium">تم استخراج البيانات بنجاح!</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    تم العثور على {extractedData.length - 1} صف من البيانات
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-4">ربط الأعمدة بحقول المنتج</h3>

                  {/* Show detected data preview */}
                  <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                    <h4 className="font-medium mb-2">البيانات المستخرجة:</h4>
                    <div className="max-h-32 overflow-y-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {extractedData[0]?.map((header, index) => (
                              <TableHead key={index} className="text-xs">{header}</TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {extractedData.slice(1, 4).map((row, rowIndex) => (
                            <TableRow key={rowIndex}>
                              {row.map((cell, cellIndex) => (
                                <TableCell key={cellIndex} className="text-xs">{cell}</TableCell>
                              ))}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                    {extractedData.length > 4 && (
                      <p className="text-xs text-slate-600 mt-2">
                        عرض 3 من أصل {extractedData.length - 1} صف
                      </p>
                    )}
                  </div>

                  <div className="space-y-4">
                    {extractedData[0]?.map((header, index) => (
                      <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="w-40 text-sm font-medium">
                          <span className="text-slate-500">العمود {index + 1}:</span>
                          <br />
                          <span className="font-bold">"{header}"</span>
                        </div>
                        <div className="flex-1">
                          <Select
                            value={columnMapping[index] || ''}
                            onValueChange={(value) => handleColumnMapping(index, value === '__ignore__' ? '' : value)}
                          >
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="اختر الحقل المطابق" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__ignore__">-- تجاهل هذا العمود --</SelectItem>
                              <SelectItem value="name">اسم المنتج (English)</SelectItem>
                              <SelectItem value="nameAr">اسم المنتج (العربية)</SelectItem>
                              <SelectItem value="price">السعر</SelectItem>
                              <SelectItem value="originalPrice">السعر الأصلي</SelectItem>
                              <SelectItem value="sku">كود المنتج</SelectItem>
                              <SelectItem value="isHidden">مخفي (true/false)</SelectItem>
                              <SelectItem value="category">الفئة (English)</SelectItem>
                              <SelectItem value="categoryAr">الفئة (العربية)</SelectItem>
                              <SelectItem value="description">الوصف (English)</SelectItem>
                              <SelectItem value="descriptionAr">الوصف (العربية)</SelectItem>
                              <SelectItem value="weight">الوزن</SelectItem>
                              <SelectItem value="featured">منتج مميز</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {columnMapping[index] && (
                          <div className="w-8">
                            <CheckCircle className="w-5 h-5 text-green-600" />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {Object.keys(columnMapping).length > 0 && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-800">
                        تم ربط {Object.keys(columnMapping).length} عمود من أصل {extractedData[0]?.length || 0}
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setImportStep('upload')} variant="outline">
                    رجوع
                  </Button>
                  <Button
                    onClick={generatePreview}
                    disabled={Object.keys(columnMapping).length === 0}
                  >
                    معاينة البيانات
                  </Button>
                </div>
              </div>
            )}

            {importStep === 'preview' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="text-lg font-semibold">معاينة المنتجات المستوردة</h3>
                  <div className="flex items-center gap-2">
                    <Label className="text-sm">عرض:</Label>
                    <Select value={previewPerPage === 'all' ? 'all' : String(previewPerPage)} onValueChange={(v) => {
                      if (v === 'all') { setPreviewPerPage('all'); setPreviewPage(1); }
                      else { setPreviewPerPage(Number(v)); setPreviewPage(1); }
                    }}>
                      <SelectTrigger className="w-28">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10</SelectItem>
                        <SelectItem value="25">25</SelectItem>
                        <SelectItem value="50">50</SelectItem>
                        <SelectItem value="all">الكل</SelectItem>
                      </SelectContent>
                    </Select>
                    {(() => {
                      const total = importPreview.length;
                      const size = previewPerPage === 'all' ? total : previewPerPage;
                      const pages = Math.max(1, Math.ceil(total / size));
                      return (
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" disabled={previewPage <= 1} onClick={() => setPreviewPage(p => Math.max(1, p - 1))}>السابق</Button>
                          <span className="text-sm">صفحة {previewPage} من {pages}</span>
                          <Button variant="outline" size="sm" disabled={previewPage >= pages} onClick={() => setPreviewPage(p => Math.min(pages, p + 1))}>التالي</Button>
                        </div>
                      );
                    })()}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Label className="text-sm">تعيين الفئة لكل العناصر:</Label>
                  <span className="text-xs text-slate-500">({categories.length} فئة)</span>
                  <Button type="button" variant="outline" size="sm" onClick={() => { refetchCategories(); }}>إعادة تحميل</Button>
                  <Select value={bulkCategoryId} onValueChange={(val) => { setBulkCategoryId(val); applyBulkCategory(val); }} onOpenChange={(open) => open ? toast({ title: 'فتح قائمة الفئات' }) : undefined}>
                    <SelectTrigger className="w-60 pointer-events-auto relative z-[1]">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent position="popper" side="bottom" align="start" className="z-[99999]" sideOffset={6}>
                      {categories.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">لا توجد فئات حالياً</div>
                      ) : (
                        categories.map(c => (
                          <SelectItem key={String(c.id)} value={String(c.id)}>{c.nameAr || c.name}</SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <Button variant="secondary" onClick={() => applyBulkCategory()}>تعيين</Button>
                </div>

                {(() => {
                  const total = importPreview.length;
                  const size = previewPerPage === 'all' ? total : previewPerPage;
                  const start = (previewPage - 1) * size;
                  const end = previewPerPage === 'all' ? total : Math.min(total, start + size);
                  const rows = importPreview.slice(start, end);
                  return (
                    <>
                      <div className="max-h-96 overflow-y-auto border rounded-lg">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>اسم المنتج</TableHead>
                              <TableHead>السعر</TableHead>
                              <TableHead>الكود</TableHead>
                              <TableHead>المخزون</TableHead>
                              <TableHead>الفئة</TableHead>
                              <TableHead className="w-20 text-center">إزالة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map((product, index) => {
                              const absoluteIndex = start + index;
                              const catMatch = categories.find(c => String(c.id) === String(product.category) || c.nameAr === product.categoryAr || c.name === product.category);
                              const catId = catMatch ? String(catMatch.id) : '';
                              return (
                                <TableRow key={absoluteIndex}>
                                  <TableCell>
                                    <Input value={String(product.nameAr ?? product.name ?? '')} onChange={(e) => {
                                      const v = e.target.value;
                                      setImportPreview(prev => prev.map((it, i) => i === absoluteIndex ? { ...it, name: v, nameAr: v } : it));
                                    }} placeholder="اسم المنتج" />
                                  </TableCell>
                                  <TableCell>
                                    <Input type="number" value={String(product.price ?? '')} onChange={(e) => updateImportItem(absoluteIndex, 'price', e.target.value)} placeholder="السعر" />
                                  </TableCell>
                                  <TableCell>
                                    <Input value={String(product.sku ?? '')} onChange={(e) => updateImportItem(absoluteIndex, 'sku', e.target.value)} placeholder="الكود" />
                                  </TableCell>
                                  <TableCell>
                                    <Input type="number" value={String(product.stock ?? '')} onChange={(e) => updateImportItem(absoluteIndex, 'stock', e.target.value)} placeholder="المخزون" />
                                  </TableCell>
                                  <TableCell>
                                    <Select value={catId} onOpenChange={(open) => open ? toast({ title: 'فتح قائمة الفئات' }) : undefined} onValueChange={(val) => {
                                      const cat = categories.find(c => String(c.id) === String(val));
                                      setImportPreview(prev => prev.map((it, i) => i === absoluteIndex ? { ...it, category: cat ? String(cat.id) : '', categoryAr: cat?.nameAr } : it));
                                    }}>
                                      <SelectTrigger className="w-44 pointer-events-auto relative z-[1]">
                                        <SelectValue placeholder="الفئة" />
                                      </SelectTrigger>
                                      <SelectContent position="popper" side="bottom" align="start" className="z-[99999]" sideOffset={6}>
                                        {categories.map(c => (
                                          <SelectItem key={String(c.id)} value={String(c.id)}>{c.nameAr || c.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="text-center">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="rounded-full hover:bg-red-50 hover:text-red-600 border-red-200/60"
                                      onClick={() => setImportPreview(prev => prev.filter((_, i) => i !== absoluteIndex))}
                                      aria-label="حذف الصف"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </div>
                      <div className="flex items-center justify-between text-sm text-slate-600 mt-2">
                        <span>عرض {end - start} من أصل {total} منتج</span>
                        <span>الصفحة {previewPage}</span>
                      </div>
                    </>
                  );
                })()}

                <div className="flex gap-2">
                  <Button onClick={() => setImportStep('mapping')} variant="outline">
                    رجوع
                  </Button>
                  <Button onClick={executeImport} className="bg-green-600 hover:bg-green-700">
                    استيراد {importPreview.length} منتج
                  </Button>
                </div>
              </div>
            )}

            {importStep === 'complete' && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-green-800 mb-2">
                  تم الاستيراد بنجاح!
                </h3>
                <p className="text-slate-600">
                  تم إضافة المنتجات إلى المتجر بنجاح
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Smart Update Modal */}
        <Dialog open={isUpdateModalOpen} onOpenChange={setIsUpdateModalOpen} modal={false}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <RefreshCw className="w-5 h-5" />
                تحديث المنتجات الذكي
              </DialogTitle>
              <DialogDescription>
                ارفع ملف Excel/CSV لتحديث الأسعار فقط للمنتجات المطابقة (سيتم المطابقة بالكود أو الاسم)
              </DialogDescription>
            </DialogHeader>

            {importStep === 'upload' && (
              <div className="space-y-6">
                <div className="border-2 border-dashed border-orange-300 rounded-lg p-8 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <RefreshCw className="w-12 h-12 text-orange-500" />
                    <div>
                      <h3 className="text-lg font-semibold mb-2">ارفع ملف التحديث</h3>
                      <p className="text-slate-600 mb-4">
                        سيتم مطابقة المنتجات بالكود أو الاسم وتحديث السعر فقط. يدعم فقط ملفات Excel/CSV.
                      </p>
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleFileUpload(file);
                        }}
                        className="hidden"
                        id="update-file"
                      />
                      <label htmlFor="update-file">
                        <Button asChild disabled={isProcessing} variant="outline">
                          <span>
                            {isProcessing ? (
                              <>
                                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                                جاري المعالجة...
                              </>
                            ) : (
                              <>
                                <Upload className="w-4 h-4 mr-2" />
                                اختر ملف
                              </>
                            )}
                          </span>
                        </Button>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reuse the same mapping and preview steps but with update logic */}
            {importStep === 'mapping' && extractedData.length > 0 && (
              <div className="space-y-6">
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-orange-600" />
                    <span className="font-medium">وضع التحديث</span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    سيتم تحديث المنتجات الموجودة فقط، لن يتم إضافة منتجات جديدة
                  </p>
                </div>

                <div>
                  <h3 className="text-lg font-semibold mb-2">ربط الأعمدة بحقول المنتج</h3>
                  <div className="flex items-center gap-4 mb-4">
                    <div className="text-sm">طريقة المطابقة:</div>
                    <Select value={matchStrategy} onValueChange={(v: 'auto' | 'sku' | 'name' | 'nameAr') => setMatchStrategy(v)}>
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="اختر الطريقة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">تلقائي (SKU ثم الاسم)</SelectItem>
                        <SelectItem value="sku">SKU فقط</SelectItem>
                        <SelectItem value="name">الاسم (EN)</SelectItem>
                        <SelectItem value="nameAr">الاسم (AR)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-4">
                    {extractedData[0]?.map((header, index) => (
                      <div key={index} className="flex items-center gap-4">
                        <div className="w-32 text-sm font-medium">
                          العمود {index + 1}: "{header}"
                        </div>
                        <Select
                          value={columnMapping[index] || ''}
                          onValueChange={(value) => handleColumnMapping(index, value === '__ignore__' ? '' : value)}
                        >
                          <SelectTrigger className="w-48">
                            <SelectValue placeholder="اختر الحقل" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__ignore__">-- تجاهل --</SelectItem>
                            <SelectItem value="name">اسم المنتج (English)</SelectItem>
                            <SelectItem value="nameAr">اسم المنتج (العربية)</SelectItem>
                            <SelectItem value="price">السعر</SelectItem>
                            <SelectItem value="originalPrice">السعر الأصلي</SelectItem>
                            <SelectItem value="sku">كود المنتج</SelectItem>
                            <SelectItem value="stock">المخزون</SelectItem>
                            <SelectItem value="category">الفئة (English)</SelectItem>
                            <SelectItem value="categoryAr">الفئة (العربية)</SelectItem>
                            <SelectItem value="description">الوصف (English)</SelectItem>
                            <SelectItem value="descriptionAr">الوصف (العربية)</SelectItem>
                            <SelectItem value="weight">الوزن</SelectItem>
                            <SelectItem value="featured">منتج مميز</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setImportStep('upload')} variant="outline">
                    رجوع
                  </Button>
                  <Button
                    onClick={generatePreview}
                    disabled={Object.keys(columnMapping).length === 0}
                  >
                    معاينة التحديثات
                  </Button>
                </div>
              </div>

            )}

            {importStep === 'preview' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">معاينة التحديثات</h3>
                  {(() => {
                    const mapped = importPreview.map((item, idx) => {
                      const existing = findExistingByStrategy(item);
                      const rawItemPrice: unknown = (item as unknown as { price?: unknown }).price;
                      const incomingPrice = parsePriceValue(rawItemPrice);
                      const hasNewPrice = Number.isFinite(incomingPrice);
                      const oldPrice = existing?.price;
                      const changed = Boolean(existing && hasNewPrice && oldPrice !== undefined && incomingPrice !== oldPrice);
                      return { item, idx, existing, incomingPrice, oldPrice, changed };
                    });
                    const changedOnly = mapped.filter(r => r.changed);
                    const unmatched = mapped.filter(r => !r.existing).length;
                    const missingPrice = mapped.filter(r => r.existing && !Number.isFinite(r.incomingPrice)).length;
                    const samePrice = mapped.filter(r => r.existing && Number.isFinite(r.incomingPrice) && r.incomingPrice === r.oldPrice).length;
                    const totalChanged = changedOnly.length;
                    return (
                      <>
                        <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                          <span>سيتم تحديث سعر {totalChanged} منتج</span>
                          <span className="flex items-center gap-3">
                            <span>غير مطابق: {unmatched}</span>
                            <span>بدون سعر: {missingPrice}</span>
                            <span>نفس السعر: {samePrice}</span>
                            <span>إجمالي الصفوف: {importPreview.length}</span>
                          </span>
                        </div>
                        {totalChanged === 0 ? (
                          <div className="p-6 text-center text-slate-500 border rounded-lg bg-slate-50">
                            لا توجد تغييرات في الأسعار في هذا الملف. تأكد من تعديل السعر أو مطابقة معرفات المنتجات (SKU/الاسم).
                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto border rounded-lg">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>اسم المنتج</TableHead>
                                  <TableHead>الكود</TableHead>
                                  <TableHead>السعر القديم</TableHead>
                                  <TableHead>السعر الجديد</TableHead>
                                  <TableHead>التغيير</TableHead>
                                  <TableHead className="w-20 text-center">إزالة</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {changedOnly.map((row, index) => {
                                  const { item, idx, oldPrice, incomingPrice } = row;
                                  const delta = (incomingPrice ?? 0) - (oldPrice ?? 0);
                                  const percent = oldPrice && oldPrice !== 0 ? (delta / oldPrice) * 100 : 0;
                                  const isIncrease = delta > 0;
                                  const badgeClass = isIncrease ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700';
                                  const sign = isIncrease ? '+' : '';
                                  return (
                                    <TableRow key={idx}>
                                      <TableCell>{item.nameAr || item.name || 'غير محدد'}</TableCell>
                                      <TableCell>{item.sku || 'غير محدد'}</TableCell>
                                      <TableCell>{oldPrice ?? '-'} ج.م</TableCell>
                                      <TableCell>{Number.isFinite(incomingPrice) ? incomingPrice : '-'} ج.م</TableCell>
                                      <TableCell>
                                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-xs font-medium ${badgeClass}`}>
                                          {sign}{delta.toFixed(2)} ج.م ({sign}{percent.toFixed(1)}%)
                                        </span>
                                      </TableCell>
                                      <TableCell className="text-center">
                                        <Button
                                          type="button"
                                          variant="outline"
                                          size="icon"
                                          className="rounded-full hover:bg-red-50 hover:text-red-600 border-red-200/60"
                                          onClick={() => setImportPreview(prev => prev.filter((_, i) => i !== idx))}
                                          aria-label="حذف الصف"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </Button>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => setImportStep('mapping')} variant="outline">
                    رجوع
                  </Button>
                  <Button onClick={executeUpdate} className="bg-orange-600 hover:bg-orange-700">
                    تحديث المنتجات
                  </Button>
                </div>
              </div>
            )}

            {importStep === 'complete' && (
              <div className="text-center py-8">
                <CheckCircle className="w-16 h-16 text-orange-600 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-orange-800 mb-2">
                  تم التحديث بنجاح!
                </h3>
                <p className="text-slate-600">
                  تم تحديث المنتجات المطابقة بنجاح
                </p>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
      <Dialog open={!!imagePreview} onOpenChange={(open) => { if (!open) setImagePreview(null); }}>
        <DialogContent className="max-w-[92vw] md:max-w-4xl p-2">
          <DialogHeader>
            <VisuallyHidden>
              <DialogTitle>معاينة الصورة</DialogTitle>
            </VisuallyHidden>
          </DialogHeader>
          <div className="w-full h-full flex items-center justify-center">
            <img src={imagePreview ?? ''} alt="معاينة الصورة" className="max-h-[85vh] w-auto object-contain rounded-md" />
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminProducts;
