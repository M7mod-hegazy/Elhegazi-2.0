import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiGet, apiPutJson, apiDelete } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Pencil, Plus, Trash2, Users, Package, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optimizeImage, applyProductImageFallback } from '@/lib/images';

export type FamilyOptionRow = { key: string; label?: string; labelAr?: string };
export type FamilyMemberRow = { productId: string; values?: Record<string, string> };

export type AdminProductFamilyLean = {
  _id: string;
  name: string;
  nameAr: string;
  memberProductIds?: unknown[];
  defaultProductId?: string;
  options?: FamilyOptionRow[];
  members?: FamilyMemberRow[];
};

export type EditDialogProductRow = {
  id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  image?: string;
  categoryId?: string;
  productFamilyId?: string | null;
};

export type EditDialogCategory = { id: string; nameAr: string; name: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  family: AdminProductFamilyLean | null;
  products: EditDialogProductRow[];
  categories?: EditDialogCategory[];
  onSaved: () => void | Promise<void>;
};

const MIN_MEMBERS = 2;
const MAX_MEMBERS = 20;

/** اختصارات شائعة — تملأ خانة «اسم التمييز» بنقرة واحدة */
const OPTION_PRESETS_AR = ['مقاس', 'لون', 'الطول', 'العرض', 'السعة', 'المادة'] as const;

function optionColumnTitle(opt: FamilyOptionRow, idx: number) {
  const t = (opt.labelAr || '').trim();
  if (t) return t;
  return `تمييز ${idx + 1}`;
}

function labelPreview(
  values: Record<string, string>,
  options: FamilyOptionRow[],
  nameAr: string,
  name: string
) {
  const keys = options.map((o) => o.key).filter(Boolean);
  const parts: string[] = [];
  for (const k of keys) {
    const v = (values[k] || '').trim();
    if (v) parts.push(v);
  }
  if (parts.length) return parts.join(' · ');
  return nameAr || name;
}

