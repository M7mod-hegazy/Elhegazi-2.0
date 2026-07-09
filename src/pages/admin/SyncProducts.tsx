import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  RefreshCw, ArrowLeftRight, Store, Package, ImageIcon,
  CheckCircle2, Loader2, Search, ChevronDown, Upload, Download,
  Info, Globe, Layers, TrendingUp, AlertTriangle,
  ChevronRight, ChevronLeft, X, Clock,
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
import { getSyncedProducts, getStores, getSyncActivity, triggerManualSync, type SyncProduct, type SyncStore, type SyncActivityEvent } from '@/lib/api-sync';
import { apiPostJson } from '@/lib/api';
import { cn } from '@/lib/utils';
import ReviewModal from '@/components/sync/ReviewModal';

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

function ProductRow({ product, fields, onFieldToggle, onPreviewImages }: {
  product: SyncProduct;
  fields: FieldSelections[string];
  onFieldToggle: (sku: string, field: string) => void;
  onPreviewImages: (product: SyncProduct) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const images = useMemo(() => imgList(product), [product]);

  const allFields = [
    { key: 'name', label: 'الاسم', match: null },
    { key: 'price', label: 'السعر', match: null, ecom: `${product.price?.toFixed(2) ?? '—'} ر.س` },
    { key: 'stock', label: 'المخزون', match: null, ecom: `${product.stock ?? '—'}` },
    { key: 'images', label: 'الصور', match: null, ecom: images.length > 0 ? `${images.length} صور` : '—' },
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
              <button
                onClick={() => setExpanded(!expanded)}
                className={cn('p-1 rounded-lg transition-all duration-200 shrink-0 mr-auto', expanded ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100')}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded ? 'rotate-180' : '')} />
              </button>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs font-bold text-slate-500">السعر: {product.price?.toFixed(2)} ر.س</span>
              <span className="w-px h-3 bg-slate-200" />
              <span className="text-xs font-bold text-slate-500">المخزون: {product.stock ?? 0}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 mt-2.5 mr-0 flex-wrap">
          {allFields.map((f) => {
            const isMatched = f.match === true;
            const differs = f.match === false;
            const on = fields?.[f.key] ?? false;
            return (
              <button
                key={f.key}
                onClick={() => { if (differs) onFieldToggle(product.sku, f.key); }}
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-bold border transition-all',
                  isMatched
                    ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-default'
                    : on
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-400 hover:border-slate-300'
                )}
                title={`${f.label}: ${isMatched ? 'مطابق ✓' : `${on ? 'نشط' : 'معطل'}`}`}
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

      {expanded && (
        <div className="px-4 pb-4 animate-in slide-in-from-top-2 border-t border-slate-100">
          <div className="pt-3 space-y-1.5">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 mb-1">
              <span className="flex-1 px-2 py-1 rounded bg-slate-50 text-center">الموقع الإلكتروني</span>
              <ArrowLeftRight className="h-3 w-3 shrink-0" />
            </div>
            {allFields.map((f) => (
              <div key={f.key} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs bg-slate-50/50">
                <span className="w-16 font-bold text-slate-400 shrink-0">{f.label}</span>
                <span className="flex-1 text-slate-700 font-bold">{f.ecom}</span>
              </div>
            ))}
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
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [fields, setFields] = useState<FieldSelections>({});
  const [syncing, setSyncing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [reviewChanges, setReviewChanges] = useState<ChangeItem[]>([]);
  const [previewProduct, setPreviewProduct] = useState<SyncProduct | null>(null);

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

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    const q = search.trim().toLowerCase();
    return products.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      (p.nameAr || '').toLowerCase().includes(q) ||
      (p.sku || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  const handleFieldToggle = (sku: string, field: string) => {
    setFields((prev) => {
      const current = prev[sku] || { name: false, price: false, stock: false, images: false };
      const updated = { ...current, [field]: !current[field as keyof typeof current] };
      return { ...prev, [sku]: updated };
    });
  };

  const selectCount = useMemo(() =>
    Object.values(fields).filter((f) => Object.values(f).some(Boolean)).length,
    [fields]
  );

  const handlePush = () => {
    // Build change items from selected products
    const selected: ChangeItem[] = [];
    for (const [sku, fieldSet] of Object.entries(fields)) {
      const activeFields = Object.entries(fieldSet).filter(([, v]) => v).map(([k]) => k);
      if (activeFields.length === 0) continue;
      const product = products.find((p) => p.sku === sku);
      if (!product) continue;
      const images = imgList(product);
      selected.push({
        sku: product.sku,
        name: product.nameAr || product.name,
        nameAr: product.nameAr,
        image: product.image,
        images: product.images,
        isNew: false,
        current: {},
        incoming: {
          name: product.name,
          nameAr: product.nameAr,
          price: product.price,
          stock: product.stock,
        },
        diff: Object.fromEntries(activeFields.map((f) => [f, true])),
        fields: Object.fromEntries(activeFields.map((f) => [f, true])),
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
      const res = await apiPostJson<any, { items: typeof items }>('/api/sync/apply', { items });
      if (res.ok) {
        toast({ title: 'تم تطبيق المزامنة بنجاح' });
        setFields({});
        setReviewOpen(false);
        load();
      } else {
        toast({ title: 'فشل تطبيق المزامنة', variant: 'destructive' });
      }
    } catch (err: unknown) {
      toast({ title: 'خطأ في الاتصال', description: String(err), variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  const handleTriggerSync = async () => {
    setSyncing(true);
    try {
      await triggerManualSync();
      toast({ title: 'تم تشغيل المزامنة' });
      load();
    } catch {
      toast({ title: 'فشل تشغيل المزامنة', variant: 'destructive' });
    } finally {
      setSyncing(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen flex items-center justify-center">
          <LoadingSpinner className="h-8 w-8" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 p-4 md:p-6">
        <div className="max-w-6xl mx-auto">
          {/* Slim header */}
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-indigo-600 via-indigo-600/90 to-indigo-600/80 shadow-lg">
              <div className="relative p-5 md:p-6">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-white/15 backdrop-blur-sm border border-white/10 flex items-center justify-center shrink-0">
                      <Package className="h-5 w-5 text-white" />
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
                  <span className="flex items-center gap-1.5">
                    <Package className="h-3 w-3" /> {products.length} منتج
                  </span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="flex items-center gap-1.5">
                    <Store className="h-3 w-3" /> {stores.filter((s) => s.isActive).length} متجر نشط
                  </span>
                  <span className="w-px h-3 bg-white/10" />
                  <span className="flex items-center gap-1.5">
                    <CheckCircle2 className="h-3 w-3 text-emerald-300" /> {selectCount} محدد
                  </span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Controls bar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1 max-w-xs">
              <Search className="h-4 w-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="بحث عن منتج…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-9 pr-9 text-xs rounded-xl border-slate-200 bg-white/80"
              />
            </div>
            <div className="mr-auto flex items-center gap-2">
              <Button
                size="sm"
                onClick={handlePush}
                disabled={selectCount === 0}
                className="gap-1.5 text-xs font-bold"
              >
                <Upload className="h-3.5 w-3.5" />
                دفع للمتاجر ({selectCount})
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleTriggerSync}
                disabled={syncing}
                className="gap-1.5 text-xs font-bold"
              >
                <Download className="h-3.5 w-3.5" />
                سحب من المتاجر
              </Button>
            </div>
          </div>

          {/* Product list */}
          <Card className="border-0 shadow-lg bg-white/90 backdrop-blur-sm overflow-hidden">
            {filteredProducts.length === 0 ? (
              <CardContent className="p-12 text-center">
                <Package className="h-16 w-16 mx-auto text-slate-200 mb-4" />
                <p className="text-sm font-bold text-slate-400 mb-1">لا توجد منتجات</p>
                <p className="text-xs text-slate-300">{search ? 'حاول تغيير كلمة البحث' : 'لم تتم مزامنة أي منتجات بعد'}</p>
              </CardContent>
            ) : (
              <div>
                {filteredProducts.map((product, i) => (
                  <motion.div
                    key={product._id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.02 }}
                  >
                    <ProductRow
                      product={product}
                      fields={fields[product.sku] || { name: false, price: false, stock: false, images: false }}
                      onFieldToggle={handleFieldToggle}
                      onPreviewImages={setPreviewProduct}
                    />
                  </motion.div>
                ))}
              </div>
            )}
          </Card>

          {/* Activity feed */}
          {activity.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mt-6">
              <h2 className="text-sm font-black text-slate-700 mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-indigo-500" />
                آخر نشاط المزامنة
              </h2>
              <Card className="border-0 shadow-md bg-white/90 backdrop-blur-sm overflow-hidden">
                <div className="divide-y divide-slate-100">
                  {activity.slice(0, 10).map((event) => (
                    <div key={event._id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50/60 transition-colors">
                      <div className={cn(
                        'h-7 w-7 rounded-full flex items-center justify-center shrink-0',
                        event.type === 'sync' ? 'bg-emerald-100' :
                        event.type === 'error' ? 'bg-red-100' : 'bg-amber-100'
                      )}>
                        {event.type === 'sync' ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                        ) : event.type === 'error' ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
                        ) : (
                          <Info className="h-3.5 w-3.5 text-amber-600" />
                        )}
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
              </Card>
            </motion.div>
          )}
        </div>
      </div>

      {/* Image preview modal */}
      {previewProduct && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={() => setPreviewProduct(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] mx-4" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const imgs = imgList(previewProduct);
              if (imgs.length === 0) {
                return (
                  <div className="w-64 h-64 rounded-2xl bg-slate-100 flex items-center justify-center">
                    <ImageIcon className="h-16 w-16 text-slate-300" />
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-2 gap-3">
                  {imgs.map((url, i) => (
                    <div key={i} className="rounded-2xl overflow-hidden shadow-2xl bg-white">
                      <img src={url} alt="" className="w-full object-cover" style={{ maxHeight: '70vh' }} />
                    </div>
                  ))}
                </div>
              );
            })()}
            <button
              onClick={() => setPreviewProduct(null)}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-white shadow-lg flex items-center justify-center hover:bg-slate-100 transition"
            >
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
