import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AdminLayout from '@/components/admin/AdminLayout';
import ModernStatCard from '@/components/admin/ModernStatCard';
import RevenueChart from '@/components/admin/charts/RevenueChart';
import { OrdersChart, CategoryDistribution } from '@/components/admin/charts/OrdersChart';
import DateRangeSelector, { DateRange } from '@/components/admin/DateRangeSelector';
import { apiGet } from '@/lib/api';
import { Order, Product, User } from '@/types';
import { logHistory } from '@/lib/history';
import { hasPermission, isSuperAdmin } from '@/lib/permissions';
import { usePageTitle } from '@/hooks/usePageTitle';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { 
  DollarSign, 
  ShoppingCart, 
  Package, 
  Users, 
  TrendingUp,
  AlertTriangle,
  Plus,
  Eye,
  RefreshCw,
  BarChart3,
  Activity,
  Zap,
  Target,
  Grid3X3
} from 'lucide-react';
import { format, isWithinInterval, subDays } from 'date-fns';

const AdminDashboard = () => {
  // Set page title
  usePageTitle('لوحة التحكم');
  
  const navigate = useNavigate();
  const { isMobile, isTablet } = useDeviceDetection();

  // State fetched from API
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | null>(null);
  const [comparisonDateRange, setComparisonDateRange] = useState<DateRange | null>(null);

  // Load data from backend with permission checks
  const loadData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    
    try {
      // Check permissions before making API calls
      const canReadOrders = isSuperAdmin() || await hasPermission('orders', 'read');
      const canReadProducts = isSuperAdmin() || await hasPermission('products', 'read');
      const canReadUsers = isSuperAdmin() || await hasPermission('users', 'read');

      // Only fetch data for resources the user has access to
      const promises: Promise<any>[] = [];
      if (canReadOrders) promises.push(apiGet<Order>('/api/orders'));
      if (canReadProducts) promises.push(apiGet<Product>('/api/products'));
      if (canReadUsers) promises.push(apiGet<User>('/api/users'));

      const results = await Promise.all(promises);
      
      let resultIndex = 0;
      if (canReadOrders) {
        const ordersRes = results[resultIndex++];
        if (ordersRes.ok) setOrders(ordersRes.items || []);
      }
      if (canReadProducts) {
        const productsRes = results[resultIndex++];
        if (productsRes.ok) setProducts(productsRes.items || []);
      }
      if (canReadUsers) {
        const usersRes = results[resultIndex++];
        if (usersRes.ok) setUsers(usersRes.items || []);
      }

      try {
        await logHistory({
          section: 'admin_dashboard',
          action: refresh ? 'data_refreshed' : 'data_loaded',
          meta: {
            orders: canReadOrders ? orders.length : 'no_access',
            products: canReadProducts ? products.length : 'no_access',
            users: canReadUsers ? users.length : 'no_access',
          },
        });
      } catch (e) { /* swallow to avoid UI disruption */ }
    } catch (e) {
      console.error('Failed to load dashboard data:', e);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Calculate statistics with date range filtering
  const filteredData = useMemo(() => {
    if (!selectedDateRange) return { orders: [], users: [] };
    
    const filteredOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return isWithinInterval(orderDate, {
        start: selectedDateRange.from,
        end: selectedDateRange.to
      });
    });
    
    const filteredUsers = users.filter(user => {
      const userDate = new Date(user.createdAt);
      return isWithinInterval(userDate, {
        start: selectedDateRange.from,
        end: selectedDateRange.to
      });
    });
    
    return { orders: filteredOrders, users: filteredUsers };
  }, [orders, users, selectedDateRange]);
  
  const comparisonData = useMemo(() => {
    if (!comparisonDateRange) return { orders: [], users: [] };
    
    const comparisonOrders = orders.filter(order => {
      const orderDate = new Date(order.createdAt);
      return isWithinInterval(orderDate, {
        start: comparisonDateRange.from,
        end: comparisonDateRange.to
      });
    });
    
    const comparisonUsers = users.filter(user => {
      const userDate = new Date(user.createdAt);
      return isWithinInterval(userDate, {
        start: comparisonDateRange.from,
        end: comparisonDateRange.to
      });
    });
    
    return { orders: comparisonOrders, users: comparisonUsers };
  }, [orders, users, comparisonDateRange]);

  // Real Analytics Processing
  const chartData = useMemo(() => {
    // Generate data for the last 7 days by default, or fit nicely into the selected date range.
    const daysToShow = selectedDateRange ? Math.ceil((selectedDateRange.to.getTime() - selectedDateRange.from.getTime()) / (1000 * 3600 * 24)) : 7;
    const end = selectedDateRange ? selectedDateRange.to : new Date();
    
    const dailyData = Array.from({ length: Math.max(1, daysToShow) }).map((_, i) => {
      const date = subDays(end, daysToShow - 1 - i);
      const startOfDay = new Date(date);
      startOfDay.setHours(0,0,0,0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23,59,59,999);
      
      const dayOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= startOfDay && d <= endOfDay;
      });

      const dayRevenue = dayOrders.reduce((sum, o) => sum + o.total, 0);
      
      // Calculate previous period for comparison
      const prevDate = subDays(date, daysToShow);
      const pStartOfDay = new Date(prevDate);
      pStartOfDay.setHours(0,0,0,0);
      const pEndOfDay = new Date(prevDate);
      pEndOfDay.setHours(23,59,59,999);
      
      const prevOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= pStartOfDay && d <= pEndOfDay;
      });
      const prevRevenue = prevOrders.reduce((sum, o) => sum + o.total, 0);

      const statusCounts = dayOrders.reduce((acc, o) => {
        acc[o.status] = (acc[o.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return {
        date: format(date, 'MMM dd'),
        current: dayRevenue,
        previous: prevRevenue,
        orders: dayOrders.length,
        pending: statusCounts['pending'] || 0,
        confirmed: statusCounts['confirmed'] || 0,
        delivered: statusCounts['delivered'] || 0,
        cancelled: statusCounts['cancelled'] || 0,
      };
    });

    const categoriesMap = new Map<string, number>();
    products.forEach(p => {
      const count = categoriesMap.get(p.category) || 0;
      categoriesMap.set(p.category, count + 1);
    });
    
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];
    const categoryDataMap = Array.from(categoriesMap.entries())
      .map(([name, value], i) => ({
        name: name || 'غير مصنف',
        value,
        color: colors[i % colors.length]
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // top 5 categories

    return {
      dailyData,
      categoryData: categoryDataMap,
      revenueChartData: dailyData.map(d => ({ date: d.date, current: d.current, previous: d.previous, orders: d.orders })),
      ordersChartData: dailyData.map(d => ({ date: d.date, pending: d.pending, confirmed: d.confirmed, delivered: d.delivered, cancelled: d.cancelled }))
    };
  }, [orders, products, selectedDateRange]);

  // Calculate statistics
  const totalRevenue = filteredData.orders.reduce((sum, order) => sum + order.total, 0);
  const previousRevenue = comparisonData.orders.reduce((sum, order) => sum + order.total, 0);
  const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;
  
  const todayOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    const today = new Date();
    return orderDate.toDateString() === today.toDateString();
  }).length;
  
  const lowStockProducts = products.filter(product => product.stock <= 5);
  const outOfStockProducts = products.filter(product => product.stock === 0);
  
  const ordersByStatus = {
    pending: filteredData.orders.filter(order => order.status === 'pending').length,
    confirmed: filteredData.orders.filter(order => order.status === 'confirmed').length,
    delivered: filteredData.orders.filter(order => order.status === 'delivered').length,
    cancelled: filteredData.orders.filter(order => order.status === 'cancelled').length,
  };

  const newUsersCount = filteredData.users.length;
  const previousUsersCount = comparisonData.users.length;
  const usersGrowth = previousUsersCount > 0 ? ((newUsersCount - previousUsersCount) / previousUsersCount) * 100 : 0;

  const handleDateRangeChange = (dateRange: DateRange, comparisonRange?: DateRange) => {
    setSelectedDateRange(dateRange);
setComparisonDateRange(comparisonRange || null);
  };

  const handleRefresh = () => {
    loadData(true);
  };

  return (
    <AdminLayout>
      <div className="bg-background min-h-screen transition-colors duration-300">
        
        {/* --- MOBILE VIEW --- */}
        {isMobile ? (
          <div className="p-4 space-y-6 pb-20">
            {/* Mobile Header */}
            <div className="flex justify-between items-center bg-primary text-primary-foreground rounded-3xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
              <div className="relative z-10">
                <h1 className="text-2xl font-black mb-1">لوحة القيادة</h1>
                <p className="text-primary-foreground/80 text-sm">مرحباً بك مجدداً</p>
              </div>
              <Button 
                onClick={handleRefresh} 
                variant="ghost" 
                size="icon" 
                className="text-white hover:bg-white/20 rounded-full h-10 w-10 relative z-10 shrink-0"
              >
                <RefreshCw className={`w-5 h-5 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
            </div>

            {/* Mobile App Grid (Springboard) */}
            <div>
              <h2 className="text-lg font-bold text-foreground mb-4 px-2">الوصول السريع</h2>
              <div className="grid grid-cols-2 gap-4">
                <div 
                  onClick={() => navigate('/admin/products')}
                  className="bg-card text-card-foreground p-5 rounded-[2rem] border border-border shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <Package className="w-7 h-7 text-primary" />
                  </div>
                  <span className="font-bold text-sm">المنتجات</span>
                </div>

                <div 
                  onClick={() => navigate('/admin/orders')}
                  className="bg-card text-card-foreground p-5 rounded-[2rem] border border-border shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 bg-secondary/10 rounded-full flex items-center justify-center">
                    <ShoppingCart className="w-7 h-7 text-secondary" />
                  </div>
                  <span className="font-bold text-sm">الطلبات</span>
                </div>

                <div 
                  onClick={() => navigate('/admin/categories')}
                  className="bg-card text-card-foreground p-5 rounded-[2rem] border border-border shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 bg-primary/10 rounded-full flex items-center justify-center">
                    <Target className="w-7 h-7 text-primary" />
                  </div>
                  <span className="font-bold text-sm">فئات المتجر</span>
                </div>

                <div 
                  onClick={() => navigate('/admin/users')}
                  className="bg-card text-card-foreground p-5 rounded-[2rem] border border-border shadow-sm flex flex-col items-center justify-center gap-3 active:scale-95 transition-transform"
                >
                  <div className="w-14 h-14 bg-secondary/10 rounded-full flex items-center justify-center">
                    <Users className="w-7 h-7 text-secondary" />
                  </div>
                  <span className="font-bold text-sm">المستخدمين</span>
                </div>
              </div>
            </div>

            {/* Mobile Status List */}
            <div className="bg-card p-5 rounded-3xl border border-border shadow-sm">
              <h2 className="text-lg font-bold text-foreground mb-4">نظرة عامة</h2>
              <div className="space-y-4">
                <div className="flex justify-between items-center pb-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <Package className="w-5 h-5 text-primary" />
                    </div>
                    <span className="font-semibold text-foreground">إجمالي المنتجات</span>
                  </div>
                  <span className="font-black text-lg text-primary">{products.length}</span>
                </div>
                <div className="flex justify-between items-center pb-4 border-b border-border/50">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center">
                      <Users className="w-5 h-5 text-secondary" />
                    </div>
                    <span className="font-semibold text-foreground">إجمالي الحسابات</span>
                  </div>
                  <span className="font-black text-lg text-secondary">{users.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                      <Target className="w-5 h-5 text-destructive" />
                    </div>
                    <span className="font-semibold text-foreground">منتجات بدون مخزون</span>
                  </div>
                  <span className="font-black text-lg text-destructive">{outOfStockProducts.length}</span>
                </div>
              </div>
            </div>
            
            {/* Direct Configuration Jump */}
            <div 
              onClick={() => navigate('/admin/home-config')}
              className="bg-gradient-to-l from-primary/5 to-secondary/5 border border-primary/20 p-5 rounded-3xl flex justify-between items-center active:scale-95 transition-transform"
            >
              <div>
                <h3 className="font-bold text-foreground text-lg mb-1">إعدادات واجهة المتجر</h3>
                <p className="text-muted-foreground text-sm">تعديل شكل الصفحة الرئيسية</p>
              </div>
              <div className="w-12 h-12 bg-background rounded-full flex items-center justify-center shadow-sm">
                <Zap className="w-6 h-6 text-primary" />
              </div>
            </div>
          </div>
        ) : (
          
          /* --- DESKTOP VIEW --- */
          <div className="p-6 md:p-8 space-y-8 w-full">
            {/* Avant-Garde Desktop Header */}
            <div className="relative overflow-hidden bg-primary rounded-[2rem] p-8 md:p-10 shadow-2xl text-primary-foreground flex justify-between items-center">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-black/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3 pointer-events-none"></div>
              
              <div className="relative z-10">
                <h1 className="text-3xl md:text-4xl font-black mb-3 tracking-tight drop-shadow-sm">لوحة القيادة المركزية</h1>
                <p className="text-primary-foreground/90 text-base md:text-lg font-medium flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  مركز إدارة المتجر واستكشاف البيانات
                </p>
              </div>
              
              <div className="relative z-10 flex flex-col items-end gap-4">
                 <Button 
                  onClick={handleRefresh} 
                  variant="outline" 
                  size="lg"
                  disabled={isRefreshing}
                  className="bg-background/10 text-primary-foreground hover:bg-background/20 hover:text-white border-white/20 backdrop-blur-md rounded-2xl h-12 px-6 text-base font-bold transition-all"
                 >
                   <RefreshCw className={`w-5 h-5 mr-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                   {isRefreshing ? 'جار التحديث' : 'تحديث البيانات'}
                 </Button>
              </div>
            </div>

            {/* Main Desktop Layout Grid */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              
              {/* Left Column (Main Launchpad) - Span 2 */}
              <div className="xl:col-span-2 flex flex-col gap-6">
                
                {/* Smart Actions Grid */}
                <div>
                  <h2 className="text-2xl font-bold text-foreground mb-6 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Target className="w-5 h-5 text-primary" />
                    </div>
                    أدوات التحكم السريعة
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Products Card */}
                    <div 
                      onClick={() => navigate('/admin/products')}
                      className="group bg-card text-card-foreground border-2 border-transparent hover:border-primary/20 hover:shadow-xl transition-all duration-300 rounded-[2rem] p-8 cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors"></div>
                      <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary group-hover:scale-110 transition-transform">
                        <Package className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">إدارة المنتجات</h3>
                      <p className="text-muted-foreground">أضف، عدل، وراقب حالة المخزن والأسعار بمرونة عالية.</p>
                    </div>

                    {/* Categories Card */}
                    <div 
                      onClick={() => navigate('/admin/categories')}
                      className="group bg-card text-card-foreground border-2 border-transparent hover:border-secondary/20 hover:shadow-xl transition-all duration-300 rounded-[2rem] p-8 cursor-pointer relative overflow-hidden"
                    >
                      <div className="absolute top-0 right-0 w-32 h-32 bg-secondary/5 rounded-full blur-2xl group-hover:bg-secondary/10 transition-colors"></div>
                      <div className="w-16 h-16 bg-secondary/10 rounded-2xl flex items-center justify-center mb-6 text-secondary group-hover:scale-110 transition-transform">
                        <Grid3X3 className="w-8 h-8" />
                      </div>
                      <h3 className="text-2xl font-bold mb-2">فئات المتجر</h3>
                      <p className="text-muted-foreground">قم بتنظيم تصنيفات متجرك وترتيب الواجهة لعملائك.</p>
                    </div>

                    {/* Home Config Card */}
                    <div 
                      onClick={() => navigate('/admin/home-config')}
                      className="group bg-card text-card-foreground border-2 border-transparent hover:border-primary/20 hover:shadow-xl transition-all duration-300 rounded-[2rem] p-8 cursor-pointer relative overflow-hidden md:col-span-2 bg-gradient-to-l from-primary/5 to-transparent"
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <div className="w-16 h-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6 text-primary group-hover:rotate-12 transition-transform">
                            <Activity className="w-8 h-8" />
                          </div>
                          <h3 className="text-2xl font-bold mb-2">إعدادات واجهة المتجر</h3>
                          <p className="text-muted-foreground max-w-lg">تحكم في كامل الصفحة الرئيسية للمتجر (السلايدر، العروض، وأقسام المنتجات المخصصة).</p>
                        </div>
                        <div className="hidden md:flex p-4 rounded-full border border-primary/20 bg-background text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                          <Eye className="w-8 h-8" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column (Insights) - Span 1 */}
              <div className="xl:col-span-1 flex flex-col gap-6">
                
                {/* Minimalist Data Summary */}
                <div className="bg-card border border-border shadow-lg rounded-[2rem] p-8">
                  <h3 className="text-xl font-bold text-foreground mb-6">نظرة سريعة</h3>
                  
                  <div className="space-y-6">
                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/admin/products')}>
                      <div>
                        <p className="text-muted-foreground text-sm font-medium mb-1">إجمالي المنتجات</p>
                        <p className="text-3xl font-black text-foreground group-hover:text-primary transition-colors">{products.length}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-primary/5 flex items-center justify-center text-primary">
                        <Package className="w-6 h-6" />
                      </div>
                    </div>
                    
                    <div className="w-full h-px bg-border/50"></div>
                    
                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/admin/users')}>
                      <div>
                        <p className="text-muted-foreground text-sm font-medium mb-1">العملاء المسجلين</p>
                        <p className="text-3xl font-black text-foreground group-hover:text-secondary transition-colors">{users.length}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-secondary/5 flex items-center justify-center text-secondary">
                        <Users className="w-6 h-6" />
                      </div>
                    </div>

                    <div className="w-full h-px bg-border/50"></div>

                    <div className="flex items-center justify-between group cursor-pointer" onClick={() => navigate('/admin/orders')}>
                      <div>
                        <p className="text-muted-foreground text-sm font-medium mb-1">إجمالي الطلبات</p>
                        <p className="text-3xl font-black text-foreground">{orders.length}</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-foreground/5 flex items-center justify-center text-foreground">
                        <ShoppingCart className="w-6 h-6" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Intelligent Warning Block */}
                <div className="bg-gradient-to-br from-card to-background border border-border shadow-sm rounded-[2rem] p-8">
                  <h3 className="text-lg font-bold text-muted-foreground mb-4">تنبيهات تلقائية</h3>
                  {outOfStockProducts.length > 0 ? (
                    <div className="bg-destructive/10 border border-destructive/20 text-destructive p-4 rounded-xl flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold mb-1">منتجات تفقد المخزون</p>
                        <p className="text-sm opacity-90">يوجد {outOfStockProducts.length} منتج ليس لديه كمية متوفرة. <span className="underline cursor-pointer font-bold" onClick={() => navigate('/admin/products')}>راجع المنتجات</span></p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-primary/5 border border-primary/20 text-primary p-4 rounded-xl flex items-start gap-3">
                      <Activity className="w-5 h-5 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-bold mb-1">المخزون ممتاز</p>
                        <p className="text-sm opacity-90">لا توجد أي نواقص في المستودع حالياً.</p>
                      </div>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
