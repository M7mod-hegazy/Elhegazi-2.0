import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPutJson } from '@/lib/api';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import type { HomeConfig, Slide, SectionToggle } from '@/types/home-config';
import { 
  Save, 
  Sparkles, 
  Home, 
  Layout, 
  Palette, 
  Globe, 
  CheckCircle, 
  AlertTriangle, 
  Package, 
  Edit, 
  Eye, 
  Grid3X3, 
  Zap, 
  MousePointerClick, 
  Info, 
  Clock,
  FileText,
  LayoutDashboard,
  List,
  PackageSearch,
  Megaphone,
  Search,
  X,
  Trash2,
  Plus,
  ExternalLink,
  FileImage,
  Users,
  Link,
  Hash,
  Sliders
} from 'lucide-react';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import ImageUpload from '@/components/ui/image-upload';
import { logHistory } from '@/lib/history';

// External Modal Components
import { HeroSlidesModal } from '@/components/admin/home-config/HeroSlidesModal';
import { HeroDesignModal } from '@/components/admin/home-config/HeroDesignModal';
import { SectionsManagementModal } from '@/components/admin/home-config/SectionsManagementModal';
import { ProductsManagementModal } from '@/components/admin/home-config/ProductsManagementModal';
import { PromoSeoModal } from '@/components/admin/home-config/PromoSeoModal';
import { SelectionModal } from '@/components/admin/home-config/SelectionModal';
import AboutContentModal from '@/components/admin/home-config/AboutContentModal';

const defaultSlide: Slide = {
  title: '',
  subtitle: '',
  image: '',
  buttonText: '',
  buttonLink: '',
  productId: '',
  enabled: true,
};

