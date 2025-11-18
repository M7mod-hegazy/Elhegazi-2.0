import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPostJson, apiPatchJson } from '@/lib/api';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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
  Phone,
  Mail,
  MessageSquare,
  Star,
  Download,
  Printer,
  RefreshCw,
  Navigation,
  Zap,
  Shield,
  AlertCircle,
  Info
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface TrackingEvent {
  id: string;
  title: string;
  description: string;
  timestamp: string;
  location?: string;
  status: 'completed' | 'current' | 'pending';
  icon: React.ReactNode;
}

const EnhancedOrderTracking: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isAuthenticated } = useDualAuth();
  const { hidePrices } = usePricingSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('+201234567890');
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const refreshInterval = useRef<NodeJS.Timeout | null>(null);

  // Auto-refresh for active orders
  useEffect(() => {
    const refreshOrderData = async () => {
      if (!id) return;
      
      setIsRefreshing(true);
      try {
        const res = await apiGet<Order>(`/api/orders/${id}`);
        if (res.ok && res.item) {
          setOrder(res.item);
          generateTrackingEvents(res.item);
        }
      } catch (err) {
        console.error('Error refreshing order:', err);
      } finally {
        setIsRefreshing(false);
      }
    };

    if (order && ['pending', 'confirmed', 'processing', 'shipped'].includes(order.status)) {
      refreshInterval.current = setInterval(() => {
        refreshOrderData();
      }, 30000); // Refresh every 30 seconds
    }

    return () => {
      if (refreshInterval.current) {
        clearInterval(refreshInterval.current);
      }
    };
  }, [order?.status, id]); // Include id dependency

  // Manual refresh function for button
  const handleRefresh = async () => {
    if (!id) return;
    
    setIsRefreshing(true);
    try {
      const res = await apiGet<Order>(`/api/orders/${id}`);
      if (res.ok && res.item) {
        setOrder(res.item);
        generateTrackingEvents(res.item);
      }
    } catch (err) {
      console.error('Error refreshing order:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const refreshOrderData = async () => {
    if (!id) return;
    
    setIsRefreshing(true);
    try {
      const res = await apiGet<Order>(`/api/orders/${id}`);
      if (res.ok && res.item) {
        setOrder(res.item);
        generateTrackingEvents(res.item);
      }
    } catch (err) {
      console.error('Error refreshing order:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const generateTrackingEvents = (orderData: Order) => {
    const events: TrackingEvent[] = [
      {
        id: 'placed',
        title: 'تم وضع الطلب',
        description: 'تم استلام طلبك وتأكيد البيانات',
        timestamp: orderData.createdAt,
        status: 'completed',
        icon: <CheckCircle className="w-4 h-4" />
      },
      {
        id: 'confirmed',
        title: 'تم تأكيد الطلب',
        description: 'تم مراجعة طلبك وتأكيد توفر المنتجات',
        timestamp: orderData.updatedAt,
        status: ['confirmed', 'processing', 'shipped', 'delivered'].includes(orderData.status) ? 'completed' : 
                orderData.status === 'pending' ? 'current' : 'pending',
        icon: <Package className="w-4 h-4" />
      },
      {
        id: 'processing',
        title: 'قيد التجهيز',
        description: 'يتم تحضير طلبك في المستودع',
        timestamp: orderData.status === 'processing' ? orderData.updatedAt : '',
        status: ['processing', 'shipped', 'delivered'].includes(orderData.status) ? 'completed' : 
                orderData.status === 'confirmed' ? 'current' : 'pending',
        icon: <Package className="w-4 h-4" />
      },
      {
        id: 'shipped',
        title: 'تم الشحن',
        description: 'طلبك في طريقه إليك',
        timestamp: orderData.status === 'shipped' ? orderData.updatedAt : '',
        location: 'مركز التوزيع الرئيسي',
        status: ['shipped', 'delivered'].includes(orderData.status) ? 'completed' : 
                orderData.status === 'processing' ? 'current' : 'pending',
        icon: <Truck className="w-4 h-4" />
      },
      {
        id: 'out-for-delivery',
        title: 'خارج للتوصيل',
        description: 'المندوب في طريقه لتوصيل طلبك',
        timestamp: '',
        location: 'مع مندوب التوصيل',
        status: orderData.status === 'delivered' ? 'completed' : 'pending',
        icon: <Navigation className="w-4 h-4" />
      },
      {
        id: 'delivered',
        title: 'تم التسليم',
        description: 'تم تسليم طلبك بنجاح',
        timestamp: orderData.status === 'delivered' ? orderData.updatedAt : '',
        status: orderData.status === 'delivered' ? 'completed' : 'pending',
        icon: <CheckCircle className="w-4 h-4" />
      }
    ];

    setTrackingEvents(events);
  };

  // Fetch settings for phone number
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiGet<any>('/api/settings');
        if (res.ok && res.item?.social?.phoneCallLink) {
          setPhoneNumber(res.item.social.phoneCallLink.replace('tel:', ''));
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !id) {
      navigate('/login');
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await apiGet<Order>(`/api/orders/${id}`);
        if (res.ok && res.item) {
          if (res.item.userId !== user?.id) {
            setError('لا تملك صلاحية لعرض هذا الطلب');
            return;
          }
          setOrder(res.item);
          generateTrackingEvents(res.item);
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

  const getStatusInfo = (status: string) => {
    const statusMap = {
      pending: { label: 'قيد الانتظار', color: 'bg-orange-100 text-orange-800', icon: <Clock className="w-4 h-4" /> },
      confirmed: { label: 'مؤكد', color: 'bg-primary/10 text-primary', icon: <CheckCircle className="w-4 h-4" /> },
      processing: { label: 'قيد التجهيز', color: 'bg-purple-100 text-purple-800', icon: <Package className="w-4 h-4" /> },
      shipped: { label: 'تم الشحن', color: 'bg-indigo-100 text-indigo-800', icon: <Truck className="w-4 h-4" /> },
      delivered: { label: 'تم التسليم', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
      cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800', icon: <XCircle className="w-4 h-4" /> },
      refunded: { label: 'مسترد', color: 'bg-gray-100 text-gray-800', icon: <RotateCcw className="w-4 h-4" /> }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.pending;
  };

  const handlePrint = () => {
    // Add print-specific styles
    const printStyles = `
      @media print {
        body * { visibility: hidden; }
        #printable-order, #printable-order * { visibility: visible; }
        #printable-order { 
          position: absolute; 
          left: 0; 
          top: 0; 
          width: 100%;
          padding: 20px;
        }
        .no-print { display: none !important; }
        .print-header {
          text-align: center;
          margin-bottom: 30px;
          border-bottom: 2px solid #000;
          padding-bottom: 20px;
        }
        .print-section {
          margin-bottom: 20px;
          page-break-inside: avoid;
        }
        table { width: 100%; border-collapse: collapse; }
        th, td { 
          border: 1px solid #000; 
          padding: 8px; 
          text-align: right;
        }
        th { background-color: #f0f0f0; }
      }
    `;
    
    // Add styles to document
    const styleSheet = document.createElement("style");
    styleSheet.textContent = printStyles;
    document.head.appendChild(styleSheet);
    
    // Trigger print
    window.print();
    
    // Remove styles after print
    setTimeout(() => styleSheet.remove(), 100);
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
        description: `تمت إضافة ${order.items.length} منتج إلى سلة التسوق`,
      });
      
      // Navigate to cart
      navigate('/cart');
    } catch (error) {
      toast({
        title: 'خطأ',
        description: 'فشل في إعادة الطلب',
        variant: 'destructive'
      });
    }
  };

  const handleContactSupport = async () => {
    if (!contactMessage.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى كتابة رسالتك",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiPostJson('/api/support/contact', {
        orderId: order?._id,
        message: contactMessage,
        type: 'order_inquiry'
      });

      toast({
        title: "تم الإرسال",
        description: "تم إرسال رسالتك بنجاح. سنتواصل معك قريباً"
      });

      setContactMessage('');
      setShowContactForm(false);
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في إرسال الرسالة",
        variant: "destructive"
      });
    }
  };

  const handleRateOrder = async () => {
    if (rating === 0) {
      toast({
        title: "خطأ",
        description: "يرجى اختيار تقييم",
        variant: "destructive"
      });
      return;
    }

    try {
      await apiPostJson('/api/orders/rate', {
        orderId: order?._id,
        rating,
        review: review
      });

      toast({
        title: "شكراً لك",
        description: "تم حفظ تقييمك بنجاح"
      });

      setRating(0);
      setReview('');
    } catch (error) {
      toast({
        title: "خطأ",
        description: "فشل في حفظ التقييم",
        variant: "destructive"
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-12">
        <div className="container mx-auto px-4">
          <div className="flex justify-center items-center h-64">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-12">
        <div className="container mx-auto px-4">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-red-600 flex items-center gap-2">
                <XCircle className="w-6 h-6" />
                {error || 'الطلب غير موجود'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link to="/orders">العودة إلى الطلبات</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(order.status);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between mb-8"
        >
          <div>
            <h1 className="text-3xl font-bold text-slate-900">تتبع الطلب</h1>
            <p className="text-slate-600">رقم الطلب: #{order.orderNumber || order._id?.slice(-6)}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
            <Badge className={`px-4 py-2 text-sm font-semibold ${statusInfo.color}`}>
              <div className="flex items-center gap-2">
                {statusInfo.icon}
                {statusInfo.label}
              </div>
            </Badge>
          </div>
        </motion.div>

        {/* Real-time Status Banner */}
        {['pending', 'confirmed', 'processing', 'shipped'].includes(order.status) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-6"
          >
            <Alert className="border-primary/20 bg-primary/5">
              <Zap className="h-4 w-4 text-primary" />
              <AlertDescription className="text-primary">
                <div className="flex items-center justify-between">
                  <span>يتم تحديث حالة طلبك تلقائياً كل 30 ثانية</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse"></div>
                    <span className="text-xs">مباشر</span>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Enhanced Timeline */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-8 overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/5 to-secondary/5">
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                رحلة طلبك
              </CardTitle>
              <CardDescription>تتبع مراحل طلبك بالتفصيل</CardDescription>
            </CardHeader>
            <CardContent className="p-6">
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute right-6 top-0 bottom-0 w-0.5 bg-gradient-to-b from-green-400 via-blue-400 to-gray-300"></div>
                
                <div className="space-y-8">
                  <AnimatePresence>
                    {trackingEvents.map((event, index) => (
                      <motion.div
                        key={event.id}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="relative flex items-start gap-6"
                      >
                        {/* Timeline dot */}
                        <motion.div
                          className={`relative z-10 w-12 h-12 rounded-full flex items-center justify-center shadow-lg ${
                            event.status === 'completed' ? 'bg-green-500' :
                            event.status === 'current' ? 'bg-primary' : 'bg-gray-300'
                          }`}
                          whileHover={{ scale: 1.1 }}
                          animate={event.status === 'current' ? { scale: [1, 1.1, 1] } : {}}
                          transition={{ repeat: event.status === 'current' ? Infinity : 0, duration: 2 }}
                        >
                          <div className="text-white">
                            {event.icon}
                          </div>
                        </motion.div>

                        {/* Event content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className={`font-semibold text-lg ${
                              event.status === 'completed' ? 'text-green-700' :
                              event.status === 'current' ? 'text-primary' : 'text-gray-500'
                            }`}>
                              {event.title}
                            </h3>
                            {event.timestamp && (
                              <span className="text-sm text-gray-500">
                                {new Date(event.timestamp).toLocaleDateString('en-GB')}
                              </span>
                            )}
                          </div>
                          <p className="text-gray-600 mb-2">{event.description}</p>
                          {event.location && (
                            <div className="flex items-center gap-1 text-sm text-primary">
                              <MapPin className="w-3 h-3" />
                              <span>{event.location}</span>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Order Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Order Items */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    محتويات الطلب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {order.items?.map((item, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.3 + index * 0.1 }}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors"
                      >
                        <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                          {item.product?.image || item.product?.category ? (
                            <img 
                              src={item.product.image || `/api/categories/${item.product.category}/image`} 
                              alt={item.product.nameAr} 
                              className="w-full h-full object-cover"
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
                          <h3 className="font-semibold text-slate-900">{item.product?.nameAr}</h3>
                          <p className="text-sm text-slate-600">الكمية: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-slate-900">{item.price?.toLocaleString()} ج.م</p>
                          <p className="text-sm text-slate-600">
                            الإجمالي: {((item.quantity || 1) * (item.price || 0)).toLocaleString()} ج.م
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Order Summary */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    ملخص الطلب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-slate-600">المجموع الفرعي:</span>
                      <span className="font-medium">{order.subtotal?.toLocaleString()} ج.م</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">الشحن:</span>
                      <span className="font-medium">
                        {order.shipping === 0 ? 'مجاني' : `${order.shipping?.toLocaleString()} ج.م`}
                      </span>
                    </div>
                    {order.tax && order.tax > 0 && (
                      <div className="flex justify-between">
                        <span className="text-slate-600">الضريبة:</span>
                        <span className="font-medium">{order.tax.toLocaleString()} ج.م</span>
                      </div>
                    )}
                    <div className="border-t border-slate-200 pt-3 flex justify-between font-bold text-lg">
                      <span>الإجمالي:</span>
                      <span className="text-green-600">{order.total?.toLocaleString()} ج.م</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Actions */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5 text-primary" />
                    إجراءات سريعة
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Button className="w-full" variant="outline" onClick={handlePrint}>
                    <Download className="w-4 h-4 mr-2" />
                    تحميل الفاتورة
                  </Button>
                  <Button className="w-full" variant="outline" onClick={handlePrint}>
                    <Printer className="w-4 h-4 mr-2" />
                    طباعة الطلب
                  </Button>
                  <Button className="w-full" variant="outline" onClick={handleReorder}>
                    <ShoppingCart className="w-4 h-4 mr-2" />
                    إعادة الطلب
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Contact Support */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.5 }}
            >
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MessageSquare className="w-5 h-5 text-primary" />
                    لمعرفة السعر
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <Dialog open={showContactForm} onOpenChange={setShowContactForm}>
                    <DialogTrigger asChild>
                      <Button className="w-full" variant="outline">
                        <Mail className="w-4 h-4 mr-2" />
                        إرسال رسالة
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>تواصل مع الدعم</DialogTitle>
                        <DialogDescription>
                          أرسل رسالة حول طلبك وسنتواصل معك قريباً
                        </DialogDescription>
                      </DialogHeader>
                      <Textarea
                        placeholder="اكتب رسالتك هنا..."
                        value={contactMessage}
                        onChange={(e) => setContactMessage(e.target.value)}
                        rows={4}
                      />
                      <DialogFooter>
                        <Button onClick={handleContactSupport}>إرسال</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  <Button 
                    className="w-full" 
                    variant="outline"
                    onClick={() => window.location.href = `tel:${phoneNumber}`}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    <div className="flex flex-col items-start">
                      <span className="text-xs text-slate-500">اتصال مباشر</span>
                      <span className="font-semibold" dir="ltr">{phoneNumber}</span>
                    </div>
                  </Button>
                </CardContent>
              </Card>
            </motion.div>

            {/* Rate Order (for delivered orders) */}
            {order.status === 'delivered' && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Star className="w-5 h-5 text-yellow-500" />
                      قيم تجربتك
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          onClick={() => setRating(star)}
                          className={`p-1 ${star <= rating ? 'text-yellow-400' : 'text-gray-300'}`}
                        >
                          <Star className="w-6 h-6 fill-current" />
                        </button>
                      ))}
                    </div>
                    <Textarea
                      placeholder="شاركنا رأيك (اختياري)"
                      value={review}
                      onChange={(e) => setReview(e.target.value)}
                      rows={3}
                    />
                    <Button className="w-full" onClick={handleRateOrder}>
                      إرسال التقييم
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Security Badge */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.7 }}
            >
              <Card className="bg-green-50 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <Shield className="w-5 h-5 text-green-600" />
                    <div>
                      <h4 className="font-semibold text-green-900">طلب آمن ومحمي</h4>
                      <p className="text-sm text-green-700">
                        بياناتك محمية بأعلى معايير الأمان
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Hidden Printable Invoice */}
      <div id="printable-order" className="hidden">
        <div className="print-header">
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '10px' }}>فاتورة الطلب</h1>
          <p>رقم الطلب: #{order.orderNumber || order._id?.slice(-6)}</p>
          <p>التاريخ: {new Date(order.createdAt).toLocaleDateString('en-GB')}</p>
        </div>

        <div className="print-section">
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>معلومات العميل</h2>
          <p><strong>الاسم:</strong> {order.shippingAddress?.name || 'غير متوفر'}</p>
          <p><strong>البريد:</strong> {order.shippingAddress?.email || 'غير متوفر'}</p>
          <p><strong>الهاتف:</strong> {order.shippingAddress?.phone || 'غير متوفر'}</p>
          <p><strong>العنوان:</strong> {order.shippingAddress?.street}, {order.shippingAddress?.city}</p>
        </div>

        <div className="print-section">
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>المنتجات</h2>
          <table>
            <thead>
              <tr>
                <th>المنتج</th>
                <th>الكمية</th>
                <th>السعر</th>
                <th>الإجمالي</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item, index) => (
                <tr key={index}>
                  <td>{item.product?.nameAr || 'منتج'}</td>
                  <td>{item.quantity}</td>
                  <td>{item.price?.toLocaleString()} ج.م</td>
                  <td>{((item.quantity || 1) * (item.price || 0)).toLocaleString()} ج.م</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="print-section">
          <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '10px' }}>ملخص الطلب</h2>
          <table>
            <tbody>
              <tr>
                <td><strong>المجموع الفرعي:</strong></td>
                <td>{order.subtotal?.toLocaleString()} ج.م</td>
              </tr>
              <tr>
                <td><strong>الشحن:</strong></td>
                <td>{order.shipping === 0 ? 'مجاني' : `${order.shipping?.toLocaleString()} ج.م`}</td>
              </tr>
              {order.tax && order.tax > 0 && (
                <tr>
                  <td><strong>الضريبة:</strong></td>
                  <td>{order.tax.toLocaleString()} ج.م</td>
                </tr>
              )}
              <tr style={{ fontSize: '18px', fontWeight: 'bold' }}>
                <td><strong>الإجمالي:</strong></td>
                <td>{order.total?.toLocaleString()} ج.م</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="print-section" style={{ marginTop: '40px', textAlign: 'center', fontSize: '12px', color: '#666' }}>
          <p>شكراً لتسوقك معنا!</p>
          <p>للاستفسارات: +201234567890</p>
        </div>
      </div>
    </div>
  );
};

export default EnhancedOrderTracking;
