import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { apiGet } from '@/lib/api';
import { Order } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ReturnRequestForm from '@/components/order/ReturnRequestForm';
import { 
  Package, 
  AlertCircle, 
  FileText, 
  CreditCard, 
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';

const Returns = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useDualAuth();
  const { hidePrices } = usePricingSettings();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [returnRequested, setReturnRequested] = useState(false);
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
          // Check if the order belongs to the current user
          if (res.item.userId !== user?.id) {
            setError('لا تملك صلاحية لعرض هذا الطلب');
            return;
          }
          
          // Check if order is eligible for return (must be delivered)
          if (res.item.status !== 'delivered') {
            setError('يمكن طلب الإرجاع فقط للطلبات التي تم تسليمها');
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

  const handleReturnRequested = () => {
    setReturnRequested(true);
    // Refresh the order to show the return request status
    if (order) {
      setOrder({
        ...order,
        returnRequested: true,
        returnRequestedAt: new Date().toISOString()
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="flex items-center justify-center h-64">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                خطأ
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">{error}</p>
              <Button onClick={() => navigate('/profile/orders')}>
                <ArrowLeft className="w-4 h-4 ml-2" />
                العودة إلى الطلبات
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <XCircle className="w-5 h-5" />
                الطلب غير موجود
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600 mb-6">لم يتم العثور على الطلب المطلوب.</p>
              <Button onClick={() => navigate('/profile/orders')}>
                <ArrowLeft className="w-4 h-4 ml-2" />
                العودة إلى الطلبات
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">طلب إرجاع</h1>
            <p className="text-slate-600">طلب إرجاع المنتجات من الطلب #{order.orderNumber || order.id}</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/profile/orders')}>
            <ArrowLeft className="w-4 h-4 ml-2" />
            العودة إلى الطلبات
          </Button>
        </div>

        {/* Order Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              معلومات الطلب
            </CardTitle>
            <CardDescription>تفاصيل الطلب المختار للإرجاع</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row justify-between gap-4">
              <div>
                <p className="text-sm text-slate-600">رقم الطلب</p>
                <p className="font-medium">#{order.orderNumber || order.id}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">تاريخ الطلب</p>
                <p className="font-medium">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">الإجمالي</p>
                <p className="font-medium">{order.total.toLocaleString()} ر.س</p>
              </div>
              <div>
                <p className="text-sm text-slate-600">الحالة</p>
                <Badge className="bg-green-100 text-green-800 border-green-300">
                  <CheckCircle className="w-3 h-3 ml-1" />
                  تم التسليم
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Return Request Form or Confirmation */}
        {returnRequested ? (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-green-600">
                <CheckCircle className="w-5 h-5" />
                تم إرسال طلب الإرجاع
              </CardTitle>
              <CardDescription>
                تم إرسال طلب الإرجاع بنجاح وسينتظر موافقة الإدارة
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-500" />
                </div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">طلب الإرجاع قيد المراجعة</h3>
                <p className="text-gray-600 mb-6">
                  تم إرسال طلب الإرجاع بنجاح وسينتظر موافقة الإدارة. سيتم إعلامك بحالة الطلب عبر البريد الإلكتروني.
                </p>
                
                <div className="bg-primary/5 rounded-lg p-4 mb-6">
                  <p className="font-medium text-primary">رقم الطلب: #{order.orderNumber || order.id}</p>
                  <p className="text-sm text-primary">تاريخ الطلب: {new Date().toLocaleDateString('ar-EG')}</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button 
                  className="flex-1" 
                  onClick={() => navigate('/profile/orders')}
                >
                  العودة إلى الطلبات
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1" 
                  onClick={() => setReturnRequested(false)}
                >
                  طلب إرجاع آخر
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <ReturnRequestForm 
            order={order} 
            onReturnRequested={handleReturnRequested} 
          />
        )}
      </div>
    </div>
  );
};

export default Returns;