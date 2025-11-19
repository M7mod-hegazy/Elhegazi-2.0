import { useNavigate } from 'react-router-dom';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  Target
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
      <div className="space-y-6 sm:space-y-8 bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20 min-h-screen p-4 sm:p-6 -m-4 sm:-m-6">
        {/* Modern Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              لوحة التحكم
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium">مرحباً بك في نظام إدارة المتجر المتطور</p>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-4 text-xs sm:text-sm text-slate-500">
              <div className="flex items-center gap-1">
                <Activity className="w-3 h-3 sm:w-4 sm:h-4 text-green-500" />
                <span>النظام يعمل بكفاءة</span>
              </div>
              <div className="flex items-center gap-1">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span className="hidden sm:inline">آخر تحديث: </span>
                <span className="sm:hidden">محدث: </span>
                <span className="hidden sm:inline">{new Date().toLocaleString('ar-SA')}</span>
                <span className="sm:hidden">{new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button 
              onClick={handleRefresh} 
              variant="outline" 
              size={isMobile ? "sm" : "sm"}
              disabled={isRefreshing}
              className="flex-1 sm:flex-none bg-white/80 hover:bg-white border-primary/20 shadow-md text-xs sm:text-sm"
            >
              <RefreshCw className={`w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isRefreshing ? 'جارِ التحديث...' : 'تحديث البيانات'}</span>
              <span className="sm:hidden">{isRefreshing ? 'تحديث...' : 'تحديث'}</span>
            </Button>
          </div>
        </div>
        
        {/* Date Range Selector */}
        <DateRangeSelector 
          onDateRangeChange={handleDateRangeChange}
          isLoading={isRefreshing}
          onRefresh={handleRefresh}
        />

        {/* Revolutionary Mobile vs Desktop Stats Layout */}
        {isMobile ? (
          <div className="space-y-6">
            {/* Mobile: Horizontal Scrolling Stats Cards */}
            <div className="relative">
              <h3 className="text-lg font-bold text-slate-900 mb-3 px-1">الإحصائيات الرئيسية</h3>
              <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x snap-mandatory">
                <div className="flex-none w-72 snap-center">
                  <ModernStatCard
                    title="إجمالي المبيعات"
                    value={`${totalRevenue.toLocaleString()} ج.م`}
                    subtitle={selectedDateRange ? `خلال ${selectedDateRange.label}` : "إجمالي قيمة الطلبات"}
                    icon={<DollarSign className="w-6 h-6" />}
                    iconColor="text-emerald-600"
                    backgroundColor="bg-emerald-50"
                    gradient="from-emerald-50 via-green-50 to-teal-50"
                    buttonText="عرض التفاصيل"
                    onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'orders_stats_button', meta: { to: '/admin/orders' } }); } catch (e) { /* no-op */ } navigate('/admin/orders'); }}
                    trend={{ value: revenueGrowth, label: "مقارنة مع الفترة السابقة", isPositive: revenueGrowth >= 0 }}
                    isLoading={isLoading}
                  />
                </div>
                
                <div className="flex-none w-72 snap-center">
                  <ModernStatCard
                    title="الطلبات اليوم"
                    value={todayOrders}
                    subtitle="طلبات جديدة اليوم"
                    icon={<ShoppingCart className="w-6 h-6" />}
                    iconColor="text-primary"
                    backgroundColor="bg-primary/5"
                    gradient="from-primary/5 via-secondary/5 to-primary/10"
                    buttonText="إدارة الطلبات"
                    onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'today_orders_button', meta: { to: '/admin/orders' } }); } catch (e) { /* no-op */ } navigate('/admin/orders'); }}
                    isLoading={isLoading}
                  />
                </div>
                
                <div className="flex-none w-72 snap-center">
                  <ModernStatCard
                    title="المنتجات"
                    value={products.length}
                    subtitle={`منها ${lowStockProducts.length} منتج بمخزون منخفض`}
                    icon={<Package className="w-6 h-6" />}
                    iconColor="text-purple-600"
                    backgroundColor="bg-purple-50"
                    gradient="from-purple-50 via-violet-50 to-fuchsia-50"
                    buttonText="إدارة المنتجات"
                    onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'products_stats_button', meta: { to: '/admin/products' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}
                    isLoading={isLoading}
                  />
                </div>
                
                <div className="flex-none w-72 snap-center">
                  <ModernStatCard
                    title="العملاء الجدد"
                    value={newUsersCount}
                    subtitle={selectedDateRange ? `خلال ${selectedDateRange.label}` : "مستخدمين جدد"}
                    icon={<Users className="w-6 h-6" />}
                    iconColor="text-orange-600"
                    backgroundColor="bg-orange-50"
                    gradient="from-orange-50 via-amber-50 to-yellow-50"
                    buttonText="عرض المستخدمين"
                    onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'users_stats_button', meta: { to: '/admin/users' } }); } catch (e) { /* no-op */ } navigate('/admin/users'); }}
                    trend={{ value: usersGrowth, label: "مقارنة مع الفترة السابقة", isPositive: usersGrowth >= 0 }}
                    isLoading={isLoading}
                  />
                </div>
              </div>
              {/* Mobile scroll indicator */}
              <div className="flex justify-center mt-2 space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
                <div className="w-2 h-2 bg-slate-300 rounded-full"></div>
              </div>
            </div>
            
            {/* Mobile: Enhanced Charts Section */}
            <div className="space-y-4">
              {/* Mobile Revenue Chart */}
              <Card className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-lg rounded-2xl overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-primary/5 border-b border-slate-200/50 p-4">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-primary" />
                    أداء المبيعات
                  </CardTitle>
                  <CardDescription className="text-sm text-slate-600">
                    {selectedDateRange?.label || 'آخر 7 أيام'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="h-48">
                    <RevenueChart 
                      data={[
                        { date: 'Jan 01', current: 12000, previous: 10000, orders: 45 },
                        { date: 'Jan 02', current: 15000, previous: 12000, orders: 52 },
                        { date: 'Jan 03', current: 18000, previous: 14000, orders: 48 },
                        { date: 'Jan 04', current: 22000, previous: 16000, orders: 61 },
                        { date: 'Jan 05', current: 19000, previous: 15000, orders: 55 },
                        { date: 'Jan 06', current: 25000, previous: 18000, orders: 67 },
                        { date: 'Jan 07', current: 28000, previous: 20000, orders: 72 }
                      ]}
                      isLoading={isLoading}
                      dateRange={selectedDateRange?.label || 'آخر 7 أيام'}
                      comparisonEnabled={!!comparisonDateRange}
                    />
                  </div>
                </CardContent>
              </Card>
              
              {/* Mobile Orders Status Chart */}
              <Card className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-lg rounded-2xl">
                <CardHeader className="bg-gradient-to-r from-slate-50 to-green-50 border-b border-slate-200/50 p-4">
                  <CardTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-green-600" />
                    حالة الطلبات
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-yellow-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-yellow-800">{ordersByStatus.pending}</div>
                      <div className="text-xs text-yellow-600">قيد الانتظار</div>
                    </div>
                    <div className="bg-primary/5 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-primary">{ordersByStatus.confirmed}</div>
                      <div className="text-xs text-primary">مؤكدة</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-green-800">{ordersByStatus.delivered}</div>
                      <div className="text-xs text-green-600">مُسلمة</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-bold text-red-800">{ordersByStatus.cancelled}</div>
                      <div className="text-xs text-red-600">ملغية</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Mobile: Action Cards */}
            <div className="space-y-4">
              {/* Mobile Inventory Alert */}
              <Card className="bg-gradient-to-br from-white to-orange-50/50 border-orange-200/50 shadow-lg rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                      <AlertTriangle className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <div className="text-slate-900">تنبيهات المخزون</div>
                      <div className="text-sm text-slate-600 font-normal">منتجات تحتاج إلى إعادة تموين</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-3 border border-red-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                          <Target className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-red-800">نفدت من المخزن</p>
                          <p className="text-sm text-red-600">{outOfStockProducts.length} منتج</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="bg-white/80 hover:bg-white border-red-300 text-sm" onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'inventory_alert_view', meta: { to: '/admin/products', type: 'out_of_stock' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}>
                        <Eye className="w-4 h-4 mr-1" />
                        عرض
                      </Button>
                    </div>
                  </div>
                  
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center">
                          <BarChart3 className="w-4 h-4 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold text-orange-800">مخزون منخفض</p>
                          <p className="text-sm text-orange-600">{lowStockProducts.length} منتج</p>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="bg-white/80 hover:bg-white border-orange-300 text-sm" onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'inventory_alert_restock', meta: { to: '/admin/products', type: 'low_stock' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}>
                        <TrendingUp className="w-4 h-4 mr-1" />
                        تحديث
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              {/* Mobile Quick Actions */}
              <Card className="bg-gradient-to-br from-white to-primary/5 border-primary/20 shadow-lg rounded-2xl">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center gap-3 text-lg">
                    <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                      <Zap className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <div className="text-slate-900">إجراءات سريعة</div>
                      <div className="text-sm text-slate-600 font-normal">الإجراءات الأكثر استخداماً</div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button 
                    className="w-full justify-start h-12 bg-gradient-to-r from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 text-slate-700 border border-primary/20 shadow-sm" 
                    variant="outline"
                    onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'quick_add_product', meta: { to: '/admin/products' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}
                  >
                    <Plus className="w-5 h-5 mr-3 text-primary" />
                    <div className="text-right">
                      <div className="font-semibold">إضافة منتج جديد</div>
                      <div className="text-xs text-slate-500">إضافة منتج جديد إلى المتجر</div>
                    </div>
                  </Button>
                  
                  <Button 
                    className="w-full justify-start h-12 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-slate-700 border border-green-200 shadow-sm" 
                    variant="outline"
                    onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'quick_review_orders', meta: { to: '/admin/orders' } }); } catch (e) { /* no-op */ } navigate('/admin/orders'); }}
                  >
                    <Eye className="w-5 h-5 mr-3 text-green-600" />
                    <div className="text-right">
                      <div className="font-semibold">مراجعة الطلبات الجديدة</div>
                      <div className="text-xs text-slate-500">عرض ومعالجة الطلبات الجديدة</div>
                    </div>
                  </Button>
                  
                  <Button 
                    className="w-full justify-start h-12 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 text-slate-700 border border-purple-200 shadow-sm" 
                    variant="outline"
                    onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'quick_qr_codes', meta: { to: '/admin/qr-codes' } }); } catch (e) { /* no-op */ } navigate('/admin/qr-codes'); }}
                  >
                    <Package className="w-5 h-5 mr-3 text-purple-600" />
                    <div className="text-right">
                      <div className="font-semibold">إنشاء رموز QR</div>
                      <div className="text-xs text-slate-500">إنشاء رموز QR للمنتجات</div>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // Desktop: Traditional Grid Layout
          <div className="space-y-6">
            {/* Desktop Modern Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ModernStatCard
            title="إجمالي المبيعات"
            value={`${totalRevenue.toLocaleString()} ج.م`}
            subtitle={selectedDateRange ? `خلال ${selectedDateRange.label}` : "إجمالي قيمة الطلبات"}
            icon={<DollarSign className="w-7 h-7" />}
            iconColor="text-emerald-600"
            backgroundColor="bg-emerald-50"
            gradient="from-emerald-50 via-green-50 to-teal-50"
            buttonText="عرض تفاصيل المبيعات"
            onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'orders_stats_button', meta: { to: '/admin/orders' } }); } catch (e) { /* no-op */ } navigate('/admin/orders'); }}
            trend={{ value: revenueGrowth, label: "مقارنة مع الفترة السابقة", isPositive: revenueGrowth >= 0 }}
            isLoading={isLoading}
          />
          
          <ModernStatCard
            title="الطلبات اليوم"
            value={todayOrders}
            subtitle="طلبات جديدة اليوم"
            icon={<ShoppingCart className="w-7 h-7" />}
            iconColor="text-primary"
            backgroundColor="bg-primary/5"
            gradient="from-primary/5 via-secondary/5 to-primary/10"
            buttonText="إدارة الطلبات"
            onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'today_orders_button', meta: { to: '/admin/orders' } }); } catch (e) { /* no-op */ } navigate('/admin/orders'); }}
            isLoading={isLoading}
          />
          
          <ModernStatCard
            title="المنتجات"
            value={products.length}
            subtitle={`منها ${lowStockProducts.length} منتج بمخزون منخفض`}
            icon={<Package className="w-7 h-7" />}
            iconColor="text-purple-600"
            backgroundColor="bg-purple-50"
            gradient="from-purple-50 via-violet-50 to-fuchsia-50"
            buttonText="إدارة المنتجات"
            onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'products_stats_button', meta: { to: '/admin/products' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}
            isLoading={isLoading}
          />
          
          <ModernStatCard
            title="العملاء الجدد"
            value={newUsersCount}
            subtitle={selectedDateRange ? `خلال ${selectedDateRange.label}` : "مستخدمين جدد"}
            icon={<Users className="w-7 h-7" />}
            iconColor="text-orange-600"
            backgroundColor="bg-orange-50"
            gradient="from-orange-50 via-amber-50 to-yellow-50"
            buttonText="عرض المستخدمين"
            onButtonClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'users_stats_button', meta: { to: '/admin/users' } }); } catch (e) { /* no-op */ } navigate('/admin/users'); }}
            trend={{ value: usersGrowth, label: "مقارنة مع الفترة السابقة", isPositive: usersGrowth >= 0 }}
            isLoading={isLoading}
          />
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          <div className="lg:col-span-2">
            <RevenueChart 
              data={[
                { date: 'Jan 01', current: 12000, previous: 10000, orders: 45 },
                { date: 'Jan 02', current: 15000, previous: 12000, orders: 52 },
                { date: 'Jan 03', current: 18000, previous: 14000, orders: 48 },
                { date: 'Jan 04', current: 22000, previous: 16000, orders: 61 },
                { date: 'Jan 05', current: 19000, previous: 15000, orders: 55 },
                { date: 'Jan 06', current: 25000, previous: 18000, orders: 67 },
                { date: 'Jan 07', current: 28000, previous: 20000, orders: 72 }
              ]}
              isLoading={isLoading}
              dateRange={selectedDateRange?.label || 'آخر 7 أيام'}
              comparisonEnabled={!!comparisonDateRange}
            />
          </div>
          
          <OrdersChart 
            data={[
              { date: 'Jan 01', pending: 12, confirmed: 25, delivered: 8, cancelled: 2 },
              { date: 'Jan 02', pending: 15, confirmed: 28, delivered: 12, cancelled: 1 },
              { date: 'Jan 03', pending: 10, confirmed: 32, delivered: 15, cancelled: 3 },
              { date: 'Jan 04', pending: 18, confirmed: 35, delivered: 18, cancelled: 2 },
              { date: 'Jan 05', pending: 14, confirmed: 30, delivered: 22, cancelled: 1 },
              { date: 'Jan 06', pending: 20, confirmed: 38, delivered: 25, cancelled: 4 },
              { date: 'Jan 07', pending: 16, confirmed: 42, delivered: 28, cancelled: 2 }
            ]}
            isLoading={isLoading}
          />
          
          <CategoryDistribution 
            data={[
              { name: 'إلكترونيات', value: 45, color: '#3b82f6' },
              { name: 'ملابس', value: 32, color: '#10b981' },
              { name: 'مجوهرات', value: 28, color: '#f59e0b' },
              { name: 'كتب', value: 20, color: '#ef4444' },
              { name: 'رياضة', value: 15, color: '#8b5cf6' },
            ]}
            isLoading={isLoading}
          />
        </div>

        {/* Enhanced Inventory Alert & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8">
          {/* Modern Inventory Alert */}
          <Card className="bg-gradient-to-br from-white to-orange-50/50 border-orange-200/50 shadow-xl">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
                <div>
                  <div className="text-slate-900 text-base sm:text-lg">تنبيهات المخزون</div>
                  <div className="text-xs sm:text-sm text-slate-600 font-normal">منتجات تحتاج إلى إعادة تموين</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 sm:space-y-4">
              <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-xl p-3 sm:p-4 border border-red-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-red-500 rounded-full flex items-center justify-center">
                      <Target className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-red-800 text-sm sm:text-base">نفدت من المخزن</p>
                      <p className="text-xs sm:text-sm text-red-600">{outOfStockProducts.length} منتج</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="bg-white/80 hover:bg-white border-red-300 text-xs sm:text-sm px-2 sm:px-3" onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'inventory_alert_view', meta: { to: '/admin/products', type: 'out_of_stock' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}>
                    <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">عرض</span>
                    <span className="sm:hidden">عرض</span>
                  </Button>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-xl p-3 sm:p-4 border border-orange-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-orange-500 rounded-full flex items-center justify-center">
                      <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-semibold text-orange-800 text-sm sm:text-base">مخزون منخفض</p>
                      <p className="text-xs sm:text-sm text-orange-600">{lowStockProducts.length} منتج</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="bg-white/80 hover:bg-white border-orange-300 text-xs sm:text-sm px-2 sm:px-3" onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'inventory_alert_restock', meta: { to: '/admin/products', type: 'low_stock' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}>
                    <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                    <span className="hidden sm:inline">تحديث المخزون</span>
                    <span className="sm:hidden">تحديث</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Quick Actions */}
          <Card className="bg-gradient-to-br from-white to-primary/5 border-primary/20 shadow-xl">
            <CardHeader className="pb-3 sm:pb-4">
              <CardTitle className="flex items-center gap-2 sm:gap-3 text-lg sm:text-xl">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-xl flex items-center justify-center">
                  <Zap className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                </div>
                <div>
                  <div className="text-slate-900 text-base sm:text-lg">إجراءات سريعة</div>
                  <div className="text-xs sm:text-sm text-slate-600 font-normal">الإجراءات الأكثر استخداماً</div>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3">
              <Button 
                className="w-full justify-start h-10 sm:h-12 bg-gradient-to-r from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 text-slate-700 border border-primary/20 shadow-sm text-xs sm:text-sm" 
                variant="outline"
                onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'quick_add_product', meta: { to: '/admin/products' } }); } catch (e) { /* no-op */ } navigate('/admin/products'); }}
              >
                <Plus className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-primary" />
                <div className="text-right">
                  <div className="font-semibold">إضافة منتج جديد</div>
                  <div className="text-xs text-slate-500 hidden sm:block">إضافة منتج جديد إلى المتجر</div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-10 sm:h-12 bg-gradient-to-r from-green-50 to-emerald-50 hover:from-green-100 hover:to-emerald-100 text-slate-700 border border-green-200 shadow-sm text-xs sm:text-sm" 
                variant="outline"
                onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'quick_review_orders', meta: { to: '/admin/orders' } }); } catch (e) { /* no-op */ } navigate('/admin/orders'); }}
              >
                <Eye className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-green-600" />
                <div className="text-right">
                  <div className="font-semibold">مراجعة الطلبات الجديدة</div>
                  <div className="text-xs text-slate-500 hidden sm:block">عرض ومعالجة الطلبات الجديدة</div>
                </div>
              </Button>
              
              <Button 
                className="w-full justify-start h-10 sm:h-12 bg-gradient-to-r from-purple-50 to-violet-50 hover:from-purple-100 hover:to-violet-100 text-slate-700 border border-purple-200 shadow-sm text-xs sm:text-sm" 
                variant="outline"
                onClick={async () => { try { await logHistory({ section: 'admin_dashboard', action: 'navigate', note: 'quick_qr_codes', meta: { to: '/admin/qr-codes' } }); } catch (e) { /* no-op */ } navigate('/admin/qr-codes'); }}
              >
                <Package className="w-4 h-4 sm:w-5 sm:h-5 mr-2 sm:mr-3 text-purple-600" />
                <div className="text-right">
                  <div className="font-semibold">إنشاء رموز QR</div>
                  <div className="text-xs text-slate-500 hidden sm:block">إنشاء رموز QR للمنتجات</div>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
