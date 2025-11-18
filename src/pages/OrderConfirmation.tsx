import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useCart } from '@/hooks/useCart';
import { useSettings } from '@/hooks/useSettings';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Package, ShoppingCart, Home, User, Phone, MessageCircle, Send, Clock, Truck, CheckCircle2, XCircle } from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { apiGet } from '@/lib/api';
import { Order } from '@/types';

const OrderConfirmation = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { clearCart } = useCart();
  const { social, storeInfo } = useSettings();
  const { hidePrices } = usePricingSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  // Get order status step
  const getStatusStep = (status: string) => {
    const steps = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
    return steps.indexOf(status) + 1;
  };

  const currentStep = order ? getStatusStep(order.status) : 1;

  useEffect(() => {
    const fetchOrder = async () => {
      // Get order ID from URL parameters
      const orderIdFromParams = searchParams.get('orderId');
      
      if (!orderIdFromParams) {
        navigate('/products');
        return;
      }

      try {
        const res = await apiGet<Order>(`/api/orders/${orderIdFromParams}`);
        if (res.ok && res.item) {
          setOrder(res.item);
          clearCart();
        } else {
          navigate('/products');
        }
      } catch (error) {
        console.error('Failed to fetch order:', error);
        navigate('/products');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [searchParams, navigate, clearCart]);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
          <Link to="/" className="hover:text-primary transition-colors">الرئيسية</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-900 font-medium">تأكيد الطلب</span>
        </div>

        <div className="text-center mb-10">
          <CheckCircle className="w-20 h-20 text-green-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-900 mb-4">تم تأكيد طلبك بنجاح!</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            شكراً لطلبك. لقد تم استلام طلبك وسنقوم بمعالجته في أقرب وقت ممكن.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                تفاصيل الطلب
              </CardTitle>
              <CardDescription>ملخص المنتجات المطلوبة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order?.items.map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-slate-50 rounded-lg">
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
                      {hidePrices ? (
                        <>
                          <p className="font-semibold text-slate-500">السعر مخفي</p>
                          <p className="text-sm text-slate-600">الكمية: {item.quantity}</p>
                        </>
                      ) : (
                        <>
                          <p className="font-semibold text-slate-900">{item.price.toLocaleString()} ج.م</p>
                          <p className="text-sm text-slate-600">الإجمالي: {(item.price * item.quantity).toLocaleString()} ج.م</p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                
                <div className="border-t border-slate-200 pt-4 space-y-2">
                  {hidePrices ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-center">
                      <p className="text-sm text-amber-800 font-medium">الأسعار مخفية</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between">
                        <span className="text-slate-600">المجموع الفرعي</span>
                        <span className="font-medium">{order?.subtotal?.toLocaleString() || 0} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">الشحن</span>
                        <span className="font-medium">{order?.shipping?.toLocaleString() || 0} ج.م</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">الضريبة</span>
                        <span className="font-medium">{order?.tax?.toLocaleString() || 0} ج.م</span>
                      </div>
                      <div className="border-t border-slate-200 pt-2 flex justify-between font-bold text-lg">
                        <span>الإجمالي</span>
                        <span className="text-primary">{order?.total?.toLocaleString() || 0} ج.م</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Actions */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  معلومات الطلب
                </CardTitle>
                <CardDescription>تفاصيل الطلب ورقم التتبع</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                    <p className="text-sm text-slate-600">رقم الطلب</p>
                    <p className="font-mono font-bold text-lg text-slate-900">#{order?.orderNumber || order?._id}</p>
                  </div>
                  
                  <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-sm text-slate-600">الحالة</p>
                    <p className="font-semibold text-slate-900">قيد التجهيز</p>
                  </div>
                  
                  <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                    <p className="text-sm text-slate-600">التاريخ</p>
                    <p className="font-semibold text-slate-900">{new Date().toLocaleDateString('ar-EG')}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="w-5 h-5" />
                  حالة الطلب
                </CardTitle>
                <CardDescription>تتبع مراحل طلبك</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Step 1: Pending */}
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${currentStep >= 1 ? 'bg-green-500' : 'bg-gray-200'}`}>
                      {currentStep >= 1 ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <Clock className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${currentStep >= 1 ? 'text-green-600' : 'text-gray-500'}`}>
                        تم استلام الطلب
                      </p>
                      <p className="text-sm text-slate-600">تم تأكيد طلبك بنجاح</p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={`w-0.5 h-6 ml-4 ${currentStep >= 2 ? 'bg-green-500' : 'bg-gray-200'}`} />
                  
                  {/* Step 2: Processing */}
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${currentStep >= 3 ? 'bg-green-500' : currentStep === 2 ? 'bg-primary' : 'bg-gray-200'}`}>
                      {currentStep >= 3 ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : currentStep === 2 ? (
                        <Package className="w-5 h-5 text-white animate-pulse" />
                      ) : (
                        <Package className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${currentStep >= 3 ? 'text-green-600' : currentStep === 2 ? 'text-primary' : 'text-gray-500'}`}>
                        جاري التجهيز
                      </p>
                      <p className="text-sm text-slate-600">
                        {currentStep >= 3 ? 'تم تجهيز الطلب' : currentStep === 2 ? 'جاري تجهيز طلبك الآن' : 'في انتظار التجهيز'}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={`w-0.5 h-6 ml-4 ${currentStep >= 4 ? 'bg-green-500' : 'bg-gray-200'}`} />
                  
                  {/* Step 3: Shipped */}
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${currentStep >= 5 ? 'bg-green-500' : currentStep === 4 ? 'bg-purple-500' : 'bg-gray-200'}`}>
                      {currentStep >= 5 ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : currentStep === 4 ? (
                        <Truck className="w-5 h-5 text-white animate-pulse" />
                      ) : (
                        <Truck className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${currentStep >= 5 ? 'text-green-600' : currentStep === 4 ? 'text-purple-600' : 'text-gray-500'}`}>
                        تم الشحن
                      </p>
                      <p className="text-sm text-slate-600">
                        {currentStep >= 5 ? 'في الطريق إليك' : currentStep === 4 ? 'جاري الشحن الآن' : 'في انتظار الشحن'}
                      </p>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className={`w-0.5 h-6 ml-4 ${currentStep >= 5 ? 'bg-green-500' : 'bg-gray-200'}`} />
                  
                  {/* Step 4: Delivered */}
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${currentStep >= 5 ? 'bg-green-500' : 'bg-gray-200'}`}>
                      {currentStep >= 5 ? (
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      ) : (
                        <Home className="w-5 h-5 text-gray-400" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className={`font-medium ${currentStep >= 5 ? 'text-green-600' : 'text-gray-500'}`}>
                        تم التسليم
                      </p>
                      <p className="text-sm text-slate-600">
                        {currentStep >= 5 ? 'تم تسليم الطلب بنجاح' : 'سيتم التسليم قريباً'}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Buttons */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="w-5 h-5" />
                  لمعرفة السعر
                </CardTitle>
                <CardDescription>نحن هنا لمساعدتك</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-3">
                  {/* Phone Call */}
                  {(social.phoneCallLink || storeInfo.phone) && (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3"
                    >
                      <a href={social.phoneCallLink || `tel:${storeInfo.phone}`} target="_blank" rel="noopener noreferrer">
                        <Phone className="w-5 h-5 text-primary" />
                        <div className="text-right flex-1">
                          <p className="font-semibold">اتصل بنا</p>
                          <p className="text-sm text-gray-600">{storeInfo.phone}</p>
                        </div>
                      </a>
                    </Button>
                  )}

                  {/* WhatsApp */}
                  {social.whatsappUrl && (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3"
                    >
                      <a href={social.whatsappUrl} target="_blank" rel="noopener noreferrer">
                        <MessageCircle className="w-5 h-5 text-green-600" />
                        <div className="text-right flex-1">
                          <p className="font-semibold">واتساب</p>
                          <p className="text-sm text-gray-600">تواصل عبر واتساب</p>
                        </div>
                      </a>
                    </Button>
                  )}

                  {/* Messenger */}
                  {social.messengerUrl && (
                    <Button
                      asChild
                      variant="outline"
                      className="w-full justify-start gap-3 h-auto py-3"
                    >
                      <a href={social.messengerUrl} target="_blank" rel="noopener noreferrer">
                        <Send className="w-5 h-5 text-primary" />
                        <div className="text-right flex-1">
                          <p className="font-semibold">ماسنجر</p>
                          <p className="text-sm text-gray-600">تواصل عبر ماسنجر</p>
                        </div>
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-4 justify-center mt-10">
          <Button asChild size="lg">
            <Link to={`/order/${order?._id}`}>
              <Package className="w-5 h-5 ml-2" />
              تتبع الطلب
            </Link>
          </Button>
          
          <Button asChild size="lg" variant="outline">
            <Link to="/order-history">
              <ShoppingCart className="w-5 h-5 ml-2" />
              سجل الطلبات
            </Link>
          </Button>
          
          <Button asChild size="lg" variant="outline">
            <Link to="/products">
              <Home className="w-5 h-5 ml-2" />
              متابعة التسوق
            </Link>
          </Button>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmation;