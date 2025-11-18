import React from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronDown, ChevronUp, Grid3X3 } from 'lucide-react';
import type { HomeConfig, SectionToggle } from '@/types/home-config';

interface SectionsManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  setCfg: (cfg: HomeConfig) => void;
  toggleMap: (section: 'featuredProducts' | 'bestSellers' | 'sale' | 'newArrivals') => void;
}

export const SectionsManagementModal: React.FC<SectionsManagementModalProps> = ({
  open,
  onOpenChange,
  cfg,
  setCfg,
  toggleMap
}) => {
  const defaultOrder = ['hero', 'promoStrip', 'categories', 'featuredProducts', 'bestSellers', 'sale', 'newArrivals', 'about', 'locations', 'workHours'];
  const order = cfg.sectionsOrder?.length ? cfg.sectionsOrder : defaultOrder;
  
  const labelMap: Record<string, string> = {
    hero: 'قسم الهيرو الرئيسي',
    promoStrip: 'الشريط الترويجي',
    categories: 'الفئات المميزة',
    featuredProducts: 'المنتجات المميزة',
    bestSellers: 'الأكثر مبيعاً',
    sale: 'العروض والخصومات',
    newArrivals: 'الوصولات الجديدة',
    about: 'قسم من نحن',
    locations: 'المواقع والفروع',
    workHours: 'ساعات العمل'
  };

  const move = (fromIndex: number, direction: number) => {
    const newOrder = [...order];
    const toIndex = fromIndex + direction;
    if (toIndex >= 0 && toIndex < newOrder.length) {
      [newOrder[fromIndex], newOrder[toIndex]] = [newOrder[toIndex], newOrder[fromIndex]];
      setCfg({ ...cfg, sectionsOrder: newOrder });
    }
  };

  const isEnabled = (key: string) => {
    if (key === 'hero') return cfg.heroEnabled ?? true;
    const current = cfg.toggles.find(t => t.key === key);
    return current?.enabled ?? true;
  };

  const setEnabled = (key: string, val: boolean) => {
    if (key === 'hero') {
      setCfg({ ...cfg, heroEnabled: val });
    } else {
      // For non-hero sections, update toggles array
      const exists = cfg.toggles.find(t => t.key === key);
      let toggles: SectionToggle[];
      if (exists) {
        toggles = cfg.toggles.map(t => t.key === key ? { ...t, enabled: val } : t);
      } else {
        toggles = [...cfg.toggles, { key, enabled: val }];
      }
      setCfg({ ...cfg, toggles });
    }
  };

  const getIconForSection = (key: string) => {
    const icons: Record<string, string> = {
      hero: '🏠',
      promoStrip: '📢',
      categories: '📂',
      featuredProducts: '⭐',
      bestSellers: '🔥',
      sale: '💰',
      newArrivals: '🆕',
      about: 'ℹ️',
      locations: '📍',
      workHours: '🕒'
    };
    return icons[key] || '📄';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Grid3X3 className="w-6 h-6 text-emerald-600" />
            إدارة ترتيب الأقسام
          </DialogTitle>
          <DialogDescription>
            تحكم في ترتيب وإظهار أقسام الصفحة الرئيسية المختلفة
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="space-y-3">
            {order.map((key, idx) => (
              <div 
                key={key} 
                className="group flex items-center justify-between p-4 md:p-5 rounded-xl md:rounded-2xl border-2 border-slate-200/50 bg-gradient-to-r from-white/80 via-slate-50/40 to-white/80 backdrop-blur-sm hover:from-primary/5 hover:via-secondary/5 hover:to-purple-50/80 hover:border-primary/30 transition-all duration-300 shadow-sm hover:shadow-lg transform hover:scale-[1.02]"
              >
                {/* Right side: arrows then name with enhanced styling */}
                <div className="flex items-center gap-3 md:gap-4 order-1 flex-1">
                  {/* Enhanced Icon */}
                  <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-violet-500 to-purple-600 group-hover:from-primary group-hover:to-secondary rounded-xl flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110">
                    <span className="text-lg md:text-xl">{getIconForSection(key)}</span>
                  </div>
                  
                  {/* Section Details */}
                  <div className="flex-1">
                    <div className="font-bold text-base md:text-lg text-slate-900 group-hover:text-primary transition-colors duration-200">
                      {labelMap[key] || key}
                    </div>
                    <div className="text-xs md:text-sm text-slate-500 group-hover:text-primary transition-colors duration-200 mt-1">
                      {key === 'hero' && 'العنصر الرئيسي في أعلى الصفحة'}
                      {key === 'promoStrip' && 'شريط الإعلانات والعروض'}
                      {key === 'categories' && 'عرض مجموعة من الفئات'}
                      {key === 'featuredProducts' && 'المنتجات المختارة بعناية'}
                      {key === 'bestSellers' && 'المنتجات الأكثر مبيعاً'}
                      {key === 'sale' && 'منتجات العروض والخصومات'}
                      {key === 'newArrivals' && 'أحدث المنتجات المضافة'}
                      {key === 'about' && 'قسم معلومات الشركة'}
                      {key === 'locations' && 'مواقع وفروع المتجر'}
                      {key === 'workHours' && 'أوقات عمل المتجر'}
                    </div>
                  </div>
                  
                  {/* Enhanced Movement Controls */}
                  <div className="flex flex-col gap-1">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => move(idx, -1)} 
                      disabled={idx === 0} 
                      title="أعلى" 
                      aria-label="أعلى"
                      className="w-8 h-8 rounded-lg bg-white/80 hover:bg-primary/10 border border-slate-200 hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-30"
                    >
                      <ChevronUp className="w-4 h-4 text-slate-600 hover:text-primary" />
                    </Button>
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="sm"
                      onClick={() => move(idx, 1)} 
                      disabled={idx === order.length - 1} 
                      title="أسفل" 
                      aria-label="أسفل"
                      className="w-8 h-8 rounded-lg bg-white/80 hover:bg-primary/10 border border-slate-200 hover:border-primary/30 transition-all duration-200 shadow-sm hover:shadow-md disabled:opacity-30"
                    >
                      <ChevronDown className="w-4 h-4 text-slate-600 hover:text-primary" />
                    </Button>
                  </div>
                </div>
                
                <div className="flex items-center gap-3 md:gap-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-semibold text-slate-900">تفعيل القسم</Label>
                    <Switch 
                      checked={isEnabled(key)}
                      onCheckedChange={(val) => setEnabled(key, val)}
                      className="data-[state=checked]:bg-green-600"
                    />
                  </div>
                </div>
                
                {/* Left side: enhanced selection + active/inactive button */}
                <div className="flex items-center gap-2 md:gap-3 order-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setEnabled(key, !isEnabled(key))}
                    className={
                      `px-3 md:px-4 py-2 font-semibold text-xs md:text-sm rounded-lg shadow-md hover:shadow-lg transition-all duration-300 transform hover:scale-105 ${isEnabled(key)
                        ? 'bg-gradient-to-r from-emerald-500 to-green-600 text-white hover:from-emerald-600 hover:to-green-700 border border-emerald-400'
                        : 'bg-gradient-to-r from-rose-500 to-red-600 text-white hover:from-rose-600 hover:to-red-700 border border-rose-400'} `
                    }
                    title={isEnabled(key) ? 'القسم مفعل' : 'القسم غير مفعل'}
                    aria-label={isEnabled(key) ? 'تعطيل القسم' : 'تفعيل القسم'}
                  >
                    {isEnabled(key) ? '✅ مفعل' : '❌ غير مفعل'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
          
          {/* Enhanced Footer Controls */}
          <div className="pt-6 border-t border-slate-200/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-primary to-secondary rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">{order.length}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">إجمالي الأقسام المتاحة</div>
                  <div className="text-xs text-slate-500">يمكنك إعادة ترتيبها حسب الحاجة</div>
                </div>
              </div>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                onClick={() => setCfg({ ...cfg, sectionsOrder: defaultOrder })}
                className="bg-gradient-to-r from-slate-50 to-gray-50 border-slate-300 text-slate-700 hover:from-slate-100 hover:to-gray-100 hover:border-slate-400 shadow-sm hover:shadow-md transition-all duration-200"
              >
                🔄 استعادة الترتيب الافتراضي
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};