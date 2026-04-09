import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { clearThemeCache } from '@/lib/themeInit';
import { apiGet, apiPostJson, apiPutJson } from '@/lib/api';
import { themePresets, getCurrentTheme } from '@/lib/themePresets';
import { useSettings } from '@/hooks/useSettings';
import AdminLayout from '@/components/admin/AdminLayout';
import { 
  Settings as SettingsIcon, 
  Store, 
  ShoppingCart, 
  Database,
  Download,
  Upload,
  Users,
  Shield,
  Globe,
  Phone,
  Mail,
  Facebook,
  MessageCircle,
  CreditCard,
  Check
} from 'lucide-react';

// Types
interface StoreInfo {
  name: string;
  description: string;
  phone: string;
  email: string;
}

interface Social {
  facebookUrl: string;
  messengerUrl: string;
  whatsappUrl: string;
  phoneCallLink: string;
}

interface SettingsDoc {
  storeInfo?: StoreInfo;
  social?: Social;
  theme?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  checkoutEnabled?: boolean;
  shippingCost?: number;
  expressShippingCost?: number;
  freeShippingThreshold?: number;
  taxRate?: number;
  pricingSettings?: {
    hidePrices?: boolean;
    contactMessage?: string;
  };
}

// Hook placeholder
const useDeviceDetection = () => ({ isMobile: false, isTablet: false });
const OWNER_VAULT_IDLE_TIMEOUT_MS = 15 * 60 * 1000;

type OwnerVisibility = {
  publicPages: Record<string, boolean>;
  adminModules: Record<string, boolean>;
  featureFlags: Record<string, boolean>;
};

