import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertTriangle, Globe, Megaphone, Zap, Gift, Info, Star } from 'lucide-react';
import ImageUpload from '@/components/ui/image-upload';
import type { HomeConfig } from '@/types/home-config';

interface PromoSeoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  setCfg: (cfg: HomeConfig) => void;
  errors: { slides: Record<number, string[]>; promo: string[]; seo: string[] };
}

export const PromoSeoModal: React.FC<PromoSeoModalProps> = ({
  open,
  onOpenChange,
  cfg,
  setCfg,
  errors
}) => {
  const iconMap = {
    zap: <Zap className="w-4 h-4" />,
    megaphone: <Megaphone className="w-4 h-4" />,
    gift: <Gift className="w-4 h-4" />,
    info: <Info className="w-4 h-4" />,
    star: <Star className="w-4 h-4" />
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-green-600" />
            الشريط الترويجي وإعدادات SEO
          </DialogTitle>
          <DialogDescription>
            إدارة الشريط الترويجي وتحسين محركات البحث
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-8">
          {/* Promotional Strip Section */}
          <div className="bg-gradient-to-r from-orange-50 to-red-50 border border-orange-200 rounded-xl p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Megaphone className="w-5 h-5 text-orange-600" />
                  الشريط الترويجي
                </h3>
                <p className="text-sm text-slate-600 mt-1">شريط إعلاني في أعلى الصفحة لعرض العروض والإعلانات</p>
              </div>
              <Switch 
                checked={cfg.promoEnabled} 
                onCheckedChange={(val) => setCfg({ ...cfg, promoEnabled: val })}
                className="data-[state=checked]:bg-orange-500"
              />
            </div>

            {cfg.promoEnabled && (
              <div className="space-y-4">
                <div>
                  <Label>نص الشريط الترويجي</Label>
                  <Input 
                    value={cfg.promoText || ''} 
                    onChange={(e) => setCfg({ ...cfg, promoText: e.target.value })} 
                    placeholder="شحن مجاني لجميع الطلبات فوق 200 ريال!"
                    className={errors.promo.length ? 'border-red-300' : ''}
                  />
                  {errors.promo.length > 0 && (
                    <div className="mt-1 space-y-1">
                      {errors.promo.map((err, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-red-600">
                          <AlertTriangle className="w-4 h-4" />
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <Label>أيقونة الشريط</Label>
                  <Select value={cfg.promoIcon || 'megaphone'} onValueChange={(val) => setCfg({ ...cfg, promoIcon: val })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="zap">
                        <div className="flex items-center gap-2">
                          <Zap className="w-4 h-4" />
                          برق
                        </div>
                      </SelectItem>
                      <SelectItem value="megaphone">
                        <div className="flex items-center gap-2">
                          <Megaphone className="w-4 h-4" />
                          مكبر صوت
                        </div>
                      </SelectItem>
                      <SelectItem value="gift">
                        <div className="flex items-center gap-2">
                          <Gift className="w-4 h-4" />
                          هدية
                        </div>
                      </SelectItem>
                      <SelectItem value="info">
                        <div className="flex items-center gap-2">
                          <Info className="w-4 h-4" />
                          معلومات
                        </div>
                      </SelectItem>
                      <SelectItem value="star">
                        <div className="flex items-center gap-2">
                          <Star className="w-4 h-4" />
                          نجمة
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="bg-white border border-orange-200 rounded-lg p-4">
                  <h4 className="font-semibold text-orange-800 mb-2">معاينة الشريط:</h4>
                  <div className="flex items-center justify-center gap-2 bg-orange-100 text-orange-800 py-2 px-4 rounded-lg">
                    {iconMap[cfg.promoIcon as keyof typeof iconMap] || iconMap.megaphone}
                    <span className="font-medium">{cfg.promoText || 'نص الشريط الترويجي'}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* SEO Section */}
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <div className="p-2 bg-primary/10 rounded-lg">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">تحسين محركات البحث (SEO)</h3>
                <p className="text-sm text-slate-600">تحسين ظهور الموقع في نتائج البحث</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <Label>عنوان الصفحة (SEO Title)</Label>
                <Input 
                  value={cfg.seoTitle || ''} 
                  onChange={(e) => setCfg({ ...cfg, seoTitle: e.target.value })} 
                  placeholder="المتجر الإلكتروني الرائد - أفضل المنتجات بأسعار منافسة"
                  className={errors.seo.some(err => err.includes('عنوان')) ? 'border-red-300' : ''}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {cfg.seoTitle?.length || 0}/70 حرف (الطول المثالي: 50-60 حرف)
                </p>
              </div>

              <div>
                <Label>وصف الصفحة (Meta Description)</Label>
                <Textarea 
                  value={cfg.seoDescription || ''} 
                  onChange={(e) => setCfg({ ...cfg, seoDescription: e.target.value })} 
                  placeholder="اكتشف مجموعة واسعة من المنتجات عالية الجودة بأسعار منافسة. شحن سريع وضمان الجودة."
                  rows={3}
                  className={errors.seo.some(err => err.includes('وصف')) ? 'border-red-300' : ''}
                />
                <p className="text-xs text-slate-500 mt-1">
                  {cfg.seoDescription?.length || 0}/160 حرف (الطول المثالي: 120-150 حرف)
                </p>
              </div>

              <div>
                <Label>الكلمات المفتاحية (Keywords)</Label>
                <Input 
                  value={cfg.seoKeywords || ''} 
                  onChange={(e) => setCfg({ ...cfg, seoKeywords: e.target.value })} 
                  placeholder="تسوق, منتجات, عروض"
                />
                <p className="text-xs text-slate-500 mt-1">افصل الكلمات بفواصل</p>
              </div>

              <div>
                <Label>صورة المعاينة (Preview Image)</Label>
                <ImageUpload 
                  initialImages={cfg.seoPreviewImage ? [cfg.seoPreviewImage] : []}
                  onImagesChange={(images) => setCfg({ ...cfg, seoPreviewImage: images[0] || '' })} 
                  maxImages={1}
                  multiple={false}
                />
                <p className="text-xs text-slate-500 mt-1">الحجم المثالي: 1200x630 بكسل</p>
              </div>

              {errors.seo.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <ul className="space-y-1">
                    {errors.seo.map((err, i) => (
                      <li key={i} className="flex items-center gap-2 text-sm text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        {err}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <h4 className="font-semibold text-primary mb-2">معاينة نتيجة البحث:</h4>
                <div className="bg-white border rounded-lg p-3">
                  <div className="text-primary text-lg leading-snug line-clamp-2">
                    {cfg.seoTitle || 'عنوان الصفحة'}
                  </div>
                  <div className="text-green-700 text-sm mt-1">example.com</div>
                  <div className="text-gray-600 text-sm mt-1 line-clamp-2">
                    {cfg.seoDescription || 'وصف الصفحة سيظهر هنا...'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};