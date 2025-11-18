import { useState, useEffect, useMemo } from 'react';
import { TrendingUp, Package, Star, HardDrive, BarChart3, PieChart, Activity, Store, Phone, Briefcase } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/components/admin/AdminLayout';
import { apiGet } from '@/lib/api';

interface Product3D {
  _id: string;
  name: string;
  category: string;
  fileSize: number;
  usageCount: number;
  isActive: boolean;
  isPremium: boolean;
  createdAt: string;
}

interface ShopSetupData {
  _id: string;
  ownerName: string;
  shopName: string;
  phone: string;
  field: string;
  isCustomField: boolean;
  createdAt: string;
}

export default function Models3DAnalytics() {
  const [products, setProducts] = useState<Product3D[]>([]);
  const [shops, setShops] = useState<ShopSetupData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
    fetchShops();
  }, []);

  const fetchProducts = async () => {
    try {
      const response = await apiGet<{ items: Product3D[] }>('/api/products-3d');
      if (response.ok && response.items) {
        setProducts(response.items as unknown as Product3D[]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchShops = async () => {
    try {
      const response = await apiGet<{ items: ShopSetupData[] }>('/api/shop-setup/all');
      if (response.ok && response.items) {
        setShops(response.items as unknown as ShopSetupData[]);
      }
    } catch (error) {
      console.error('Error fetching shops:', error);
    }
  };

  // Calculate statistics
  const stats = useMemo(() => {
    const totalModels = products.length;
    const activeModels = products.filter(p => p.isActive).length;
    const totalStorage = products.reduce((sum, p) => sum + p.fileSize, 0);
    const avgFileSize = totalModels > 0 ? totalStorage / totalModels : 0;
    const totalUsage = products.reduce((sum, p) => sum + p.usageCount, 0);

    // Most used models
    const mostUsed = [...products]
      .sort((a, b) => b.usageCount - a.usageCount)
      .slice(0, 10);

    // Least used models
    const leastUsed = [...products]
      .filter(p => p.usageCount > 0)
      .sort((a, b) => a.usageCount - b.usageCount)
      .slice(0, 10);

    // Models by category
    const byCategory = products.reduce((acc, p) => {
      acc[p.category] = (acc[p.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Upload trends (by month)
    const byMonth = products.reduce((acc, p) => {
      const month = new Date(p.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long' });
      acc[month] = (acc[month] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      totalModels,
      activeModels,
      totalStorage,
      avgFileSize,
      totalUsage,
      mostUsed,
      leastUsed,
      byCategory,
      byMonth
    };
  }, [products]);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-slate-900">تحليلات النماذج ثلاثية الأبعاد</h1>
          <p className="text-slate-600 mt-1">إحصائيات ورؤى تفصيلية</p>
        </div>

        {/* Key Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي النماذج</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalModels}</div>
              <p className="text-xs text-muted-foreground">
                {stats.activeModels} نشط
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الاستخدام</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalUsage}</div>
              <p className="text-xs text-muted-foreground">
                مرة استخدام
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">المساحة المستخدمة</CardTitle>
              <HardDrive className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatFileSize(stats.totalStorage)}</div>
              <p className="text-xs text-muted-foreground">
                متوسط: {formatFileSize(stats.avgFileSize)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">معدل الاستخدام</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.totalModels > 0 ? (stats.totalUsage / stats.totalModels).toFixed(1) : 0}
              </div>
              <p className="text-xs text-muted-foreground">
                مرة لكل نموذج
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Models by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                النماذج حسب الفئة
              </CardTitle>
              <CardDescription>توزيع النماذج على الفئات</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.byCategory)
                  .sort(([, a], [, b]) => b - a)
                  .map(([category, count]) => {
                    const percentage = ((count / stats.totalModels) * 100).toFixed(1);
                    return (
                      <div key={category} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{category}</span>
                          <span className="text-muted-foreground">{count} ({percentage}%)</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-primary rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>

          {/* Upload Trends */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                اتجاه الرفع
              </CardTitle>
              <CardDescription>النماذج المرفوعة حسب الشهر</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {Object.entries(stats.byMonth)
                  .slice(-6)
                  .map(([month, count]) => {
                    const maxCount = Math.max(...Object.values(stats.byMonth));
                    const percentage = ((count / maxCount) * 100).toFixed(1);
                    return (
                      <div key={month} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">{month}</span>
                          <span className="text-muted-foreground">{count} نموذج</span>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Top/Bottom Lists */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Most Used */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Star className="h-5 w-5 text-amber-500" />
                الأكثر استخداماً
              </CardTitle>
              <CardDescription>أكثر 10 نماذج استخداماً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.mostUsed.map((product, index) => (
                  <div key={product._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 bg-amber-100 text-amber-600 rounded-full font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    </div>
                    <Badge variant="secondary">{product.usageCount} مرة</Badge>
                  </div>
                ))}
                {stats.mostUsed.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Least Used */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-slate-500" />
                الأقل استخداماً
              </CardTitle>
              <CardDescription>أقل 10 نماذج استخداماً</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.leastUsed.map((product, index) => (
                  <div key={product._id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center justify-center w-8 h-8 bg-slate-100 text-slate-600 rounded-full font-bold text-sm">
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.category}</p>
                    </div>
                    <Badge variant="outline">{product.usageCount} مرة</Badge>
                  </div>
                ))}
                {stats.leastUsed.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">لا توجد بيانات</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Shops Section */}
        <div className="mt-12 pt-12 border-t">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Store className="h-6 w-6 text-primary" />
            المتاجر المسجلة
          </h2>
          
          {shops.length === 0 ? (
            <Card>
              <CardContent className="py-12">
                <p className="text-center text-muted-foreground">لا توجد متاجر مسجلة حتى الآن</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {shops.map((shop) => (
                <Card key={shop._id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Store className="h-5 w-5 text-primary" />
                      {shop.shopName}
                    </CardTitle>
                    <CardDescription>{shop.ownerName}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-700">{shop.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Briefcase className="h-4 w-4 text-slate-500" />
                      <span className="text-slate-700">{shop.field}</span>
                    </div>
                    <div className="pt-2">
                      <Badge variant="outline">
                        {new Date(shop.createdAt).toLocaleDateString('ar-SA')}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
