import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import useDeviceDetection from '@/hooks/useDeviceDetection';
import { useDualAuth } from '@/hooks/useDualAuth';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import OrderEditDialog from '@/components/admin/OrderEditDialog';
import PartialRefundDialog from '@/components/admin/PartialRefundDialog';
import OrderCancellationDialog from '@/components/admin/OrderCancellationDialog';
import CustomerCommunicationDialog from '@/components/admin/CustomerCommunicationDialog';
import { apiGet, apiPatchJson, apiPostJson } from '@/lib/api';
import { Order, User } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { logHistory } from '@/lib/history';
import { 
  Search, 
  Eye, 
  Printer, 
  Clock,
  CheckCircle,
  XCircle,
  Package,
  RefreshCw,
  Filter,
  Download,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  UserCheck,
  Tag,
  FileText,
  AlertCircle,
  UserPlus,
  Flag,
  StickyNote,
  MailCheck,
  MoreVertical,
  Loader2,
  UserCog,
  Edit,
  Wallet,
  MessageCircle,
  Copy,
  X,
  Phone,
  MapPin
} from 'lucide-react';

const AdminOrders = () => {
  // Set page title
  usePageTitle('إدارة الطلبات');
  
  const navigate = useNavigate();
  const { user } = useDualAuth();
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  
  // State
  const [orders, setOrders] = useState<Order[]>([]);
  const [teamMembers, setTeamMembers] = useState<{ id: string; name: string; email: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');
  const [bulkPriority, setBulkPriority] = useState('');
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [bulkNote, setBulkNote] = useState('');
  const [noteDialogOrderId, setNoteDialogOrderId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [notesDialogOrder, setNotesDialogOrder] = useState<Order | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [refundOrder, setRefundOrder] = useState<Order | null>(null);
  const [isRefundDialogOpen, setIsRefundDialogOpen] = useState(false);
  const [cancellationOrder, setCancellationOrder] = useState<Order | null>(null);
  const [isCancellationDialogOpen, setIsCancellationDialogOpen] = useState(false);
  const [communicationOrder, setCommunicationOrder] = useState<Order | null>(null);
  const [isCommunicationDialogOpen, setIsCommunicationDialogOpen] = useState(false);

  // State for bulk actions and advanced filtering
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [assignedToFilter, setAssignedToFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [minTotal, setMinTotal] = useState('');
  const [maxTotal, setMaxTotal] = useState('');
  const [cancellationFilter, setCancellationFilter] = useState('all');
  
  // State for expandable rows
  const [expandedOrders, setExpandedOrders] = useState<string[]>([]);
  const [expandedMobileProducts, setExpandedMobileProducts] = useState<string[]>([]);

  // Load data
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [ordersRes, usersRes] = await Promise.all([
          apiGet<Order>('/api/orders'),
          apiGet<User>('/api/users?role=admin')
        ]);

        if (mounted && ordersRes.ok) {
          setOrders(ordersRes.items || []);
          void logHistory({
            section: 'orders',
            action: 'page_loaded',
            note: 'Loaded orders list',
            meta: { count: (ordersRes.items || []).length }
          });
        }

        if (mounted && usersRes.ok) {
          const members = (usersRes.items || []).map((user: User) => ({
            id: user.id,
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            email: user.email
          }));
          setTeamMembers(members);
        }
      } catch (e) {
        // Optionally show a toast error in future
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Debounced search/filter logging
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void logHistory({
        section: 'orders',
        action: 'search',
        note: 'Orders search/filter changed',
        meta: { searchTerm: searchTerm || null, status: statusFilter || 'all' }
      });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [searchTerm, statusFilter]);

  // Enhanced filter orders
  const filteredOrders = orders.filter(order => {
    const matchesSearch = (order.id?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                       (order.userId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                       (order.orderNumber?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesStatus = !statusFilter || statusFilter === 'all' || order.status === statusFilter;
    const matchesAssignedTo = !assignedToFilter || order.notes?.includes(assignedToFilter);
    const matchesTag = !tagFilter || (order.notes && order.notes.includes(tagFilter));
    const matchesMinTotal = !minTotal || (order.total || 0) >= parseFloat(minTotal);
    const matchesMaxTotal = !maxTotal || (order.total || 0) <= parseFloat(maxTotal);
    const matchesCancellation = cancellationFilter === 'all' || 
                            (cancellationFilter === 'pending' && order.cancellationRequested && order.status !== 'cancelled') ||
                            (cancellationFilter === 'none' && !order.cancellationRequested);
  
    return matchesSearch && matchesStatus && matchesAssignedTo && matchesTag && matchesMinTotal && matchesMaxTotal && matchesCancellation;
  });

  // Add function to check if order has cancellation request
  const hasCancellationRequest = (order: Order) => {
    return order.cancellationRequested && order.status !== 'cancelled';
  };

  // Handle status change
  const handleStatusChange = (orderId: string, newStatus: Order['status']) => {
    const oldStatus = orders.find(o => o.id === orderId)?.status;
    const updatedOrders = orders.map(order => 
      order.id === orderId 
        ? { ...order, status: newStatus, updatedAt: new Date().toISOString() }
        : order
    );
    setOrders(updatedOrders);
    // Persist to backend if available
    (async () => {
      try {
        await apiPatchJson<Order, Partial<Order>>(`/api/orders/${orderId}`, { status: newStatus });
      } catch (e) {
        // Ignore for now; UI already updated optimistically
      }
    })();
    void logHistory({
      section: 'orders',
      action: 'status_changed',
      note: `Order ${orderId} status changed`,
      meta: { orderId, oldStatus: oldStatus ?? null, newStatus }
    });
    
    toast({
      title: "تم تحديث حالة الطلب",
      description: `تم تغيير حالة الطلب إلى ${getStatusLabel(newStatus)}`,
    });
  };

  // Get status label in Arabic
  const getStatusLabel = (status: string) => {
    const statusLabels: Record<string, string> = {
      pending: 'قيد التجهيز',
      confirmed: 'تم التأكيد',
      processing: 'قيد التنفيذ',
      shipped: 'تم الشحن',
      delivered: 'تم التسليم',
      cancelled: 'ملغي',
      refunded: 'مسترد'
    };
    return statusLabels[status] || status;
  };

  // Get status color
  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-gradient-to-r from-orange-100 to-orange-200 text-orange-800 border-orange-300',
      confirmed: 'bg-gradient-to-r from-primary/10 to-primary/20 text-primary border-primary/30',
      processing: 'bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300',
      shipped: 'bg-gradient-to-r from-indigo-100 to-indigo-200 text-indigo-800 border-indigo-300',
      delivered: 'bg-gradient-to-r from-green-100 to-green-200 text-green-800 border-green-300',
      cancelled: 'bg-gradient-to-r from-red-100 to-red-200 text-red-800 border-red-300',
      refunded: 'bg-gradient-to-r from-slate-100 to-slate-200 text-slate-800 border-slate-300'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityBadge = (priority: Order['priority']) => {
    const priorityMap: Record<Order['priority'], string> = {
      low: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      normal: 'bg-slate-100 text-slate-700 border-slate-200',
      high: 'bg-amber-50 text-amber-700 border-amber-200',
      urgent: 'bg-red-50 text-red-700 border-red-200'
    };
    return priorityMap[priority || 'normal'] || priorityMap.normal;
  };

  // Print order
  const handlePrint = (order: Order) => {
    if (!order) return;
    
    // Create printable content with better formatting
    const printContent = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8">
        <title>فاتورة طلب #${order.orderNumber || order.id?.slice(-6) || 'N/A'}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .info { margin: 20px 0; }
          .info p { margin: 10px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: right; }
          th { background-color: #f2f2f2; }
          .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>فاتورة طلب #${order.orderNumber || order.id?.slice(-6) || 'N/A'}</h1>
        </div>
        <div class="info">
          <p><strong>التاريخ:</strong> ${new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
          <p><strong>الحالة:</strong> ${getStatusLabel(order.status)}</p>
          <p><strong>طريقة الدفع:</strong> ${order.paymentMethod || 'N/A'}</p>
          <p><strong>عنوان الشحن:</strong> ${order.shippingAddress?.street || 'N/A'}, ${order.shippingAddress?.city || 'N/A'}</p>
        </div>
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
            ${(order.items || []).map(item => `
              <tr>
                <td>${item.product?.nameAr || 'N/A'}</td>
                <td>${item.quantity || 0}</td>
                <td>${(item.price || 0).toFixed(2)} ج.م</td>
                <td>${((item.price || 0) * (item.quantity || 0)).toFixed(2)} ج.م</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="total">
          <p>المجموع الفرعي: ${(order.subtotal || 0).toFixed(2)} ج.م</p>
          <p>الشحن: ${(order.shipping || 0).toFixed(2)} ج.م</p>
          <p>الضريبة: ${(order.tax || 0).toFixed(2)} ج.م</p>
          <p style="font-size: 20px; color: #2563eb;">الإجمالي: ${(order.total || 0).toFixed(2)} ج.م</p>
        </div>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
      printWindow.print();
    } else {
      toast({
        title: 'خطأ',
        description: 'فشل في فتح نافذة الطباعة. يرجى التحقق من إعدادات المتصفح.',
        variant: 'destructive'
      });
    }
    void logHistory({ section: 'orders', action: 'order_printed', note: `Printed order ${order.id || order._id}`, meta: { orderId: order.id || order._id } });
  };

  // Handle bulk status change
  const handleBulkStatusChange = async () => {
    if (!bulkAction || selectedOrders.length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار الطلبات وإجراء الإجراء',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await apiPostJson<unknown, { orderIds: string[]; status: string; note?: string; sendEmail?: boolean }>(
        '/api/orders/bulk/status',
        { orderIds: selectedOrders, status: bulkAction, note: bulkNote || undefined, sendEmail: false }
      );
      
      if (!res.ok) throw new Error((res as { error?: string }).error || 'Bulk update failed');
      
      // Update local state
      const updatedOrders = orders.map(order => 
        selectedOrders.includes(order.id) 
          ? { ...order, status: bulkAction as Order['status'], updatedAt: new Date().toISOString() }
          : order
      );
      setOrders(updatedOrders);
      
      // Clear selection
      setSelectedOrders([]);
      setBulkAction('');
      setBulkNote('');
      
      toast({
        title: 'نجاح',
        description: `تم تحديث ${selectedOrders.length} طلب بنجاح`,
      });
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في تحديث الطلبات',
        variant: 'destructive'
      });
      console.error('Error updating orders:', err);
    }
  };

  // Handle assign order
  const handleAssignOrder = async (orderId: string, assigneeId: string) => {
    try {
      const res = await apiPatchJson<Order, Partial<Order>>(`/api/orders/${orderId}`, { 
        assignedTo: assigneeId
      });
      
      if (res.ok && res.item) {
        // Update local state
        const updatedOrders = orders.map(order => 
          order.id === orderId 
            ? { ...order, assignedTo: assigneeId }
            : order
        );
        setOrders(updatedOrders);
        
        toast({
          title: "نجاح",
          description: "تم تعيين الطلب للموظف بنجاح",
        });
      } else {
        throw new Error((res as unknown as { error: string }).error || 'فشل في تعيين الطلب');
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل في تعيين الطلب للموظف",
        variant: "destructive"
      });
      console.error('Error assigning order:', err);
    }
  };

  // Handle bulk assign
  const handleBulkAssign = async () => {
    if (!selectedAssignee || selectedOrders.length === 0) {
      toast({
        title: 'خطأ',
        description: 'يرجى اختيار الطلبات والموظف',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await apiPostJson<unknown, { orderIds: string[]; assignedTo: string }>(
        '/api/orders/bulk/assign',
        { orderIds: selectedOrders, assignedTo: selectedAssignee }
      );
      
      if (!res.ok) throw new Error((res as unknown as { error: string }).error || 'Bulk assign failed');
      
      // Update local state
      const updatedOrders = orders.map(order => 
        selectedOrders.includes(order.id) 
          ? { ...order, assignedTo: selectedAssignee }
          : order
      );
      setOrders(updatedOrders);
      
      // Clear selection
      setSelectedOrders([]);
      setSelectedAssignee('');
      
      toast({
        title: 'نجاح',
        description: `تم تعيين ${selectedOrders.length} طلب للموظف بنجاح`,
      });
    } catch (err) {
      toast({
        title: 'خطأ',
        description: 'فشل في تعيين الطلبات',
        variant: 'destructive'
      });
      console.error('Error assigning orders:', err);
    }
  };

  // Handle add note
  const handleAddNote = async (orderId: string) => {
    if (!noteText.trim()) {
      toast({
        title: 'خطأ',
        description: 'يرجى إدخال ملاحظة',
        variant: 'destructive'
      });
      return;
    }

    try {
      const res = await apiPostJson<Order, { text: string }>(
        `/api/orders/${orderId}/notes`,
        { text: noteText }
      );
      
      if (res.ok && res.item) {
        setOrders(orders.map(order => 
          order.id === orderId ? res.item! : order
        ));
        
        setNoteDialogOrderId(null);
        setNoteText('');
        
        toast({
          title: "نجاح",
          description: "تمت إضافة الملاحظة بنجاح",
        });
      } else {
        throw new Error((res as unknown as { error: string }).error || 'فشل في إضافة الملاحظة');
      }
    } catch (err) {
      toast({
        title: "خطأ",
        description: "فشل في إضافة الملاحظة",
        variant: "destructive"
      });
      console.error('Error adding note:', err);
    }
  };

  // Handle edit order
  const handleEditOrder = (order: Order) => {
    setEditingOrder(order);
    setIsEditDialogOpen(true);
  };

  // Handle save order
  const handleSaveOrder = (updatedOrder: Order) => {
    setOrders(orders.map(o => 
      o.id === updatedOrder.id ? updatedOrder : o
    ));
  };

  // Handle order cancellation
  const handleOrderCancellation = (order: Order) => {
    setCancellationOrder(order);
    setIsCancellationDialogOpen(true);
  };

  // Handle save order after cancellation
  const handleSaveOrderAfterCancellation = (updatedOrder: Order) => {
    setOrders(orders.map(o => 
      o.id === updatedOrder.id ? updatedOrder : o
    ));
  };

  // Handle partial refund
  const handlePartialRefund = (order: Order) => {
    setRefundOrder(order);
    setIsRefundDialogOpen(true);
  };

  // Handle save order after refund
  const handleSaveOrderAfterRefund = (updatedOrder: Order) => {
    setOrders(orders.map(o => 
      o.id === updatedOrder.id ? updatedOrder : o
    ));
  };

  // Handle customer communication
  const handleCustomerCommunication = (order: Order) => {
    setCommunicationOrder(order);
    setIsCommunicationDialogOpen(true);
  };

  // Handle send message
  const handleSendMessage = () => {
    // Refresh the orders list to show the new note
    setOrders([...orders]);
  };

  // Select all orders
  const selectAllOrders = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(order => order._id || order.id));
    }
  };

  // Handle row click - toggle selection
  const handleRowClick = (orderId: string, e: React.MouseEvent) => {
    // Ignore if clicking on interactive elements
    const target = e.target as HTMLElement;
    if (target.closest('button, select, a, [role="button"], [role="combobox"]')) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    if (!orderId) {
      console.error('No orderId provided to handleRowClick');
      return;
    }
    
    // Use same logic as checkbox
    setSelectedOrders(prev => {


      const isSelected = prev.includes(orderId);

      
      if (isSelected) {
        const newSelection = prev.filter(id => id !== orderId);

        return newSelection;
      } else {
        const newSelection = [...prev, orderId];

        return newSelection;
      }
    });
  };

  // Toggle expand order details
  const toggleExpand = (orderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedOrders(prev => 
      prev.includes(orderId) ? prev.filter(id => id !== orderId) : [...prev, orderId]
    );
  };

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: '✅ تم النسخ', description: `${label} تم نسخه بنجاح` });
    } catch (err) {
      toast({ title: '❌ خطأ', description: 'فشل النسخ', variant: 'destructive' });
    }
  };

  // Detect mobile device
  const isMobileDevice = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + A: Select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a' && !e.shiftKey) {
        e.preventDefault();
        setSelectedOrders(prev => {
          if (prev.length === filteredOrders.length) {
            return [];
          } else {
            return filteredOrders.map(order => order._id || order.id);
          }
        });
      }
      // Escape: Clear selection
      if (e.key === 'Escape') {
        setSelectedOrders([]);
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [filteredOrders]);

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        {/* Modern Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 sm:gap-6 mb-6 sm:mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              إدارة الطلبات
            </h1>
            <p className="text-sm sm:text-base lg:text-lg text-slate-600 font-medium mt-1 sm:mt-2">مراجعة ومتابعة طلبات العملاء</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className="flex-1 sm:flex-none bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 shadow-md text-xs sm:text-sm"
            >
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">تصدير الطلبات</span>
              <span className="sm:hidden">تصدير</span>
            </Button>
            <Button 
              variant="outline" 
              size={isMobile ? "sm" : "default"}
              className="flex-1 sm:flex-none bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20 text-primary hover:from-primary/10 hover:to-primary/20 shadow-md text-xs sm:text-sm"
            >
              <RefreshCw className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">تحديث</span>
              <span className="sm:hidden">تحديث</span>
            </Button>
          </div>
        </div>

        {/* Enhanced Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-600 text-xs sm:text-sm font-semibold">قيد التجهيز</p>
                  <p className="text-2xl sm:text-3xl font-black text-orange-900 group-hover:scale-110 transition-transform">
                    {orders.filter(o => o.status === 'pending').length}
                  </p>
                  <p className="text-xs text-orange-600 mt-1">طلب جديد</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary text-xs sm:text-sm font-semibold">تم التأكيد</p>
                  <p className="text-2xl sm:text-3xl font-black text-primary group-hover:scale-110 transition-transform">
                    {orders.filter(o => o.status === 'confirmed').length}
                  </p>
                  <p className="text-xs text-primary mt-1">جاهز للشحن</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-primary rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-xs sm:text-sm font-semibold">تم التسليم</p>
                  <p className="text-2xl sm:text-3xl font-black text-green-900 group-hover:scale-110 transition-transform">
                    {orders.filter(o => o.status === 'delivered').length}
                  </p>
                  <p className="text-xs text-green-600 mt-1">معدل نجاح 100%</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-red-600 text-xs sm:text-sm font-semibold">ملغي</p>
                  <p className="text-2xl sm:text-3xl font-black text-red-900 group-hover:scale-110 transition-transform">
                    {orders.filter(o => o.status === 'cancelled').length}
                  </p>
                  <p className="text-xs text-red-600 mt-1">يحتاج متابعة</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <XCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-600 text-xs sm:text-sm font-semibold">طلبات الإلغاء</p>
                  <p className="text-2xl sm:text-3xl font-black text-yellow-900 group-hover:scale-110 transition-transform">
                    {orders.filter(o => o.cancellationRequested && o.status !== 'cancelled').length}
                  </p>
                  <p className="text-xs text-yellow-600 mt-1">في انتظار المراجعة</p>
                </div>
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <AlertCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Search and Filters */}
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
                    <SelectItem value="pending">قيد التجهيز</SelectItem>
                    <SelectItem value="confirmed">تم التأكيد</SelectItem>
                    <SelectItem value="delivered">تم التسليم</SelectItem>
                    <SelectItem value="cancelled">ملغي</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="w-full sm:w-48">
                <Select value={cancellationFilter} onValueChange={setCancellationFilter}>
                  <SelectTrigger className="h-10 sm:h-12 bg-white/80 border-slate-200 shadow-md text-sm sm:text-base">
                    <SelectValue placeholder="جميع طلبات الإلغاء" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع طلبات الإلغاء</SelectItem>
                    <SelectItem value="pending">طلبات الإلغاء قيد المراجعة</SelectItem>
                    <SelectItem value="none">بدون طلبات إلغاء</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button 
                variant="outline" 
                size={isMobile ? "sm" : "default"}
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className="h-10 sm:h-12 px-3 sm:px-4 bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200 text-purple-700 hover:from-purple-100 hover:to-purple-200 shadow-md text-xs sm:text-sm"
              >
                <Filter className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">تصفية متقدمة</span>
                <span className="sm:hidden">تصفية</span>
                {showAdvancedFilters ? (
                  <ChevronUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 sm:w-4 sm:h-4 mr-1" />
                )}
              </Button>
            </div>
            
            {/* Advanced Filters */}
            {showAdvancedFilters && (
              <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">المعين إلى</label>
                  <div className="relative">
                    <UserCheck className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="اسم الموظف"
                      value={assignedToFilter}
                      onChange={(e) => setAssignedToFilter(e.target.value)}
                      className="pr-10 h-9 bg-white/80 border-slate-200 shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">الوسم</label>
                  <div className="relative">
                    <Tag className="absolute right-3 top-2.5 h-4 w-4 text-slate-400" />
                    <Input
                      placeholder="اسم الوسم"
                      value={tagFilter}
                      onChange={(e) => setTagFilter(e.target.value)}
                      className="pr-10 h-9 bg-white/80 border-slate-200 shadow-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">الحد الأدنى</label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={minTotal}
                    onChange={(e) => setMinTotal(e.target.value)}
                    className="h-9 bg-white/80 border-slate-200 shadow-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-600 mb-1 block">الحد الأقصى</label>
                  <Input
                    type="number"
                    placeholder="10000"
                    value={maxTotal}
                    onChange={(e) => setMaxTotal(e.target.value)}
                    className="h-9 bg-white/80 border-slate-200 shadow-sm"
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Removed duplicate bulk actions section - actions now in table header */}

        {/* Revolutionary Mobile vs Desktop Layout */}
        {isMobile ? (
          <div className="space-y-4">
            {/* Mobile: Revolutionary Card-Based Order Layout */}
            {filteredOrders.map((order, index) => (
              <div key={order.id || order._id || `order-${index}`} className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg overflow-hidden">
                {/* Mobile Order Header */}
                <div className={`p-4 border-b border-slate-200/50 ${getStatusColor(order.status)}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                        <Package className="w-5 h-5 text-slate-700" />
                        {hasCancellationRequest(order) && (
                          <div className="absolute -top-1 -left-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center">
                            <AlertCircle className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">طلب #{order.orderNumber || order.id?.slice(-6) || 'N/A'}</h3>
                        <p className="text-xs text-slate-600">عميل: #{order.userId?.slice(-6) || 'Guest'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-slate-900">{order.total.toFixed(2)} ج.م</p>
                      <p className="text-xs text-slate-600">{new Date(order.createdAt).toLocaleDateString('ar-EG')}</p>
                    </div>
                  </div>
                </div>
                
                {/* Mobile Order Content */}
                <div className="p-4 space-y-4">
                  {/* Order Items Summary */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-semibold text-sm text-slate-700">المنتجات ({(order.items || []).length})</h4>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-xs p-1 hover:bg-slate-200"
                        onClick={() => {
                          const orderId = order._id || order.id;
                          setExpandedMobileProducts(prev => 
                            prev.includes(orderId) 
                              ? prev.filter(id => id !== orderId) 
                              : [...prev, orderId]
                          );
                        }}
                      >
                        {expandedMobileProducts.includes(order._id || order.id) ? (
                          <ChevronUp className="w-4 h-4" />
                        ) : (
                          <ChevronDown className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                    <div className="space-y-2">
                      {expandedMobileProducts.includes(order._id || order.id) ? (
                        // Show all products when expanded
                        (order.items || []).map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs bg-white rounded p-2">
                            <span className="font-medium">{item.product.nameAr}</span>
                            <span className="text-slate-600">{item.quantity}x {item.price.toFixed(2)} ج.م</span>
                          </div>
                        ))
                      ) : (
                        // Show only first 2 products when collapsed
                        <>
                          {(order.items || []).slice(0, 2).map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs">
                              <span className="font-medium">{item.product.nameAr}</span>
                              <span className="text-slate-600">{item.quantity}x {item.price.toFixed(2)} ج.م</span>
                            </div>
                          ))}
                          {(order.items || []).length > 2 && (
                            <p className="text-xs text-slate-500 text-center">+{(order.items || []).length - 2} منتج آخر</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  
                  {/* Cancellation Request Badge */}
                  {hasCancellationRequest(order) && (
                    <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      <span className="text-yellow-800 text-xs font-medium">طلب إلغاء قيد المراجعة</span>
                    </div>
                  )}
                  
                  {/* Status Management */}
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-slate-700">الحالة:</label>
                    <Select 
                      value={order.status} 
                      onValueChange={(value) => handleStatusChange(order.id, value as Order['status'])}
                    >
                      <SelectTrigger className="flex-1 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem key="pending" value="pending">
                          <div className="flex items-center gap-2">
                            <Clock className="w-3 h-3" />
                            <span>قيد التجهيز</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="confirmed" value="confirmed">
                          <div className="flex items-center gap-2">
                            <Package className="w-3 h-3" />
                            <span>تم التأكيد</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="delivered" value="delivered">
                          <div className="flex items-center gap-2">
                            <CheckCircle className="w-3 h-3" />
                            <span>تم التسليم</span>
                          </div>
                        </SelectItem>
                        <SelectItem key="cancelled" value="cancelled">
                          <div className="flex items-center gap-2">
                            <XCircle className="w-3 h-3" />
                            <span>ملغي</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Action Buttons - All Actions for Mobile */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { 
                        if (order.id || order._id) {
                          navigate(`/admin/order/${order.id || order._id}`);
                          void logHistory({ section: 'orders', action: 'view_opened', note: `Viewed order ${order.id || order._id}`, meta: { orderId: order.id || order._id } }); 
                        }
                      }}
                      className="text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      عرض
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrint(order)}
                      className="text-xs"
                    >
                      <Printer className="w-3 h-3 mr-1" />
                      طباعة
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditOrder(order)}
                      className="text-xs"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCustomerCommunication(order)}
                      className="text-xs"
                    >
                      <MessageCircle className="w-3 h-3 mr-1" />
                      رسالة
                    </Button>
                    {(order.status === 'delivered' || order.status === 'shipped') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePartialRefund(order)}
                        className="text-xs"
                      >
                        <Wallet className="w-3 h-3 mr-1" />
                        استرداد
                      </Button>
                    )}
                    {order.status !== 'cancelled' && order.status !== 'refunded' && order.status !== 'returned' && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOrderCancellation(order)}
                        className="text-xs text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="w-3 h-3 mr-1" />
                        إلغاء
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop: Traditional Table Layout
          <Card className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-2xl rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 via-primary/5 to-secondary/5 border-b border-slate-200/50 p-4 sm:p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-10 h-10 sm:w-12 sm:h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-lg">
                  <Package className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg sm:text-xl lg:text-2xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                    جدول الطلبات ({filteredOrders.length})
                  </CardTitle>
                  <p className="text-slate-600 mt-1 text-xs sm:text-sm">إجمالي الطلبات وحالتها</p>
                </div>
              </div>
              
              {/* Actions - Show when orders selected */}
              {selectedOrders.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap bg-primary/5 px-4 py-2 rounded-lg border border-primary/20">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="font-bold text-slate-900 text-sm">✓ {selectedOrders.length}</span>
                  </div>
                  <div className="h-4 w-px bg-slate-300"></div>
                  
                  {selectedOrders.length === 1 && (() => {
                    const order = orders.find(o => (o._id || o.id) === selectedOrders[0]);
                    return order ? (
                      <>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { 
                          if (order.id || order._id) {
                            navigate(`/admin/order/${order.id || order._id}`);
                          }
                        }}>
                          <Eye className="w-3 h-3 mr-1" />
                          عرض
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handlePrint(order)}>
                          <Printer className="w-3 h-3 mr-1" />
                          طباعة
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleEditOrder(order)}>
                          <Edit className="w-3 h-3 mr-1" />
                          تعديل
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handleCustomerCommunication(order)}>
                          <MessageCircle className="w-3 h-3 mr-1" />
                          رسالة
                        </Button>
                        <Select 
                          value={order.status} 
                          onValueChange={(value) => handleStatusChange(order._id || order.id, value as Order['status'])}
                        >
                          <SelectTrigger className="w-[120px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem key="pending" value="pending">قيد التجهيز</SelectItem>
                            <SelectItem key="confirmed" value="confirmed">تم التأكيد</SelectItem>
                            <SelectItem key="processing" value="processing">قيد التنفيذ</SelectItem>
                            <SelectItem key="shipped" value="shipped">تم الشحن</SelectItem>
                            <SelectItem key="delivered" value="delivered">تم التسليم</SelectItem>
                            <SelectItem key="cancelled" value="cancelled">ملغي</SelectItem>
                          </SelectContent>
                        </Select>
                        {(order.status === 'delivered' || order.status === 'shipped') && (
                          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => handlePartialRefund(order)}>
                            <Wallet className="w-3 h-3 mr-1" />
                            استرداد
                          </Button>
                        )}
                        {order.status !== 'cancelled' && order.status !== 'refunded' && (
                          <Button size="sm" variant="outline" className="h-8 text-xs text-red-600 hover:bg-red-50" onClick={() => handleOrderCancellation(order)}>
                            <XCircle className="w-3 h-3 mr-1" />
                            إلغاء
                          </Button>
                        )}
                      </>
                    ) : null;
                  })()}
                  
                  {selectedOrders.length > 1 && (
                    <>
                      <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => {
                        selectedOrders.forEach(id => {
                          const order = orders.find(o => (o._id || o.id) === id);
                          if (order) handlePrint(order);
                        });
                      }}>
                        <Printer className="w-3 h-3 mr-1" />
                        طباعة الكل
                      </Button>
                      <Select value={bulkAction} onValueChange={setBulkAction}>
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                          <SelectValue placeholder="تغيير الحالة" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem key="confirmed" value="confirmed">تم التأكيد</SelectItem>
                          <SelectItem key="processing" value="processing">قيد التنفيذ</SelectItem>
                          <SelectItem key="shipped" value="shipped">تم الشحن</SelectItem>
                          <SelectItem key="delivered" value="delivered">تم التسليم</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" className="h-8 text-xs" onClick={handleBulkStatusChange} disabled={!bulkAction}>
                        تطبيق
                      </Button>
                    </>
                  )}
                  
                  <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setSelectedOrders([])}>
                    <X className="w-3 h-3 mr-1" />
                    إلغاء
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="p-3 sm:p-6">
            <div className="overflow-x-auto rounded-xl sm:rounded-2xl border border-slate-200/50 shadow-lg">
              <div className="min-w-[700px] sm:min-w-0"> {/* Ensure minimum width for mobile horizontal scroll */}
              <Table className="bg-white/50">
                <TableHeader className="bg-gradient-to-r from-slate-100 via-primary/5 to-secondary/5">
                  <TableRow className="border-b-2 border-slate-200/50">
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm w-12 text-center border-r border-slate-300">
                      <div className="flex items-center justify-center" title="تحديد الكل / إلغاء التحديد">
                        <Checkbox
                          checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                          onCheckedChange={selectAllOrders}
                          className="cursor-pointer transition-all hover:scale-110"
                        />
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm w-12 text-center border-r border-slate-300">
                      <span className="text-xs text-slate-500">تفاصيل</span>
                    </TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm text-center border-r border-slate-300">
                      <div className="flex items-center justify-center gap-1 sm:gap-2">
                        <Package className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                        <span>رقم الطلب</span>
                      </div>
                    </TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm text-center border-r border-slate-300">العميل</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm text-center border-r border-slate-300 hidden sm:table-cell">التاريخ</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm text-center border-r border-slate-300 hidden md:table-cell">عدد المنتجات</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm text-center border-r border-slate-300">المجموع</TableHead>
                    <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs sm:text-sm text-center">الحالة</TableHead>
                  </TableRow>
                </TableHeader>
                  <TableBody className="divide-y divide-slate-200">
                    {filteredOrders.map((order, index) => {
                      console.log(`Order ${index}:`, { 
                        id: order.id, 
                        _id: order._id, 
                        orderNumber: order.orderNumber,
                        shippingAddress: order.shippingAddress,
                        userId: order.userId
                      });
                      return (
                      <React.Fragment key={order.id || order._id || `order-${index}`}>
                      <TableRow 
                        onClick={(e) => handleRowClick(order._id || order.id, e)}
                        className={`cursor-pointer transition-all duration-200 border-l-4 ${
                          selectedOrders.includes(order._id || order.id) 
                            ? 'bg-gradient-to-r from-primary/10 to-secondary/5 border-l-primary shadow-md' 
                            : 'border-l-transparent hover:border-l-primary/30 hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5'
                        }`}
                      >
                        <TableCell className="text-center border-r border-slate-200">
                          <div 
                            className="flex items-center justify-center" 
                            title={selectedOrders.includes(order._id || order.id) ? "إلغاء التحديد" : "تحديد الطلب"}
                            onClick={(e) => {
                              e.stopPropagation();
                              const orderId = order._id || order.id;


                              
                              setSelectedOrders(prev => {
                                const isCurrentlySelected = prev.includes(orderId);

                                
                                if (isCurrentlySelected) {
                                  const newSelection = prev.filter(id => id !== orderId);

                                  return newSelection;
                                } else {
                                  const newSelection = [...prev, orderId];

                                  return newSelection;
                                }
                              });
                            }}
                          >
                            <Checkbox
                              checked={selectedOrders.includes(order._id || order.id)}
                              className="cursor-pointer transition-all hover:scale-110 data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                            />
                          </div>
                        </TableCell>
                        <TableCell onClick={(e) => e.stopPropagation()} className="text-center border-r border-slate-200">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => toggleExpand(order._id || order.id, e)}
                            className="p-1 h-8 w-8 rounded-full hover:bg-primary/10 transition-all"
                            title={expandedOrders.includes(order._id || order.id) ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                          >
                            {expandedOrders.includes(order._id || order.id) ? (
                              <ChevronUp className="w-4 h-4 text-primary" />
                            ) : (
                              <ChevronDown className="w-4 h-4 text-slate-600" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="text-center border-r border-slate-200">
                          <div className="space-y-1">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg flex items-center justify-center relative">
                                <Package className="w-4 h-4 text-white" />
                                {hasCancellationRequest(order) && (
                                  <div className="absolute -top-1 -left-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center">
                                    <AlertCircle className="w-2 h-2 text-white" />
                                  </div>
                                )}
                              </div>
                              <span className="font-bold text-base text-slate-900">#{order.orderNumber || order.id?.slice(-6) || 'N/A'}</span>
                            </div>
                            <p className="text-xs text-slate-400 font-mono pl-10 truncate max-w-[200px]">{order.id}</p>
                          </div>
                        </TableCell>
                        <TableCell className="sm:hidden text-center border-r border-slate-200">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm text-slate-900">{order.shippingAddress?.name || 'عميل'}</p>
                            <p className="text-xs text-slate-600 truncate max-w-[150px]">{order.shippingAddress?.email || order.shippingAddress?.phone || 'لا يوجد'}</p>
                            <p className="text-xs text-slate-400 font-mono">ID: #{order.userId?.slice(-6) || 'N/A'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-center border-r border-slate-200">
                          <div className="space-y-0.5">
                            <p className="font-semibold text-sm text-slate-900">{order.shippingAddress?.name || 'عميل'}</p>
                            <p className="text-xs text-slate-600 truncate max-w-[200px]">{order.shippingAddress?.email || 'لا يوجد بريد'}</p>
                            <p className="text-xs text-slate-400 font-mono">ID: #{order.userId?.slice(-6) || 'N/A'}</p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell text-center border-r border-slate-200">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-900 text-xs md:text-sm">
                              {new Date(order.createdAt).toLocaleDateString('ar-EG')}
                            </p>
                            <p className="text-xs text-slate-500 hidden md:block">
                              {new Date(order.createdAt).toLocaleTimeString('ar-EG')}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-center border-r border-slate-200">
                          <Badge 
                            variant="secondary" 
                            className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300 font-semibold text-xs"
                          >
                            {order.items.length} منتج
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center border-r border-slate-200">
                          <div className="flex items-center justify-center gap-1 md:gap-2">
                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                            <p className="font-bold text-sm md:text-lg text-green-600">{order.total.toFixed(2)} ج.م</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex justify-center">
                          <Select 
                            value={order.status} 
                            onValueChange={(value) => handleStatusChange(order.id, value as Order['status'])}
                          >
                            <SelectTrigger className={`w-28 md:w-36 font-semibold shadow-md transition-all duration-200 text-xs md:text-sm ${getStatusColor(order.status)}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="pending" className="text-orange-700">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <Clock className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-xs md:text-sm">قيد التجهيز</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="confirmed" className="text-primary">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <Package className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-xs md:text-sm">تم التأكيد</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="delivered" className="text-green-700">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <CheckCircle className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-xs md:text-sm">تم التسليم</span>
                                </div>
                              </SelectItem>
                              <SelectItem value="cancelled" className="text-red-700">
                                <div className="flex items-center gap-1 md:gap-2">
                                  <XCircle className="w-3 h-3 md:w-4 md:h-4" />
                                  <span className="text-xs md:text-sm">ملغي</span>
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          </div>
                        </TableCell>
                      </TableRow>
                      
                      {/* Expandable Order Details */}
                      {expandedOrders.includes(order._id || order.id) && (
                        <TableRow className="bg-slate-50">
                          <TableCell colSpan={9} className="p-0">
                            <div className="p-4 space-y-4 animate-in slide-in-from-top-2">
                              {/* Products List */}
                              <div className="bg-white rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center gap-2 mb-3">
                                  <Package className="w-4 h-4 text-purple-600" />
                                  <h4 className="font-semibold text-slate-900">المنتجات ({order.items?.length || 0})</h4>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                  {(order.items || []).map((item, idx) => (
                                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 rounded-lg">
                                      <div className="flex items-center gap-2">
                                        <div className="w-10 h-10 bg-white rounded border border-slate-200 flex items-center justify-center">
                                          {item.product?.image ? (
                                            <img src={item.product.image} alt="" className="w-full h-full object-cover rounded" />
                                          ) : (
                                            <Package className="w-4 h-4 text-slate-400" />
                                          )}
                                        </div>
                                        <div>
                                          <p className="text-sm font-medium text-slate-900">{item.product?.nameAr || 'منتج'}</p>
                                          <p className="text-xs text-slate-500">الكمية: {item.quantity}</p>
                                        </div>
                                      </div>
                                      <p className="text-sm font-bold text-slate-900">{(item.price * item.quantity).toFixed(2)} ج.م</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Shipping Address */}
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <MapPin className="w-4 h-4 text-primary" />
                                    <h4 className="font-semibold text-slate-900">عنوان الشحن</h4>
                                  </div>
                                  <p className="text-sm text-slate-700 mb-2">
                                    {order.shippingAddress?.street || 'غير محدد'}<br />
                                    {order.shippingAddress?.city || ''} {order.shippingAddress?.state || ''}<br />
                                    {order.shippingAddress?.postalCode || ''} {order.shippingAddress?.country || ''}
                                  </p>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => copyToClipboard(
                                      `${order.shippingAddress?.street}, ${order.shippingAddress?.city}, ${order.shippingAddress?.state}`,
                                      'العنوان'
                                    )}
                                    className="mt-2"
                                  >
                                    <Copy className="w-3 h-3 mr-1" />
                                    نسخ العنوان
                                  </Button>
                                </div>

                                {/* Contact Info */}
                                <div className="bg-white rounded-lg p-4 border border-slate-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <Phone className="w-4 h-4 text-green-600" />
                                    <h4 className="font-semibold text-slate-900">معلومات الاتصال</h4>
                                  </div>
                                  {order.shippingAddress?.phone ? (
                                    <div className="space-y-2">
                                      <p className="text-sm text-slate-700">
                                        {order.shippingAddress.phone}
                                      </p>
                                      {isMobileDevice() ? (
                                        <a
                                          href={`tel:${order.shippingAddress.phone}`}
                                          className="inline-flex items-center gap-2 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors text-sm"
                                        >
                                          <Phone className="w-4 h-4" />
                                          اتصال الآن
                                        </a>
                                      ) : (
                                        <Button
                                          size="sm"
                                          variant="outline"
                                          onClick={() => copyToClipboard(order.shippingAddress.phone, 'رقم الهاتف')}
                                        >
                                          <Copy className="w-3 h-3 mr-1" />
                                          نسخ الرقم
                                        </Button>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm text-slate-500">لا يوجد رقم هاتف</p>
                                  )}
                                </div>
                              </div>

                              {/* Quick Info */}
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                                  <p className="text-xs text-slate-600">المنتجات</p>
                                  <p className="text-lg font-bold text-slate-900">{order.items?.length || 0}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                                  <p className="text-xs text-slate-600">طريقة الدفع</p>
                                  <p className="text-sm font-semibold text-slate-900">{order.paymentMethod || 'N/A'}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                                  <p className="text-xs text-slate-600">حالة الدفع</p>
                                  <p className="text-sm font-semibold text-slate-900">{order.paymentStatus || 'N/A'}</p>
                                </div>
                                <div className="bg-white rounded-lg p-3 border border-slate-200 text-center">
                                  <p className="text-xs text-slate-600">رقم التتبع</p>
                                  <p className="text-sm font-semibold text-slate-900">{order.trackingNumber || 'لا يوجد'}</p>
                                </div>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                      </React.Fragment>
                    );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
        
        {/* Edit Order Dialog */}
        <OrderEditDialog
          order={editingOrder}
          open={isEditDialogOpen}
          onOpenChange={setIsEditDialogOpen}
          onSave={handleSaveOrder}
        />
        
        {/* Partial Refund Dialog */}
        <PartialRefundDialog
          order={refundOrder}
          open={isRefundDialogOpen}
          onOpenChange={setIsRefundDialogOpen}
          onSave={handleSaveOrderAfterRefund}
        />
        
        {/* Order Cancellation Dialog */}
        <OrderCancellationDialog
          order={cancellationOrder}
          open={isCancellationDialogOpen}
          onOpenChange={setIsCancellationDialogOpen}
          onSave={handleSaveOrderAfterCancellation}
        />
        
        {/* Customer Communication Dialog */}
        <CustomerCommunicationDialog
          order={communicationOrder}
          open={isCommunicationDialogOpen}
          onOpenChange={setIsCommunicationDialogOpen}
          onSend={handleSendMessage}
        />
      </div>
    </AdminLayout>
  );
};

export default AdminOrders;
