import React from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Eye, Palette, Zap } from 'lucide-react';
import type { HomeConfig } from '@/types/home-config';

interface HeroDesignModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  setCfg: (cfg: HomeConfig) => void;
}

export const HeroDesignModal: React.FC<HeroDesignModalProps> = ({ open, onOpenChange, cfg, setCfg }) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Palette className="w-6 h-6 text-purple-600" />
            إعدادات التصميم والحركة
          </DialogTitle>
          <DialogDescription>
            تحكم كامل في تصميم الهيرو والحركات والتخطيط لكل الأجهزة
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-8">
          {!cfg.heroEnabled && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <div>
                  <p className="font-semibold text-amber-800">الهيرو غير مفعل</p>
                  <p className="text-sm text-amber-700">يجب تفعيل قسم الهيرو أولاً لتطبيق هذه الإعدادات</p>
                </div>
              </div>
            </div>
          )}

          {/* Animation Settings */}
          <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border border-slate-200/50 rounded-xl p-6 shadow-inner">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <Zap className="w-5 h-5 text-indigo-600" />
              </div>
              إعدادات الحركة والتفاعل
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">تفعيل الحركات</Label>
                  <Switch
                    checked={cfg.heroDesign?.enableAnimations ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), enableAnimations: val } })}
                    className="data-[state=checked]:bg-indigo-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">تشغيل أو إيقاف جميع التأثيرات المتحركة</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">سرعة الحركة</Label>
                <Select
                  value={cfg.heroDesign?.animationSpeed || 'normal'}
                  onValueChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), animationSpeed: val as 'slow' | 'normal' | 'fast' } })}
                  disabled={!cfg.heroEnabled}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="slow">بطيئة</SelectItem>
                    <SelectItem value="normal">عادية</SelectItem>
                    <SelectItem value="fast">سريعة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">تأثير المنظور</Label>
                  <Switch
                    checked={cfg.heroDesign?.enableParallax ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), enableParallax: val } })}
                    className="data-[state=checked]:bg-indigo-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">تأثير المنظور عند التمرير</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">تتبع الماوس</Label>
                  <Switch
                    checked={cfg.heroDesign?.enableMouseTracking ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), enableMouseTracking: val } })}
                    className="data-[state=checked]:bg-indigo-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">تفاعل العناصر مع حركة الماوس</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">التشغيل التلقائي</Label>
                  <Switch
                    checked={cfg.heroDesign?.autoplayEnabled ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), autoplayEnabled: val } })}
                    className="data-[state=checked]:bg-green-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">تبديل الشرائح تلقائياً</p>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">مدة العرض (ثانية)</Label>
                <Input
                  type="number"
                  min={3}
                  max={10}
                  value={(cfg.heroDesign?.autoplayInterval || 5000) / 1000}
                  onChange={(e) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), autoplayInterval: parseInt(e.target.value) * 1000 } })}
                  className="h-10"
                  disabled={!cfg.heroEnabled || !cfg.heroDesign?.autoplayEnabled}
                />
              </div>
            </div>
          </div>

          {/* Visual Settings */}
          <div className="bg-gradient-to-r from-slate-50 to-cyan-50/30 border border-slate-200/50 rounded-xl p-6 shadow-inner">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-cyan-100 rounded-lg">
                <Eye className="w-5 h-5 text-cyan-600" />
              </div>
              إعدادات العرض المرئي
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">عرض المنتجات</Label>
                  <Switch
                    checked={cfg.heroDesign?.showProductShowcase ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), showProductShowcase: val } })}
                    className="data-[state=checked]:bg-cyan-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">إظهار واجهة المنتجات المميزة</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">أسهم التنقل</Label>
                  <Switch
                    checked={cfg.heroDesign?.showNavigationArrows ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), showNavigationArrows: val } })}
                    className="data-[state=checked]:bg-cyan-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">إظهار أسهم التنقل الجانبية</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">شريط التقدم</Label>
                  <Switch
                    checked={cfg.heroDesign?.showProgressIndicator ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), showProgressIndicator: val } })}
                    className="data-[state=checked]:bg-cyan-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">إظهار شريط تقدم العرض</p>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold text-slate-900">مؤشرات الشرائح</Label>
                  <Switch
                    checked={cfg.heroDesign?.showSlideIndicators ?? true}
                    onCheckedChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), showSlideIndicators: val } })}
                    className="data-[state=checked]:bg-cyan-600"
                    disabled={!cfg.heroEnabled}
                  />
                </div>
                <p className="text-xs text-slate-600">إظهار نقاط الشرائح في الأسفل</p>
              </div>
            </div>
          </div>

          {/* Layout Settings */}
          <div className="bg-gradient-to-r from-slate-50 to-purple-50/30 border border-slate-200/50 rounded-xl p-6 shadow-inner">
            <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-3">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Eye className="w-5 h-5 text-purple-600" />
              </div>
              إعدادات التخطيط
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">تخطيط الجوال</Label>
                <Select
                  value={cfg.heroDesign?.mobileLayout || 'stacked'}
                  onValueChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), mobileLayout: val as 'stacked' | 'overlay' | 'minimal' } })}
                  disabled={!cfg.heroEnabled}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stacked">مكدس</SelectItem>
                    <SelectItem value="overlay">متداخل</SelectItem>
                    <SelectItem value="minimal">مبسط</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-sm font-semibold text-slate-900">تخطيط سطح المكتب</Label>
                <Select
                  value={cfg.heroDesign?.desktopLayout || 'split'}
                  onValueChange={(val) => setCfg({ ...cfg, heroDesign: { ...(cfg.heroDesign || {}), desktopLayout: val as 'split' | 'fullwidth' | 'centered' } })}
                  disabled={!cfg.heroEnabled}
                >
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="split">مقسم</SelectItem>
                    <SelectItem value="fullwidth">عرض كامل</SelectItem>
                    <SelectItem value="centered">وسط</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};