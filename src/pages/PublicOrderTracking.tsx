import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useSearchParams } from 'react-router-dom';
import { apiGet } from '@/lib/api';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin,
  Phone,
  Mail,
  AlertCircle,
  Shield,
  Info
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface PublicOrder {
  orderNumber: string;
  status: string;
  createdAt: string;
  estimatedDelivery?: string;
  total: number;
  items: Array<{
    product: {
      nameAr: string;
      image?: string;
    };
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    city: string;
    country: string;
  };
  trackingNumber?: string;
}

const PublicOrderTracking: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { hidePrices } = usePricingSettings();
  const { toast } = useToast();
  const [orderNumber, setOrderNumber] = useState(searchParams.get('orderNumber') || '');
  const [email, setEmail] = useState(searchParams.get('email') || '');
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!orderNumber.trim() || !email.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال رقم الطلب والبريد الإلكتروني",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await apiGet<PublicOrder>(`/api/orders/track?orderNumber=${orderNumber}&email=${email}`);
      
      if (res.ok && res.item) {
        setOrder(res.item);
      } else {
        setError('لم يتم العثور على الطلب. تأكد من رقم الطلب والبريد الإلكتروني');
      }
    } catch (err) {
      setError('حدث خطأ أثناء البحث عن الطلب');
      console.error('Error tracking order:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusInfo = (status: string) => {
    const statusMap = {
      pending: { label: 'قيد الانتظار', color: 'bg-orange-100 text-orange-800', icon: <Clock className="w-4 h-4" /> },
      confirmed: { label: 'مؤكد', color: 'bg-primary/10 text-primary', icon: <CheckCircle className="w-4 h-4" /> },
      processing: { label: 'قيد التجهيز', color: 'bg-purple-100 text-purple-800', icon: <Package className="w-4 h-4" /> },
      shipped: { label: 'تم الشحن', color: 'bg-indigo-100 text-indigo-800', icon: <Truck className="w-4 h-4" /> },
      delivered: { label: 'تم التسليم', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> },
      cancelled: { label: 'ملغي', color: 'bg-red-100 text-red-800', icon: <AlertCircle className="w-4 h-4" /> }
    };
    return statusMap[status as keyof typeof statusMap] || statusMap.pending;
  };

  const getTrackingSteps = (status: string) => {
    const steps = [
      { id: 'placed', label: 'تم وضع الطلب', completed: true },
      { id: 'confirmed', label: 'تم التأكيد', completed: ['confirmed', 'processing', 'shipped', 'delivered'].includes(status) },
      { id: 'processing', label: 'قيد التجهيز', completed: ['processing', 'shipped', 'delivered'].includes(status) },
      { id: 'shipped', label: 'تم الشحن', completed: ['shipped', 'delivered'].includes(status) },
      { id: 'delivered', label: 'تم التسليم', completed: status === 'delivered' }
    ];
    return steps;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl font-bold text-slate-900 mb-2">تتبع طلبك</h1>
          <p className="text-slate-600">أدخل رقم الطلب والبريد الإلكتروني لتتبع حالة طلبك</p>
        </motion.div>

        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="w-5 h-5 text-primary" />
                البحث عن الطلب
              </CardTitle>
              <CardDescription>
                أدخل رقم الطلب والبريد الإلكتروني المستخدم في الطلب
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div className="space-y-2">
                  <Label htmlFor="orderNumber">رقم الطلب</Label>
                  <Input
                    id="orderNumber"
                    placeholder="مثال: 2024010001"
                    value={orderNumber}
                    onChange={(e) => setOrderNumber(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="example@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  />
                </div>
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={loading}
                className="w-full md:w-auto"
              >
                {loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    جاري البحث...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    تتبع الطلب
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Alert className="mb-6 border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                {error}
              </AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Order Results */}
        {order && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Order Status */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary" />
                    طلب رقم: {order.orderNumber}
                  </CardTitle>
                  <Badge className={`px-4 py-2 ${getStatusInfo(order.status).color}`}>
                    <div className="flex items-center gap-2">
                      {getStatusInfo(order.status).icon}
                      {getStatusInfo(order.status).label}
                    </div>
                  </Badge>
                </div>
                <CardDescription>
                  تاريخ الطلب: {new Date(order.createdAt).toLocaleDateString('ar-SA')}
                  {order.estimatedDelivery && (
                    <span className="mx-2">•</span>
                  )}
                  {order.estimatedDelivery && (
                    <span>التوصيل المتوقع: {new Date(order.estimatedDelivery).toLocaleDateString('ar-SA')}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Tracking Steps */}
                <div className="relative">
                  <div className="absolute right-6 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                  <div className="space-y-6">
                    {getTrackingSteps(order.status).map((step, index) => (
                      <div key={step.id} className="relative flex items-center gap-4">
                        <div className={`
                          relative z-10 w-12 h-12 rounded-full flex items-center justify-center
                          ${step.completed ? 'bg-green-500' : 'bg-gray-300'}
                        `}>
                          {step.completed ? (
                            <CheckCircle className="w-6 h-6 text-white" />
                          ) : (
                            <div className="w-3 h-3 bg-white rounded-full"></div>
                          )}
                        </div>
                        <div>
                          <h3 className={`font-medium ${
                            step.completed ? 'text-green-700' : 'text-gray-500'
                          }`}>
                            {step.label}
                          </h3>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Order Items */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-blue-600" />
                  محتويات الطلب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items.map((item, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                      <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                        {item.product.image || item.product.category ? (
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
                        <h3 className="font-semibold text-slate-900">{item.product.nameAr}</h3>
                        <p className="text-sm text-slate-600">الكمية: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        {hidePrices ? (
                          <p className="font-semibold text-slate-500">السعر مخفي</p>
                        ) : (
                          <p className="font-semibold text-slate-900">{item.price.toLocaleString()} ر.س</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-6 pt-4 border-t border-slate-200">
                  <div className="flex justify-between font-bold text-lg">
                    <span>الإجمالي:</span>
                    {hidePrices ? (
                      <span className="text-slate-500">الأسعار مخفية</span>
                    ) : (
                      <span className="text-green-600">{order.total.toLocaleString()} ر.س</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Shipping Info */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-primary" />
                  معلومات الشحن
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-slate-600">المدينة</p>
                    <p className="font-medium">{order.shippingAddress.city}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">الدولة</p>
                    <p className="font-medium">{order.shippingAddress.country}</p>
                  </div>
                  {order.trackingNumber && (
                    <div className="md:col-span-2">
                      <p className="text-sm text-slate-600">رقم التتبع</p>
                      <p className="font-mono font-medium text-primary">{order.trackingNumber}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Contact Support */}
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-6">
                <div className="text-center">
                  <h3 className="font-semibold text-primary mb-2">تحتاج مساعدة؟</h3>
                  <p className="text-primary mb-4">
                    إذا كان لديك أي استفسار حول طلبك، لا تتردد في التواصل معنا
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="outline" className="flex items-center gap-2">
                      <Phone className="w-4 h-4" />
                      اتصل بنا
                    </Button>
                    <Button variant="outline" className="flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      راسلنا
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Info Card */}
        {!order && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-6">
                <div className="flex items-start gap-3">
                  <Info className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-2">كيفية العثور على رقم طلبك</h3>
                    <ul className="text-sm text-gray-600 space-y-1">
                      <li>• تحقق من رسالة تأكيد الطلب في بريدك الإلكتروني</li>
                      <li>• ابحث عن رقم يبدأ بالسنة الحالية (مثال: 2024010001)</li>
                      <li>• استخدم نفس البريد الإلكتروني المستخدم في الطلب</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Security Notice */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="bg-green-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-green-600" />
                <div>
                  <h4 className="font-semibold text-green-900">معلومات آمنة ومحمية</h4>
                  <p className="text-sm text-green-700">
                    نحن نحمي خصوصيتك ولا نعرض سوى المعلومات الأساسية لطلبك
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  );
};

export default PublicOrderTracking;
