import { useState, useMemo, useEffect } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiPostJson } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { Link2, ChevronLeft, ChevronRight, Package, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { optimizeImage, applyProductImageFallback } from '@/lib/images';

export type RowProduct = {
  _id: string;
  name: string;
  nameAr?: string;
  sku?: string;
  productFamilyId?: string | null;
  image?: string;
  categoryId?: string;
};

export type CategoryOption = {
  id: string;
  nameAr: string;
  name: string;
};

type OptionRow = { key: string; label: string; labelAr: string };

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: RowProduct[];
  categories?: CategoryOption[];
  onCreated: () => void | Promise<void>;
};

const MAX_MEMBERS = 20;

const OPTION_PRESETS_AR = ['مقاس', 'لون', 'الطول', 'العرض', 'السعة', 'المادة'] as const;

function optionColumnTitle(opt: OptionRow, idx: number) {
  const t = (opt.labelAr || '').trim();
  if (t) return t;
  return `تمييز ${idx + 1}`;
}

function labelPreview(
  values: Record<string, string>,
  options: OptionRow[],
  nameAr: string,
  name: string
) {
  const parts: string[] = [];
  for (const o of options) {
    const v = (values[o.key] || '').trim();
    if (v) parts.push(v);
  }
  if (parts.length) return parts.join(' · ');
  return nameAr || name;
}

export function ProductFamilyMergeDialog({
  open,
  onOpenChange,
  products,
  categories = [],
  onCreated,
}: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [name, setName] = useState('');
  const [nameAr, setNameAr] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [defaultProductId, setDefaultProductId] = useState<string>('');
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [showAllProducts, setShowAllProducts] = useState(true);
  const [sortBy, setSortBy] = useState<'nameAr' | 'sku'>('nameAr');
  const [options, setOptions] = useState<OptionRow[]>([{ key: 'opt1', label: '', labelAr: '' }]);
  const [valuesByProduct, setValuesByProduct] = useState<Record<string, Record<string, string>>>({});
  const [transferPick, setTransferPick] = useState<RowProduct | null>(null);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setName('');
      setNameAr('');
      setSelected(new Set());
      setDefaultProductId('');
      setSearch('');
      setCategoryFilter('all');
      setShowAllProducts(true);
      setSortBy('nameAr');
      setOptions([{ key: 'opt1', label: '', labelAr: '' }]);
      setValuesByProduct({});
      setTransferPick(null);
    }
  }, [open]);

  const eligible = useMemo(
    () => products.filter((p) => !p.productFamilyId),
    [products]
  );

  const filteredPicker = useMemo(() => {
    let list = showAllProducts ? products : eligible;
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          (p.nameAr || '').toLowerCase().includes(q) ||
          (p.name || '').toLowerCase().includes(q) ||
          (p.sku || '').toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') {
      list = list.filter((p) => String(p.categoryId || '') === categoryFilter);
    }
    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'sku') {
        return (a.sku || '').localeCompare(b.sku || '', 'ar');
      }
      return (a.nameAr || a.name).localeCompare(b.nameAr || b.name, 'ar');
    });
    return sorted;
  }, [eligible, products, showAllProducts, search, categoryFilter, sortBy]);

  const selectedMembers = useMemo(() => {
    const ids = [...selected];
    return ids
      .map((id) => products.find((p) => p._id === id))
      .filter((p): p is RowProduct => !!p);
  }, [selected, products]);

  const needsTransfer = useMemo(
    () => selectedMembers.some((p) => p.productFamilyId && String(p.productFamilyId).length > 0),
    [selectedMembers]
  );

  useEffect(() => {
    if ((step === 3 || step === 4) && selected.size > 0) {
      const ids = [...selected];
      setValuesByProduct((prev) => {
        const next = { ...prev };
        for (const id of ids) {
          if (!next[id]) next[id] = {};
        }
        return next;
      });
    }
  }, [step, selected]);

  useEffect(() => {
    if (step === 4 && selected.size > 0) {
      const ids = [...selected];
      if (!defaultProductId || !ids.includes(defaultProductId)) {
        setDefaultProductId(ids[0]);
      }
    }
  }, [step, selected, defaultProductId]);

  const toggle = (p: RowProduct) => {
    const id = p._id;
    const merged = !!p.productFamilyId;
    if (selected.has(id)) {
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      return;
    }
    if (merged) {
      setTransferPick(p);
      return;
    }
    setSelected((prev) => {
      if (prev.size >= MAX_MEMBERS) {
        toast({ title: `حد أقصى ${MAX_MEMBERS} منتجاً`, variant: 'destructive' });
        return prev;
      }
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const confirmTransferAdd = () => {
    if (!transferPick) return;
    setSelected((prev) => {
      if (prev.size >= MAX_MEMBERS) {
        toast({ title: `حد أقصى ${MAX_MEMBERS} منتجاً`, variant: 'destructive' });
        return prev;
      }
      const next = new Set(prev);
      next.add(transferPick._id);
      return next;
    });
    setTransferPick(null);
  };

  const goNextFromStep1 = () => {
    const nAr = nameAr.trim();
    if (!nAr) {
      toast({ title: 'أدخل اسم العائلة بالعربية', variant: 'destructive' });
      return;
    }
    setStep(2);
  };

  const goNextFromStep2 = () => {
    if (selected.size < 2) {
      toast({ title: 'اختر منتجين على الأقل', variant: 'destructive' });
      return;
    }
    setStep(3);
  };

  const goNextFromStep3 = () => {
    setStep(4);
  };

  const addOption = () => {
    setOptions((prev) => {
      const used = new Set(prev.map((o) => o.key));
      let k = 1;
      while (used.has(`opt${k}`)) k += 1;
      return [...prev, { key: `opt${k}`, label: '', labelAr: '' }];
    });
  };

  const removeOption = (idx: number) => {
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

  const setVal = (pid: string, key: string, val: string) => {
    setValuesByProduct((prev) => ({
      ...prev,
      [pid]: { ...(prev[pid] || {}), [key]: val },
    }));
  };

  const handleSubmit = async () => {
    const ids = [...selected];
    if (ids.length < 2 || ids.length > MAX_MEMBERS) {
      toast({ title: 'عدد غير صالح', variant: 'destructive' });
      return;
    }
    const nAr = nameAr.trim();
    if (!nAr) {
      toast({ title: 'أدخل اسم العائلة بالعربية', variant: 'destructive' });
      return;
    }
    const n = name.trim() || nAr;
    const def = defaultProductId && ids.includes(defaultProductId) ? defaultProductId : ids[0];
    const cleanOpts = options
      .map((o) => {
        const key = o.key.trim();
        const labelAr = (o.labelAr || '').trim();
        const label = (o.label || '').trim() || labelAr;
        return { key, label, labelAr };
      })
      .filter((o) => o.key);
    const members = ids.map((productId) => ({
      productId,
      values: valuesByProduct[productId] || {},
    }));
    setBusy(true);
    try {
      const res = await apiPostJson('/api/product-families', {
        name: n,
        nameAr: nAr,
        memberProductIds: ids,
        defaultProductId: def,
        options: cleanOpts,
        members,
        transferFromOtherFamilies: needsTransfer,
      });
      if (!res.ok) {
        throw new Error('error' in res ? String(res.error) : 'فشل الإنشاء');
      }
      toast({ title: 'تم', description: 'تم إنشاء عائلة المنتجات' });
      onOpenChange(false);
      await onCreated();
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

  const stepLabels = ['الأسماء', 'اختيار المنتجات', 'نص أزرار الخيار', 'مراجعة وإنشاء'];

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0 gap-0" dir="rtl">
          <DialogHeader className="px-6 pt-6 pb-4 border-b border-slate-100 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700">
                <Link2 className="h-5 w-5" />
              </span>
              دمج منتجات في عائلة
            </DialogTitle>
            <DialogDescription className="text-right text-slate-600">
              {step === 1 && 'اسم العائلة ثم اختيار المنتجات (مع إمكانية النقل من عائلة أخرى).'}
              {step === 2 && 'صور وفلترة وبحث — المنتجات ضمن عائلة تتطلب تأكيد نقل.'}
              {step === 3 && 'ما الذي يختلف بين المنتجات؟ ثم اكتب نص الزر لكل منتج.'}
              {step === 4 && 'معاينة نهائية ثم إنشاء العائلة.'}
            </DialogDescription>
            <div className="flex items-center justify-center gap-1 pt-3 flex-wrap">
              {([1, 2, 3, 4] as const).map((s) => (
                <div key={s} className="flex items-center gap-1">
                  <div
                    className={cn(
                      'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      step === s
                        ? 'bg-primary text-primary-foreground ring-2 ring-primary/30'
                        : step > s
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                    )}
                  >
                    {step > s ? '✓' : s}
                  </div>
                  <span
                    className={cn(
                      'hidden md:inline text-[10px] font-medium max-w-[72px] leading-tight',
                      step === s ? 'text-slate-900' : 'text-slate-400'
                    )}
                  >
                    {stepLabels[s - 1]}
                  </span>
                  {s < 4 && <ChevronLeft className="h-3 w-3 text-slate-300 hidden sm:block" />}
                </div>
              ))}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
            {step === 1 && (
              <div className="space-y-4 max-w-lg mx-auto">
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-3 text-xs text-indigo-900 leading-relaxed">
                  الخطوة ١ من ٤ — يمكنك تعديل الاسم والخيارات لاحقاً من «تعديل العائلة» في جدول المنتجات.
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
                  <div className="grid gap-2">
                    <Label htmlFor="fam-name-ar">
                      اسم العائلة بالعربية <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="fam-name-ar"
                      value={nameAr}
                      onChange={(e) => setNameAr(e.target.value)}
                      placeholder="مثال: خط كاشير سوبر ماركت"
                    />
                  </div>
                  <details className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-3">
                    <summary className="cursor-pointer text-sm font-medium text-slate-700">
                      اسم إنجليزي (اختياري)
                    </summary>
                    <p className="mt-2 text-xs text-slate-500">
                      إن تُرك فارغاً يُنسخ الاسم العربي تلقائياً عند الإنشاء.
                    </p>
                    <Input
                      id="fam-name-en"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Optional English"
                      className="mt-2 text-left"
                      dir="ltr"
                    />
                  </details>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <div className="sticky top-0 z-10 -mx-2 px-2 py-2 bg-white/95 backdrop-blur border-b border-slate-100 space-y-3">
                  <Input
                    placeholder="بحث بالاسم أو الكود..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-10"
                  />
                  <div className="flex flex-wrap gap-2 items-center">
                    {categories.length > 0 && (
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger className="w-[200px] h-9">
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
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'nameAr' | 'sku')}>
                      <SelectTrigger className="w-[160px] h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nameAr">ترتيب بالاسم</SelectItem>
                        <SelectItem value="sku">ترتيب بالكود</SelectItem>
                      </SelectContent>
                    </Select>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={showAllProducts} onCheckedChange={(c) => setShowAllProducts(c === true)} />
                      إظهار كل المنتجات (للنقل من عائلة)
                    </label>
                  </div>
                  <p className="text-sm text-slate-600">
                    محدد: <span className="font-bold text-primary">{selected.size}</span> من {MAX_MEMBERS} — المعروض{' '}
                    {filteredPicker.length}
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 max-h-[min(48vh,400px)] overflow-y-auto pr-1">
                  {filteredPicker.length === 0 ? (
                    <p className="text-sm text-slate-500 col-span-full text-center py-8">لا توجد نتائج.</p>
                  ) : (
                    filteredPicker.map((p) => {
                      const checked = selected.has(p._id);
                      const merged = !!p.productFamilyId;
                      return (
                        <div
                          key={p._id}
                          role="button"
                          tabIndex={0}
                          onClick={() => toggle(p)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              toggle(p);
                            }
                          }}
                          className={cn(
                            'flex gap-3 rounded-xl border p-3 text-right transition-all outline-none cursor-pointer',
                            checked
                              ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                              : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50',
                            merged && !checked && 'border-amber-200 bg-amber-50/30'
                          )}
                        >
                          <div className="flex h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                            {p.image ? (
                              <img
                                src={optimizeImage(p.image, { w: 128 })}
                                alt=""
                                className="h-full w-full object-cover"
                                onError={applyProductImageFallback}
                              />
                            ) : (
                              <Package className="m-auto h-6 w-6 text-slate-400" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div
                                className="shrink-0 pt-0.5"
                                onClick={(e) => e.stopPropagation()}
                                onKeyDown={(e) => e.stopPropagation()}
                              >
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={() => toggle(p)}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-900 line-clamp-2">
                                  {p.nameAr || p.name}
                                </p>
                                {p.sku ? (
                                  <p className="text-xs font-mono text-slate-500 mt-1">{p.sku}</p>
                                ) : null}
                                {merged ? (
                                  <span className="text-[10px] text-amber-800 mt-1 inline-block rounded bg-amber-100 px-1.5">
                                    في عائلة — انقر للنقل (تأكيد)
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-4">
                <div className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-sm text-slate-800">
                  <p className="font-semibold text-slate-900">الخطوة ٣ — ما الذي يختلف بين المنتجات؟</p>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">
                    اختر اسماً جاهزاً أو اكتب اسماً خاصاً، ثم املأ الجدول: كل خلية = النص على زر ذلك المنتج في المتجر.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-bold text-slate-800">أنواع التمييز</span>
                  <Button type="button" variant="outline" size="sm" onClick={addOption}>
                    <Plus className="ml-1 h-3 w-3" />
                    إضافة تمييز
                  </Button>
                </div>
                <div className="space-y-3">
                  {options.map((opt, idx) => (
                    <div
                      key={opt.key}
                      className="rounded-xl border border-slate-200 bg-slate-50/70 p-3 shadow-sm space-y-2"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-sm font-bold text-slate-800">{optionColumnTitle(opt, idx)}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-red-600 hover:bg-red-50"
                          onClick={() => removeOption(idx)}
                          disabled={options.length <= 1}
                        >
                          <Trash2 className="h-4 w-4" />
                          حذف
                        </Button>
                      </div>
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
                      <div className="grid gap-1.5">
                        <Label htmlFor={`merge-opt-${opt.key}`} className="text-sm font-medium">
                          اسم التمييز
                        </Label>
                        <Input
                          id={`merge-opt-${opt.key}`}
                          className="h-10 bg-white"
                          value={opt.labelAr}
                          onChange={(e) =>
                            setOptions((prev) =>
                              prev.map((o, i) => (i === idx ? { ...o, labelAr: e.target.value } : o))
                            )
                          }
                          placeholder="مثال: المقاس، اللون…"
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-xs font-semibold text-slate-800 mb-2 border-b border-slate-200 pb-2">
                    نص الزر لكل منتج (ما يراه الزائر)
                  </p>
                  <div className="overflow-x-auto max-h-[min(40vh,320px)]">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-white">
                          <th className="p-2 text-right">منتج</th>
                          {options.map((o, i) => (
                            <th key={o.key} className="p-2 text-right whitespace-nowrap">
                              {optionColumnTitle(o, i)}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedMembers.map((p) => (
                          <tr key={p._id} className="border-b last:border-0 bg-white/80">
                            <td className="p-2 align-top max-w-[120px] line-clamp-2">{p.nameAr || p.name}</td>
                            {options.map((o) => (
                              <td key={o.key} className="p-1">
                                <Input
                                  className="h-9 text-xs"
                                  placeholder="مثال: ١٫٢٥ م"
                                  value={(valuesByProduct[p._id] || {})[o.key] || ''}
                                  onChange={(e) => setVal(p._id, o.key, e.target.value)}
                                />
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-5">
                <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 shadow-sm">
                  <p className="text-xs text-slate-500 mb-1">اسم العائلة</p>
                  <p className="font-bold text-lg text-slate-900">{nameAr}</p>
                  {name.trim() && name.trim() !== nameAr.trim() ? (
                    <p className="text-sm text-slate-500 mt-0.5" dir="ltr">
                      {name}
                    </p>
                  ) : null}
                  <p className="text-xs text-slate-500 mt-3">{selected.size} منتجات</p>
                  {needsTransfer ? (
                    <p className="text-xs text-amber-800 mt-2 rounded bg-amber-50 px-2 py-1 border border-amber-100">
                      سيتم نقل منتجات من عائلات أخرى إلى هذه العائلة عند الإنشاء.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-2">
                  <Label>الخيار الافتراضي</Label>
                  <Select value={defaultProductId} onValueChange={setDefaultProductId}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر المنتج الافتراضي" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedMembers.map((p) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.nameAr || p.name}
                          {p.sku ? ` — ${p.sku}` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-600 mb-2">معاينة الأزرار</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedMembers.map((p) => {
                      const lbl = labelPreview(valuesByProduct[p._id] || {}, options, p.nameAr || '', p.name);
                      const isDef = p._id === defaultProductId;
                      return (
                        <span
                          key={p._id}
                          className={cn(
                            'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs',
                            isDef ? 'border-primary bg-primary text-primary-foreground' : 'bg-white'
                          )}
                        >
                          {p.image ? (
                            <img
                              src={optimizeImage(p.image, { w: 48 })}
                              alt=""
                              className="h-6 w-6 rounded object-cover"
                              onError={applyProductImageFallback}
                            />
                          ) : null}
                          <span className="truncate max-w-[140px]">{lbl}</span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="px-6 py-4 border-t border-slate-100 shrink-0 flex-row-reverse flex-wrap gap-2 sm:justify-between">
            <div className="flex gap-2 flex-wrap">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep((s) => (s === 4 ? 3 : s === 3 ? 2 : 1))}
                  disabled={busy}
                  className="gap-1"
                >
                  <ChevronRight className="h-4 w-4" />
                  رجوع
                </Button>
              )}
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
                إلغاء
              </Button>
            </div>
            <div className="flex gap-2">
              {step === 1 && (
                <Button type="button" onClick={goNextFromStep1} className="gap-1">
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 2 && (
                <Button type="button" onClick={goNextFromStep2} className="gap-1">
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 3 && (
                <Button type="button" onClick={goNextFromStep3} className="gap-1">
                  التالي
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              )}
              {step === 4 && (
                <Button type="button" onClick={handleSubmit} disabled={busy}>
                  {busy ? 'جارٍ الإنشاء...' : 'إنشاء العائلة'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!transferPick} onOpenChange={(o) => !o && setTransferPick(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>نقل المنتج إلى عائلة جديدة؟</AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              «{transferPick?.nameAr || transferPick?.name}» مرتبط بعائلة حالية. عند الإنشاء سيتم إزالته من العائلة
              السابقة (وقد تُفسخ إن بقي أقل من منتجين) ثم إضافته للعائلة الجديدة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={confirmTransferAdd}>إضافة مع النقل</AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