export function ProductFamilyEditDialog({
  open,
  onOpenChange,
  family,
  products,
  categories = [],
  onSaved,
}: Props) {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [defaultProductId, setDefaultProductId] = useState('');
  const [options, setOptions] = useState<FamilyOptionRow[]>([]);
  const [valuesByProduct, setValuesByProduct] = useState<Record<string, Record<string, string>>>({});
  const [memberDetails, setMemberDetails] = useState<Record<string, EditDialogProductRow>>({});

  const [addSearch, setAddSearch] = useState('');
  const [addCategory, setAddCategory] = useState('all');
  const [addLoading, setAddLoading] = useState(false);
  const [addResults, setAddResults] = useState<EditDialogProductRow[]>([]);

  const [busy, setBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<EditDialogProductRow | null>(null);
  const [idsNeedingTransfer, setIdsNeedingTransfer] = useState<Set<string>>(new Set());

  const resetAddPanel = useCallback(() => {
    setAddSearch('');
    setAddCategory('all');
    setAddResults([]);
  }, []);

  useEffect(() => {
    if (!family || !open) return;
    setName(family.name || '');
    setNameAr(family.nameAr || '');
    const mids = (family.memberProductIds || []).map(String).filter(Boolean);
    setMemberIds(mids);
    setDefaultProductId(family.defaultProductId ? String(family.defaultProductId) : mids[0] || '');
    const opts = Array.isArray(family.options) ? family.options.map((o) => ({ ...o, key: String(o.key || '') })) : [];
    setOptions(opts.length ? opts : [{ key: 'opt1', label: '', labelAr: '' }]);
    const vb: Record<string, Record<string, string>> = {};
    for (const m of family.members || []) {
      const pid = String(m.productId);
      vb[pid] = m.values && typeof m.values === 'object' ? { ...m.values } : {};
    }
    for (const id of mids) {
      if (!vb[id]) vb[id] = {};
    }
    setValuesByProduct(vb);
    setIdsNeedingTransfer(new Set());
    resetAddPanel();
  }, [family, open, resetAddPanel]);

  useEffect(() => {
    if (!open || memberIds.length === 0) return;
    let cancelled = false;
    (async () => {
      try {
        type P = {
          _id?: string;
          id?: string;
          name?: string;
          nameAr?: string;
          sku?: string;
          image?: string;
          images?: string[];
        };
        const res = await apiGet<P>(
          `/api/products?ids=${encodeURIComponent(memberIds.join(','))}&fields=name,nameAr,sku,image,images`
        );
        if (!res.ok || cancelled) return;
        const map: Record<string, EditDialogProductRow> = {};
        for (const p of res.items || []) {
          const id = String(p._id || p.id || '');
          if (!id) continue;
          map[id] = {
            id,
            name: p.name || '',
            nameAr: p.nameAr,
            sku: p.sku,
            image: p.image || (Array.isArray(p.images) ? p.images[0] : ''),
          };
        }
        if (!cancelled) setMemberDetails(map);
      } catch {
        if (!cancelled) setMemberDetails({});
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, memberIds.join(',')]);

  const fetchAddResults = useCallback(async () => {
    setAddLoading(true);
    try {
      type P = {
        _id?: string;
        id?: string;
        name?: string;
        nameAr?: string;
        sku?: string;
        image?: string;
        images?: string[];
        productFamilyId?: string;
        categoryId?: string;
      };
      const params = new URLSearchParams();
      params.set('limit', '40');
      params.set('search', addSearch.trim());
      if (addCategory !== 'all' && addCategory) params.set('categoryId', addCategory);
      params.set('fields', 'name,nameAr,sku,image,images,productFamilyId,categoryId');
      const res = await apiGet<P>(`/api/products?${params.toString()}`);
      if (!res.ok) {
        setAddResults([]);
        return;
      }
      const rows: EditDialogProductRow[] = (res.items || []).map((p) => {
        const id = String(p._id || p.id || '');
        return {
          id,
          name: p.name || '',
          nameAr: p.nameAr,
          sku: p.sku,
          image: p.image || (Array.isArray(p.images) ? p.images[0] : ''),
          productFamilyId: p.productFamilyId ? String(p.productFamilyId) : null,
          categoryId: p.categoryId ? String(p.categoryId) : undefined,
        };
      });
      setAddResults(rows);
    } finally {
      setAddLoading(false);
    }
  }, [addSearch, addCategory]);

  useEffect(() => {
    if (!open || !family) return;
    const t = setTimeout(() => void fetchAddResults(), 300);
    return () => clearTimeout(t);
  }, [open, family, fetchAddResults]);

  const productById = useMemo(() => {
    const m = new Map<string, EditDialogProductRow>();
    for (const p of products) m.set(String(p.id), p);
    return m;
  }, [products]);

  const tryAddMember = (row: EditDialogProductRow) => {
    if (!family) return;
    const id = row.id;
    if (memberIds.includes(id)) {
      toast({ title: 'المنتج ضمن العائلة بالفعل', variant: 'destructive' });
      return;
    }
    if (memberIds.length >= MAX_MEMBERS) {
      toast({ title: `حد أقصى ${MAX_MEMBERS} منتجاً`, variant: 'destructive' });
      return;
    }
    const pf = row.productFamilyId ? String(row.productFamilyId) : '';
    if (pf && pf !== String(family._id)) {
      setTransferTarget(row);
      return;
    }
    setMemberIds((prev) => [...prev, id]);
    setValuesByProduct((prev) => ({ ...prev, [id]: {} }));
  };

  const confirmTransfer = () => {
    if (!transferTarget) return;
    const id = transferTarget.id;
    setMemberIds((prev) => [...prev, id]);
    setValuesByProduct((prev) => ({ ...prev, [id]: {} }));
    setIdsNeedingTransfer((prev) => new Set(prev).add(id));
    setTransferTarget(null);
  };

  const removeMember = (id: string) => {
    if (memberIds.length <= MIN_MEMBERS) {
      toast({ title: 'يجب أن تبقى عائلة من منتجين على الأقل', variant: 'destructive' });
      return;
    }
    setMemberIds((prev) => prev.filter((x) => x !== id));
    setValuesByProduct((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setIdsNeedingTransfer((prev) => {
      const n = new Set(prev);
      n.delete(id);
      return n;
    });
    setDefaultProductId((d) => (d === id ? memberIds.find((x) => x !== id) || '' : d));
  };

  const moveMember = (id: string, direction: -1 | 1) => {
    setMemberIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx < 0) return prev;
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const next = [...prev];
      const swap = next[nextIdx];
      next[nextIdx] = next[idx];
      next[idx] = swap;
      return next;
    });
  };

  const setValue = (productId: string, key: string, val: string) => {
    setValuesByProduct((prev) => ({
      ...prev,
      [productId]: { ...(prev[productId] || {}), [key]: val },
    }));
  };

  const addOptionRow = () => {
    setOptions((prev) => {
      const used = new Set(prev.map((o) => o.key));
      let k = 1;
      while (used.has(`opt${k}`)) k += 1;
      return [...prev, { key: `opt${k}`, label: '', labelAr: '' }];
    });
  };

  const removeOptionRow = (idx: number) => {
    if (options.length <= 1) return;
    const key = options[idx]?.key;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
    if (!key) return;
    setValuesByProduct((prev) => {
      const next = { ...prev };
      for (const pid of Object.keys(next)) {
        const v = { ...next[pid] };
        delete v[key];
        next[pid] = v;
      }
      return next;
    });
  };

  const handleSave = async () => {
    if (!family?._id) return;
    const nAr = nameAr.trim();
    if (!nAr) {
      toast({ title: 'أدخل اسم العائلة بالعربية', variant: 'destructive' });
      return;
    }
    const n = name.trim() || nAr;
    if (memberIds.length < MIN_MEMBERS || memberIds.length > MAX_MEMBERS) {
      toast({ title: `عدد الأعضاء يجب أن يكون بين ${MIN_MEMBERS} و ${MAX_MEMBERS}`, variant: 'destructive' });
      return;
    }
    const def = defaultProductId && memberIds.includes(defaultProductId) ? defaultProductId : memberIds[0];
    const cleanOptions = options
      .map((o) => {
        const key = o.key.trim();
        const labelAr = (o.labelAr || '').trim();
        const label = (o.label || '').trim() || labelAr;
        return { key, label, labelAr };
      })
      .filter((o) => o.key.length > 0);
    const members = memberIds.map((productId) => ({
      productId,
      values: valuesByProduct[productId] || {},
    }));
    setBusy(true);
    try {
      const res = await apiPutJson(`/api/product-families/${family._id}`, {
        name: n,
        nameAr: nAr,
        defaultProductId: def,
        memberProductIds: memberIds,
        members,
        options: cleanOptions,
        transferFromOtherFamilies: idsNeedingTransfer.size > 0,
      });
      if (!res.ok) {
        throw new Error('error' in res ? String(res.error) : 'فشل الحفظ');
      }
      toast({ title: 'تم', description: 'تم تحديث العائلة' });
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast({
        title: 'فشل',
        description: e instanceof Error ? e.message : 'خطأ',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteFamily = async () => {
    if (!family?._id) return;
    setBusy(true);
    try {
      const res = await apiDelete(`/api/product-families/${family._id}`);
      if (!res.ok) {
        throw new Error('error' in res ? String(res.error) : 'فشل الحذف');
      }
      toast({ title: 'تم', description: 'حُذفت العائلة وأصبحت المنتجات عادية' });
      setDeleteOpen(false);
      onOpenChange(false);
      await onSaved();
    } catch (e) {
      toast({
        title: 'فشل',
        description: e instanceof Error ? e.message : 'خطأ',
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  if (!family) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] flex flex-col gap-0 p-0" dir="rtl">
          <DialogHeader className="px-6 pt-6 pb-3 border-b shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <Pencil className="h-5 w-5 shrink-0" />
              تعديل عائلة المنتجات
            </DialogTitle>
            <DialogDescription className="text-right text-slate-600">
              رتّب الاسم، ثم الأعضاء، ثم نص كل زر خيار في صفحة المنتج (مقاس، لون، طول…).
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 max-h-[calc(92vh-220px)] overflow-y-auto px-6">
            <div className="space-y-5 py-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                    ١
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">اسم العائلة</h3>
                      <p className="text-xs text-slate-500">العنوان الذي يراه العميل فوق خيارات المنتج.</p>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="fam-edit-ar">
                        الاسم بالعربية <span className="text-destructive">*</span>
                      </Label>
                      <Input
                        id="fam-edit-ar"
                        value={nameAr}
                        onChange={(e) => setNameAr(e.target.value)}
                        placeholder="مثال: خط كاشير سوبر ماركت"
                      />
                    </div>
                    <details className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
                      <summary className="cursor-pointer text-sm font-medium text-slate-700">
                        اسم إنجليزي (اختياري)
                      </summary>
                      <p className="mt-2 text-xs leading-relaxed text-slate-500">
                        للتوافق مع أنظمة قد تطلب حقل إنجليزي. إن تُرك فارغاً يُستخدم الاسم العربي تلقائياً عند الحفظ.
                      </p>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        dir="ltr"
                        className="mt-2 text-left"
                        placeholder="Optional — English name"
                      />
                    </details>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-sm font-bold text-slate-800">
                    ٢
                  </span>
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">المنتج الافتراضي في القوائم</h3>
                      <p className="text-xs text-slate-500">يُختار تلقائياً عند عرض العائلة كمنتج واحد في القوائم.</p>
                    </div>
                    <Select value={defaultProductId} onValueChange={setDefaultProductId}>
                      <SelectTrigger id="fam-default-product" className="max-w-md w-full">
                        <SelectValue placeholder="اختر المنتج" />
                      </SelectTrigger>
                      <SelectContent>
                        {memberIds.map((id) => {
                          const d = memberDetails[id] || productById.get(id);
                          return (
                            <SelectItem key={id} value={id}>
                              {d?.nameAr || d?.name || id}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-indigo-100 bg-indigo-50/30 p-4 shadow-sm">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                    ٣
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-700" />
                      <h3 className="text-base font-bold text-slate-900">أعضاء العائلة الآن</h3>
                      <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-indigo-800 ring-1 ring-indigo-200">
                        {memberIds.length} منتجات
                      </span>
                    </div>
                    <p className="text-xs text-slate-600">
                      بطاقة لكل منتج في المجموعة. «إزالة» تُخرجه من العائلة فقط ولا تحذف المنتج من المتجر.
                    </p>
                    <div className="flex flex-wrap gap-3">
                  {memberIds.map((id, idx) => {
                    const d = memberDetails[id] || productById.get(id);
                    return (
                      <div
                        key={id}
                        className="relative flex w-[140px] flex-col rounded-xl border bg-white p-2 shadow-sm"
                      >
                        <div className="mb-1 flex items-center justify-between gap-1">
                          <span className="text-[10px] font-semibold text-slate-500">#{idx + 1}</span>
                          <div className="flex items-center gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => moveMember(id, -1)}
                              disabled={idx === 0}
                            >
                              <ArrowUp className="h-3 w-3" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-6 w-6 p-0"
                              onClick={() => moveMember(id, 1)}
                              disabled={idx === memberIds.length - 1}
                            >
                              <ArrowDown className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="aspect-square w-full overflow-hidden rounded-lg bg-slate-100">
                          {d?.image ? (
                            <img
                              src={optimizeImage(d.image, { w: 200 })}
                              alt=""
                              className="h-full w-full object-cover"
                              onError={applyProductImageFallback}
                            />
                          ) : (
                            <Package className="m-auto h-8 w-8 text-slate-400" />
                          )}
                        </div>
                        <p className="mt-2 line-clamp-2 text-center text-[11px] font-medium text-slate-800">
                          {d?.nameAr || d?.name || id.slice(-6)}
                        </p>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-1 h-7 text-xs text-red-600 hover:text-red-700"
                          onClick={() => removeMember(id)}
                        >
                          <Trash2 className="ml-1 h-3 w-3" />
                          إزالة
                        </Button>
                      </div>
                    );
                  })}
                    </div>
                    <p className="text-[11px] text-slate-500">هذا الترتيب يحدد ترتيب أزرار الخيارات في تفاصيل المنتج وكرت العائلة.</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
                    ٤
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-end justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">إضافة منتج للعائلة</h3>
                        <p className="text-xs text-slate-500">بحث بالاسم أو الكود، مع صورة وفلترة بالفئة.</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        placeholder="بحث بالاسم أو الكود..."
                        value={addSearch}
                        onChange={(e) => setAddSearch(e.target.value)}
                        className="max-w-xs flex-1 min-w-[160px]"
                      />
                      {categories.length > 0 && (
                        <Select value={addCategory} onValueChange={setAddCategory}>
                          <SelectTrigger className="w-[200px]">
                            <SelectValue placeholder="الفئة" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">كل الفئات</SelectItem>
                            {categories.map((c) => (
                              <SelectItem key={c.id} value={c.id}>
                                {c.nameAr || c.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                    <div className="max-h-[min(52vh,420px)] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50/40 p-2">
                      {addLoading ? (
                        <p className="p-6 text-center text-sm text-slate-500">جاري التحميل...</p>
                      ) : addResults.length === 0 ? (
                        <p className="p-6 text-center text-sm text-slate-500">لا توجد نتائج — جرّب كلمات أخرى أو «كل الفئات».</p>
                      ) : (
                        <div className="grid gap-2 sm:grid-cols-2">
                          {addResults.map((row) => {
                            const inFam = memberIds.includes(row.id);
                            const other =
                              row.productFamilyId && String(row.productFamilyId) !== String(family._id);
                            return (
                              <div
                                key={row.id}
                                className={cn(
                                  'flex gap-3 rounded-xl border bg-white p-3 text-right shadow-sm transition-colors',
                                  inFam && 'opacity-60 ring-1 ring-emerald-200',
                                  other && !inFam && 'border-amber-200 bg-amber-50/40'
                                )}
                              >
                                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                                  {row.image ? (
                                    <img
                                      src={optimizeImage(row.image, { w: 112 })}
                                      alt=""
                                      className="h-full w-full object-cover"
                                      onError={applyProductImageFallback}
                                    />
                                  ) : (
                                    <Package className="m-auto h-6 w-6 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="line-clamp-2 text-sm font-semibold text-slate-900">
                                    {row.nameAr || row.name}
                                  </p>
                                  <div className="mt-1 flex flex-wrap gap-1">
                                    {row.sku ? (
                                      <span className="text-[10px] text-slate-500 font-mono">{row.sku}</span>
                                    ) : null}
                                    {other ? (
                                      <span className="rounded bg-amber-100 px-1.5 text-[10px] text-amber-900">
                                        عائلة أخرى — تأكيد نقل عند الإضافة
                                      </span>
                                    ) : null}
                                    {inFam ? (
                                      <span className="rounded bg-emerald-100 px-1.5 text-[10px] text-emerald-800">
                                        مضاف بالفعل
                                      </span>
                                    ) : null}
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant={inFam ? 'outline' : 'secondary'}
                                  className="shrink-0 self-center"
                                  disabled={inFam}
                                  onClick={() => tryAddMember(row)}
                                >
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm ring-1 ring-slate-100/80">
                <div className="flex gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-800 text-sm font-bold text-white">
                    ٥
                  </span>
                  <div className="min-w-0 flex-1 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">ما الذي يختلف بين المنتجات؟</h3>
                        <p className="text-xs text-slate-600 leading-relaxed">
                          اكتب اسماً بسيطاً (مثل: المقاس)، ثم في الجدول أدناه اكتب لكل منتج النص الذي يظهر على الزر في
                          المتجر.
                        </p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={addOptionRow}>
                        <Plus className="ml-1 h-3 w-3" />
                        إضافة تمييز آخر
                      </Button>
                    </div>
                    <div className="space-y-3">
                      {options.map((opt, idx) => (
                        <div
                          key={opt.key}
                          className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 shadow-sm space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-800">
                              {optionColumnTitle(opt, idx)}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                              onClick={() => removeOptionRow(idx)}
                              disabled={options.length <= 1}
                            >
                              <Trash2 className="h-4 w-4" />
                              حذف
                            </Button>
                          </div>
                          <p className="text-[11px] text-slate-500">اختصار سريع:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {OPTION_PRESETS_AR.map((preset) => (
                              <Button
                                key={preset}
                                type="button"
                                variant="secondary"
                                size="sm"
                                className="h-7 rounded-full px-2.5 text-xs font-normal"
                                onClick={() =>
                                  setOptions((prev) =>
                                    prev.map((o, i) => (i === idx ? { ...o, labelAr: preset } : o))
                                  )
                                }
                              >
                                {preset}
                              </Button>
                            ))}
                          </div>
                          <div className="grid gap-1.5 pt-1">
                            <Label htmlFor={`opt-ar-${opt.key}`} className="text-sm font-medium text-slate-800">
                              اسم التمييز
                            </Label>
                            <Input
                              id={`opt-ar-${opt.key}`}
                              className="h-10 bg-white"
                              value={opt.labelAr || ''}
                              onChange={(e) =>
                                setOptions((prev) =>
                                  prev.map((o, i) => (i === idx ? { ...o, labelAr: e.target.value } : o))
                                )
                              }
                              placeholder="مثال: المقاس، اللون، طول اللوح…"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                <div className="rounded-xl border bg-slate-50/80 p-3">
                  <p className="mb-2 text-xs font-medium text-slate-700">معاينة شكل الأزرار في المتجر</p>
                  <div className="flex flex-wrap gap-2">
                    {memberIds.map((id) => {
                      const d = memberDetails[id] || productById.get(id);
                      const vals = valuesByProduct[id] || {};
                      const lbl = labelPreview(vals, options, d?.nameAr || '', d?.name || '');
                      const isDef = id === defaultProductId;
                      return (
                        <span
                          key={id}
                          className={cn(
                            'rounded-full border px-3 py-1.5 text-xs',
                            isDef ? 'border-primary bg-primary text-primary-foreground' : 'bg-white'
                          )}
                        >
                          {lbl}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <p className="border-b bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
                    املأ الخلايا: هذا هو النص الذي يراه الزائر على زر كل خيار
                  </p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-slate-50">
                        <th className="p-2 text-right">المنتج</th>
                        {options.map((o, i) => (
                          <th key={o.key} className="p-2 text-right whitespace-nowrap">
                            {optionColumnTitle(o, i)}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {memberIds.map((id) => {
                        const d = memberDetails[id] || productById.get(id);
                        return (
                          <tr key={id} className="border-b last:border-0">
                            <td className="p-2 align-top max-w-[140px]">
                              <span className="line-clamp-2 text-xs">{d?.nameAr || d?.name}</span>
                            </td>
                            {options.map((o) => (
                              <td key={o.key} className="p-1 align-top">
                                <Input
                                  className="h-9 text-xs"
                                  placeholder="مثال: ١٫٢٥ م"
                                  value={(valuesByProduct[id] || {})[o.key] || ''}
                                  onChange={(e) => setValue(id, o.key, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                  </div>
                </div>
              </section>

              <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-600" />
                  <div>
                    <p className="text-sm font-semibold text-red-900">حذف العائلة بالكامل</p>
                    <p className="mt-1 text-xs text-red-800/90">
                      تُزال ربط المنتجات بالعائلة وتُعرض كمنتجات عادية (بدون تجميع).
                    </p>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="mt-2"
                      onClick={() => setDeleteOpen(true)}
                    >
                      حذف العائلة
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="px-6 py-4 border-t shrink-0 gap-2 flex-row-reverse flex-wrap">
            <Button type="button" onClick={handleSave} disabled={busy}>
              {busy ? 'جارٍ الحفظ...' : 'حفظ'}
            </Button>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!transferTarget} onOpenChange={(o) => !o && setTransferTarget(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>نقل من عائلة أخرى؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              المنتج «{transferTarget?.nameAr || transferTarget?.name}» مرتبط بعائلة أخرى. عند المتابعة سيتم إزالته من
              تلك العائلة (وقد تُفسخ العائلة إن بقي أقل من منتجين) ثم إضافته هنا. تأكد قبل الحفظ.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={confirmTransfer}>متابعة</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد حذف العائلة</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              لن يمكن التراجع. جميع المنتجات ستصبح بدون عائلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction className="bg-destructive text-destructive-foreground" onClick={handleDeleteFamily}>
              حذف نهائي
            </AlertDialogAction>
            <AlertDialogCancel disabled={busy}>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
