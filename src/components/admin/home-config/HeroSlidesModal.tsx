import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Plus, Sliders, Trash2, Images, Search, X, LayoutDashboard, Hash, Edit2, Zap, Target, ExternalLink, FileText, Save, Type, Lightbulb, Award, Palette, Info } from 'lucide-react';
import type { HomeConfig, Slide } from '@/types/home-config';
import { SelectionModal } from '@/components/admin/home-config/SelectionModal';
import { apiGet, apiPutJson } from '@/lib/api';
import BackgroundPattern from '@/components/home/BackgroundPattern';

interface HeroSlidesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  setCfg: (cfg: HomeConfig) => void;
  errors: { slides: Record<number, string[]>; promo: string[]; seo: string[] };
  updateSlide: (idx: number, patch: Partial<Slide>) => void;
  addSlide: () => void;
  removeSlide: (idx: number) => void;
}

export const HeroSlidesModal: React.FC<HeroSlidesModalProps> = ({
  open,
  onOpenChange,
  cfg,
  setCfg,
  errors,
  updateSlide,
  addSlide,
  removeSlide
}) => {
  // Preview mode: 'desktop' | 'mobile'
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  // Collapsed slides set
  const STORAGE_KEY = 'hero_slides_collapsed_idx';
  const [collapsed, setCollapsed] = useState<Set<number>>(() => {
    // Initialize synchronously to avoid flicker before useEffect runs
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return new Set();
      const arr: unknown = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const nums = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n));
        return new Set(nums);
      }
    } catch {
      // ignore
    }
    return new Set();
  });
  // Also refresh when the modal is opened (in case storage changed elsewhere)
  useEffect(() => {
    if (!open) return;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const arr: unknown = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const nums = arr.map((x) => Number(x)).filter((n) => Number.isFinite(n));
        setCollapsed(new Set(nums));
      }
    } catch {
      // ignore
    }
  }, [open]);

  // Defer animations until after first paint to avoid initial content flash
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    if (!open) return;
    const t = requestAnimationFrame(() => setHydrated(true));
    return () => {
      cancelAnimationFrame(t);
      setHydrated(false);
    };
  }, [open]);
  const persistCollapsed = (setVal: Set<number>) => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(setVal)));
    } catch {
      // ignore
    }
  };
  // Ensure collapsed indices are valid when slides length changes
  useEffect(() => {
    const max = Math.max(0, (cfg.slides?.length || 0) - 1);
    setCollapsed((prev) => {
      const filtered = new Set(Array.from(prev).filter((i) => i >= 0 && i <= max));
      if (filtered.size !== prev.size) persistCollapsed(filtered);
      return filtered;
    });
  }, [cfg.slides?.length]);
  const toggleCollapse = (i: number) => {
    setCollapsed((prev) => {
      const next = new Set(Array.from(prev));
      if (next.has(i)) next.delete(i); else next.add(i);
      persistCollapsed(next);
      return next;
    });
  };
  // Pattern options with mini previews
  const patternOptions = useMemo(() => ([
    {
      key: 'grid', label: 'Grid', preview: (
        <div className="w-full h-12 relative overflow-hidden rounded-md">
          <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/30 via-purple-500/30 to-pink-500/30" />
          <div className="absolute inset-0 opacity-30" style={{ backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.45) 1px, transparent 1px), linear-gradient(0deg, rgba(255,255,255,0.45) 1px, transparent 1px)', backgroundSize: '10px 10px' }} />
        </div>
      )
    },
    {
      key: 'circles', label: 'Circles', preview: (
        <div className="w-full h-12 relative overflow-hidden rounded-md">
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/25 via-teal-500/25 to-cyan-500/25" />
          {[...Array(4)].map((_, i) => (<div key={i} className="absolute rounded-full border border-white/50" style={{ left: `${10 + i * 20}%`, top: `${20 + (i % 2) * 30}%`, width: 20 + i * 8, height: 20 + i * 8 }} />))}
        </div>
      )
    },
    {
      key: 'waves', label: 'Waves', preview: (
        <div className="w-full h-12 relative overflow-hidden rounded-md">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/25 via-cyan-500/25 to-sky-500/25" />
          <svg viewBox="0 0 100 24" className="absolute inset-0 w-full h-full opacity-70"><path d="M0,12 Q12,8 25,12 T50,12 T75,12 T100,12" fill="none" stroke="white" strokeWidth="1" /></svg>
        </div>
      )
    },
    {
      key: 'dots', label: 'Dots', preview: (
        <div className="w-full h-12 relative overflow-hidden rounded-md">
          <div className="absolute inset-0 bg-gradient-to-br from-fuchsia-500/20 via-pink-500/20 to-rose-500/20" />
          <svg viewBox="0 0 100 24" className="absolute inset-0 w-full h-full opacity-60">
            <defs>
              <pattern id="mini-dots" width="4" height="4" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="0.6" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mini-dots)" />
          </svg>
        </div>
      )
    },
    {
      key: 'diagonals', label: 'Diagonals', preview: (
        <div className="w-full h-12 relative overflow-hidden rounded-md">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/20 via-orange-500/20 to-yellow-500/20" />
          <svg viewBox="0 0 100 24" className="absolute inset-0 w-full h-full opacity-60">
            <defs>
              <pattern id="mini-diag" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="6" stroke="white" strokeWidth="0.6" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#mini-diag)" />
          </svg>
        </div>
      )
    },
    {
      key: 'custom', label: 'Custom', preview: (
        <div className="w-full h-12 rounded-md bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600" />
      )
    },
  ]), []);

  // Per-slide product picker state
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; label: string; image?: string }>>([]);
  const [pickerVisibleCount, setPickerVisibleCount] = useState(10);

  // Cache for selected product previews across slides (to show thumbnails in main modal)
  const [productPreviewMap, setProductPreviewMap] = useState<Record<string, { label: string; image?: string }>>({});
  useEffect(() => {
    // collect all selected productIds from all slides
    const ids = Array.from(new Set((cfg.slides || []).flatMap(s => (s.productIds || []) as string[]))).filter(Boolean);
    if (ids.length === 0) { setProductPreviewMap({}); return; }
    void (async () => {
      try {
        const fields = 'name,image,images';
        const res = await fetch(`/api/products?ids=${encodeURIComponent(ids.join(','))}&fields=${encodeURIComponent(fields)}`);
        const json = await res.json();
        interface APIProduct { _id?: string; id?: string; name?: string; image?: string; images?: string[] }
        const payload = json as { ok?: boolean; items?: APIProduct[] };
        if (payload && payload.ok) {
          const map: Record<string, { label: string; image?: string }>
            = (payload.items || []).reduce((acc, p) => {
              const id = String(p._id || p.id || '');
              if (!id) return acc;
              acc[id] = { label: p.name || id, image: p.image || (Array.isArray(p.images) ? p.images[0] : undefined) };
              return acc;
            }, {} as Record<string, { label: string; image?: string }>);
          setProductPreviewMap(map);
        }
      } catch {
        // silent
      }
    })();
  }, [cfg.slides]);

  // Smart suggestions (Arabic popular phrases)
  const titleSuggestions = [
    'أحدث التقنيات في متناول يدك',
    'عروض حصرية لفترة محدودة',
    'جودة عالية وضمان شامل',
    'منتجات جديدة وصلت',
  ];
  const subtitleSuggestions = [
    'اكتشف مجموعة واسعة من الأجهزة الذكية بأفضل الأسعار',
    'خصومات تصل إلى 70% على مختارات مميزة',
    'منتجات أصلية من أفضل العلامات التجارية العالمية',
    'تشكيلة جديدة وصلت للتو — تسوق الآن',
  ];
  const badgeSuggestions = ['جديد', 'عرض محدود', 'خصم 50%', 'شحن مجاني', 'ضمان شامل'];

  const [openSuggestFor, setOpenSuggestFor] = useState<string | null>(null);
  // Click-outside to close suggestion popovers
  useEffect(() => {
    if (!openSuggestFor) return;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      const attr = target.closest('[data-suggest="1"]');
      if (!attr) setOpenSuggestFor(null);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [openSuggestFor]);

  // Categories quick-pick for buttonLink
  const [categories, setCategories] = useState<Array<{ id: string; label: string }>>([]);
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        type Category = { slug: string; name?: string };
        const res = await apiGet<Category>('/api/categories?page=1&limit=300');
        if (res.ok && mounted) {
          const arr: Array<{ id: string; label: string }> = (res.items || []).map((c: Category) => ({ id: c.slug, label: c.name || c.slug }));
          setCategories(arr);
        }
      } catch {
        // silent
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Save a single slide by persisting the whole slides array and then collapsing this slide
  const [savingSlideIdx, setSavingSlideIdx] = useState<number | null>(null);
  const saveSlide = useCallback(async (idx: number) => {
    try {
      setSavingSlideIdx(idx);
      // Persist only slides along with heroEnabled to avoid accidental resets
      const body = { slides: cfg.slides, heroEnabled: cfg.heroEnabled } as Partial<HomeConfig>;
      const headers = typeof window !== 'undefined' ? { 'x-admin-secret': localStorage.getItem('ADMIN_SECRET') || '' } : undefined;
      const res = await apiPutJson<HomeConfig, Partial<HomeConfig>>('/api/home-config', body, headers);
      if (!res.ok) {
        const r = res as { ok: false; error: string };
        throw new Error(r.error || 'failed');
      }
      setCfg(res.item as HomeConfig);
      // collapse this slide
      setCollapsed((prev) => {
        const next = new Set(Array.from(prev).concat([idx]));
        persistCollapsed(next);
        return next;
      });
    } catch {
      // silent fail; parent page has main Save with toasts
    } finally {
      setSavingSlideIdx(null);
    }
  }, [cfg, setCfg]);

  const pickerSelected = useMemo(() => {
    if (pickerOpenIdx === null) return [] as string[];
    const s = cfg.slides[pickerOpenIdx];
    return (s?.productIds || []) as string[];
  }, [cfg.slides, pickerOpenIdx]);

  const setPickerSelected = useCallback((ids: string[]) => {
    if (pickerOpenIdx === null) return;
    const s = cfg.slides[pickerOpenIdx];
    if (!s) return;
    const slides = [...cfg.slides];
    slides[pickerOpenIdx] = { ...s, productIds: ids } as Slide;
    setCfg({ ...cfg, slides });
  }, [cfg, pickerOpenIdx, setCfg]);

  const togglePick = (id: string) => {
    const current = pickerSelected;
    const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    setPickerSelected(next);
  };

  const fetchPicker = useCallback(async () => {
    try {
      setPickerLoading(true);
      type Product = { _id?: string; id?: string; name?: string; title?: string; slug?: string; image?: string; images?: string[]; thumbnail?: string };
      const res = await apiGet<Product>(`/api/products?search=${encodeURIComponent(pickerSearch || '')}`);
      if (res.ok === false) throw new Error(res.error);
      const list: Product[] = res.items ?? [];
      const mapped = list.map((p) => ({ id: (p._id || p.id || '') as string, label: p.name || p.title || p.slug || '', image: p.image || (p.images && p.images[0]) || p.thumbnail }));
      setPickerResults(mapped);
    } catch (e) {
      // silent
    } finally {
      setPickerLoading(false);
    }
  }, [pickerSearch]);

  useEffect(() => {
    if (pickerOpenIdx === null) return;
    const t = setTimeout(fetchPicker, 300);
    return () => clearTimeout(t);
  }, [pickerOpenIdx, pickerSearch, fetchPicker]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto bg-gradient-to-br from-slate-50 via-white to-primary/5">
        {/* Enhanced Header */}
        <DialogHeader className="border-b border-slate-200/60 pb-8 mb-8 bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/10 -mx-6 -mt-6 px-8 pt-8 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              {/* Icon Section */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-xl opacity-30 animate-pulse" />
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-lg opacity-20" />
                <div className="relative p-4 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-xl ring-4 ring-primary/10">
                  <Sliders className="w-9 h-9 text-white" />
                </div>
              </div>

              {/* Title and Description */}
              <div className="space-y-2">
                <DialogTitle className="text-3xl font-bold text-slate-900 mb-1 flex items-center gap-3">
                  إدارة الشرائح التفاعلية
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                    <div className="w-2 h-2 bg-secondary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                    <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                  </div>
                </DialogTitle>
                <DialogDescription className="text-lg text-slate-600 font-medium leading-relaxed max-w-2xl">
                  إنشاء وتخصيص شرائح الهيرو الجذابة للصفحة الرئيسية مع معاينة فورية وتحكم كامل
                </DialogDescription>
              </div>
            </div>

            {/* Stats */}
            <div className="flex items-center gap-4">
              {/* Enhanced Stats */}
              <div className="flex items-center gap-3 px-6 py-3 bg-white/70 backdrop-blur-sm rounded-2xl border border-slate-200/50 shadow-lg">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-primary/10 rounded-xl">
                    <Target className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-medium">إجمالي الشرائح</div>
                    <div className="text-lg font-bold text-slate-900">{cfg.slides.length}</div>
                  </div>
                </div>
                <div className="w-px h-8 bg-slate-200" />
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-green-100 rounded-xl">
                    <Zap className="w-4 h-4 text-green-600" />
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-500 font-medium">مفعلة</div>
                    <div className="text-lg font-bold text-green-700">{cfg.slides.filter(s => s.enabled).length}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Enhanced Status Indicators */}
          <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200/50">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-slate-700">حالة الشرائح:</span>
                <div className="flex items-center gap-3">
                  <Badge className="bg-gradient-to-r from-primary/5 to-secondary/5 text-primary border-primary/20 px-4 py-2 text-sm font-semibold shadow-sm">
                    <span className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      {cfg.slides.length} شريحة إجمالي
                    </span>
                  </Badge>
                  <Badge className={`px-4 py-2 text-sm font-semibold shadow-sm ${cfg.slides.filter(s => s.enabled).length > 0
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 text-green-800 border-green-200'
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 text-gray-700 border-gray-200'
                    }`}>
                    <span className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${cfg.slides.filter(s => s.enabled).length > 0 ? 'bg-green-600 animate-pulse' : 'bg-gray-500'
                        }`} />
                      {cfg.slides.filter(s => s.enabled).length} مفعلة
                    </span>
                  </Badge>
                  {cfg.slides.length === 0 && (
                    <Badge className="bg-gradient-to-r from-amber-50 to-orange-50 text-amber-800 border-amber-200 px-4 py-2 text-sm font-semibold shadow-sm">
                      <span className="flex items-center gap-2">
                        <AlertTriangle className="w-3 h-3" />
                        بحاجة لشرائح
                      </span>
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Indicator */}
            {cfg.slides.length > 0 && (
              <div className="flex items-center gap-2 px-4 py-2 bg-white/50 rounded-xl border border-slate-200/50">
                <div className={`w-2 h-2 rounded-full ${cfg.slides.filter(s => s.enabled).length > 0 ? 'bg-green-500' : 'bg-amber-500'
                  } animate-pulse`} />
                <span className="text-sm text-slate-600 font-medium">
                  {cfg.slides.filter(s => s.enabled).length > 0 ? 'جاهز للعرض' : 'بحاجة لتفعيل'}
                </span>
              </div>
            )}
          </div>
        </DialogHeader>

        <div className="space-y-10">
          {/* Enhanced Action Controls Section */}
          <div className="bg-gradient-to-r from-slate-50/80 via-blue-50/50 to-indigo-50/30 p-8 rounded-3xl border border-slate-200/60 shadow-lg backdrop-blur-sm">
            <div className="flex items-center justify-between">
              {/* Preview Mode Selector */}
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-slate-200/50">
                    <LayoutDashboard className="w-5 h-5 text-slate-600" />
                  </div>
                  <span className="text-base font-semibold text-slate-700">عرض المعاينة:</span>
                </div>
                <div className="flex items-center rounded-2xl border border-slate-300/70 overflow-hidden shadow-lg bg-white backdrop-blur-sm">
                  <button
                    type="button"
                    className={`px-6 py-3 text-sm font-semibold transition-all duration-300 flex items-center gap-3 ${previewMode === 'desktop'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                        : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    onClick={() => setPreviewMode('desktop')}
                  >
                    <LayoutDashboard className="w-4 h-4" />
                    <span>سطح المكتب</span>
                    {previewMode === 'desktop' && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                  </button>
                  <button
                    type="button"
                    className={`px-6 py-3 text-sm font-semibold transition-all duration-300 flex items-center gap-3 ${previewMode === 'mobile'
                        ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                        : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                      }`}
                    onClick={() => setPreviewMode('mobile')}
                  >
                    <Hash className="w-4 h-4" />
                    <span>الجوال</span>
                    {previewMode === 'mobile' && <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />}
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-4">
                {/* Add New Slide */}
                <Button
                  onClick={addSlide}
                  className="gap-3 bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 hover:from-green-700 hover:via-emerald-700 hover:to-teal-700 text-white shadow-xl hover:shadow-2xl transition-all duration-300 px-8 py-4 rounded-2xl font-semibold text-base transform hover:scale-105 active:scale-95"
                >
                  <div className="relative">
                    <Plus className="w-5 h-5" />
                    <div className="absolute inset-0 bg-white/30 rounded-full animate-ping" />
                  </div>
                  إضافة شريحة جديدة
                </Button>
              </div>
            </div>

            {/* Preview Info */}
            <div className="flex items-center justify-between mt-6 pt-6 border-t border-slate-200/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-white/60 rounded-xl border border-slate-200/50">
                  <div className={`w-2 h-2 rounded-full ${previewMode === 'desktop' ? 'bg-primary' : 'bg-purple-500'
                    } animate-pulse`} />
                  <span className="text-sm text-slate-600 font-medium">
                    معاينة {previewMode === 'desktop' ? 'سطح المكتب' : 'الجوال'}
                  </span>
                </div>
                {cfg.slides.length > 0 && (
                  <div className="text-sm text-slate-500">
                    يمكنك مشاهدة التغييرات فورياً في المعاينة أدناه
                  </div>
                )}
              </div>

              {cfg.slides.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-slate-500">
                  <span>عدد الشرائح المفعلة:</span>
                  <Badge className="bg-green-100 text-green-700 font-semibold">
                    {cfg.slides.filter(s => s.enabled).length} / {cfg.slides.length}
                  </Badge>
                </div>
              )}
            </div>
          </div>

          {/* Enhanced Empty State */}
          {cfg.slides.length === 0 && (
            <div className="relative">
              {/* Background Pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-amber-50/50 via-orange-50/30 to-red-50/20 rounded-3xl" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_40%,rgba(251,146,60,0.1),transparent_70%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(249,115,22,0.08),transparent_60%)]" />

              {/* Content */}
              <div className="relative border-2 border-dashed border-amber-300/70 rounded-3xl p-16 text-center bg-gradient-to-br from-amber-50/80 via-orange-50/50 to-red-50/30 backdrop-blur-sm">
                <div className="flex flex-col items-center gap-8 max-w-2xl mx-auto">
                  {/* Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-400/30 to-orange-500/30 rounded-full blur-2xl animate-pulse" />
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-300/20 to-orange-400/20 rounded-full blur-xl" />
                    <div className="relative p-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-2xl ring-4 ring-amber-100/50">
                      <Images className="w-16 h-16 text-white" />
                    </div>
                    {/* Floating particles */}
                    <div className="absolute -top-2 -right-2 w-4 h-4 bg-amber-300 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                    <div className="absolute -bottom-1 -left-1 w-3 h-3 bg-orange-400 rounded-full animate-bounce" style={{ animationDelay: '0.5s' }} />
                    <div className="absolute top-1/2 -right-4 w-2 h-2 bg-red-300 rounded-full animate-bounce" style={{ animationDelay: '1s' }} />
                  </div>

                  {/* Content */}
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <h4 className="text-3xl font-bold text-amber-900 leading-tight">
                        لا توجد شرائح محفوظة بعد
                      </h4>
                      <p className="text-lg text-amber-800 leading-relaxed font-medium">
                        ابدأ بإنشاء شريحتك الأولى لعرض محتوى جذاب وتفاعلي في الصفحة الرئيسية
                      </p>
                    </div>

                    {/* Features List */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                      <div className="flex items-center gap-3 p-4 bg-white/60 rounded-2xl border border-amber-200/50 backdrop-blur-sm">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <Edit2 className="w-5 h-5 text-primary" />
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-800">تخصيص سهل</div>
                          <div className="text-sm text-slate-600">محرر متقدم</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-white/60 rounded-2xl border border-amber-200/50 backdrop-blur-sm">
                        <div className="p-2 bg-green-100 rounded-xl">
                          <Target className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-800">معاينة فورية</div>
                          <div className="text-sm text-slate-600">شاهد النتيجة</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 p-4 bg-white/60 rounded-2xl border border-amber-200/50 backdrop-blur-sm">
                        <div className="p-2 bg-purple-100 rounded-xl">
                          <Zap className="w-5 h-5 text-purple-600" />
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-slate-800">تفاعل حي</div>
                          <div className="text-sm text-slate-600">تأثيرات متقدمة</div>
                        </div>
                      </div>
                    </div>

                    {/* CTA Buttons */}
                    <div className="flex items-center justify-center gap-4 mt-10">
                      <Button
                        onClick={addSlide}
                        className="gap-3 bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 hover:from-amber-700 hover:via-orange-700 hover:to-red-700 text-white shadow-2xl hover:shadow-3xl transition-all duration-300 px-10 py-4 rounded-2xl font-bold text-lg transform hover:scale-105 active:scale-95"
                      >
                        <div className="relative">
                          <Plus className="w-6 h-6" />
                          <div className="absolute inset-0 bg-white/40 rounded-full animate-ping" />
                        </div>
                        إضافة أول شريحة
                      </Button>
                      <Button
                        variant="outline"
                        className="gap-2 border-2 border-amber-300 text-amber-700 hover:bg-amber-50 hover:border-amber-400 px-6 py-4 rounded-2xl font-semibold text-base backdrop-blur-sm bg-white/50"
                        onClick={() => {
                          // Could trigger a demo/tutorial mode
                        }}
                      >
                        <Target className="w-5 h-5" />
                        مشاهدة مثال
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Enhanced Individual Slides */}
          {cfg.slides.map((s, idx) => {
            const isCollapsed = collapsed.has(idx);
            const isEnabled = s.enabled;
            const isSaving = savingSlideIdx === idx;

            return (
              <Card
                key={idx}
                className={`transition-all duration-500 ease-out ${isCollapsed
                    ? 'bg-gradient-to-r from-slate-50/80 to-primary/5 border-slate-200/60 shadow-md'
                    : 'bg-gradient-to-br from-white via-primary/5 to-secondary/5 border-primary/20 shadow-xl'
                  } ${isEnabled ? 'ring-2 ring-green-200/50' : 'ring-2 ring-gray-200/30'} overflow-hidden`}
              >
                {/* Enhanced Slide Header */}
                <div className={`transition-all duration-300 ${isCollapsed ? 'p-6' : 'p-6 border-b border-slate-200/50 bg-gradient-to-r from-slate-50/50 to-primary/5'
                  }`}>
                  <div className="flex items-center justify-between">
                    {/* Slide Info Section */}
                    <button
                      type="button"
                      onClick={() => toggleCollapse(idx)}
                      className="flex items-center gap-4 text-left group transition-all duration-300 flex-1"
                    >
                      {/* Slide Number Badge */}
                      <div className={`relative transition-all duration-300 ${isCollapsed ? 'w-12 h-12' : 'w-14 h-14'
                        }`}>
                        <div className={`absolute inset-0 rounded-full transition-all duration-300 ${isEnabled
                            ? 'bg-gradient-to-br from-primary to-secondary shadow-lg'
                            : 'bg-gradient-to-br from-gray-400 to-gray-500 shadow-md'
                          } ${!isCollapsed ? 'animate-pulse' : ''}`} />
                        <div className="relative w-full h-full flex items-center justify-center">
                          <span className={`font-bold text-white transition-all duration-300 ${isCollapsed ? 'text-lg' : 'text-xl'
                            }`}>
                            {idx + 1}
                          </span>
                        </div>
                        {hydrated && !isCollapsed && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-ping" />
                        )}
                      </div>

                      {/* Slide Preview and Info */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        {/* Enhanced Preview Thumbnail */}
                        <div className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${isCollapsed ? 'w-24 h-16' : 'w-32 h-20'
                          } ${isEnabled ? 'border-primary/20 shadow-md' : 'border-gray-200 shadow-sm'}`}>
                          {/* Background */}
                          {s.bgColor && s.bgColor.trim() ? (
                            <div className="absolute inset-0" style={{ backgroundColor: s.bgColor }} />
                          ) : (
                            <div className={`absolute inset-0 bg-gradient-to-br ${s.bgGradient || 'from-indigo-600 via-purple-600 to-pink-600'
                              }`} />
                          )}

                          {/* Pattern Overlay */}
                          {hydrated && s.pattern !== 'custom' && (
                            <div className="absolute inset-0 opacity-20">
                              <BackgroundPattern
                                slideIndex={{ grid: 0, circles: 1, waves: 2, dots: 3, diagonals: 4 }[s.pattern || 'grid'] || 0}
                                isActive={true}
                              />
                            </div>
                          )}

                          {/* Content Preview */}
                          <div className="absolute inset-0 bg-black/20" />
                          <div className="relative z-10 p-2 h-full flex flex-col justify-center">
                            <div className={`text-white font-bold truncate transition-all duration-300 ${isCollapsed ? 'text-[10px]' : 'text-xs'
                              }`}>
                              {s.title || 'عنوان الشريحة'}
                            </div>
                            {!isCollapsed && (
                              <div className="text-[10px] text-white/80 truncate mt-0.5">
                                {s.subtitle || 'وصف مختصر'}
                              </div>
                            )}
                          </div>

                          {/* Disabled Overlay */}
                          {!isEnabled && (
                            <div className="absolute inset-0 bg-gray-500/70 flex items-center justify-center">
                              <div className="w-2 h-2 bg-white rounded-full" />
                            </div>
                          )}
                        </div>

                        {/* Slide Details */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className={`font-bold text-slate-900 truncate group-hover:text-primary transition-all duration-300 ${isCollapsed ? 'text-lg' : 'text-xl'
                              }`}>
                              {s.title?.trim() || `شريحة #${idx + 1}`}
                            </h4>
                            {!isCollapsed && (
                              <div className="flex items-center gap-2">
                                <Badge className={`px-2 py-1 text-xs font-semibold transition-all duration-200 ${isEnabled
                                    ? 'bg-green-100 text-green-700 border-green-200'
                                    : 'bg-gray-100 text-gray-600 border-gray-200'
                                  }`}>
                                  {isEnabled ? 'مفعلة' : 'معطلة'}
                                </Badge>
                                {s.buttonText && (
                                  <Badge className="bg-primary/10 text-primary border-primary/20 px-2 py-1 text-xs">
                                    {s.buttonText}
                                  </Badge>
                                )}
                              </div>
                            )}
                          </div>

                          {!isCollapsed && (
                            <div className="space-y-2">
                              <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                                {s.subtitle || 'لا يوجد وصف متاح للشريحة'}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-500">
                                {s.buttonLink && (
                                  <span className="flex items-center gap-1">
                                    <ExternalLink className="w-3 h-3" />
                                    {s.buttonLink}
                                  </span>
                                )}
                                {(s.productIds || []).length > 0 && (
                                  <span className="flex items-center gap-1">
                                    <Target className="w-3 h-3" />
                                    {(s.productIds || []).length} منتج
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </button>

                    {/* Action Controls */}
                    <div className="flex items-center gap-3 ml-4">
                      {/* Status Toggle */}
                      <div className={`transition-all duration-300 flex items-center gap-2 ${isCollapsed ? 'transform scale-90' : 'transform scale-100'
                        }`}>
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={(val) => updateSlide(idx, { enabled: val })}
                          variant={s.enabled ? 'success' : 'default'}
                          size={isCollapsed ? 'sm' : 'default'}
                          className="transition-all duration-200"
                        />
                        {!isCollapsed && (
                          <span className={`text-xs font-medium transition-colors duration-200 ${s.enabled ? 'text-green-700' : 'text-slate-500'
                            }`}>
                            {s.enabled ? 'مفعل' : 'معطل'}
                          </span>
                        )}
                      </div>

                      {/* Edit/Collapse Button */}
                      <Button
                        size="sm"
                        variant={isCollapsed ? "default" : "outline"}
                        onClick={() => toggleCollapse(idx)}
                        className={`transition-all duration-300 gap-2 ${isCollapsed
                            ? 'bg-primary hover:bg-primary text-white shadow-md hover:shadow-lg'
                            : 'border-slate-300 hover:border-primary/30 hover:bg-primary/5'
                          }`}
                      >
                        <Edit2 className={`w-4 h-4 transition-transform duration-300 ${!isCollapsed ? 'rotate-45' : 'rotate-0'
                          }`} />
                        {isCollapsed ? 'تعديل' : 'طي'}
                      </Button>

                      {/* Delete Button */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSlide(idx)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-all duration-200 p-2"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Preview Strip (when collapsed) */}
                  {isCollapsed && (
                    <div className="mt-4 pt-4 border-t border-slate-200/50">
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-slate-500 font-medium">معاينة سريعة:</span>
                        <div className={`flex-1 h-2 rounded-full overflow-hidden ${s.bgColor ? '' : 'bg-gradient-to-r'
                          } ${s.bgColor ? '' : (s.bgGradient || 'from-indigo-600 via-purple-600 to-pink-600')}`}
                          style={s.bgColor ? { backgroundColor: s.bgColor } : undefined} />
                        <Badge className="bg-slate-100 text-slate-600 text-xs px-2 py-1">
                          {previewMode === 'desktop' ? '💻' : '📱'}
                        </Badge>
                      </div>
                    </div>
                  )}
                </div>

                {/* Live Preview Strip (when expanded) */}
                {!isCollapsed && (
                  <div className="px-6 pb-4">
                    <div className="rounded-xl overflow-hidden border-2 border-slate-200/50 shadow-inner">
                      <div className={`relative transition-all duration-500 ${previewMode === 'mobile' ? 'p-4 h-40' : 'p-8 h-56'
                        }`}>
                        {/* Background */}
                        {s.bgColor && s.bgColor.trim() ? (
                          <div className="absolute inset-0" style={{ backgroundColor: s.bgColor }} />
                        ) : (
                          <div className={`absolute inset-0 bg-gradient-to-br ${s.bgGradient || 'from-indigo-600 via-purple-600 to-pink-600'
                            }`} />
                        )}

                        {/* Pattern */}
                        {hydrated && s.pattern !== 'custom' && (
                          <BackgroundPattern
                            slideIndex={{ grid: 0, circles: 1, waves: 2, dots: 3, diagonals: 4 }[s.pattern || 'grid'] || 0}
                            isActive={true}
                          />
                        )}

                        <div className="absolute inset-0 bg-black/25" />

                        {/* Content */}
                        <div className="relative z-10 h-full flex flex-col justify-center">
                          <div className={`text-white font-bold transition-all duration-300 ${previewMode === 'mobile' ? 'text-lg' : 'text-3xl'
                            }`}>
                            {s.title || 'عنوان الشريحة'}
                          </div>
                          <div className={`text-white/90 mt-2 leading-relaxed transition-all duration-300 ${previewMode === 'mobile' ? 'text-sm' : 'text-lg'
                            }`}>
                            {s.subtitle || 'وصف مختصر للشريحة'}
                          </div>
                          {s.buttonText && (
                            <Button
                              className={`mt-4 bg-white/20 hover:bg-white/30 text-white border border-white/30 transition-all duration-200 ${previewMode === 'mobile' ? 'text-sm px-4 py-2' : 'text-base px-6 py-3'
                                }`}
                              variant="outline"
                            >
                              {s.buttonText}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Display */}
                {errors.slides[idx]?.length && (
                  <div className="mx-6 mb-4">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <AlertTriangle className="w-4 h-4 text-red-600" />
                        <span className="text-sm font-semibold text-red-800">يتطلب انتباه:</span>
                      </div>
                      <ul className="text-sm text-red-700 space-y-1">
                        {errors.slides[idx].map((er, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-red-500 mt-0.5">•</span>
                            <span>{er}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Enhanced Animated Collapse Container */}
                <div className={`${hydrated ? 'transition-all duration-700 ease-in-out' : ''} origin-top overflow-hidden ${collapsed.has(idx)
                    ? (hydrated ? 'max-h-0 opacity-0 scale-y-0 transform pointer-events-none' : 'max-h-0')
                    : (hydrated ? 'max-h-[2000px] opacity-100 scale-y-100 transform pointer-events-auto' : 'max-h-[2000px]')
                  }`}>
                  <div className="p-8 space-y-8 bg-gradient-to-br from-slate-50/50 via-white to-primary/5 border-t border-slate-200/50">
                    {/* Content Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-primary/10 rounded-xl">
                          <Type className="w-5 h-5 text-blue-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">محتوى الشريحة</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-blue-200 to-transparent" />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Title Field */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-blue-500 rounded-full" />
                            العنوان الرئيسي
                            <span className="text-red-500">*</span>
                          </Label>
                          <div className="relative group">
                            <Input
                              value={s.title}
                              onChange={(e) => updateSlide(idx, { title: e.target.value })}
                              placeholder="أدخل العنوان الجذاب للشريحة..."
                              className="pr-4 pl-28 py-4 text-lg font-medium border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 rounded-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                            />
                            <Button
                              data-suggest="1"
                              type="button"
                              variant="outline"
                              size="sm"
                              className="absolute left-2 top-1/2 -translate-y-1/2 border-blue-200 text-blue-600 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 px-4 py-2 text-sm font-medium"
                              onClick={() => setOpenSuggestFor(openSuggestFor === `title-${idx}` ? null : `title-${idx}`)}
                            >
                              <Lightbulb className="w-4 h-4 mr-1" />
                              اقتراحات
                            </Button>
                            {openSuggestFor === `title-${idx}` && (
                              <div data-suggest="1" className="absolute z-[100] left-0 top-full mt-3 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl w-full max-h-64 overflow-auto">
                                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-indigo-50">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-blue-600" />
                                    <span className="text-sm font-semibold text-slate-700">اقتراحات العناوين</span>
                                  </div>
                                </div>
                                <div className="p-2 space-y-1">
                                  {titleSuggestions.map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      className="w-full text-right px-4 py-3 rounded-xl hover:bg-blue-50 hover:text-blue-800 transition-all duration-200 border border-transparent hover:border-blue-200 font-medium"
                                      onClick={() => { updateSlide(idx, { title: t }); setOpenSuggestFor(null); }}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Subtitle Field */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full" />
                            العنوان الفرعي
                          </Label>
                          <div className="relative group">
                            <Textarea
                              value={s.subtitle}
                              onChange={(e) => updateSlide(idx, { subtitle: e.target.value })}
                              placeholder="أدخل الوصف التفصيلي أو العنوان الفرعي..."
                              rows={4}
                              className="pr-4 pl-28 py-4 text-base resize-none border-2 border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 rounded-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                            />
                            <Button
                              data-suggest="1"
                              type="button"
                              variant="outline"
                              size="sm"
                              className="absolute left-2 bottom-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:border-indigo-300 transition-all duration-200 px-4 py-2 text-sm font-medium"
                              onClick={() => setOpenSuggestFor(openSuggestFor === `subtitle-${idx}` ? null : `subtitle-${idx}`)}
                            >
                              <Lightbulb className="w-4 h-4 mr-1" />
                              اقتراحات
                            </Button>
                            {openSuggestFor === `subtitle-${idx}` && (
                              <div data-suggest="1" className="absolute z-[100] left-0 bottom-full mb-3 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl w-full max-h-64 overflow-auto">
                                <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-purple-50">
                                  <div className="flex items-center gap-2">
                                    <Lightbulb className="w-4 h-4 text-indigo-600" />
                                    <span className="text-sm font-semibold text-slate-700">اقتراحات الأوصاف</span>
                                  </div>
                                </div>
                                <div className="p-2 space-y-1">
                                  {subtitleSuggestions.map((t) => (
                                    <button
                                      key={t}
                                      type="button"
                                      className="w-full text-right px-4 py-3 rounded-xl hover:bg-indigo-50 hover:text-indigo-800 transition-all duration-200 border border-transparent hover:border-indigo-200 font-medium"
                                      onClick={() => { updateSlide(idx, { subtitle: t }); setOpenSuggestFor(null); }}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Call-to-Action Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-purple-100 rounded-xl">
                          <ExternalLink className="w-5 h-5 text-purple-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">رابط العمل</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-purple-200 to-transparent" />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Button Text */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-purple-500 rounded-full" />
                            نص الزر
                          </Label>
                          <Input
                            value={s.buttonText}
                            onChange={(e) => updateSlide(idx, { buttonText: e.target.value })}
                            placeholder="مثال: اشتري الآن / عرض التفاصيل"
                            className="px-4 py-3 text-base border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 rounded-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                          />
                        </div>

                        {/* Button Link */}
                        <div className="space-y-3">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-green-500 rounded-full" />
                            رابط الزر
                          </Label>
                          <div className="flex items-center gap-3">
                            <Input
                              value={s.buttonLink}
                              onChange={(e) => updateSlide(idx, { buttonLink: e.target.value })}
                              placeholder="/products أو https://example.com"
                              className="flex-1 px-4 py-3 text-base border-2 border-slate-200 focus:border-green-500 focus:ring-4 focus:ring-green-100 rounded-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                            />
                            <div className="relative">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="border-green-200 text-green-600 hover:bg-green-50 hover:border-green-300 transition-all duration-200 px-4 py-3 text-sm font-medium whitespace-nowrap"
                                onClick={() => setOpenSuggestFor(openSuggestFor === `cat-${idx}` ? null : `cat-${idx}`)}
                              >
                                <Target className="w-4 h-4 mr-1" />
                                من فئة
                              </Button>
                              {openSuggestFor === `cat-${idx}` && (
                                <div className="absolute z-[100] left-0 top-full mt-2 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl w-64 max-h-64 overflow-auto">
                                  <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-green-50 to-emerald-50">
                                    <div className="flex items-center gap-2">
                                      <Target className="w-4 h-4 text-green-600" />
                                      <span className="text-sm font-semibold text-slate-700">اختيار فئة</span>
                                    </div>
                                  </div>
                                  <div className="p-2 space-y-1">
                                    {categories.map((c) => (
                                      <button
                                        key={c.id}
                                        type="button"
                                        className="w-full text-right px-4 py-3 rounded-xl hover:bg-green-50 hover:text-green-800 transition-all duration-200 border border-transparent hover:border-green-200 font-medium"
                                        onClick={() => { updateSlide(idx, { buttonLink: `/category/${c.id}` }); setOpenSuggestFor(null); }}
                                      >
                                        {c.label}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Badge Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 rounded-xl">
                          <Award className="w-5 h-5 text-amber-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">شعار مميز</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-amber-200 to-transparent" />
                      </div>

                      <div className="space-y-3">
                        <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                          <span className="w-2 h-2 bg-amber-500 rounded-full" />
                          شعار (اختياري)
                        </Label>
                        <div className="relative group">
                          <Input
                            value={s.badge || ''}
                            onChange={(e) => updateSlide(idx, { badge: e.target.value })}
                            placeholder="مثال: عرض محدود • ضمان شامل • خصم 50%"
                            className="pr-4 pl-28 py-4 text-base border-2 border-slate-200 focus:border-amber-500 focus:ring-4 focus:ring-amber-100 rounded-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                          />
                          <Button
                            data-suggest="1"
                            type="button"
                            variant="outline"
                            size="sm"
                            className="absolute left-2 top-1/2 -translate-y-1/2 border-amber-200 text-amber-600 hover:bg-amber-50 hover:border-amber-300 transition-all duration-200 px-4 py-2 text-sm font-medium"
                            onClick={() => setOpenSuggestFor(openSuggestFor === `badge-${idx}` ? null : `badge-${idx}`)}
                          >
                            <Award className="w-4 h-4 mr-1" />
                            اقتراحات
                          </Button>
                          {openSuggestFor === `badge-${idx}` && (
                            <div data-suggest="1" className="absolute z-[100] left-0 top-full mt-3 bg-white border-2 border-slate-200 rounded-2xl shadow-2xl w-full max-h-64 overflow-auto">
                              <div className="p-3 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-orange-50">
                                <div className="flex items-center gap-2">
                                  <Award className="w-4 h-4 text-amber-600" />
                                  <span className="text-sm font-semibold text-slate-700">اقتراحات الشعارات</span>
                                </div>
                              </div>
                              <div className="p-2 grid grid-cols-2 gap-1">
                                {badgeSuggestions.map((t) => (
                                  <button
                                    key={t}
                                    type="button"
                                    className="text-right px-4 py-3 rounded-xl hover:bg-amber-50 hover:text-amber-800 transition-all duration-200 border border-transparent hover:border-amber-200 font-medium"
                                    onClick={() => { updateSlide(idx, { badge: t }); setOpenSuggestFor(null); }}
                                  >
                                    {t}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Background Design Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-pink-100 rounded-xl">
                          <Images className="w-5 h-5 text-pink-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">تصميم الخلفية</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-pink-200 to-transparent" />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Background Image URL */}
                        <div className="space-y-4">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-purple-500 rounded-full" />
                            رابط صورة الخلفية (اختياري)
                          </Label>
                          <Input
                            value={s.image || ''}
                            onChange={(e) => updateSlide(idx, { image: e.target.value })}
                            placeholder="https://example.com/image.jpg"
                            className="px-4 py-3 text-base border-2 border-slate-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-100 rounded-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                          />
                          <p className="text-xs text-slate-500">
                            اتركه فارغاً لاستخدام صورة المنتج الأول أو النمط المحدد أدناه.
                          </p>
                        </div>

                        {/* Background Pattern */}
                        <div className="space-y-4">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-pink-500 rounded-full" />
                            نمط الخلفية
                          </Label>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {patternOptions.map((opt) => (
                              <button
                                key={opt.key}
                                type="button"
                                aria-pressed={s.pattern === opt.key}
                                className={`border rounded-lg overflow-hidden text-xs focus:outline-none transition-all duration-300 ${s.pattern === opt.key
                                    ? 'ring-2 ring-pink-500 border-pink-500 bg-pink-50 scale-105'
                                    : 'border-slate-200 bg-white hover:bg-slate-50 hover:scale-105'
                                  }`}
                                onClick={() => updateSlide(idx, { pattern: opt.key as Slide['pattern'] })}
                              >
                                {opt.preview}
                                <div className="px-2 py-1 text-center">{opt.label}</div>
                              </button>
                            ))}
                          </div>

                          {s.pattern === 'custom' && (
                            <div className="mt-4 p-4 rounded-xl border-2 border-dashed border-pink-200 bg-pink-50/50">
                              <div className="flex items-center gap-2 mb-2">
                                <div className="p-1 bg-pink-100 rounded-lg">
                                  <Palette className="w-4 h-4 text-pink-600" />
                                </div>
                                <Label className="text-sm font-semibold text-pink-700">تدرج لوني مخصص</Label>
                              </div>
                              <Input
                                value={s.bgGradient || ''}
                                onChange={(e) => updateSlide(idx, { bgGradient: e.target.value })}
                                placeholder="from-indigo-900 via-purple-900 to-pink-900"
                                className="border-pink-200 focus:border-pink-400 focus:ring-pink-100"
                              />
                              <p className="mt-2 text-xs text-pink-600">
                                استخدم كلاسات Tailwind CSS للون مثل: from-indigo-600 via-purple-600 to-pink-600
                              </p>
                            </div>
                          )}
                        </div>

                        {/* Background Color */}
                        <div className="space-y-4">
                          <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                            <span className="w-2 h-2 bg-rose-500 rounded-full" />
                            لون الخلفية (اختياري)
                          </Label>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <input
                                  type="color"
                                  value={s.bgColor || '#000000'}
                                  onChange={(e) => updateSlide(idx, { bgColor: e.target.value })}
                                  className="h-10 w-12 rounded border border-slate-200"
                                  aria-label="لون الخلفية"
                                />
                                <Input
                                  value={s.bgColor || ''}
                                  onChange={(e) => updateSlide(idx, { bgColor: e.target.value })}
                                  placeholder="#0f172a (hex)"
                                  className="flex-1 border-slate-200 focus:border-rose-400 focus:ring-rose-100"
                                />
                              </div>
                              <p className="text-xs text-slate-500">
                                إذا تم اختيار لون خلفية، سيتم استخدامه كأساس بدلاً من التدرج.
                              </p>
                            </div>

                            <div className="col-span-1 sm:col-span-2">
                              <div className="p-4 rounded-xl border-2 border-dashed border-rose-200 bg-rose-50/50 h-full">
                                <div className="flex items-center gap-2 mb-3">
                                  <div className="p-1 bg-rose-100 rounded-lg">
                                    <Palette className="w-4 h-4 text-rose-600" />
                                  </div>
                                  <Label className="text-sm font-semibold text-rose-700">تدرجات مُعدة</Label>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                  {[
                                    'from-indigo-600 via-purple-600 to-pink-600',
                                    'from-red-600 via-orange-500 to-amber-500',
                                    'from-emerald-600 via-teal-600 to-cyan-600',
                                    'from-slate-800 via-slate-700 to-slate-900',
                                  ].map((g) => (
                                    <button
                                      key={g}
                                      type="button"
                                      className="h-12 w-24 rounded-md overflow-hidden border-2 border-transparent hover:border-rose-300 transition-all duration-200 relative"
                                      onClick={() => updateSlide(idx, { bgGradient: g })}
                                    >
                                      <div className={`w-full h-full bg-gradient-to-r ${g} rounded-md`} />
                                      <div className="relative w-full h-full flex items-center justify-center bg-white/20 opacity-0 hover:opacity-100 transition-opacity duration-200 rounded-md">
                                        <span className="text-white text-xs font-medium">{g.split(' ').slice(1, 3).join(' ')}</span>
                                      </div>
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Product Selection Section */}
                    <div className="space-y-6">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-2 bg-teal-100 rounded-xl">
                          <Target className="w-5 h-5 text-teal-600" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-900">المنتجات المرتبطة</h3>
                        <div className="flex-1 h-px bg-gradient-to-r from-teal-200 to-transparent" />
                      </div>

                      {/* Product Picker */}
                      <div className="space-y-4">
                        <Label className="flex items-center gap-2 text-base font-semibold text-slate-700">
                          <span className="w-2 h-2 bg-teal-500 rounded-full" />
                          المنتجات المتحركة لهذه الشريحة
                        </Label>
                        <div className="flex flex-col gap-4">
                          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap sm:overflow-x-auto">
                            {(s.productIds || []).length === 0 ? (
                              <span className="text-xs text-slate-500">لا توجد منتجات مختارة</span>
                            ) : (
                              (s.productIds || []).map((id) => {
                                const p = productPreviewMap[id];
                                return (
                                  <span
                                    key={id}
                                    className="inline-flex items-center gap-3 px-3 py-2 pr-2 rounded-full bg-slate-100 border border-slate-200 text-xs whitespace-nowrap transition-all duration-200 hover:shadow-md"
                                  >
                                    {p?.image ? (
                                      <div className="relative">
                                        <img
                                          src={p.image}
                                          alt=""
                                          className="w-6 h-6 rounded object-cover"
                                        />
                                      </div>
                                    ) : null}
                                    <span className="truncate max-w-[120px] font-medium">{p?.label || id}</span>
                                    <button
                                      className="ml-1 text-slate-500 hover:text-red-600 transition-colors duration-200"
                                      onClick={() => setPickerSelected((s.productIds || []).filter(pid => pid !== id))}
                                      aria-label="إزالة"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </span>
                                );
                              })
                            )}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => { setPickerOpenIdx(idx); setPickerVisibleCount(10); }}
                              className="gap-2 shrink-0 border-teal-200 text-teal-600 hover:bg-teal-50 hover:border-teal-300 transition-all duration-200"
                            >
                              <Search className="w-4 h-4" /> اختيار المنتجات لهذه الشريحة
                            </Button>
                          </div>

                          <div className="bg-gradient-to-r from-slate-50 to-teal-50/50 p-4 rounded-xl border border-slate-200/60">
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Info className="w-4 h-4 text-teal-500" />
                              <span>يمكنك اختيار ما يصل إلى 5 منتجات لعرضها مع هذه الشريحة.</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Section */}
                    <div className="mt-8 pt-6 border-t border-slate-200/50">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-primary/10 rounded-xl">
                            <Save className="w-5 h-5 text-blue-600" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-slate-900">حفظ التغييرات</h3>
                            <p className="text-sm text-slate-500">احفظ التغييرات الخاصة بهذه الشريحة</p>
                          </div>
                        </div>
                        <div>
                          <Button
                            type="button"
                            onClick={() => saveSlide(idx)}
                            disabled={savingSlideIdx === idx}
                            className="gap-2 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-lg hover:shadow-xl transition-all duration-300 px-8 py-4 rounded-xl font-semibold text-base"
                          >
                            {savingSlideIdx === idx ? (
                              <>
                                <div className="relative flex items-center justify-center w-5 h-5">
                                  <div className="absolute inset-0 bg-white/20 rounded-full animate-ping"></div>
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                </div>
                                <span>جاري الحفظ...</span>
                              </>
                            ) : (
                              <>
                                <Save className="w-5 h-5" />
                                <span>حفظ الشريحة</span>
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* shared Selection Modal for per-slide products */}
        <SelectionModal
          open={pickerOpenIdx !== null}
          title="اختيار المنتجات"
          search={pickerSearch}
          onSearch={setPickerSearch}
          loading={pickerLoading}
          results={pickerResults}
          visibleCount={pickerVisibleCount}
          onLoadMore={() => setPickerVisibleCount((c) => c + 10)}
          selected={pickerSelected}
          onToggle={togglePick}
          onClose={() => { setPickerOpenIdx(null); setPickerSearch(''); setPickerResults([]); }}
          onApply={() => { setPickerOpenIdx(null); }}
        />
      </DialogContent>
    </Dialog>
  );
};
