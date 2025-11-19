import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PackageSearch } from 'lucide-react';
import type { HomeConfig } from '@/types/home-config';

interface ProductsManagementModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  setCfg: (cfg: HomeConfig) => void;
  pickerOpen: string;
  setPickerOpen: (val: string) => void;
}

export const ProductsManagementModal: React.FC<ProductsManagementModalProps> = ({
  open,
  onOpenChange,
  cfg,
  setCfg,
  pickerOpen,
  setPickerOpen
}) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <PackageSearch className="w-6 h-6 text-primary" />
            إدارة المنتجات
          </DialogTitle>
          <DialogDescription>
            إدارة المنتجات المعروضة في الأقسام
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <Badge className="bg-primary/10 text-primary">
              {Object.values(cfg.sections || {}).reduce((acc, sec) => acc + (sec.products?.length || 0), 0)} منتج مختار
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
            {([
              { key: 'featuredProducts', label: 'المنتجات المميزة', count: cfg?.featuredProductIds?.length || 0 },
              { key: 'bestSellers', label: 'الأكثر مبيعاً', count: cfg?.bestSellerProductIds?.length || 0 },
              { key: 'sale', label: 'العروض الخاصة', count: cfg?.saleProductIds?.length || 0 },
              { key: 'newArrivals', label: 'أحدث المنتجات', count: cfg?.newArrivalProductIds?.length || 0 },
              { key: 'categories', label: 'الفئات المميزة', count: cfg?.featuredCategorySlugs?.length || 0 },
            ] as Array<{ key: string; label: string; count: number }>).map((sec) => (
              <div key={sec.key} className="p-6 bg-gradient-to-br from-slate-50 to-white border border-slate-200 rounded-xl space-y-4 hover:shadow-lg transition-all duration-300">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-semibold text-slate-900">{sec.label}</div>
                  <Badge className="bg-primary/10 text-primary">
                    {sec.count} عنصر
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  <div className="text-sm text-slate-600">
                    العناصر المحددة حالياً: {sec.count}
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full bg-gradient-to-r from-primary/5 to-secondary/5 border-primary/20 text-primary hover:from-primary/10 hover:to-secondary/10 hover:border-primary/30 shadow-sm hover:shadow-md transition-all duration-200"
                    onClick={() => setPickerOpen(sec.key)}
                  >
                    {sec.key === 'categories' ? 'اختيار الفئات' : 'اختيار المنتجات'}
                  </Button>
                </div>
                
                {sec.count > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <div className="text-xs text-green-700 font-medium">
                      ✅ تم تحديد {sec.count} {sec.key === 'categories' ? 'فئة' : 'منتج'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {/* Summary Stats */}
          <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4">ملخص المحتوى المختار</h3>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-primary">{cfg?.featuredProductIds?.length || 0}</div>
                <div className="text-xs text-slate-600">مميزة</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-green-600">{cfg?.bestSellerProductIds?.length || 0}</div>
                <div className="text-xs text-slate-600">أكثر مبيعاً</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-red-600">{cfg?.saleProductIds?.length || 0}</div>
                <div className="text-xs text-slate-600">عروض</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-purple-600">{cfg?.newArrivalProductIds?.length || 0}</div>
                <div className="text-xs text-slate-600">جديدة</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg border">
                <div className="text-2xl font-bold text-orange-600">{cfg?.featuredCategorySlugs?.length || 0}</div>
                <div className="text-xs text-slate-600">فئات</div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
