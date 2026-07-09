import { useState, useMemo } from 'react';
import {
  X, CheckCircle2, Loader2, ArrowLeftRight, ImageIcon,
  Package, ChevronDown, TrendingUp, TrendingDown, Search,
  ChevronLeft, ChevronRight, AlertTriangle, BarChart3,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

function isDefined(v: unknown): boolean {
  return v !== null && v !== '' && v !== undefined;
}

function fmtPrice(v: number | undefined | null, symbol = 'ر.س'): string {
  return isDefined(v) ? `${Number(v).toFixed(2)} ${symbol}` : '—';
}

function fmtStock(v: number | undefined | null): string {
  return isDefined(v) ? String(Number(v)) : '—';
}

interface ChangeItem {
  sku: string;
  name: string;
  nameAr?: string;
  image?: string;
  images?: string[];
  isNew?: boolean;
  current?: Record<string, unknown>;
  incoming?: Record<string, unknown>;
  diff?: Record<string, boolean>;
  fields?: Record<string, boolean>;
  ecomCategoryName?: string;
  localImages?: string[];
  ecomImages?: string[];
  hasImages?: boolean;
}

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  changes: ChangeItem[];
  onApply: (changes: ChangeItem[]) => void;
  applying?: boolean;
  currencySymbol?: string;
}

/* ── Inline editable field ── */
function InlineEdit({ label, value, onChange, type }: {
  label: string;
  value: string | number;
  onChange: (v: string | number) => void;
  type: 'text' | 'price' | 'stock';
}) {
  const [localVal, setLocalVal] = useState(String(value ?? ''));
  const displayValue = type === 'price' ? (Number(value) || 0).toFixed(2) : String(value ?? '');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLocalVal(e.target.value);
  };

  const handleBlur = () => {
    let finalValue: string | number = localVal;
    if (type === 'price') {
      finalValue = Math.max(0, Number(localVal) || 0);
      setLocalVal(finalValue.toFixed(2));
    } else if (type === 'stock') {
      finalValue = Math.max(0, parseInt(localVal) || 0);
      setLocalVal(String(finalValue));
    }
    onChange(finalValue);
  };

  return (
    <div>
      <label className="text-[10px] font-bold text-slate-400 block mb-0.5">{label}</label>
      <input
        type={type === 'stock' ? 'number' : type === 'price' ? 'number' : 'text'}
        value={localVal}
        onChange={handleChange}
        onBlur={handleBlur}
        step={type === 'price' ? '0.01' : '1'}
        min="0"
        className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
        dir={type === 'price' ? 'ltr' : 'auto'}
      />
    </div>
  );
}

/* ── FieldDiff: before → after ── */
function FieldDiff({ label, currentVal, newVal, type, currencySymbol }: {
  label: string;
  currentVal: unknown;
  newVal: unknown;
  type: string;
  currencySymbol: string;
}) {
  const isPrice = label.includes('سعر');
  const fmt = (v: unknown) => {
    if (!isDefined(v)) return '—';
    if (isPrice) return `${Number(v).toFixed(2)} ${currencySymbol}`;
    return String(v);
  };
  const arrowColor = type === 'up' ? 'text-emerald-600' : type === 'down' ? 'text-red-600' : 'text-slate-400';

  return (
    <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-slate-50 border border-slate-200/60">
      <div className="flex-1 min-w-0">
        <div className="text-[10px] font-bold text-slate-400 mb-0.5">{label}</div>
        <div className={cn('text-xs font-medium truncate', type === 'added' ? 'text-slate-400 line-through' : 'text-slate-500')}>
          {fmt(currentVal)}
        </div>
      </div>
      <div className={cn('flex-shrink-0 text-lg font-black', arrowColor)}>
        {type === 'up' ? '↑' : type === 'down' ? '↓' : '→'}
      </div>
      <div className="flex-1 min-w-0 text-right">
        <div className="text-[10px] font-bold text-slate-400 mb-0.5">&nbsp;</div>
        <div className={cn('text-xs font-bold truncate', type === 'removed' ? 'text-slate-400 line-through' : 'text-slate-800')}>
          {fmt(newVal)}
        </div>
      </div>
    </div>
  );
}

