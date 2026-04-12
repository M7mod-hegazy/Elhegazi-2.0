import React, { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings as SettingsIcon, ShieldCheck } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPostJson, apiPutJson, uploadFile } from '@/lib/api';
import { clearThemeCache } from '@/lib/themeInit';
import { defaultOwnerVisibility } from '@/hooks/useOwnerVisibility';
import { LOGO_IMAGE_FALLBACK, applyLogoImageFallback } from '@/lib/images';

type OwnerVisibility = {
  publicPages: Record<string, boolean>;
  adminModules: Record<string, boolean>;
  featureFlags: Record<string, boolean>;
};

type SettingsDoc = {
  storeInfo?: { name?: string; description?: string; phone?: string; email?: string };
  social?: { facebookUrl?: string; messengerUrl?: string; whatsappUrl?: string; phoneCallLink?: string };
  logo?: { url?: string; altText?: string; publicId?: string; width?: number; height?: number };
  theme?: { primaryColor?: string; secondaryColor?: string };
  pricingSettings?: { hidePrices?: boolean };
  catalogSettings?: { familyCardsInListings?: boolean };
  checkoutEnabled?: boolean;
  shippingCost?: number;
  expressShippingCost?: number;
  freeShippingThreshold?: number | null;
  taxRate?: number | null;
  registrationSettings?: { allowNewRegistration?: boolean; requireEmailVerification?: boolean; requireAdminApproval?: boolean };
  orderSettings?: { autoConfirmOrders?: boolean; requirePaymentBeforeProcessing?: boolean; allowOrderCancellation?: boolean; cancellationPeriod?: number };
};

const CONTROL_CENTER_IDLE_MS = 15 * 60 * 1000;
type BackupTypeSummary = {
  module: string;
  moduleLabel?: string;
  incoming: number;
  existing: number;
  duplicates: number;
  exactMatches?: number;
  records?: number;
  recommendation?: string;
  suggestion?: { key?: string; text?: string };
  duplicateKeys?: string[];
  forecast?: {
    action?: string;
    toCreate?: number;
    toUpdate?: number;
    toSkip?: number;
    notes?: string;
  };
};

