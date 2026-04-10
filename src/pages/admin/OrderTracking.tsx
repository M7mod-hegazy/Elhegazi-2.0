import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout from '@/components/admin/AdminLayout';
import { apiGet, apiPatchJson, apiPostJson } from '@/lib/api';
import { Order } from '@/types';
import { useToast } from '@/hooks/use-toast';
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
  Printer,
  Mail,
  Phone,
  MessageCircle,
  Share2,
  Tag,
  UserCheck,
  FileText,
  AlertCircle,
  X,
  RotateCcw
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';
import { applyProductImageFallback } from '@/lib/images';

const AdminOrderTracking = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [newStatus, setNewStatus] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [estimatedDelivery, setEstimatedDelivery] = useState('');

  // State for order assignment and tags
  const [assignedTo, setAssignedTo] = useState('');
  const [orderTags, setOrderTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  // State for cancellation approval
  const [cancellationReason, setCancellationReason] = useState('');
  const [showCancellationApproval, setShowCancellationApproval] = useState(false);

  useEffect(() => {
    if (!id) {
      navigate('/admin/orders');
      return;
    }

    const fetchOrder = async () => {
      try {
        setLoading(true);
        const res = await apiGet<Order>(`/api/orders/${id}`);
        if (res.ok && res.item) {
          setOrder(res.item);
          setNewStatus(res.item.status);
          setAdminNotes(res.item.notes || '');
          setTrackingNumber(res.item.trackingNumber || '');
          setEstimatedDelivery(res.item.estimatedDelivery || '');
          // Parse assignedTo and tags from notes if they exist
          if (res.item.notes) {
            // Extract assignedTo from notes (format: "Assigned to: John Doe")
            const assignedMatch = res.item.notes.match(/Assigned to: ([^\n]+)/);
            if (assignedMatch) {
              setAssignedTo(assignedMatch[1]);
            }
            
            // Extract tags from notes (format: "Tags: tag1, tag2, tag3")
            const tagsMatch = res.item.notes.match(/Tags: ([^\n]+)/);
            if (tagsMatch) {
              setOrderTags(tagsMatch[1].split(',').map(tag => tag.trim()));
            }
          }
        } else {
          toast({
            title: 'خطأ',
            description: 'الطلب غير موجود',
            variant: 'destructive'
          });
          navigate('/admin/orders');
        }
      } catch (err) {
        toast({
          title: 'خطأ',
          description: 'فشل في تحميل تفاصيل الطلب',
          variant: 'destructive'
        });
        console.error('Error fetching order:', err);
        navigate('/admin/orders');
      } finally {
        setLoading(false);
      }
    };

    fetchOrder();
  }, [id, navigate, toast]);

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

  const getStatusIcon = (status: string) => {
    const icons: Record<string, React.ReactNode> = {
      pending: <Clock className="w-5 h-5" />,
      confirmed: <CheckCircle className="w-5 h-5" />,
      processing: <Package className="w-5 h-5" />,
      shipped: <Truck className="w-5 h-5" />,
      delivered: <CheckCircle className="w-5 h-5" />,
      cancelled: <XCircle className="w-5 h-5" />,
      refunded: <XCircle className="w-5 h-5" />
    };
    return icons[status] || <Package className="w-5 h-5" />;
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-orange-100 text-orange-800 border-orange-300',
      confirmed: 'bg-primary/10 text-primary border-primary/30',
      processing: 'bg-purple-100 text-purple-800 border-purple-300',
      shipped: 'bg-indigo-100 text-indigo-800 border-indigo-300',
      delivered: 'bg-green-100 text-green-800 border-green-300',
      cancelled: 'bg-red-100 text-red-800 border-red-300',
      refunded: 'bg-red-100 text-red-800 border-red-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const handleUpdateOrder = async () => {
    if (!order) return;

    try {
      setUpdating(true);
      
      // Build notes string with assignment and tags
      let updatedNotes = adminNotes;
      if (assignedTo) {
        updatedNotes += `\nAssigned to: ${assignedTo}`;
      }
      if (orderTags.length > 0) {
        updatedNotes += `\nTags: ${orderTags.join(', ')}`;
      }
      
      const updateData: Partial<Order> = {
        status: newStatus,
        notes: updatedNotes,
        trackingNumber: trackingNumber || undefined,
        estimatedDelivery: estimatedDelivery || undefined,
      };

      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}`, updateData);
      
      if (res.ok && res.item) {
        setOrder(res.item);
        toast({
          title: 'نجاح',
          description: 'تم تحديث الطلب بنجاح',
        });
      } else {
        throw new Error('فشل في تحديث الطلب');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث الطلب',
        variant: 'destructive'
      });
      console.error('Error updating order:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Handle cancellation approval
  const handleApproveCancellation = async () => {
    if (!order) return;
    
    try {
      setUpdating(true);
      
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}/cancel`, {
        status: 'cancelled',
        cancellationRequested: false
      });
      
      if (res.ok && res.item) {
        setOrder(res.item);
        setShowCancellationApproval(false);
        toast({
          title: 'نجاح',
          description: 'تم إلغاء الطلب بنجاح',
        });
      } else {
        throw new Error('فشل في إلغاء الطلب');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في إلغاء الطلب',
        variant: 'destructive'
      });
      console.error('Error cancelling order:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Handle cancellation rejection
  const handleRejectCancellation = async () => {
    if (!order) return;
    
    try {
      setUpdating(true);
      
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}`, {
        cancellationRequested: false
      });
      
      if (res.ok && res.item) {
        setOrder(res.item);
        setShowCancellationApproval(false);
        toast({
          title: 'نجاح',
          description: 'تم رفض طلب الإلغاء',
        });
      } else {
        throw new Error('فشل في رفض طلب الإلغاء');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في رفض طلب الإلغاء',
        variant: 'destructive'
      });
      console.error('Error rejecting cancellation:', err);
    } finally {
      setUpdating(false);
    }
  };

  // Handle return approval
  const handleApproveReturn = async () => {
    if (!order) return;
    
    try {
      setUpdating(true);
      
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${order.id}/return`, {
        status: 'refunded',
        paymentStatus: 'refunded'
      });
      
      if (res.ok && res.item) {
        setOrder(res.item);
        toast({
          title: 'نجاح',
          description: 'تمت الموافقة على طلب الإرجاع وتم استرداد المبلغ',
        });
      } else {
        throw new Error('فشل في الموافقة على طلب الإرجاع');
      }
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في الموافقة على طلب الإرجاع',
        variant: 'destructive'
      });
      console.error('Error approving return:', err);
    } finally {
      setUpdating(false);
    }
  };

  const handlePrintOrder = () => {
    if (!order) return;
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8"><title>فاتورة #${order.orderNumber || order.id?.slice(-6)}</title><style>body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{border:1px solid #ddd;padding:10px;text-align:right}th{background:#f2f2f2}.total{font-size:18px;font-weight:bold;margin-top:20px;padding:15px;background:#f9f9f9;border-radius:8px}</style></head><body><h1>فاتورة طلب #${order.orderNumber || order.id?.slice(-6) || 'N/A'}</h1><p><strong>التاريخ:</strong> ${new Date(order.createdAt).toLocaleDateString('ar-EG')}</p><p><strong>الحالة:</strong> ${getStatusLabel(order.status)}</p><p><strong>طريقة الدفع:</strong> ${order.paymentMethod || 'N/A'}</p><p><strong>عنوان الشحن:</strong> ${order.shippingAddress?.street || 'N/A'}, ${order.shippingAddress?.city || 'N/A'}</p><table><thead><tr><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${(order.items || []).map(item => `<tr><td>${item.product?.nameAr || 'N/A'}</td><td>${item.quantity || 0}</td><td>${(item.price || 0).toFixed(2)} ج.م</td><td>${((item.price || 0) * (item.quantity || 0)).toFixed(2)} ج.م</td></tr>`).join('')}</tbody></table><div class="total"><p>المجموع الفرعي: ${(order.subtotal || 0).toFixed(2)} ج.م</p><p>الشحن: ${(order.shipping || 0).toFixed(2)} ج.م</p><p>الضريبة: ${(order.tax || 0).toFixed(2)} ج.م</p><h2 style="color:#2563eb;margin-top:10px">الإجمالي الكلي: ${(order.total || 0).toFixed(2)} ج.م</h2></div></body></html>`);
      printWindow.document.close();
      printWindow.print();
    } else {
      toast({ title: 'خطأ', description: 'فشل في فتح نافذة الطباعة', variant: 'destructive' });
    }
  };

  const handleContactCustomer = async () => {
    if (!order) return;
    const message = prompt('أدخل رسالتك للعميل:');
    if (!message || !message.trim()) return;
    try {
      const res = await apiPostJson<Order, { text: string }>(`/api/orders/${order.id || order._id}/notes`, { text: `📧 رسالة للعميل: ${message}` });
      if (res.ok) {
        toast({ title: '✅ تم إرسال الرسالة', description: 'تم إضافة الرسالة إلى ملاحظات الطلب بنجاح' });
        const refreshRes = await apiGet<Order>(`/api/orders/${order.id || order._id}`);
        if (refreshRes.ok && refreshRes.item) setOrder(refreshRes.item);
      }
    } catch (error) {
      toast({ title: '❌ خطأ', description: 'حدث خطأ أثناء إرسال الرسالة', variant: 'destructive' });
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !orderTags.includes(newTag.trim())) {
      setOrderTags([...orderTags, newTag.trim()]);
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setOrderTags(orderTags.filter(tag => tag !== tagToRemove));
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-12">
          <div className="container mx-auto px-4">
            <div className="flex justify-center items-center h-64">
              <LoadingSpinner size="lg" />
            </div>
          </div>
        </div>
      </AdminLayout>
    );
  }

  if (!order) {
    return (
      <AdminLayout>
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-12">
          <div className="container mx-auto px-4">
            <Card className="max-w-2xl mx-auto">
              <CardHeader>
                <CardTitle className="text-slate-900">الطلب غير موجود</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-700 mb-6">لم نتمكن من العثور على الطلب المطلوب.</p>
                <Button asChild>
                  <Link to="/admin/orders">العودة إلى الطلبات</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-primary/5 py-8">
        <div className="container mx-auto px-4 max-w-6xl">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-slate-600 mb-6">
            <Link to="/admin" className="hover:text-primary transition-colors">الرئيسية</Link>
            <ArrowRight className="w-4 h-4" />
            <Link to="/admin/orders" className="hover:text-primary transition-colors">إدارة الطلبات</Link>
            <ArrowRight className="w-4 h-4" />
            <span className="text-slate-900 font-medium">تتبع الطلب #{order.orderNumber || order.id?.slice(-6) || order._id?.slice(-6) || 'N/A'}</span>
          </div>

          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold text-slate-900">تتبع الطلب</h1>
              <p className="text-slate-600">إدارة تفاصيل الطلب وتحديث حالته</p>
            </div>
            <Badge className={`px-4 py-2 text-sm font-semibold ${getStatusColor(order.status)}`}>
              <div className="flex items-center gap-2">
                {getStatusIcon(order.status)}
                {getStatusLabel(order.status)}
              </div>
            </Badge>
          </div>

          {/* Cancellation Request Alert */}
          {order.cancellationRequested && order.status !== 'cancelled' && (
            <Card className="mb-6 border-yellow-200 bg-yellow-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <AlertCircle className="w-5 h-5" />
                  طلب إلغاء الطلب
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-yellow-700 mb-4">
                  طلب العميل إلغاء هذا الطلب. يرجى مراجعة الطلب واتخاذ إجراء.
                </p>
                {order.cancellationReason && (
                  <div className="bg-white/50 p-3 rounded-lg mb-4">
                    <p className="font-medium text-yellow-800">سبب الإلغاء:</p>
                    <p className="text-yellow-700">{order.cancellationReason}</p>
                  </div>
                )}
                <div className="flex gap-3">
                  <Button 
                    onClick={() => setShowCancellationApproval(true)}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    <CheckCircle className="w-4 h-4 ml-2" />
                    الموافقة على الإلغاء
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={handleRejectCancellation}
                  >
                    <XCircle className="w-4 h-4 ml-2" />
                    رفض الإلغاء
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cancellation Approval Modal */}
          {showCancellationApproval && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
              <Card className="w-full max-w-md">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    تأكيد إلغاء الطلب
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-700 mb-4">
                    هل أنت متأكد أنك تريد إلغاء هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.
                  </p>
                  <div className="flex gap-3">
                    <Button 
                      onClick={handleApproveCancellation}
                      disabled={updating}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      {updating ? (
                        <LoadingSpinner size="sm" className="ml-2" />
                      ) : (
                        <CheckCircle className="w-4 h-4 ml-2" />
                      )}
                      تأكيد الإلغاء
                    </Button>
                    <Button 
                      variant="outline" 
                      onClick={() => setShowCancellationApproval(false)}
                      disabled={updating}
                    >
                      <X className="w-4 h-4 ml-2" />
                      إلغاء
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

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
                          {item.product.image ? (
                            <img 
                              src={item.product.image} 
                              alt={item.product.nameAr} 
                              className="w-full h-full object-cover rounded-lg"
                              onError={applyProductImageFallback}
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

              {/* Admin Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    إجراءات الإدارة
                  </CardTitle>
                  <CardDescription>تحديث حالة الطلب وإضافة ملاحظات</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Return Request Alert */}
                  {order.status === 'delivered' && (
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-center">
                        <RotateCcw className="w-5 h-5 text-primary mr-2" />
                        <span className="text-primary font-medium">طلب إرجاع متاح</span>
                      </div>
                      <p className="text-primary text-sm mt-1">
                        يمكن للعميل طلب إرجاع هذا الطلب
                      </p>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">حالة الطلب</label>
                      <Select value={newStatus} onValueChange={setNewStatus}>
                        <SelectTrigger>
                          <SelectValue placeholder="اختر حالة الطلب" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">قيد التجهيز</SelectItem>
                          <SelectItem value="confirmed">تم التأكيد</SelectItem>
                          <SelectItem value="processing">قيد التنفيذ</SelectItem>
                          <SelectItem value="shipped">تم الشحن</SelectItem>
                          <SelectItem value="delivered">تم التسليم</SelectItem>
                          <SelectItem value="cancelled">ملغي</SelectItem>
                          <SelectItem value="refunded">تم الاسترجاع</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">رقم التتبع</label>
                      <Input 
                        value={trackingNumber} 
                        onChange={(e) => setTrackingNumber(e.target.value)}
                        placeholder="أدخل رقم التتبع"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">التسليم المتوقع</label>
                      <Input 
                        type="date" 
                        value={estimatedDelivery} 
                        onChange={(e) => setEstimatedDelivery(e.target.value)}
                      />
                    </div>
                    
                    {/* Order Assignment */}
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-slate-700">تعيين إلى</label>
                      <div className="relative">
                        <UserCheck className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
                        <Input 
                          value={assignedTo} 
                          onChange={(e) => setAssignedTo(e.target.value)}
                          placeholder="اسم الموظف"
                          className="pr-10"
                        />
                      </div>
                    </div>
                  </div>
                  
                  {/* Order Tags */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">الوسوم</label>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {orderTags.map((tag, index) => (
                        <Badge key={index} className="flex items-center gap-1 bg-primary/10 text-primary">
                          <Tag className="w-3 h-3" />
                          {tag}
                          <button 
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-red-500"
                          >
                            ×
                          </button>
                        </Badge>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Input 
                        value={newTag} 
                        onChange={(e) => setNewTag(e.target.value)}
                        placeholder="إضافة وسم جديد"
                        onKeyPress={(e) => e.key === 'Enter' && handleAddTag()}
                      />
                      <Button onClick={handleAddTag} size="sm">إضافة</Button>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">ملاحظات الإدارة</label>
                    <Textarea 
                      value={adminNotes} 
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="أضف ملاحظات حول الطلب"
                      rows={4}
                    />
                  </div>
                  
                  <div className="flex flex-wrap gap-3">
                    <Button 
                      onClick={handleUpdateOrder}
                      disabled={updating}
                    >
                      {updating ? (
                        <>
                          <LoadingSpinner size="sm" className="ml-2" />
                          جاري التحديث...
                        </>
                      ) : (
                        'تحديث الطلب'
                      )}
                    </Button>
                    <Button variant="outline" onClick={handlePrintOrder}>
                      <Printer className="w-4 h-4 ml-2" />
                      طباعة الفاتورة
                    </Button>
                    <Button variant="outline" onClick={handleContactCustomer}>
                      <MessageCircle className="w-4 h-4 ml-2" />
                      التواصل مع العميل
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Order Info Sidebar */}
            <div className="space-y-6">
              {/* Customer Info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="w-5 h-5" />
                    معلومات العميل
                  </CardTitle>
                  <CardDescription>بيانات العميل وتفاصيل الاتصال</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                      <User className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">عميل #{order.userId.slice(-6)}</p>
                      <p className="text-sm text-slate-600">ID: {order.userId}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Mail className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">البريد الإلكتروني</p>
                      <p className="font-medium">customer@example.com</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
                      <Phone className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">رقم الهاتف</p>
                      <p className="font-medium">+966 50 123 4567</p>
                    </div>
                  </div>
                  
                  <div className="pt-4">
                    <Button className="w-full" variant="outline" onClick={handleContactCustomer}>
                      <MessageCircle className="w-4 h-4 ml-2" />
                      إرسال رسالة
                    </Button>
                    <Button 
                      className="w-full mt-2" 
                      variant="outline"
                      onClick={() => {
                        toast({
                          title: 'قيد التنفيذ',
                          description: 'وظيفة مشاركة الطلب قيد التطوير',
                        });
                      }}
                    >
                      <Share2 className="w-4 h-4 ml-2" />
                      مشاركة الطلب
                    </Button>
                  </div>
                </CardContent>
              </Card>

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
                  
                  {/* Assigned To */}
                  {assignedTo && (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                        <UserCheck className="w-5 h-5 text-indigo-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">المعين إلى</p>
                        <p className="font-medium">{assignedTo}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Tags */}
                  {orderTags.length > 0 && (
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                        <Tag className="w-5 h-5 text-yellow-600" />
                      </div>
                      <div>
                        <p className="text-sm text-slate-600">الوسوم</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {orderTags.map((tag, index) => (
                            <Badge key={index} className="bg-yellow-100 text-yellow-800 text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
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

              {/* Return Request Information */}
              {order.returnRequested && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                      <span className="text-yellow-800 font-medium">طلب إرجاع مقدم</span>
                    </div>
                    <Button 
                      onClick={handleApproveReturn}
                      disabled={updating}
                      className="bg-green-600 hover:bg-green-700 h-8 text-xs"
                    >
                      {updating ? (
                        <LoadingSpinner size="sm" className="ml-1" />
                      ) : (
                        <CheckCircle className="w-3 h-3 ml-1" />
                      )}
                      الموافقة على الإرجاع
                    </Button>
                  </div>
                  {order.returnReason && (
                    <p className="text-yellow-700 text-sm mt-1">
                      السبب: {order.returnReason}
                    </p>
                  )}
                  <p className="text-yellow-700 text-xs mt-1">
                    تاريخ الطلب: {order.returnRequestedAt && new Date(order.returnRequestedAt).toLocaleDateString('ar-EG')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminOrderTracking;