const AdminHomeConfig = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cfg, setCfg] = useState<HomeConfig | null>(null);
  const [errors, setErrors] = useState<{ slides: Record<number, string[]>; promo: string[]; seo: string[] }>({ slides: {}, promo: [], seo: [] });
  // Autosave removed per request; manual save only
  // Selection modal state
  const [pickerOpen, setPickerOpen] = useState<false | 'featuredProducts' | 'categories' | 'bestSellers' | 'sale' | 'newArrivals'>(false);
  const [pickerSearch, setPickerSearch] = useState('');
  const [pickerLoading, setPickerLoading] = useState(false);
  const [pickerResults, setPickerResults] = useState<Array<{ id: string; label: string; image?: string }>>([]);
  const [pickerSelected, setPickerSelected] = useState<string[]>([]);
  const [categoriesCache, setCategoriesCache] = useState<Array<{ id: string; label: string; image?: string }>>([]);
  const [pickerVisibleCount, setPickerVisibleCount] = useState(10);
  // Modals open state
  const [heroSlidesOpen, setHeroSlidesOpen] = useState(false);
  const [heroDesignOpen, setHeroDesignOpen] = useState(false);
  const [sectionsManagementOpen, setSectionsManagementOpen] = useState(false);
  const [productsManagementOpen, setProductsManagementOpen] = useState(false);
  const [promoSeoOpen, setPromoSeoOpen] = useState(false);
  const [aboutContentOpen, setAboutContentOpen] = useState(false);

  // Debug helper
  const dbg = (...args: unknown[]) => console.log('[HomeConfig]', ...args);

  // Keep a ref to latest cfg to avoid re-running effects when cfg updates
  const cfgRef = useRef<HomeConfig | null>(null);
  useEffect(() => { cfgRef.current = cfg; }, [cfg]);

  // Validation logic (component scope)
  const validate = useCallback((c: HomeConfig | null) => {
    const out: { slides: Record<number, string[]>; promo: string[]; seo: string[] } = { slides: {}, promo: [], seo: [] };
    if (!c) return out;
    (c.slides || []).forEach((s, i) => {
      const errs: string[] = [];
      if (s.enabled) {
        if (!s.title?.trim()) errs.push('العنوان مطلوب للشريحة المفعلة');
        if (s.buttonText && !s.buttonLink) errs.push('رابط الزر مطلوب عند تحديد نص الزر');
      }
      // no image requirement in the new background-only design
      if (errs.length) out.slides[i] = errs;
    });
    if (c.promoEnabled) {
      if (!c.promoText?.trim()) out.promo.push('نص الشريط الترويجي مطلوب عند التفعيل');
      const allowed = ['zap', 'megaphone', 'gift', 'info', 'star'];
      if (c.promoIcon && !allowed.includes(c.promoIcon)) out.promo.push('الأيقونة غير مدعومة، استخدم: zap, megaphone, gift, info, star');
    }
    if (c.seoTitle && c.seoTitle.length > 70) out.seo.push('يفضل ألا يزيد عنوان SEO عن 70 حرفًا');
    if (c.seoDescription && c.seoDescription.length > 160) out.seo.push('يفضل ألا يزيد وصف SEO عن 160 حرفًا');
    return out;
  }, []);

  const isValid = useMemo(() => {
    const slideErrs = Object.keys(errors.slides).length === 0;
    return slideErrs && errors.promo.length === 0 && errors.seo.length === 0;
  }, [errors]);

  useEffect(() => {
    setErrors(validate(cfg));
  }, [cfg, validate]);

  // Load initial selection ONLY when opening the picker (do not react to cfg changes to avoid clearing results)
  useEffect(() => {
    if (!pickerOpen) return;
    const current = cfgRef.current;
    if (!current) return;
    dbg('Picker opened:', pickerOpen);
    if (pickerOpen === 'featuredProducts') {
      setPickerSelected([...(current.featuredProductIds || [])]);
    } else if (pickerOpen === 'bestSellers') {
      setPickerSelected([...(current.bestSellerProductIds || [])]);
    } else if (pickerOpen === 'sale') {
      setPickerSelected([...(current.saleProductIds || [])]);
    } else if (pickerOpen === 'newArrivals') {
      setPickerSelected([...(current.newArrivalProductIds || [])]);
    } else if (pickerOpen === 'categories') {
      setPickerSelected([...(current.featuredCategorySlugs || [])]);
    }
    // Keep existing results; user may have just reopened
    setPickerSearch('');
  }, [pickerOpen]);

  const fetchPicker = useCallback(async () => {
    if (!pickerOpen) return;
    try {
      setPickerLoading(true);
      dbg('Fetch picker start', { pickerOpen, pickerSearch });
      if (pickerOpen === 'featuredProducts' || pickerOpen === 'bestSellers' || pickerOpen === 'sale' || pickerOpen === 'newArrivals') {
        type Product = { _id?: string; id?: string; name?: string; title?: string; slug?: string; image?: string; images?: string[]; thumbnail?: string };
        const res = await apiGet<Product>(`/api/products?search=${encodeURIComponent(pickerSearch || '')}`);
        if (res.ok === false) throw new Error(res.error);
        const list: Product[] = res.items ?? [];
        const mapped = list.map((p) => ({ id: p._id || p.id || '', label: p.name || p.title || p.slug || '', image: p.image || (p.images && p.images[0]) || p.thumbnail }));
        setPickerResults(mapped);
        dbg('Fetch products ok', { count: mapped.length });
      } else if (pickerOpen === 'categories') {
        // Server doesn't support search; cache once and filter client-side for instant recommendations
        if (categoriesCache.length === 0) {
          type Category = { slug: string; name?: string; image?: string; icon?: string };
          const res = await apiGet<Category>(`/api/categories?page=1&limit=500`);
          if (res.ok === false) throw new Error(res.error);
          const raw: Category[] = res.items || [];
          const mapped = raw.map((c) => ({ id: c.slug, label: c.name || c.slug, image: c.image || c.icon }));
          setCategoriesCache(mapped);
          dbg('Categories cache loaded', { count: mapped.length });
        }
        const term = (pickerSearch || '').toLowerCase();
        const source: Array<{ id: string; label: string; image?: string }> = categoriesCache.length ? categoriesCache : [];
        const filtered = term
          ? source.filter((c) => c.label.toLowerCase().includes(term) || c.id.toLowerCase().includes(term))
          : source;
        const out = filtered.slice(0, 100);
        setPickerResults(out);
        dbg('Categories filtered', { term, count: out.length });
      }
    } catch (e) {
      console.error('picker fetch failed', e);
    } finally {
      setPickerLoading(false);
      dbg('Fetch picker end');
    }
  }, [pickerOpen, pickerSearch, categoriesCache]);

  useEffect(() => {
    if (!pickerOpen) return;
    dbg('Schedule fetch', { pickerSearch });
    const t = setTimeout(() => fetchPicker(), 350);
    return () => {
      dbg('Cancel scheduled fetch');
      clearTimeout(t);
    };
  }, [pickerSearch, pickerOpen, fetchPicker]);

  // Removed About/Work Hours dialog audits (moved to Company Info page)

  // reset pagination on open or search change
  useEffect(() => {
    if (!pickerOpen) return;
    // Audit when picker opened
    void logHistory({ section: 'home_config', action: 'picker_opened', meta: { type: pickerOpen } });
    setPickerVisibleCount(10);
  }, [pickerOpen, pickerSearch]);

  const togglePick = (id: string) => {
    setPickerSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const applyPicker = () => {
    if (!cfg || !pickerOpen) return;
    // compute updated config synchronously so we can save immediately
    let updated: HomeConfig = cfg;
    if (pickerOpen === 'featuredProducts') {
      updated = { ...cfg, featuredProductIds: [...pickerSelected] };
    } else if (pickerOpen === 'bestSellers') {
      updated = { ...cfg, bestSellerProductIds: [...pickerSelected] };
    } else if (pickerOpen === 'sale') {
      updated = { ...cfg, saleProductIds: [...pickerSelected] };
    } else if (pickerOpen === 'newArrivals') {
      updated = { ...cfg, newArrivalProductIds: [...pickerSelected] };
    } else if (pickerOpen === 'categories') {
      updated = { ...cfg, featuredCategorySlugs: [...pickerSelected] };
    }
    dbg('Apply picker', { pickerOpen, selectedCount: pickerSelected.length });
    void logHistory({ section: 'home_config', action: 'picker_applied', meta: { type: pickerOpen, count: pickerSelected.length } });
    setCfg(updated);
    // Persist selections immediately, bypassing validation (slides etc.)
    saveSelections(updated).catch(() => {});
    setPickerOpen(false);
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiGet<HomeConfig>('/api/home-config');
      if (res.ok) {
        setCfg(res.item as HomeConfig);
        // Audit: page loaded
        try {
          const hc = res.item as HomeConfig;
          void logHistory({
            section: 'home_config',
            action: 'page_loaded',
            meta: {
              slides: Array.isArray(hc?.slides) ? hc.slides.length : 0,
              heroEnabled: Boolean(hc?.heroEnabled),
              featuredCategories: Array.isArray((hc as HomeConfig).featuredCategorySlugs) ? (hc as HomeConfig).featuredCategorySlugs.length : 0,
              featuredProducts: Array.isArray((hc as HomeConfig).featuredProductIds) ? (hc as HomeConfig).featuredProductIds.length : 0,
            },
          });
        } catch {
          // best-effort audit; ignore
        }
      } else {
        const r = res as { ok: false; error: string };
        throw new Error(r.error);
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر تحميل الإعدادات';
      toast({ title: 'فشل التحميل', description: message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const save = useCallback(async (quiet = false) => {
    if (!cfg) return;
    // prevent save if invalid
    if (!isValid) {
      if (!quiet) toast({ title: 'تحقق من الحقول', description: 'بعض الحقول تحتاج تصحيح قبل الحفظ', variant: 'destructive' });
      return;
    }
    try {
      setSaving(true);
      const body: Partial<HomeConfig> = {
        heroEnabled: cfg.heroEnabled,
        slides: cfg.slides,
        heroDesign: cfg.heroDesign,
        toggles: cfg.toggles,
        featuredCategorySlugs: cfg.featuredCategorySlugs,
        featuredProductIds: cfg.featuredProductIds,
        bestSellerProductIds: cfg.bestSellerProductIds || [],
        saleProductIds: cfg.saleProductIds || [],
        newArrivalProductIds: cfg.newArrivalProductIds || [],
        promoEnabled: cfg.promoEnabled,
        promoText: cfg.promoText,
        promoIcon: cfg.promoIcon,
        seoTitle: cfg.seoTitle,
        seoDescription: cfg.seoDescription,
        sections: cfg.sections,
        sectionsOrder: cfg.sectionsOrder,
        aboutUsContent: cfg.aboutUsContent,
        workHours: cfg.workHours,
      };
      // Optional admin header if you set ADMIN_SECRET on server
      const res = await apiPutJson<HomeConfig, Partial<HomeConfig>>('/api/home-config', body, typeof window !== 'undefined' ? { 'x-admin-secret': localStorage.getItem('ADMIN_SECRET') || '' } : undefined);
      if (!res.ok) {
        const r = res as { ok: false; error: string };
        throw new Error(r.error);
      }
      setCfg(res.item as HomeConfig);
      // Audit: saved
      void logHistory({ section: 'home_config', action: 'saved' });
      if (!quiet) toast({ title: 'تم الحفظ', description: 'تم تحديث إعدادات الصفحة الرئيسية بنجاح' });
      // Notify other pages (home) to refresh their HomeConfig
      try {
        localStorage.setItem('HOME_CONFIG_VERSION', String(Date.now()));
        window.dispatchEvent(new Event('home-config-updated'));
      } catch (err) {
        // no-op: best effort broadcast
      }
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'تعذر حفظ الإعدادات';
      toast({ title: 'فشل الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [cfg, isValid, toast]);

  // Save only selection-related fields, bypassing validation so choices persist even if slides have issues
  const saveSelections = useCallback(async (state?: HomeConfig) => {
    const snap = state || cfgRef.current || cfg;
    if (!snap) return;
    try {
      setSaving(true);
      const body: Partial<HomeConfig> = {
        featuredCategorySlugs: snap.featuredCategorySlugs,
        featuredProductIds: snap.featuredProductIds,
        bestSellerProductIds: snap.bestSellerProductIds || [],
        saleProductIds: snap.saleProductIds || [],
        newArrivalProductIds: snap.newArrivalProductIds || [],
        // keep hero toggle and sections order to avoid accidental resets
        heroEnabled: snap.heroEnabled,
        sectionsOrder: snap.sectionsOrder,
        toggles: snap.toggles,
        sections: snap.sections,
        aboutUsContent: snap.aboutUsContent,
        workHours: snap.workHours,
      };
      dbg('Save selections', body);
      const res = await apiPutJson<HomeConfig, Partial<HomeConfig>>(
        '/api/home-config',
        body,
        typeof window !== 'undefined' ? { 'x-admin-secret': localStorage.getItem('ADMIN_SECRET') || '' } : undefined
      );
      if (!res.ok) {
        const r = res as { ok: false; error: string };
        throw new Error(r.error);
      }
      // Merge to avoid overwriting unsaved local slide edits
      setCfg((prev) => {
        const incoming = res.item as HomeConfig;
        if (!prev) return incoming;
        return {
          ...prev,
          ...incoming,
          // Preserve local slides array; selections API does not touch slides
          slides: prev.slides,
        } as HomeConfig;
      });

      // Show success toast for About content saves
      toast({ title: 'تم الحفظ', description: 'تم تحديث محتوى صفحة من نحن بنجاح' });
      dbg('Save selections ok');
      void logHistory({ section: 'home_config', action: 'selections_saved' });
      // Notify other pages to refresh
      try {
        localStorage.setItem('HOME_CONFIG_VERSION', String(Date.now()));
        window.dispatchEvent(new Event('home-config-updated'));
      } catch (err) {
        // no-op
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : 'تعذر حفظ الاختيارات';
      toast({ title: 'فشل الحفظ', description: message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }, [cfg, toast]);

  // Autosave removed

  const updateSlide = (idx: number, patch: Partial<Slide>) => {
    if (!cfg) return;
    const slides = [...cfg.slides];
    const prev = slides[idx];
    slides[idx] = { ...slides[idx], ...patch };
    setCfg({ ...cfg, slides });
    if (Object.prototype.hasOwnProperty.call(patch, 'enabled')) {
      void logHistory({ section: 'home_config', action: 'slide_toggled', meta: { index: idx, old: prev.enabled, new: patch.enabled } });
    }
  };

  const addSlide = () => {
    if (!cfg) return;
    setCfg({ ...cfg, slides: [...cfg.slides, { ...defaultSlide }] });
    void logHistory({ section: 'home_config', action: 'slide_added', meta: { count: (cfg.slides?.length || 0) + 1 } });
  };

  const removeSlide = (idx: number) => {
    if (!cfg) return;
    const slides = cfg.slides.filter((_, i) => i !== idx);
    setCfg({ ...cfg, slides });
    void logHistory({ section: 'home_config', action: 'slide_removed', meta: { index: idx, count: slides.length } });
  };

  // Seed 4 default slides (matches EnhancedHeroSection defaults) for better UX
  const seedDefaultSlides = useCallback(() => {
    if (!cfg) return;
    const slides: Slide[] = [
      {
        title: 'أحدث التقنيات في متناول يدك',
        subtitle: 'اكتشف مجموعة واسعة من الأجهزة الذكية والإلكترونيات المتطورة بأفضل الأسعار',
        buttonText: 'تسوق الآن',
        buttonLink: '/products',
        image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
        productId: '',
        enabled: true,
      },
      {
        title: 'عروض حصرية لفترة محدودة',
        subtitle: 'خصومات تصل إلى 50% على مجموعة مختارة من أفضل المنتجات',
        buttonText: 'اكتشف العروض',
        buttonLink: '/products?sale=true',
        image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&auto=format&fit=crop&w=2126&q=80',
        productId: '',
        enabled: true,
      },
      {
        title: 'جودة عالية وضمان شامل',
        subtitle: 'منتجات أصلية من أفضل العلامات التجارية العالمية مع ضمان الجودة',
        buttonText: 'تعرف على المزيد',
        buttonLink: '/about',
        image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?ixlib=rb-4.0.3&auto=format&fit=crop&w=2340&q=80',
        productId: '',
        enabled: true,
      },
      {
        title: 'منتجات جديدة وصلت',
        subtitle: 'تشكيلة جديدة وصلت للتو — تصفح أحدث الإضافات الآن',
        buttonText: 'اطلب الآن',
        buttonLink: '/products',
        image: 'https://images.unsplash.com/photo-1612832021029-8b0d9dc69f82?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
        productId: '',
        enabled: true,
      },
    ];
    setCfg({ ...cfg, slides });
    void logHistory({ section: 'home_config', action: 'seed_defaults_clicked', meta: { count: slides.length } });
  }, [cfg]);

  const toggleMap = (section: 'featuredProducts' | 'bestSellers' | 'sale' | 'newArrivals') => {
    const key = section;
    const enabled = true; // Default to enabling when called from modal
    if (!cfg) return;
    const exists = cfg.toggles.find(t => t.key === key);
    let toggles: SectionToggle[];
    if (exists) {
      toggles = cfg.toggles.map(t => t.key === key ? { ...t, enabled } : t);
    } else {
      toggles = [...cfg.toggles, { key, enabled }];
    }
    setCfg({ ...cfg, toggles });
    void logHistory({ section: 'home_config', action: 'section_toggled', meta: { key, enabled } });
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-primary/5 to-secondary/5 flex items-center justify-center">
          <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <span className="text-lg font-medium text-slate-700">جاري تحميل إعدادات الصفحة الرئيسية...</span>
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!cfg) {
    return (
      <AdminLayout>
        <div className="p-10 text-center text-red-600">تعذر تحميل الإعدادات</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30 relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          {/* Floating gradient orbs */}
          <div className="absolute top-10 left-10 w-32 h-32 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '0s', animationDuration: '4s' }} />
          <div className="absolute top-1/3 right-20 w-24 h-24 bg-gradient-to-br from-purple-400/20 to-pink-600/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s', animationDuration: '6s' }} />
          <div className="absolute bottom-20 left-1/4 w-20 h-20 bg-gradient-to-br from-emerald-400/20 to-green-600/20 rounded-full blur-xl animate-pulse" style={{ animationDelay: '2s', animationDuration: '5s' }} />
          
          {/* Geometric shapes */}
          <div className="absolute top-20 right-10 w-6 h-6 border border-primary/30 rotate-45 animate-spin" style={{ animationDuration: '20s' }} />
          <div className="absolute bottom-32 right-1/3 w-4 h-4 bg-purple-300/30 rounded-full animate-bounce" style={{ animationDelay: '3s' }} />
        </div>

        {/* Revolutionary Mobile vs Desktop Header */}
        {isMobile ? (
          <div className="relative z-10 mb-6">
            {/* Enhanced Mobile Header with Glassmorphism */}
            <div className="bg-white/95 backdrop-blur-2xl border border-slate-200/40 rounded-3xl shadow-2xl p-4 mx-3 mt-3 ring-1 ring-white/20">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative group">
                      <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl blur-lg opacity-60 group-hover:opacity-80 animate-pulse transition-opacity duration-300" />
                      <div className="relative p-3 bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl shadow-xl ring-2 ring-white/30">
                        <Home className="w-6 h-6 text-white drop-shadow-sm" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <h1 className="text-xl font-black text-slate-900 bg-gradient-to-r from-primary via-secondary to-purple-600 bg-clip-text text-transparent leading-tight">
                        إعداد الصفحة الرئيسية
                      </h1>
                      <p className="text-xs text-slate-600 font-semibold flex items-center gap-1.5 mt-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
                        إدارة وتخصيص المحتوى التفاعلي
                      </p>
                    </div>
                  </div>
                  
                  {/* Enhanced Mobile Actions */}
                  <div className="flex items-center gap-1.5">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => window.open('/', '_blank')}
                      className="bg-white/90 border-slate-300/60 hover:bg-slate-50 hover:border-slate-400 text-xs px-2.5 py-1.5 shadow-md hover:shadow-lg transition-all duration-200 ring-1 ring-white/40"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-600" />
                    </Button>
                    
                    <Button 
                      onClick={() => save(false)} 
                      disabled={saving || !isValid}
                      size="sm"
                      className="bg-gradient-to-r from-primary via-secondary to-purple-600 hover:from-primary hover:via-secondary hover:to-purple-700 text-xs px-3 py-1.5 shadow-lg hover:shadow-xl transition-all duration-200 ring-1 ring-primary/20"
                    >
                      {saving ? (
                        <div className="w-3.5 h-3.5 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Save className="w-3.5 h-3.5 text-white drop-shadow-sm" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {/* Enhanced Mobile Status Bar with Horizontal Scroll */}
                <div className="bg-gradient-to-r from-slate-50/80 to-primary/5 rounded-2xl p-3 border border-slate-200/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      <Info className="w-3 h-3 text-primary" />
                      حالة المشروع
                    </span>
                    <div className={`px-2.5 py-1 rounded-full text-xs font-bold transition-all duration-300 shadow-sm ${
                      isValid 
                        ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border border-green-200/60' 
                        : 'bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border border-amber-200/60'
                    }`}>
                      {isValid ? (
                        <div className="flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" />
                          جاهز للنشر
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          يحتاج مراجعة
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Horizontal Scrolling Stats */}
                  <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                    <div className="flex items-center gap-1.5 bg-primary/10 rounded-xl px-3 py-2 min-w-fit shadow-sm">
                      <Layout className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-primary">شرائح:</span>
                      <Badge className="bg-primary/20 text-primary border-0 text-xs px-1.5 py-0.5 font-bold">
                        {cfg?.slides?.length || 0}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1.5 bg-green-100/80 rounded-xl px-3 py-2 min-w-fit shadow-sm">
                      <Package className="w-3.5 h-3.5 text-green-600" />
                      <span className="text-xs font-semibold text-green-800">منتجات:</span>
                      <Badge className="bg-green-200 text-green-800 border-0 text-xs px-1.5 py-0.5 font-bold">
                        {cfg?.featuredProductIds?.length || 0}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1.5 bg-purple-100/80 rounded-xl px-3 py-2 min-w-fit shadow-sm">
                      <Grid3X3 className="w-3.5 h-3.5 text-purple-600" />
                      <span className="text-xs font-semibold text-purple-800">فئات:</span>
                      <Badge className="bg-purple-200 text-purple-800 border-0 text-xs px-1.5 py-0.5 font-bold">
                        {cfg?.featuredCategorySlugs?.length || 0}
                      </Badge>
                    </div>
                    
                    <div className="flex items-center gap-1.5 bg-orange-100/80 rounded-xl px-3 py-2 min-w-fit shadow-sm">
                      <Zap className="w-3.5 h-3.5 text-orange-600" />
                      <span className="text-xs font-semibold text-orange-800">ترويجي:</span>
                      <Badge className={`border-0 text-xs px-1.5 py-0.5 font-bold ${
                        cfg.promoEnabled ? 'bg-orange-200 text-orange-800' : 'bg-gray-200 text-gray-700'
                      }`}>
                        {cfg.promoEnabled ? 'مفعل' : 'معطل'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative z-10 mb-8">
            <div className="bg-white/80 backdrop-blur-2xl border border-slate-200/50 rounded-3xl shadow-2xl p-8 mx-6 mt-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-lg opacity-50 animate-pulse" />
                    <div className="relative p-4 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-xl">
                      <Home className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                      إعداد الصفحة الرئيسية
                    </h1>
                    <p className="text-lg text-slate-600 font-medium mt-2 flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary animate-pulse" />
                      إدارة وتخصيص محتوى وعناصر الصفحة الرئيسية بشكل متقدم
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  {/* Enhanced Status Indicators */}
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className={`flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all duration-300 ${
                        isValid 
                          ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 hover:shadow-green-200/50' 
                          : 'bg-gradient-to-r from-red-50 to-red-100 border border-red-200 hover:shadow-red-200/50'
                      }`}>
                        <div className={`w-2 h-2 rounded-full animate-pulse ${
                          isValid ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <span className={`text-sm font-semibold ${
                          isValid ? 'text-green-700' : 'text-red-700'
                        }`}>
                          {isValid ? (
                            <div className="flex items-center gap-1">
                              <CheckCircle className="w-4 h-4" />
                              جميع البيانات صحيحة
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <AlertTriangle className="w-4 h-4" />
                              يحتاج مراجعة
                            </div>
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {saving && (
                      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-full shadow-lg">
                        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-sm font-semibold text-primary">جاري الحفظ...</span>
                      </div>
                    )}
                  </div>
                  
                  {/* Enhanced Action Buttons */}
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => window.open('/', '_blank')}
                      className="group bg-white/80 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all duration-300 shadow-lg hover:shadow-xl h-12 px-6"
                    >
                      <Eye className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                      معاينة الصفحة
                    </Button>
                    
                    <Button 
                      onClick={() => save(false)} 
                      disabled={saving || !isValid}
                      className="group bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary shadow-lg hover:shadow-xl transition-all duration-300 h-12 px-6"
                    >
                      {saving ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                      ) : (
                        <Save className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform duration-200" />
                      )}
                      {saving ? 'جاري الحفظ...' : 'حفظ جميع التغييرات'}
                    </Button>
                  </div>
                </div>
            </div>
            
            {/* Enhanced Status Bar */}
            <div className="mt-6 pt-6 border-t border-slate-200/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="flex items-center gap-2">
                    <Layout className="w-4 h-4 text-primary" />
                    <span className="text-sm text-slate-600">الشرائح:</span>
                    <Badge className="bg-primary/10 text-primary border-primary/20 shadow-sm">
                      {cfg?.slides?.length || 0}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-600">المنتجات المميزة:</span>
                    <Badge className="bg-green-100 text-green-700 border-green-200 shadow-sm">
                      {cfg?.featuredProductIds?.length || 0}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Grid3X3 className="w-4 h-4 text-purple-600" />
                    <span className="text-sm text-slate-600">الفئات:</span>
                    <Badge className="bg-purple-100 text-purple-700 border-purple-200 shadow-sm">
                      {cfg?.featuredCategorySlugs?.length || 0}
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    آخر تحديث: منذ دقائق
                  </div>
                  
                  <div className={`px-3 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                    isValid 
                      ? 'bg-green-100 text-green-700 border border-green-200 shadow-sm' 
                      : 'bg-amber-100 text-amber-700 border border-amber-200 shadow-sm'
                  }`}>
                    {isValid ? (
                      <div className="flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        جاهز
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        يحتاج مراجعة
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

        {/* Revolutionary Mobile vs Desktop Content Layout */}
        {isMobile ? (
          <div className="space-y-3 px-3 pb-4 max-h-[calc(100vh-200px)] overflow-y-auto">
            {/* Revolutionary Mobile: Hero Section Toggle Card */}
            <Card className="bg-white/95 backdrop-blur-2xl border border-slate-200/40 shadow-xl rounded-3xl overflow-hidden ring-1 ring-white/30">
              <CardContent className="p-0">
                <div className="bg-gradient-to-r from-purple-50/90 via-blue-50/90 to-indigo-50/90 p-4 border-b border-slate-200/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative group">
                        <div className="absolute inset-0 bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl blur-md opacity-60 group-hover:opacity-80 animate-pulse transition-opacity duration-300" />
                        <div className="relative p-2.5 bg-gradient-to-br from-primary via-secondary to-primary rounded-2xl shadow-lg ring-2 ring-white/30">
                          <Sparkles className="w-5 h-5 text-white drop-shadow-sm" />
                        </div>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-bold text-slate-900 text-base leading-tight">تفعيل قسم الهيرو</h3>
                        <p className="text-xs text-slate-600 font-medium mt-0.5">إظهار أو إخفاء قسم الهيرو الرئيسي</p>
                      </div>
                    </div>
                    <div className="relative">
                      <Switch 
                        checked={cfg.heroEnabled} 
                        onCheckedChange={(val) => { 
                          void logHistory({ section: 'home_config', action: 'hero_toggled', meta: { old: cfg.heroEnabled, new: val } }); 
                          setCfg({ ...cfg, heroEnabled: val }); 
                        }} 
                        size="lg"
                        className="transform scale-110"
                      />
                      {cfg.heroEnabled && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Hero Status Indicator */}
                <div className="p-3">
                  <div className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-300 ${
                    cfg.heroEnabled 
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200/60' 
                      : 'bg-gradient-to-r from-gray-50 to-slate-50 border border-gray-200/60'
                  }`}>
                    <div className={`w-2 h-2 rounded-full animate-pulse ${
                      cfg.heroEnabled ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                    <span className={`text-xs font-semibold ${
                      cfg.heroEnabled ? 'text-green-800' : 'text-gray-600'
                    }`}>
                      {cfg.heroEnabled ? 'قسم الهيرو مفعل وجاهز للعرض' : 'قسم الهيرو معطل حالياً'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* Mobile: Configuration Management Cards */}
            <div className="space-y-3">
              {/* Hero Slides Card */}
              <Card 
                className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all duration-300"
                onClick={() => setHeroSlidesOpen(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-primary to-secondary rounded-xl">
                        <Sliders className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">إدارة الشرائح</h3>
                        <p className="text-xs text-slate-600">{cfg.slides.length} شريحة | {cfg.slides.filter(s => s.enabled).length} مفعلة</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cfg.slides.length > 0 && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-xs">
                          {cfg.slides.length}
                        </Badge>
                      )}
                      <Edit className="w-4 h-4 text-primary" />
                    </div>
                  </div>
                  
                  {/* Mobile Slide Preview */}
                  {cfg.slides.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto scrollbar-hide">
                      {cfg.slides.slice(0, 4).map((slide, idx) => (
                        <div key={idx} className="relative shrink-0">
                          <div className="w-12 h-8 rounded-lg border border-primary/20 overflow-hidden">
                            <div className={`w-full h-full ${slide.bgColor ? '' : 'bg-gradient-to-br'} ${slide.bgColor ? '' : (slide.bgGradient || 'from-indigo-600 via-purple-600 to-pink-600')}`} style={slide.bgColor ? { backgroundColor: slide.bgColor } : undefined} />
                          </div>
                          {!slide.enabled && (
                            <div className="absolute inset-0 bg-gray-500/80 rounded-lg" />
                          )}
                        </div>
                      ))}
                      {cfg.slides.length > 4 && (
                        <div className="flex items-center justify-center w-12 h-8 bg-slate-100 border border-dashed border-slate-300 rounded-lg">
                          <span className="text-xs text-slate-500">+{cfg.slides.length - 4}</span>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
              
              {/* Hero Design Card */}
              <Card 
                className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 border-purple-200/60 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all duration-300"
                onClick={() => setHeroDesignOpen(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl">
                        <Palette className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">تصميم وحركات</h3>
                        <p className="text-xs text-slate-600">إعدادات التأثيرات والتفاعل</p>
                      </div>
                    </div>
                    <Edit className="w-4 h-4 text-purple-600" />
                  </div>
                </CardContent>
              </Card>
              
              {/* Sections Management Card */}
              <Card 
                className="bg-gradient-to-br from-emerald-50/80 to-green-50/80 border-emerald-200/60 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all duration-300"
                onClick={() => setSectionsManagementOpen(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl">
                        <Layout className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">أقسام الصفحة</h3>
                        <p className="text-xs text-slate-600">ترتيب وإظهار الأقسام</p>
                      </div>
                    </div>
                    <Edit className="w-4 h-4 text-emerald-600" />
                  </div>
                </CardContent>
              </Card>
              
              {/* Products Management Card */}
              <Card 
                className="bg-gradient-to-br from-orange-50/80 to-red-50/80 border-orange-200/60 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all duration-300"
                onClick={() => setProductsManagementOpen(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl">
                        <Package className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">إدارة المنتجات</h3>
                        <p className="text-xs text-slate-600">اختيار المنتجات والفئات المميزة</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex gap-1">
                        <Badge className="bg-primary/10 text-primary text-xs px-1">
                          {cfg?.featuredProductIds?.length || 0}
                        </Badge>
                        <Badge className="bg-purple-100 text-purple-700 text-xs px-1">
                          {cfg?.featuredCategorySlugs?.length || 0}
                        </Badge>
                      </div>
                      <Edit className="w-4 h-4 text-orange-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Promo & SEO Card */}
              <Card 
                className="bg-gradient-to-br from-cyan-50/80 to-teal-50/80 border-cyan-200/60 shadow-lg rounded-2xl cursor-pointer hover:shadow-xl transition-all duration-300"
                onClick={() => setPromoSeoOpen(true)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl">
                        <Globe className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">الشريط الترويجي وSEO</h3>
                        <p className="text-xs text-slate-600">إعدادات التسويق ومحركات البحث</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={`text-xs px-2 py-1 ${cfg.promoEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {cfg.promoEnabled ? 'مفعل' : 'معطل'}
                      </Badge>
                      <Edit className="w-4 h-4 text-cyan-600" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Hero Section Overview Card */}
          <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl hover:shadow-2xl transition-all duration-500 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-br from-purple-50/30 via-primary/5 to-transparent pointer-events-none" />
            <CardHeader className="bg-gradient-to-r from-purple-50/50 to-primary/5 border-b border-slate-100 relative z-10">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-secondary rounded-xl blur-md opacity-50 animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-br from-purple-500 to-secondary rounded-xl shadow-lg">
                    <Sparkles className="w-6 h-6 text-white" />
                  </div>
                </div>
                الهيرو والشرائح التفاعلية
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-primary rounded-full animate-pulse" />
                التحكم في إظهار قسم الهيرو وإدارة الشرائح التفاعلية للصفحة الرئيسية
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-6 relative z-10">
              <div className="bg-gradient-to-r from-slate-50 to-primary/5 border border-slate-200/50 rounded-xl p-6 shadow-inner">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="p-1 bg-primary/10 rounded-lg">
                        <Home className="w-5 h-5 text-primary" />
                      </div>
                      <Label className="text-base font-semibold text-slate-900">تفعيل قسم الهيرو</Label>
                    </div>
                    <p className="text-sm text-slate-600 font-medium">إظهار أو إخفاء قسم الهيرو بالكامل في الصفحة الرئيسية</p>
                  </div>
                  <div className="relative">
                    <Switch 
                      checked={cfg.heroEnabled} 
                      onCheckedChange={(val) => { 
                        void logHistory({ section: 'home_config', action: 'hero_toggled', meta: { old: cfg.heroEnabled, new: val } }); 
                        setCfg({ ...cfg, heroEnabled: val }); 
                      }} 
                      variant={cfg.heroEnabled ? 'success' : 'default'}
                      size="lg"
                      className="ml-4 shadow-lg"
                    />
                    {cfg.heroEnabled && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-ping" />
                    )}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Dialog open={heroSlidesOpen} onOpenChange={setHeroSlidesOpen}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-2xl hover:scale-[1.02] transition-all duration-500 bg-gradient-to-br from-primary/5 via-secondary/5 to-purple-50/80 border-primary/20 shadow-xl group relative overflow-hidden backdrop-blur-sm">
                      {/* Animated background effects */}
                      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-secondary/8 to-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="absolute top-0 left-0 w-32 h-32 bg-primary/15 rounded-full -translate-x-16 -translate-y-16 group-hover:scale-150 transition-transform duration-700" />
                      <div className="absolute bottom-0 right-0 w-24 h-24 bg-secondary/10 rounded-full translate-x-12 translate-y-12 group-hover:scale-125 transition-transform duration-500" />
                      
                      <CardContent className="p-8 relative z-10">
                        {/* Header Section */}
                        <div className="flex items-start justify-between mb-6">
                          <div className="flex items-start gap-5">
                            <div className="relative">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-lg opacity-40 group-hover:opacity-60 transition-opacity duration-300 animate-pulse" />
                              <div className="relative p-4 bg-gradient-to-br from-primary to-secondary rounded-2xl shadow-lg group-hover:shadow-xl transition-all duration-300 ring-2 ring-primary/20 group-hover:ring-primary/30">
                                <Sliders className="w-8 h-8 text-white group-hover:scale-110 transition-transform duration-300" />
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div>
                                <h3 className="font-bold text-xl text-slate-900 mb-1 group-hover:text-primary transition-colors duration-300 flex items-center gap-2">
                                  إدارة الشرائح
                                  {cfg.slides.length > 0 && (
                                    <div className="w-2 h-2 bg-green-500 rounded-full animate-ping" />
                                  )}
                                </h3>
                                <p className="text-sm text-slate-600 font-medium leading-relaxed">إدارة وتخصيص شرائح العرض الرئيسية التفاعلية</p>
                              </div>
                              
                              {/* Enhanced Status Badges */}
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className="bg-gradient-to-r from-primary/10 to-secondary/10 text-primary border-primary/20 px-3 py-1.5 text-sm font-semibold shadow-sm hover:shadow-md transition-shadow duration-200">
                                  <span className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 bg-primary rounded-full" />
                                    {cfg.slides.length} شريحة
                                  </span>
                                </Badge>
                                <Badge className={`px-3 py-1.5 text-sm font-semibold shadow-sm hover:shadow-md transition-all duration-200 ${
                                  cfg.slides.filter(s => s.enabled).length > 0 
                                    ? 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200' 
                                    : 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border-gray-200'
                                }`}>
                                  <span className="flex items-center gap-1.5">
                                    <div className={`w-2 h-2 rounded-full ${
                                      cfg.slides.filter(s => s.enabled).length > 0 ? 'bg-green-600' : 'bg-gray-500'
                                    }`} />
                                    {cfg.slides.filter(s => s.enabled).length} مفعلة
                                  </span>
                                </Badge>
                                {cfg.slides.length === 0 && (
                                  <Badge className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-800 border-amber-200 px-3 py-1.5 text-sm font-semibold shadow-sm">
                                    <span className="flex items-center gap-1.5">
                                      <AlertTriangle className="w-3 h-3" />
                                      فارغة
                                    </span>
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {/* Action Icons */}
                          <div className="flex flex-col items-end gap-3">
                            <div className="relative">
                              <Edit className="w-6 h-6 text-primary group-hover:text-primary group-hover:scale-110 transition-all duration-300" />
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 animate-ping transition-opacity duration-300" />
                            </div>
                            {cfg.slides.length > 0 && (
                              <div className="text-xs text-slate-500 text-right bg-slate-50 rounded-lg px-2 py-1 border border-slate-100">
                                <div className="font-medium">آخر تحديث</div>
                                <div className="text-slate-400">اليوم</div>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        {/* Enhanced Slide Preview Strip */}
                        {cfg.slides.length > 0 && (
                          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 rounded-xl p-4 border border-primary/10">
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-2 shrink-0">
                                <Eye className="w-4 h-4 text-slate-500" />
                                <span className="text-sm font-medium text-slate-600">معاينة سريعة:</span>
                              </div>
                              <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide">
                                {cfg.slides.slice(0, 5).map((slide, idx) => (
                                  <div key={idx} className="relative shrink-0 group/preview">
                                    <div className="w-16 h-10 rounded-lg border-2 border-primary/20 overflow-hidden relative shadow-sm hover:shadow-md transition-all duration-200 hover:scale-105">
                                      <div className={`absolute inset-0 ${slide.bgColor ? '' : 'bg-gradient-to-br'} ${slide.bgColor ? '' : (slide.bgGradient || 'from-indigo-600 via-purple-600 to-pink-600')}`} style={slide.bgColor ? { backgroundColor: slide.bgColor } : undefined} />
                                      <div className="absolute inset-0 bg-black/15" />
                                      <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="text-[8px] text-white font-bold truncate px-1">{slide.title?.slice(0, 8) || `#${idx + 1}`}</div>
                                      </div>
                                    </div>
                                    {!slide.enabled && (
                                      <div className="absolute inset-0 bg-gray-500/80 rounded-lg flex items-center justify-center">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full" />
                                      </div>
                                    )}
                                    <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 opacity-0 group-hover/preview:opacity-100 transition-opacity duration-200">
                                      <div className="text-[10px] text-slate-500 bg-white px-2 py-1 rounded shadow-sm border whitespace-nowrap">
                                        شريحة {idx + 1}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                                {cfg.slides.length > 5 && (
                                  <div className="flex items-center justify-center w-16 h-10 bg-slate-100 border-2 border-dashed border-slate-300 rounded-lg">
                                    <span className="text-xs text-slate-500 font-medium">+{cfg.slides.length - 5}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Call to Action for Empty State */}
                        {cfg.slides.length === 0 && (
                          <div className="mt-4 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl">
                            <div className="flex items-center gap-3">
                              <div className="p-2 bg-amber-100 rounded-lg">
                                <Plus className="w-4 h-4 text-amber-600" />
                              </div>
                              <div>
                                <p className="text-sm font-medium text-amber-800">ابدأ بإنشاء شريحتك الأولى</p>
                                <p className="text-xs text-amber-600">انقر لفتح محرر الشرائح وإضافة محتوى جذاب</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                </Dialog>
                
                <Dialog open={heroDesignOpen} onOpenChange={setHeroDesignOpen}>
                  <DialogTrigger asChild>
                    <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-3 bg-purple-100 rounded-xl">
                              <Palette className="w-6 h-6 text-purple-600" />
                            </div>
                            <div>
                              <h3 className="font-bold text-slate-900">تصميم وحركات</h3>
                              <p className="text-sm text-slate-600">إعدادات التأثيرات والتفاعل</p>
                            </div>
                          </div>
                          <Edit className="w-5 h-5 text-purple-600" />
                        </div>
                      </CardContent>
                    </Card>
                  </DialogTrigger>
                </Dialog>
              </div>
            </CardContent>
          </Card>

          {/* Sections Management Card */}
          <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl hover:shadow-2xl transition-all duration-500">
            <CardHeader className="bg-gradient-to-r from-emerald-50/50 to-green-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl blur-md opacity-50 animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl shadow-lg">
                    <Layout className="w-6 h-6 text-white" />
                  </div>
                </div>
                أقسام الصفحة الرئيسية
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium">
                إدارة ترتيب وإظهار أقسام الصفحة الرئيسية المختلفة
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Dialog open={sectionsManagementOpen} onOpenChange={setSectionsManagementOpen}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-emerald-100 rounded-xl">
                            <Grid3X3 className="w-6 h-6 text-emerald-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">ترتيب الأقسام</h3>
                            <p className="text-sm text-slate-600">تحكم في ترتيب وإظهار أقسام الصفحة</p>
                          </div>
                        </div>
                        <Edit className="w-5 h-5 text-emerald-600" />
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>

          {/* Products Management Card */}
          <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl hover:shadow-2xl transition-all duration-500">
            <CardHeader className="bg-gradient-to-r from-orange-50/50 to-red-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl blur-md opacity-50 animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                </div>
                إدارة المنتجات والفئات
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium">
                اختيار المنتجات والفئات المميزة للعرض في الصفحة الرئيسية
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Dialog open={productsManagementOpen} onOpenChange={setProductsManagementOpen}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-orange-100 rounded-xl">
                            <MousePointerClick className="w-6 h-6 text-orange-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">اختيار المنتجات والفئات</h3>
                            <p className="text-sm text-slate-600">إدارة المحتوى المميز</p>
                            <div className="flex gap-4 mt-2">
                              <Badge className="bg-primary/10 text-primary">
                                {cfg?.featuredProductIds?.length || 0} منتج مميز
                              </Badge>
                              <Badge className="bg-purple-100 text-purple-700">
                                {cfg?.featuredCategorySlugs?.length || 0} فئة مميزة
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Edit className="w-5 h-5 text-orange-600" />
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>

          {/* Promo & SEO Card */}
          <Card className="bg-white/80 backdrop-blur-xl border border-slate-200/50 shadow-2xl hover:shadow-2xl transition-all duration-500">
            <CardHeader className="bg-gradient-to-r from-cyan-50/50 to-teal-50/50 border-b border-slate-100">
              <CardTitle className="flex items-center gap-3 text-xl font-bold text-slate-900">
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl blur-md opacity-50 animate-pulse" />
                  <div className="relative p-3 bg-gradient-to-br from-cyan-500 to-teal-600 rounded-xl shadow-lg">
                    <Globe className="w-6 h-6 text-white" />
                  </div>
                </div>
                الشريط الترويجي وSEO
              </CardTitle>
              <CardDescription className="text-slate-600 font-medium">
                إعدادات الشريط الترويجي وتحسين محركات البحث
              </CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <Dialog open={promoSeoOpen} onOpenChange={setPromoSeoOpen}>
                <DialogTrigger asChild>
                  <Card className="cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-cyan-50 to-teal-50 border-cyan-200">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-3 bg-cyan-100 rounded-xl">
                            <Zap className="w-6 h-6 text-cyan-600" />
                          </div>
                          <div>
                            <h3 className="font-bold text-slate-900">إعدادات التسويق</h3>
                            <p className="text-sm text-slate-600">الشريط الترويجي وSEO</p>
                            <div className="flex gap-2 mt-2">
                              <Badge className={cfg.promoEnabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"}>
                                الشريط: {cfg.promoEnabled ? 'مفعل' : 'معطل'}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <Edit className="w-5 h-5 text-cyan-600" />
                      </div>
                    </CardContent>
                  </Card>
                </DialogTrigger>
              </Dialog>
            </CardContent>
          </Card>

          {/* About Us Content */}
          <Card className="border-2 border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Info className="w-6 h-6 text-primary" />
                محتوى صفحة من نحن
              </CardTitle>
              <CardDescription>
                تخصيص محتوى صفحة "من نحن" - العنوان، الوصف، الإحصائيات، الرؤية والرسالة
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
              <Card 
                className="cursor-pointer hover:border-primary/50 transition-all hover:shadow-md border-2"
                onClick={() => setAboutContentOpen(true)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <Info className="w-5 h-5 text-primary" />
                        <span className="font-semibold text-lg">إعدادات صفحة من نحن</span>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {cfg?.aboutUsContent?.title || 'لم يتم تعيين المحتوى بعد'}
                      </p>
                      <div className="flex gap-2 mt-2">
                        {cfg?.aboutUsContent?.stats?.customers && (
                          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                            {cfg.aboutUsContent.stats.customers} عميل
                          </span>
                        )}
                        {cfg?.aboutUsContent?.stats?.products && (
                          <span className="text-xs bg-secondary/10 text-secondary px-2 py-1 rounded">
                            {cfg.aboutUsContent.stats.products} منتج
                          </span>
                        )}
                      </div>
                    </div>
                    <Edit className="w-5 h-5 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </CardContent>
          </Card>

          </div>
        )}

        {/* Enhanced Hero Design Configuration Panel */}
        {/* Inline hero/slides editor removed. Editing is now exclusively handled in modals: 
            - HeroSlidesModal (slides)
            - HeroDesignModal (design)
        */}

        {/* Inline SEO editor removed. Use PromoSeoModal for promo + SEO editing. */}

        {/* Inline hero design/content controls removed. Use HeroDesignModal for all hero design settings. */}

        {/* Enhanced Hero Section */}
        {/* Inline hero design and interaction settings removed. Use HeroDesignModal to edit all hero settings. */}

        {/* About Us content removed from HomeConfig. Manage in Company Info page. */}

        {/* Work Hours removed from HomeConfig. Manage via Company Info page. */}

          {/* Company info (About & Work Hours) removed from HomeConfig. Manage in Company Info page. */}
          </div>
        )}

        {/* Mobile-Optimized Modal Dialogs for Detailed Editing */}

        {/* Hero Slides Management Modal */}
        <HeroSlidesModal
          open={heroSlidesOpen}
          onOpenChange={setHeroSlidesOpen}
          cfg={cfg}
          setCfg={setCfg}
          errors={errors}
          updateSlide={updateSlide}
          addSlide={addSlide}
          removeSlide={removeSlide}
        />

        {/* Hero Design Configuration Modal */}
        <HeroDesignModal
          open={heroDesignOpen}
          onOpenChange={setHeroDesignOpen}
          cfg={cfg}
          setCfg={setCfg}
        />

        {/* Sections Management Modal */}
        <SectionsManagementModal
          open={sectionsManagementOpen}
          onOpenChange={setSectionsManagementOpen}
          cfg={cfg}
          setCfg={setCfg}
          toggleMap={toggleMap}
        />

        {/* Products Management Modal */}
        <ProductsManagementModal
          open={productsManagementOpen}
          onOpenChange={setProductsManagementOpen}
          cfg={cfg}
          setCfg={setCfg}
          pickerOpen={pickerOpen || ''}
          setPickerOpen={(val: string) => setPickerOpen(val === '' ? false : val as 'featuredProducts' | 'categories' | 'bestSellers' | 'sale' | 'newArrivals')}
        />

        {/* Promo & SEO Modal */}
        <PromoSeoModal
          open={promoSeoOpen}
          onOpenChange={setPromoSeoOpen}
          cfg={cfg}
          setCfg={setCfg}
          errors={errors}
        />

        {/* About Content Modal */}
        <AboutContentModal
          open={aboutContentOpen}
          onClose={() => setAboutContentOpen(false)}
          initialData={cfg?.aboutUsContent}
          onSave={async (data) => {
            const updated = cfg ? { ...cfg, aboutUsContent: data } : cfg;
            if (updated) {
              setCfg(updated);
              // Save About content directly to backend, bypassing validation
              await saveSelections(updated);
              // Refresh the config to get the latest data from backend
              await new Promise(resolve => setTimeout(resolve, 500));
              await load();
            }
            setAboutContentOpen(false);
          }}
        />

        {/* Mobile-Optimized Picker Modal */}
        {pickerOpen && (
          <SelectionModal
            open={!!pickerOpen}
            title={pickerOpen === 'featuredProducts' ? 'اختيار المنتجات المميزة' :
                   pickerOpen === 'bestSellers' ? 'اختيار الأكثر مبيعاً' :
                   pickerOpen === 'sale' ? 'اختيار منتجات التخفيضات' :
                   pickerOpen === 'newArrivals' ? 'اختيار الوصولات الجديدة' :
                   'اختيار الفئات المميزة'}
            results={pickerResults}
            selected={pickerSelected}
            search={pickerSearch}
            loading={pickerLoading}
            visibleCount={pickerVisibleCount}
            onClose={() => setPickerOpen(false)}
            onSearch={setPickerSearch}
            onToggle={togglePick}
            onApply={applyPicker}
            onLoadMore={() => setPickerVisibleCount(prev => prev + 10)}
          />
        )}

      </div>
    </AdminLayout>
  );
};


// Modal Components for Detailed Editing
export default AdminHomeConfig;
