import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Calendar, Package, Activity, Star, Eye, Download, Clock } from 'lucide-react';

interface Product3D {
  _id: string;
  name: string;
  nameEn?: string;
  category: string;
  usageCount: number;
  fileSize: number;
  format: string;
  isPremium: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductAnalyticsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: Product3D | null;
}

export function ProductAnalyticsModal({ open, onOpenChange, product }: ProductAnalyticsModalProps) {
  if (!product) return null;

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const daysSinceCreation = Math.floor(
    (new Date().getTime() - new Date(product.createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  const avgUsagePerDay = daysSinceCreation > 0 ? (product.usageCount / daysSinceCreation).toFixed(2) : '0';
  
  // Additional metrics
  const daysSinceUpdate = Math.floor(
    (new Date().getTime() - new Date(product.updatedAt).getTime()) / (1000 * 60 * 60 * 24)
  );
  const popularityScore = product.usageCount > 20 ? 'عالي جداً' : product.usageCount > 10 ? 'عالي' : product.usageCount > 5 ? 'متوسط' : 'منخفض';
  const efficiencyRating = product.fileSize > 0 ? (product.usageCount / (product.fileSize / 1024 / 1024)).toFixed(2) : '0';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            إحصائيات النموذج
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Product Info */}
          <div className="bg-slate-50 rounded-lg p-4">
            <h3 className="font-semibold text-lg mb-2">{product.name}</h3>
            {product.nameEn && (
              <p className="text-sm text-slate-600 mb-2">{product.nameEn}</p>
            )}
            <div className="flex gap-2">
              <Badge variant="outline">{product.category}</Badge>
              <Badge variant="outline">{product.format.toUpperCase()}</Badge>
              {product.isPremium && <Badge className="bg-amber-500">Premium</Badge>}
              <Badge variant={product.isActive ? 'default' : 'secondary'}>
                {product.isActive ? 'نشط' : 'غير نشط'}
              </Badge>
            </div>
          </div>

          {/* Usage Statistics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <div className="flex items-center gap-2 mb-2">
                <Activity className="h-5 w-5 text-blue-600" />
                <p className="text-sm text-blue-600 font-medium">إجمالي الاستخدام</p>
              </div>
              <p className="text-3xl font-bold text-blue-900">{product.usageCount}</p>
              <p className="text-xs text-blue-600 mt-1">مرة</p>
            </div>

            <div className="bg-green-50 rounded-lg p-4 border border-green-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-600 font-medium">معدل الاستخدام اليومي</p>
              </div>
              <p className="text-3xl font-bold text-green-900">{avgUsagePerDay}</p>
              <p className="text-xs text-green-600 mt-1">مرة/يوم</p>
            </div>

            <div className="bg-purple-50 rounded-lg p-4 border border-purple-200">
              <div className="flex items-center gap-2 mb-2">
                <Package className="h-5 w-5 text-purple-600" />
                <p className="text-sm text-purple-600 font-medium">حجم الملف</p>
              </div>
              <p className="text-2xl font-bold text-purple-900">{formatFileSize(product.fileSize)}</p>
            </div>

            <div className="bg-orange-50 rounded-lg p-4 border border-orange-200">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="h-5 w-5 text-orange-600" />
                <p className="text-sm text-orange-600 font-medium">عمر النموذج</p>
              </div>
              <p className="text-2xl font-bold text-orange-900">{daysSinceCreation}</p>
              <p className="text-xs text-orange-600 mt-1">يوم</p>
            </div>

            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
              <div className="flex items-center gap-2 mb-2">
                <Star className="h-5 w-5 text-amber-600" />
                <p className="text-sm text-amber-600 font-medium">مستوى الشعبية</p>
              </div>
              <p className="text-2xl font-bold text-amber-900">{popularityScore}</p>
            </div>

            <div className="bg-cyan-50 rounded-lg p-4 border border-cyan-200">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-5 w-5 text-cyan-600" />
                <p className="text-sm text-cyan-600 font-medium">منذ آخر تحديث</p>
              </div>
              <p className="text-2xl font-bold text-cyan-900">{daysSinceUpdate}</p>
              <p className="text-xs text-cyan-600 mt-1">يوم</p>
            </div>

            <div className="bg-pink-50 rounded-lg p-4 border border-pink-200">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-pink-600" />
                <p className="text-sm text-pink-600 font-medium">معدل الكفاءة</p>
              </div>
              <p className="text-2xl font-bold text-pink-900">{efficiencyRating}</p>
              <p className="text-xs text-pink-600 mt-1">استخدام/MB</p>
            </div>

            <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200">
              <div className="flex items-center gap-2 mb-2">
                <Eye className="h-5 w-5 text-indigo-600" />
                <p className="text-sm text-indigo-600 font-medium">الحالة</p>
              </div>
              <p className="text-lg font-bold text-indigo-900">
                {product.isActive ? 'نشط' : 'غير نشط'}
              </p>
              <p className="text-xs text-indigo-600 mt-1">
                {product.isPremium ? 'Premium ⭐' : 'عادي'}
              </p>
            </div>
          </div>

          {/* Timeline */}
          <div className="space-y-3">
            <h4 className="font-semibold text-slate-900">التسلسل الزمني</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="h-2 w-2 bg-green-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">تاريخ الإنشاء</p>
                  <p className="text-xs text-slate-600">{formatDate(product.createdAt)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <div className="h-2 w-2 bg-blue-500 rounded-full"></div>
                <div className="flex-1">
                  <p className="text-sm font-medium">آخر تحديث</p>
                  <p className="text-xs text-slate-600">{formatDate(product.updatedAt)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Indicator */}
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 border border-blue-200">
            <h4 className="font-semibold text-slate-900 mb-2">تقييم الأداء</h4>
            <div className="flex items-center gap-2">
              {product.usageCount > 10 ? (
                <>
                  <Badge className="bg-green-500">ممتاز</Badge>
                  <p className="text-sm text-slate-600">نموذج شائع جداً</p>
                </>
              ) : product.usageCount > 5 ? (
                <>
                  <Badge className="bg-blue-500">جيد</Badge>
                  <p className="text-sm text-slate-600">نموذج مستخدم بشكل جيد</p>
                </>
              ) : product.usageCount > 0 ? (
                <>
                  <Badge className="bg-amber-500">متوسط</Badge>
                  <p className="text-sm text-slate-600">يحتاج إلى مزيد من الترويج</p>
                </>
              ) : (
                <>
                  <Badge variant="secondary">غير مستخدم</Badge>
                  <p className="text-sm text-slate-600">لم يتم استخدامه بعد</p>
                </>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