const AdminSettings: React.FC = () => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useState<'general' | 'control' | 'backup'>('general');
  const [controlSection, setControlSection] = useState<'visibility' | 'branding' | 'registration' | 'orders' | 'checkout' | 'pricing'>('visibility');
  const [loading, setLoading] = useState(false);
  const [controlSearch, setControlSearch] = useState('');

  const [storeInfo, setStoreInfo] = useState({ name: 'متجر إلكتروني', description: '', phone: '', email: '' });
  const [social, setSocial] = useState({ facebookUrl: '', messengerUrl: '', whatsappUrl: '', phoneCallLink: '' });
  const [logo, setLogo] = useState({ url: '/iconPng.png', altText: 'Store Logo', publicId: '' });
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#8B5CF6');
  const [hidePrices, setHidePrices] = useState(false);
  const [familyCardsInListings, setFamilyCardsInListings] = useState(false);
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  const [shippingCost, setShippingCost] = useState(25);
  const [expressShippingCost, setExpressShippingCost] = useState(50);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(300);
  const [taxRate, setTaxRate] = useState<number | null>(15);
  const [registrationSettings, setRegistrationSettings] = useState({
    allowNewRegistration: true,
    requireEmailVerification: true,
    requireAdminApproval: false,
  });
  const [orderSettings, setOrderSettings] = useState({
    autoConfirmOrders: false,
    requirePaymentBeforeProcessing: true,
    allowOrderCancellation: true,
    cancellationPeriod: 24,
  });

  const [logoMode, setLogoMode] = useState<'upload' | 'link'>('upload');
  const [logoLinkInput, setLogoLinkInput] = useState('');
  const [logoPreview, setLogoPreview] = useState('/iconPng.png');
  const [logoFile, setLogoFile] = useState<File | null>(null);

  const [controlCenterPassword, setControlCenterPassword] = useState('');
  const [controlCenterToken, setControlCenterToken] = useState('');
  const [controlCenterAuthed, setControlCenterAuthed] = useState(false);
  const [controlCenterBusy, setControlCenterBusy] = useState(false);
  const [controlCenterEnabled, setControlCenterEnabled] = useState(true);
  const [controlCenterVisibility, setControlCenterVisibility] = useState<OwnerVisibility>(defaultOwnerVisibility);

  const [backupStep, setBackupStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [backupMode, setBackupMode] = useState<'export' | 'import'>('export');
  const [allBackupModules, setAllBackupModules] = useState<string[]>([]);
  const [selectedBackupModules, setSelectedBackupModules] = useState<string[]>([]);
  const [backupFileRaw, setBackupFileRaw] = useState('');
  const [backupFileName, setBackupFileName] = useState('');
  const [backupFileSize, setBackupFileSize] = useState(0);
  const [backupDetectedType, setBackupDetectedType] = useState<'global' | 'builder' | 'settings' | 'unknown'>('unknown');
  const [backupPreview, setBackupPreview] = useState<Record<string, unknown> | null>(null);
  const [backupTypeSummaries, setBackupTypeSummaries] = useState<BackupTypeSummary[]>([]);
  const [exportTypeSummaries, setExportTypeSummaries] = useState<BackupTypeSummary[]>([]);
  const [exportItemPreview, setExportItemPreview] = useState<Record<string, Array<{ key: string; title: string }>>>({});
  const [backupItemPreview, setBackupItemPreview] = useState<Record<string, Array<{ key: string; title: string }>>>({});
  const [backupModuleDecisions, setBackupModuleDecisions] = useState<Record<string, 'merge' | 'replace' | 'skip'>>({});
  const [backupApplyMode, setBackupApplyMode] = useState<'merge' | 'replace'>('merge');
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupError, setBackupError] = useState('');
  const [backupShowAdvanced, setBackupShowAdvanced] = useState(false);

  const extractWhatsappNumber = (value: string): string => {
    const cleaned = (value || '').trim();
    if (!cleaned) return '';
    if (cleaned.includes('wa.me/')) return cleaned.replace(/^https?:\/\/wa\.me\//i, '');
    return cleaned.replace(/[^\d]/g, '');
  };

  const buildWhatsappUrl = (value: string): string => {
    let phone = extractWhatsappNumber(value);
    if (!phone) return '';
    if (phone.startsWith('0')) phone = `20${phone.slice(1)}`;
    if (!phone.startsWith('20') && phone.length === 10) phone = `20${phone}`;
    return `https://wa.me/${phone}`;
  };

  const controlHeaders = useMemo(() => {
    const headers: Record<string, string> = {};
    if (controlCenterToken) headers['x-owner-vault-token'] = controlCenterToken;
    const adminSecret = localStorage.getItem('ADMIN_SECRET');
    if (adminSecret) headers['x-admin-secret'] = adminSecret;
    return headers;
  }, [controlCenterToken]);

  const loadSettings = useCallback(async () => {
    const res = await apiGet<SettingsDoc>('/api/settings');
    if (!res.ok) throw new Error('error' in res ? res.error : 'Failed to load settings');
    const item = res.item || {};
    setStoreInfo((prev) => ({
      name: item.storeInfo?.name?.trim() || prev.name,
      description: item.storeInfo?.description || '',
      phone: item.storeInfo?.phone || '',
      email: item.storeInfo?.email || '',
    }));
    setSocial({
      facebookUrl: item.social?.facebookUrl || '',
      messengerUrl: item.social?.messengerUrl || '',
      whatsappUrl: item.social?.whatsappUrl || '',
      phoneCallLink: item.social?.phoneCallLink || '',
    });
    setLogo({
      url: item.logo?.url || '/iconPng.png',
      altText: item.logo?.altText || 'Store Logo',
      publicId: item.logo?.publicId || '',
    });
    setLogoPreview(item.logo?.url || '/iconPng.png');
    setPrimaryColor(item.theme?.primaryColor || '#3B82F6');
    setSecondaryColor(item.theme?.secondaryColor || '#8B5CF6');
    setHidePrices(Boolean(item.pricingSettings?.hidePrices));
    setFamilyCardsInListings(Boolean(item.catalogSettings?.familyCardsInListings));
    setCheckoutEnabled(item.checkoutEnabled ?? true);
    setShippingCost(item.shippingCost ?? 25);
    setExpressShippingCost(item.expressShippingCost ?? 50);
    setFreeShippingThreshold(item.freeShippingThreshold ?? 300);
    setTaxRate(item.taxRate ?? 15);
    if (item.registrationSettings) {
      setRegistrationSettings((prev) => ({
        allowNewRegistration: item.registrationSettings?.allowNewRegistration ?? prev.allowNewRegistration,
        requireEmailVerification: item.registrationSettings?.requireEmailVerification ?? prev.requireEmailVerification,
        requireAdminApproval: item.registrationSettings?.requireAdminApproval ?? prev.requireAdminApproval,
      }));
    }
    if (item.orderSettings) {
      setOrderSettings((prev) => ({
        autoConfirmOrders: item.orderSettings?.autoConfirmOrders ?? prev.autoConfirmOrders,
        requirePaymentBeforeProcessing: item.orderSettings?.requirePaymentBeforeProcessing ?? prev.requirePaymentBeforeProcessing,
        allowOrderCancellation: item.orderSettings?.allowOrderCancellation ?? prev.allowOrderCancellation,
        cancellationPeriod: item.orderSettings?.cancellationPeriod ?? prev.cancellationPeriod,
      }));
    }
  }, []);

  const loadControlCenter = useCallback(async () => {
    if (!controlCenterToken) return;
    const statusRes = await fetch('/api/owner-vault/status', { method: 'GET', headers: controlHeaders, credentials: 'include' });
    const statusData = await statusRes.json();
    if (!statusRes.ok || !statusData?.ok || !statusData.item?.authenticated) throw new Error('Control Center session invalid');
    const visRes = await fetch('/api/owner-vault/visibility', { method: 'GET', headers: controlHeaders, credentials: 'include' });
    const visData = await visRes.json();
    if (!visRes.ok || !visData?.ok) throw new Error(visData?.error || 'Failed to load Control Center data');
    setControlCenterEnabled(visData.item?.enabled !== false);
    setControlCenterVisibility({
      publicPages: { ...defaultOwnerVisibility.publicPages, ...(visData.item?.visibility?.publicPages || {}) },
      adminModules: { ...defaultOwnerVisibility.adminModules, ...(visData.item?.visibility?.adminModules || {}) },
      featureFlags: { ...defaultOwnerVisibility.featureFlags, ...(visData.item?.visibility?.featureFlags || {}) },
    });
  }, [controlCenterToken, controlHeaders]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (!controlCenterAuthed) return;
    let timer: number | null = null;
    const reset = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        setControlCenterAuthed(false);
        setControlCenterToken('');
        toast({ title: 'Control Center', description: 'انتهت الجلسة بسبب عدم النشاط لمدة 15 دقيقة', variant: 'destructive' });
      }, CONTROL_CENTER_IDLE_MS);
    };
    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, reset, { passive: true }));
    reset();
    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, reset));
    };
  }, [controlCenterAuthed, toast]);

  const saveGeneral = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const adminSecret = localStorage.getItem('ADMIN_SECRET');
      if (adminSecret) headers['x-admin-secret'] = adminSecret;
      const res = await apiPutJson('/api/settings', { storeInfo }, headers);
      if (!res.ok) throw new Error('error' in res ? res.error : 'Failed to save');
      toast({ title: 'تم الحفظ', description: 'تم تحديث معلومات المتجر' });
    } catch (error) {
      toast({ title: 'فشل الحفظ', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const saveSocial = async () => {
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      const adminSecret = localStorage.getItem('ADMIN_SECRET');
      if (adminSecret) headers['x-admin-secret'] = adminSecret;
      const res = await apiPutJson('/api/settings', { social }, headers);
      if (!res.ok) throw new Error('error' in res ? res.error : 'Failed to save social');
      toast({ title: 'تم الحفظ', description: 'تم تحديث الروابط الاجتماعية' });
    } catch (error) {
      toast({ title: 'فشل الحفظ', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const processAndSetLogoFromLink = () => {
    const cleaned = logoLinkInput.trim();
    if (!/^https?:\/\//i.test(cleaned)) {
      toast({ title: 'رابط غير صالح', description: 'يرجى إدخال رابط صورة يبدأ بـ http/https', variant: 'destructive' });
      return;
    }
    setLogoPreview(cleaned);
    setLogoFile(null);
  };

  const processAndSetLogoFromFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast({ title: 'ملف غير صالح', description: 'يجب رفع صورة', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'الحجم كبير', description: 'الحد الأقصى 5MB', variant: 'destructive' });
      return;
    }
    setLogoFile(file);
    setLogoPreview(URL.createObjectURL(file));
  };

  const saveBranding = async () => {
    if (!controlCenterAuthed) {
      toast({ title: 'Control Center', description: 'يلزم فتح Control Center لتعديل الهوية', variant: 'destructive' });
      return;
    }
    setControlCenterBusy(true);
    try {
      let finalLogoUrl = logo.url || '/iconPng.png';
      let finalPublicId = logo.publicId || '';
      if (logoMode === 'upload' && logoFile) {
        const uploaded = await uploadFile(logoFile, { folder: 'branding/logos' });
        finalLogoUrl = uploaded.secure_url;
        finalPublicId = uploaded.public_id;
      } else if (logoMode === 'link' && logoPreview.startsWith('http')) {
        finalLogoUrl = logoPreview;
        finalPublicId = '';
      }
      const res = await apiPutJson('/api/settings', {
        storeInfo,
        logo: { url: finalLogoUrl, altText: storeInfo.name || 'Store Logo', publicId: finalPublicId },
        theme: { primaryColor, secondaryColor },
      }, controlHeaders);
      if (!res.ok) throw new Error('error' in res ? res.error : 'Failed to save branding');
      clearThemeCache();
      localStorage.setItem('cached_site_name', storeInfo.name || 'متجر إلكتروني');
      localStorage.setItem('cached_site_logo', JSON.stringify({ url: finalLogoUrl, altText: storeInfo.name || 'Store Logo', publicId: finalPublicId, width: 150, height: 150 }));
      setLogo({ url: finalLogoUrl, altText: storeInfo.name || 'Store Logo', publicId: finalPublicId });
      toast({ title: 'تم الحفظ', description: 'تم تحديث اسم الموقع والشعار بنجاح' });
    } catch (error) {
      toast({ title: 'فشل الحفظ', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setControlCenterBusy(false);
    }
  };

  const saveControlCenterVisibility = async () => {
    setControlCenterBusy(true);
    try {
      const res = await fetch('/api/owner-vault/visibility', {
        method: 'PUT',
        headers: { ...controlHeaders, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: controlCenterEnabled, visibility: controlCenterVisibility }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'Failed');
      toast({ title: 'Control Center', description: 'تم حفظ سياسات الإظهار والإخفاء' });
    } catch (error) {
      toast({ title: 'Control Center', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setControlCenterBusy(false);
    }
  };

  const saveControlCenterSettings = async () => {
    setControlCenterBusy(true);
    try {
      const res = await apiPutJson('/api/settings', {
        pricingSettings: { hidePrices },
        catalogSettings: { familyCardsInListings },
        checkoutEnabled,
        shippingCost,
        expressShippingCost,
        freeShippingThreshold,
        taxRate,
        registrationSettings,
        orderSettings,
      }, controlHeaders);
      if (!res.ok) throw new Error('error' in res ? res.error : 'Failed');
      window.dispatchEvent(new Event('pricing-settings-changed'));
      toast({ title: 'Control Center', description: 'تم حفظ الإعدادات المتقدمة' });
    } catch (error) {
      toast({ title: 'Control Center', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setControlCenterBusy(false);
    }
  };

  const loginControlCenter = async () => {
    setControlCenterBusy(true);
    try {
      const res = await apiPostJson<{ token: string }>('/api/owner-vault/login', { password: controlCenterPassword });
      if (!res.ok || !res.item?.token) throw new Error('كلمة المرور غير صحيحة');
      setControlCenterToken(res.item.token);
      setControlCenterAuthed(true);
      setControlCenterPassword('');
      await loadControlCenter();
      toast({ title: 'Control Center', description: 'تم فتح التحكم المتقدم' });
    } catch (error) {
      toast({ title: 'Control Center', description: error instanceof Error ? error.message : 'Error', variant: 'destructive' });
    } finally {
      setControlCenterBusy(false);
    }
  };

  const detectBackupType = (payload: unknown): 'global' | 'builder' | 'settings' | 'unknown' => {
    const v = payload as Record<string, unknown>;
    if (v?.schemaVersion && v?.data) return 'global';
    if (v?.projectMeta && v?.layout) return 'builder';
    if (v?.settings) return 'settings';
    return 'unknown';
  };

  const loadBackupCapabilities = async () => {
    const res = await apiGet<{ modules: string[]; settingsModules?: string[]; defaults?: { selectedModules?: string[] } }>('/api/backups/capabilities');
    if (!res.ok) throw new Error('error' in res ? res.error : 'Failed to load backup capabilities');
    const sourceModules = res.item?.settingsModules || res.item?.modules || [];
    const modules = sourceModules.filter((m) => m !== 'products');
    setAllBackupModules(modules);
    const defaults = (res.item?.defaults?.selectedModules || []).filter((m) => m !== 'products');
    setSelectedBackupModules(defaults.length ? defaults : modules.filter((m) => m !== 'mediaManifest'));
  };

  const runExportPreview = async () => {
    setBackupBusy(true);
    setBackupError('');
    try {
      const safeModules = selectedBackupModules.filter((m) => m !== 'products');
      const res = await apiPostJson('/api/backups/export/preview', { selectedModules: safeModules });
      if (!res.ok) throw new Error('error' in res ? res.error : 'Failed to preview export');
      const payload = (res.item || {}) as Record<string, unknown>;
      setExportTypeSummaries((Array.isArray(payload?.typeSummaries) ? payload.typeSummaries : []) as BackupTypeSummary[]);
      setExportItemPreview((payload?.itemPreview as Record<string, Array<{ key: string; title: string }>>) || {});
      setBackupStep(3);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل معاينة التصدير';
      setBackupError(message);
      toast({ title: 'Backup Center', description: message, variant: 'destructive' });
    } finally {
      setBackupBusy(false);
    }
  };

  const runBackupPreview = async () => {
    setBackupBusy(true);
    setBackupError('');
    try {
      if (backupMode === 'export') {
        await loadBackupCapabilities();
        setBackupStep(3);
        return;
      }
      if (!backupFileRaw) throw new Error('ارفع ملف أولاً');
      const parsed = JSON.parse(backupFileRaw);
      const detected = detectBackupType(parsed);
      setBackupDetectedType(detected);
      if (detected === 'global') {
        const safeSelectedModules = (selectedBackupModules.length ? selectedBackupModules : (Array.isArray(parsed.modules) ? parsed.modules : []))
          .filter((m: string) => m !== 'products');
        const preview = await apiPostJson('/api/backups/import/preview', {
          backup: parsed,
          mode: backupApplyMode,
          selectedModules: safeSelectedModules.length ? safeSelectedModules : undefined,
        });
        if (!preview.ok) throw new Error('error' in preview ? preview.error : 'Failed to preview');
        const payload = (preview.item || null) as Record<string, unknown> | null;
        setBackupPreview(payload);
        const typeSummaries = Array.isArray(payload?.typeSummaries) ? (payload?.typeSummaries as BackupTypeSummary[]) : [];
        setBackupTypeSummaries(typeSummaries);
        setBackupItemPreview(((payload?.itemPreview as Record<string, Array<{ key: string; title: string }>>) || {}));
        if (safeSelectedModules.length) {
          const nextDecisions: Record<string, 'merge' | 'replace' | 'skip'> = {};
          safeSelectedModules.forEach((moduleName: string) => {
            nextDecisions[moduleName] = backupApplyMode;
          });
          setBackupModuleDecisions(nextDecisions);
        }
      } else {
        setBackupPreview({ detectedType: detected, message: 'تم التعرف على الملف وسيتم استخدام مسار الاستيراد المناسب.' });
        setBackupTypeSummaries([]);
        setBackupItemPreview({});
      }
      setBackupStep(4);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل تشغيل المعاينة';
      setBackupError(message);
      toast({ title: 'Backup Center', description: message, variant: 'destructive' });
    } finally {
      setBackupBusy(false);
    }
  };

  const executeBackupAction = async () => {
    setBackupBusy(true);
    setBackupError('');
    try {
      if (backupMode === 'export') {
        const exported = await apiPostJson('/api/backups/export', {
          mode: selectedBackupModules.length ? 'custom' : 'full',
          selectedModules: selectedBackupModules.length ? selectedBackupModules : undefined,
        });
        if (!exported.ok) throw new Error('error' in exported ? exported.error : 'Export failed');
        const payload = (exported.item || {}) as Record<string, unknown>;
        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `backup-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        setBackupStep(5);
        return;
      }

      const parsed = JSON.parse(backupFileRaw);
      if (backupDetectedType === 'global') {
        const effectiveSelected = selectedBackupModules.filter((m) => m !== 'products');
        const effectiveDecisions = Object.fromEntries(
          Object.entries(backupModuleDecisions).filter(([moduleName]) => effectiveSelected.includes(moduleName))
        );
        const apply = await apiPostJson('/api/backups/import/apply', {
          backup: parsed,
          mode: backupApplyMode,
          selectedModules: effectiveSelected.length ? effectiveSelected : undefined,
          moduleDecisions: effectiveDecisions,
          confirmText: backupApplyMode === 'replace' ? 'REPLACE' : undefined,
        });
        if (!apply.ok) throw new Error('error' in apply ? apply.error : 'Import failed');
        setBackupPreview((apply.item || null) as Record<string, unknown> | null);
      } else if (backupDetectedType === 'builder') {
        const apply = await apiPostJson('/api/builder/projects/import', parsed);
        if (!apply.ok) throw new Error('error' in apply ? apply.error : 'Import failed');
        setBackupPreview({ result: 'builder import completed' });
      } else if (backupDetectedType === 'settings') {
        const payload = parsed as { settings?: Record<string, unknown> };
        const apply = await apiPutJson('/api/settings', payload.settings || {});
        if (!apply.ok) throw new Error('error' in apply ? apply.error : 'Import failed');
        setBackupPreview({ result: 'settings import completed' });
        await loadSettings();
      } else {
        throw new Error('نوع الملف غير مدعوم');
      }
      setBackupStep(5);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'فشل تنفيذ العملية';
      setBackupError(message);
      toast({ title: 'Backup Center', description: message, variant: 'destructive' });
    } finally {
      setBackupBusy(false);
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-8">
        <Card>
          <CardHeader>
            <CardTitle>لوحة إعدادات المتجر</CardTitle>
            <CardDescription>واجهة حديثة مع استعادة كل الميزات القديمة المطلوبة</CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
          <TabsList className="grid grid-cols-[1fr_1fr_auto] w-full">
            <TabsTrigger value="general" className="order-1">إعدادات عامة</TabsTrigger>
            <TabsTrigger value="backup" className="order-2">Backup Center</TabsTrigger>
            <TabsTrigger value="control" className="order-3 w-10 min-w-10 px-0 justify-center" aria-label="Control Center">
              <SettingsIcon className="h-4 w-4" />
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader><CardTitle>معلومات المتجر</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>رقم الهاتف</Label><Input value={storeInfo.phone} onChange={(e) => setStoreInfo((p) => ({ ...p, phone: e.target.value }))} /></div>
                  <div className="space-y-2"><Label>البريد الإلكتروني</Label><Input value={storeInfo.email} onChange={(e) => setStoreInfo((p) => ({ ...p, email: e.target.value }))} /></div>
                </div>
                <div className="space-y-2"><Label>وصف المتجر</Label><Textarea value={storeInfo.description} onChange={(e) => setStoreInfo((p) => ({ ...p, description: e.target.value }))} /></div>
                <Button disabled={loading} onClick={saveGeneral}>{loading ? 'جاري الحفظ...' : 'حفظ معلومات المتجر'}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>الروابط الاجتماعية</CardTitle>
                <CardDescription>تمت إعادتها كتحكم مباشر للمشرف العادي كما كانت.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>رابط فيسبوك</Label>
                  <Input
                    placeholder="https://facebook.com/yourpage"
                    value={social.facebookUrl}
                    onChange={(e) => setSocial((p) => ({ ...p, facebookUrl: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>رابط صفحة فيسبوك</Label>
                  <Input
                    placeholder="https://m.me/elhegazi"
                    value={social.messengerUrl}
                    onChange={(e) => setSocial((p) => ({ ...p, messengerUrl: e.target.value }))}
                  />
                  <p className="text-xs text-slate-500">سيتم تحويل رابط الفيسبوك تلقائياً إلى رابط ماسنجر</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>رابط الواتساب</Label>
                    <Input
                      readOnly
                      value={buildWhatsappUrl(social.whatsappUrl)}
                      className="bg-green-50 border-green-300 text-green-700"
                    />
                    <p className="text-xs text-green-600">يتحدث تلقائياً</p>
                  </div>
                  <div className="space-y-2">
                    <Label>رقم واتساب</Label>
                    <Input
                      placeholder="201032440775"
                      value={extractWhatsappNumber(social.whatsappUrl)}
                      onChange={(e) => {
                        const nextUrl = buildWhatsappUrl(e.target.value);
                        setSocial((p) => ({ ...p, whatsappUrl: nextUrl }));
                      }}
                    />
                    <p className="text-xs text-slate-500">صيغة مصرية أو دولية</p>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>رابط الاتصال</Label>
                  <Input
                    placeholder="tel:+966123456789"
                    value={social.phoneCallLink}
                    onChange={(e) => setSocial((p) => ({ ...p, phoneCallLink: e.target.value }))}
                  />
                </div>
                <Button disabled={loading} onClick={saveSocial}>{loading ? 'جاري الحفظ...' : 'حفظ الروابط الاجتماعية'}</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="control" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Control Center</CardTitle>
                <CardDescription>الهوية، الأسعار، إعدادات التسجيل/الطلبات/الدفع، والتحكم التفصيلي بالصفحات والميزات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!controlCenterAuthed ? (
                  <div className="rounded-xl border border-dashed bg-slate-50 p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <ShieldCheck className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">توثيق Control Center</p>
                        <p className="text-xs text-slate-600">أدخل كلمة المرور للوصول إلى الإعدادات الحساسة (الجلسة آمنة ومحدودة بالوقت).</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>كلمة المرور</Label>
                      <Input
                        type="password"
                        autoComplete="current-password"
                        placeholder="••••••••"
                        value={controlCenterPassword}
                        onChange={(e) => setControlCenterPassword(e.target.value)}
                      />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <Button onClick={loginControlCenter} disabled={controlCenterBusy || !controlCenterPassword.trim()}>
                        {controlCenterBusy ? 'جارٍ التحقق...' : 'فتح Control Center'}
                      </Button>
                      <Button variant="outline" onClick={() => setControlCenterPassword('')} disabled={controlCenterBusy}>
                        مسح
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap gap-2">
                      <Button variant={controlSection === 'visibility' ? 'default' : 'outline'} onClick={() => setControlSection('visibility')}>التحكم التفصيلي</Button>
                      <Button variant={controlSection === 'branding' ? 'default' : 'outline'} onClick={() => setControlSection('branding')}>الهوية</Button>
                      <Button variant={controlSection === 'registration' ? 'default' : 'outline'} onClick={() => setControlSection('registration')}>التسجيل</Button>
                      <Button variant={controlSection === 'orders' ? 'default' : 'outline'} onClick={() => setControlSection('orders')}>الطلبات</Button>
                      <Button variant={controlSection === 'checkout' ? 'default' : 'outline'} onClick={() => setControlSection('checkout')}>الدفع</Button>
                      <Button variant={controlSection === 'pricing' ? 'default' : 'outline'} onClick={() => setControlSection('pricing')}>الأسعار</Button>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">تفعيل سياسات الإخفاء</p>
                        <p className="text-sm text-slate-500">تشغيل/إيقاف التحكم في إظهار الصفحات والميزات</p>
                      </div>
                      <Switch checked={controlCenterEnabled} onCheckedChange={setControlCenterEnabled} />
                    </div>

                    {controlSection === 'visibility' && (
                      <>
                        <Input placeholder="ابحث عن صفحة أو ميزة..." value={controlSearch} onChange={(e) => setControlSearch(e.target.value)} />
                        {(['publicPages', 'adminModules', 'featureFlags'] as Array<keyof OwnerVisibility>).map((scope) => (
                          <div key={scope} className="rounded-lg border p-3 space-y-2">
                            <p className="font-semibold">{scope === 'publicPages' ? 'الصفحات العامة' : scope === 'adminModules' ? 'وحدات الإدارة' : 'الميزات'}</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Object.entries(controlCenterVisibility[scope] || {})
                                .filter(([key]) => !controlSearch || key.toLowerCase().includes(controlSearch.toLowerCase()))
                                .map(([key, value]) => (
                                  <div key={`${scope}-${key}`} className="flex items-center justify-between rounded-md border p-2">
                                    <span className="text-sm">
                                      {key === 'latestWork'
                                        ? scope === 'publicPages'
                                          ? 'أعمالنا السابقة (صفحة الزوار)'
                                          : 'أعمالنا السابقة (الإدارة)'
                                        : key}
                                    </span>
                                    <Switch checked={Boolean(value)} onCheckedChange={(checked) => setControlCenterVisibility((prev) => ({ ...prev, [scope]: { ...prev[scope], [key]: checked } }))} />
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}
                        <Button onClick={saveControlCenterVisibility} disabled={controlCenterBusy}>{controlCenterBusy ? 'جارٍ الحفظ...' : 'حفظ سياسات الإظهار والإخفاء'}</Button>
                      </>
                    )}

                    {controlSection === 'branding' && (
                      <div className="space-y-4 rounded-lg border p-4">
                        <div className="space-y-2">
                          <Label>اسم الموقع</Label>
                          <Input value={storeInfo.name} onChange={(e) => setStoreInfo((p) => ({ ...p, name: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <Button variant={logoMode === 'upload' ? 'default' : 'outline'} onClick={() => setLogoMode('upload')}>رفع صورة</Button>
                          <Button variant={logoMode === 'link' ? 'default' : 'outline'} onClick={() => setLogoMode('link')}>رابط صورة</Button>
                        </div>
                        {logoMode === 'upload' ? (
                          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) processAndSetLogoFromFile(f); }} />
                        ) : (
                          <div className="flex gap-2">
                            <Input value={logoLinkInput} onChange={(e) => setLogoLinkInput(e.target.value)} placeholder="https://..." />
                            <Button variant="outline" onClick={processAndSetLogoFromLink}>فحص</Button>
                          </div>
                        )}
                        <div className="rounded-lg border p-3 flex items-center gap-3">
                          <img src={logoPreview || LOGO_IMAGE_FALLBACK} alt="Logo preview" className="w-20 h-20 rounded-md border object-contain" onError={applyLogoImageFallback} />
                          <p className="text-sm text-slate-600">معاينة قبل الحفظ - لن يتم تغيير الشعار إلا بعد الضغط على حفظ.</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2"><Label>Primary Color</Label><Input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} /></div>
                          <div className="space-y-2"><Label>Secondary Color</Label><Input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} /></div>
                        </div>
                        <Button onClick={saveBranding} disabled={controlCenterBusy}>{controlCenterBusy ? 'جارٍ الحفظ...' : 'حفظ الهوية البصرية'}</Button>
                      </div>
                    )}

                    {controlSection === 'registration' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between"><p>السماح بالتسجيل الجديد</p><Switch checked={registrationSettings.allowNewRegistration} onCheckedChange={(checked) => setRegistrationSettings((p) => ({ ...p, allowNewRegistration: checked }))} /></div>
                        <div className="flex items-center justify-between"><p>طلب تأكيد البريد الإلكتروني</p><Switch checked={registrationSettings.requireEmailVerification} onCheckedChange={(checked) => setRegistrationSettings((p) => ({ ...p, requireEmailVerification: checked }))} /></div>
                        <div className="flex items-center justify-between"><p>طلب موافقة المشرف</p><Switch checked={registrationSettings.requireAdminApproval} onCheckedChange={(checked) => setRegistrationSettings((p) => ({ ...p, requireAdminApproval: checked }))} /></div>
                        <Button onClick={saveControlCenterSettings} disabled={controlCenterBusy}>{controlCenterBusy ? 'جارٍ الحفظ...' : 'حفظ إعدادات التسجيل'}</Button>
                      </div>
                    )}

                    {controlSection === 'orders' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between"><p>تأكيد الطلبات تلقائياً</p><Switch checked={orderSettings.autoConfirmOrders} onCheckedChange={(checked) => setOrderSettings((p) => ({ ...p, autoConfirmOrders: checked }))} /></div>
                        <div className="flex items-center justify-between"><p>طلب الدفع قبل المعالجة</p><Switch checked={orderSettings.requirePaymentBeforeProcessing} onCheckedChange={(checked) => setOrderSettings((p) => ({ ...p, requirePaymentBeforeProcessing: checked }))} /></div>
                        <div className="flex items-center justify-between"><p>السماح بإلغاء الطلبات</p><Switch checked={orderSettings.allowOrderCancellation} onCheckedChange={(checked) => setOrderSettings((p) => ({ ...p, allowOrderCancellation: checked }))} /></div>
                        <div className="space-y-2"><Label>فترة الإلغاء (بالساعات)</Label><Input type="number" min={1} value={orderSettings.cancellationPeriod} onChange={(e) => setOrderSettings((p) => ({ ...p, cancellationPeriod: Number(e.target.value) || 24 }))} /></div>
                        <Button onClick={saveControlCenterSettings} disabled={controlCenterBusy}>{controlCenterBusy ? 'جارٍ الحفظ...' : 'حفظ إعدادات الطلبات'}</Button>
                      </div>
                    )}

                    {controlSection === 'checkout' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between"><p>تفعيل الدفع</p><Switch checked={checkoutEnabled} onCheckedChange={setCheckoutEnabled} /></div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>تكلفة الشحن القياسي</Label><Input type="number" value={shippingCost} onChange={(e) => setShippingCost(Number(e.target.value) || 0)} /></div>
                          <div className="space-y-2"><Label>تكلفة الشحن السريع</Label><Input type="number" value={expressShippingCost} onChange={(e) => setExpressShippingCost(Number(e.target.value) || 0)} /></div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-2"><Label>حد الشحن المجاني</Label><Input type="number" value={freeShippingThreshold ?? ''} onChange={(e) => setFreeShippingThreshold(e.target.value === '' ? null : Number(e.target.value))} /></div>
                          <div className="space-y-2"><Label>نسبة الضريبة</Label><Input type="number" value={taxRate ?? ''} onChange={(e) => setTaxRate(e.target.value === '' ? null : Number(e.target.value))} /></div>
                        </div>
                        <Button onClick={saveControlCenterSettings} disabled={controlCenterBusy}>{controlCenterBusy ? 'جارٍ الحفظ...' : 'حفظ إعدادات الدفع'}</Button>
                      </div>
                    )}

                    {controlSection === 'pricing' && (
                      <div className="space-y-3 rounded-lg border p-4">
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="font-medium">إخفاء الأسعار</p>
                            <p className="text-sm text-slate-500">إظهار "اتصل للحصول على السعر" بدلاً من الأسعار.</p>
                          </div>
                          <Switch checked={hidePrices} onCheckedChange={setHidePrices} />
                        </div>
                        <div className="flex items-center justify-between rounded-md border p-3">
                          <div>
                            <p className="font-medium">بطاقة واحدة لكل عائلة منتجات</p>
                            <p className="text-sm text-slate-500">
                              عند التفعيل: قوائم المتجر والأقسام تعرض بطاقة واحدة لكل عائلة، وصفحة المنتج تعرض اختيار المقاس/الخيارات، وجدول الإدارة يجمّع أفراد العائلة. عند الإيقاف يُخفى ذلك فقط ولا يُحذف أي ربط في قاعدة البيانات — أعد التفعيل لاستعادة السلوك كما كان.
                            </p>
                          </div>
                          <Switch checked={familyCardsInListings} onCheckedChange={setFamilyCardsInListings} />
                        </div>
                        <Button onClick={saveControlCenterSettings} disabled={controlCenterBusy}>{controlCenterBusy ? 'جارٍ الحفظ...' : 'حفظ إعدادات الأسعار والكتالوج'}</Button>
                      </div>
                    )}

                    <Button variant="outline" onClick={() => { setControlCenterAuthed(false); setControlCenterToken(''); }}>
                      إغلاق جلسة Control Center
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="backup" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Backup Center</CardTitle>
                <CardDescription>تصميم جديد بالكامل لمسارات التصدير والاستيراد مع خطوات أوضح وتحكم أدق</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="rounded-xl border bg-slate-50 p-3">
                  <p className="text-sm font-semibold mb-2">اختصارات المنتجات</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" onClick={() => navigate('/admin/products')}>
                      استيراد المنتجات (نسخة سريعة)
                    </Button>
                    <Button onClick={() => navigate('/admin/products')}>
                      تصدير المنتجات (نسخة سريعة)
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Button
                    variant={backupMode === 'export' ? 'default' : 'outline'}
                    onClick={() => {
                      setBackupMode('export');
                      setBackupStep(1);
                      setBackupPreview(null);
                      setBackupTypeSummaries([]);
                      setExportTypeSummaries([]);
                      setExportItemPreview({});
                      setBackupItemPreview({});
                      setBackupError('');
                    }}
                  >
                    مسار التصدير
                  </Button>
                  <Button
                    variant={backupMode === 'import' ? 'default' : 'outline'}
                    onClick={() => {
                      setBackupMode('import');
                      setBackupStep(1);
                      setBackupPreview(null);
                      setBackupTypeSummaries([]);
                      setExportTypeSummaries([]);
                      setExportItemPreview({});
                      setBackupItemPreview({});
                      setBackupError('');
                    }}
                  >
                    مسار الاستيراد
                  </Button>
                </div>

                {backupMode === 'export' ? (
                  <div className="space-y-4 rounded-xl border p-4">
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {['1) اختيار العملية', '2) الوحدات', '3) مراجعة النطاق', '4) إنشاء الملف', '5) الاكتمال'].map((step, idx) => (
                        <div key={step} className={`rounded-md border p-2 text-center ${backupStep >= idx + 1 ? 'bg-primary/10 border-primary text-primary font-semibold' : 'text-slate-500'}`}>
                          {step}
                        </div>
                      ))}
                    </div>

                    {backupStep === 1 && (
                      <div className="rounded-lg border border-dashed p-4">
                        <p className="font-medium">ابدأ عملية تصدير جديدة</p>
                        <p className="text-sm text-slate-500 mt-1">سيتم إنشاء نسخة احتياطية JSON حسب الوحدات التي تختارها.</p>
                        <Button className="mt-3" onClick={() => setBackupStep(2)}>متابعة</Button>
                      </div>
                    )}

                    {backupStep === 2 && (
                      <div className="space-y-3">
                        <Button variant="outline" onClick={loadBackupCapabilities}>تحميل الوحدات المتاحة</Button>
                        {allBackupModules.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBackupModules(allBackupModules)}
                            >
                              تحديد الكل
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedBackupModules([])}
                            >
                              إلغاء الكل
                            </Button>
                            <span className="text-xs text-slate-500 self-center">المحدد الآن: {selectedBackupModules.length}</span>
                          </div>
                        )}
                        {allBackupModules.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {allBackupModules.map((module) => (
                              <Button
                                key={module}
                                variant={selectedBackupModules.includes(module) ? 'default' : 'outline'}
                                onClick={() => setSelectedBackupModules((prev) => prev.includes(module) ? prev.filter((m) => m !== module) : [...prev, module])}
                              >
                                {module}
                              </Button>
                            ))}
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBackupStep(1)}>رجوع</Button>
                          <Button onClick={runExportPreview} disabled={selectedBackupModules.length === 0 || backupBusy}>
                            {backupBusy ? 'جاري التحليل...' : 'التالي: معاينة ذكية'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {backupStep === 3 && (
                      <div className="space-y-3">
                        <div className="rounded-md border bg-slate-50 p-3 text-sm">
                          <p>الوحدات المختارة: <strong>{selectedBackupModules.length || allBackupModules.length || 0}</strong></p>
                          <p className="text-slate-600 mt-1">معاينة تفصيلية لكل نوع قبل التصدير.</p>
                        </div>
                        {exportTypeSummaries.length > 0 ? (
                          <div className="space-y-2">
                            {exportTypeSummaries.map((summary) => (
                              <div key={`export-${summary.module}`} className="rounded-md border p-3">
                                <div className="flex items-center justify-between">
                                  <p className="font-medium">{summary.moduleLabel || summary.module}</p>
                                  <Button
                                    size="sm"
                                    variant={selectedBackupModules.includes(summary.module) ? 'default' : 'outline'}
                                    onClick={() => setSelectedBackupModules((prev) => prev.includes(summary.module) ? prev.filter((m) => m !== summary.module) : [...prev, summary.module])}
                                  >
                                    {selectedBackupModules.includes(summary.module) ? 'مُدرج' : 'إدراج'}
                                  </Button>
                                </div>
                                <div className="text-xs text-slate-600 mt-1">عدد السجلات: <strong>{summary.records ?? 0}</strong> — {summary.recommendation || 'جاهز'}</div>
                                {(exportItemPreview[summary.module] || []).length > 0 ? (
                                  <div className="mt-2 rounded bg-slate-50 p-2 text-xs">
                                    {(exportItemPreview[summary.module] || []).map((row) => (
                                      <div key={`${summary.module}-${row.key}-${row.title}`} className="flex justify-between gap-2 py-0.5">
                                        <span className="truncate">{row.title}</span>
                                        <span className="text-slate-500 truncate">{row.key}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBackupStep(2)}>رجوع</Button>
                          <Button onClick={() => setBackupStep(4)}>التالي</Button>
                        </div>
                      </div>
                    )}

                    {backupStep === 4 && (
                      <div className="space-y-3">
                        <p className="text-sm text-slate-600">الآن سيتم إنشاء ملف النسخة الاحتياطية وتنزيله.</p>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBackupStep(3)}>رجوع</Button>
                          <Button
                            disabled={backupBusy}
                            onClick={async () => {
                              await executeBackupAction();
                            }}
                          >
                            {backupBusy ? 'جاري إنشاء الملف...' : 'إنشاء وتصدير الملف'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {backupStep === 5 && (
                      <div className="space-y-3 rounded-md border border-green-300 bg-green-50 p-3">
                        <p className="text-green-700 font-semibold">تم التصدير بنجاح</p>
                        <Button variant="outline" onClick={() => { setBackupStep(1); setBackupPreview(null); }}>
                          تصدير جديد
                        </Button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4 rounded-xl border p-4">
                    <div className="grid grid-cols-5 gap-2 text-xs">
                      {['1) رفع الملف', '2) كشف النوع', '3) طريقة التطبيق', '4) المعاينة', '5) التنفيذ'].map((step, idx) => (
                        <div key={step} className={`rounded-md border p-2 text-center ${backupStep >= idx + 1 ? 'bg-primary/10 border-primary text-primary font-semibold' : 'text-slate-500'}`}>
                          {step}
                        </div>
                      ))}
                    </div>

                    {backupStep === 1 && (
                      <div className="space-y-3">
                        <Label>ارفع ملف JSON</Label>
                        <Input type="file" accept="application/json" onChange={async (e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const text = await f.text();
                          setBackupFileRaw(text);
                          setBackupFileName(f.name);
                          setBackupFileSize(f.size);
                          setBackupError('');
                        }} />
                        {backupFileName ? (
                          <div className="rounded-md border bg-slate-50 p-2 text-xs">
                            <p>الملف: {backupFileName}</p>
                            <p>الحجم: {(backupFileSize / (1024 * 1024)).toFixed(2)} MB</p>
                            {backupFileSize > 20 * 1024 * 1024 && (
                              <p className="text-amber-600 mt-1">تنبيه: الملف كبير جداً وقد يستغرق وقت أطول في المعاينة.</p>
                            )}
                          </div>
                        ) : null}
                        <Button disabled={!backupFileRaw} onClick={async () => {
                          try {
                            const parsed = JSON.parse(backupFileRaw);
                            setBackupDetectedType(detectBackupType(parsed));
                            if (Array.isArray(parsed?.modules)) {
                              const importedModules = (parsed.modules as string[]).filter((m) => m !== 'products');
                              if (importedModules.length) setSelectedBackupModules(importedModules);
                            }
                            setBackupStep(2);
                          } catch {
                            toast({ title: 'ملف غير صالح', description: 'تعذر قراءة ملف JSON', variant: 'destructive' });
                          }
                        }}>التالي</Button>
                      </div>
                    )}

                    {backupStep === 2 && (
                      <div className="space-y-3">
                        <div className="rounded-md border p-3 text-sm">
                          نوع الملف المكتشف: <strong>{backupDetectedType}</strong>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBackupStep(1)}>رجوع</Button>
                          <Button onClick={() => setBackupStep(3)}>التالي</Button>
                        </div>
                      </div>
                    )}

                    {backupStep === 3 && (
                      <div className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" variant="outline" onClick={loadBackupCapabilities}>تحديث أنواع البيانات</Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedBackupModules(allBackupModules.filter((m) => m !== 'mediaManifest'))}>تحديد الأنواع الأساسية</Button>
                          <Button size="sm" variant="outline" onClick={() => setSelectedBackupModules([])}>إلغاء جميع الأنواع</Button>
                        </div>
                        {allBackupModules.length > 0 ? (
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                            {allBackupModules.filter((m) => m !== 'products').map((moduleName) => (
                              <Button
                                key={`import-module-${moduleName}`}
                                variant={selectedBackupModules.includes(moduleName) ? 'default' : 'outline'}
                                onClick={() => setSelectedBackupModules((prev) => prev.includes(moduleName) ? prev.filter((m) => m !== moduleName) : [...prev, moduleName])}
                              >
                                {moduleName}
                              </Button>
                            ))}
                          </div>
                        ) : null}
                        <div className="flex gap-2">
                          <Button variant={backupApplyMode === 'merge' ? 'default' : 'outline'} onClick={() => setBackupApplyMode('merge')}>Merge</Button>
                          <Button variant={backupApplyMode === 'replace' ? 'default' : 'outline'} onClick={() => setBackupApplyMode('replace')}>Replace</Button>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBackupStep(2)}>رجوع</Button>
                          <Button disabled={backupBusy || selectedBackupModules.length === 0} onClick={async () => { await runBackupPreview(); }}>
                            {backupBusy ? 'جاري تحليل الملف...' : 'تشغيل المعاينة'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {backupStep === 4 && (
                      <div className="space-y-3">
                        {backupTypeSummaries.length > 0 ? (
                          <div className="space-y-3">
                            {backupTypeSummaries.map((summary) => (
                              <div key={summary.module} className="rounded-md border p-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="font-medium">{summary.moduleLabel || summary.module}</p>
                                  <div className="flex gap-1">
                                    <Button
                                      size="sm"
                                      variant={(backupModuleDecisions[summary.module] || backupApplyMode) === 'merge' ? 'default' : 'outline'}
                                      onClick={() => setBackupModuleDecisions((prev) => ({ ...prev, [summary.module]: 'merge' }))}
                                    >
                                      Merge
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={(backupModuleDecisions[summary.module] || backupApplyMode) === 'replace' ? 'default' : 'outline'}
                                      onClick={() => setBackupModuleDecisions((prev) => ({ ...prev, [summary.module]: 'replace' }))}
                                    >
                                      Replace
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant={(backupModuleDecisions[summary.module] || backupApplyMode) === 'skip' ? 'default' : 'outline'}
                                      onClick={() => setBackupModuleDecisions((prev) => ({ ...prev, [summary.module]: 'skip' }))}
                                    >
                                      Skip
                                    </Button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2 text-xs">
                                  <div className="rounded bg-slate-50 p-2">الوارد: <strong>{summary.incoming}</strong></div>
                                  <div className="rounded bg-slate-50 p-2">الحالي: <strong>{summary.existing}</strong></div>
                                  <div className="rounded bg-slate-50 p-2">التكرار: <strong>{summary.duplicates}</strong></div>
                                  <div className="rounded bg-slate-50 p-2">تطابق كامل: <strong>{summary.exactMatches ?? 0}</strong></div>
                                  <div className="rounded bg-slate-50 p-2">إنشاء متوقع: <strong>{summary.forecast?.toCreate ?? 0}</strong></div>
                                </div>
                                {summary.suggestion?.text ? (
                                  <div className="mt-2 rounded border border-emerald-300 bg-emerald-50 p-2 text-xs text-emerald-700">
                                    اقتراح ذكي: {summary.suggestion.text}
                                  </div>
                                ) : null}
                                {summary.forecast?.notes ? (
                                  <p className="text-xs text-slate-600 mt-2">{summary.forecast.notes}</p>
                                ) : null}
                                {(backupItemPreview[summary.module] || []).length > 0 ? (
                                  <div className="mt-2 rounded bg-slate-50 p-2 text-xs">
                                    <p className="font-medium mb-1">معاينة عناصر</p>
                                    {(backupItemPreview[summary.module] || []).map((row) => (
                                      <div key={`${summary.module}-${row.key}-${row.title}`} className="flex justify-between gap-2 py-0.5">
                                        <span className="truncate">{row.title}</span>
                                        <span className="text-slate-500 truncate">{row.key}</span>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-md border bg-slate-50 p-3 text-sm text-slate-600">
                            لا توجد معاينة تفصيلية لهذا النوع من الملفات.
                          </div>
                        )}
                        <Button variant="outline" onClick={() => setBackupShowAdvanced((v) => !v)}>
                          {backupShowAdvanced ? 'إخفاء البيانات الخام' : 'عرض البيانات الخام (متقدم)'}
                        </Button>
                        {backupShowAdvanced ? (
                          <pre className="max-h-72 overflow-auto rounded-md border bg-slate-50 p-3 text-xs">
                            {JSON.stringify(backupPreview || { message: 'No preview data' }, null, 2)}
                          </pre>
                        ) : null}
                        <div className="flex gap-2">
                          <Button variant="outline" onClick={() => setBackupStep(3)}>رجوع</Button>
                          <Button disabled={backupBusy} onClick={async () => { await executeBackupAction(); }}>
                            {backupBusy ? 'جاري تنفيذ الاستيراد...' : 'تطبيق الاستيراد'}
                          </Button>
                        </div>
                      </div>
                    )}

                    {backupStep === 5 && (
                      <div className="space-y-3 rounded-md border border-green-300 bg-green-50 p-3">
                        <p className="text-green-700 font-semibold">اكتمل الاستيراد بنجاح</p>
                        <pre className="max-h-72 overflow-auto rounded-md border bg-white p-3 text-xs">
                          {JSON.stringify(backupPreview || { status: 'done' }, null, 2)}
                        </pre>
                        <Button variant="outline" onClick={() => { setBackupStep(1); setBackupPreview(null); setBackupFileRaw(''); setBackupDetectedType('unknown'); }}>
                          استيراد جديد
                        </Button>
                      </div>
                    )}

                    {backupError ? (
                      <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                        {backupError}
                      </div>
                    ) : null}

                    {backupBusy ? (
                      <div className="rounded-md border bg-slate-50 p-3">
                        <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
                          <div className="h-full w-1/3 animate-pulse rounded bg-primary" />
                        </div>
                        <p className="text-xs text-slate-600 mt-2">جاري تنفيذ العملية... يرجى الانتظار</p>
                      </div>
                    ) : null}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;