/* ── ImageDiff: old vs new ── */
function ImageDiff({ localImages, ecomImages, hasDiff }: {
  localImages: string[];
  ecomImages: string[];
  hasDiff: boolean;
}) {
  if (!hasDiff) return null;
  return (
    <div className="py-2 px-3 rounded-xl bg-amber-50/50 border border-amber-200/60">
      <div className="flex items-center gap-1.5 mb-2">
        <ImageIcon className="h-3.5 w-3.5 text-amber-600" />
        <span className="text-[11px] font-bold text-amber-700">تغيير في الصور</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-[10px] font-bold text-slate-400 mb-1">الصور الحالية</div>
          {localImages.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap">
              {localImages.slice(0, 4).map((url, i) => (
                <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200 bg-white">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              ))}
              {localImages.length > 4 && <span className="text-[10px] text-slate-400 self-end">+{localImages.length - 4}</span>}
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center">
              <X className="h-4 w-4 text-slate-400" />
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold text-slate-400 mb-1">الصور الجديدة</div>
          {ecomImages.length > 0 ? (
            <div className="flex gap-1.5 flex-wrap justify-end">
              {ecomImages.slice(0, 4).map((url, i) => (
                <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border border-amber-300 bg-white ring-1 ring-amber-200">
                  <img src={url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                </div>
              ))}
              {ecomImages.length > 4 && <span className="text-[10px] text-slate-400 self-end">+{ecomImages.length - 4}</span>}
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center mr-auto">
              <X className="h-4 w-4 text-slate-400" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── ChangeCard ── */
function ChangeCard({ change, index, currencySymbol, overrides, onOverrideChange }: {
  change: ChangeItem;
  index: number;
  currencySymbol: string;
  overrides?: Record<string, Record<string, string | number>>;
  onOverrideChange?: (sku: string, field: string, value: string | number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isNew = change.isNew;
  const diff = change.diff || {};
  const current = change.current || {};
  const incoming = change.incoming || {};
  const skuFields = change.fields || { name: true, price: true, stock: true, images: true };
  const hasImages = change.hasImages && skuFields.images !== false;
  const diffFields = ['name', 'price', 'stock'];
  const localImages = change.localImages || [];
  const ecomImages = change.ecomImages || [];
  const ecomCategoryName = change.ecomCategoryName;
  const skuOverrides = overrides?.[change.sku] || {};
  const finalIncoming = { ...incoming, ...skuOverrides };
  const images = [change.image, ...(change.images || [])].filter(Boolean) as string[];

  const diffRows = useMemo(() => {
    const rows: Array<{ label: string; key: string; currentVal: unknown; newVal: unknown; type: string }> = [];
    if (isNew) {
      for (const f of diffFields) {
        if (skuFields[f] === false) continue;
        if (isDefined(finalIncoming[f])) {
          const labels: Record<string, string> = { name: 'الاسم', price: 'السعر', stock: 'المخزون' };
          rows.push({ label: labels[f] || f, key: f, currentVal: null, newVal: finalIncoming[f], type: 'added' });
        }
      }
      return rows;
    }
    for (const [key, changed] of Object.entries(diff)) {
      if (!changed || key === 'description' || skuFields[key] === false) continue;
      const cv = current[key];
      const nv = incoming[key];
      let type = 'changed';
      if (!isDefined(cv) && isDefined(nv)) type = 'added';
      else if (isDefined(cv) && !isDefined(nv)) type = 'removed';
      else if (key === 'price') {
        type = Number(nv) > Number(cv) ? 'up' : Number(nv) < Number(cv) ? 'down' : 'unchanged';
      }
      const labels: Record<string, string> = { name: 'الاسم', price: 'السعر', stock: 'المخزون' };
      rows.push({ label: labels[key] || key, key, currentVal: cv, newVal: nv, type });
    }
    return rows;
  }, [isNew, diff, current, incoming, finalIncoming, skuFields]);

  return (
    <div
      className="border border-slate-200 rounded-2xl overflow-hidden hover:shadow-sm hover:border-slate-300 transition-all duration-300 bg-white"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className={cn('w-12 h-12 rounded-xl flex-shrink-0 overflow-hidden border border-slate-200', images[0] ? '' : 'bg-slate-50 flex items-center justify-center')}>
          {images[0] ? (
            <img src={images[0]} alt="" className="w-full h-full object-cover" />
          ) : (
            <Package className="h-5 w-5 text-slate-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-black text-slate-700 truncate">{change.name || change.nameAr}</span>
            {isNew && (
              <Badge variant="default" className="text-[10px] h-5 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">جديد</Badge>
            )}
            {!isNew && diffRows.length > 0 && (
              <Badge variant="secondary" className="text-[10px] h-5 bg-blue-100 text-blue-700 hover:bg-blue-100">تحديث</Badge>
            )}
            {hasImages && (
              <Badge variant="outline" className="text-[10px] h-5 bg-amber-50 text-amber-700 border-amber-200">
                <ImageIcon className="h-2.5 w-2.5 inline ml-0.5" />
                صور
              </Badge>
            )}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">
            {change.sku}
            {ecomCategoryName && (
              <span className="mr-2 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-600 border border-indigo-100 leading-none">
                {ecomCategoryName}
              </span>
            )}
          </div>
        </div>
        {(diffRows.length > 0 || hasImages) && (
          <button onClick={() => setExpanded((v) => !v)} className={cn('transition-transform duration-200 flex-shrink-0 p-1 rounded-lg hover:bg-slate-100', expanded ? 'rotate-180' : '')}>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        )}
      </div>

      {expanded && (
        <div className="overflow-hidden transition-all duration-300">
          <div className="border-t border-slate-200 px-4 py-3 space-y-2">
            {diffRows.map((row) => (
              <FieldDiff
                key={row.key}
                label={row.label}
                currentVal={row.currentVal}
                newVal={row.newVal}
                type={row.type}
                currencySymbol={currencySymbol}
              />
            ))}
            {isNew && onOverrideChange && (
              <div className="border border-slate-200 rounded-xl p-3 bg-slate-50 mt-2">
                <div className="text-[10px] font-bold text-slate-400 mb-2">تعديل قبل الاستيراد</div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <InlineEdit
                    label="الاسم"
                    value={skuOverrides.name ?? (incoming.name as string) ?? ''}
                    onChange={(v) => onOverrideChange(change.sku, 'name', v)}
                    type="text"
                  />
                  <InlineEdit
                    label="SKU"
                    value={skuOverrides.code ?? change.sku ?? ''}
                    onChange={(v) => onOverrideChange(change.sku, 'code', v)}
                    type="text"
                  />
                </div>
                <div className="text-[10px] font-bold text-amber-600 mb-1">الأسعار مطلوبة</div>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <InlineEdit
                    label="سعر البيع"
                    value={skuOverrides.sale_price ?? (incoming.sale_price as number) ?? (incoming.price as number) ?? 0}
                    onChange={(v) => onOverrideChange(change.sku, 'sale_price', v)}
                    type="price"
                  />
                  <InlineEdit
                    label="سعر الشراء"
                    value={skuOverrides.purchase_price ?? (incoming.purchase_price as number) ?? 0}
                    onChange={(v) => onOverrideChange(change.sku, 'purchase_price', v)}
                    type="price"
                  />
                  <InlineEdit
                    label="سعر الجملة"
                    value={skuOverrides.wholesale_price ?? (incoming.wholesale_price as number) ?? 0}
                    onChange={(v) => onOverrideChange(change.sku, 'wholesale_price', v)}
                    type="price"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2">
                  <InlineEdit
                    label="المخزون"
                    value={skuOverrides.stock ?? (incoming.stock as number) ?? 0}
                    onChange={(v) => onOverrideChange(change.sku, 'stock', v)}
                    type="stock"
                  />
                </div>
              </div>
            )}
            {hasImages && (
              <ImageDiff localImages={localImages} ecomImages={ecomImages} hasDiff={true} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Tabs filter ── */
const FILTER_TABS = [
  { key: 'all', label: 'الكل' },
  { key: 'price-up', label: 'سعر مرتفع', icon: TrendingUp },
  { key: 'price-down', label: 'سعر منخفض', icon: TrendingDown },
  { key: 'stock-zero', label: 'مخزون صفر', icon: AlertTriangle },
  { key: 'new', label: 'جديد', icon: Package },
  { key: 'image', label: 'تغيير صور', icon: ImageIcon },
] as const;

/* ── Main ReviewModal ── */
export default function ReviewModal({ open, onClose, changes, onApply, applying, currencySymbol = 'ر.س' }: ReviewModalProps) {
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [overrides, setOverrides] = useState<Record<string, Record<string, string | number>>>({});

  const filtered = useMemo(() => {
    let items = [...changes];
    if (activeTab === 'price-up') items = items.filter((c) => !c.isNew && Number(c.incoming?.price) > Number(c.current?.price));
    else if (activeTab === 'price-down') items = items.filter((c) => !c.isNew && Number(c.incoming?.price) < Number(c.current?.price));
    else if (activeTab === 'stock-zero') items = items.filter((c) => Number(c.incoming?.stock) === 0);
    else if (activeTab === 'new') items = items.filter((c) => c.isNew);
    else if (activeTab === 'image') items = items.filter((c) => c.hasImages);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((c) => c.sku.toLowerCase().includes(q) || c.name.toLowerCase().includes(q) || (c.nameAr || '').toLowerCase().includes(q));
    }
    return items;
  }, [changes, activeTab, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const summary = useMemo(() => ({
    total: changes.length,
    newProducts: changes.filter((c) => c.isNew).length,
    updated: changes.filter((c) => !c.isNew).length,
    priceUp: changes.filter((c) => !c.isNew && Number(c.incoming?.price) > Number(c.current?.price)).length,
    priceDown: changes.filter((c) => !c.isNew && Number(c.incoming?.price) < Number(c.current?.price)).length,
    stockZero: changes.filter((c) => Number(c.incoming?.stock) === 0).length,
    imageChanges: changes.filter((c) => c.hasImages).length,
  }), [changes]);

  const handleOverrideChange = (sku: string, field: string, value: string | number) => {
    setOverrides((prev) => ({
      ...prev,
      [sku]: { ...(prev[sku] || {}), [field]: value },
    }));
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-6 pb-6 overflow-y-auto bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-4" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between shrink-0 bg-gradient-to-l from-indigo-50/50 to-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <BarChart3 className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-800">مراجعة التغييرات</h2>
              <p className="text-[11px] text-slate-400 font-medium">{changes.length} تغيير في المنتجات</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={() => onApply(changes)} disabled={applying || changes.length === 0} className="gap-1.5 text-xs font-bold">
              {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {applying ? 'جاري التطبيق…' : 'تأكيد المزامنة'}
            </Button>
            <button onClick={onClose} className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center transition-colors">
              <X className="h-4 w-4 text-slate-400" />
            </button>
          </div>
        </div>

        {/* Summary bar */}
        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-4 text-xs shrink-0">
          <span className="font-bold text-slate-700">{summary.total} إجمالي</span>
          <span className="w-px h-4 bg-slate-200" />
          <span className="font-bold text-emerald-600">{summary.newProducts} جديد</span>
          <span className="w-px h-4 bg-slate-200" />
          <span className="font-bold text-blue-600">{summary.updated} تحديث</span>
          <span className="w-px h-4 bg-slate-200" />
          <span className="font-bold text-emerald-600">{summary.priceUp} ↑</span>
          <span className="font-bold text-red-600">{summary.priceDown} ↓</span>
          <span className="w-px h-4 bg-slate-200" />
          <span className="font-bold text-amber-600">{summary.stockZero} مخزون صفر</span>
          <span className="w-px h-4 bg-slate-200" />
          <span className="font-bold text-purple-600">{summary.imageChanges} صور</span>
        </div>

        {/* Filter tabs + search */}
        <div className="px-5 py-3 border-b border-slate-200 flex items-center gap-2 shrink-0 overflow-x-auto">
          <div className="flex gap-1">
            {FILTER_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-bold whitespace-nowrap transition-all',
                  activeTab === tab.key
                    ? 'bg-indigo-100 text-indigo-700 shadow-sm'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600'
                )}
              >
                {'icon' in tab && tab.icon && <tab.icon className="h-3 w-3 inline ml-1" />}
                {tab.label}
              </button>
            ))}
          </div>
          <div className="mr-auto relative">
            <Search className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="بحث…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-8 w-48 pr-8 text-xs rounded-lg border-slate-200"
            />
          </div>
        </div>

        {/* Change cards */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {pageItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-slate-400">
              <Package className="h-12 w-12 mb-3 text-slate-200" />
              <p className="text-sm font-bold">لا توجد تغييرات للمراجعة</p>
            </div>
          ) : (
            pageItems.map((change, i) => (
              <ChangeCard
                key={change.sku + '-' + i}
                change={change}
                index={i}
                currencySymbol={currencySymbol}
                overrides={overrides}
                onOverrideChange={handleOverrideChange}
              />
            ))
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 px-5 py-3 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-400 font-medium">
              صفحة {safePage} من {totalPages}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="h-8 text-xs gap-1"
              >
                <ChevronRight className="h-3 w-3" />
                السابق
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="h-8 text-xs gap-1"
              >
                التالي
                <ChevronLeft className="h-3 w-3" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
