import React from 'react';
import { Order, TrackingEvent } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Navigation,
  AlertCircle
} from 'lucide-react';

interface MobileOrderTrackingProps {
  order: Order;
}

const MobileOrderTracking: React.FC<MobileOrderTrackingProps> = ({ order }) => {
  // Get status label in Arabic
  const getStatusLabel = (status: string) => {
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
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-orange-100 text-orange-800 border-orange-300',
      confirmed: 'bg-blue-100 text-blue-800 border-blue-300',
      processing: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      out_for_delivery: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      refunded: 'bg-red-100 text-red-800 border-red-300',
      returned: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get status icon
  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-5 h-5" />,
      confirmed: <CheckCircle className="w-5 h-5" />,
      processing: <Package className="w-5 h-5" />,
      shipped: <Truck className="w-5 h-5" />,
      out_for_delivery: <Navigation className="w-5 h-5" />,
      delivered: <CheckCircle className="w-5 h-5" />,
      cancelled: <XCircle className="w-5 h-5" />,
      refunded: <XCircle className="w-5 h-5" />,
      returned: <XCircle className="w-5 h-5" />
    };
    return icons[status] || <Package className="w-5 h-5" />;
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

  return (
    <div className="space-y-6">
      {/* Order Status Header */}
      <Card className="border border-slate-200 rounded-2xl shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-slate-900">
              حالة الطلب
            </CardTitle>
            <Badge className={`px-3 py-1 text-sm font-semibold ${getStatusColor(order.status)}`}>
              <div className="flex items-center gap-2">
                {getStatusIcon(order.status)}
                {getStatusLabel(order.status)}
              </div>
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-600">
            {getStatusDescription(order.status)}
          </p>
          {order.estimatedDelivery && (
            <div className="mt-3 flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-500" />
              <span className="text-slate-700">
                التسليم المتوقع: {new Date(order.estimatedDelivery).toLocaleDateString('ar-EG')}
              </span>
            </div>
          )}
          
          {/* Cancellation Request Badge */}
          {order.cancellationRequested && order.status !== 'cancelled' && (
            <div className="mt-3 flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
              <AlertCircle className="w-4 h-4 text-yellow-600" />
              <span className="text-yellow-800 text-xs font-medium">طلب إلغاء قيد المراجعة</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tracking Timeline */}
      <Card className="border border-slate-200 rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            جدول زمني للتتبع
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(order.trackingEvents || []).map((event: TrackingEvent, index: number) => (
              <div key={index} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center">
                    {getStatusIcon(event.status)}
                  </div>
                  {index < (order.trackingEvents || []).length - 1 && (
                    <div className="w-0.5 h-full bg-blue-200 flex-1 mt-1"></div>
                  )}
                </div>
                <div className="pb-4 flex-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-medium text-slate-900">
                      {getStatusLabel(event.status)}
                    </h3>
                    <span className="text-xs text-slate-500">
                      {new Date(event.timestamp).toLocaleTimeString('ar-EG', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-1">
                    {event.description || getStatusDescription(event.status)}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {new Date(event.timestamp).toLocaleDateString('ar-EG')}
                  </p>
                  {event.location && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-slate-500">
                      <MapPin className="w-3 h-3" />
                      <span>{event.location.name}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Order Summary */}
      <Card className="border border-slate-200 rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5" />
            ملخص الطلب
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">رقم الطلب</span>
              <span className="font-medium">#{order.orderNumber || order.id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">تاريخ الطلب</span>
              <span className="font-medium">
                {new Date(order.createdAt).toLocaleDateString('ar-EG')}
              </span>
            </div>
            {order.trackingNumber && (
              <div className="flex justify-between">
                <span className="text-sm text-slate-600">رقم التتبع</span>
                <span className="font-medium">{order.trackingNumber}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-sm text-slate-600">المجموع</span>
              <span className="font-medium">{order.total.toLocaleString()} ر.س</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Shipping Address */}
      <Card className="border border-slate-200 rounded-2xl shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <MapPin className="w-5 h-5" />
            عنوان التوصيل
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{order.shippingAddress.street}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.state}</p>
            <p>{order.shippingAddress.postalCode}</p>
            <p>{order.shippingAddress.country}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MobileOrderTracking;