const AdminSettings = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [socialOpen, setSocialOpen] = useState(false);
  const [, setUserOpen] = useState(false);
  const [, setOrderOpen] = useState(false);
  const [, setCheckoutOpen] = useState(false);
  const [, setPricingOpen] = useState(false);
  const [ownerVaultOpen, setOwnerVaultOpen] = useState(false);
  const [ownerVaultPassword, setOwnerVaultPassword] = useState('');
  const [ownerVaultToken, setOwnerVaultToken] = useState<string>('');
  const [ownerVaultAuthed, setOwnerVaultAuthed] = useState(false);
  const [ownerVaultBusy, setOwnerVaultBusy] = useState(false);
  const [ownerVaultSearch, setOwnerVaultSearch] = useState('');
  const [ownerSection, setOwnerSection] = useState<'vault' | 'theme' | 'registration' | 'orders' | 'checkout' | 'pricing'>('vault');
  const [ownerVaultEnabled, setOwnerVaultEnabled] = useState(true);
  const [ownerVaultVisibility, setOwnerVaultVisibility] = useState<OwnerVisibility>({
    publicPages: {},
    adminModules: {},
    featureFlags: {},
  });

  // Get settings from useSettings
  const { 
    storeInfo: storeInfoFromHook,
    social: socialFromHook,
    checkoutEnabled: checkoutEnabledFromHook,
    shippingCost: shippingCostFromHook,
    expressShippingCost: expressShippingCostFromHook,
    freeShippingThreshold: freeShippingThresholdFromHook,
    taxRate: taxRateFromHook
  } = useSettings();

  // Defaults
  const defaultStoreInfo = {
    name: 'الحجازي لتجهيز المحلات',
    description: 'متجرك الإلكتروني المتكامل',
    phone: '+966501234567',
    email: 'info@store.com',
  };

  // Store Information State
  const [storeInfo, setStoreInfo] = useState(defaultStoreInfo);

  // Social / Contact Links
  const [social, setSocial] = useState<Social>({ facebookUrl: '', messengerUrl: '', whatsappUrl: '', phoneCallLink: '' });

  // Theme Settings (logo removed - now using fixed iconPng.png)
  const [primaryColor, setPrimaryColor] = useState('#3B82F6');
  const [secondaryColor, setSecondaryColor] = useState('#8B5CF6');

  // Checkout Settings
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  const [shippingCost, setShippingCost] = useState(25);
  const [expressShippingCost, setExpressShippingCost] = useState(50);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(300);
  const [taxRate, setTaxRate] = useState<number | null>(15);

  // Registration Settings
  const [registrationSettings, setRegistrationSettings] = useState({
    allowNewRegistration: true,
    requireEmailVerification: true,
    requireAdminApproval: false
  });

  // Order Settings
  const [orderSettings, setOrderSettings] = useState({
    autoConfirmOrders: false,
    requirePaymentBeforeProcessing: true,
    allowOrderCancellation: true,
    cancellationPeriod: 24
  });

  // Pricing Settings
  const [hidePrices, setHidePrices] = useState(false);

  type SettingsDoc = {
    storeInfo: StoreInfo;
    social?: Social;
    theme?: {
      logo?: string;
      primaryColor?: string;
      secondaryColor?: string;
    };
    checkoutEnabled?: boolean;
    shippingCost?: number;
    expressShippingCost?: number;
    freeShippingThreshold?: number | null;
    taxRate?: number | null;
    pricingSettings?: {
      hidePrices?: boolean;
    };
  };

  const isEmpty = (v?: string | null) => !v || !v.trim().length;

  const ownerVaultHeaders = useCallback(() => {
    const headers: Record<string, string> = {};
    if (ownerVaultToken) headers['x-owner-vault-token'] = ownerVaultToken;
    const adminSecret = localStorage.getItem('ADMIN_SECRET');
    if (adminSecret) headers['x-admin-secret'] = adminSecret;
    return headers;
  }, [ownerVaultToken]);

  const loadOwnerVaultVisibility = useCallback(async () => {
    if (!ownerVaultToken) return;
    const res = await fetch('/api/owner-vault/visibility', {
      method: 'GET',
      headers: ownerVaultHeaders(),
      credentials: 'include',
    });
    const data = await res.json();
    if (!res.ok || !data?.ok) throw new Error(data?.error || 'تعذر تحميل الإعدادات الخاصة');
    setOwnerVaultEnabled(data.item?.enabled !== false);
    setOwnerVaultVisibility(data.item?.visibility || { publicPages: {}, adminModules: {}, featureFlags: {} });
  }, [ownerVaultHeaders, ownerVaultToken]);

  // Load settings from API
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const res = await apiGet<SettingsDoc>('/api/settings');
        if (!res.ok) {
          const err = 'error' in res ? res.error : 'Failed to load settings';
          console.error('Failed to load settings', err);
          return;
        }
        const s = (res.item ?? null) as SettingsDoc | null;
        if (s) {

          
          // Normalize: prefer defaults when API returns empty strings
          if (s.storeInfo) {
            const next = {
              name: defaultStoreInfo.name, // Always use hardcoded name - never change
              description: !isEmpty(s.storeInfo.description) ? s.storeInfo.description : defaultStoreInfo.description,
              phone: !isEmpty(s.storeInfo.phone) ? s.storeInfo.phone : defaultStoreInfo.phone,
              email: !isEmpty(s.storeInfo.email) ? s.storeInfo.email : defaultStoreInfo.email,
            };
            setStoreInfo(next);
          }
          if (s.social) {


            setSocial({
              facebookUrl: s.social.facebookUrl || '',
              messengerUrl: s.social.messengerUrl || '',
              whatsappUrl: s.social.whatsappUrl || '',
              phoneCallLink: s.social.phoneCallLink || '',
            });
          }

          // Set theme settings (logo removed - now using fixed iconPng.png)
          if (s.theme) {

            if (s.theme.primaryColor) setPrimaryColor(s.theme.primaryColor);
            if (s.theme.secondaryColor) setSecondaryColor(s.theme.secondaryColor);
          } else {

          }
          
          // Set checkout settings
          if (s.checkoutEnabled !== undefined) {
            setCheckoutEnabled(s.checkoutEnabled);
          }
          if (s.shippingCost !== undefined) {
            setShippingCost(s.shippingCost);
          }
          if (s.expressShippingCost !== undefined) {
            setExpressShippingCost(s.expressShippingCost);
          }
          if (s.freeShippingThreshold !== undefined) {
            setFreeShippingThreshold(s.freeShippingThreshold);
          }
          if (s.taxRate !== undefined) {
            setTaxRate(s.taxRate);
          }
          
          // Load pricing settings
          if (s.pricingSettings) {
            if (s.pricingSettings.hidePrices !== undefined) {
              setHidePrices(s.pricingSettings.hidePrices);
            }
          }
        }
        setLoaded(true);
      } catch (e) {
        console.error('Failed to load settings', e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [
    defaultStoreInfo.description,
    defaultStoreInfo.email,
    defaultStoreInfo.name,
    defaultStoreInfo.phone
  ]);

  useEffect(() => {
    // Force Owner Vault to close on full page reload (does not affect admin auth).
    (async () => {
      try {
        const adminSecret = localStorage.getItem('ADMIN_SECRET');
        const headers: Record<string, string> = {};
        if (adminSecret) headers['x-admin-secret'] = adminSecret;
        await fetch('/api/owner-vault/logout', {
          method: 'POST',
          headers,
          credentials: 'include',
        });
      } catch {
        // ignore
      } finally {
        setOwnerVaultAuthed(false);
        setOwnerVaultToken('');
      }
    })();
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      if (!ownerVaultToken) return;
      try {
        const res = await fetch('/api/owner-vault/status', {
          method: 'GET',
          headers: ownerVaultHeaders(),
          credentials: 'include',
        });
        const data = await res.json();
        if (mounted && res.ok && data?.ok && data.item?.authenticated) {
          setOwnerVaultAuthed(true);
          await loadOwnerVaultVisibility();
          return;
        }
      } catch {
        // ignore
      }
      if (!mounted) return;
      setOwnerVaultAuthed(false);
      setOwnerVaultToken('');
    })();
    return () => {
      mounted = false;
    };
  }, [ownerVaultHeaders, ownerVaultToken, loadOwnerVaultVisibility]);

  const saveSettings = useCallback(
    async (quiet = false, context?: 'store' | 'social' | 'registration' | 'orders' | 'checkout' | 'theme' | 'pricing') => {
      try {
        setLoading(true);
        const body = {
          storeInfo,
          social,
          theme: {
            primaryColor,
            secondaryColor
          },
          checkoutEnabled,
          shippingCost,
          expressShippingCost,
          freeShippingThreshold,
          taxRate,
          pricingSettings: {
            hidePrices
          }
        };



        const headers: Record<string, string> = {};
        const adminSecret = localStorage.getItem('ADMIN_SECRET');
        if (adminSecret) headers['x-admin-secret'] = adminSecret;
        const res = await apiPutJson<SettingsDoc, typeof body>('/api/settings', body, headers);

        if (!res.ok) {
          throw new Error('error' in res ? res.error : 'Save failed');
        }
        if (!quiet) {
          toast({ title: 'تم الحفظ', description: 'تم تحديث الإعدادات بنجاح' });
        }
        return res; // Return the response
      } catch (e) {
        console.error('Save settings error:', e);
        const message = e instanceof Error ? e.message : 'تعذر حفظ الإعدادات';
        toast({ title: 'فشل الحفظ', description: message, variant: 'destructive' });
        throw e; // Re-throw so handleSaveTheme can catch it
      } finally {
        setLoading(false);
      }
    },
    [storeInfo, social, primaryColor, secondaryColor, checkoutEnabled, shippingCost, expressShippingCost, freeShippingThreshold, taxRate, hidePrices, toast]
  );

  const handleSaveStoreInfo = async () => {
    await saveSettings(false, 'store');
  };

  const handleSaveSocial = async () => {
    await saveSettings(false, 'social');
  };

  const handleSaveRegistration = async () => {
    await saveSettings(false, 'registration');
  };

  const handleSaveOrders = async () => {
    await saveSettings(false, 'orders');
  };

  const handleSaveCheckout = async () => {
    await saveSettings(false, 'checkout');
  };


  const handleSaveTheme = async () => {
    try {
      // Clear theme cache before saving
      clearThemeCache();
      
      const adminSecret = localStorage.getItem('ADMIN_SECRET');
      const headers: Record<string, string> = {};
      if (adminSecret) headers['x-admin-secret'] = adminSecret;

      // Save theme with colors only (logo is now fixed)
      // Note: We include the full theme object for consistency
      const res = await apiPutJson('/api/settings', {
        theme: {
          primaryColor,
          secondaryColor
        }
      }, headers);
      
      if (!res.ok) {
        throw new Error('error' in res ? res.error : 'Save failed');
      }
      
      toast({ title: 'تم الحفظ', description: 'سيتم تحديث الصفحة لتطبيق التغييرات' });
      
      // Clear cache again after successful save
      clearThemeCache();
      
      // Reload the page to apply theme changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to save theme:', error);
      const message = error instanceof Error ? error.message : 'فشل حفظ الإعدادات';
      toast({ title: 'خطأ', description: message, variant: 'destructive' });
    }
  };

  const handleOwnerVaultLogin = async () => {
    try {
      setOwnerVaultBusy(true);
      const res = await apiPostJson<{ token: string }>('/api/owner-vault/login', { password: ownerVaultPassword });
      if (!res.ok || !res.item?.token) throw new Error('كلمة المرور غير صحيحة');
      setOwnerVaultToken(res.item.token);
      setOwnerVaultAuthed(true);
      setOwnerVaultPassword('');
      await loadOwnerVaultVisibility();
      toast({ title: 'الإعدادات الخاصة', description: 'تم فتح الإعدادات الخاصة بنجاح' });
    } catch (error) {
      toast({
        title: 'الإعدادات الخاصة',
        description: error instanceof Error ? error.message : 'تعذر تسجيل الدخول',
        variant: 'destructive',
      });
    } finally {
      setOwnerVaultBusy(false);
    }
  };

  const autoSaveOwnerVaultState = useCallback(async () => {
    if (!ownerVaultAuthed) return;
    try {
      if (ownerSection === 'vault') {
        const res = await fetch('/api/owner-vault/visibility', {
          method: 'PUT',
          headers: { ...ownerVaultHeaders(), 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ enabled: ownerVaultEnabled, visibility: ownerVaultVisibility }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) throw new Error(data?.error || 'تعذر حفظ إعدادات الإخفاء');
        return;
      }
      await saveSettings(true, ownerSection);
    } catch (error) {
      console.error('Owner vault autosave failed:', error);
    }
  }, [ownerSection, ownerVaultAuthed, ownerVaultEnabled, ownerVaultHeaders, ownerVaultVisibility, saveSettings]);

  const handleOwnerVaultLogout = async (mode: 'manual' | 'idle' | 'reload' = 'manual') => {
    try {
      setOwnerVaultBusy(true);
      await autoSaveOwnerVaultState();
      await fetch('/api/owner-vault/logout', {
        method: 'POST',
        headers: ownerVaultHeaders(),
        credentials: 'include',
      });
      if (mode !== 'reload') {
        toast({ title: 'الإعدادات الخاصة', description: mode === 'idle' ? 'تم تسجيل الخروج تلقائيًا بعد 15 دقيقة خمول' : 'تم تسجيل الخروج من الإعدادات الخاصة' });
      }
    } catch {
      // ignore
    } finally {
      setOwnerVaultToken('');
      setOwnerVaultAuthed(false);
      setOwnerVaultBusy(false);
    }
  };

  useEffect(() => {
    if (!ownerVaultAuthed) return;
    let timer: number | null = null;

    const resetTimer = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        handleOwnerVaultLogout('idle');
      }, OWNER_VAULT_IDLE_TIMEOUT_MS);
    };

    const events: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart'];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timer) window.clearTimeout(timer);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [ownerVaultAuthed, handleOwnerVaultLogout]);

  useEffect(() => {
    if (!ownerVaultAuthed) return;

    const handleBeforeUnload = () => {
      const payload = JSON.stringify({ enabled: ownerVaultEnabled, visibility: ownerVaultVisibility });
      try {
        fetch('/api/owner-vault/visibility', {
          method: 'PUT',
          headers: { ...ownerVaultHeaders(), 'Content-Type': 'application/json' },
          credentials: 'include',
          body: payload,
          keepalive: true,
        });
        fetch('/api/owner-vault/logout', {
          method: 'POST',
          headers: ownerVaultHeaders(),
          credentials: 'include',
          keepalive: true,
        });
      } catch {
        // ignore
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [ownerVaultAuthed, ownerVaultEnabled, ownerVaultHeaders, ownerVaultVisibility]);

  const handleOwnerToggle = (scope: keyof OwnerVisibility, key: string, value: boolean) => {
    setOwnerVaultVisibility((prev) => ({
      ...prev,
      [scope]: {
        ...(prev[scope] || {}),
        [key]: value,
      },
    }));
  };

  const handleSaveOwnerVisibility = async () => {
    try {
      setOwnerVaultBusy(true);
      const res = await fetch('/api/owner-vault/visibility', {
        method: 'PUT',
        headers: { ...ownerVaultHeaders(), 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ enabled: ownerVaultEnabled, visibility: ownerVaultVisibility }),
      });
      const data = await res.json();
      if (!res.ok || !data?.ok) throw new Error(data?.error || 'تعذر حفظ الإعدادات الخاصة');
      toast({ title: 'الإعدادات الخاصة', description: 'تم حفظ إعدادات الإخفاء' });
    } catch (error) {
      toast({
        title: 'الإعدادات الخاصة',
        description: error instanceof Error ? error.message : 'تعذر حفظ الإعدادات الخاصة',
        variant: 'destructive',
      });
    } finally {
      setOwnerVaultBusy(false);
    }
  };

  const handleBackupData = () => {
    const data = {
      settings: { storeInfo, social, checkoutEnabled, shippingCost, expressShippingCost, freeShippingThreshold, taxRate },
      timestamp: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `store-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestoreData = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.settings) {
          if (data.settings.storeInfo) setStoreInfo(data.settings.storeInfo);
          if (data.settings.social) setSocial(data.settings.social);
          if (data.settings.checkoutEnabled !== undefined) setCheckoutEnabled(data.settings.checkoutEnabled);
          if (data.settings.shippingCost !== undefined) setShippingCost(data.settings.shippingCost);
          if (data.settings.expressShippingCost !== undefined) setExpressShippingCost(data.settings.expressShippingCost);
          if (data.settings.freeShippingThreshold !== undefined) setFreeShippingThreshold(data.settings.freeShippingThreshold);
          if (data.settings.taxRate !== undefined) setTaxRate(data.settings.taxRate);
          
          toast({ title: 'تم الاستعادة', description: 'تم استعادة الإعدادات من النسخة الاحتياطية' });
        }
      } catch (error) {
        toast({ title: 'فشل الاستعادة', description: 'تعذر قراءة ملف النسخة الاحتياطية', variant: 'destructive' });
      }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset input
  };

  return (
    <AdminLayout>
      <div className="space-y-6 pb-8">
        <Card className="border-slate-200/80 bg-white shadow-sm">
          <CardContent className="p-6 md:p-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900">لوحة إعدادات المتجر</h1>
                <p className="mt-1 text-sm text-slate-600">إدارة الهوية، الروابط، وإعدادات المالك من واجهة واحدة منظمة.</p>
              </div>
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <p className="text-xs text-slate-500">الوضع الحالي</p>
                  <p className="text-sm font-bold text-slate-900">{ownerVaultOpen ? 'إعدادات خاصة' : socialOpen ? 'روابط اجتماعية' : 'معلومات المتجر'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
                  <p className="text-xs text-slate-500">الحالة</p>
                  <p className="text-sm font-bold text-slate-900">{loading ? 'جاري الحفظ' : 'جاهز'}</p>
                </div>
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-center col-span-2 md:col-span-1">
                  <p className="text-xs text-slate-500">Owner Vault</p>
                  <p className="text-sm font-bold text-slate-900">{ownerVaultAuthed ? 'مفعّل' : 'مقفل'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
          <div className="space-y-4 xl:col-span-4">
            <div className="xl:sticky xl:top-24 space-y-4">
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <SettingsIcon className="w-5 h-5" />
                    لوحة التحكم
                  </CardTitle>
                  <CardDescription>اختر القسم الذي تريد العمل عليه</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant={storeOpen ? "default" : "outline"}
                    className="h-12 w-full justify-between rounded-xl"
                    onClick={() => {
                      setStoreOpen(true);
                      setSocialOpen(false);
                      setUserOpen(false);
                      setOrderOpen(false);
                      setCheckoutOpen(false);
                      setPricingOpen(false);
                      setOwnerVaultOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Store className="w-4 h-4" />
                      معلومات المتجر
                    </span>
                    <span className="text-xs opacity-75">عام</span>
                  </Button>
                  <Button
                    variant={socialOpen ? "default" : "outline"}
                    className="h-12 w-full justify-between rounded-xl"
                    onClick={() => {
                      setStoreOpen(false);
                      setSocialOpen(true);
                      setUserOpen(false);
                      setOrderOpen(false);
                      setCheckoutOpen(false);
                      setPricingOpen(false);
                      setOwnerVaultOpen(false);
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Globe className="w-4 h-4" />
                      الروابط الاجتماعية
                    </span>
                    <span className="text-xs opacity-75">تواصل</span>
                  </Button>
                  <Button
                    variant={ownerVaultOpen ? "default" : "outline"}
                    className="h-12 w-full justify-between rounded-xl"
                    onClick={() => {
                      setStoreOpen(false);
                      setSocialOpen(false);
                      setUserOpen(false);
                      setOrderOpen(false);
                      setCheckoutOpen(false);
                      setPricingOpen(false);
                      setOwnerVaultOpen(true);
                      setOwnerSection('vault');
                    }}
                  >
                    <span className="flex items-center gap-2">
                      <Shield className="w-4 h-4" />
                      إعدادات خاصة
                    </span>
                    <span className="text-xs opacity-75">مالك</span>
                  </Button>
                </CardContent>
              </Card>

              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Database className="w-5 h-5" />
                    الأدوات
                  </CardTitle>
                  <CardDescription>نسخة احتياطية واسترجاع سريع</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="h-11 w-full rounded-xl" onClick={handleBackupData}>
                    <Download className="w-4 h-4 ml-2" />
                    تصدير الإعدادات
                  </Button>
                  <div>
                    <Label htmlFor="restore-file" className="cursor-pointer">
                      <Button variant="outline" className="h-11 w-full rounded-xl" asChild>
                        <span>
                          <Upload className="w-4 h-4 ml-2" />
                          استيراد الإعدادات
                        </span>
                      </Button>
                    </Label>
                    <Input
                      id="restore-file"
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleRestoreData}
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6 xl:col-span-8">
            {ownerVaultOpen && ownerVaultAuthed && (
              <Card className="sticky top-20 z-20 border-slate-200/90 bg-white/95 shadow-sm backdrop-blur">
                <CardContent className="p-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-700">تنقل الإعدادات الخاصة</p>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-slate-500">خروج تلقائي بعد 15 دقيقة خمول</span>
                        <Button variant="outline" size="sm" className="rounded-lg" disabled={ownerVaultBusy} onClick={() => handleOwnerVaultLogout('manual')}>
                          خروج
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button variant={ownerSection === 'vault' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setOwnerSection('vault')}>التحكم</Button>
                      <Button variant={ownerSection === 'theme' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setOwnerSection('theme')}>الثيم والألوان</Button>
                      <Button variant={ownerSection === 'registration' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setOwnerSection('registration')}>إعدادات التسجيل</Button>
                      <Button variant={ownerSection === 'orders' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setOwnerSection('orders')}>إعدادات الطلبات</Button>
                      <Button variant={ownerSection === 'checkout' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setOwnerSection('checkout')}>إعدادات الدفع</Button>
                      <Button variant={ownerSection === 'pricing' ? 'default' : 'outline'} size="sm" className="rounded-lg" onClick={() => setOwnerSection('pricing')}>إعدادات الأسعار</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Store Information */}
            {(storeOpen || (ownerVaultOpen && ownerSection === 'theme')) && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="w-5 h-5" />
                    معلومات المتجر
                  </CardTitle>
                  <CardDescription>
                    قم بتحديث معلومات المتجر الأساسية والشعار والألوان
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-300 rounded-lg">
                    <Label className="text-base font-bold text-blue-900">اسم المتجر (ثابت)</Label>
                    <div className="mt-3 px-4 py-3 bg-white border-2 border-blue-400 rounded-lg text-center">
                      <p className="text-2xl font-bold text-blue-700">{storeInfo.name}</p>
                    </div>
                    <p className="text-sm text-blue-700 mt-2 font-medium">⚠️ اسم المتجر ثابت ولا يمكن تغييره من هنا</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="store-phone">رقم الهاتف</Label>
                      <Input
                        id="store-phone"
                        value={storeInfo.phone}
                        onChange={(e) => setStoreInfo({ ...storeInfo, phone: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="store-email">البريد الإلكتروني</Label>
                      <Input
                        id="store-email"
                        type="email"
                        value={storeInfo.email}
                        onChange={(e) => setStoreInfo({ ...storeInfo, email: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="store-description">وصف المتجر</Label>
                    <Textarea
                      id="store-description"
                      value={storeInfo.description}
                      onChange={(e) => setStoreInfo({ ...storeInfo, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  {/* Logo Info - Now Fixed */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label>شعار الموقع</Label>
                    <div className="flex items-center gap-4">
                      <div className="w-24 h-24 border-2 border-slate-300 rounded-lg p-2 flex items-center justify-center bg-slate-50">
                        <img src="/iconPng.png" alt="Logo" className="max-w-full max-h-full object-contain" />
                      </div>
                      <div className="flex-1">
                        <div className="mb-2 text-sm text-blue-600 flex items-center gap-2">
                          <span>ℹ️</span>
                          <span>يتم استخدام الشعار الثابت (iconPng.png)</span>
                        </div>
                        <p className="text-xs text-slate-500">
                          الشعار الآن ثابت ولا يمكن تغييره من خلال الإعدادات. لتغيير الشعار، يرجى استبدال ملف iconPng.png في مجلد public.
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Theme Presets */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label>اختر ثيم جاهز</Label>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                      {themePresets.map((preset) => {
                        const isActive = preset.primaryColor === primaryColor && preset.secondaryColor === secondaryColor;
                        return (
                          <button
                            key={preset.id}
                            onClick={() => {
                              setPrimaryColor(preset.primaryColor);
                              setSecondaryColor(preset.secondaryColor);
                              toast({ title: 'تم التطبيق', description: `تم تطبيق ثيم ${preset.nameAr}` });
                            }}
                            className={`relative p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                              isActive ? 'border-primary ring-2 ring-primary/20' : 'border-slate-200 hover:border-slate-300'
                            }`}
                            style={{ background: preset.preview.gradient }}
                          >
                            {isActive && (
                              <div className="absolute top-1 right-1 bg-white rounded-full p-1">
                                <Check className="w-3 h-3 text-primary" />
                              </div>
                            )}
                            <div className="text-center">
                              <p className="text-xs font-semibold text-white drop-shadow-lg">
                                {preset.nameAr}
                              </p>
                              <p className="text-[10px] text-white/90 mt-1">
                                {preset.descriptionAr}
                              </p>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Primary Color */}
                  <div className="space-y-3">
                    <Label htmlFor="primary-color">اللون الأساسي (مخصص)</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="primary-color"
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="w-20 h-10 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        className="flex-1"
                        placeholder="#3B82F6"
                      />
                      <div 
                        className="w-10 h-10 rounded-lg border-2 border-slate-200"
                        style={{ backgroundColor: primaryColor }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      يستخدم للأزرار والروابط والعناصر الرئيسية
                    </p>
                  </div>

                  {/* Secondary Color */}
                  <div className="space-y-3">
                    <Label htmlFor="secondary-color">اللون الثانوي</Label>
                    <div className="flex items-center gap-4">
                      <Input
                        id="secondary-color"
                        type="color"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="w-20 h-10 cursor-pointer"
                      />
                      <Input
                        type="text"
                        value={secondaryColor}
                        onChange={(e) => setSecondaryColor(e.target.value)}
                        className="flex-1"
                        placeholder="#8B5CF6"
                      />
                      <div 
                        className="w-10 h-10 rounded-lg border-2 border-slate-200"
                        style={{ backgroundColor: secondaryColor }}
                      />
                    </div>
                    <p className="text-xs text-slate-500">
                      يستخدم للعناوين والعناصر الثانوية
                    </p>
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={handleSaveStoreInfo} disabled={loading} className="flex-1">
                      {loading ? 'جاري الحفظ...' : 'حفظ معلومات المتجر'}
                    </Button>
                    <Button onClick={handleSaveTheme} disabled={loading} className="flex-1">
                      {loading ? 'جاري الحفظ...' : 'حفظ الألوان'}
                    </Button>
                    <Button 
                      onClick={() => {
                        // Reset colors to default
                        setPrimaryColor('#3B82F6');
                        setSecondaryColor('#8B5CF6');
                        toast({ title: 'تم الإستعادة', description: 'تم استعادة الألوان الافتراضية (الأزرق والبنفسجي)' });
                      }} 
                      variant="outline"
                      disabled={loading}
                    >
                      استعادة الألوان الافتراضية
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}


            {/* Social Links */}
            {socialOpen && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    الروابط الاجتماعية
                  </CardTitle>
                  <CardDescription>
                    روابط التواصل الاجتماعي ووسائل الاتصال
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <Facebook className="w-5 h-5 text-primary" />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="facebook-url">رابط فيسبوك</Label>
                        <Input
                          id="facebook-url"
                          placeholder="https://facebook.com/yourpage"
                          value={social.facebookUrl || ''}
                          onChange={(e) => setSocial({ ...social, facebookUrl: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MessageCircle className="w-5 h-5 text-primary" />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="messenger-url">رابط صفحة فيسبوك</Label>
                        <Input
                          id="messenger-url"
                          placeholder="https://www.facebook.com/yourpage أو معرف الصفحة"
                          value={social.messengerUrl || ''}
                          onChange={(e) => setSocial({ ...social, messengerUrl: e.target.value })}
                        />
                        <p className="text-xs text-slate-500">
                          ✓ سيتم تحويل رابط الفيسبوك تلقائياً إلى رابط ماسنجر
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MessageCircle className="w-5 h-5 text-green-500 mt-2 flex-shrink-0" />
                      <div className="flex-1 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="whatsapp-phone">رقم واتساب</Label>
                            <Input
                              id="whatsapp-phone"
                              placeholder="01001234567 أو 966501234567"
                              value={social.whatsappUrl ? (
                                social.whatsappUrl.includes('wa.me/') 
                                  ? social.whatsappUrl.replace('https://wa.me/', '')
                                  : social.whatsappUrl
                              ) : ''}
                              onChange={(e) => {
                                let phone = e.target.value.trim();
                                // Remove any spaces or dashes
                                phone = phone.replace(/[\s-]/g, '');
                                // If it starts with 0, replace with 20 (Egypt country code)
                                if (phone.startsWith('0')) {
                                  phone = '20' + phone.substring(1);
                                }
                                // If it doesn't start with country code, add 20
                                if (!phone.startsWith('20') && phone.length === 10) {
                                  phone = '20' + phone;
                                }
                                // Build WhatsApp URL and save it
                                const whatsappUrl = phone ? `https://wa.me/${phone}` : '';



                                setSocial({ ...social, whatsappUrl });
                              }}
                            />
                            <p className="text-xs text-slate-500">
                              صيغة مصرية أو دولية
                            </p>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="whatsapp-link">رابط الواتساب</Label>
                            <Input
                              id="whatsapp-link"
                              readOnly
                              value={(() => {
                                let phone = social.whatsappUrl || '';
                                // Remove any spaces or dashes
                                phone = phone.replace(/[\s-]/g, '');
                                // If it starts with 0, replace with 20 (Egypt country code)
                                if (phone.startsWith('0')) {
                                  phone = '20' + phone.substring(1);
                                }
                                // If it doesn't start with country code, add 20
                                if (!phone.startsWith('20') && phone.length === 10) {
                                  phone = '20' + phone;
                                }
                                // Build WhatsApp URL
                                return phone ? `https://wa.me/${phone}` : '';
                              })()}
                              placeholder="سيظهر الرابط هنا تلقائياً"
                              className="bg-green-50 border-green-300 text-green-700 font-medium cursor-not-allowed"
                            />
                            <p className="text-xs text-green-600">
                              ✓ يتحدث تلقائياً
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <Phone className="w-5 h-5 text-slate-600" />
                      <div className="flex-1 space-y-2">
                        <Label htmlFor="phone-call-link">رابط الاتصال</Label>
                        <Input
                          id="phone-call-link"
                          placeholder="tel:+966123456789"
                          value={social.phoneCallLink || ''}
                          onChange={(e) => setSocial({ ...social, phoneCallLink: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>
                  <Button onClick={handleSaveSocial} disabled={loading}>
                    {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Registration Settings */}
            {ownerVaultOpen && ownerSection === 'registration' && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    إعدادات التسجيل
                  </CardTitle>
                  <CardDescription>
                    إدارة إعدادات تسجيل المستخدمين
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">السماح بالتسجيل الجديد</h3>
                      <p className="text-sm text-slate-600">السماح للمستخدمين الجدد بالتسجيل</p>
                    </div>
                    <Switch
                      checked={registrationSettings.allowNewRegistration}
                      onCheckedChange={(checked) => 
                        setRegistrationSettings({ ...registrationSettings, allowNewRegistration: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">طلب تأكيد البريد الإلكتروني</h3>
                      <p className="text-sm text-slate-600">طلب تأكيد البريد الإلكتروني قبل تفعيل الحساب</p>
                    </div>
                    <Switch
                      checked={registrationSettings.requireEmailVerification}
                      onCheckedChange={(checked) => 
                        setRegistrationSettings({ ...registrationSettings, requireEmailVerification: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">طلب موافقة المشرف</h3>
                      <p className="text-sm text-slate-600">طلب موافقة المشرف على تسجيل المستخدمين الجدد</p>
                    </div>
                    <Switch
                      checked={registrationSettings.requireAdminApproval}
                      onCheckedChange={(checked) => 
                        setRegistrationSettings({ ...registrationSettings, requireAdminApproval: checked })
                      }
                    />
                  </div>
                  <Button onClick={handleSaveRegistration} disabled={loading}>
                    {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Order Settings */}
            {ownerVaultOpen && ownerSection === 'orders' && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    إعدادات الطلبات
                  </CardTitle>
                  <CardDescription>
                    إدارة إعدادات الطلبات ومعالجتها
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">تأكيد الطلبات تلقائياً</h3>
                      <p className="text-sm text-slate-600">تأكيد الطلبات تلقائياً عند استلامها</p>
                    </div>
                    <Switch
                      checked={orderSettings.autoConfirmOrders}
                      onCheckedChange={(checked) => 
                        setOrderSettings({ ...orderSettings, autoConfirmOrders: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">طلب الدفع قبل المعالجة</h3>
                      <p className="text-sm text-slate-600">طلب الدفع قبل معالجة الطلب</p>
                    </div>
                    <Switch
                      checked={orderSettings.requirePaymentBeforeProcessing}
                      onCheckedChange={(checked) => 
                        setOrderSettings({ ...orderSettings, requirePaymentBeforeProcessing: checked })
                      }
                    />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">السماح بإلغاء الطلبات</h3>
                      <p className="text-sm text-slate-600">السماح للعملاء بإلغاء الطلبات</p>
                    </div>
                    <Switch
                      checked={orderSettings.allowOrderCancellation}
                      onCheckedChange={(checked) => 
                        setOrderSettings({ ...orderSettings, allowOrderCancellation: checked })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cancellation-period">فترة الإلغاء (بالساعات)</Label>
                    <Input
                      id="cancellation-period"
                      type="number"
                      min="1"
                      value={orderSettings.cancellationPeriod}
                      onChange={(e) => 
                        setOrderSettings({ ...orderSettings, cancellationPeriod: parseInt(e.target.value) || 24 })
                      }
                    />
                  </div>
                  <Button onClick={handleSaveOrders} disabled={loading}>
                    {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Checkout Settings */}
            {ownerVaultOpen && ownerSection === 'checkout' && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    إعدادات الدفع
                  </CardTitle>
                  <CardDescription>
                    إدارة إعدادات الدفع والشحن
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Checkout Enabled */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium">تفعيل عملية الدفع</h3>
                      <p className="text-sm text-slate-600">السماح للعملاء بإتمام الطلبات</p>
                    </div>
                    <Switch
                      checked={checkoutEnabled}
                      onCheckedChange={setCheckoutEnabled}
                    />
                  </div>
                  
                  <Separator />
                  
                  {/* Shipping Costs */}
                  <div className="space-y-4">
                    <h3 className="font-medium">إعدادات الشحن</h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="shipping-cost">تكلفة الشحن القياسي (ر.س)</Label>
                        <Input
                          id="shipping-cost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={shippingCost}
                          onChange={(e) => setShippingCost(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="express-shipping-cost">تكلفة الشحن السريع (ر.س)</Label>
                        <Input
                          id="express-shipping-cost"
                          type="number"
                          min="0"
                          step="0.01"
                          value={expressShippingCost}
                          onChange={(e) => setExpressShippingCost(parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="free-shipping-threshold">الحد الأدنى للشحن المجاني (ر.س)</Label>
                      <Input
                        id="free-shipping-threshold"
                        type="number"
                        min="0"
                        step="0.01"
                        value={freeShippingThreshold || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFreeShippingThreshold(value === '' ? null : parseFloat(value) || null);
                        }}
                        placeholder="اتركه فارغاً لتعطيل الشحن المجاني"
                      />
                      <p className="text-sm text-slate-600">
                        اترك الحقل فارغاً لتعطيل خاصية الشحن المجاني
                      </p>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  {/* Tax Settings */}
                  <div className="space-y-4">
                    <h3 className="font-medium">إعدادات الضريبة</h3>
                    
                    <div className="space-y-2">
                      <Label htmlFor="tax-rate">نسبة الضريبة (%)</Label>
                      <Input
                        id="tax-rate"
                        type="number"
                        min="0"
                        max="100"
                        step="0.01"
                        value={taxRate || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          setTaxRate(value === '' ? null : parseFloat(value) || null);
                        }}
                        placeholder="اتركه فارغاً لتعطيل الضريبة"
                      />
                      <p className="text-sm text-slate-600">
                        اترك الحقل فارغاً لتعطيل خاصية الضريبة
                      </p>
                    </div>
                  </div>
                  
                  <Button onClick={handleSaveCheckout} disabled={loading}>
                    {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Pricing Settings */}
            {ownerVaultOpen && ownerSection === 'pricing' && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5" />
                    إعدادات الأسعار
                  </CardTitle>
                  <CardDescription>
                    التحكم في عرض الأسعار
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  {/* Hide Prices Toggle */}
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <h3 className="font-semibold text-slate-900">إخفاء الأسعار</h3>
                      <p className="text-sm text-slate-600 mt-1">إذا تم تفعيلها، ستختفي جميع الأسعار من الموقع وسيظهر زر "اتصل للحصول على السعر"</p>
                    </div>
                    <Switch
                      checked={hidePrices}
                      onCheckedChange={setHidePrices}
                    />
                  </div>

                  <Separator />

                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm text-blue-800">
                      <strong>ملاحظة:</strong> الرسائل تُولّد تلقائياً بناءً على السياق (المنتج، السلة، الطلب)
                    </p>
                  </div>

                  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-sm text-amber-800">
                      <strong>ملاحظة:</strong> رقم الواتس يتم استخدامه من إعدادات الروابط الاجتماعية
                    </p>
                  </div>

                  <Button 
                    onClick={async () => {

                      try {
                        await saveSettings(false, 'pricing');
                      } catch (err) {
                        console.error('❌ Failed to save pricing settings:', err);
                      }
                    }} 
                    disabled={loading} 
                    className="w-full"
                  >
                    {loading ? 'جاري الحفظ...' : 'حفظ إعدادات الأسعار'}
                  </Button>
                </CardContent>
              </Card>
            )}

            {ownerVaultOpen && (
              <Card className="border-slate-200/80 shadow-sm">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="w-5 h-5" />
                    إعدادات خاصة
                  </CardTitle>
                  <CardDescription>تحكم المالك في إظهار وإخفاء الصفحات والميزات</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {!ownerVaultAuthed ? (
                    <div className="space-y-3">
                      <Label htmlFor="owner-vault-password">كلمة المرور</Label>
                      <Input
                        id="owner-vault-password"
                        type="password"
                        value={ownerVaultPassword}
                        onChange={(e) => setOwnerVaultPassword(e.target.value)}
                        placeholder="أدخل كلمة المرور"
                      />
                      <Button
                        onClick={handleOwnerVaultLogin}
                        disabled={ownerVaultBusy || !ownerVaultPassword.trim()}
                        className="w-full"
                      >
                        {ownerVaultBusy ? 'جارٍ التحقق...' : 'دخول'}
                      </Button>
                    </div>
                  ) : (
                    ownerSection === 'vault' ? (
                      <>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Switch checked={ownerVaultEnabled} onCheckedChange={setOwnerVaultEnabled} />
                            <span className="text-sm">تفعيل الحجب</span>
                          </div>
                          <span className="text-xs text-slate-500">يتم حفظ التغييرات تلقائيًا قبل الخروج</span>
                        </div>

                        <Input
                          placeholder="ابحث عن صفحة أو ميزة..."
                          value={ownerVaultSearch}
                          onChange={(e) => setOwnerVaultSearch(e.target.value)}
                        />

                        {(['publicPages', 'adminModules', 'featureFlags'] as Array<keyof OwnerVisibility>).map((scope) => (
                          <div key={scope} className="space-y-2 rounded-lg border p-3">
                            <h3 className="font-semibold">
                              {scope === 'publicPages' ? 'الصفحات العامة' : scope === 'adminModules' ? 'وحدات الإدارة' : 'الميزات'}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              {Object.entries(ownerVaultVisibility?.[scope] || {})
                                .filter(([key]) => !ownerVaultSearch || key.toLowerCase().includes(ownerVaultSearch.toLowerCase()))
                                .map(([key, value]) => (
                                  <div key={`${scope}-${key}`} className="flex items-center justify-between rounded-md border px-3 py-2">
                                    <span className="text-sm">{key}</span>
                                    <Switch
                                      checked={Boolean(value)}
                                      onCheckedChange={(checked) => handleOwnerToggle(scope, key, checked)}
                                    />
                                  </div>
                                ))}
                            </div>
                          </div>
                        ))}

                        <Button onClick={handleSaveOwnerVisibility} disabled={ownerVaultBusy} className="w-full">
                          {ownerVaultBusy ? 'جارٍ الحفظ...' : 'حفظ'}
                        </Button>
                      </>
                    ) : (
                      <p className="text-sm text-slate-500">اختر قسمًا من شريط التنقل العلوي.</p>
                    )
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;

