import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { apiGet } from '@/lib/api';
import { 
  TrendingUp, 
  ShoppingCart, 
  DollarSign, 
  Users,
  Package,
  RotateCcw,
  BarChart3,
  PieChart
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';

interface OrderAnalytics {
  totalOrders: number;
  recentOrders: number;
  statusDistribution: Array<{ _id: string; count: number }>;
  revenueStats: {
    totalRevenue: number;
    avgOrderValue: number;
    maxOrderValue: number;
    minOrderValue: number;
  };
  ordersByDate: Array<{ _id: string; count: number; totalRevenue: number; avgOrderValue: number }>;
  topProducts: Array<{
    _id: string;
    productId: string;
    totalQuantity: number;
    totalRevenue: number;
    orderCount: number;
  }>;
}

interface ReturnAnalytics {
  totalReturns: number;
  recentReturns: number;
  statusDistribution: Array<{ _id: string; count: number }>;
  refundStats: {
    totalRefundAmount: number;
    avgRefundAmount: number;
    completedRefunds: number;
  };
  returnsByDate: Array<{ _id: string; count: number; totalAmount: number }>;
}

interface CustomerAnalytics {
  totalCustomers: number;
  newCustomers: number;
  activeCustomers: number;
}

const AnalyticsDashboard = () => {
  const [orderAnalytics, setOrderAnalytics] = useState<OrderAnalytics | null>(null);
  const [returnAnalytics, setReturnAnalytics] = useState<ReturnAnalytics | null>(null);
  const [customerAnalytics, setCustomerAnalytics] = useState<CustomerAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState(30);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Fetch all analytics in parallel
        const [ordersRes, returnsRes, customersRes] = await Promise.all([
          apiGet<OrderAnalytics>(`/api/analytics/orders?days=${timeRange}`),
          apiGet<ReturnAnalytics>(`/api/analytics/returns?days=${timeRange}`),
          apiGet<CustomerAnalytics>(`/api/analytics/customers?days=${timeRange}`)
        ]);
        
        if (ordersRes.ok) setOrderAnalytics(ordersRes.data);
        if (returnsRes.ok) setReturnAnalytics(returnsRes.data);
        if (customersRes.ok) setCustomerAnalytics(customersRes.data);
        
        if (!ordersRes.ok || !returnsRes.ok || !customersRes.ok) {
          setError('فشل في تحميل بعض البيانات التحليلية');
        }
      } catch (err) {
        setError('فشل في تحميل البيانات التحليلية');
        console.error('Error fetching analytics:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchAnalytics();
  }, [timeRange]);

  // Get status label in Arabic
  const getOrderStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      pending: 'قيد التجهيز',
      confirmed: 'مؤكد',
      processing: 'قيد التنفيذ',
      shipped: 'تم الشحن',
      out_for_delivery: 'خارج للتوصيل',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
      refunded: 'مسترد',
      returned: 'مرتجع'
    };
    return statusLabels[status] || status;
  };

  // Get return status label in Arabic
  const getReturnStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      requested: 'طلب جديد',
      approved: 'موافق عليه',
      processing: 'قيد المعالجة',
      shipped: 'تم الشحن',
      delivered: 'تم التسليم',
      completed: 'مكتمل',
      rejected: 'مرفوض'
    };
    return statusLabels[status] || status;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-end">
        <div className="flex gap-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              className={`px-3 py-1 rounded-full text-sm ${
                timeRange === days
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
              onClick={() => setTimeRange(days)}
            >
              {days} يوم
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الطلبات</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {orderAnalytics?.totalOrders?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              +{orderAnalytics?.recentOrders?.toLocaleString() || '0'} طلب جديد
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(orderAnalytics?.revenueStats?.totalRevenue || 0).toLocaleString()} ر.س
            </div>
            <p className="text-xs text-muted-foreground">
              متوسط الطلب: {(orderAnalytics?.revenueStats?.avgOrderValue || 0).toFixed(2)} ر.س
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي العملاء</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {customerAnalytics?.totalCustomers?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              +{customerAnalytics?.newCustomers?.toLocaleString() || '0'} عميل جديد
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">إجمالي الإرجاعات</CardTitle>
            <RotateCcw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {returnAnalytics?.totalReturns?.toLocaleString() || '0'}
            </div>
            <p className="text-xs text-muted-foreground">
              {(returnAnalytics?.totalReturns && orderAnalytics?.totalOrders
                ? ((returnAnalytics.totalReturns / orderAnalytics.totalOrders) * 100).toFixed(1)
                : '0')}% من الطلبات
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Distributions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Order Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              توزيع حالة الطلبات
            </CardTitle>
            <CardDescription>
              توزيع الطلبات حسب الحالة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {orderAnalytics?.statusDistribution?.map((status) => (
                <div key={status._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span>{getOrderStatusLabel(status._id)}</span>
                  </div>
                  <Badge variant="secondary">{status.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Return Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              توزيع حالة الإرجاعات
            </CardTitle>
            <CardDescription>
              توزيع الإرجاعات حسب الحالة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {returnAnalytics?.statusDistribution?.map((status) => (
                <div key={status._id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span>{getReturnStatusLabel(status._id)}</span>
                  </div>
                  <Badge variant="secondary">{status.count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            أفضل المنتجات مبيعاً
          </CardTitle>
          <CardDescription>
            أعلى 10 منتجات حسب الإيرادات
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {orderAnalytics?.topProducts?.map((product, index) => (
              <div key={product.productId} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-blue-600">#{index + 1}</span>
                  </div>
                  <span className="font-medium">{product._id}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{product.totalRevenue.toLocaleString()} ر.س</p>
                  <p className="text-sm text-muted-foreground">
                    {product.totalQuantity} وحدة، {product.orderCount} طلب
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AnalyticsDashboard;