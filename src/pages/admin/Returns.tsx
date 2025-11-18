import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import AdminLayout from '@/components/admin/AdminLayout';
import { apiGet, apiPatchJson } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { logHistory } from '@/lib/history';
import { 
  Search, 
  Eye, 
  CheckCircle,
  XCircle,
  Clock,
  Package,
  Filter,
  UserCheck,
  FileText,
  CreditCard,
  Truck
} from 'lucide-react';
import { LoadingSpinner } from '@/components/ui/loading';

interface ReturnRequest {
  id: string;
  orderId: string;
  userId: string;
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
  notes?: string;
  internalNotes?: Array<{
    text: string;
    createdBy: string;
    createdByName?: string;
    createdAt: string;
  }>;
}

const AdminReturns = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // State
  const [returns, setReturns] = useState<ReturnRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedReturn, setSelectedReturn] = useState<ReturnRequest | null>(null);
  const [internalNote, setInternalNote] = useState('');
  const [processingAction, setProcessingAction] = useState<string | null>(null);

  // Load data
  useEffect(() => {
    const fetchReturns = async () => {
      try {
        setLoading(true);
        const res = await apiGet<ReturnRequest>('/api/returns');
        if (res.ok) {
          setReturns(res.items || []);
          void logHistory({
            section: 'returns',
            action: 'page_loaded',
            note: 'Loaded returns list',
            meta: { count: (res.items || []).length }
          });
        }
      } catch (e) {
        console.error('Error fetching returns:', e);
      } finally {
        setLoading(false);
      }
    };

    fetchReturns();
  }, []);

  // Filter returns
  const filteredReturns = returns.filter(ret => {
    const matchesSearch = ret.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       ret.orderId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       ret.userId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || ret.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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

  // Handle return status change
  const handleStatusChange = async (returnId: string, newStatus: ReturnRequest['status']) => {
    setProcessingAction(`status-${returnId}`);
    
    try {
      const res = await apiPatchJson<ReturnRequest, Partial<ReturnRequest>>(`/api/returns/${returnId}`, { 
        status: newStatus 
      });
      
      if (res.ok && res.item) {
        setReturns(returns.map(ret => 
          ret.id === returnId ? res.item! : ret
        ));
        
        if (selectedReturn && selectedReturn.id === returnId) {
          setSelectedReturn(res.item);
        }
        
        toast({
          title: "نجاح",
          description: `تم تحديث حالة طلب الإرجاع إلى ${getStatusLabel(newStatus)}`,
        });
        
        void logHistory({
          section: 'returns',
          action: 'status_changed',
          note: `Return ${returnId} status changed to ${newStatus}`,
          meta: { returnId, newStatus }
        });
      } else {
        throw new Error((res as { error?: string }).error || 'فشل في تحديث الحالة');
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة طلب الإرجاع",
        variant: "destructive"
      });
      console.error('Error updating return status:', err);
    } finally {
      setProcessingAction(null);
    }
  };

  // Handle refund status change
  const handleRefundStatusChange = async (returnId: string, newStatus: ReturnRequest['refundStatus']) => {
    setProcessingAction(`refund-${returnId}`);
    
    try {
      const res = await apiPatchJson<ReturnRequest, Partial<ReturnRequest>>(`/api/returns/${returnId}`, { 
        refundStatus: newStatus 
      });
      
      if (res.ok && res.item) {
        setReturns(returns.map(ret => 
          ret.id === returnId ? res.item! : ret
        ));
        
        if (selectedReturn && selectedReturn.id === returnId) {
          setSelectedReturn(res.item);
        }
        
        toast({
          title: "نجاح",
          description: `تم تحديث حالة الاسترداد إلى ${getRefundStatusLabel(newStatus)}`,
        });
        
        void logHistory({
          section: 'returns',
          action: 'refund_status_changed',
          note: `Return ${returnId} refund status changed to ${newStatus}`,
          meta: { returnId, newStatus }
        });
      } else {
        throw new Error((res as { error?: string }).error || 'فشل في تحديث حالة الاسترداد');
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل في تحديث حالة الاسترداد",
        variant: "destructive"
      });
      console.error('Error updating refund status:', err);
    } finally {
      setProcessingAction(null);
    }
  };

  // Add internal note
  const handleAddInternalNote = async (returnId: string) => {
    if (!internalNote.trim()) {
      toast({
        title: "خطأ",
        description: "يرجى إدخال ملاحظة",
        variant: "destructive"
      });
      return;
    }

    try {
      const res = await apiPatchJson<ReturnRequest, { internalNote: string }>(
        `/api/returns/${returnId}/notes`, 
        { internalNote }
      );
      
      if (res.ok && res.item) {
        setReturns(returns.map(ret => 
          ret.id === returnId ? res.item! : ret
        ));
        
        if (selectedReturn && selectedReturn.id === returnId) {
          setSelectedReturn(res.item);
        }
        
        setInternalNote('');
        toast({
          title: "نجاح",
          description: "تمت إضافة الملاحظة الداخلية",
        });
      } else {
        throw new Error((res as { error?: string }).error || 'فشل في إضافة الملاحظة');
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل في إضافة الملاحظة الداخلية",
        variant: "destructive"
      });
      console.error('Error adding internal note:', err);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <LoadingSpinner />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        {/* Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              إدارة الإرجاعات
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium mt-1 sm:mt-2">
              مراجعة ومعالجة طلبات الإرجاع
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200/50 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-xs sm:text-sm font-semibold">طلبات جديدة</p>
                  <p className="text-2xl sm:text-3xl font-black text-orange-900">
                    {returns.filter(r => r.status === 'requested').length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary text-xs sm:text-sm font-semibold">قيد المعالجة</p>
                  <p className="text-2xl sm:text-3xl font-black text-primary">
                    {returns.filter(r => r.status === 'processing' || r.status === 'approved').length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-primary rounded-xl flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200/50 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-xs sm:text-sm font-semibold">مكتملة</p>
                  <p className="text-2xl sm:text-3xl font-black text-green-900">
                    {returns.filter(r => r.status === 'completed').length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200/50 shadow-lg">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-xs sm:text-sm font-semibold">مرفوضة</p>
                  <p className="text-2xl sm:text-3xl font-black text-red-900">
                    {returns.filter(r => r.status === 'rejected').length}
                  </p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                  <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/50 shadow-lg mb-6">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute right-3 top-2.5 sm:top-3 h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  <Input
                    placeholder="البحث برقم الطلب أو العميل..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 sm:pr-12 h-10 sm:h-12 bg-white/80 border-primary/20 focus:border-primary focus:ring-primary/20 shadow-md text-sm sm:text-base"
                  />
                </div>
              </div>
              <div className="w-full sm:w-48">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-10 sm:h-12 bg-white/80 border-slate-200 shadow-md text-sm sm:text-base">
                    <SelectValue placeholder="جميع الحالات" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="requested">طلب جديد</SelectItem>
                    <SelectItem value="approved">موافق عليه</SelectItem>
                    <SelectItem value="processing">قيد المعالجة</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Returns Table */}
        <Card className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 via-primary/5 to-secondary/5 border-b border-slate-200/50 p-4 sm:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
                <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  طلبات الإرجاع ({filteredReturns.length})
                </CardTitle>
                <p className="text-slate-600 mt-1 text-xs sm:text-sm">إدارة طلبات الإرجاع والاسترداد</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-200/50 shadow-lg">
              <Table className="bg-white/50">
                <TableHeader className="bg-gradient-to-r from-slate-100 via-primary/5 to-secondary/5">
                  <TableRow className="border-b-2 border-slate-200/50">
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm">
                      رقم الطلب
                    </TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm">العميل</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm hidden sm:table-cell">التاريخ</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm">عدد المنتجات</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm">المبلغ</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm">الحالة</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-slate-200">
                  {filteredReturns.map((ret) => (
                    <TableRow 
                      key={ret.id} 
                      className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-200"
                    >
                      <TableCell>
                        <div className="font-mono text-xs sm:text-sm">#{ret.orderId.slice(-6)}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm">عميل {ret.userId.slice(-6)}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <div className="space-y-1">
                          <p className="font-semibold text-slate-900 text-xs sm:text-sm">
                            {new Date(ret.requestedAt).toLocaleDateString('ar-EG')}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300 font-semibold text-xs">
                          {ret.items.length} منتج
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <CreditCard className="w-3 h-3 text-green-600" />
                          <p className="font-bold text-sm text-green-600">{ret.totalAmount.toLocaleString()} ر.س</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`font-semibold shadow-md text-xs sm:text-sm ${getStatusColor(ret.status)}`}>
                          {getStatusLabel(ret.status)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedReturn(ret)}
                            className="hover:bg-primary/5 hover:border-primary/30 transition-colors p-1 sm:p-2"
                          >
                            <Eye className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Return Detail Modal */}
        {selectedReturn && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-slate-900">تفاصيل طلب الإرجاع</h2>
                  <Button variant="ghost" onClick={() => setSelectedReturn(null)}>
                    <XCircle className="w-5 h-5" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Return Info */}
                  <div className="lg:col-span-2 space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <FileText className="w-5 h-5" />
                          معلومات الطلب
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-slate-600">رقم الطلب الأصلي</p>
                            <p className="font-medium">#{selectedReturn.orderId}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">تاريخ الطلب</p>
                            <p className="font-medium">{new Date(selectedReturn.requestedAt).toLocaleDateString('ar-EG')}</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">المبلغ الإجمالي</p>
                            <p className="font-medium">{selectedReturn.totalAmount.toLocaleString()} ر.س</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">سبب الإرجاع</p>
                            <p className="font-medium">{selectedReturn.reason}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Return Items */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Package className="w-5 h-5" />
                          المنتجات المرتجعة
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {selectedReturn.items.map((item, index) => (
                            <div key={index} className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg">
                              <div className="w-16 h-16 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                                <Package className="w-6 h-6 text-slate-400" />
                              </div>
                              <div className="flex-1">
                                <h3 className="font-semibold text-slate-900">{item.productName}</h3>
                                <p className="text-sm text-slate-600">الكمية: {item.quantity}</p>
                                <p className="text-sm text-slate-600">السبب: {item.reason}</p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-slate-900">{item.price.toLocaleString()} ر.س</p>
                                <p className="text-sm text-slate-600">الإجمالي: {(item.price * item.quantity).toLocaleString()} ر.س</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Status Management */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="w-5 h-5" />
                          إدارة الحالة
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm text-slate-600 mb-2">حالة الطلب</p>
                            <Select 
                              value={selectedReturn.status} 
                              onValueChange={(value) => handleStatusChange(selectedReturn.id, value as ReturnRequest['status'])}
                            >
                              <SelectTrigger className={`font-semibold ${getStatusColor(selectedReturn.status)}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="requested">طلب جديد</SelectItem>
                                <SelectItem value="approved">موافق عليه</SelectItem>
                                <SelectItem value="processing">قيد المعالجة</SelectItem>
                                <SelectItem value="shipped">تم الشحن</SelectItem>
                                <SelectItem value="delivered">تم التسليم</SelectItem>
                                <SelectItem value="completed">مكتمل</SelectItem>
                                <SelectItem value="rejected">مرفوض</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600 mb-2">حالة الاسترداد</p>
                            <Select 
                              value={selectedReturn.refundStatus} 
                              onValueChange={(value) => handleRefundStatusChange(selectedReturn.id, value as ReturnRequest['refundStatus'])}
                            >
                              <SelectTrigger className={`font-semibold ${getRefundStatusColor(selectedReturn.refundStatus)}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">قيد الانتظار</SelectItem>
                                <SelectItem value="processing">قيد المعالجة</SelectItem>
                                <SelectItem value="completed">مكتمل</SelectItem>
                                <SelectItem value="failed">فشل</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Internal Notes */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <UserCheck className="w-5 h-5" />
                          الملاحظات الداخلية
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          <div className="flex gap-2">
                            <Input
                              placeholder="أضف ملاحظة داخلية..."
                              value={internalNote}
                              onChange={(e) => setInternalNote(e.target.value)}
                              className="flex-1"
                            />
                            <Button 
                              onClick={() => handleAddInternalNote(selectedReturn.id)}
                              disabled={!internalNote.trim() || processingAction === `note-${selectedReturn.id}`}
                            >
                              {processingAction === `note-${selectedReturn.id}` ? 'جاري الإضافة...' : 'إضافة'}
                            </Button>
                          </div>
                          
                          {selectedReturn.internalNotes && selectedReturn.internalNotes.length > 0 && (
                            <div className="space-y-3">
                              {selectedReturn.internalNotes.map((note, index) => (
                                <div key={index} className="p-3 bg-gray-50 rounded-lg">
                                  <div className="flex justify-between items-start">
                                    <p className="text-sm font-medium">{note.createdByName || note.createdBy}</p>
                                    <p className="text-xs text-gray-500">
                                      {new Date(note.createdAt).toLocaleDateString('ar-EG')}
                                    </p>
                                  </div>
                                  <p className="text-sm text-gray-700 mt-1">{note.text}</p>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Sidebar */}
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Truck className="w-5 h-5" />
                          معلومات الشحن
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="p-3 bg-primary/5 rounded-lg">
                            <p className="text-sm text-primary">سيتم إضافة معلومات الشحن لاحقاً</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <CreditCard className="w-5 h-5" />
                          معلومات الاسترداد
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div>
                            <p className="text-sm text-slate-600">طريقة الاسترداد</p>
                            <p className="font-medium">
                              {selectedReturn.refundMethod === 'original' ? 'البطاقة الأصلية' : 'رصيد في المتجر'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">المبلغ المسترد</p>
                            <p className="font-medium text-green-600">{selectedReturn.refundAmount.toLocaleString()} ر.س</p>
                          </div>
                          <div>
                            <p className="text-sm text-slate-600">حالة الاسترداد</p>
                            <Badge className={`font-semibold ${getRefundStatusColor(selectedReturn.refundStatus)}`}>
                              {getRefundStatusLabel(selectedReturn.refundStatus)}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Button 
                      className="w-full" 
                      onClick={() => navigate(`/admin/order/${selectedReturn.orderId}`)}
                    >
                      عرض الطلب الأصلي
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminReturns;