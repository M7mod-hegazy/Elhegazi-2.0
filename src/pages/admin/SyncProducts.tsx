import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, ArrowLeftRight, Store, Package, ImageIcon,
  CheckCircle2, Loader2, Search, ChevronDown, Upload, Download,
  Info, Globe, TrendingUp, AlertTriangle, Filter, XCircle,
  ChevronRight, ChevronLeft, X, Clock, FileText, Layers,
  ShoppingBag, Plus, Undo2, History,
} from 'lucide-react';
import { motion } from 'framer-motion';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { LoadingSpinner } from '@/components/ui/loading';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useBranding } from '@/hooks/useBranding';
import { useToast } from '@/hooks/use-toast';
import { getSyncedProducts, getStores, getSyncActivity, getRollbackHistory, triggerManualSync, adminApplySync, getPendingOrders, type SyncProduct, type SyncStore, type SyncActivityEvent, type SyncSnapshot, type PendingOrder } from '@/lib/api-sync';
import { cn } from '@/lib/utils';
import ReviewModal from '@/components/sync/ReviewModal';

type TabId = 'orders' | 'available' | 'new' | 'store-changes' | 'logs' | 'rollback';

interface FieldSelections {
  [sku: string]: {
    name?: boolean;
    price?: boolean;
    stock?: boolean;
    images?: boolean;
  };
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

const PAGE_SIZE = 25;

function imgList(product: SyncProduct): string[] {
  const list: string[] = [];
  if (product.image) list.push(product.image);
  if (product.images?.length) {
    for (const img of product.images) {
      if (img && img !== product.image) list.push(img);
    }
  }
  return list;
}

/* ─── Sub-components ─── */

function EmptyState({ title, description, action, actionLabel, onAction }: {
  title: string;
  description: string;
  action?: boolean;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="p-12 text-center">
      <Package className="h-16 w-16 mx-auto text-slate-200 mb-4" />
      <p className="text-sm font-bold text-slate-400 mb-1">{title}</p>
      <p className="text-xs text-slate-300 mb-4">{description}</p>
      {action && onAction && (
        <Button size="sm" onClick={onAction} className="gap-1.5 text-xs font-bold">{actionLabel}</Button>
      )}
    </div>
  );
}

function ProductRow({ product, fields, onFieldToggle, onPreviewImages, pullLabel = true }: {
  product: SyncProduct;
  fields: FieldSelections[string];
  onFieldToggle: (sku: string, field: string) => void;
  onPreviewImages: (product: SyncProduct) => void;
  pullLabel?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const images = useMemo(() => imgList(product), [product]);
  const lm = product.localMatch;
  const isNew = lm && !lm.exists;

  const formatPrice = (v: number | null | undefined) => (v != null ? Number(v).toFixed(2) + ' ر.س' : '—');
  const formatStock = (v: number | null | undefined) => (v != null ? String(Number(v)) : '—');

  const allFields = [
    {
      key: 'name' as const,
      label: 'الاسم',
      match: lm?.name?.match ?? null,
      ecom: isNew ? (product.nameAr || product.name) : (lm?.name?.ecom ?? (product.nameAr || product.name)),
    },
    {
      key: 'price' as const,
      label: 'السعر',
      match: lm?.price?.match ?? null,
      ecom: isNew ? formatPrice(product.price) : formatPrice(lm?.price?.ecom ?? product.price),
    },
    {
      key: 'stock' as const,
      label: 'المخزون',
      match: lm?.stock?.match ?? null,
      ecom: isNew ? formatStock(product.stock) : formatStock(lm?.stock?.ecom ?? product.stock),
    },
    {
      key: 'images' as const,
      label: 'الصور',
      match: lm?.image?.match ?? null,
      ecom: isNew ? (images.length > 0 ? `${images.length} صور` : '—') : (images.length > 0 ? `${images.length} صور` : '—'),
    },
  ];

  const anyFieldOn = fields && Object.values(fields).some(Boolean);

  return (
    <div className={cn('border-b border-slate-100 last:border-b-0 transition-all duration-200', anyFieldOn ? 'bg-indigo-50/10' : 'hover:bg-slate-50/30')}>
      <div className="px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0 cursor-pointer" onClick={() => onPreviewImages(product)}>
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-50 border border-slate-200 shadow-sm">
              {images.length > 0 ? (
                <img src={images[0]} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-300"><ImageIcon className="h-5 w-5" /></div>
              )}
            </div>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-black text-slate-700 truncate">{product.nameAr || product.name}</span>
              <span className="text-[11px] text-slate-400 font-bold shrink-0" style={{ direction: 'ltr', display: 'inline-block' }}>({product.sku})</span>
              {isNew && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 leading-none shrink-0">جديد</span>
              )}
              <button
                onClick={() => setExpanded(!expanded)}
                className={cn('p-1 rounded-lg transition-all duration-200 shrink-0 mr-auto', expanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100')}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded ? 'rotate-180' : '')} />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-slate-500">السعر: {formatPrice(product.price)}</span>
              <span className="w-px h-3 bg-slate-200" />
              <span className="text-xs font-bold text-slate-500">المخزون: {formatStock(product.stock)}</span>
            </div>
          </div>
        </div>

        {/* Field pills */}
        <div className="flex items-center gap-1.5 mt-2.5 mr-0 flex-wrap">
          {allFields.map((f) => {
            const isMatched = f.match === true;
            const differs = f.match === false;
            const on = fields?.[f.key] ?? false;
            return (
              <button
                key={f.key}
                onClick={() => { if (differs || isNew) onFieldToggle(product.sku, f.key); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all',
                  isMatched
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                    : on
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                )}
                title={isMatched ? `${f.label}: مطابق ✓` : `${f.label}: ${on ? 'نشط' : 'معطل'}`}
              >
                <span>{f.label}</span>
                {isMatched ? (
                  <span className="text-[9px] text-emerald-600 flex items-center gap-0.5">
                    <CheckCircle2 className="h-2.5 w-2.5" /> مطابق
                  </span>
                ) : (
                  <>
                    <span className={cn('text-[9px] px-1 py-0.5 rounded', on ? 'bg-white/20' : 'bg-slate-100')}>
                      {on ? 'ON' : 'OFF'}
                    </span>
                    <span className={cn('text-[10px] opacity-80', on ? 'text-white/80' : 'text-slate-400')}>
                      {f.ecom}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Expanded: side-by-side */}
      {expanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 border-t border-slate-100">
          {lm?.exists ? (
            <div className="pt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-1">
                <span className="flex-1 px-2 py-1 rounded bg-slate-50 text-center">المتجر (POS)</span>
                <ArrowLeftRight className="h-3 w-3 shrink-0" />
                <span className="flex-1 px-2 py-1 rounded bg-slate-50 text-center">الموقع الإلكتروني</span>
              </div>
              {allFields.map((f) => {
                const lmField = f.key === 'images' ? lm.image : lm?.[f.key as 'name' | 'price' | 'stock'];
                const differs = f.match === false;
                const localVal = f.key === 'price' ? formatPrice(lmField?.local as number) :
                  f.key === 'stock' ? formatStock(lmField?.local as number) :
                  f.key === 'images' ? (lmField?.local ? 'موجودة' : '—') :
                  lmField?.local ?? '—';
                const ecomVal = f.key === 'price' ? formatPrice(lmField?.ecom as number) :
                  f.key === 'stock' ? formatStock(lmField?.ecom as number) :
                  f.key === 'images' ? (images.length > 0 ? `${images.length} صور` : '—') :
                  lmField?.ecom ?? '—';
                return (
                  <div key={f.key}>
                    <div className={cn(
                      'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs',
                      differs ? 'bg-red-50/50 ring-1 ring-red-200/50' : 'bg-slate-50/50'
                    )}>
                      <span className="w-16 font-bold text-slate-400 shrink-0">{f.label}</span>
                      <span className={cn(
                        'flex-1 px-2 py-0.5 rounded text-left',
                        differs ? 'bg-red-100/50 text-red-700 font-bold line-through decoration-2' : 'text-slate-700'
                      )}>{localVal}</span>
                      <span className="shrink-0">
                        {differs
                          ? <ArrowLeftRight className="h-3.5 w-3.5 text-amber-500 animate-pulse" />
                          : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                        }
                      </span>
                      <span className={cn(
                        'flex-1 px-2 py-0.5 rounded text-left',
                        differs ? 'bg-amber-50 text-amber-700 font-bold' : 'text-slate-700'
                      )}>{ecomVal}</span>
                    </div>
                    {f.key === 'images' && differs && (
                      <div className="mt-1 px-3 py-1.5 rounded-lg bg-amber-50 text-[10px] text-amber-700 font-bold flex items-center gap-1">
                        <Info className="h-3 w-3" />
                        التطبيق يدعم صورة واحدة — سيتم استبدالها بأول صورة من الموقع
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="pt-3 space-y-1.5">
              <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-1">
                <span className="flex-1 px-2 py-1 rounded bg-slate-50 text-center">الموقع الإلكتروني</span>
              </div>
              {allFields.map((f) => (
                <div key={f.key} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-blue-50/50">
                  <span className="w-16 font-bold text-slate-400 shrink-0">{f.label}</span>
                  <span className="flex-1 text-slate-700 font-bold">{f.ecom}</span>
                </div>
              ))}
            </div>
          )}
          {images.length > 0 && (
            <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100">
              {images.map((url, i) => (
                <button key={i} onClick={() => onPreviewImages(product)} className="w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:border-indigo-400 transition shadow-sm">
                  <img src={url} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SyncProducts() {
  const { branding } = useBranding();
  usePageTitle(`Sync Products · ${branding.siteName}`);
  const navigate = useNavigate();
  const { toast } = useToast();

  const [products, setProducts] = useState<SyncProduct[]>([]);
  const [stores, setStores] = useState<SyncStore[]>([]);
  const [activity, setActivity] = useState<SyncActivityEvent[]>([]);
  const [snapshots, setSnapshots] = useState<SyncSnapshot[]>([]);
  const [snapshotsTotal, setSnapshotsTotal] = useState(0);
  const [snapshotsPage, setSnapshotsPage] = useState(1);
  const [snapshotsLoading, setSnapshotsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [ordersTotal, setOrdersTotal] = useState(0);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [fieldFilter, setFieldFilter] = useState<string | null>(null);
  const [fields, setFields] = useState<FieldSelections>({});
  const [syncing, setSyncing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewChanges, setReviewChanges] = useState<ChangeItem[]>([]);
  const [previewProduct, setPreviewProduct] = useState<SyncProduct | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('available');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, s, a] = await Promise.all([
        getSyncedProducts().catch(() => [] as SyncProduct[]),
        getStores().catch(() => [] as SyncStore[]),
        getSyncActivity().catch(() => [] as SyncActivityEvent[]),
      ]);
      setProducts(p);
      setStores(s);
      setActivity(a);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const loadOrders = useCallback(async (p = 1) => {
    setOrdersLoading(true);
    try {
      const res = await getPendingOrders(p);
      setOrders(res.items || []);
      setOrdersTotal(res.total || 0);
    } catch { /* silent */ } finally { setOrdersLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') loadOrders(1);
  }, [activeTab, loadOrders]);

  const loadSnapshots = useCallback(async (p = 1) => {
    setSnapshotsLoading(true);
    try {
      const res = await getRollbackHistory(p);
      setSnapshots(res.items || []);
      setSnapshotsTotal(res.total || 0);
      setSnapshotsPage(p);
    } catch { /* silent */ } finally { setSnapshotsLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'rollback') loadSnapshots(1);
  }, [activeTab, loadSnapshots]);

  /* ─── Search + filters ─── */
  const filteredSearch = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.nameAr || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q) ||
      String(p.price || '').includes(q)
    );
  }, [products, search]);

  const filteredAvailable = useMemo(() => {
    let result = filteredSearch.filter((p) => p.localMatch?.exists);
    if (fieldFilter) {
      const lmKey = fieldFilter === 'images' ? 'image' : fieldFilter;
      result = result.filter((p) => p.localMatch?.[lmKey as 'name' | 'price' | 'stock' | 'image']?.match === false);
    } else {
      result = result.filter((p) => p.localMatch && (
        p.localMatch.name?.match === false ||
        p.localMatch.price?.match === false ||
        p.localMatch.stock?.match === false ||
        p.localMatch.image?.match === false
      ));
    }
    return result;
  }, [filteredSearch, fieldFilter]);

  const filteredNew = useMemo(() => {
    return filteredSearch.filter((p) => !p.localMatch?.exists);
  }, [filteredSearch]);

  const activeSkus = useMemo(() => {
    return Object.entries(fields)
      .filter(([, f]) => Object.values(f).some(Boolean))
      .map(([sku]) => sku);
  }, [fields]);

  const activeFieldsCount = useMemo(() => {
    return Object.values(fields).reduce((sum, f) => sum + Object.values(f).filter(Boolean).length, 0);
  }, [fields]);

  const selectCount = useMemo(() =>
    Object.values(fields).filter((f) => Object.values(f).some(Boolean)).length, [fields]);

  const handleFieldToggle = (sku: string, field: string) => {
    setFields((prev) => {
      const current = prev[sku] || { name: false, price: false, stock: false, images: false };
      return { ...prev, [sku]: { ...current, [field]: !current[field as keyof typeof current] } };
    });
  };

  const setField = (sku: string, field: string, value: boolean) => {
    setFields((prev) => {
      const current = prev[sku] || { name: false, price: false, stock: false, images: false };
      return { ...prev, [sku]: { ...current, [field]: value } };
    });
  };

  const toggleAllFields = (sku: string, value: boolean) => {
    setFields((prev) => ({ ...prev, [sku]: { name: value, price: value, stock: value, images: value } }));
  };

  /* ─── Bulk helpers ─── */
  const isDiff = (p: SyncProduct, key: string) => {
    if (!p.localMatch || !p.localMatch.exists) return key === null;
    if (key === null) return false;
    const lmKey = key === 'images' ? 'image' : key;
    return p.localMatch[lmKey as 'name' | 'price' | 'stock' | 'image']?.match === false;
  };
  const isNewProd = (p: SyncProduct) => !p.localMatch?.exists;
  const fieldOrNew = (p: SyncProduct, key: string) => isNewProd(p) || isDiff(p, key);
  const onCount = (key: string) => filteredAvailable.filter((p) => fieldOrNew(p, key) && fields[p.sku]?.[key]).length;
  const totalEligible = (key: string) => filteredAvailable.filter((p) => fieldOrNew(p, key)).length;

  const enableAllForAll = () => {
    filteredAvailable.forEach((p) => {
      if (['name', 'price', 'stock', 'images'].some((k) => fieldOrNew(p, k))) toggleAllFields(p.sku, true);
    });
  };
  const disableAllForAll = () => filteredAvailable.forEach((p) => toggleAllFields(p.sku, false));
  const toggleColumn = (key: string) => {
    const eligible = filteredAvailable.filter((p) => fieldOrNew(p, key));
    const allCurrentlyOn = eligible.every((p) => fields[p.sku]?.[key] === true);
    eligible.forEach((p) => setField(p.sku, key, !allCurrentlyOn));
  };
  const toggleNewBatch = () => {
    const newProds = filteredAvailable.filter(isNewProd);
    const countActive = newProds.filter((p) => fields[p.sku] && Object.values(fields[p.sku]).some(Boolean)).length;
    newProds.forEach((p) => toggleAllFields(p.sku, countActive !== newProds.length));
  };

  /* ─── Pagination ─── */
  const currentProducts = activeTab === 'new' ? filteredNew : filteredAvailable;
  const totalPages = Math.ceil(currentProducts.length / PAGE_SIZE);
  const start = (page - 1) * PAGE_SIZE;
  const displayProducts = currentProducts.slice(start, start + PAGE_SIZE);

  const pageRange = useMemo(() => {
    const maxVisible = 5;
    let lo = Math.max(1, page - Math.floor(maxVisible / 2));
    let hi = Math.min(totalPages, lo + maxVisible - 1);
    if (hi - lo + 1 < maxVisible) lo = Math.max(1, hi - maxVisible + 1);
    const pages: number[] = [];
    for (let i = lo; i <= hi; i++) pages.push(i);
    return pages;
  }, [totalPages, page]);

  useEffect(() => { setPage(1); }, [search, fieldFilter, activeTab]);

  /* ─── Review + Apply (Pull) ─── */
  const openReview = () => {
    const selected: ChangeItem[] = [];
    const active = activeTab === 'new' ? filteredNew : filteredAvailable;
    for (const [sku, fieldSet] of Object.entries(fields)) {
      const activeFields = Object.entries(fieldSet).filter(([, v]) => v).map(([k]) => k);
      if (activeFields.length === 0) continue;
      const product = products.find((p) => p.sku === sku);
      if (!product) continue;
      const images = imgList(product);
      const lm = product.localMatch;
      selected.push({
        sku: product.sku,
        name: product.nameAr || product.name,
        nameAr: product.nameAr,
        image: product.image,
        images: product.images,
        isNew: !lm?.exists,
        current: lm?.exists ? { name: lm.name?.local, price: lm.price?.local, stock: lm.stock?.local } : {},
        incoming: { name: product.name, nameAr: product.nameAr, price: product.price, stock: product.stock },
        diff: Object.fromEntries(activeFields.map((f) => [f, true])),
        fields: Object.fromEntries(activeFields.map((f) => [f, true])),
        localImages: [],
        ecomImages: images,
        hasImages: activeFields.includes('images') && images.length > 0,
      });
    }
    setReviewChanges(selected);
    setReviewOpen(true);
  };

  const handleApply = async (changes: ChangeItem[]) => {
    setSyncing(true);
    try {
      const items = changes.map((c) => ({
        sku: c.sku,
        fields: Object.fromEntries(
          Object.entries(c.fields || {}).map(([k, v]) => [k, v ? (c.incoming?.[k] ?? null) : null])
        ),
      }));
      const res = await adminApplySync(items);
      if (res.succeeded.length > 0) {
        toast({ title: `تم تطبيق ${res.succeeded.length} تحديث على الموقع` });
        setFields({});
        setReviewOpen(false);
        load();
      } else {
        toast({ title: 'فشل تطبيق التحديثات', variant: 'destructive' });
      }
    } catch (err: unknown) {
      toast({ title: 'خطأ في الاتصال', description: String(err), variant: 'destructive' });
    } finally { setSyncing(false); }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync();
      toast({ title: 'تم تشغيل المزامنة' });
      load();
    } catch { toast({ title: 'فشل تشغيل المزامنة', variant: 'destructive' }); }
    finally { setSyncing(false); }
  };

  /* ─── Logs tab filters ─── */
  const [logTypeFilter, setLogTypeFilter] = useState<string>('all');
  const filteredActivity = useMemo(() => {
    let items = [...activity];
    if (logTypeFilter !== 'all') items = items.filter((e) => e.type === logTypeFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      items = items.filter((e) =>
        (e.storeName || '').toLowerCase().includes(q) ||
        (e.descriptionAr || e.description || '').toLowerCase().includes(q)
      );
    }
    return items;
  }, [activity, logTypeFilter, search]);

  const [logDateFrom, setLogDateFrom] = useState('');
  const [logDateTo, setLogDateTo] = useState('');

  const filteredLogs = useMemo(() => {
    let items = filteredActivity;
    if (logDateFrom) {
      const from = new Date(logDateFrom);
      items = items.filter((e) => new Date(e.createdAt) >= from);
    }
    if (logDateTo) {
      const to = new Date(logDateTo);
      to.setHours(23, 59, 59, 999);
      items = items.filter((e) => new Date(e.createdAt) <= to);
    }
    return items;
  }, [filteredActivity, logDateFrom, logDateTo]);

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      </AdminLayout>
    );
  }

  /* ─── Tab definitions matching POS sync ─── */
  const tabs: Array<{ id: TabId; label: string; count: number; icon: React.ComponentType<{ className?: string }> }> = [
    { id: 'orders', label: 'طلبات الموقع', count: ordersTotal, icon: ShoppingBag },
    { id: 'new', label: 'منتجات جديدة', count: filteredNew.length, icon: Plus },
    { id: 'available', label: 'متاح من الموقع', count: filteredAvailable.length, icon: Download },
    { id: 'store-changes', label: 'تغييرات المتجر', count: activity.filter((e) => e.type === 'sync').length, icon: Upload },
    { id: 'logs', label: 'سجل المزامنة', count: activity.length, icon: Clock },
    { id: 'rollback', label: 'التراجع', count: snapshotsTotal, icon: Undo2 },
  ];

  const renderPagination = () => totalPages > 1 && (
    <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between">
      <span className="text-xs text-slate-400">
        عرض {start + 1}–{Math.min(start + PAGE_SIZE, currentProducts.length)} من {currentProducts.length} منتج
      </span>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronRight className="h-4 w-4 rtl:rotate-180" />
        </button>
        {pageRange.map((p) => (
          <button key={p} onClick={() => setPage(p)}
            className={cn('min-w-[32px] h-8 rounded-lg text-xs font-bold border transition',
              p === page ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-200 text-slate-500 hover:bg-slate-100')}>
            {p}
          </button>
        ))}
        <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition">
          <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
        </button>
      </div>
    </div>
  );

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* ── Header ── */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-600 via-indigo-600/90 to-indigo-600/80 shadow-lg">
              <div className="relative p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0">
                      <ArrowLeftRight className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 px-2.5 py-0.5 bg-white/15 backdrop-blur-sm rounded-full text-[10px] font-bold mb-1 text-white/80">
                        <ArrowLeftRight className="h-3 w-3" />مزامنة المنتجات
                      </div>
                      <h1 className="text-lg md:text-xl font-black text-white">إدارة مزامنة المنتجات</h1>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button size="sm" variant="secondary" onClick={handleTriggerSync} disabled={syncing} className="gap-1.5 text-xs font-bold bg-white/15 text-white hover:bg-white/25 border-0">
                      {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      مزامنة شاملة
                    </Button>
                    <Button size="sm" onClick={() => navigate('/admin/sync')} className="gap-1.5 text-xs font-bold bg-white text-indigo-700 hover:bg-white/90">
                      <Globe className="h-3.5 w-3.5" />
                      لوحة المزامنة
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-white/50">
                  <span className="flex items-center gap-1.5"><Package className="h-3 w-3" /> {products.length} منتج</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="flex items-center gap-1.5"><Store className="h-3 w-3" /> {stores.filter((s) => s.isActive).length} متجر نشط</span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3 w-3 text-emerald-300" /> {selectCount} محدد</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* ── Tabs (matching POS sync page) ── */}
          <div className="flex gap-1 mb-4 border-b border-slate-200 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => { setActiveTab(tab.id); setPage(1); setSearch(''); setFieldFilter(null); }}
                  className={cn(
                    'relative px-4 py-2.5 text-sm font-bold transition-all duration-200 flex items-center gap-2 whitespace-nowrap',
                    activeTab === tab.id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                  <span className={cn('px-1.5 py-0.5 rounded-full text-[10px] font-bold',
                    activeTab === tab.id ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-400')}>
                    {tab.count}
                  </span>
                  {activeTab === tab.id && <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-500 rounded-full" />}
                </button>
              );
            })}
          </div>

          {/* ── TAB: Online Orders (طلبات الموقع) ── */}
          {activeTab === 'orders' && (
            <>
              <div className="mb-3 p-3 rounded-xl bg-amber-50/50 border border-amber-200/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <ShoppingBag className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700">طلبات المتجر الإلكتروني: </span>
                  الطلبات الجديدة من موقعك تظهر هنا. يتم تحويلها إلى فواتير بيع عبر نظام نقاط البيع.
                </div>
              </div>
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500">{ordersTotal} طلب</span>
                  <span className="text-[10px] text-slate-400">{new Date().toLocaleDateString('ar-EG')}</span>
                </div>
                {ordersLoading ? (
                  <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></div>
                ) : orders.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {orders.map((order) => (
                      <div key={order._id} className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                        <div className="h-8 w-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                          <ShoppingBag className="h-4 w-4 text-amber-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-bold text-slate-700 truncate">
                              {order.orderNumber ? `#${order.orderNumber}` : `طلب ${order._id.slice(-6)}`}
                            </p>
                            <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                              {new Date(order.createdAt).toLocaleString('ar-EG')}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-1">
                            {order.items.length} صنف • {Number(order.total).toFixed(2)} ر.س
                          </p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                              {order.paymentMethod === 'cod' ? 'الدفع عند الاستلام' : order.paymentMethod}
                            </span>
                            {order.shippingAddress?.name && (
                              <span className="text-[10px] text-slate-400">
                                {order.shippingAddress.name} • {order.shippingAddress.phone}
                              </span>
                            )}
                          </div>
                          {order.shippingAddress?.city && (
                            <p className="text-[10px] text-slate-400 mt-1">
                              {order.shippingAddress.city}{order.shippingAddress.street ? `, ${order.shippingAddress.street}` : ''}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState title="لا توجد طلبات معلقة" description="جميع الطلبات تمت معالجتها" />
                )}
              </Card>
            </>
          )}

          {/* ── TAB: Available (متاح من الموقع) ── */}
          {activeTab === 'available' && (
            <>
              <div className="mb-3 p-3 rounded-xl bg-blue-50/50 border border-blue-200/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                  <Download className="h-4 w-4 text-blue-600" />
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700">متاحة لنقاط البيع: </span>
                  منتجات موجودة مسبقاً في المتجر ولكن بياناتها مختلفة في الموقع. اختر الحقول التي تريد تحديثها لكل منتج.
                </div>
              </div>
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                {/* Search */}
                <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
                  <div className="relative flex-[1] min-w-[180px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="بحث في المنتجات المتاحة…" value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  {activeSkus.length > 0 && (
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 rounded-xl">
                      <span className="text-xs font-bold text-indigo-600">{activeSkus.length} منتج • {activeFieldsCount} حقل نشط</span>
                      <button onClick={() => { activeSkus.forEach((sku) => toggleAllFields(sku, false)); }} className="text-xs text-slate-400 hover:text-slate-600 transition-colors">
                        <XCircle className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
                {filteredAvailable.length > 0 ? (
                  <>
                    {/* Bulk bar */}
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-700 whitespace-nowrap">{activeSkus.length} منتج • {activeFieldsCount} حقل نشط</span>
                        <span className="w-px h-4 bg-slate-200" />
                        <button onClick={enableAllForAll} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-600 text-white hover:bg-indigo-700 transition">تشغيل الكل</button>
                        <button onClick={disableAllForAll} className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-white border border-slate-200 text-slate-400 hover:bg-slate-100 transition">إيقاف الكل</button>
                        <span className="w-px h-4 bg-slate-200" />
                        {[
                          { key: 'name', label: 'الاسم', icon: FileText },
                          { key: 'price', label: 'السعر', icon: TrendingUp },
                          { key: 'stock', label: 'المخزون', icon: Layers },
                          { key: 'images', label: 'الصور', icon: ImageIcon },
                        ].map((col) => {
                          const isNew = col.key === null;
                          const cnt = isNew ? filteredAvailable.filter((p) => isNewProd(p) && fields[p.sku] && Object.values(fields[p.sku]).some(Boolean)).length : onCount(col.key);
                          const tot = isNew ? filteredAvailable.filter(isNewProd).length : totalEligible(col.key);
                          if (tot === 0) return null;
                          const Icon = col.icon;
                          return (
                            <div key={col.label} className="flex items-center gap-0.5">
                              <button onClick={isNew ? toggleNewBatch : () => toggleColumn(col.key!)}
                                className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition',
                                  cnt > 0 ? 'bg-white border-indigo-500 text-indigo-600' : 'bg-white border-slate-200 text-slate-400')}>
                                <Icon className="h-3 w-3" />{col.label}
                                <span className={cn('text-[9px] px-1 py-0.5 rounded', cnt > 0 ? 'bg-indigo-50' : 'bg-slate-100')}>{cnt}/{tot}</span>
                              </button>
                              <button onClick={() => { setFieldFilter((prev) => prev === (isNew ? 'new' : col.key) ? null : (isNew ? 'new' : col.key)); setPage(1); }}
                                className={cn('p-1 rounded-lg transition', fieldFilter === (isNew ? 'new' : col.key) ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100')}>
                                <Filter className="h-3 w-3" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-200/60">
                        <span className="text-[10px] text-slate-400">فعّل/عطّل الأعمدة لكل المنتجات المؤهلة</span>
                        <div className="flex items-center gap-2">
                          <Button size="sm" onClick={openReview} disabled={activeSkus.length === 0 || syncing} className="gap-1.5 text-xs font-bold">
                            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                            مراجعة وتطبيق ({activeSkus.length})
                          </Button>
                        </div>
                      </div>
                    </div>
                    {displayProducts.map((product, i) => (
                      <motion.div key={product._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                        <ProductRow product={product} fields={fields[product.sku] || { name: false, price: false, stock: false, images: false }}
                          onFieldToggle={handleFieldToggle} onPreviewImages={setPreviewProduct} />
                      </motion.div>
                    ))}
                    {renderPagination()}
                  </>
                ) : (
                  <EmptyState title="لا توجد منتجات مختلفة" description={search ? 'حاول تغيير كلمة البحث' : 'جميع المنتجات متطابقة مع المتجر'} />
                )}
              </Card>
            </>
          )}

          {/* ── TAB: New Products (منتجات جديدة) ── */}
          {activeTab === 'new' && (
            <>
              <div className="mb-3 p-3 rounded-xl bg-green-50/50 border border-green-200/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                  <Package className="h-4 w-4 text-green-600" />
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700">منتجات جديدة للمتجر: </span>
                  منتجات جديدة غير موجودة في المتجر حالياً. اختر الحقول التي تريد إضافتها لكل منتج (سيتم إنشاؤها تلقائياً عند المزامنة).
                </div>
              </div>
              <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-200">
                  <div className="relative flex-[1] min-w-[180px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <input type="text" className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                      placeholder="بحث في المنتجات الجديدة…" value={search}
                      onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                  </div>
                  {activeSkus.length > 0 && (
                    <div className="flex items-center gap-2 bg-indigo-50 px-3 py-1.5 mt-3 rounded-xl">
                      <span className="text-xs font-bold text-indigo-600">{activeSkus.length} منتج • {activeFieldsCount} حقل نشط</span>
                      <button onClick={() => { activeSkus.forEach((sku) => toggleAllFields(sku, false)); }} className="text-xs text-slate-400 hover:text-slate-600"><XCircle className="h-3.5 w-3.5" /></button>
                    </div>
                  )}
                </div>
                {filteredNew.length > 0 ? (
                  <>
                    <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">{filteredNew.length} منتج جديد للمزامنة</span>
                        <Button size="sm" onClick={() => { filteredNew.forEach((p) => toggleAllFields(p.sku, true)); toast({ title: `تم تحديد ${filteredNew.length} منتج` }); }}
                          className="gap-1.5 text-xs font-bold">
                          <Download className="h-3.5 w-3.5" /> تحديد الكل
                        </Button>
                    </div>
                    {displayProducts.map((product, i) => (
                      <motion.div key={product._id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }}>
                        <ProductRow product={product} fields={fields[product.sku] || { name: false, price: false, stock: false, images: false }}
                          onFieldToggle={handleFieldToggle} onPreviewImages={setPreviewProduct} />
                      </motion.div>
                    ))}
                    {renderPagination()}
                    {activeSkus.length > 0 && (
                      <div className="px-4 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
                        <span className="text-xs text-slate-500">{activeSkus.length} منتج محدد للسحب</span>
                        <Button size="sm" onClick={openReview} disabled={syncing} className="gap-1.5 text-xs font-bold">
                          {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          مراجعة وتطبيق ({activeSkus.length})
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <EmptyState title="لا توجد منتجات جديدة" description="جميع المنتجات من الموقع تمت مزامنتها مع المتجر" />
                )}
              </Card>
            </>
          )}

          {/* ── TAB: Store Changes (تغييرات المتجر) ── */}
          {activeTab === 'store-changes' && (
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-3 flex-wrap">
                <div className="relative flex-[1] min-w-[180px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="بحث في تغييرات المتجر…" value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
                </div>
              </div>
              <div className="mb-3 p-3 m-3 rounded-xl bg-amber-50/50 border border-amber-200/50 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                  <Upload className="h-4 w-4 text-amber-600" />
                </div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  <span className="font-bold text-slate-700">دفع من المتجر ← الموقع: </span>
                  تغييرات قام المتجر بدفعها إلى الموقع. هذه هي المنتجات التي تم تحديثها بواسطة نظام نقاط البيع.
                </div>
              </div>
              {activity.filter((e) => e.type === 'sync').length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {activity.filter((e) => e.type === 'sync').slice(0, 50).map((event) => (
                    <div key={event._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
                        <Upload className="h-3.5 w-3.5 text-emerald-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-700 truncate">{event.storeName}</p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                            {new Date(event.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{event.descriptionAr || event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="لا توجد تغييرات من المتجر" description="لم يقم المتجر بدفع أي تغييرات حتى الآن" />
              )}
            </Card>
          )}

          {/* ── TAB: Logs (سجل المزامنة) ── */}
          {activeTab === 'logs' && (
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 space-y-3">
                <div className="relative flex-[1] min-w-[180px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input type="text" className="w-full pr-10 pl-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
                    placeholder="بحث في السجل…" value={search}
                    onChange={(e) => { setSearch(e.target.value); }} />
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex gap-1">
                    {[{ key: 'all', label: 'الكل' }, { key: 'sync', label: 'مزامنة' }, { key: 'error', label: 'أخطاء' }, { key: 'warning', label: 'تحذيرات' }].map((f) => (
                      <button key={f.key} onClick={() => setLogTypeFilter(f.key)}
                        className={cn('px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all',
                          logTypeFilter === f.key ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-400 hover:bg-slate-100')}>
                        {f.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 mr-auto">
                    <input type="date" value={logDateFrom} onChange={(e) => setLogDateFrom(e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600" />
                    <span className="text-[10px] text-slate-400">إلى</span>
                    <input type="date" value={logDateTo} onChange={(e) => setLogDateTo(e.target.value)}
                      className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-600" />
                  </div>
                </div>
              </div>
              {filteredLogs.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {filteredLogs.slice(0, 100).map((event) => (
                    <div key={event._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                      <div className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                        event.type === 'sync' ? 'bg-emerald-100' : event.type === 'error' ? 'bg-red-100' : 'bg-amber-100')}>
                        {event.type === 'sync' ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> :
                          event.type === 'error' ? <AlertTriangle className="h-3.5 w-3.5 text-red-600" /> :
                            <Info className="h-3.5 w-3.5 text-amber-600" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-700 truncate">{event.storeName}</p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                            {new Date(event.createdAt).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{event.descriptionAr || event.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="لا توجد أحداث" description="لم يتم تسجيل أي أحداث مزامنة بعد" />
              )}
            </Card>
          )}

          {/* ── TAB: Rollback (التراجع) ── */}
          {activeTab === 'rollback' && (
            <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200">
                <div className="mb-3 p-3 rounded-xl bg-purple-50/50 border border-purple-200/50 flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
                    <History className="h-4 w-4 text-purple-600" />
                  </div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    <span className="font-bold text-slate-700">سجل التراجع: </span>
                    لقطات المزامنة السابقة. يمكنك مراجعة التغييرات التي تمت أثناء المزامنات السابقة.
                  </div>
                </div>
              </div>
              {snapshotsLoading ? (
                <div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto text-slate-300" /></div>
              ) : snapshots.length > 0 ? (
                <div className="divide-y divide-slate-100">
                  {snapshots.map((snap) => (
                    <div key={snap.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                      <div className="h-7 w-7 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
                        <History className="h-3.5 w-3.5 text-purple-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-xs font-bold text-slate-700 truncate">
                            {snap.direction === 'pull' ? 'سحب من الموقع' : snap.direction === 'push' ? 'دفع للموقع' : 'تراجع'}
                          </p>
                          <span className="text-[10px] text-slate-400 whitespace-nowrap font-mono">
                            {new Date(snap.created_at).toLocaleString('ar-EG')}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">{snap.items_count} منتج</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState title="لا توجد لقطات مزامنة" description="سيتم إنشاء لقطة عند إجراء أول مزامنة" />
              )}
              {snapshotsTotal > 20 && (
                <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-center">
                  <Button size="sm" variant="outline" disabled={snapshotsLoading} onClick={() => loadSnapshots(snapshotsPage + 1)}
                    className="gap-1.5 text-xs font-bold">
                    {snapshotsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                    تحميل المزيد
                  </Button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Image preview modal */}
      {previewProduct && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={() => setPreviewProduct(null)}>
          <div className="relative max-w-3xl max-h-[85vh] mx-4" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const imgs = imgList(previewProduct);
              if (imgs.length === 0) return (
                <div className="w-64 h-64 rounded-2xl bg-slate-100 flex items-center justify-center"><ImageIcon className="h-16 w-16 text-slate-300" /></div>
              );
              return (
                <div className="grid grid-cols-2 gap-3">
                  {imgs.map((url, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden shadow-2xl bg-white"><img src={url} alt="" className="w-full object-cover" style={{ maxHeight: '70vh' }} /></div>
                  ))}
                </div>
              );
            })()}
            <button onClick={() => setPreviewProduct(null)} className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-slate-100 transition">
              <X className="h-4 w-4 text-slate-600" />
            </button>
          </div>
        </div>
      )}

      {/* Review modal */}
      <ReviewModal
        open={reviewOpen}
        onClose={() => setReviewOpen(false)}
        changes={reviewChanges}
        onApply={handleApply}
        applying={syncing}
        currencySymbol="ر.س"
      />
    </AdminLayout>
  );
}
