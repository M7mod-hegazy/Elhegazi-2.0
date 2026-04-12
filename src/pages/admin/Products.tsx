import { useState, useEffect, Fragment, useCallback, memo, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { optimizeImage, buildSrcSet, applyProductImageFallback } from '@/lib/images';
import { buildProductPath } from '@/lib/product-link';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import AdminLayout from '@/components/admin/AdminLayout';
import { ProductFamilyMergeDialog } from '@/pages/admin/ProductFamilyMergeDialog';
import {
  ProductFamilyEditDialog,
  type AdminProductFamilyLean,
} from '@/pages/admin/ProductFamilyEditDialog';
import { clearStorefrontFamiliesCache } from '@/lib/productFamilyListings';
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
  DollarSign,
  Link2,
  Pencil,
  ArrowDownWideNarrow,
  Layers,
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
  originalPrice?: number;
  description?: string;
  image?: string;
  images?: string[];
  stock?: number;
  featured?: boolean;
  active?: boolean;
  createdAt: string;
  updatedAt: string;
  productFamilyId?: string | null;
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

type ImportRowStatus = 'ready' | 'quarantined_duplicate' | 'invalid' | 'skipped_file_duplicate';
type ImportCategoryState = 'resolved' | 'missing' | 'ambiguous';

type ImportRowReason = {
  code: string;
  message: string;
};

type ImportRowMatchTarget = {
  type: 'database' | 'file';
  id: string;
  label: string;
};

type ImportCategoryResolution =
  | { type: 'existing'; categoryId: string }
  | { type: 'create'; name: string; slug: string }
  | null;

type ImportRowMeta = {
  status: ImportRowStatus;
  reasons: ImportRowReason[];
  matchTargets: ImportRowMatchTarget[];
  categoryCandidates: Array<{ id: string; name: string; nameAr: string; slug: string }>;
  categoryState: ImportCategoryState;
  categoryResolution: ImportCategoryResolution;
  originalName: string;
  originalSku: string;
  editedName: string;
  editedSku: string;
  hasRequiredEdits: boolean;
  isConflictFreeNow: boolean;
  wasQuarantinedDuplicate: boolean;
};

type ImportPreviewRow = ImportItem & {
  __rowId: string;
  __meta: ImportRowMeta;
};

type ExportScope = 'all' | 'filtered' | 'selected';
type ExportFieldKey =
  | 'nameAr'
  | 'name'
  | 'price'
  | 'stock'
  | 'sku'
  | 'categoryAr'
  | 'category'
  | 'descriptionAr'
  | 'description'
  | 'featured'
  | 'isHidden'
  | 'image';

const decodeMojibakeText = (value: string): string => {
  const input = (value ?? '').toString();
  if (!input) return '';
  const bytes = Uint8Array.from([...input].map((c) => c.charCodeAt(0) & 0xff));

  const score = (text: string) => {
    const arabicCount = (text.match(/[\u0600-\u06FF]/g) || []).length;
    const brokenCount = (text.match(/[\u00D8\u00D9\u00C3\u00D0\u00CA\u00C7\u00E2]/g) || []).length;
    return arabicCount * 3 - brokenCount * 2 + (text.trim().length > 1 ? 1 : 0);
  };

  let best = input;
  let bestScore = score(input);
  const encodings = ['utf-8', 'windows-1256'] as const;

  for (const encoding of encodings) {
    try {
      const decoded = new TextDecoder(encoding).decode(bytes);
      const currentScore = score(decoded);
      if (currentScore > bestScore) {
        bestScore = currentScore;
        best = decoded;
      }
    } catch {
      // ignore decode failures
    }
  }

  return best.replace(/[\u200E\u200F]/g, '').trim();
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-0">
      {/* Two-column body */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6 p-6">

        {/* LEFT: text fields */}
        <div className="space-y-5">

          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <Package className="w-3.5 h-3.5 text-primary" />
              اسم المنتج <span className="text-red-500">*</span>
            </Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value, nameAr: e.target.value }))}
              placeholder="اكتب اسم المنتج بأي لغة"
              required
              className="h-11 bg-white border-slate-200 focus:border-primary focus:ring-primary/20 shadow-sm"
            />
          </div>

          {/* Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="price" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-green-600" />
                السعر
                {hidePrices && <span className="text-[10px] text-amber-600 font-normal">(داخلي)</span>}
                {!hidePrices && <span className="text-red-500">*</span>}
              </Label>
              {hidePrices && (
                <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">الأسعار مخفية</p>
              )}
              <div className="relative">
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) => setFormData((prev) => ({ ...prev, price: Number(e.target.value) }))}
                  required={!hidePrices}
                  className="h-11 pr-12 bg-white border-slate-200 focus:border-green-500 focus:ring-green-500/20 shadow-sm"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 font-bold text-sm">ج.م</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="originalPrice" className="text-sm font-semibold text-slate-700">
                السعر الأصلي <span className="text-slate-400 font-normal text-xs">(قبل الخصم)</span>
              </Label>
              <div className="relative">
                <Input
                  id="originalPrice"
                  type="number"
                  value={formData.originalPrice || ''}
                  onChange={(e) => setFormData((prev) => ({ ...prev, originalPrice: e.target.value ? Number(e.target.value) : undefined }))}
                  className="h-11 pr-12 bg-white border-slate-200 shadow-sm"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">ج.م</span>
              </div>
              <p className="text-[10px] text-slate-400">يظهر مشطوبًا إذا كان أكبر من السعر الحالي</p>
            </div>
          </div>

          {/* Category + SKU */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cat-select" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                الفئة
              </Label>
              <select
                id="cat-select"
                className="w-full h-11 px-3 rounded-md border border-slate-200 bg-white text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-400 transition"
                value={formData.category}
                onChange={(e) => {
                  const value = e.target.value;
                  if (!value) { setFormData((prev) => ({ ...prev, category: '', categoryAr: '' })); return; }
                  const selectedCat = categories.find((c) => String(c.id) === String(value));
                  setFormData((prev) => ({ ...prev, category: value, categoryAr: selectedCat?.nameAr || selectedCat?.name || '' }));
                }}
              >
                <option value="">{categories.length === 0 ? 'أنشئ فئة أولًا' : 'اختر الفئة'}</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>{category.nameAr || category.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sku" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-purple-600" />
                كود المنتج <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData((prev) => ({ ...prev, sku: e.target.value }))}
                  required
                  className="h-11 bg-white border-slate-200 focus:border-purple-400 focus:ring-purple-400/20 shadow-sm"
                  placeholder="SKU-001"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setFormData((prev) => ({ ...prev, sku: generateSKU() }))}
                  className="h-11 px-3 border-slate-200 text-slate-600 hover:border-purple-400 hover:text-purple-600 shrink-0"
                  title="توليد تلقائي"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description" className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-slate-500" />
              وصف المنتج
            </Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              rows={5}
              className="bg-white border-slate-200 focus:border-slate-400 focus:ring-slate-400/20 shadow-sm rounded-lg resize-none"
              placeholder="اكتب وصفًا مفصلًا للمنتج..."
            />
          </div>
        </div>

        {/* RIGHT: images + toggles */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              <FileImage className="w-3.5 h-3.5 text-green-600" />
              صور المنتج
            </Label>
            <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
              <ImageUpload
                onImagesChange={(images) => setFormData((prev) => ({ ...prev, images, image: images[0] || '' }))}
                maxImages={5}
                multiple={true}
                initialImages={formData.images}
              />
            </div>
            <p className="text-[10px] text-slate-400 flex items-center gap-1">
              <CheckCircle className="w-3 h-3 text-green-500" />
              الصورة الأولى رئيسية ⬢ حد أقصى 5 صور
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white divide-y divide-slate-100 overflow-hidden shadow-sm">
            <label htmlFor="isHidden" className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
              <div className="flex items-center gap-2.5">
                <EyeOff className="w-4 h-4 text-amber-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">إخفاء من المتجر</p>
                  <p className="text-[11px] text-slate-400">لن يظهر هذا المنتج للعملاء</p>
                </div>
              </div>
              <Checkbox
                id="isHidden"
                checked={!!formData.isHidden}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, isHidden: Boolean(checked) }))}
                className="w-5 h-5 border-2 border-amber-300 data-[state=checked]:bg-amber-500 data-[state=checked]:border-amber-500"
              />
            </label>
            <label htmlFor="featured" className="flex items-center justify-between gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 transition">
              <div className="flex items-center gap-2.5">
                <Star className="w-4 h-4 text-yellow-500" />
                <div>
                  <p className="text-sm font-medium text-slate-800">منتج مميز</p>
                  <p className="text-[11px] text-slate-400">يظهر في قسم المنتجات المميزة</p>
                </div>
              </div>
              <Checkbox
                id="featured"
                checked={!!formData.featured}
                onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, featured: Boolean(checked) }))}
                className="w-5 h-5 border-2 border-yellow-300 data-[state=checked]:bg-yellow-400 data-[state=checked]:border-yellow-400"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 pb-6 pt-3 border-t border-slate-100 bg-slate-50/60 flex justify-end">
        <Button
          type="submit"
          className="h-11 px-8 bg-gradient-to-r from-primary to-secondary hover:opacity-90 shadow-lg text-white font-semibold gap-2"
        >
          {editingProduct ? (
            <><Edit className="w-4 h-4" /> تحديث المنتج</>
          ) : (
            <><Plus className="w-4 h-4" /> إضافة المنتج</>
          )}
        </Button>
      </div>
    </form>
  );
});

