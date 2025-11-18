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
import { apiGet, apiPutJson } from '@/lib/api';
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

const AdminSettings = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [storeOpen, setStoreOpen] = useState(true);
  const [socialOpen, setSocialOpen] = useState(false);
  const [userOpen, setUserOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(false);

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
          console.log(' Loading settings:', s);
          
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
            console.log('🔧 Settings - API social data:', s.social);
            console.log('🔧 Settings - API whatsappUrl:', s.social.whatsappUrl);
            setSocial({
              facebookUrl: s.social.facebookUrl || '',
              messengerUrl: s.social.messengerUrl || '',
              whatsappUrl: s.social.whatsappUrl || '',
              phoneCallLink: s.social.phoneCallLink || '',
            });
          }

          // Set theme settings (logo removed - now using fixed iconPng.png)
          if (s.theme) {
            console.log('Loading theme from settings:', s.theme);
            if (s.theme.primaryColor) setPrimaryColor(s.theme.primaryColor);
            if (s.theme.secondaryColor) setSecondaryColor(s.theme.secondaryColor);
          } else {
            console.log('No theme in settings');
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
        console.log('🔧 Settings - Saving settings to API:', body);
        console.log('🔧 Settings - Social data being saved:', social);
        console.log('🔧 Settings - WhatsApp URL being saved:', social.whatsappUrl);
        const headers: Record<string, string> = {};
        const adminSecret = localStorage.getItem('ADMIN_SECRET');
        if (adminSecret) headers['x-admin-secret'] = adminSecret;
        const res = await apiPutJson<SettingsDoc, typeof body>('/api/settings', body, headers);
        console.log('API response:', res);
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
    console.log('Saving theme colors:', { primaryColor, secondaryColor });
    try {
      // Clear theme cache before saving
      clearThemeCache();
      
      // Save theme with colors only (logo is now fixed)
      const res = await apiPutJson('/api/settings', {
        theme: {
          primaryColor,
          secondaryColor
        }
      });
      
      if (!res.ok) {
        throw new Error('error' in res ? res.error : 'Save failed');
      }
      
      console.log('Theme saved successfully');
      toast({ title: 'تم الحفظ', description: 'سيتم تحديث الصفحة لتطبيق التغييرات' });
      
      // Clear cache again after successful save
      clearThemeCache();
      
      // Reload the page to apply theme changes
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error) {
      console.error('Failed to save theme:', error);
      toast({ title: 'خطأ', description: 'فشل حفظ الإعدادات', variant: 'destructive' });
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
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">الإعدادات</h1>
          <p className="text-slate-600">إدارة إعدادات المتجر والتطبيق</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="w-5 h-5" />
                  إعدادات سريعة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant={storeOpen ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setStoreOpen(true);
                    setSocialOpen(false);
                    setUserOpen(false);
                    setOrderOpen(false);
                    setCheckoutOpen(false);
                  }}
                >
                  <Store className="w-4 h-4 ml-2" />
                  معلومات المتجر
                </Button>
                <Button
                  variant={socialOpen ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setStoreOpen(false);
                    setSocialOpen(true);
                    setUserOpen(false);
                    setOrderOpen(false);
                    setCheckoutOpen(false);
                  }}
                >
                  <Globe className="w-4 h-4 ml-2" />
                  الروابط الاجتماعية
                </Button>
                <Button
                  variant={userOpen ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setStoreOpen(false);
                    setSocialOpen(false);
                    setUserOpen(true);
                    setOrderOpen(false);
                    setCheckoutOpen(false);
                  }}
                >
                  <Users className="w-4 h-4 ml-2" />
                  إعدادات التسجيل
                </Button>
                <Button
                  variant={orderOpen ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setStoreOpen(false);
                    setSocialOpen(false);
                    setUserOpen(false);
                    setOrderOpen(true);
                    setCheckoutOpen(false);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 ml-2" />
                  إعدادات الطلبات
                </Button>
                <Button
                  variant={checkoutOpen ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setStoreOpen(false);
                    setSocialOpen(false);
                    setUserOpen(false);
                    setOrderOpen(false);
                    setCheckoutOpen(true);
                    setPricingOpen(false);
                  }}
                >
                  <CreditCard className="w-4 h-4 ml-2" />
                  إعدادات الدفع
                </Button>
                <Button
                  variant={pricingOpen ? "default" : "ghost"}
                  className="w-full justify-start"
                  onClick={() => {
                    setStoreOpen(false);
                    setSocialOpen(false);
                    setUserOpen(false);
                    setOrderOpen(false);
                    setCheckoutOpen(false);
                    setPricingOpen(true);
                  }}
                >
                  <ShoppingCart className="w-4 h-4 ml-2" />
                  إعدادات الأسعار
                </Button>
              </CardContent>
            </Card>

            {/* Backup/Restore */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-5 h-5" />
                  النسخ الاحتياطي
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={handleBackupData}>
                  <Download className="w-4 h-4 ml-2" />
                  تصدير الإعدادات
                </Button>
                <div>
                  <Label htmlFor="restore-file" className="cursor-pointer">
                    <Button variant="outline" className="w-full" asChild>
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

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Store Information */}
            {storeOpen && (
              <Card>
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
              <Card>
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
                                console.log('🔧 Settings - WhatsApp phone input:', e.target.value);
                                console.log('🔧 Settings - Formatted phone:', phone);
                                console.log('🔧 Settings - WhatsApp URL to save:', whatsappUrl);
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
            {userOpen && (
              <Card>
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
            {orderOpen && (
              <Card>
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
            {checkoutOpen && (
              <Card>
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
            {pricingOpen && (
              <Card>
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
                      console.log('🔵 Saving pricing settings - hidePrices:', hidePrices);
                      try {
                        await saveSettings(false, 'pricing');
                        console.log('✅ Pricing settings saved successfully');
                        
                        // Force refresh all pages by clearing cache and reloading
                        console.log('🔄 Forcing page refresh to apply changes...');
                        localStorage.clear();
                        
                        // Wait a moment then reload
                        setTimeout(() => {
                          window.location.reload();
                        }, 1000);
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
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminSettings;