import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { apiGet, apiPostJson, apiPatchJson } from '@/lib/api';
import { Order, TrackingEvent } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MapPin, 
  User, 
  Calendar,
  CreditCard,
  ArrowRight,
  ShoppingCart,
  Share2,
  X,
  RotateCcw,
  CalendarCheck,
  Wallet,
  Navigation,
  Search,
  Star
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { useToast } from '@/hooks/use-toast';
import OrderRating from '@/components/order/OrderRating';

const OrderTracking = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useDualAuth();
  const { hidePrices } = usePricingSettings();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get status label in Arabic
  const getStatusLabel = useCallback((status: string) => {
    const statusLabels: Record<string, string> = {
      pending: 'قيد التجهيز',
      confirmed: 'تم التأكيد',
      processing: 'قيد التنفيذ',
      shipped: 'تم الشحن',
      out_for_delivery: 'خارج للتوصيل',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
      refunded: 'تم الاسترجاع',
      returned: 'تم الإرجاع'
    };
    return statusLabels[status] || status;
  }, []);

  // Get status icon
  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-5 h-5" />,
      confirmed: <CheckCircle className="w-5 h-5" />,
      processing: <Package className="w-5 h-5" />,
      shipped: <Truck className="w-5 h-5" />,
      out_for_delivery: <Truck className="w-5 h-5" />,
      delivered: <CheckCircle className="w-5 h-5" />,
      cancelled: <XCircle className="w-5 h-5" />,
      refunded: <XCircle className="w-5 h-5" />,
      returned: <XCircle className="w-5 h-5" />
    };
    return icons[status] || <Package className="w-5 h-5" />;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-orange-100 text-orange-800 border-orange-300',
      confirmed: 'bg-primary/10 text-primary border-primary/30',
      processing: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      out_for_delivery: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      refunded: 'bg-red-100 text-red-800 border-red-300',
      returned: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Poll for order updates every 30 seconds
  useEffect(() => {
    const pollOrderUpdates = async () => {
      if (!order?.id || !user?.id) return;
      
      try {
        const res = await apiGet<Order>(`/api/orders/${order.id}`);
        if (res.ok && res.item) {
          // Check if the order belongs to the current user
          if (res.item.userId === user?.id) {
            // Show notification if status changed
            if (order.status !== res.item.status) {
              toast({
                title: "تحديث حالة الطلب",
                description: `تم تحديث حالة طلبك إلى: ${getStatusLabel(res.item.status)}`,
              });
            }
            setOrder(res.item);
          }
        }
      } catch (err) {
        console.error('Error polling order updates:', err);
      }
    };

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start polling when order is loaded
    if (order?.id && user?.id) {
      pollIntervalRef.current = setInterval(pollOrderUpdates, 30000); // 30 seconds
    }

    // Cleanup interval on unmount
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [order?.id, user?.id, toast, order?.status, getStatusLabel]);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!id) {
      setError('معرف الطلب غير موجود');
      setLoading(false);
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await apiGet<Order>(`/api/orders/${id}`);
        if (res.ok && res.item) {
          // Check if the order belongs to the current user
          if (res.item.userId !== user?.id) {
            setError('لا تملك صلاحية لعرض هذا الطلب');
            return;
          }
          setOrder(res.item);
        } else {
          setError('الطلب غير موجود');
        }
      } catch (err) {
        setError('فشل في تحميل تفاصيل الطلب');
        console.error('Error fetching order:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, isAuthenticated, user, navigate]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      navigate(`/order-tracking/${searchTerm.trim()}`);
    }
  };

  const handleReorder = async () => {
    if (!order) return;
    
    try {
      // Add all items from this order to the cart
      for (const item of order.items) {
        await apiPostJson('/api/cart/add', {
          productId: item.productId,
          quantity: item.quantity
        });
      }
      
      toast({
        title: 'نجاح',
        description: 'تمت إضافة المنتجات إلى سلة التسوق',
      });
      
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

  const handleReferOrder = async () => {
    if (!order) return;
    
    try {
      // Implement referral functionality
      // This would typically generate a referral link or code for the products in this order
      toast({
        title: 'قيد التنفيذ',
        description: 'وظيفة الإحالة قيد التطوير',
      });
      
      // For now, we'll just show a message
      console.log('Refer products from order', order.id);
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إحالة الطلب',
        variant: 'destructive'
      });
      console.error('Error referring order:', err);
    }
  };

  const handleCancelOrder = async () => {
    if (!order) return;
    
    try {
      // Check if order is eligible for cancellation (pending status)
      if (order.status !== 'pending') {
        toast({
          title: 'غير مسموح',
          description: 'لا يمكن إلغاء الطلب إلا إذا كان في حالة "قيد التجهيز"',
          variant: 'destructive'
        });
        return;
      }
      
      // Show confirmation dialog with reason input
      const reason = window.prompt('يرجى تقديم سبب لإلغاء الطلب:');
      if (!reason) {
        return;
      }
      
      // Send cancellation request to backend
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}/request-cancellation`, {
        cancellationRequested: true,
        cancellationReason: reason,
        cancellationRequestedAt: new Date().toISOString()
      });
      
      if (res.ok && res.item) {
        setOrder(res.item);
        toast({
          title: 'نجاح',
          description: 'تم إرسال طلب الإلغاء وينتظر موافقة الإدارة',
        });
      } else {
        throw new Error('فشل في إرسال طلب الإلغاء');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إرسال طلب الإلغاء',
        variant: 'destructive'
      });
      console.error('Error requesting order cancellation:', err);
    }
  };

  const handleReturnRequest = async () => {
    if (!order) return;
    
    try {
      // Check if order is eligible for return (delivered status)
      if (order.status !== 'delivered') {
        toast({
          title: 'غير مسموح',
          description: 'يمكن طلب الإرجاع فقط للطلبات التي تم تسليمها',
          variant: 'destructive'
        });
        return;
      }
      
      // Show confirmation dialog with reason input
      const reason = window.prompt('يرجى تقديم سبب لطلب الإرجاع:');
      if (!reason) {
        return;
      }
      
      // Send return request to backend
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}/request-return`, {
        returnReason: reason
      });
      
      if (res.ok && res.item) {
        setOrder(res.item);
        toast({
          title: 'نجاح',
          description: 'تم إرسال طلب الإرجاع بنجاح وسينتظر موافقة الإدارة',
        });
      } else {
        throw new Error('فشل في إرسال طلب الإرجاع');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إرسال طلب الإرجاع',
        variant: 'destructive'
      });
      console.error('Error requesting return:', err);
    }
  };

  const handleRatingSubmit = async (rating: number, review: string) => {
    if (!order) return;
    
    try {
      const res = await apiPostJson<{ ok: boolean }, { orderId: string; rating: number; review: string }>(`/api/orders/rate`, {
        orderId: order.id,
        rating,
        review
      });
      
      if (res.ok) {
        // Update order with rating info
        setOrder({
          ...order,
          internalNotes: [
            ...(order.internalNotes || []),
            {
              text: `تقييم العميل: ${rating} نجوم${review ? ` - ${review}` : ''}`,
              createdBy: 'العميل',
              createdAt: new Date().toISOString()
            }
          ]
        });
      } else {
        throw new Error('فشل في إرسال التقييم');
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      throw err;
    }
  };

  // Add a new function to check cancellation status
  const getCancellationStatus = () => {
    if (!order) return null;
    
    if (order.cancellationRequested && order.status !== 'cancelled') {
      return (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-3">
          <div className="flex items-center">
            <Clock className="w-5 h-5 text-yellow-600 mr-2" />
            <span className="text-yellow-800 font-medium">طلب الإلغاء قيد المراجعة</span>
          </div>
          <p className="text-yellow-700 text-sm mt-1">
            تم إرسال طلب الإلغاء في {order.cancellationRequestedAt && new Date(order.cancellationRequestedAt).toLocaleDateString('ar-EG')} 
            {order.cancellationReason && ` - السبب: ${order.cancellationReason}`}
          </p>
        </div>
      );
    }
    
    return null;
  };

  // Get status description
  const getStatusDescription = (status: string) => {
    const descriptions: Record<string, string> = {
      pending: 'تم استلام الطلب وينتظر المعالجة',
      confirmed: 'تم تأكيد الطلب وقيد التجهيز',
      processing: 'طلبك قيد التجهيز في المستودع',
      shipped: 'طلبك في طريقه إليك',
      out_for_delivery: 'طلبك خارج للتوصيل',
      delivered: 'تم تسليم الطلب بنجاح',
      cancelled: 'تم إلغاء الطلب',
      refunded: 'تم استرداد المبلغ',
      returned: 'تم إرجاع الطلب'
    };
    return descriptions[status] || status;
  };

  // Helper function to generate timeline items
  const getTimelineItems = (order: Order) => {
    // If we have tracking events, use them
    if (order.trackingEvents && order.trackingEvents.length > 0) {
      return order.trackingEvents.map((event: TrackingEvent, index: number) => ({
        title: getStatusLabel(event.status),
        description: event.description || getStatusDescription(event.status),
        date: event.timestamp,
        location: event.location?.name,
        carrier: event.carrier,
        trackingNumber: event.trackingNumber,
        completed: true,
        active: index === order.trackingEvents!.length - 1
      }));
    }
    
    // Fallback to original timeline logic
    const items = [
      {
        title: 'تم وضع الطلب',
        description: 'تم استلام طلبك بنجاح',
        date: order.createdAt,
        estimatedTime: 'فوراً',
        completed: true,
        active: false
      },
      {
        title: 'تم تأكيد الدفع',
        description: 'تم تأكيد عملية الدفع بنجاح',
        date: order.paymentStatus === 'paid' ? order.updatedAt : null,
        estimatedTime: '1-2 ساعة',
        completed: order.paymentStatus === 'paid',
        active: order.status === 'pending' && order.paymentStatus !== 'paid'
      },
      {
        title: 'قيد التجهيز',
        description: 'طلبك قيد التجهيز في المستودع',
        date: order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'out_for_delivery' ? order.updatedAt : null,
        estimatedTime: '1-2 يوم عمل',
        completed: order.status === 'confirmed' || order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'out_for_delivery',
        active: order.status === 'confirmed'
      },
      {
        title: 'قيد التنفيذ',
        description: 'طلبك قيد التنفيذ',
        date: order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'out_for_delivery' ? order.updatedAt : null,
        estimatedTime: '1-3 يوم عمل',
        completed: order.status === 'processing' || order.status === 'shipped' || order.status === 'delivered' || order.status === 'out_for_delivery',
        active: order.status === 'processing'
      },
      {
        title: 'تم الشحن',
        description: 'طلبك في طريقه إليك',
        date: order.status === 'shipped' || order.status === 'delivered' || order.status === 'out_for_delivery' ? order.updatedAt : null,
        estimatedTime: '2-5 يوم عمل',
        completed: order.status === 'shipped' || order.status === 'delivered' || order.status === 'out_for_delivery',
        active: order.status === 'shipped'
      },
      {
        title: 'خارج للتوصيل',
        description: 'طلبك خارج للتوصيل',
        date: order.status === 'out_for_delivery' || order.status === 'delivered' ? order.updatedAt : null,
        estimatedTime: '1 يوم عمل',
        completed: order.status === 'out_for_delivery' || order.status === 'delivered',
        active: order.status === 'out_for_delivery'
      },
      {
        title: 'تم التسليم',
        description: 'تم تسليم طلبك بنجاح',
        date: order.status === 'delivered' ? order.updatedAt : null,
        estimatedTime: 'فوراً',
        completed: order.status === 'delivered',
        active: order.status === 'delivered'
      }
    ];

    return items;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Search Bar */}
        <div className="mb-6">
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث برقم الطلب أو رقم التتبع..."
                className="pr-12 py-3 text-lg rounded-full border-2 border-primary/20 focus:border-primary focus:ring-primary/20"
              />
              <Button 
                type="submit" 
                className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-primary hover:bg-primary text-white rounded-full px-6"
              >
                بحث
              </Button>
            </div>
          </form>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
          <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <ArrowRight className="w-4 h-4" />
          <Link to="/profile" className="hover:text-primary transition-colors">الملف الشخصي</Link>
          <ArrowRight className="w-4 h-4" />
          <Link to="/profile/orders" className="hover:text-primary transition-colors">طلباتي</Link>
          <ArrowRight className="w-4 h-4" />
          <span className="text-slate-900 font-medium">تتبع الطلب #{order?.id?.slice(-6) || id?.slice(-6) || ''}</span>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">تتبع الطلب</h1>
            <p className="text-slate-600">تتبع حالة طلبك والتواصل مع فريق الدعم</p>
          </div>
          <Badge className={`px-4 py-2 text-sm font-semibold ${getStatusColor(order.status)}`}>
            <div className="flex items-center gap-2">
              {getStatusIcon(order.status)}
              {getStatusLabel(order.status)}
            </div>
          </Badge>
        </div>

        {/* Show cancellation status if requested */}
        {getCancellationStatus()}

        {/* Order Map Tracking - Only show for shipped or delivered orders */}
        {(order.status === 'shipped' || order.status === 'delivered') && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                تتبع الشحنة على الخريطة
              </CardTitle>
              <CardDescription> موقع الشحنة الحالي ومسار التوصيل</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="bg-slate-100 rounded-lg h-64 flex items-center justify-center relative overflow-hidden">
                {/* Simplified map visualization */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/10">
                  {/* Route line */}
                  <div className="absolute top-1/2 left-10 right-10 h-1 bg-primary/30"></div>
                  
                  {/* Start point */}
                  <div className="absolute top-1/2 left-10 transform -translate-y-1/2 w-4 h-4 bg-green-500 rounded-full border-2 border-white shadow"></div>
                  <div className="absolute top-1/2 left-8 transform -translate-y-6 text-xs font-medium text-green-700">المستودع</div>
                  
                  {/* Intermediate points */}
                  <div className="absolute top-1/2 left-1/4 transform -translate-y-1/2 w-3 h-3 bg-primary/40 rounded-full border-2 border-white shadow"></div>
                  <div className="absolute top-1/2 left-1/2 transform -translate-y-1/2 w-3 h-3 bg-primary/40 rounded-full border-2 border-white shadow"></div>
                  <div className="absolute top-1/2 left-3/4 transform -translate-y-1/2 w-3 h-3 bg-primary/40 rounded-full border-2 border-white shadow"></div>
                  
                  {/* Current position (dynamic based on status) */}
                  <div className="absolute top-1/2 left-3/4 transform -translate-y-1/2 -translate-x-1/2 w-6 h-6 bg-primary rounded-full border-2 border-white shadow-lg flex items-center justify-center animate-pulse">
                    <Truck className="w-3 h-3 text-white" />
                  </div>
                  <div className="absolute top-1/2 left-3/4 transform -translate-y-8 -translate-x-1/2 text-xs font-medium text-primary">الشحنة الحالية</div>
                  
                  {/* End point */}
                  <div className="absolute top-1/2 right-10 transform -translate-y-1/2 w-4 h-4 bg-red-500 rounded-full border-2 border-white shadow"></div>
                  <div className="absolute top-1/2 right-8 transform -translate-y-6 text-xs font-medium text-red-700">عنوانك</div>
                </div>
                
                {/* Estimated delivery info */}
                {order.estimatedDelivery && (
                  <div className="absolute bottom-4 left-4 bg-white/80 backdrop-blur-sm rounded-lg p-3 shadow">
                    <p className="text-sm font-medium text-slate-700">التسليم المتوقع</p>
                    <p className="text-lg font-bold text-slate-900">
                      {new Date(order.estimatedDelivery).toLocaleDateString('ar-EG')}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enhanced Order Status Timeline */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              جدول زمني للطلب
            </CardTitle>
            <CardDescription>تتبع رحلة طلبك من البداية إلى النهاية</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute right-4 top-3 bottom-3 w-0.5 bg-slate-200"></div>
              
              {/* Timeline items */}
              <div className="space-y-6">
                {getTimelineItems(order).map((item, index) => (
                  <div key={index} className="relative flex items-start gap-4">
                    <div className={`absolute right-1 top-1 w-6 h-6 rounded-full flex items-center justify-center ${
                      item.completed ? 'bg-green-500' : 
                      item.active ? 'bg-primary' : 'bg-slate-300'
                    }`}>
                      {item.completed ? (
                        <CheckCircle className="w-4 h-4 text-white" />
                      ) : item.active ? (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      ) : null}
                    </div>
                    <div className="mr-10 flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className={`font-medium ${
                          item.completed ? 'text-green-700' : 
                          item.active ? 'text-primary' : 'text-slate-500'
                        }`}>
                          {item.title}
                        </h3>
                        {item.date && (
                          <span className="text-sm text-slate-500">
                            {new Date(item.date).toLocaleDateString('ar-EG')}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-sm text-slate-600 mt-1">{item.description}</p>
                      )}
                      {item.estimatedTime && (
                        <p className="text-xs text-slate-500 mt-1">الوقت المقدر: {item.estimatedTime}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  محتويات الطلب
                </CardTitle>
                <CardDescription>المنتجات المطلوبة</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                        {item.product.image || item.product.category ? (
                          <img 
                            src={item.product.image || `/api/categories/${item.product.category}/image`} 
                            alt={item.product.nameAr} 
                            className="w-full h-full object-cover rounded-lg"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              target.src = 'https://via.placeholder.com/64x64?text=No+Image';
                            }}
                          />
                        ) : (
                          <Package className="w-6 h-6 text-slate-400" />
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-slate-900">{item.product.nameAr}</h3>
                        <p className="text-sm text-slate-600">الكمية: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-slate-900">{item.price.toLocaleString()} ج.م</p>
                        <p className="text-sm text-slate-600">الإجمالي: {(item.price * item.quantity).toLocaleString()} ج.م</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Order Rating - Only show for delivered orders that haven't been rated yet */}
            {order.status === 'delivered' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Star className="w-5 h-5" />
                    تقييم الطلب
                  </CardTitle>
                  <CardDescription>شارك تجربتك مع هذا الطلب</CardDescription>
                </CardHeader>
                <CardContent>
                  <OrderRating 
                    orderId={order.id} 
                    onRatingSubmit={handleRatingSubmit} 
                  />
                </CardContent>
              </Card>
            )}

            {/* Order Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  ملخص الطلب
                </CardTitle>
                <CardDescription>تفاصيل التكلفة والدفع</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-slate-600">المجموع الفرعي</span>
                    <span className="font-medium">{order.subtotal.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">الشحن</span>
                    <span className="font-medium">{order.shipping.toLocaleString()} ج.م</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">الضريبة</span>
                    <span className="font-medium">{order.tax.toLocaleString()} ج.م</span>
                  </div>
                  <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-lg">
                    <span>الإجمالي</span>
                    <span className="text-primary">{order.total.toLocaleString()} ج.م</span>
                  </div>
                  <div className="pt-3">
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">طريقة الدفع:</span> {order.paymentMethod}
                    </p>
                    <p className="text-sm text-slate-600">
                      <span className="font-medium">حالة الدفع:</span> {order.paymentStatus}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Info Sidebar */}
          <div className="space-y-6">
            {/* Order Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  معلومات الطلب
                </CardTitle>
                <CardDescription>تفاصيل الطلب والزمن</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">تاريخ الطلب</p>
                    <p className="font-medium">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
                    <p className="text-xs text-slate-500">{new Date(order.createdAt).toLocaleTimeString('ar-EG')}</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <Package className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">رقم الطلب</p>
                    <p className="font-mono font-medium">#{order.id}</p>
                  </div>
                </div>
                
                {order.trackingNumber && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Truck className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">رقم التتبع</p>
                      <p className="font-mono font-medium">{order.trackingNumber}</p>
                    </div>
                  </div>
                )}
                
                {order.estimatedDelivery && (
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <Clock className="w-5 h-5 text-orange-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">التسليم المتوقع</p>
                      <p className="font-medium">{new Date(order.estimatedDelivery).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Shipping Address */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  عنوان التوصيل
                </CardTitle>
                <CardDescription>عنوان الشحن والبيانات</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p className="font-medium">{order.shippingAddress.street}</p>
                  <p>{order.shippingAddress.city}, {order.shippingAddress.state}</p>
                  <p>{order.shippingAddress.postalCode}</p>
                  <p>{order.shippingAddress.country}</p>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  الإجراءات
                </CardTitle>
                <CardDescription>خيارات إضافية للطلب</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Cancel Order Button - Only for pending orders */}
                {order.status === 'pending' && (
                  <Button 
                    className="w-full" 
                    variant="destructive"
                    onClick={handleCancelOrder}
                  >
                    <X className="w-4 h-4 ml-2" />
                    إلغاء الطلب
                  </Button>
                )}
                
                {/* Return Request Button - Only for delivered orders */}
                {order.status === 'delivered' && (
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={handleReturnRequest}
                  >
                    <RotateCcw className="w-4 h-4 ml-2" />
                    طلب إرجاع
                  </Button>
                )}
                
                <Button className="w-full" variant="outline">
                  <Truck className="w-4 h-4 ml-2" />
                  تتبع الشحنة
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleReorder}
                >
                  <ShoppingCart className="w-4 h-4 ml-2" />
                  إعادة الطلب
                </Button>
                <Button 
                  className="w-full" 
                  variant="outline"
                  onClick={handleReferOrder}
                >
                  <Share2 className="w-4 h-4 ml-2" />
                  إحالة المنتجات
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};