/** Stable hue (0–359) per family id so multiple expanded families are easy to tell apart. */
function stableHueFromFamilyId(familyId: string): number {
  let h = 2166136261;
  for (let i = 0; i < familyId.length; i++) {
    h ^= familyId.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h) % 360;
}

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
  const { hidePrices, familyCardsInListings } = usePricingSettings();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [familyMergeOpen, setFamilyMergeOpen] = useState(false);
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
      description: 'سيتم التنفيذ خلال 6 ثوانٍ - يمكنك التراجع الآن',
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
      description: 'سيتم التنفيذ خلال 6 ثوانٍ - يمكنك التراجع الآن',
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
  const [importPreview, setImportPreview] = useState<ImportPreviewRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isImportSubmitting, setIsImportSubmitting] = useState(false);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [isQuarantineModalOpen, setIsQuarantineModalOpen] = useState(false);
  const [quarantineReviewIds, setQuarantineReviewIds] = useState<Set<string>>(new Set());
  const [quarantineCheckingIds, setQuarantineCheckingIds] = useState<Set<string>>(new Set());
  const [quarantineAcceptedRows, setQuarantineAcceptedRows] = useState<Array<{ row: ImportPreviewRow; fading: boolean }>>([]);
  const [importPreviewLiveSearch, setImportPreviewLiveSearch] = useState('');
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExportSubmitting, setIsExportSubmitting] = useState(false);
  const [exportStep, setExportStep] = useState<'fields' | 'products'>('fields');
  const [exportScope, setExportScope] = useState<ExportScope>('filtered');
  const [exportProductSearch, setExportProductSearch] = useState('');
  const [exportCategoryFilter, setExportCategoryFilter] = useState<string>('all');
  const [exportSelectedIds, setExportSelectedIds] = useState<Set<string>>(new Set());
  const [exportFields, setExportFields] = useState<Record<ExportFieldKey, boolean>>({
    nameAr: true,
    name: true,
    price: true,
    stock: true,
    sku: true,
    categoryAr: true,
    category: true,
    descriptionAr: false,
    description: false,
    featured: false,
    isHidden: false,
    image: false,
  });
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
  const [importPreviewSearch, setImportPreviewSearch] = useState('');
  const [bulkCategoryId, setBulkCategoryId] = useState<string>('');
  const importRowSeqRef = useRef(1);
  // Matching strategy for Smart Update
  const [matchStrategy, setMatchStrategy] = useState<'auto' | 'sku' | 'name' | 'nameAr'>('auto');
  // Ensure category select opens inside dialog reliably
  const [categorySelectOpen, setCategorySelectOpen] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  type AdminTableSort =
    | 'newest'
    | 'oldest'
    | 'name_asc'
    | 'name_desc'
    | 'price_asc'
    | 'price_desc'
    | 'sku_asc';
  const [tableSort, setTableSort] = useState<AdminTableSort>('newest');
  type FamilyTableFilter = 'all' | 'no_family' | 'in_family' | 'family_rep';
  const [familyTableFilter, setFamilyTableFilter] = useState<FamilyTableFilter>('all');
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
      categoryId: bp.categoryId ? String(bp.categoryId) : undefined,
      categorySlug: bp.categorySlug,
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
      productFamilyId: bp.productFamilyId ? String(bp.productFamilyId) : undefined,
    };
  };

  const refetchProducts = useCallback(async () => {
    setIsLoadingProducts(true);
    try {
      const pageSize = 200;
      let page = 1;
      let pages = 1;
      const all: BackendProduct[] = [];
      let listValid = true;

      while (page <= pages) {
        const res = await apiGet<BackendProduct>(`/api/products?page=${page}&limit=${pageSize}`);
        if (
          !res ||
          typeof res !== 'object' ||
          res.ok !== true ||
          !Array.isArray(res.items)
        ) {
          listValid = false;
          break;
        }
        all.push(...res.items);
        pages = Number(res.pages || 1);
        page += 1;
      }

      if (listValid) {
        const deduped = Array.from(new Map(all.map((item) => [String(item._id), item])).values());
        setProducts(deduped.map(mapBackendProduct));
      }
    } finally {
      setIsLoadingProducts(false);
    }
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
          سيتم الحذف خلال 6 ثوانٍ - يمكنك التراجع الآن
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
        title: 'لا توجد فئات حاليًا',
        description: 'يمكنك إنشاء فئات من صفحة الفئات، أو سنحاول استنتاجها من المنتجات والمدخلات الحالية.',
        variant: 'default'
      });
    }
  }, [isImportModalOpen, importStep, categories.length, toast]);

  useEffect(() => {
    if (!isImportModalOpen || importStep !== 'preview' || importPreview.length === 0) return;
    setImportPreview((prev) => runImportPreflight(prev, prev));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, products, isImportModalOpen, importStep]);

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

  const [adminFamilyDocs, setAdminFamilyDocs] = useState<AdminProductFamilyLean[]>([]);
  const [expandedFamilyIds, setExpandedFamilyIds] = useState<Set<string>>(new Set());
  const [editFamily, setEditFamily] = useState<AdminProductFamilyLean | null>(null);

  const fetchAdminFamilies = useCallback(async () => {
    try {
      const res = await apiGet<AdminProductFamilyLean>('/api/product-families');
      if (
        res &&
        typeof res === 'object' &&
        res.ok === true &&
        'items' in res &&
        Array.isArray(res.items)
      ) {
        setAdminFamilyDocs(res.items as AdminProductFamilyLean[]);
      }
      // Keep previous families on malformed/304-style responses instead of clearing the list
    } catch {
      /* keep existing adminFamilyDocs */
    }
  }, []);

  useEffect(() => {
    void fetchAdminFamilies();
  }, [products, fetchAdminFamilies]);

  /** Stable representative id per family (default product when present in catalog). */
  const familyRepIdByFamilyId = useMemo(() => {
    const map = new Map<string, string>();
    const byId = new Map(products.map((p) => [String(p.id), p]));
    for (const fam of adminFamilyDocs) {
      const fid = String(fam._id);
      const mids = (fam.memberProductIds || []).map(String);
      if (mids.length < 2) continue;
      const def = fam.defaultProductId != null ? String(fam.defaultProductId) : '';
      let rep: string | null = null;
      if (def && byId.has(def)) rep = def;
      else rep = mids.find((id) => byId.has(id)) ?? mids[0] ?? null;
      if (rep) map.set(fid, rep);
    }
    return map;
  }, [adminFamilyDocs, products]);

  const getFamilyTableMeta = useCallback(
    (product: Product) => {
      const fid = product.productFamilyId ? String(product.productFamilyId) : '';
      if (!fid) return null;
      const fam = adminFamilyDocs.find((f) => String(f._id) === fid);
      if (!fam) return null;
      const n = fam.memberProductIds?.length ?? 0;
      if (n < 2) return null;
      const defId = fam.defaultProductId != null ? String(fam.defaultProductId) : '';
      const defProd = defId ? products.find((p) => String(p.id) === defId) : undefined;
      const isRep = familyRepIdByFamilyId.get(fid) === String(product.id);
      return { fam, n, defProd, isRep, fid };
    },
    [adminFamilyDocs, products, familyRepIdByFamilyId]
  );

  const displayedProducts = useMemo(() => {
    let list = filteredProducts;
    if (familyTableFilter === 'no_family') {
      list = list.filter((p) => !p.productFamilyId);
    } else if (familyTableFilter === 'in_family') {
      list = list.filter((p) => !!p.productFamilyId);
    } else if (familyTableFilter === 'family_rep') {
      list = list.filter((p) => {
        const fid = p.productFamilyId ? String(p.productFamilyId) : '';
        if (!fid) return false;
        return familyRepIdByFamilyId.get(fid) === String(p.id);
      });
    }
    const arr = [...list];
    const nameKey = (p: Product) => (p.nameAr || p.name || '').trim();
    const cmpName = (a: Product, b: Product) => nameKey(a).localeCompare(nameKey(b), 'ar');
    const cmpSku = (a: Product, b: Product) =>
      (a.sku || '').localeCompare(b.sku || '', undefined, { numeric: true });
    const tCreated = (p: Product) =>
      new Date(p.createdAt || p.updatedAt || 0).getTime();
    switch (tableSort) {
      case 'name_asc':
        arr.sort(cmpName);
        break;
      case 'name_desc':
        arr.sort((a, b) => -cmpName(a, b));
        break;
      case 'price_asc':
        arr.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        arr.sort((a, b) => b.price - a.price);
        break;
      case 'sku_asc':
        arr.sort(cmpSku);
        break;
      case 'oldest':
        arr.sort((a, b) => tCreated(a) - tCreated(b));
        break;
      case 'newest':
      default:
        arr.sort((a, b) => tCreated(b) - tCreated(a));
    }
    return arr;
  }, [filteredProducts, familyTableFilter, familyRepIdByFamilyId, tableSort]);

  /** Rows used for “per page” when family mode is on: one slot per family (representative) + standalone products. */
  const paginationSourceProducts = useMemo(() => {
    if (!familyCardsInListings) return displayedProducts;
    const seenFam = new Set<string>();
    const rows: Product[] = [];
    for (const p of displayedProducts) {
      const fid = p.productFamilyId ? String(p.productFamilyId) : '';
      if (!fid) {
        rows.push(p);
        continue;
      }
      if (seenFam.has(fid)) continue;
      seenFam.add(fid);
      const repId = familyRepIdByFamilyId.get(fid);
      const rep = (repId ? displayedProducts.find((x) => String(x.id) === repId) : undefined) || p;
      rows.push(rep);
    }
    return rows;
  }, [displayedProducts, familyCardsInListings, familyRepIdByFamilyId]);

  const totalPages = useMemo(() => {
    const n = paginationSourceProducts.length;
    return Math.max(1, Math.ceil(n / itemsPerPage));
  }, [paginationSourceProducts.length, itemsPerPage]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return paginationSourceProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [paginationSourceProducts, currentPage, itemsPerPage]);

  const visiblePaginatedProducts = useMemo(() => {
    if (!familyCardsInListings) return paginatedProducts;
    const out: Product[] = [];
    for (const p of paginatedProducts) {
      const fid = p.productFamilyId ? String(p.productFamilyId) : '';
      if (!fid) {
        out.push(p);
        continue;
      }
      if (expandedFamilyIds.has(fid)) {
        displayedProducts.forEach((m) => {
          if (String(m.productFamilyId || '') === fid) out.push(m);
        });
      } else {
        out.push(p);
      }
    }
    return out;
  }, [paginatedProducts, displayedProducts, expandedFamilyIds, familyCardsInListings]);

  /** First/last row per expanded family for rounded “container” corners */
  const expandedFamilyEdges = useMemo(() => {
    const m = new Map<string, { firstId: string; lastId: string }>();
    const list = visiblePaginatedProducts;
    for (let i = 0; i < list.length; i++) {
      const fid = list[i].productFamilyId ? String(list[i].productFamilyId) : '';
      if (!fid || !expandedFamilyIds.has(fid) || m.has(fid)) continue;
      let j = i;
      while (j < list.length && String(list[j].productFamilyId || '') === fid) j += 1;
      const slice = list.slice(i, j);
      if (slice.length) {
        m.set(fid, { firstId: String(slice[0].id), lastId: String(slice[slice.length - 1].id) });
      }
      i = j - 1;
    }
    return m;
  }, [visiblePaginatedProducts, expandedFamilyIds]);

  const isFamilyRepresentative = useCallback(
    (p: Product) => {
      const fid = p.productFamilyId;
      if (!fid) return false;
      return familyRepIdByFamilyId.get(String(fid)) === String(p.id);
    },
    [familyRepIdByFamilyId]
  );

  const toggleFamilyExpand = useCallback((familyId: string) => {
    setExpandedFamilyIds((prev) => {
      const next = new Set(prev);
      if (next.has(familyId)) next.delete(familyId);
      else next.add(familyId);
      return next;
    });
  }, []);

  /** عرض سريع لعدد العائلات والمنتجات المرتبطة بها في القائمة المعروضة بالجدول */
  const familyListingStats = useMemo(() => {
    const withFam = displayedProducts.filter((p) => !!p.productFamilyId);
    const unique = new Set(withFam.map((p) => String(p.productFamilyId)));
    return { familyGroups: unique.size, memberRows: withFam.length };
  }, [displayedProducts]);

  // Resolve product main image with category fallback
  const getProductPrimaryImage = useCallback((p: Product): string => {
    const cat = categories.find(
      (c) => String(c.id) === String(p.category) || String(c.slug) === String(p.category)
    );
    return p.image || cat?.image || '';
  }, [categories]);

  // Select all on current page
  const toggleSelectAllOnPage = useCallback(() => {
    const ids = visiblePaginatedProducts.map((p) => String(p.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      const allSelected = ids.every((id) => next.has(id));
      if (allSelected) {
        ids.forEach((id) => next.delete(id));
      } else {
        ids.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [visiblePaginatedProducts]);

  // Reset to first page when filters / table view change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory, tableSort, familyTableFilter]);

  useEffect(() => {
    if (!familyCardsInListings && familyTableFilter !== 'all') setFamilyTableFilter('all');
  }, [familyCardsInListings, familyTableFilter]);

  useEffect(() => {
    if (!familyCardsInListings) setExpandedFamilyIds(new Set());
  }, [familyCardsInListings]);

  useEffect(() => {
    setCurrentPage((p) => Math.min(Math.max(1, p), totalPages));
  }, [totalPages]);

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
    return result;
  };

  const updateImportItem = (absoluteIndex: number, field: keyof ImportItem, value: string) => {
    setImportPreview(prev => {
      const next = prev.map((item, idx) => {
      if (idx !== absoluteIndex) return item;
      // coerce types for known numeric/boolean fields
      if (field === 'price' || field === 'originalPrice' || field === 'weight') {
        return { ...item, [field]: value === '' ? undefined : Number(value) };
      }
      if (field === 'featured' || field === 'isHidden') {
        return { ...item, [field]: value === 'true' };
      }
      return { ...item, [field]: value };
      });
      return runImportPreflight(next, prev);
    });
  };

  const applyBulkCategory = (idOverride?: string) => {
    const id = idOverride ?? bulkCategoryId;
    if (!id) return;
    const cat = categories.find(c => String(c.id) === String(id));
    setBulkCategoryId(String(id));
    setImportPreview(prev => {
      const next = prev.map(item => ({
        ...item,
        category: cat ? String(cat.id) : item.category,
        categoryAr: cat?.nameAr || item.categoryAr,
        __meta: {
          ...item.__meta,
          categoryResolution: cat ? ({ type: 'existing', categoryId: String(cat.id) } as ImportCategoryResolution) : item.__meta.categoryResolution,
        },
      }));
      return runImportPreflight(next, prev);
    });
    if (cat) {
      toast({ title: 'تم تعيين الفئة جماعيًا', description: `تم تعيين الفئة "${cat.nameAr || cat.name}" لجميع العناصر` });
    }
  };

  const importPreviewValidation = useMemo(() => {
    const categoryOk = (row: ImportPreviewRow) => {
      const id = String(row.category || '').trim();
      return id !== '' && categories.some((c) => String(c.id) === id);
    };
    const readyRows = importPreview.filter((row) => row.__meta.status === 'ready').length;
    const quarantinedDuplicate = importPreview.filter((row) => row.__meta.status === 'quarantined_duplicate').length;
    const skippedFileDuplicate = importPreview.filter((row) => row.__meta.status === 'skipped_file_duplicate').length;
    const invalidRows = importPreview.filter((row) => row.__meta.status === 'invalid').length;
    const readyMissingCategory = importPreview.filter(
      (row) => row.__meta.status === 'ready' && !categoryOk(row)
    ).length;

    /** No invalid rows and nothing left in quarantine (file-only duplicate skips are OK). */
    const isValid =
      importPreview.length > 0 && invalidRows === 0 && quarantinedDuplicate === 0 && readyMissingCategory === 0;
    /** Import at least one ready row; rows with missing name/sku/price still block; every ready row must have a real category. */
    const canImportReadySubset =
      importPreview.length > 0 && readyRows > 0 && invalidRows === 0 && readyMissingCategory === 0;

    return {
      isValid,
      canImportReadySubset,
      readyRows,
      quarantinedDuplicate,
      skippedFileDuplicate,
      invalidRowsCount: invalidRows,
      readyMissingCategory,
      blockedRowsCount: quarantinedDuplicate + invalidRows,
    };
  }, [importPreview, categories]);

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

  const normalizeExportText = (value: string) =>
    String(value || '')
      .trim()
      .toLowerCase()
      .replace(/[\u064B-\u0652]/g, '')
      .replace(/\u0640/g, '')
      .replace(/[\s\u00A0]+/g, ' ');

  const exportScopePool = useMemo(() => {
    if (exportScope === 'all') return products;
    if (exportScope === 'selected') {
      if (exportSelectedIds.size === 0) return [];
      return products.filter((p) => exportSelectedIds.has(String(p.id)));
    }
    return displayedProducts;
  }, [exportScope, products, exportSelectedIds, displayedProducts]);

  const exportScopePoolFiltered = useMemo(() => {
    const poolByCategory =
      exportCategoryFilter === 'all'
        ? exportScopePool
        : exportScopePool.filter((product) => {
            const selectedCategoryItem = categories.find((c) => String(c.id) === String(exportCategoryFilter));
            if (!selectedCategoryItem) return false;
            const productCategoryRaw = String(product.category || '');
            const productCategoryAr = normalizeExportText(String(product.categoryAr || ''));
            const selectedName = normalizeExportText(String(selectedCategoryItem.name || ''));
            const selectedNameAr = normalizeExportText(String(selectedCategoryItem.nameAr || ''));
            return (
              productCategoryRaw === String(selectedCategoryItem.id) ||
              productCategoryRaw === String(selectedCategoryItem.slug || '') ||
              productCategoryAr === selectedName ||
              productCategoryAr === selectedNameAr
            );
          });
    const q = exportProductSearch.trim().toLowerCase();
    if (!q) return poolByCategory;
    return poolByCategory.filter((product) => {
      const nameEn = String(product.name || '').toLowerCase();
      const nameAr = String(product.nameAr || '');
      const sku = String(product.sku || '').toLowerCase();
      return nameEn.includes(q) || nameAr.includes(exportProductSearch.trim()) || sku.includes(q);
    });
  }, [exportScopePool, exportProductSearch, exportCategoryFilter]);

  const exportCandidates = useMemo(() => {
    if (exportSelectedIds.size === 0) return [];
    return products.filter((p) => exportSelectedIds.has(String(p.id)));
  }, [products, exportSelectedIds]);

  const selectedExportFieldsCount = useMemo(
    () => Object.values(exportFields).filter(Boolean).length,
    [exportFields]
  );

  const exportFieldOptions: Array<{ key: ExportFieldKey; label: string; hint: string }> = [
    { key: 'nameAr', label: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062a\u062c (\u0639\u0631\u0628\u064a)', hint: 'nameAr' },
    { key: 'name', label: '\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062a\u062c (EN)', hint: 'name' },
    { key: 'price', label: '\u0627\u0644\u0633\u0639\u0631', hint: 'price' },
    { key: 'stock', label: '\u0627\u0644\u0645\u062e\u0632\u0648\u0646', hint: 'stock' },
    { key: 'sku', label: '\u0627\u0644\u0643\u0648\u062f', hint: 'sku' },
    { key: 'categoryAr', label: '\u0627\u0633\u0645 \u0627\u0644\u0641\u0626\u0629 (\u0639\u0631\u0628\u064a)', hint: 'categoryAr' },
    { key: 'category', label: '\u0645\u0639\u0631\u0641 \u0627\u0644\u0641\u0626\u0629', hint: 'category' },
    { key: 'descriptionAr', label: '\u0648\u0635\u0641 (\u0639\u0631\u0628\u064a)', hint: 'descriptionAr' },
    { key: 'description', label: '\u0648\u0635\u0641 (EN)', hint: 'description' },
    { key: 'featured', label: '\u0645\u0646\u062a\u062c \u0645\u0645\u064a\u0632', hint: 'featured' },
    { key: 'isHidden', label: '\u0645\u062e\u0641\u064a', hint: 'isHidden' },
    { key: 'image', label: '\u0635\u0648\u0631\u0629', hint: 'image' },
  ];

  const toggleAllExportFields = (checked: boolean) => {
    setExportFields({
      nameAr: checked,
      name: checked,
      price: checked,
      stock: checked,
      sku: checked,
      categoryAr: checked,
      category: checked,
      descriptionAr: checked,
      description: checked,
      featured: checked,
      isHidden: checked,
      image: checked,
    });
  };

  const toggleExportProduct = (productId: string, checked: boolean) => {
    setExportSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(productId);
      else next.delete(productId);
      return next;
    });
  };

  const selectAllExportRows = () => {
    setExportSelectedIds(new Set(exportScopePoolFiltered.map((p) => String(p.id))));
  };

  const clearExportSelection = () => {
    setExportSelectedIds(new Set());
  };

  useEffect(() => {
    if (!isExportModalOpen || exportStep !== 'products') return;
    if (exportScope === 'selected') return;
    setExportSelectedIds(new Set(exportScopePool.map((p) => String(p.id))));
  }, [isExportModalOpen, exportStep, exportScope, exportScopePool]);

  const executeExportExcel = async () => {
    if (isExportSubmitting) return;
    if (selectedExportFieldsCount === 0) {
      toast({ title: '\u0627\u062e\u062a\u0631 \u062d\u0642\u0644\u0627\u064b \u0648\u0627\u062d\u062f\u0627\u064b \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644', variant: 'destructive' });
      return;
    }
    if (exportCandidates.length === 0) {
      toast({ title: '\u0644\u0627 \u064a\u0648\u062c\u062f \u0645\u0646\u062a\u062c\u0627\u062a \u0644\u0644\u062a\u0635\u062f\u064a\u0631', variant: 'destructive' });
      return;
    }

    setIsExportSubmitting(true);
    try {
      const fieldsInOrder: ExportFieldKey[] = [
        'nameAr',
        'name',
        'price',
        'stock',
        'sku',
        'categoryAr',
        'category',
        'descriptionAr',
        'description',
        'featured',
        'isHidden',
        'image',
      ].filter((field) => exportFields[field]);

      const rows = exportCandidates.map((p) => {
        const category = categories.find((c) => String(c.id) === String(p.category) || String(c.slug) === String(p.category));
        const productRow: Record<string, string | number | boolean> = {};
        fieldsInOrder.forEach((field) => {
          switch (field) {
            case 'nameAr':
              productRow.nameAr = p.nameAr || p.name || '';
              break;
            case 'name':
              productRow.name = p.name || p.nameAr || '';
              break;
            case 'price':
              productRow.price = Number(p.price ?? 0);
              break;
            case 'stock':
              productRow.stock = Number(p.stock ?? 0);
              break;
            case 'sku':
              productRow.sku = p.sku || '';
              break;
            case 'categoryAr':
              productRow.categoryAr = category?.nameAr || p.categoryAr || '';
              break;
            case 'category':
              productRow.category = String(category?.id || p.category || '');
              break;
            case 'descriptionAr':
              productRow.descriptionAr = p.descriptionAr || '';
              break;
            case 'description':
              productRow.description = p.description || '';
              break;
            case 'featured':
              productRow.featured = Boolean(p.featured);
              break;
            case 'isHidden':
              productRow.isHidden = Boolean(p.isHidden);
              break;
            case 'image':
              productRow.image = p.image || p.images?.[0] || '';
              break;
          }
        });
        return productRow;
      });

      const sheet = XLSX.utils.json_to_sheet(rows, { header: fieldsInOrder });
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, sheet, 'Products');
      const date = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(wb, `products-import-ready-${date}.xlsx`);
      void logHistory({
        section: 'products',
        action: 'export_downloaded',
        note: `Exported ${rows.length} products for re-import`,
        meta: { count: rows.length, scope: exportScope, fields: fieldsInOrder },
      });
      toast({
        title: '\u062a\u0645 \u062a\u062c\u0647\u064a\u0632 \u0645\u0644\u0641 \u0627\u0644\u062a\u0635\u062f\u064a\u0631',
        description: `\u062a\u0645 \u062a\u0635\u062f\u064a\u0631 ${rows.length} \u0645\u0646\u062a\u062c \u0628\u0635\u064a\u063a\u0629 \u0645\u062a\u0648\u0627\u0641\u0642\u0629 \u0645\u0639 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f`,
      });
      setIsExportModalOpen(false);
    } finally {
      setIsExportSubmitting(false);
    }
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
        throw new Error('نوع الملف غير مدعوم. يُسمح فقط بملفات Excel/CSV');
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
      const xlsxWithCodepage = XLSX as typeof XLSX & { set_cptable?: (table: unknown) => void };
      if (xlsxWithCodepage.set_cptable) {
        try {
          const cptable = await import('xlsx/dist/cpexcel.full.mjs');
          xlsxWithCodepage.set_cptable(cptable);
        } catch {
          // optional runtime enhancement
        }
      }

      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array', cellText: true, cellDates: true });
      const firstSheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[firstSheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

      if (!aoa || aoa.length === 0) {
        throw new Error('الملف فارغ أو غير صالح');
      }

      // Normalize header values to strings
      const headers = (aoa[0] || []).map((h) => decodeMojibakeText(String(h)));
      const rows = aoa.slice(1);
      const rowsStr: string[][] = rows
        .map((row) => row.map((v) => decodeMojibakeText(String(v))))
        .filter((row) => row.some((cell) => String(cell || '').trim().length > 0));
      const extractedArray: string[][] = [headers, ...rowsStr];
      setExtractedData(extractedArray);

      // Auto-map columns based on headers
      const smartMapping = generateColumnMapping(headers);
      setColumnMapping(smartMapping);

      // Simpler UX: auto-generate preview immediately
      const tableData: TableData = { headers, rows: rowsStr, confidence: 0.9 };
      const formatted = formatDataForPreview(tableData, smartMapping);
      const enhanced = enhancePreviewFromTable(tableData, smartMapping, formatted as ImportItem[]);
      const cleanedPreview = enhanced.filter((item) => {
        const name = String(item.nameAr || item.name || '').trim();
        const sku = String(item.sku || '').trim();
        const hasPrice = Number.isFinite(Number(item.price));
        const hasStock = Number.isFinite(Number(item.stock));
        if (!name || name.length < 2) return false;
        if (/^(name|اسم المنتج|السعر|price|sku|الكود|المخزون|category|الفئة)$/i.test(name)) return false;
        return hasPrice || hasStock || sku.length > 0;
      });
      setImportPreview(runImportPreflight(cleanedPreview));
      setPreviewPerPage('all');
      setPreviewPage(1);
      setImportStep('preview');

      toast({
        title: 'تم قراءة ملف Excel/CSV',
        description: `تم العثور على ${cleanedPreview.length} صف صالح من البيانات في الورقة ${firstSheetName}`,
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

  const createRowReason = (code: string, message: string): ImportRowReason => ({ code, message });

  const createDefaultRowMeta = (row: ImportItem, prevMeta?: ImportRowMeta): ImportRowMeta => {
    const baseName = String(row.nameAr || row.name || '').trim();
    const baseSku = String(row.sku || '').trim();
    return {
      status: prevMeta?.status || 'invalid',
      reasons: prevMeta?.reasons || [],
      matchTargets: prevMeta?.matchTargets || [],
      categoryCandidates: prevMeta?.categoryCandidates || [],
      categoryState: prevMeta?.categoryState || 'missing',
      categoryResolution: prevMeta?.categoryResolution || null,
      originalName: prevMeta?.originalName || baseName,
      originalSku: prevMeta?.originalSku || baseSku,
      editedName: baseName,
      editedSku: baseSku,
      hasRequiredEdits: prevMeta?.hasRequiredEdits || false,
      isConflictFreeNow: prevMeta?.isConflictFreeNow || false,
      wasQuarantinedDuplicate: prevMeta?.wasQuarantinedDuplicate || false,
    };
  };

  const ensureImportRowIdentity = (row: ImportItem | ImportPreviewRow): ImportPreviewRow => {
    const existing = row as ImportPreviewRow;
    const rowId = existing.__rowId || `imp-row-${importRowSeqRef.current++}`;
    const meta = createDefaultRowMeta(existing, existing.__meta);
    return {
      ...existing,
      __rowId: rowId,
      __meta: meta,
    };
  };

  const findCategoryCandidates = (row: ImportItem) => {
    const rawCandidates = [
      String(row.category ?? '').trim(),
      String(row.categoryAr ?? '').trim(),
      String((row as Record<string, unknown>).categorySlug ?? '').trim(),
      String((row as Record<string, unknown>).categoryCode ?? '').trim(),
    ].filter(Boolean);

    const unique = Array.from(new Set(rawCandidates));
    const matches = categories.filter((cat) => {
      return unique.some((candidate) => {
        const key = normalizeKey(candidate);
        return (
          String(cat.id) === candidate ||
          normalizeKey(cat.slug) === key ||
          normalizeKey(cat.name) === key ||
          normalizeKey(cat.nameAr) === key
        );
      });
    });

    return matches.map((cat) => ({
      id: String(cat.id),
      name: cat.name,
      nameAr: cat.nameAr,
      slug: cat.slug,
    }));
  };

  const runImportPreflight = (rowsInput: Array<ImportItem | ImportPreviewRow>, previousRows?: ImportPreviewRow[]): ImportPreviewRow[] => {
    const rows = rowsInput.map(ensureImportRowIdentity);
    const prevMetaMap = new Map((previousRows || []).map((r) => [r.__rowId, r.__meta]));

    const n = rows.length;
    const parent = Array.from({ length: n }, (_, i) => i);
    const findRoot = (i: number): number => {
      if (parent[i] !== i) parent[i] = findRoot(parent[i]);
      return parent[i];
    };
    const unionIdx = (a: number, b: number) => {
      const ra = findRoot(a);
      const rb = findRoot(b);
      if (ra !== rb) parent[ra] = rb;
    };
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (isSameProduct(rows[i], rows[j])) unionIdx(i, j);
      }
    }
    const rootToMembers = new Map<number, number[]>();
    for (let i = 0; i < n; i++) {
      const r = findRoot(i);
      const list = rootToMembers.get(r) || [];
      list.push(i);
      rootToMembers.set(r, list);
    }
    rootToMembers.forEach((members) => {
      members.sort((a, b) => a - b);
    });
    const componentHasDb = new Map<number, boolean>();
    rootToMembers.forEach((members, root) => {
      const hasDb = members.some((idx) => products.some((p) => isSameProduct(p, rows[idx])));
      componentHasDb.set(root, hasDb);
    });
    const fileLoserIndex = new Set<number>();
    rootToMembers.forEach((members, root) => {
      if (componentHasDb.get(root) || members.length < 2) return;
      const [, ...rest] = members;
      rest.forEach((idx) => fileLoserIndex.add(idx));
    });
    const indexToSameComponentIds = new Map<number, Set<string>>();
    rootToMembers.forEach((members) => {
      const ids = new Set(members.map((idx) => rows[idx].__rowId));
      members.forEach((idx) => indexToSameComponentIds.set(idx, ids));
    });

    const skuToRows = new Map<string, string[]>();
    const nameToRows = new Map<string, string[]>();
    const nameArToRows = new Map<string, string[]>();

    rows.forEach((row) => {
      const skuKey = normalizeSku(String(row.sku || ''));
      const nameKey = normalizeKey(String(row.name || ''));
      const nameArKey = normalizeKey(String(row.nameAr || row.name || ''));
      if (skuKey) skuToRows.set(skuKey, [...(skuToRows.get(skuKey) || []), row.__rowId]);
      if (nameKey) nameToRows.set(nameKey, [...(nameToRows.get(nameKey) || []), row.__rowId]);
      if (nameArKey) nameArToRows.set(nameArKey, [...(nameArToRows.get(nameArKey) || []), row.__rowId]);
    });

    return rows.map((row, index) => {
      const prevMeta = prevMetaMap.get(row.__rowId);
      const meta = createDefaultRowMeta(row, prevMeta);
      const reasons: ImportRowReason[] = [];
      const matchTargets: ImportRowMatchTarget[] = [];

      const nameValue = String(row.nameAr || row.name || '').trim();
      const skuValue = String(row.sku || '').trim();
      const priceValue = Number(row.price);

      const hasName = nameValue.length > 0;
      const hasSku = skuValue.length > 0;
      const hasPrice = Number.isFinite(priceValue);

      if (!hasName) reasons.push(createRowReason('missing_name', 'الاسم مطلوب.'));
      if (!hasSku) reasons.push(createRowReason('missing_sku', 'الكود مطلوب.'));
      if (!hasPrice) reasons.push(createRowReason('missing_price', 'السعر غير صالح.'));

      const categoryCandidates = findCategoryCandidates(row);
      let categoryState: ImportCategoryState = 'resolved';
      let resolvedCategoryId = '';
      let categoryResolution: ImportCategoryResolution = meta.categoryResolution;

      if (categoryResolution?.type === 'existing') {
        const exists = categories.find((c) => String(c.id) === String(categoryResolution.categoryId));
        if (exists) {
          categoryState = 'resolved';
          resolvedCategoryId = String(exists.id);
        } else {
          categoryState = 'resolved';
          categoryResolution = null;
        }
      } else if (categoryResolution?.type === 'create') {
        const slugKey = normalizeKey(categoryResolution.slug);
        const nameKey = normalizeKey(categoryResolution.name);
        const existing = categories.find((c) => normalizeKey(c.slug) === slugKey || normalizeKey(c.name) === nameKey || normalizeKey(c.nameAr) === nameKey);
        if (existing) {
          categoryState = 'resolved';
          resolvedCategoryId = String(existing.id);
          categoryResolution = { type: 'existing', categoryId: String(existing.id) };
        } else {
          categoryState = 'resolved';
          categoryResolution = null;
        }
      } else if (categoryCandidates.length === 1) {
        categoryState = 'resolved';
        resolvedCategoryId = categoryCandidates[0].id;
      } else if (categoryCandidates.length > 1) {
        categoryState = 'resolved';
        resolvedCategoryId = categoryCandidates[0].id;
      }

      const hasValidationErrorsEarly = !hasName || !hasSku || !hasPrice;
      if (fileLoserIndex.has(index) && !hasValidationErrorsEarly) {
        const resolvedCategorySkipped = categories.find((c) => String(c.id) === resolvedCategoryId);
        return {
          ...row,
          category: resolvedCategorySkipped ? String(resolvedCategorySkipped.id) : row.category,
          categoryAr: resolvedCategorySkipped
            ? (resolvedCategorySkipped.nameAr || resolvedCategorySkipped.name)
            : row.categoryAr,
          __meta: {
            ...meta,
            status: 'skipped_file_duplicate',
            reasons: [
              createRowReason(
                'file_duplicate_ignored',
                'تكرار داخل الملف — يُستورد أول صف فقط عند عدم وجود نفس المنتج في المتجر.'
              ),
            ],
            matchTargets: [],
            categoryCandidates,
            categoryState,
            categoryResolution,
            editedName: nameValue,
            editedSku: skuValue,
            hasRequiredEdits: false,
            isConflictFreeNow: true,
            wasQuarantinedDuplicate: false,
          },
        };
      }

      const dbMatches = products.filter((p) => isSameProduct(p, row));
      dbMatches.slice(0, 4).forEach((p) => {
        matchTargets.push({
          type: 'database',
          id: String(p.id),
          label: `${p.nameAr || p.name} (${p.sku || 'بدون كود'})`,
        });
      });

      const fileMatchIds = new Set<string>();
      const skuKey = normalizeSku(skuValue);
      const nameKey = normalizeKey(String(row.name || ''));
      const nameArKey = normalizeKey(String(row.nameAr || row.name || ''));
      if (skuKey) (skuToRows.get(skuKey) || []).forEach((id) => { if (id !== row.__rowId) fileMatchIds.add(id); });
      if (nameKey) (nameToRows.get(nameKey) || []).forEach((id) => { if (id !== row.__rowId) fileMatchIds.add(id); });
      if (nameArKey) (nameArToRows.get(nameArKey) || []).forEach((id) => { if (id !== row.__rowId) fileMatchIds.add(id); });

      const dupRoot = findRoot(index);
      const dupCompHasDb = componentHasDb.get(dupRoot) ?? false;
      const dupCompSize = (rootToMembers.get(dupRoot) || [index]).length;
      const sameComponentRowIds = indexToSameComponentIds.get(index) ?? new Set([row.__rowId]);
      if (!dupCompHasDb && dupCompSize > 1) {
        const filteredFile = new Set<string>();
        fileMatchIds.forEach((id) => {
          if (!sameComponentRowIds.has(id)) filteredFile.add(id);
        });
        fileMatchIds.clear();
        filteredFile.forEach((id) => fileMatchIds.add(id));
      }

      rows.forEach((r) => {
        if (fileMatchIds.has(r.__rowId)) {
          matchTargets.push({
            type: 'file',
            id: r.__rowId,
            label: `صف ${rows.findIndex((x) => x.__rowId === r.__rowId) + 1}: ${String(r.nameAr || r.name || '').trim() || 'بدون اسم'}`,
          });
        }
      });

      const hasDuplicateConflict = matchTargets.length > 0;
      const wasQuarantinedDuplicate = Boolean(meta.wasQuarantinedDuplicate || prevMeta?.status === 'quarantined_duplicate' || hasDuplicateConflict);
      const hasRequiredEdits =
        normalizeKey(nameValue) !== normalizeKey(meta.originalName) &&
        normalizeSku(skuValue) !== normalizeSku(meta.originalSku);

      if (hasDuplicateConflict) {
        reasons.push(createRowReason('duplicate_conflict', 'يوجد تطابق مع منتج حالي أو صف آخر في نفس الملف.'));
      }

      if (wasQuarantinedDuplicate && !hasRequiredEdits) {
        reasons.push(createRowReason('duplicate_requires_edits', 'يجب تعديل الاسم والكود معًا قبل السماح بالإدخال.'));
      }

      if (hasRequiredEdits && hasDuplicateConflict) {
        reasons.push(createRowReason('duplicate_still_matching', 'تم التعديل لكنه ما زال مطابقًا.'));
      }

      let status: ImportRowStatus = 'ready';
      const hasValidationErrors = !hasName || !hasSku || !hasPrice;

      if (hasValidationErrors) {
        status = 'invalid';
      } else if (hasDuplicateConflict || (wasQuarantinedDuplicate && !hasRequiredEdits)) {
        status = 'quarantined_duplicate';
      }

      const resolvedCategory = categories.find((c) => String(c.id) === resolvedCategoryId);

      return {
        ...row,
        category: resolvedCategory ? String(resolvedCategory.id) : row.category,
        categoryAr: resolvedCategory ? (resolvedCategory.nameAr || resolvedCategory.name) : row.categoryAr,
        __meta: {
          ...meta,
          status,
          reasons,
          matchTargets,
          categoryCandidates,
          categoryState,
          categoryResolution,
          editedName: nameValue,
          editedSku: skuValue,
          hasRequiredEdits,
          isConflictFreeNow: !hasDuplicateConflict,
          wasQuarantinedDuplicate,
        },
      };
    });
  };

  // Parse prices robustly from various formats (e.g., "1,234.50", "1.234,50", "1٬234٫50", with currency symbols)
  const parsePriceValue = (val: unknown): number => {
    if (val == null) return NaN;
    let s = String(val).trim();
    if (!s) return NaN;
    // Convert Arabic-Indic digits to Western 0-9
    const arabicIndicMap: Record<string, string> = {
      '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4', '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9',
      'Û°': '0', 'Û±': '1', 'Û²': '2', 'Û³': '3', 'Û´': '4', 'Ûµ': '5', 'Û¶': '6', 'Û·': '7', 'Û¸': '8', 'Û¹': '9'
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
      setImportPreview(runImportPreflight(enhanced));
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
      setImportPreview(runImportPreflight(enhanced));
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

    const preflightPreview = runImportPreflight(enhancedPreview);
    setImportPreview(preflightPreview);
    setPreviewPage(1);
    setImportStep('preview');

    toast({
      title: "تم إنشاء المعاينة",
      description: `تم تحضير ${preflightPreview.length} منتج مع فحص التكرار.`,
    });
  };

  const executeImport = async () => {
    if (isImportSubmitting) return;

    const finalPreflight = runImportPreflight(importPreview, importPreview);
    setImportPreview(finalPreflight);

    const invalidCount = finalPreflight.filter((row) => row.__meta.status === 'invalid').length;
    if (invalidCount > 0) {
      toast({
        title: 'لا يمكن الاستيراد',
        description: `يوجد ${invalidCount} صف غير صالح (اسم/كود/سعر). عالجها أو احذفها قبل الاستيراد.`,
        variant: 'destructive',
      });
      return;
    }

    const incoming = finalPreflight.filter((row) => row.__meta.status === 'ready');
    if (incoming.length === 0) {
      toast({
        title: 'لا توجد صفوف جاهزة',
        description: 'لا يوجد أي منتج بحالة جاهز للاستيراد.',
        variant: 'destructive',
      });
      return;
    }

    const missingCategoryIncoming = incoming.filter((row) => {
      const id = String(row.category || '').trim();
      return !id || !categories.some((c) => String(c.id) === id);
    });
    if (missingCategoryIncoming.length > 0) {
      toast({
        title: 'لا يمكن الاستيراد',
        description: `اختر فئةً صالحة لكل المنتجات الجاهزة (${missingCategoryIncoming.length} بدون فئة).`,
        variant: 'destructive',
      });
      return;
    }

    setIsImportSubmitting(true);
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
    } finally {
      setIsImportSubmitting(false);
      setIsImportConfirmOpen(false);
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
    setPreviewPerPage('all');
    setPreviewPage(1);
    setBulkCategoryId('');
    setIsImportSubmitting(false);
    setIsImportConfirmOpen(false);
    setIsQuarantineModalOpen(false);
    setQuarantineReviewIds(new Set());
    setQuarantineCheckingIds(new Set());
    setQuarantineAcceptedRows([]);
    setImportPreviewLiveSearch('');
  };

  useEffect(() => {
    setQuarantineReviewIds((prev) => {
      const rowsById = new Set(importPreview.map((row) => row.__rowId));
      const next = new Set<string>();
      prev.forEach((id) => {
        if (rowsById.has(id)) next.add(id);
      });
      importPreview.forEach((row) => {
        if (row.__meta.status !== 'ready' && row.__meta.status !== 'skipped_file_duplicate') {
          next.add(row.__rowId);
        }
      });
      if (next.size === prev.size && [...next].every((id) => prev.has(id))) {
        return prev;
      }
      return next;
    });
  }, [importPreview]);

  const quarantinedRows = useMemo(
    () => importPreview.filter((row) => quarantineReviewIds.has(row.__rowId)),
    [importPreview, quarantineReviewIds]
  );

  const quarantineModalGroups = useMemo(() => {
    const dedupeKey = (row: ImportPreviewRow) => {
      const sk = normalizeSku(String(row.sku || ''));
      if (sk) return `s:${sk}`;
      const nk = normalizeKey(String(row.nameAr || row.name || ''));
      return nk ? `n:${nk}` : `id:${row.__rowId}`;
    };
    const ordered = [...quarantinedRows].sort(
      (a, b) =>
        importPreview.findIndex((r) => r.__rowId === a.__rowId) -
        importPreview.findIndex((r) => r.__rowId === b.__rowId)
    );
    const keyToRep = new Map<string, ImportPreviewRow>();
    const keyToExtra = new Map<string, number>();
    for (const row of ordered) {
      const k = dedupeKey(row);
      if (!keyToRep.has(k)) {
        keyToRep.set(k, row);
        keyToExtra.set(k, 0);
      } else {
        keyToExtra.set(k, (keyToExtra.get(k) || 0) + 1);
      }
    }
    return Array.from(keyToRep.entries()).map(([key, row]) => ({
      key,
      row,
      extraSameProductRows: keyToExtra.get(key) || 0,
    }));
  }, [quarantinedRows, importPreview]);

  const quarantineDistinctCount = quarantineModalGroups.length;

  const setQuarantinedRowField = (rowId: string, field: 'name' | 'nameAr' | 'sku' | 'price', value: string) => {
    setImportPreview((prev) => {
      const next = prev.map((row) => {
        if (row.__rowId !== rowId) return row;
        if (field === 'name' || field === 'nameAr') {
          return { ...row, name: value, nameAr: value };
        }
        if (field === 'price') {
          return { ...row, price: value === '' ? undefined : Number(value) };
        }
        return { ...row, [field]: value };
      });
      return runImportPreflight(next, prev);
    });
  };

  const acceptQuarantinedRow = (rowId: string) => {
    setQuarantineCheckingIds((prev) => {
      const next = new Set(prev);
      next.add(rowId);
      return next;
    });

    window.setTimeout(() => {
      let accepted = false;
      setImportPreview((prev) => {
        const rechecked = runImportPreflight(prev, prev);
        const row = rechecked.find((item) => item.__rowId === rowId);
        if (!row) return rechecked;

        const canAccept =
          row.__meta.status === 'ready' &&
          row.__meta.isConflictFreeNow &&
          (!row.__meta.wasQuarantinedDuplicate || row.__meta.hasRequiredEdits);

        if (!canAccept) {
          return rechecked;
        }

        accepted = true;
        setQuarantineAcceptedRows((prevRows) => {
          const withoutDup = prevRows.filter((item) => item.row.__rowId !== rowId);
          return [...withoutDup, { row, fading: false }];
        });
        setQuarantineReviewIds((prevIds) => {
          const next = new Set(prevIds);
          next.delete(rowId);
          return next;
        });
        return rechecked;
      });

      if (!accepted) {
        toast({
          title: 'الصف غير جاهز للاعتماد',
          description: 'عدّل الاسم والكود حتى يختفي أي تطابق، ثم حاول مرة أخرى.',
          variant: 'destructive',
        });
        setQuarantineCheckingIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
        return;
      }

      window.setTimeout(() => {
        setQuarantineAcceptedRows((prevRows) =>
          prevRows.map((item) => (item.row.__rowId === rowId ? { ...item, fading: true } : item))
        );
      }, 3200);
      window.setTimeout(() => {
        setQuarantineAcceptedRows((prevRows) => prevRows.filter((item) => item.row.__rowId !== rowId));
        setQuarantineCheckingIds((prev) => {
          const next = new Set(prev);
          next.delete(rowId);
          return next;
        });
      }, 5200);
      toast({
        title: 'تم قبول الصف',
        description: 'تم اعتماد التعديلات وإضافة الصف إلى الجاهز للاستيراد.',
      });
    }, 120);
  };

  const [columnWidths, setColumnWidths] = useState({
    image: 90,
    name: 300,
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
                    <span className="text-orange-100 text-sm">تنبيه!</span>
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
                    <span className="font-medium text-slate-700">{displayedProducts.length}</span> في الجدول
                    {displayedProducts.length !== filteredProducts.length ? (
                      <span className="text-slate-400"> (من {filteredProducts.length} بعد البحث والفئة)</span>
                    ) : (
                      <span> {selectedCategory && selectedCategory !== 'all' ? 'في الفئة المحددة' : 'إجمالي'}</span>
                    )}
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
                  استيراد ملف المنتجات
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsExportModalOpen(true)}
                  className="bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700 shadow-sm"
                >
                  <FileSpreadsheet className="w-4 h-4 mr-2" />
                  {'\u062a\u0635\u062f\u064a\u0631 \u0645\u0646\u062a\u062c\u0627\u062a'}
                </Button>
                {familyCardsInListings && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setFamilyMergeOpen(true)}
                    className="bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800 shadow-sm"
                  >
                    <Link2 className="w-4 h-4 mr-2" />
                    دمج عائلة
                  </Button>
                )}
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
                            أدخل تفاصيل المنتج الجديد ثم قم بإضافته إلى المتجر
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

          {/* Filters & search — single wrapping row */}
          <div className="p-4 md:p-5 bg-slate-50/50">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="w-full min-w-0 sm:w-44 md:w-48 shrink-0">
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

              <div className="relative flex-1 min-w-[200px] basis-full sm:basis-[min(100%,18rem)] grow">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <Input
                  placeholder="البحث بالاسم أو الكود..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10 h-10 bg-white border-slate-200 shadow-sm w-full"
                  ref={searchInputRef}
                />
              </div>

              <div className="w-[calc(50%-0.25rem)] min-w-0 sm:w-40 md:w-44 shrink-0">
                <Select value={tableSort} onValueChange={(v) => setTableSort(v as AdminTableSort)}>
                  <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm gap-2">
                    <ArrowDownWideNarrow className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                    <SelectValue placeholder="الترتيب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="newest">الأحدث أولاً</SelectItem>
                    <SelectItem value="oldest">الأقدم أولاً</SelectItem>
                    <SelectItem value="name_asc">الاسم (أ–ي)</SelectItem>
                    <SelectItem value="name_desc">الاسم (ي–أ)</SelectItem>
                    <SelectItem value="price_asc">السعر: من الأقل</SelectItem>
                    <SelectItem value="price_desc">السعر: من الأعلى</SelectItem>
                    <SelectItem value="sku_asc">رمز SKU</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {familyCardsInListings ? (
                <div className="w-[calc(50%-0.25rem)] min-w-0 sm:w-44 md:w-52 shrink-0">
                  <Select
                    value={familyTableFilter}
                    onValueChange={(v) => setFamilyTableFilter(v as FamilyTableFilter)}
                  >
                    <SelectTrigger className="h-10 bg-white border-slate-200 shadow-sm gap-2">
                      <Layers className="h-4 w-4 shrink-0 text-slate-500" aria-hidden />
                      <SelectValue placeholder="العائلات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المنتجات</SelectItem>
                      <SelectItem value="no_family">بدون عائلة</SelectItem>
                      <SelectItem value="in_family">منتجات ضمن عائلات (كل الأفراد)</SelectItem>
                      <SelectItem value="family_rep">عائلات فقط (صف ممثل لكل عائلة)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <div className="w-full min-w-0 sm:w-28 shrink-0 sm:ms-auto">
                <Select
                  value={String(itemsPerPage)}
                  onValueChange={(val) => {
                    setItemsPerPage(Number(val));
                    setCurrentPage(1);
                  }}
                >
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
            </div>

            {/* Mobile Actions Row */}
            <div
              className={`grid md:hidden gap-2 mt-3 ${
                familyCardsInListings ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'
              }`}
            >
              <Button
                variant="outline"
                size="sm"
                onClick={() => { resetImportState(); setIsImportModalOpen(true); }}
                className="flex-1 h-10 bg-white border-slate-200"
              >
                <Upload className="w-4 h-4 mr-2" />
                استيراد ملف المنتجات
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsExportModalOpen(true)}
                className="flex-1 h-10 bg-emerald-50 border-emerald-200 text-emerald-700"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                {'\u062a\u0635\u062f\u064a\u0631'}
              </Button>
              {familyCardsInListings && (
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() => setFamilyMergeOpen(true)}
                  className="flex-1 h-10 bg-indigo-50 border-indigo-200 text-indigo-800"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  دمج عائلة
                </Button>
              )}
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
            {visiblePaginatedProducts.map((product) => {
              const famKeyCard =
                familyCardsInListings && product.productFamilyId ? String(product.productFamilyId) : '';
              const familyCardOpen = Boolean(famKeyCard && expandedFamilyIds.has(famKeyCard));
              return (
              <div
                key={product.id}
                className={`bg-white/90 backdrop-blur-xl border rounded-2xl shadow-lg overflow-hidden ${
                  familyCardOpen
                    ? 'border-violet-400 ring-2 ring-violet-200/90'
                    : 'border-slate-200/50'
                }`}
              >
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
                          onError={applyProductImageFallback}
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
                          {(() => {
                            if (!familyCardsInListings) {
                              return (
                                <>
                                  <h3 className="font-bold text-slate-900 text-base leading-tight">{product.nameAr}</h3>
                                  <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
                                </>
                              );
                            }
                            const meta = getFamilyTableMeta(product);
                            const fid = meta?.fid ?? '';
                            const famOpen = Boolean(fid && expandedFamilyIds.has(fid));
                            const collapsedRep = Boolean(meta?.isRep && !famOpen);
                            const defName = meta?.defProd
                              ? meta.defProd.nameAr || meta.defProd.name || meta.defProd.sku || ''
                              : '';
                            const variantName = product.nameAr || '';

                            if (collapsedRep && meta) {
                              const famTitle = meta.fam.nameAr || meta.fam.name || 'عائلة';
                              const sub = defName || variantName;
                              return (
                                <>
                                  <h3 className="font-bold text-slate-900 text-base leading-tight">{famTitle}</h3>
                                  {sub ? (
                                    <p className="text-xs text-slate-500 leading-snug line-clamp-2" dir="auto">
                                      {sub}
                                    </p>
                                  ) : null}
                                  <p className="text-xs text-slate-500 font-mono mt-0.5">{product.sku}</p>
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[11px]"
                                      onClick={() => toggleFamilyExpand(fid)}
                                    >
                                      أعضاء ({meta.n})
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      title="تعديل العائلة"
                                      onClick={() => setEditFamily(meta.fam)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </>
                              );
                            }

                            return (
                              <>
                                <h3 className="font-bold text-slate-900 text-base leading-tight">{product.nameAr}</h3>
                                <p className="text-xs text-slate-500 font-mono">{product.sku}</p>
                                {meta?.isRep && famOpen ? (
                                  <div className="flex flex-wrap gap-1.5 mt-2">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-[11px]"
                                      onClick={() => toggleFamilyExpand(fid)}
                                    >
                                      طيّ
                                    </Button>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 w-7 p-0"
                                      title="تعديل العائلة"
                                      onClick={() => setEditFamily(meta.fam)}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                ) : null}
                              </>
                            );
                          })()}
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
              );
            })}
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
                      جدول المنتجات ({displayedProducts.length}
                      {familyCardsInListings && paginationSourceProducts.length !== displayedProducts.length
                        ? ` · ${paginationSourceProducts.length} صفاً للترقيم`
                        : ''}
                      )
                    </CardTitle>
                    <div className="text-sm md:text-lg text-slate-600 font-medium space-y-2">
                      <p className="text-sm md:text-lg text-slate-600">
                        <span className="hidden sm:inline">
                          {paginationSourceProducts.length === 0
                            ? 'لا صفوف في هذه الصفحة'
                            : <>
                                عرض {(currentPage - 1) * itemsPerPage + 1} -{' '}
                                {Math.min(currentPage * itemsPerPage, paginationSourceProducts.length)} من أصل{' '}
                                {paginationSourceProducts.length}
                                {familyCardsInListings ? ' صفاً (عائلات مدمجة)' : ' منتج'}
                              </>}
                          {familyCardsInListings && visiblePaginatedProducts.length > paginatedProducts.length ? (
                            <span className="text-slate-500"> — معروض الآن {visiblePaginatedProducts.length} صفاً (عائلة موسّعة)</span>
                          ) : null}
                        </span>
                        <span className="sm:hidden">
                          {paginationSourceProducts.length} {familyCardsInListings ? 'صف' : 'منتج'}
                        </span>
                      </p>
                      {familyCardsInListings && familyListingStats.memberRows > 0 ? (
                        <p className="text-xs text-slate-500 md:text-sm">
                          {familyListingStats.familyGroups} عائلة · {familyListingStats.memberRows} صفاً في القائمة المعروضة
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 md:gap-4 w-full sm:w-auto">
                  <div className="flex items-center gap-2">
                    <Label className="text-xs md:text-sm font-semibold text-slate-700 whitespace-nowrap">لكل صفحة:</Label>
                    <Select
                      value={itemsPerPage.toString()}
                      onValueChange={(value) => {
                        setItemsPerPage(Number(value));
                        setCurrentPage(1);
                      }}
                    >
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
                      <SelectValue placeholder="اختر إجراء" />
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
                              checked={visiblePaginatedProducts.length > 0 && visiblePaginatedProducts.every((p) => selectedIds.has(String(p.id)))}
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
                            style={{ width: columnWidths.actions }}>
                            <span>الإجراءات</span>
                            <span className="absolute left-0 top-0 h-full w-1.5 cursor-ew-resize hover:bg-primary/60 transition-colors" onMouseDown={startResize('actions')} />
                          </TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {visiblePaginatedProducts.map((product) => {
                          const famKeyRow =
                            familyCardsInListings && product.productFamilyId
                              ? String(product.productFamilyId)
                              : '';
                          const inExpandedFamily =
                            famKeyRow !== '' && expandedFamilyIds.has(famKeyRow);
                          const famEdge = famKeyRow ? expandedFamilyEdges.get(famKeyRow) : undefined;
                          const isFamFirst =
                            Boolean(famEdge && String(product.id) === famEdge.firstId);
                          const isFamLast =
                            Boolean(famEdge && String(product.id) === famEdge.lastId);
                          const famHue = famKeyRow ? stableHueFromFamilyId(famKeyRow) : 0;
                          return (
                          <Fragment key={product.id}>
                            {/* Enhanced Main Row */}
                            <TableRow
                              key={product.id}
                              className={[
                                'border-s-4 transition-[background-color,box-shadow,border-color,filter] duration-300 ease-out',
                                expandedRows.has(product.id)
                                  ? 'hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 bg-gradient-to-r from-primary/5 to-secondary/5 border-s-primary shadow-md'
                                    : inExpandedFamily
                                    ? [
                                        'border-s-transparent motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300',
                                        'hover:brightness-[0.985]',
                                        isFamFirst ? 'rounded-tr-2xl' : '',
                                        isFamLast ? 'rounded-br-2xl' : '',
                                      ].join(' ')
                                    : [
                                        'hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5',
                                        familyCardsInListings &&
                                        product.productFamilyId &&
                                        isFamilyRepresentative(product)
                                          ? 'border-s-violet-600 bg-gradient-to-l from-violet-100/95 via-violet-50/40 to-white shadow-sm'
                                          : familyCardsInListings &&
                                              product.productFamilyId &&
                                              !isFamilyRepresentative(product)
                                            ? 'border-s-indigo-500 bg-indigo-50/80'
                                            : 'border-s-transparent hover:border-s-primary/25',
                                      ].join(' '),
                              ].join(' ')}
                              style={
                                inExpandedFamily && famKeyRow
                                  ? {
                                      borderLeftColor: `hsl(${famHue} 58% 42%)`,
                                      backgroundImage: `linear-gradient(to left, hsl(${famHue} 65% 95.5%), hsl(${famHue} 52% 91% / 0.92), hsl(${famHue} 42% 97% / 0.42))`,
                                      boxShadow: `inset 0 0 0 1px hsl(${famHue} 50% 46% / 0.4), 4px 0 24px -8px hsl(${famHue} 48% 38% / 0.38)`,
                                    }
                                  : undefined
                              }
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
                                <div className="relative inline-flex items-center justify-center group w-14 h-14">
                                  {getProductPrimaryImage(product) ? (
                                    <img
                                      src={optimizeImage(getProductPrimaryImage(product) || '', { w: 64 })}
                                      alt={product.nameAr}
                                      className="w-14 h-14 object-cover rounded-2xl border-2 border-slate-200 shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:shadow-xl cursor-zoom-in ring-2 ring-transparent group-hover:ring-blue-200"
                                      loading="lazy"
                                      decoding="async"
                                      srcSet={buildSrcSet(getProductPrimaryImage(product) || '', 64)}
                                      sizes="64px"
                                      onError={applyProductImageFallback}
                                      onClick={() => {
                                        const src = getProductPrimaryImage(product);
                                        if (src) setImagePreview(src);
                                      }}
                                    />
                                  ) : (
                                    <div className="w-14 h-14 bg-slate-100 rounded-2xl border-2 border-slate-200 flex items-center justify-center shadow-sm">
                                      <Package className="w-6 h-6 text-slate-400" />
                                    </div>
                                  )}
                                  {product.featured && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center shadow-lg animate-pulse">
                                      <Star className="w-3 h-3 text-white" />
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell
                                className="min-w-0 overflow-hidden text-center align-top"
                                style={{ width: columnWidths.name }}
                              >
                                <div className="mx-auto w-full min-w-0 max-w-full space-y-1 px-0.5">
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
                                      className="h-8 w-full min-w-0 text-center"
                                    />
                                  ) : (
                                    (() => {
                                      if (!familyCardsInListings) {
                                        return (
                                          <div
                                            className="group flex w-full min-w-0 cursor-text flex-col items-center gap-1"
                                            onClick={() => startInlineEdit(product, 'name')}
                                            title="انقر للتعديل"
                                          >
                                            <p
                                              className="w-full min-w-0 max-w-full break-words text-center font-medium leading-snug text-slate-900 line-clamp-2"
                                              title={product.nameAr || product.name}
                                            >
                                              {product.nameAr || product.name}
                                            </p>
                                            <Edit className="w-3 h-3 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                          </div>
                                        );
                                      }
                                      const meta = getFamilyTableMeta(product);
                                      const fid = meta?.fid ?? '';
                                      const famOpen = Boolean(fid && expandedFamilyIds.has(fid));
                                      const collapsedRep = Boolean(meta?.isRep && !famOpen);

                                      const defaultName = meta?.defProd
                                        ? meta.defProd.nameAr || meta.defProd.name || meta.defProd.sku || ''
                                        : '';
                                      const variantName = product.nameAr || product.name || '';

                                      if (collapsedRep && meta) {
                                        const famTitle = meta.fam.nameAr || meta.fam.name || 'عائلة';
                                        const sub = defaultName || variantName;
                                        return (
                                          <>
                                            <div
                                              className="group flex w-full min-w-0 cursor-text flex-col items-center gap-0.5"
                                              onClick={() => startInlineEdit(product, 'name')}
                                              title="تعديل اسم المنتج"
                                            >
                                              <p
                                                className="w-full min-w-0 max-w-full break-words text-center font-semibold leading-snug text-slate-900 line-clamp-2"
                                                title={famTitle}
                                              >
                                                {famTitle}
                                              </p>
                                              {sub ? (
                                                <p
                                                  className="w-full min-w-0 max-w-full break-words text-center text-xs text-slate-500 line-clamp-2"
                                                  dir="auto"
                                                  title={sub}
                                                >
                                                  {sub}
                                                </p>
                                              ) : null}
                                              <Edit className="w-3 h-3 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div
                                              className="flex justify-center gap-1 pt-1"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-[11px]"
                                                onClick={() => toggleFamilyExpand(fid)}
                                              >
                                                أعضاء ({meta.n})
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                title="تعديل العائلة"
                                                onClick={() => setEditFamily(meta.fam)}
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          </>
                                        );
                                      }

                                      const titleBlock = (
                                        <div
                                          className="group flex w-full min-w-0 cursor-text flex-col items-center gap-1"
                                          onClick={() => startInlineEdit(product, 'name')}
                                          title="انقر للتعديل"
                                        >
                                          <p
                                            className="w-full min-w-0 max-w-full break-words text-center font-medium leading-snug text-slate-900 line-clamp-2"
                                            title={product.nameAr || product.name}
                                          >
                                            {product.nameAr || product.name}
                                          </p>
                                          <Edit className="w-3 h-3 shrink-0 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                      );

                                      if (meta?.isRep && famOpen) {
                                        return (
                                          <>
                                            {titleBlock}
                                            <div
                                              className="flex justify-center gap-1 pt-0.5"
                                              onClick={(e) => e.stopPropagation()}
                                            >
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 px-2 text-[11px]"
                                                onClick={() => toggleFamilyExpand(fid)}
                                              >
                                                طيّ
                                              </Button>
                                              <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                className="h-7 w-7 p-0"
                                                title="تعديل العائلة"
                                                onClick={() => setEditFamily(meta.fam)}
                                              >
                                                <Pencil className="h-3.5 w-3.5" />
                                              </Button>
                                            </div>
                                          </>
                                        );
                                      }

                                      return titleBlock;
                                    })()
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

                              <TableCell className="min-w-0 text-center align-top" style={{ width: columnWidths.sku }}>
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
                                  <div className="group flex min-w-0 w-full cursor-text items-center justify-center gap-1" onClick={() => startInlineEdit(product, 'sku')} title="انقر للتعديل">
                                    <Badge variant="outline" className="max-w-full shrink truncate font-mono" title={product.sku}>
                                      {product.sku}
                                    </Badge>
                                    <Edit className="h-3 w-3 shrink-0 text-slate-400 opacity-0 transition-opacity group-hover:opacity-100" />
                                  </div>
                                )}
                              </TableCell>

                              <TableCell className="min-w-0 text-center align-top" style={{ width: columnWidths.category }}>
                                <div className="min-w-0 space-y-1 px-0.5">
                                  {(() => {
                                    const cat = categories.find(c => String(c.id) === String(product.category) || c.slug === product.category);
                                    const displayName = cat ? (cat.nameAr || cat.name) : (product.categoryAr || 'â€”');
                                    const displayCode = cat ? (cat.slug || String(cat.id)) : String(product.category || '');
                                    return (
                                      <>
                                        <p className="line-clamp-2 break-words text-sm font-medium leading-snug text-slate-900">{displayName}</p>
                                        <p className="truncate text-xs text-slate-500">{displayCode}</p>
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
                                        onClick={() => window.open(buildProductPath(product.id), '_blank')}
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
                                                onError={applyProductImageFallback}
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
                          );
                        })}
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
                      صفحة {currentPage} من {totalPages} • إجمالي {paginationSourceProducts.length}
                      {familyCardsInListings ? ' صفاً للترقيم' : ' منتج'}
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
              {displayedProducts.length === 0 && (
                <div className="text-center py-12">
                  <ShoppingBag className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-slate-600 mb-2">لا توجد منتجات</h3>
                  <p className="text-slate-500 mb-4">
                    {filteredProducts.length > 0 && familyTableFilter !== 'all'
                      ? 'لا توجد نتائج ضمن فلتر العائلات الحالي. جرّب «كل المنتجات» أو غيّر البحث.'
                      : searchTerm || selectedCategory !== 'all'
                        ? 'لم يتم العثور على منتجات تطابق البحث أو الفلتر المحدد'
                        : 'لم يتم إضافة أي منتجات بعد'}
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
                        onError={applyProductImageFallback}
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


        {/* Smart Export Modal */}
        <Dialog
          open={isExportModalOpen}
          onOpenChange={(open) => {
            setIsExportModalOpen(open);
            if (open) {
              setExportStep('fields');
              setExportProductSearch('');
              setExportCategoryFilter('all');
              setExportScope('filtered');
              const initialPool = displayedProducts;
              setExportSelectedIds(new Set(initialPool.map((p) => String(p.id))));
            }
          }}
          modal={false}
        >
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" onOpenAutoFocus={(e) => e.preventDefault()}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                {'\u062a\u0635\u062f\u064a\u0631 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0628\u0635\u064a\u063a\u0629 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f'}
              </DialogTitle>
              <DialogDescription>
                {'\u0627\u062e\u062a\u0631 \u0645\u0627 \u062a\u0631\u064a\u062f \u062a\u0635\u062f\u064a\u0631\u0647 \u0628\u0633\u0631\u0639\u0629\u060c \u0648\u0633\u064a\u062a\u0645 \u0625\u062e\u0631\u0627\u062c \u0645\u0644\u0641 Excel \u0645\u062a\u0648\u0627\u0641\u0642 \u0645\u0639 \u0627\u0633\u062a\u064a\u0631\u0627\u062f \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0627\u0644\u0630\u0643\u064a.'}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-5">
              <div className="rounded-xl border border-slate-200 p-3 bg-slate-50/70">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant={exportStep === 'fields' ? 'default' : 'outline'}
                    onClick={() => setExportStep('fields')}
                    className="justify-start"
                  >
                    1) اختيار الحقول
                  </Button>
                  <Button
                    type="button"
                    variant={exportStep === 'products' ? 'default' : 'outline'}
                    onClick={() => setExportStep('products')}
                    disabled={selectedExportFieldsCount === 0}
                    className="justify-start"
                  >
                    2) اختيار المنتجات
                  </Button>
                </div>
              </div>

              {exportStep === 'fields' && (
                <div className="rounded-xl border border-slate-200 p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-slate-700">{'\u0627\u0644\u062d\u0642\u0648\u0644 \u0627\u0644\u0645\u0635\u062f\u0631\u0629'}</div>
                    <div className="flex items-center gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleAllExportFields(true)}>{'\u062a\u062d\u062f\u064a\u062f \u0627\u0644\u0643\u0644'}</Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => toggleAllExportFields(false)}>{'\u0625\u0644\u063a\u0627\u0621 \u0627\u0644\u0643\u0644'}</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {exportFieldOptions.map((field) => (
                      <label key={field.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 cursor-pointer hover:bg-slate-50">
                        <div>
                          <div className="text-sm font-medium text-slate-800">{field.label}</div>
                          <div className="text-xs text-slate-500">{field.hint}</div>
                        </div>
                        <Checkbox
                          checked={exportFields[field.key]}
                          onCheckedChange={(checked) => setExportFields((prev) => ({ ...prev, [field.key]: Boolean(checked) }))}
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {exportStep === 'products' && (
                <div className="rounded-xl border border-slate-200 p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-700">{'\u0646\u0637\u0627\u0642 \u0627\u0644\u062a\u0635\u062f\u064a\u0631'}</div>
                  <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
                    <div className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 flex items-center text-sm text-slate-700">
                      {`إجمالي المنتجات بعد البحث/الفلترة (${exportScopePoolFiltered.length})`}
                    </div>
                    <Button type="button" variant={exportScope === 'selected' ? 'default' : 'outline'} onClick={() => setExportScope('selected')}>
                      {`المحدد (${exportSelectedIds.size})`}
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-[1fr_220px_auto_auto] gap-2 items-center">
                    <Input
                      value={exportProductSearch}
                      onChange={(e) => setExportProductSearch(e.target.value)}
                      placeholder="ابحث داخل منتجات التصدير..."
                    />
                    <Select value={exportCategoryFilter} onValueChange={setExportCategoryFilter}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="تصفية الفئة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">كل الفئات</SelectItem>
                        {categories.map((c) => (
                          <SelectItem key={String(c.id)} value={String(c.id)}>
                            {c.nameAr || c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button type="button" variant="outline" size="sm" onClick={selectAllExportRows}>
                      تحديد الكل
                    </Button>
                    <Button type="button" variant="outline" size="sm" onClick={clearExportSelection}>
                      إلغاء التحديد
                    </Button>
                  </div>

                  <div className="rounded-lg border border-slate-200 max-h-64 overflow-y-auto divide-y divide-slate-100">
                    {exportScopePoolFiltered.length === 0 ? (
                      <div className="px-3 py-6 text-sm text-slate-500 text-center">لا توجد منتجات مطابقة</div>
                    ) : (
                      exportScopePoolFiltered.map((product) => {
                        const id = String(product.id);
                        const checked = exportSelectedIds.has(id);
                        return (
                          <label
                            key={id}
                            className={`flex items-center justify-between gap-3 px-3 py-2 cursor-pointer transition ${
                              checked
                                ? 'bg-emerald-50 border-r-4 border-emerald-500 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.25)]'
                                : 'hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 flex items-center gap-2">
                              {getProductPrimaryImage(product) ? (
                                <img
                                  src={optimizeImage(getProductPrimaryImage(product), { w: 48 })}
                                  alt={product.nameAr || product.name || 'product'}
                                  className="w-10 h-10 rounded-md border border-slate-200 object-cover bg-slate-100 shrink-0"
                                  loading="lazy"
                                  decoding="async"
                                  onError={applyProductImageFallback}
                                />
                              ) : (
                                <div className="w-10 h-10 rounded-md border border-slate-200 bg-slate-100 shrink-0" />
                              )}
                              <div className="min-w-0">
                                <div className="text-sm font-medium text-slate-800 truncate">{product.nameAr || product.name}</div>
                                <div className="text-xs text-slate-500 truncate">{product.sku || 'بدون كود'}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {checked ? <span className="text-[11px] font-semibold text-emerald-700">محدد</span> : null}
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(value) => toggleExportProduct(id, Boolean(value))}
                              />
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>

                  <div className="text-xs text-slate-600">
                    {`تم تحديد ${exportSelectedIds.size} من ${exportScopePoolFiltered.length} منتج ظاهر (${exportScopePool.length} ضمن النطاق).`}
                  </div>
                </div>
              )}

              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {`\u0633\u064a\u062a\u0645 \u062a\u0635\u062f\u064a\u0631 ${exportCandidates.length} \u0645\u0646\u062a\u062c \u0648 ${selectedExportFieldsCount} \u062d\u0642\u0644 \u0628\u0635\u064a\u063a\u0629 \u0645\u062a\u0648\u0627\u0641\u0642\u0629 \u0645\u0639 \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f.`}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsExportModalOpen(false)} disabled={isExportSubmitting}>
                {'\u0625\u0644\u063a\u0627\u0621'}
              </Button>
              {exportStep === 'fields' ? (
                <Button
                  type="button"
                  onClick={() => setExportStep('products')}
                  disabled={selectedExportFieldsCount === 0}
                >
                  التالي: اختيار المنتجات
                </Button>
              ) : (
                <>
                  <Button type="button" variant="outline" onClick={() => setExportStep('fields')} disabled={isExportSubmitting}>
                    رجوع للحقول
                  </Button>
                  <Button type="button" onClick={executeExportExcel} disabled={isExportSubmitting || selectedExportFieldsCount === 0 || exportCandidates.length === 0} className="bg-emerald-600 hover:bg-emerald-700">
                    {isExportSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                        {'\u062c\u0627\u0631\u064a \u0625\u0646\u0634\u0627\u0621 \u0627\u0644\u0645\u0644\u0641...'}
                      </>
                    ) : (
                      <>
                        <FileSpreadsheet className="w-4 h-4 ml-2" />
                        {'\u062a\u0635\u062f\u064a\u0631 Excel'}
                      </>
                    )}
                  </Button>
                </>
              )}
            </DialogFooter>
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
                ارفع ملف Excel/CSV يحتوي على جدول المنتجات وسيقوم النظام بقراءته تلقائيًا
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
                        يدعم النظام فقط ملفات Excel/CSV التي تحتوي على جدول
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
                  <div className="flex items-center gap-3">
                    <div className="text-sm text-slate-600">
                      {`جاهز: ${importPreviewValidation.readyRows} / ${importPreview.length}`}
                    </div>
                    <Button
                      type="button"
                      variant={quarantinedRows.length > 0 ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => setIsQuarantineModalOpen(true)}
                      disabled={quarantinedRows.length === 0}
                    >
                      {quarantineDistinctCount !== quarantinedRows.length
                        ? `مراجعة المعزول (${quarantineDistinctCount} مجموعة · ${quarantinedRows.length} صف)`
                        : `مراجعة الصفوف المعزولة (${quarantinedRows.length})`}
                    </Button>
                  </div>
                </div>

                {importPreview.length > 0 ? (
                  <div
                    className="rounded-lg border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700 space-y-2"
                    dir="rtl"
                  >
                    <div className="font-semibold text-slate-900">ملخص الاستيراد</div>
                    <ul className="grid gap-1.5 sm:grid-cols-2 text-xs sm:text-sm list-none p-0 m-0">
                      <li>
                        إجمالي الصفوف: <strong>{importPreview.length}</strong>
                      </li>
                      <li>
                        جاهز للاستيراد:{' '}
                        <strong className="text-emerald-700">{importPreviewValidation.readyRows}</strong>
                      </li>
                      {importPreviewValidation.skippedFileDuplicate > 0 ? (
                        <li className="sm:col-span-2">
                          تكرار داخل الملف (يُحتفظ بأول صف فقط إن لم يكن المنتج في المتجر):{' '}
                          <strong className="text-slate-700">{importPreviewValidation.skippedFileDuplicate}</strong>{' '}
                          صفًا تم تخطّيها
                        </li>
                      ) : null}
                      {importPreviewValidation.quarantinedDuplicate > 0 ? (
                        <li>
                          يحتاج مراجعة (تعارض مع المتجر أو تكرار لم يُحل):{' '}
                          <strong className="text-red-700">{importPreviewValidation.quarantinedDuplicate}</strong>
                        </li>
                      ) : null}
                      {importPreviewValidation.invalidRowsCount > 0 ? (
                        <li>
                          غير صالح (اسم/كود/سعر):{' '}
                          <strong className="text-red-700">{importPreviewValidation.invalidRowsCount}</strong>
                        </li>
                      ) : null}
                      {importPreviewValidation.readyMissingCategory > 0 ? (
                        <li className="sm:col-span-2">
                          جاهز لكن بلا فئة محددة:{' '}
                          <strong className="text-amber-800">{importPreviewValidation.readyMissingCategory}</strong>
                          {' — '}اختر الفئة من العمود أو التعيين الجماعي.
                        </li>
                      ) : null}
                    </ul>
                  </div>
                ) : null}

                <div className="relative" dir="rtl">
                  <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
                  <Input
                    className="ps-10"
                    placeholder="بحث مباشر بالاسم أو الكود (المنتجات الجاهزة فقط)…"
                    value={importPreviewLiveSearch}
                    onChange={(e) => setImportPreviewLiveSearch(e.target.value)}
                    aria-label="بحث في معاينة الاستيراد"
                  />
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
                        <div className="px-3 py-2 text-sm text-muted-foreground">لا توجد فئات حاليًا</div>
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
                  const searchTrim = importPreviewLiveSearch.trim();
                  const searchKey = searchTrim ? normalizeKey(searchTrim) : '';
                  const searchSkuKey = searchTrim ? normalizeSku(searchTrim) : '';
                  const matchesImportSearch = (p: ImportPreviewRow) => {
                    if (!searchTrim) return true;
                    const label = normalizeKey(String(p.nameAr || p.name || ''));
                    const nameEn = normalizeKey(String(p.name || ''));
                    const skuRaw = String(p.sku || '').toLowerCase();
                    const skuNorm = normalizeSku(String(p.sku || ''));
                    if (searchKey && (label.includes(searchKey) || nameEn.includes(searchKey))) return true;
                    if (searchSkuKey && skuNorm.includes(searchSkuKey)) return true;
                    if (searchTrim && skuRaw.includes(searchTrim.toLowerCase())) return true;
                    return false;
                  };
                  const readyAll = importPreview.filter((p) => p.__meta.status === 'ready');
                  const rows = importPreview
                    .map((product, absoluteIndex) => ({ product, absoluteIndex }))
                    .filter(
                      ({ product }) => product.__meta.status === 'ready' && matchesImportSearch(product)
                    );
                  return (
                    <>
                      <div className="max-h-96 overflow-x-auto overflow-y-auto rounded-lg border">
                        <Table className="table-fixed min-w-[760px] w-full">
                          <TableHeader>
                            <TableRow>
                              <TableHead className="w-[32%] min-w-[160px] align-top">اسم المنتج</TableHead>
                              <TableHead className="w-24 whitespace-nowrap align-top">السعر</TableHead>
                              <TableHead className="w-28 whitespace-nowrap align-top">الكود</TableHead>
                              <TableHead className="w-24 whitespace-nowrap align-top">المخزون</TableHead>
                              <TableHead className="w-44 min-w-[11rem] align-top">الفئة</TableHead>
                              <TableHead className="w-36 whitespace-nowrap align-top">الحالة</TableHead>
                              <TableHead className="w-14 text-center align-top">إزالة</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {rows.map(({ product, absoluteIndex }) => {
                              const catMatch = categories.find(c => String(c.id) === String(product.category) || c.nameAr === product.categoryAr || c.name === product.category);
                              const catId = catMatch ? String(catMatch.id) : '';
                              const hasImportCategory =
                                catId !== '' && categories.some((c) => String(c.id) === catId);
                              const nameTitle = String(product.nameAr ?? product.name ?? '');
                              return (
                                <TableRow key={product.__rowId}>
                                  <TableCell className="min-w-0 align-top">
                                    <Input
                                      className="h-auto min-w-0 w-full max-w-full py-2 text-sm [word-break:break-word]"
                                      value={nameTitle}
                                      title={nameTitle}
                                      onChange={(e) => {
                                      const v = e.target.value;
                                      setImportPreview(prev => {
                                        const next = prev.map((it, i) => i === absoluteIndex ? { ...it, name: v, nameAr: v } : it);
                                        return runImportPreflight(next, prev);
                                      });
                                    }} placeholder="اسم المنتج" />
                                  </TableCell>
                                  <TableCell className="min-w-0 align-top">
                                    <Input className="min-w-0 w-full font-mono text-sm tabular-nums" type="number" value={String(product.price ?? '')} onChange={(e) => updateImportItem(absoluteIndex, 'price', e.target.value)} placeholder="السعر" />
                                  </TableCell>
                                  <TableCell className="min-w-0 align-top">
                                    <Input className="min-w-0 w-full font-mono text-sm" value={String(product.sku ?? '')} onChange={(e) => updateImportItem(absoluteIndex, 'sku', e.target.value)} placeholder="الكود" />
                                  </TableCell>
                                  <TableCell className="min-w-0 align-top">
                                    <Input className="min-w-0 w-full text-sm tabular-nums" type="number" value={String(product.stock ?? '')} onChange={(e) => updateImportItem(absoluteIndex, 'stock', e.target.value)} placeholder="المخزون" />
                                  </TableCell>
                                  <TableCell className="min-w-0 align-top">
                                    <Select value={catId} onOpenChange={(open) => open ? toast({ title: 'فتح قائمة الفئات' }) : undefined} onValueChange={(val) => {
                                      const cat = categories.find(c => String(c.id) === String(val));
                                      setImportPreview(prev => {
                                        const next = prev.map((it, i) => i === absoluteIndex ? {
                                          ...it,
                                          category: cat ? String(cat.id) : '',
                                          categoryAr: cat?.nameAr,
                                          __meta: {
                                            ...it.__meta,
                                            categoryResolution: cat ? ({ type: 'existing', categoryId: String(cat.id) } as ImportCategoryResolution) : it.__meta.categoryResolution,
                                          },
                                        } : it);
                                        return runImportPreflight(next, prev);
                                      });
                                    }}>
                                      <SelectTrigger className={`pointer-events-auto relative z-[1] h-auto min-h-9 w-full min-w-0 max-w-full whitespace-normal text-start text-sm ${!hasImportCategory ? 'border-amber-500 ring-1 ring-amber-200' : ''}`}>
                                        <SelectValue placeholder="اختر الفئة" />
                                      </SelectTrigger>
                                      <SelectContent position="popper" side="bottom" align="start" className="z-[99999]" sideOffset={6}>
                                        {categories.map(c => (
                                          <SelectItem key={String(c.id)} value={String(c.id)}>{c.nameAr || c.name}</SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                  </TableCell>
                                  <TableCell className="min-w-0 align-top">
                                    <div className="flex flex-col gap-1">
                                      <Badge variant={product.__meta.status === 'ready' ? 'default' : 'destructive'}>
                                        {product.__meta.status === 'ready' ? 'جاهز' : product.__meta.status === 'quarantined_duplicate' ? 'معزول: تكرار' : 'غير صالح'}
                                      </Badge>
                                      {product.__meta.status === 'ready' && !hasImportCategory ? (
                                        <Badge variant="outline" className="border-amber-600 text-amber-900 whitespace-normal text-[10px] leading-tight">
                                          اختر الفئة للاستيراد
                                        </Badge>
                                      ) : null}
                                      {product.__meta.reasons[0] ? (
                                        <div className="text-[11px] text-slate-600">{product.__meta.reasons[0].message}</div>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-center align-top">
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="icon"
                                      className="rounded-full hover:bg-red-50 hover:text-red-600 border-red-200/60"
                                      onClick={() => setImportPreview(prev => runImportPreflight(prev.filter((_, i) => i !== absoluteIndex), prev))}
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
                      <div className="flex flex-col gap-1 text-sm text-slate-600 mt-2 sm:flex-row sm:items-center sm:justify-between">
                        <span>
                          عرض {rows.length}
                          {searchTrim ? ` من ${readyAll.length}` : ''} منتج جاهز
                          {searchTrim ? ' مطابقة للبحث' : ''}
                          {' — '}إجمالي صفوف الملف {importPreview.length}
                        </span>
                        <span className="text-xs sm:text-sm">
                          {importPreviewValidation.skippedFileDuplicate > 0
                            ? `تخطّي تلقائي لتكرار داخل الملف: ${importPreviewValidation.skippedFileDuplicate} صف. `
                            : ''}
                          الصفوف التي تحتاج مراجعة من زر «مراجعة الصفوف المعزولة».
                        </span>
                      </div>
                    </>
                  );
                })()}

                <div className="flex gap-2">
                  <Button onClick={() => setImportStep('mapping')} variant="outline">
                    رجوع
                  </Button>
                  <Button
                    onClick={() => setIsImportConfirmOpen(true)}
                    disabled={!importPreviewValidation.canImportReadySubset || isImportSubmitting}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-slate-300 disabled:text-slate-600"
                  >
                    {isImportSubmitting ? (
                      <>
                        <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                        {'\u062c\u0627\u0631\u064a \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f...'}
                      </>
                    ) : (
                      <>{`\u0627\u0633\u062a\u064a\u0631\u0627\u062f ${importPreviewValidation.readyRows} \u0645\u0646\u062a\u062c`}</>
                    )}
                  </Button>
                </div>
                {importPreview.length > 0 &&
                  !importPreviewValidation.canImportReadySubset &&
                  importPreviewValidation.readyMissingCategory > 0 &&
                  importPreviewValidation.invalidRowsCount === 0 && (
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                      لا يمكن الاستيراد حتى تختار فئةً لكل منتج جاهز:{' '}
                      <strong>{importPreviewValidation.readyMissingCategory}</strong> صف بدون فئة. استخدم عمود «الفئة» أو «تعيين الفئة لكل العناصر».
                    </div>
                  )}
                {importPreview.length > 0 &&
                  !importPreviewValidation.canImportReadySubset &&
                  (importPreviewValidation.invalidRowsCount > 0 || importPreviewValidation.readyRows === 0) && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      لا يمكن الاستيراد الآن.
                      {importPreviewValidation.readyRows > 0 ? (
                        <> الصفوف الجاهزة: {importPreviewValidation.readyRows} من {importPreview.length}.</>
                      ) : (
                        <> لا توجد صفوف جاهزة من أصل {importPreview.length}.</>
                      )}
                      {importPreviewValidation.invalidRowsCount > 0
                        ? ` يوجد ${importPreviewValidation.invalidRowsCount} صف غير صالح (بيانات ناقصة). عالجها أو احذفها أولاً.`
                        : ''}
                    </div>
                  )}
                {importPreviewValidation.canImportReadySubset && !importPreviewValidation.isValid && importPreviewValidation.quarantinedDuplicate > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    يمكن استيراد {importPreviewValidation.readyRows} منتجًا جاهزًا.
                    {importPreviewValidation.skippedFileDuplicate > 0
                      ? ` تم تخطّي ${importPreviewValidation.skippedFileDuplicate} صفًا مكررًا داخل الملف تلقائيًا.`
                      : ''}
                    {` ما زال ${importPreviewValidation.quarantinedDuplicate} صفًا يحتاج مراجعة (تعارض مع المتجر). اضغط «استيراد» للتحذير والتأكيد.`}
                  </div>
                )}
                <Dialog
                  open={isImportConfirmOpen}
                  onOpenChange={(open) => {
                    if (!isImportSubmitting) setIsImportConfirmOpen(open);
                  }}
                >
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-amber-600" />
                        {'\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f'}
                      </DialogTitle>
                      <DialogDescription>
                        {importPreviewValidation.quarantinedDuplicate > 0
                          ? `سيتم استيراد ${importPreviewValidation.readyRows} منتجًا جاهزًا فقط إلى قاعدة البيانات. لن تُستورد الصفوف المعزولة. هل تريد المتابعة؟`
                          : `سيتم استيراد ${importPreviewValidation.readyRows} منتجًا إلى قاعدة البيانات. هل تريد المتابعة؟`}
                      </DialogDescription>
                    </DialogHeader>
                    {importPreviewValidation.quarantinedDuplicate > 0 ? (
                      <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800 space-y-1">
                        <div className="font-semibold">تحذير: صفوف لن تُستورد</div>
                        <div>
                          {`ما زال لديك ${importPreviewValidation.quarantinedDuplicate} صفًا معزولًا (تكرار داخل الملف أو تطابق مع منتج موجود). هذه الصفوف لن تُضاف إلا إذا عدّلتها من «مراجعة الصفوف المعزولة».`}
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                        تنبيه: تأكد من مراجعة الأسعار والأكواد قبل التأكيد.
                      </div>
                    )}
                    <DialogFooter>
                      <Button
                        variant="outline"
                        onClick={() => setIsImportConfirmOpen(false)}
                        disabled={isImportSubmitting}
                      >
                        رجوع
                      </Button>
                      <Button
                        onClick={executeImport}
                        disabled={isImportSubmitting}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        {isImportSubmitting ? (
                          <>
                            <RefreshCw className="w-4 h-4 ml-2 animate-spin" />
                            {'\u062c\u0627\u0631\u064a \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f...'}
                          </>
                        ) : (
                          <>{'\u062a\u0623\u0643\u064a\u062f \u0627\u0644\u0627\u0633\u062a\u064a\u0631\u0627\u062f'}</>
                        )}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Dialog open={isQuarantineModalOpen} onOpenChange={setIsQuarantineModalOpen}>
                  <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>مراجعة الصفوف المعزولة</DialogTitle>
                      <DialogDescription>
                        يُجمَّع المنتج المكرر (نفس الكود أو الاسم) في بطاقة واحدة لتفادي التكرار في العرض. عالج التكرار هنا أو استورد الجاهز فقط من المعاينة.
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                        خطوات القبول: 1) عدّل الاسم/الكود/السعر 2) تأكد أن الصف أصبح "جاهز للاعتماد" 3) اضغط "اعتماد التعديلات".
                      </div>
                      {(() => {
                        const rowsForDisplay = [
                          ...quarantineModalGroups.map(({ row, extraSameProductRows }) => ({
                            row,
                            accepted: false,
                            fading: false,
                            extraSameProductRows,
                          })),
                          ...quarantineAcceptedRows
                            .filter((item) => !quarantinedRows.some((r) => r.__rowId === item.row.__rowId))
                            .map((item) => ({
                              row: item.row,
                              accepted: true,
                              fading: item.fading,
                              extraSameProductRows: 0,
                            })),
                        ];
                        if (rowsForDisplay.length === 0) {
                          return (
                            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                              لا توجد صفوف معزولة حاليًا.
                            </div>
                          );
                        }
                        return rowsForDisplay.map(({ row, accepted, fading, extraSameProductRows }) => {
                          const rowIndex = importPreview.findIndex((r) => r.__rowId === row.__rowId) + 1;
                          const isChecking = quarantineCheckingIds.has(row.__rowId);
                          const isDisabledCard = isChecking || accepted;
                          const canAcceptRow =
                            row.__meta.status === 'ready' &&
                            row.__meta.isConflictFreeNow &&
                            (!row.__meta.wasQuarantinedDuplicate || row.__meta.hasRequiredEdits);
                          return (
                            <Card
                              key={row.__rowId}
                              className={`transition-all duration-500 animate-in fade-in-0 zoom-in-[0.99] ${
                                accepted
                                  ? 'border-emerald-400 bg-gradient-to-br from-emerald-50 via-white to-emerald-100/70 shadow-[0_0_0_1px_rgba(16,185,129,0.25),0_16px_40px_-18px_rgba(16,185,129,0.55)]'
                                  : canAcceptRow
                                    ? 'border-emerald-300 bg-emerald-50/40 shadow-[0_0_0_1px_rgba(16,185,129,0.18)]'
                                    : 'border-red-200'
                              } ${accepted && fading ? 'opacity-0 scale-[0.985]' : 'opacity-100 scale-100'}`}
                            >
                              <CardContent className={`pt-4 space-y-3 relative transition-all duration-300 ${isDisabledCard ? 'pointer-events-none blur-[1.5px]' : ''}`}>
                                {isDisabledCard ? (
                                  <div className="absolute inset-0 z-20 rounded-md bg-white/60 backdrop-blur-[2px] flex items-center justify-center">
                                    {isChecking ? (
                                      <div className="inline-flex items-center gap-2 rounded-full bg-primary text-white px-3 py-1 text-xs font-medium shadow">
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                        جاري التحقق...
                                      </div>
                                    ) : (
                                      <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 text-white px-3 py-1 text-xs font-medium shadow">
                                        <CheckCircle className="w-3.5 h-3.5" />
                                        تم اعتماد الصف بنجاح
                                      </div>
                                    )}
                                  </div>
                                ) : null}
                                {isChecking ? (
                                  <div className="h-1 w-full rounded bg-primary/15 overflow-hidden">
                                    <div className="h-full w-1/3 bg-primary animate-pulse" />
                                  </div>
                                ) : null}
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="destructive">{`صف ${rowIndex}`}</Badge>
                                    <Badge variant="outline">
                                      {row.__meta.status === 'ready'
                                        ? 'جاهز للاعتماد'
                                        : row.__meta.status === 'quarantined_duplicate'
                                          ? 'تكرار'
                                          : 'غير صالح'}
                                    </Badge>
                                    {accepted ? (
                                      <Badge className="bg-emerald-600 hover:bg-emerald-600">مقبول</Badge>
                                    ) : null}
                                    {isChecking ? (
                                      <Badge variant="secondary" className="gap-1">
                                        <RefreshCw className="w-3 h-3 animate-spin" />
                                        جاري التحقق
                                      </Badge>
                                    ) : null}
                                    {row.__meta.hasRequiredEdits && !row.__meta.isConflictFreeNow ? (
                                      <Badge variant="secondary">تم التعديل لكن ما زال مطابقًا</Badge>
                                    ) : null}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {`قبل: ${row.__meta.originalName || '-'} | ${row.__meta.originalSku || '-'}`}
                                  </div>
                                </div>

                                {extraSameProductRows > 0 ? (
                                  <div className="rounded-md border border-slate-200 bg-slate-100/80 px-3 py-2 text-xs text-slate-700">
                                    {`يوجد ${extraSameProductRows} صفًا إضافيًا في الملف بنفس الكود/الاسم — عُرض صف واحد للتعديل، وسيُحدَّث تقييم التكرار للجميع بعد حفظ التغييرات.`}
                                  </div>
                                ) : null}

                                <div className="flex items-center justify-end">
                                  <Button
                                    size="sm"
                                    disabled={!canAcceptRow || isDisabledCard}
                                    onClick={() => acceptQuarantinedRow(row.__rowId)}
                                    className="bg-primary hover:bg-primary/90"
                                  >
                                    {isChecking ? (
                                      <>
                                        <RefreshCw className="w-3.5 h-3.5 animate-spin ml-1" />
                                        جاري الاعتماد...
                                      </>
                                    ) : (
                                      'اعتماد التعديلات'
                                    )}
                                  </Button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <Input
                                    value={String(row.nameAr || row.name || '')}
                                    onChange={(e) => setQuarantinedRowField(row.__rowId, 'nameAr', e.target.value)}
                                    placeholder="اسم المنتج"
                                    disabled={isDisabledCard}
                                  />
                                  <Input
                                    value={String(row.sku || '')}
                                    onChange={(e) => setQuarantinedRowField(row.__rowId, 'sku', e.target.value)}
                                    placeholder="كود المنتج"
                                    disabled={isDisabledCard}
                                  />
                                  <Input
                                    type="number"
                                    value={String(row.price ?? '')}
                                    onChange={(e) => setQuarantinedRowField(row.__rowId, 'price', e.target.value)}
                                    placeholder="السعر"
                                    disabled={isDisabledCard}
                                  />
                                </div>

                                {canAcceptRow ? (
                                  <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 space-y-1">
                                    <div className="font-semibold">الصف جاهز للإدخال.</div>
                                    <div>لا يوجد أي تطابق أو خطأ في هذا الصف الآن.</div>
                                    <div>الخطوة التالية: اضغط زر "اعتماد التعديلات" لإضافته مباشرة لقائمة الاستيراد.</div>
                                  </div>
                                ) : (
                                  <>
                                    {row.__meta.reasons.length > 0 ? (
                                      <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 space-y-1">
                                        {row.__meta.reasons.map((reason, idx) => (
                                          <div key={`${row.__rowId}-reason-${idx}`}>• {reason.message}</div>
                                        ))}
                                      </div>
                                    ) : null}

                                    {row.__meta.matchTargets.length > 0 ? (
                                      <div className="rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 space-y-1 break-words">
                                        <div className="font-medium">التطابقات الحالية:</div>
                                        {Array.from(
                                          new Map(
                                            row.__meta.matchTargets.map((t) => [`${t.type}-${t.id}`, t] as const)
                                          ).values()
                                        ).map((target) => (
                                          <div key={`${row.__rowId}-${target.type}-${target.id}`}>{`• ${target.type === 'database' ? 'قاعدة البيانات' : 'داخل الملف'}: ${target.label}`}</div>
                                        ))}
                                      </div>
                                    ) : null}
                                  </>
                                )}
                              </CardContent>
                            </Card>
                          );
                        });
                      })()}
                    </div>

                    <DialogFooter>
                      <Button variant="outline" onClick={() => setIsQuarantineModalOpen(false)}>إغلاق</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
                ارفع ملف Excel/CSV لتحديث الأسعار فقط للمنتجات المطابقة (سيتم التطابق بالكود أو الاسم)
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
                    سيتم تحديث المنتجات الموجودة فقط، ولن يتم إضافة منتجات جديدة
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
                                          onClick={() => setImportPreview(prev => runImportPreflight(prev.filter((_, i) => i !== idx), prev))}
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
            <img src={imagePreview ?? ''} alt="معاينة الصورة" className="max-h-[85vh] w-auto object-contain rounded-md" onError={applyProductImageFallback} />
          </div>
        </DialogContent>
      </Dialog>
      <ProductFamilyEditDialog
        open={!!editFamily}
        onOpenChange={(o) => {
          if (!o) setEditFamily(null);
        }}
        family={editFamily}
        products={products.map((p) => ({
          id: String(p.id),
          name: p.name,
          nameAr: p.nameAr,
          sku: p.sku,
          image: p.image,
          categoryId: p.categoryId ?? (typeof p.category === 'string' ? p.category : String(p.category ?? '')),
          productFamilyId: p.productFamilyId ?? null,
        }))}
        categories={categories.map((c) => ({ id: c.id, nameAr: c.nameAr, name: c.name }))}
        onSaved={async () => {
          clearStorefrontFamiliesCache();
          await fetchAdminFamilies();
          await refetchProducts();
        }}
      />
      {familyCardsInListings && (
        <ProductFamilyMergeDialog
          open={familyMergeOpen}
          onOpenChange={setFamilyMergeOpen}
          products={products.map((p) => ({
            _id: p.id,
            name: p.name,
            nameAr: p.nameAr,
            sku: p.sku,
            productFamilyId: p.productFamilyId,
            image: p.image,
            categoryId: p.categoryId ?? p.category ?? '',
          }))}
          categories={categories.map((c) => ({ id: c.id, nameAr: c.nameAr, name: c.name }))}
          onCreated={async (created) => {
            clearStorefrontFamiliesCache();
            if (created?._id) {
              const famId = String(created._id);
              setAdminFamilyDocs((prev) => {
                if (prev.some((f) => String(f._id) === famId)) return prev;
                return [created, ...prev];
              });
              const memberIds = new Set(
                (created.memberProductIds || []).map((x) => String(x))
              );
              if (memberIds.size > 0) {
                setProducts((prev) =>
                  prev.map((p) =>
                    memberIds.has(String(p.id)) ? { ...p, productFamilyId: famId } : p
                  )
                );
              }
            }
            await fetchAdminFamilies();
            await refetchProducts();
          }}
        />
      )}
    </AdminLayout>
  );
};

export default AdminProducts;
