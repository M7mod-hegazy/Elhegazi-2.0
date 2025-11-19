import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { apiGet } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Package, 
  AlertCircle, 
  FileText, 
  CreditCard, 
  Truck,
  CheckCircle,
  XCircle,
  Clock,
  ArrowLeft,
  Eye
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';

interface ReturnRequest {
  id: string;
  orderId: string;
  items: Array<{
    productId: string;
    productName: string;
    quantity: number;
    price: number;
    reason: string;
  }>;
  totalAmount: number;
  reason: string;
  status: 'requested' | 'approved' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'rejected';
  refundMethod: 'original' | 'store_credit';
  refundStatus: 'pending' | 'processing' | 'completed' | 'failed';
  refundAmount: number;
  requestedAt: string;
  approvedAt?: string;
  rejectedAt?: string;
  completedAt?: string;
}

const MyReturns = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useDualAuth();
  const { hidePrices } = usePricingSettings();
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const fetchReturns = async () => {
      try {
        setLoading(true);
        const res = await apiGet<ReturnRequest>('/api/my/returns');
        if (res.ok) {
          setReturns(res.items || []);
        } else {
          setError('فشل في تحميل طلبات الإرجاع');
        }
      } catch (err) {
        setError('فشل في تحميل طلبات الإرجاع');
        console.error('Error fetching returns:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, [isAuthenticated, navigate]);

  // Get status label in Arabic
  const getStatusLabel = (status: string) => {
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

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      requested: 'bg-orange-100 text-orange-800 border-orange-300',
      approved: 'bg-primary/10 text-primary border-primary/30',
      processing: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      completed: 'bg-green-100 text-green-800 border-green-300',
      rejected: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Get refund status label in Arabic
  const getRefundStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      pending: 'قيد الانتظار',
      processing: 'قيد المعالجة',
      completed: 'مكتمل',
      failed: 'فشل'
    };
    return statusLabels[status] || status;
  };

  // Get refund status color
  const getRefundStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
      processing: 'bg-primary/10 text-primary border-primary/30',
      completed: 'bg-green-100 text-green-800 border-green-300',
      failed: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
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
              <Button asChild>
                <Link to="/profile">
                  <ArrowLeft className="w-4 h-4 ml-2" />
                  العودة إلى الملف الشخصي
                </Link>
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
            <h1 className="text-3xl font-bold text-slate-900">طلبات الإرجاع</h1>
            <p className="text-slate-600">مراجعة جميع طلبات الإرجاع السابقة</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/profile">
              <ArrowLeft className="w-4 h-4 ml-2" />
              العودة إلى الملف الشخصي
            </Link>
          </Button>
        </div>

        {returns.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">لا توجد طلبات إرجاع</h3>
              <p className="text-gray-600 mb-6">لم تقم بطلب أي إرجاع حتى الآن</p>
              <Button asChild>
                <Link to="/profile/orders">عرض الطلبات</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {returns.map((ret) => (
              <Card key={ret.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex flex-col sm:flex-row justify-between gap-4">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="w-5 h-5" />
                        طلب إرجاع #{ret.id.slice(-6)}
                      </CardTitle>
                      <CardDescription>
                        للطلب #{ret.orderId.slice(-6)} - {new Date(ret.requestedAt).toLocaleDateString('ar-EG')}
                      </CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Badge className={`font-semibold ${getStatusColor(ret.status)}`}>
                        {getStatusLabel(ret.status)}
                      </Badge>
                      <Badge className={`font-semibold ${getRefundStatusColor(ret.refundStatus)}`}>
                        {getRefundStatusLabel(ret.refundStatus)}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-slate-600">عدد المنتجات</p>
                      <p className="font-medium">{ret.items.length} منتج</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">المبلغ الإجمالي</p>
                      <p className="font-medium">{ret.totalAmount.toLocaleString()} ر.س</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">طريقة الاسترداد</p>
                      <p className="font-medium">
                        {ret.refundMethod === 'original' ? 'البطاقة الأصلية' : 'رصيد في المتجر'}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-slate-200 pt-4">
                    <h4 className="font-medium text-slate-900 mb-2">المنتجات المرتجعة</h4>
                    <div className="space-y-2">
                      {ret.items.slice(0, 2).map((item, index) => (
                        <div key={index} className="flex items-center gap-3 text-sm">
                          <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center">
                            <Package className="w-4 h-4 text-gray-500" />
                          </div>
                          <span className="font-medium">{item.productName}</span>
                          <span className="text-slate-600">الكمية: {item.quantity}</span>
                        </div>
                      ))}
                      {ret.items.length > 2 && (
                        <p className="text-sm text-slate-500">
                          +{ret.items.length - 2} منتج إضافي
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 mt-6">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => navigate(`/returns/${ret.id}`)}
                    >
                      <Eye className="w-4 h-4 ml-2" />
                      عرض التفاصيل
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

export default MyReturns;
