import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  Zap, 
  Eye, 
  RefreshCw, 
  Download, 
  Upload, 
  Copy, 
  FileText, 
  BarChart3,
  Sparkles,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import type { HomeConfig } from '@/types/home-config';

interface QuickActionsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cfg: HomeConfig;
  seedDefaultSlides: () => void;
  onSave: () => void;
  onPreview: () => void;
  isValid: boolean;
  saving: boolean;
}

export const QuickActionsModal: React.FC<QuickActionsModalProps> = ({
  open,
  onOpenChange,
  cfg,
  seedDefaultSlides,
  onSave,
  onPreview,
  isValid,
  saving
}) => {
  const handleExportConfig = () => {
    const dataStr = JSON.stringify(cfg, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const exportFileDefaultName = `home-config-${new Date().toISOString().split('T')[0]}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
  };

  const handleCopyConfig = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(cfg, null, 2));
      // You might want to show a toast here
    } catch (err) {
      console.error('Failed to copy config:', err);
    }
  };

  const getConfigSummary = () => {
    const summary = {
      slides: cfg.slides?.length || 0,
      featuredProducts: cfg.featuredProductIds?.length || 0,
      featuredCategories: cfg.featuredCategorySlugs?.length || 0,
      bestSellers: cfg.bestSellerProductIds?.length || 0,
      saleProducts: cfg.saleProductIds?.length || 0,
      newArrivals: cfg.newArrivalProductIds?.length || 0,
      heroEnabled: cfg.heroEnabled,
      promoEnabled: cfg.promoEnabled,
      sectionsCount: cfg.sectionsOrder?.length || 0
    };
    return summary;
  };

  const summary = getConfigSummary();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Zap className="w-6 h-6 text-purple-600" />
            الإجراءات السريعة
          </DialogTitle>
          <DialogDescription>
            أدوات وإجراءات سريعة لإدارة إعدادات الصفحة الرئيسية
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Configuration Overview */}
          <div className="bg-gradient-to-r from-primary/5 to-secondary/5 border border-primary/20 rounded-xl p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              نظرة عامة على الإعدادات
            </h3>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg p-3 border border-primary/20 shadow-sm">
                <div className="text-sm text-slate-600">الشرائح</div>
                <div className="text-xl font-bold text-primary">{summary.slides}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-primary/20 shadow-sm">
                <div className="text-sm text-slate-600">المنتجات المميزة</div>
                <div className="text-xl font-bold text-green-600">{summary.featuredProducts}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-primary/20 shadow-sm">
                <div className="text-sm text-slate-600">الفئات</div>
                <div className="text-xl font-bold text-purple-600">{summary.featuredCategories}</div>
              </div>
              <div className="bg-white rounded-lg p-3 border border-primary/20 shadow-sm">
                <div className="text-sm text-slate-600">الأقسام</div>
                <div className="text-xl font-bold text-orange-600">{summary.sectionsCount}</div>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4">
              <Badge className={`${cfg.heroEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                {cfg.heroEnabled ? 'الهيرو مفعل' : 'الهيرو معطل'}
              </Badge>
              <Badge className={`${cfg.promoEnabled ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-700'}`}>
                {cfg.promoEnabled ? 'الشريط الترويجي مفعل' : 'الشريط الترويجي معطل'}
              </Badge>
              <Badge className={`${isValid ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {isValid ? (
                  <div className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" />
                    صالح
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    يحتاج مراجعة
                  </div>
                )}
              </Badge>
            </div>
          </div>

          {/* Quick Actions Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Data Management */}
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <FileText className="w-5 h-5 text-green-600" />
                  إدارة البيانات
                </CardTitle>
                <CardDescription>تصدير واستيراد الإعدادات</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={handleExportConfig}
                  className="w-full bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <Download className="w-4 h-4 mr-2" />
                  تصدير الإعدادات
                </Button>
                <Button 
                  onClick={handleCopyConfig}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  نسخ الإعدادات
                </Button>
              </CardContent>
            </Card>

            {/* Content Generation */}
            <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  إنشاء المحتوى
                </CardTitle>
                <CardDescription>إنشاء محتوى تلقائي</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={seedDefaultSlides}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  size="sm"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  إنشاء شرائح افتراضية
                </Button>
                <Button 
                  variant="outline"
                  className="w-full"
                  size="sm"
                  disabled
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  تحديث المحتوى (قريباً)
                </Button>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card className="bg-gradient-to-br from-primary/5 to-secondary/5 border-primary/20">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  إجراءات سريعة
                </CardTitle>
                <CardDescription>أدوات الإدارة السريعة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  onClick={onSave}
                  disabled={!isValid || saving}
                  className="w-full bg-primary hover:bg-primary"
                  size="sm"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                  ) : (
                    <Download className="w-4 h-4 mr-2" />
                  )}
                  {saving ? 'جاري الحفظ...' : 'حفظ سريع'}
                </Button>
                <Button 
                  onClick={onPreview}
                  variant="outline"
                  className="w-full"
                  size="sm"
                >
                  <Eye className="w-4 h-4 mr-2" />
                  معاينة في نافذة جديدة
                </Button>
              </CardContent>
            </Card>

            {/* System Tools */}
            <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-600" />
                  أدوات النظام
                </CardTitle>
                <CardDescription>أدوات الصيانة والإدارة</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button 
                  variant="outline"
                  className="w-full border-orange-300 text-orange-700 hover:bg-orange-50"
                  size="sm"
                  disabled
                >
                  <RefreshCw className="w-4 h-4 mr-2" />
                  مسح التخزين المؤقت
                </Button>
                <Button 
                  variant="outline"
                  className="w-full border-red-300 text-red-700 hover:bg-red-50"
                  size="sm"
                  disabled
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  إعادة تعيين (خطر)
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Tips */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h4 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
              <Sparkles className="w-4 h-4" />
              نصائح سريعة:
            </h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• استخدم "تصدير الإعدادات" لعمل نسخة احتياطية قبل التغييرات الكبيرة</li>
              <li>• اعرض المعاينة بانتظام للتأكد من شكل الصفحة</li>
              <li>• احرص على إنشاء شرائح افتراضية إذا كنت تبدأ من الصفر</li>
              <li>• تحقق من صحة جميع الحقول قبل الحفظ</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
