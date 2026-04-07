import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useBuilderAccess } from '@/hooks/useBuilderAccess';
import { useShopSetup } from '@/hooks/useShopSetup';
import { useTheme } from '@/context/ThemeContext';
import { ArrowLeft, CheckCircle2, ImageIcon, Shield, Sparkles, Video } from 'lucide-react';

const SCREENSHOT_SLOTS = [
  'لقطة واجهة التحرير',
  'لقطة التحكم في الجدران',
  'لقطة النتيجة النهائية',
];

export default function ShopBuilderIntro() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { primaryColor, secondaryColor } = useTheme();
  const { isAdminAuthenticated, isAdmin, isAuthenticated } = useDualAuth();
  const { access, loading, startSession } = useBuilderAccess();
  const { shopData } = useShopSetup();
  const [starting, setStarting] = useState(false);
  const persistedAdminSession = typeof window !== 'undefined' && (
    !!localStorage.getItem('admin.auth.userId')
    || localStorage.getItem('admin.auth.role') === 'admin'
    || localStorage.getItem('auth.role') === 'admin'
  );
  const canUseAdminQuickEnter = isAdminAuthenticated || (isAuthenticated && isAdmin) || persistedAdminSession;

  const priceText = useMemo(() => {
    const current = access?.pricing?.isFreeNow ? 'مجاني حالياً' : `${access?.pricing?.currentPriceEgp ?? 100} جنيه / الجلسة`;
    const next = `${access?.pricing?.nextPriceEgp ?? 100} جنيه / الجلسة`;
    return { current, next };
  }, [access]);

  const handleStart = async () => {
    setStarting(true);
    try {
      if (!access?.hasActiveSession) {
        await startSession();
      }
      if (canUseAdminQuickEnter) {
        navigate('/shop-builder/editor', { state: { adminBypass: true, fromIntro: true } });
        return;
      }
      if (shopData) {
        navigate('/shop-builder/editor', { state: { fromIntro: true } });
      } else {
        navigate('/shop-setup', { state: { fromIntro: true } });
      }
    } catch (err) {
      toast({
        title: 'خطأ في الوصول',
        description: err instanceof Error ? err.message : 'تعذر بدء الجلسة حالياً',
        variant: 'destructive',
      });
    } finally {
      setStarting(false);
    }
  };

  const handleAdminQuickEnter = () => {
    navigate('/shop-builder/editor', { state: { adminBypass: true, fromIntro: true } });
  };

  return (
    <div
      className="min-h-screen px-4 py-6 md:py-10 relative overflow-hidden"
      dir="rtl"
      style={{
        background: `radial-gradient(700px 360px at 85% 0%, ${secondaryColor}35 0%, transparent 70%), radial-gradient(850px 480px at 5% 20%, ${primaryColor}30 0%, transparent 70%), linear-gradient(160deg, #f8fafc 0%, #ecfeff 35%, #eef2ff 75%, #e2e8f0 100%)`,
      }}
    >
      <div className="pointer-events-none absolute top-0 right-0 w-80 h-80 rounded-full blur-3xl opacity-45" style={{ backgroundColor: `${secondaryColor}70` }} />
      <div className="pointer-events-none absolute bottom-0 left-0 w-96 h-96 rounded-full blur-3xl opacity-40" style={{ backgroundColor: `${primaryColor}60` }} />

      <div className="mx-auto w-full max-w-6xl space-y-4 md:space-y-6 relative z-10">
        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-[0_24px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur-xl md:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-4 md:gap-6">
            <div className="space-y-4">
              <Badge className="w-fit gap-2 border-0 text-white shadow-lg" style={{ background: `linear-gradient(120deg, ${primaryColor}, ${secondaryColor})` }}>
                <Sparkles className="h-3.5 w-3.5" />
                مصمم المتاجر ثلاثي الأبعاد
              </Badge>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-[1.15]">
                صمّم متجرك بالكامل قبل التنفيذ
              </h1>
              <p className="text-slate-600 text-sm md:text-lg font-semibold">
                رؤية واضحة للمساحات، توزيع أدق للمنتجات، وقرارات أسرع بدون تجارب عشوائية داخل المحل.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="rounded-xl bg-slate-900 text-white p-3">
                  <p className="text-xs text-slate-300">مدة الجلسة</p>
                  <p className="text-lg font-black">{access?.pricing?.sessionMinutes ?? 90} دقيقة</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">دخول سريع</p>
                  <p className="text-sm font-black text-slate-800">من الفكرة إلى المخطط</p>
                </div>
                <div className="rounded-xl bg-white border border-slate-200 p-3">
                  <p className="text-xs text-slate-500">مخرجات</p>
                  <p className="text-sm font-black text-slate-800">لقطات جاهزة للمشاركة</p>
                </div>
              </div>
            </div>

            <Card className="border-0 p-4 md:p-5 text-white shadow-xl" style={{ background: 'linear-gradient(150deg, #0f172a 0%, #1e293b 65%, #0b1120 100%)' }}>
              <p className="text-xs tracking-[0.2em] text-slate-300">الأسعار</p>
              <p className="mt-2 text-3xl font-black">{priceText.current}</p>
              <p className="mt-1 text-sm text-emerald-300">مفعّل لكل المستخدمين الآن</p>
              <div className="mt-4 rounded-xl bg-white/10 p-3 border border-white/10">
                <p className="text-xs text-slate-300">التسعير القادم</p>
                <p className="text-lg font-bold">{priceText.next}</p>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                جلسة واحدة = وصول مضبوط لمنع الاستخدام الزائد.
              </p>
            </Card>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2 border-0 bg-white/85 p-4 md:p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.4)]">
            <div className="mb-3 flex items-center gap-2 text-slate-900">
              <Video className="h-4 w-4" />
              <p className="font-black">فيديو سريع للنظام</p>
            </div>
            <div className="aspect-video w-full rounded-2xl border border-dashed border-slate-300 bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 text-sm font-semibold">
              ضع هنا فيديو تعريفياً (20-40 ثانية)
            </div>
          </Card>

          <Card className="border-0 bg-white/85 p-4 md:p-6 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.4)]">
            <p className="font-black text-slate-900">كيف يعمل النظام؟</p>
            <ul className="mt-3 space-y-2 text-sm text-slate-700">
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />أدخل بيانات المتجر مرة واحدة</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />ابدأ بناء الجدران والملحقات في 2D/3D</li>
              <li className="flex items-start gap-2"><CheckCircle2 className="h-4 w-4 mt-0.5 text-emerald-600" />احفظ لقطة التصميم وشاركها مع فريقك</li>
            </ul>
            <div className="mt-4 rounded-xl bg-gradient-to-r from-slate-100 to-cyan-50 p-3 text-xs text-slate-700 font-semibold">
              الوصول يتم بجلسة مباشرة من هذه الصفحة قبل الدخول للمصمم.
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {SCREENSHOT_SLOTS.map((slot) => (
            <div
              key={slot}
              className="aspect-[16/10] rounded-2xl border border-dashed border-slate-300 bg-white/75 text-slate-500 flex items-center justify-center text-sm font-semibold gap-2"
            >
              <ImageIcon className="h-4 w-4" />
              {slot}
            </div>
          ))}
        </div>

        <div className="rounded-[1.75rem] border border-white/70 bg-white/90 p-4 md:p-6 shadow-[0_24px_70px_-35px_rgba(15,23,42,0.45)]">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <p className="font-black text-slate-900 text-lg">جاهز نبدأ تصميم متجرك؟</p>
              <p className="text-sm text-slate-600 font-semibold">
                عند الضغط على البدء سيتم تفعيل الجلسة ثم متابعة الإعداد أو الدخول للمحرر.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                onClick={handleStart}
                disabled={loading || starting}
                className="gap-2 text-white"
                style={{ background: `linear-gradient(120deg, ${primaryColor}, ${secondaryColor})` }}
              >
                {starting ? 'جاري بدء الجلسة...' : 'ابدأ المصمم الآن'}
                <ArrowLeft className="h-4 w-4" />
              </Button>

              {canUseAdminQuickEnter && (
                <Button
                  onClick={handleAdminQuickEnter}
                  variant="outline"
                  className="gap-2 border-slate-300"
                >
                  <Shield className="h-4 w-4" />
                  دخول مباشر كمسؤول
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
