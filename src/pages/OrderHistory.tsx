import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { apiGet, apiPostJson } from '@/lib/api';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  Search,
  ArrowRight,
  ShoppingCart,
  User,
  Share2
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { useToast } from '@/hooks/use-toast';

const OrderHistory = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useDualAuth();
  const { hidePrices } = usePricingSettings();
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchOrders = async () => {
      try {
        setLoading(true);
        // Assuming the API endpoint for user orders is /api/users/{userId}/orders
        const res = await apiGet<Order>(`/api/users/${user?.id}/orders`);
        if (res.ok && res.items) {
          setOrders(res.items);
          setFilteredOrders(res.items);
        }
      } catch (err) {
        console.error('Error fetching orders:', err);
      } finally {
        setLoading(false);
      }
    };

    if (user?.id) {
      fetchOrders();
    }
  }, [isAuthenticated, user, navigate]);
  useEffect(() => {
    // Filter orders based on search term, status, and date
    let result = orders;
    
    if (searchTerm) {
      result = result.filter(order => 
        (order.orderNumber || order._id || order.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.items.some(item => 
          item.product.nameAr.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
    
    if (statusFilter !== 'all') {
      result = result.filter(order => order.status === statusFilter);
    }
    
    // Date filtering
    if (dateFilter !== 'all') {
      const now = new Date();
      const filterDate = new Date();
      
      switch (dateFilter) {
        case '7':
          filterDate.setDate(now.getDate() - 7);
          break;
        case '30':
          filterDate.setDate(now.getDate() - 30);
          break;
        case '90':
          filterDate.setDate(now.getDate() - 90);
          break;
        default:
          break;
      }
      
      result = result.filter(order => new Date(order.createdAt) >= filterDate);
    }
    
    setFilteredOrders(result);
  }, [searchTerm, statusFilter, dateFilter, orders]);

  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      pending: 'قيد التجهيز',
      confirmed: 'تم التأكيد',
      processing: 'قيد التنفيذ',
      shipped: 'تم الشحن',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
      refunded: 'تم الاسترجاع'
    };
    return statusLabels[status] || status;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-orange-100 text-orange-800 border-orange-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      processing: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      refunded: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Add function to get cancellation status badge
  const getCancellationStatus = (order: Order) => {
    if (order.cancellationRequested && order.status !== 'cancelled') {
      return (
        <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300 ml-2">
          إلغاء قيد المراجعة
        </Badge>
      );
    }
    return null;
  };

  const handleTrackOrder = (orderId: string) => {
    navigate(`/order/${orderId}`);
  };

  const handleReorder = async (orderId: string) => {
    try {
      // Find the order
      const order = orders.find(o => (o._id || o.id) === orderId);
      if (!order) {
        toast({
          title: 'خطأ',
          description: 'الطلب غير موجود',
          variant: 'destructive'
        });
        return;
      }
      
      // Add all items from this order to the cart
      let successCount = 0;
      let errorCount = 0;
      
      for (const item of order.items) {
        try {
          await apiPostJson('/api/cart/add', {
            productId: item.productId,
            quantity: item.quantity
          });
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('Error adding item to cart:', err);
        }
      }
      
      if (errorCount === 0) {
        toast({
          title: 'نجاح',
          description: `تمت إضافة ${successCount} منتج إلى سلة التسوق`,
        });
      } else if (successCount > 0) {
        toast({
          title: 'نجاح جزئي',
          description: `تمت إضافة ${successCount} منتج إلى سلة التسوق. فشل ${errorCount} منتج.`,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'خطأ',
          description: 'فشل في إضافة المنتجات إلى سلة التسوق',
          variant: 'destructive'
        });
        return;
      }
      
      // Navigate to cart
      navigate('/cart');
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إعادة الطلب',
        variant: 'destructive'
      });
      console.error('Error reordering:', err);
    }
  };

  const handleOneClickReorder = async (orderId: string) => {
    try {
      // Find the order
      const order = orders.find(o => (o._id || o.id) === orderId);
      if (!order) {
        toast({
          title: 'خطأ',
          description: 'الطلب غير موجود',
          variant: 'destructive'
        });
        return;
      }
      
      // Add all items from this order to the cart
      let successCount = 0;
      let errorCount = 0;
      
      for (const item of order.items) {
        try {
          await apiPostJson('/api/cart/add', {
            productId: item.productId,
            quantity: item.quantity
          });
          successCount++;
        } catch (err) {
          errorCount++;
          console.error('Error adding item to cart:', err);
        }
      }
      
      if (errorCount === 0) {
        toast({
          title: 'نجاح',
          description: `تمت إضافة ${successCount} منتج إلى سلة التسوق`,
        });
        
        // Navigate to checkout directly
        navigate('/checkout');
      } else if (successCount > 0) {
        toast({
          title: 'نجاح جزئي',
          description: `تمت إضافة ${successCount} منتج إلى سلة التسوق. فشل ${errorCount} منتج.`,
          variant: 'destructive'
        });
        
        // Navigate to cart to review
        navigate('/cart');
      } else {
        toast({
          title: 'خطأ',
          description: 'فشل في إضافة المنتجات إلى سلة التسوق',
          variant: 'destructive'
        });
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إعادة الطلب',
        variant: 'destructive'
      });
      console.error('Error one-click reordering:', err);
    }
  };

  const handleReferOrder = async (orderId: string) => {
    try {
      // Find the order
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        toast({
          title: 'خطأ',
          description: 'الطلب غير موجود',
          variant: 'destructive'
        });
        return;
      }
      
      // Generate a shareable link for the order products
      const productIds = order.items.map(item => item.productId).join(',');
      const shareUrl = `${window.location.origin}/products?ref=order-${orderId}&products=${productIds}`;
      
      // Try to use the Web Share API if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'مشاركة المنتجات من طلبي',
            text: 'شاهد هذه المنتجات الرائعة التي قمت بشرائها!',
            url: shareUrl
          });
          toast({
            title: 'نجاح',
            description: 'تمت مشاركة المنتجات بنجاح',
          });
        } catch (err) {
          // User cancelled the share dialog, which is not an error
          if ((err as Error).name !== 'AbortError') {
            throw err;
          }
        }
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: 'تم النسخ',
            description: 'تم نسخ رابط المنتجات إلى الحافظة',
          });
        } catch (err) {
          // Fallback to showing the URL
          toast({
            title: 'انسخ الرابط',
            description: shareUrl,
          });
        }
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في مشاركة الطلب',
        variant: 'destructive'
      });
      console.error('Error referring order:', err);
    }
  };

  const handleShareOrder = async (orderId: string) => {
    try {
      // Find the order
      const order = orders.find(o => (o._id || o.id) === orderId);
      if (!order) {
        toast({
          title: 'خطأ',
          description: 'الطلب غير موجود',
          variant: 'destructive'
        });
        return;
      }
      
      // Generate a shareable link for the order
      const shareUrl = `${window.location.origin}/order/${orderId}`;
      const orderDetails = `طلب #${order.orderNumber || (order._id || order.id)?.slice(-6)} - ${
        hidePrices ? '' : `${order.total.toLocaleString()} ج.م - `
      }${order.items.length} منتج`;
      
      // Try to use the Web Share API if available
      if (navigator.share) {
        try {
          await navigator.share({
            title: 'مشاركة تفاصيل الطلب',
            text: orderDetails,
            url: shareUrl
          });
          toast({
            title: 'نجاح',
            description: 'تمت مشاركة تفاصيل الطلب بنجاح',
          });
        } catch (err) {
          // User cancelled the share dialog, which is not an error
          if ((err as Error).name !== 'AbortError') {
            throw err;
          }
        }
      } else {
        // Fallback: copy to clipboard
        try {
          await navigator.clipboard.writeText(shareUrl);
          toast({
            title: 'تم النسخ',
            description: 'تم نسخ رابط الطلب إلى الحافظة',
          });
        } catch (err) {
          // Fallback to showing the URL
          toast({
            title: 'انسخ الرابط',
            description: shareUrl,
          });
        }
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في مشاركة الطلب',
        variant: 'destructive'
      });
      console.error('Error sharing order:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
          <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <ArrowRight className="w-4 h-4" />
          <Link to="/profile" className="hover:text-primary transition-colors">الملف الشخصي</Link>
          <ArrowRight className="w-4 h-4" />
          <span className="text-slate-900 font-medium">سجل الطلبات</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">سجل الطلبات</h1>
            <p className="text-slate-600">مراجعة الطلبات السابقة وإعادة الطلب أو الإحالة</p>
          </div>
          <div className="text-sm text-slate-600">
            إجمالي الطلبات: <span className="font-bold">{orders.length}</span>
          </div>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="البحث برقم الطلب أو اسم المنتج..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">جميع الحالات</option>
                  <option value="pending">قيد التجهيز</option>
                  <option value="confirmed">تم التأكيد</option>
                  <option value="processing">قيد التنفيذ</option>
                  <option value="shipped">تم الشحن</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي</option>
                  <option value="refunded">تم الاسترجاع</option>
                </select>
              </div>
              <div>
                <select
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="all">جميع التواريخ</option>
                  <option value="7">آخر 7 أيام</option>
                  <option value="30">آخر 30 يوم</option>
                  <option value="90">آخر 90 يوم</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        {filteredOrders.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">لا توجد طلبات</h3>
              <p className="text-slate-600 mb-6">لم تقم بأي طلبات بعد</p>
              <Button asChild>
                <Link to="/products">
                  <ShoppingCart className="w-4 h-4 ml-2" />
                  التسوق الآن
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {filteredOrders.map((order) => (
              <Card key={order._id || order.id}>
                <CardHeader className="pb-3">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <CardTitle className="text-lg">
                        الطلب #{order.orderNumber || (order._id || order.id)?.slice(-6) || 'N/A'}
                      </CardTitle>
                      <p className="text-sm text-slate-600">
                        {new Date(order.createdAt).toLocaleDateString('ar-EG')} • {order.items.length} منتج
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className={`px-3 py-1 ${getStatusColor(order.status)}`}>
                        {getStatusLabel(order.status)}
                      </Badge>
                      {getCancellationStatus(order)}
                      {hidePrices ? (
                        <span className="font-bold text-lg text-slate-500">الأسعار مخفية</span>
                      ) : (
                        <span className="font-bold text-lg">{order.total.toLocaleString()} ج.م</span>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Order Items Preview */}
                  <div className="mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {order.items.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                          <div className="w-12 h-12 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                            {item.product.image || item.product.category ? (
                              <img 
                                src={item.product.image || `/api/categories/${item.product.category}/image`} 
                                alt={item.product.nameAr} 
                                className="w-full h-full object-cover rounded-lg"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.src = 'https://via.placeholder.com/48x48?text=No+Image';
                                }}
                              />
                            ) : (
                              <Package className="w-5 h-5 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium text-sm line-clamp-1">{item.product.nameAr}</p>
                            <p className="text-xs text-slate-600">الكمية: {item.quantity}</p>
                          </div>
                        </div>
                      ))}
                      {order.items.length > 3 && (
                        <div className="flex items-center justify-center p-3 bg-slate-50 rounded-lg">
                          <span className="text-sm text-slate-600">+{order.items.length - 3} منتج آخر</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Order Actions */}
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleTrackOrder(order._id || order.id)}
                    >
                      <Package className="w-4 h-4 ml-2" />
                      تتبع الطلب
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleReorder(order._id || order.id)}
                    >
                      <ShoppingCart className="w-4 h-4 ml-2" />
                      إعادة الطلب
                    </Button>
                    <Button 
                      size="sm" 
                      onClick={() => handleOneClickReorder(order._id || order.id)}
                    >
                      <User className="w-4 h-4 ml-2" />
                      إعادة سريعة
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleShareOrder(order._id || order.id)}
                    >
                      <Share2 className="w-4 h-4 ml-2" />
                      مشاركة الطلب
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default OrderHistory;