import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import useDeviceDetection from '@/hooks/useDeviceDetection';
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import AdminLayout from '@/components/admin/AdminLayout';
import { apiGet, apiPatchJson, apiPostJson } from '@/lib/api';
import { User, Order } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { logHistory } from '@/lib/history';
import { 
  Search, 
  Eye, 
  Edit, 
  Ban, 
  CheckCircle,
  Users as UsersIcon,
  ShoppingBag,
  Download,
  UserPlus,
  Shield,
  Crown,
  Mail,
  Phone,
  Calendar,
  TrendingUp,
  Filter
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';

const AdminUsers = () => {
  const { toast } = useToast();
  const { isMobile, isTablet } = useDeviceDetection();
  // Fetch from backend to avoid relying on client env
  const [superAdminEmail, setSuperAdminEmail] = useState<string>('');
  const isSuper = (uEmail?: string) => {
    const a = (uEmail || '').trim().toLowerCase();
    const b = (superAdminEmail || '').trim().toLowerCase();
    return !!a && !!b && a === b;
  };
  // View/Edit modals
  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState<string>('');
  const [editLastName, setEditLastName] = useState<string>('');
  const [editPhone, setEditPhone] = useState<string>('');
  
  // State
  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  // RBAC: we only use the assign-per-user permissions modal now
  // New: Create admin modal state
  const [openCreateAdminModal, setOpenCreateAdminModal] = useState(false);
  // Assign permissions to user modal
  const [openAssignRoleModal, setOpenAssignRoleModal] = useState(false);
  const [loadingPerms, setLoadingPerms] = useState(false);
  const [resources, setResources] = useState<{ name: string; actions: string[] }[]>([]);
  const [selectedResourceActions, setSelectedResourceActions] = useState<Record<string, string[]>>({});
  const [targetEmail, setTargetEmail] = useState('');
  const [targetUserId, setTargetUserId] = useState('');
  const [roleName, setRoleName] = useState('');
  // Deterministic saving: always replace with exactly current checkbox selection
  const [replaceExisting] = useState(true);
  const [savingPerms, setSavingPerms] = useState(false);
  // Track if permissions modal was opened from a user row action
  const [openedFromRow, setOpenedFromRow] = useState(false);

  // Effective permissions of selected user
  const [effectivePerms, setEffectivePerms] = useState<Array<{ resource: string; actions: string[] }>>([]);
  // Persist selections across sessions
  useEffect(() => {
    try {
      const savedUserId = localStorage.getItem('admin.assign.selectedUserId');
      if (savedUserId) setTargetUserId(savedUserId);
    } catch {/* ignore */}
  }, []);
  // Load super admin email from server
  useEffect(() => {
    (async () => {
      try {
        type SuperResp = { ok: true; email?: string } | { ok: false; error: string };
        const resp = await apiGet<{ email: string }>("/api/rbac/super-admin") as unknown as SuperResp;
        if ('ok' in resp && resp.ok) {
          const email = (resp as { ok: true; email?: string }).email || '';
          if (email && email.trim()) {
            setSuperAdminEmail(email);
          } else {
            const viteEmail = ((import.meta as unknown) as { env?: { VITE_SUPER_ADMIN_EMAIL?: string } })?.env?.VITE_SUPER_ADMIN_EMAIL || '';
            if (viteEmail) setSuperAdminEmail(viteEmail);
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);
  useEffect(() => {
    try {
      if (targetUserId) localStorage.setItem('admin.assign.selectedUserId', targetUserId);
    } catch {/* ignore */}
  }, [targetUserId]);

  // Load effective permissions when selecting a user and prefill checkboxes
  useEffect(() => {
    (async () => {
      try {
        setEffectivePerms([]);
        if (!targetUserId) return;
        const resp = await apiGet<{ resource: string; actions: string[] }>(`/api/rbac/users/${targetUserId}/effective-permissions`);
        if (resp.ok) {
          const items = (resp.items || []) as Array<{ resource: string; actions: string[] }>;
          setEffectivePerms(items);
          // Prefill selection state from effective permissions
          const pre: Record<string, string[]> = {};
          for (const p of items) pre[p.resource] = [...(p.actions || [])];
          setSelectedResourceActions(pre);
        }
      } catch (e) {
        // ignore errors; just not show permissions
      }
    })();
  }, [targetUserId]);

  // Create admin form
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');

  // Handlers moved outside effects so they are stable and in scope for JSX

  type CreateAdminBody = { email: string; password: string; firstName?: string; lastName?: string; phone?: string };
  const handleCreateAdmin = async () => {
    try {
      if (!adminEmail || !adminPassword) {
        toast({ title: 'بيانات ناقصة', description: 'البريد الإلكتروني وكلمة المرور مطلوبة', variant: 'destructive' });
        return;
      }
      const body: CreateAdminBody = {
        email: adminEmail,
        password: adminPassword,
        firstName: adminFirstName,
        lastName: adminLastName,
        phone: adminPhone,
      };
      const resp = await apiPostJson<{ user: { id: string; email: string } }, CreateAdminBody>('/api/admin/users', body);
      if ('ok' in resp && resp.ok) {
        toast({ title: 'تم إنشاء/ترقية المشرف', description: 'يمكنك الآن تعيين صلاحيات له إذا لزم' });
        setOpenCreateAdminModal(false);
        setAdminEmail('');
        setAdminPassword('');
        setAdminFirstName('');
        setAdminLastName('');
        setAdminPhone('');
        // refresh users
        try {
          const usersRes = await apiGet<User>('/api/users');
          if (usersRes.ok) setUsers(usersRes.items || []);
        } catch (refreshErr) {
          console.error('Failed to refresh users after admin create:', refreshErr);
        }
      }
    } catch (e) {
      toast({ title: 'فشل إنشاء المشرف', description: (e as Error).message, variant: 'destructive' });
    }
  };

  // Load data
  useEffect(() => {
    // Global permission-denied UX handler
    const onDenied = (e: Event) => {
      const ev = e as CustomEvent<{ status: number; error?: string; resource?: string; action?: string; url?: unknown; userId?: string }>;
      const msg = ev.detail?.error || (ev.detail?.status === 401 ? 'غير مصرح: يرجى تسجيل الدخول' : 'تم رفض الإذن لهذه العملية');
      toast({
        title: ev.detail?.status === 401 ? 'غير مصرح' : 'صلاحيات غير كافية',
        description: `${msg}${ev.detail?.resource ? ` (المورد: ${ev.detail.resource}, العملية: ${ev.detail.action})` : ''}`,
        variant: 'destructive'
      });
    };
    window.addEventListener('permission-denied', onDenied as EventListener);
    return () => window.removeEventListener('permission-denied', onDenied as EventListener);
  }, [toast]);

  // Load RBAC resources for the modal
  const loadResources = async () => {
    try {
      setLoadingPerms(true);
      const resp = await apiGet<{ name: string; actions: string[] }>('/api/rbac/resources');
      if (resp.ok) setResources(resp.items || []);
    } catch (e) {
      toast({ title: 'فشل تحميل الموارد', description: (e as Error).message, variant: 'destructive' });
    } finally {
      setLoadingPerms(false);
    }
  };

  // Open assign-permissions modal for a specific user (prefilled)
  const openUserPermissions = async (userId: string) => {
    try {
      type MaybeMongoUser = User & { _id?: string };
      const u = users.find((us) => {
        const m = us as MaybeMongoUser;
        return m.id === userId || m._id === userId || m.email === userId;
      }) as MaybeMongoUser | undefined;
      setTargetUserId(u?.id || u?._id || userId);
      setTargetEmail(u?.email || '');
      setOpenedFromRow(true);
      setOpenAssignRoleModal(true);
      await loadResources();
      // effective permissions prefill handled in useEffect([targetUserId])
    } catch (e) {
      /* ignore */
    }
  };

  // Removed preconfigured roles flow

  const toggleAction = (resName: string, action: string, checked?: boolean) => {
    setSelectedResourceActions(prev => {
      const current = prev[resName] || [];
      let next: string[];
      if (typeof checked === 'boolean') {
        next = checked ? (current.includes(action) ? current : [...current, action]) : current.filter(a => a !== action);
      } else {
        next = current.includes(action) ? current.filter(a => a !== action) : [...current, action];
      }
      return { ...prev, [resName]: next };
    });
  };

  const toggleAllActions = (resName: string, all: string[], checked: boolean) => {
    setSelectedResourceActions(prev => ({ ...prev, [resName]: checked ? all.slice() : [] }));
  };

  type AssignOk = { ok: true; role: { id: string; name: string }; userId: string };
  type AssignErr = { ok: false; error: string };

  const handleAssignPermissions = async () => {
    try {
      if (!targetUserId && !targetEmail) {
        toast({ title: 'حدد المستخدم', description: 'اختر مستخدمًا من القائمة أو أدخل بريده الإلكتروني', variant: 'destructive' });
        return;
      }
      // Normalize selected actions: dedupe and sort for deterministic server behavior
      const perms = Object.entries(selectedResourceActions)
        .filter(([, acts]) => acts.length)
        .map(([resource, actions]) => ({ resource, actions: Array.from(new Set(actions)).sort() }));
      if (!perms.length) {
        toast({ title: 'حدد الصلاحيات', description: 'الرجاء اختيار عمليات واحدة على الأقل', variant: 'destructive' });
        return;
      }
      setSavingPerms(true);
      type AssignCustomBody = {
        permissions: { resource: string; actions: string[] }[];
        replace: boolean;
        roleName?: string;
        userId?: string;
        email?: string;
      };
      const body: AssignCustomBody = { permissions: perms, replace: true };
      if (roleName) body.roleName = roleName;
      if (targetUserId) body.userId = targetUserId; else if (targetEmail) body.email = targetEmail;
      if (!body.userId && !body.email) {
        toast({ title: 'حدد المستخدم', description: 'ادخل البريد الإلكتروني أو رقم تعريف المستخدم', variant: 'destructive' });
        return;
      }
      // Debug: log payload in dev only
      if (import.meta && (import.meta as any).env?.MODE === 'development' && typeof console !== 'undefined') {
        console.log('Assigning permissions payload', body);
      }
      const resp = await apiPostJson<AssignOk | AssignErr, AssignCustomBody>('/api/rbac/assign-custom', body);
      if ('ok' in resp && resp.ok) {
        toast({ title: 'تم حفظ الصلاحيات', description: 'تم تعيين الصلاحيات المحدثة لهذا المستخدم' });
        // Optimistically apply current selection so user sees changes immediately
        const optimistic: Record<string, string[]> = {};
        for (const p of perms) optimistic[p.resource] = p.actions.slice();
        setSelectedResourceActions(optimistic);
        // Keep modal open and refresh effective permissions shortly after save so changes are visible,
        // but avoid immediate overwrite with stale server data by waiting briefly and merging
        try {
          await loadResources();
          // wait a moment to allow backend to persist & caches to invalidate
          await new Promise((r) => setTimeout(r, 800));
          if (targetUserId) {
            const eff = await apiGet<{ resource: string; actions: string[] }>(`/api/rbac/users/${targetUserId}/effective-permissions`);
            if (eff.ok) {
              const items = (eff.items || []) as Array<{ resource: string; actions: string[] }>;
              setEffectivePerms(items);
              const merged: Record<string, string[]> = { ...optimistic };
              for (const p of items) {
                const cur = new Set(merged[p.resource] || []);
                for (const a of (p.actions || [])) cur.add(a);
                merged[p.resource] = Array.from(cur).sort();
              }
              setSelectedResourceActions(merged);
            }
          }
        } catch { /* ignore */ }
        // Also refresh users list in background for any UI badges relying on roles
        try {
          const usersRes = await apiGet<User>('/api/users');
          if (usersRes.ok) setUsers(usersRes.items || []);
        } catch (e) { void e; }
      } else {
        const errMsg = (resp as AssignErr).error || 'فشل غير معروف';
        toast({ title: 'فشل حفظ الصلاحيات', description: errMsg, variant: 'destructive' });
      }
    } catch (e) {
      toast({ title: 'فشل حفظ الصلاحيات', description: (e as Error).message, variant: 'destructive' });
    }
    finally { setSavingPerms(false); }
  };

  // Initial data load (users and orders)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [usersRes, ordersRes] = await Promise.all([
          apiGet<User>('/api/users'),
          apiGet<Order>('/api/orders'),
        ]);
        if (!mounted) return;
        if (usersRes.ok) {
          setUsers(usersRes.items || []);
          void logHistory({
            section: 'users',
            action: 'page_loaded',
            note: 'Loaded users list',
            meta: { count: (usersRes.items || []).length }
          });
        }
        if (ordersRes.ok) setOrders(ordersRes.items || []);
      } catch (e) {
        // Optionally show a toast error later
      }
    })();
    return () => { mounted = false; };
  }, []);

  // Debounced search/filter logging
  useEffect(() => {
    const t = window.setTimeout(() => {
      void logHistory({
        section: 'users',
        action: 'search',
        note: 'Users search/filter changed',
        meta: {
          searchTerm: searchTerm || null,
          role: roleFilter || 'all',
          status: statusFilter || 'all'
        }
      });
    }, 600);
    return () => window.clearTimeout(t);
  }, [searchTerm, roleFilter, statusFilter]);

  // Filter users
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = !roleFilter || roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = !statusFilter || statusFilter === 'all' ||
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Group lists for rendering sections
  const adminUsers = filteredUsers.filter(u => u.role === 'admin');
  const normalUsers = filteredUsers.filter(u => u.role !== 'admin');

  // Get user orders count
  const getUserOrdersCount = (userId: string) => {
    return orders.filter(order => order.userId === userId).length;
  };

  // Get user total spent
  const getUserTotalSpent = (userId: string) => {
    return orders
      .filter(order => order.userId === userId)
      .reduce((sum, order) => sum + order.total, 0);
  };

  // Toggle user status
  const handleToggleUserStatus = (userId: string) => {
    const prev = users.find(u => u.id === userId)?.isActive ?? null;
    const updatedUsers = users.map(user => 
      user.id === userId 
        ? { ...user, isActive: !user.isActive }
        : user
    );
    setUsers(updatedUsers);
    // Persist change to backend
    const current = users.find(u => u.id === userId);
    const nextStatus = !current?.isActive;
    (async () => {
      try {
        await apiPatchJson<User, Partial<User>>(`/api/users/${userId}`, { isActive: nextStatus });
      } catch (e) {
        // Ignore for now; UI updated optimistically
      }
    })();
    void logHistory({
      section: 'users',
      action: 'status_toggled',
      note: `User ${userId} status toggled`,
      meta: { userId, oldActive: prev, newActive: nextStatus }
    });
    
    const user = users.find(u => u.id === userId);
    toast({
      title: user?.isActive ? "تم حظر المستخدم" : "تم إلغاء حظر المستخدم",
      description: `تم ${user?.isActive ? 'حظر' : 'إلغاء حظر'} المستخدم بنجاح`,
    });
  };

  // Export users as CSV
  const handleExport = () => {
    const csvContent = [
      ['الاسم', 'البريد الإلكتروني', 'الهاتف', 'النوع', 'الحالة', 'عدد الطلبات', 'إجمالي المشتريات'].join(','),
      ...filteredUsers.map(user => [
        `${user.firstName} ${user.lastName}`,
        user.email,
        user.phone || '',
        user.role === 'admin' ? 'مدير' : 'عميل',
        user.isActive ? 'نشط' : 'محظور',
        getUserOrdersCount(user.id),
        getUserTotalSpent(user.id)
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
    void logHistory({ section: 'users', action: 'export_downloaded', note: 'Exported users CSV', meta: { count: filteredUsers.length } });
  };

  return (
    <AdminLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/30">
        {/* Enhanced Mobile-First Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0 mb-6 md:mb-8">
          <div>
            <h1 className="text-2xl md:text-4xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
              إدارة المستخدمين
            </h1>
            <p className="text-sm md:text-lg text-slate-600 font-medium mt-1 md:mt-2">مراجعة وإدارة حسابات المستخدمين</p>
          </div>
          <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto">
            <Button 
              onClick={handleExport} 
              variant="outline" 
              className="bg-gradient-to-r from-green-50 to-green-100 border-green-200 text-green-700 hover:from-green-100 hover:to-green-200 shadow-md text-xs md:text-sm flex-1 md:flex-none"
            >
              <Download className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">تصدير قائمة المستخدمين</span>
              <span className="sm:hidden">تصدير</span>
            </Button>
          </div>
        </div>

      {/* Enhanced Mobile-Responsive Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
          <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-primary text-xs md:text-sm font-semibold">إجمالي المستخدمين</p>
                  <p className="text-2xl md:text-3xl font-black text-primary group-hover:scale-110 transition-transform">{users.length}</p>
                  <p className="text-xs text-primary mt-1">من جميع الفئات</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-primary rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <UsersIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600 text-xs md:text-sm font-semibold">المستخدمين النشطين</p>
                  <p className="text-2xl md:text-3xl font-black text-green-900 group-hover:scale-110 transition-transform">
                    {users.filter(u => u.isActive).length}
                  </p>
                  <p className="text-xs text-green-600 mt-1">{Math.round((users.filter(u => u.isActive).length / users.length) * 100)}% من الإجمالي</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <CheckCircle className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200/50 shadow-lg hover:shadow-xl transition-all duration-300 group">
            <CardContent className="p-4 md:p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-purple-600 text-xs md:text-sm font-semibold">المديرين</p>
                  <p className="text-2xl md:text-3xl font-black text-purple-900 group-hover:scale-110 transition-transform">
                    {users.filter(u => u.role === 'admin').length}
                  </p>
                  <p className="text-xs text-purple-600 mt-1">للإدارة والتحكم</p>
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg group-hover:rotate-12 transition-transform">
                  <Shield className="w-5 h-5 md:w-6 md:h-6 text-white" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Mobile-Responsive Search and Filters */}
        <Card className="bg-white/80 backdrop-blur-xl border-slate-200/50 shadow-lg rounded-xl md:rounded-2xl mb-4 md:mb-6">
          <CardContent className="p-4 md:p-6">
            <div className="space-y-3 md:space-y-0 md:flex md:gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute right-3 top-3 h-4 w-4 md:h-5 md:w-5 text-primary" />
                  <Input
                    placeholder="البحث بالاسم أو البريد الإلكتروني..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-10 md:pr-12 h-10 md:h-12 bg-white/80 border-primary/20 focus:border-primary focus:ring-primary/20 shadow-md text-sm md:text-base"
                  />
                </div>
              </div>
              <div className="flex gap-2 md:gap-4">
                <div className="flex-1 md:w-40">
                  <Select value={roleFilter} onValueChange={setRoleFilter}>
                    <SelectTrigger className="h-10 md:h-12 bg-white/80 border-slate-200 shadow-md text-sm md:text-base">
                      <SelectValue placeholder="جميع الأنواع" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الأنواع</SelectItem>
                      <SelectItem value="customer">عملاء</SelectItem>
                      <SelectItem value="admin">مديرين</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 md:w-40">
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-10 md:h-12 bg-white/80 border-slate-200 shadow-md text-sm md:text-base">
                      <SelectValue placeholder="جميع الحالات" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع الحالات</SelectItem>
                      <SelectItem value="active">نشط</SelectItem>
                      <SelectItem value="inactive">محظور</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button 
                  variant="default" 
                  onClick={() => setOpenCreateAdminModal(true)}
                  className="h-10 md:h-12 px-3 md:px-4 bg-gradient-to-r from-primary to-secondary hover:from-primary hover:to-secondary text-white shadow-md text-xs md:text-sm"
                >
                  <UserPlus className="w-3 h-3 md:w-4 md:h-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">إضافة مشرف</span>
                  <span className="sm:hidden">إضافة</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Revolutionary Mobile vs Desktop Layout */}
        {isMobile ? (
          <div className="space-y-4">
            {/* Mobile: Admins */}
            {adminUsers.length > 0 && (
              <div className="px-1">
                <h3 className="text-sm font-bold text-purple-700 mb-2">المديرين</h3>
              </div>
            )}
            {adminUsers.map((user) => (
              <div key={`admin-m-${user.id || user.email}`} className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg overflow-hidden">
                {/* Mobile User Header */}
                <div className={`p-4 border-b border-slate-200/50 ${
                  user.role === 'admin' 
                    ? 'bg-gradient-to-r from-purple-50 to-purple-100' 
                    : user.isActive 
                      ? 'bg-gradient-to-r from-green-50 to-green-100'
                      : 'bg-gradient-to-r from-red-50 to-red-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 ring-2 ring-white shadow-lg">
                        <AvatarFallback className={`text-white font-bold ${
                          user.role === 'admin'
                            ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                            : user.isActive
                              ? 'bg-gradient-to-br from-green-500 to-green-600'
                              : 'bg-gradient-to-br from-red-500 to-red-600'
                        }`}>
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{user.firstName} {user.lastName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={user.role === 'admin' ? 'default' : 'outline'}
                            className={user.role === 'admin' ? (isSuper(user.email) ? 'bg-yellow-500 text-white text-xs' : 'bg-purple-600 text-white text-xs') : 'border-primary/30 text-primary bg-primary/5 text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.role === 'admin' ? (isSuper(user.email) ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />) : <UsersIcon className="w-3 h-3" />}
                              <span>{user.role === 'admin' ? (isSuper(user.email) ? 'مدير' : 'مشرف') : 'عميل'}</span>
                            </div>
                          </Badge>
                          <Badge 
                            variant={user.isActive ? 'default' : 'destructive'}
                            className={user.isActive ? 'bg-green-600 text-white text-xs' : 'bg-red-600 text-white text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.isActive ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              <span>{user.isActive ? 'نشط' : 'محظور'}</span>
                            </div>
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">{getUserTotalSpent(user.id).toFixed(2)} ج.م</p>
                      <p className="text-xs text-slate-600">{getUserOrdersCount(user.id)} طلب</p>
                    </div>
                  </div>
                </div>
                
                {/* Mobile User Content */}
                <div className="p-4 space-y-4">
                  {/* Contact Information */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">معلومات الاتصال</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-slate-900">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-slate-700">{user.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Account Statistics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 text-center">
                      <ShoppingBag className="w-6 h-6 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold text-primary">{getUserOrdersCount(user.id)}</p>
                      <p className="text-xs text-primary">طلب</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center">
                      <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-900">{getUserTotalSpent(user.id).toFixed(0)}</p>
                      <p className="text-xs text-green-700">ج.م إجمالي</p>
                    </div>
                  </div>
                  
                  {/* Registration Info */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">معلومات الحساب</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">تاريخ التسجيل:</span>
                        <span className="font-medium">{new Date(user.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                      {user.lastLogin && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">آخر دخول:</span>
                          <span className="font-medium">{new Date(user.lastLogin).toLocaleDateString('ar-EG')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setViewUser(user); void logHistory({ section: 'users', action: 'view_opened', note: `Viewed user ${user.id}`, meta: { userId: user.id } }); }}
                      className="flex-1 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      عرض التفاصيل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditUser(user); setEditFirstName(user.firstName); setEditLastName(user.lastName); setEditPhone(user.phone || ''); void logHistory({ section: 'users', action: 'edit_opened', note: `Opened edit for user ${user.id}`, meta: { userId: user.id } }); }}
                      className="flex-1 text-xs"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      تعديل
                    </Button>
                    {(user.role === 'admin' && !isSuper(user.email)) && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openUserPermissions(user.id)}
                      className="flex-1 text-xs"
                    >
                      <Shield className="w-3 h-3 mr-1" />
                      الصلاحيات
                    </Button>
                    )}
                    <Button
                      size="sm"
                      variant={user.isActive ? "destructive" : "default"}
                      onClick={() => handleToggleUserStatus(user.id)}
                      className={user.isActive ? 'text-xs' : 'bg-green-600 hover:bg-green-700 text-xs'}
                    >
                      <Ban className="w-3 h-3 mr-1" />
                      {user.isActive ? 'حظر' : 'إلغاء الحظر'}
                    </Button>
                  </div>
                </div>
              </div>
            ))}
            {/* Mobile: Normal Users */}
            {normalUsers.length > 0 && (
              <div className="px-1 mt-6">
                <h3 className="text-sm font-bold text-primary mb-2">المستخدمون</h3>
              </div>
            )}
            {normalUsers.map((user) => (
              <div key={`user-m-${user.id || user.email}`} className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg overflow-hidden">
                {/* Mobile User Header */}
                <div className={`p-4 border-b border-slate-200/50 ${
                  user.role === 'admin' 
                    ? 'bg-gradient-to-r from-purple-50 to-purple-100' 
                    : user.isActive 
                      ? 'bg-gradient-to-r from-green-50 to-green-100'
                      : 'bg-gradient-to-r from-red-50 to-red-100'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-12 w-12 ring-2 ring-white shadow-lg">
                        <AvatarFallback className={`text-white font-bold ${
                          user.role === 'admin'
                            ? 'bg-gradient-to-br from-purple-500 to-purple-600'
                            : user.isActive
                              ? 'bg-gradient-to-br from-green-500 to-green-600'
                              : 'bg-gradient-to-br from-red-500 to-red-600'
                        }`}>
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{user.firstName} {user.lastName}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant={user.role === 'admin' ? 'default' : 'outline'}
                            className={user.role === 'admin' ? 'bg-purple-600 text-white text-xs' : 'border-primary/30 text-primary bg-primary/5 text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UsersIcon className="w-3 h-3" />}
                              <span>{user.role === 'admin' ? (isSuper(user.email) ? 'مدير' : 'مشرف') : 'عميل'}</span>
                            </div>
                          </Badge>
                          <Badge 
                            variant={user.isActive ? 'default' : 'destructive'}
                            className={user.isActive ? 'bg-green-600 text-white text-xs' : 'bg-red-600 text-white text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.isActive ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              <span>{user.isActive ? 'نشط' : 'محظور'}</span>
                            </div>
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg text-green-600">{getUserTotalSpent(user.id).toFixed(2)} ج.م</p>
                      <p className="text-xs text-slate-600">{getUserOrdersCount(user.id)} طلب</p>
                    </div>
                  </div>
                </div>
                {/* Mobile User Content */}
                <div className="p-4 space-y-4">
                  {/* Contact Information */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">معلومات الاتصال</h4>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-4 h-4 text-primary" />
                        <span className="text-sm font-medium text-slate-900">{user.email}</span>
                      </div>
                      {user.phone && (
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-green-600" />
                          <span className="text-sm text-slate-700">{user.phone}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Account Statistics */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-xl p-3 text-center">
                      <ShoppingBag className="w-6 h-6 text-primary mx-auto mb-1" />
                      <p className="text-lg font-bold text-primary">{getUserOrdersCount(user.id)}</p>
                      <p className="text-xs text-primary">طلب</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-3 text-center">
                      <TrendingUp className="w-6 h-6 text-green-600 mx-auto mb-1" />
                      <p className="text-lg font-bold text-green-900">{getUserTotalSpent(user.id).toFixed(0)}</p>
                      <p className="text-xs text-green-700">ج.م إجمالي</p>
                    </div>
                  </div>
                  {/* Registration Info */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <h4 className="font-semibold text-sm text-slate-700 mb-2">معلومات الحساب</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">تاريخ التسجيل:</span>
                        <span className="font-medium">{new Date(user.createdAt).toLocaleDateString('ar-EG')}</span>
                      </div>
                      {user.lastLogin && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600">آخر دخول:</span>
                          <span className="font-medium">{new Date(user.lastLogin).toLocaleDateString('ar-EG')}</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Action Buttons */}
                  <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setViewUser(user); void logHistory({ section: 'users', action: 'view_opened', note: `Viewed user ${user.id}`, meta: { userId: user.id } }); }}
                      className="flex-1 text-xs"
                    >
                      <Eye className="w-3 h-3 mr-1" />
                      عرض التفاصيل
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setEditUser(user); setEditFirstName(user.firstName); setEditLastName(user.lastName); setEditPhone(user.phone || ''); void logHistory({ section: 'users', action: 'edit_opened', note: `Opened edit for user ${user.id}`, meta: { userId: user.id } }); }}
                      className="flex-1 text-xs"
                    >
                      <Edit className="w-3 h-3 mr-1" />
                      تعديل
                    </Button>
                    {/* Normal users don't have permissions button */}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Desktop: Traditional Table Layout
        <Card className="bg-white/90 backdrop-blur-xl border-slate-200/50 shadow-2xl rounded-xl md:rounded-2xl overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-50 via-primary/5 to-secondary/5 border-b border-slate-200/50 p-4 md:p-6">
            <div className="flex items-center gap-3 md:gap-4">
              <div className="w-10 h-10 md:w-12 md:h-12 bg-gradient-to-br from-primary to-secondary rounded-xl md:rounded-2xl flex items-center justify-center shadow-lg">
                <UsersIcon className="w-5 h-5 md:w-6 md:h-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg md:text-2xl font-black text-slate-900 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                  جدول المستخدمين ({filteredUsers.length})
                </CardTitle>
                <p className="text-sm md:text-base text-slate-600 mt-1">إدارة شاملة لحسابات المستخدمين</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6">
            <div className="overflow-x-auto rounded-xl md:rounded-2xl border border-slate-200/50 shadow-lg">
              <div className="min-w-[900px] md:min-w-0"> {/* Ensure minimum width for mobile horizontal scroll */}
                <Table className="bg-white/50">
                  <TableHeader className="bg-gradient-to-r from-slate-100 via-primary/5 to-secondary/5">
                    <TableRow className="border-b-2 border-slate-200/50">
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300">
                        <div className="flex items-center justify-center gap-1 md:gap-2">
                          <UsersIcon className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                          <span>المستخدم</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300 hidden md:table-cell">
                        <div className="flex items-center justify-center gap-1 md:gap-2">
                          <Mail className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                          <span>البريد الإلكتروني</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300 hidden lg:table-cell">
                        <div className="flex items-center justify-center gap-1 md:gap-2">
                          <Calendar className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                          <span>تاريخ التسجيل</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300 hidden sm:table-cell">عدد الطلبات</TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300">
                        <div className="flex items-center justify-center gap-1 md:gap-2">
                          <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                          <span>إجمالي المشتريات</span>
                        </div>
                      </TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300">النوع</TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center border-r border-slate-300">الحالة</TableHead>
                      <TableHead className="font-bold text-slate-700 bg-gradient-to-r from-slate-100 to-primary/5 text-xs md:text-sm text-center">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="divide-y divide-slate-200">
                    {/* Admins group header */}
                    {adminUsers.length > 0 && (
                      <TableRow key="admins-header">
                        <TableCell colSpan={8} className="bg-purple-50 text-purple-700 font-bold">المديرين</TableCell>
                      </TableRow>
                    )}
                    {adminUsers.map((user) => (
                      <TableRow key={`admin-d-${user.id || user.email}`} className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary/30">
                        <TableCell>
                          <div className="flex items-center gap-2 md:gap-4">
                            <Avatar className="h-8 w-8 md:h-12 md:w-12 ring-2 ring-primary/20 shadow-lg">
                              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold text-sm md:text-lg">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <p className="font-bold text-slate-900 text-xs md:text-sm">{user.firstName} {user.lastName}</p>
                              <div className="flex items-center gap-1 md:gap-2 text-xs text-slate-500 md:hidden">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{user.email}</span>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2 text-xs text-slate-500">
                                <Phone className="w-3 h-3" />
                                <span>{user.phone}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-primary" />
                            <span className="font-medium text-slate-900">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-green-600" />
                              <p className="font-semibold text-slate-900 text-xs md:text-sm">
                                {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                              </p>
                            </div>
                            {user.lastLogin && (
                              <p className="text-xs text-slate-500">
                                آخر دخول: {new Date(user.lastLogin).toLocaleDateString('ar-EG')}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge 
                            variant="secondary" 
                            className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300 font-semibold text-xs"
                          >
                            {getUserOrdersCount(user.id)} طلب
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 md:gap-2">
                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                            <p className="font-bold text-sm md:text-lg text-green-600">
                              {getUserTotalSpent(user.id).toFixed(2)} ج.م
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.role === 'admin' ? 'default' : 'outline'}
                            className={user.role === 'admin' ? 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md text-xs' : 'border-primary/30 text-primary bg-primary/5 text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.role === 'admin' ? <Shield className="w-3 h-3" /> : <UsersIcon className="w-3 h-3" />}
                              <span>{user.role === 'admin' ? (user.email === superAdminEmail ? 'مدير' : 'مشرف') : 'عميل'}</span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.isActive ? 'default' : 'destructive'}
                            className={user.isActive ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md text-xs' : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.isActive ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              <span>{user.isActive ? 'نشط' : 'محظور'}</span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 md:gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setViewUser(user); void logHistory({ section: 'users', action: 'view_opened', note: `Viewed user ${user.id}`, meta: { userId: user.id } }); }}
                              className="hover:bg-primary/5 hover:border-primary/30 transition-colors p-1 md:p-2"
                            >
                              <Eye className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditUser(user); setEditFirstName(user.firstName); setEditLastName(user.lastName); setEditPhone(user.phone || ''); void logHistory({ section: 'users', action: 'edit_opened', note: `Opened edit for user ${user.id}`, meta: { userId: user.id } }); }}
                              className="hover:bg-amber-50 hover:border-amber-300 transition-colors p-1 md:p-2 hidden md:inline-flex"
                            >
                              <Edit className="w-3 h-3 md:w-4 md:h-4 text-amber-600" />
                            </Button>
                            {(user.role === 'admin' && !isSuper(user.email)) && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => openUserPermissions(user.id)}
                              className="hover:bg-purple-50 hover:border-purple-300 transition-colors p-1 md:p-2"
                            >
                              <Shield className="w-3 h-3 md:w-4 md:h-4 text-purple-600" />
                            </Button>
                            )}
                            <Button
                              size="sm"
                              variant={user.isActive ? "destructive" : "default"}
                              onClick={() => handleToggleUserStatus(user.id)}
                              className={user.isActive ? 'hover:bg-red-600 p-1 md:p-2' : 'bg-green-600 hover:bg-green-700 p-1 md:p-2'}
                            >
                              <Ban className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Normal users group header */}
                    {normalUsers.length > 0 && (
                      <TableRow key="users-header">
                        <TableCell colSpan={8} className="bg-primary/5 text-primary font-bold">المستخدمون</TableCell>
                      </TableRow>
                    )}
                    {normalUsers.map((user) => (
                      <TableRow key={`user-d-${user.id || user.email}`} className="hover:bg-gradient-to-r hover:from-primary/5 hover:to-secondary/5 transition-all duration-200 border-l-4 border-l-transparent hover:border-l-primary/30">
                        {/* same row cells as above */}
                        <TableCell>
                          <div className="flex items-center gap-2 md:gap-4">
                            <Avatar className="h-8 w-8 md:h-12 md:w-12 ring-2 ring-primary/20 shadow-lg">
                              <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold text-sm md:text-lg">
                                {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="space-y-1">
                              <p className="font-bold text-slate-900 text-xs md:text-sm">{user.firstName} {user.lastName}</p>
                              <div className="flex items-center gap-1 md:gap-2 text-xs text-slate-500 md:hidden">
                                <Mail className="w-3 h-3" />
                                <span className="truncate max-w-[120px]">{user.email}</span>
                              </div>
                              <div className="flex items-center gap-1 md:gap-2 text-xs text-slate-500">
                                <Phone className="w-3 h-3" />
                                <span>{user.phone}</span>
                              </div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-primary" />
                            <span className="font-medium text-slate-900">{user.email}</span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-green-600" />
                              <p className="font-semibold text-slate-900 text-xs md:text-sm">
                                {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                              </p>
                            </div>
                            {user.lastLogin && (
                              <p className="text-xs text-slate-500">
                                آخر دخول: {new Date(user.lastLogin).toLocaleDateString('ar-EG')}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <Badge 
                            variant="secondary" 
                            className="bg-gradient-to-r from-purple-100 to-purple-200 text-purple-800 border-purple-300 font-semibold text-xs"
                          >
                            {getUserOrdersCount(user.id)} طلب
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 md:gap-2">
                            <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-green-600" />
                            <p className="font-bold text-sm md:text-lg text-green-600">
                              {getUserTotalSpent(user.id).toFixed(2)} ج.م
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.role === 'admin' ? 'default' : 'outline'}
                            className={user.role === 'admin' ? (isSuper(user.email) ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-white shadow-md text-xs' : 'bg-gradient-to-r from-purple-600 to-purple-700 text-white shadow-md text-xs') : 'border-primary/30 text-primary bg-primary/5 text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.role === 'admin' ? (isSuper(user.email) ? <Crown className="w-3 h-3" /> : <Shield className="w-3 h-3" />) : <UsersIcon className="w-3 h-3" />}
                              <span>{user.role === 'admin' ? (isSuper(user.email) ? 'مدير' : 'مشرف') : 'عميل'}</span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge 
                            variant={user.isActive ? 'default' : 'destructive'}
                            className={user.isActive ? 'bg-gradient-to-r from-green-500 to-green-600 text-white shadow-md text-xs' : 'bg-gradient-to-r from-red-500 to-red-600 text-white shadow-md text-xs'}
                          >
                            <div className="flex items-center gap-1">
                              {user.isActive ? <CheckCircle className="w-3 h-3" /> : <Ban className="w-3 h-3" />}
                              <span>{user.isActive ? 'نشط' : 'محظور'}</span>
                            </div>
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 md:gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setViewUser(user); void logHistory({ section: 'users', action: 'view_opened', note: `Viewed user ${user.id}`, meta: { userId: user.id } }); }}
                              className="hover:bg-primary/5 hover:border-primary/30 transition-colors p-1 md:p-2"
                            >
                              <Eye className="w-3 h-3 md:w-4 md:h-4 text-primary" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => { setEditUser(user); setEditFirstName(user.firstName); setEditLastName(user.lastName); setEditPhone(user.phone || ''); void logHistory({ section: 'users', action: 'edit_opened', note: `Opened edit for user ${user.id}`, meta: { userId: user.id } }); }}
                              className="hover:bg-amber-50 hover:border-amber-300 transition-colors p-1 md:p-2 hidden md:inline-flex"
                            >
                              <Edit className="w-3 h-3 md:w-4 md:h-4 text-amber-600" />
                            </Button>
                            {/* Normal users: no permissions button */}
                            <Button
                              size="sm"
                              variant={user.isActive ? "destructive" : "default"}
                              onClick={() => handleToggleUserStatus(user.id)}
                              className={user.isActive ? 'hover:bg-red-600 p-1 md:p-2' : 'bg-green-600 hover:bg-green-700 p-1 md:p-2'}
                            >
                              <Ban className="w-3 h-3 md:w-4 md:h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </CardContent>
        </Card>
        )}
      </div>
      
      {/* View User Modal */}
      <Dialog open={!!viewUser} onOpenChange={(o) => { if (!o) setViewUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>بيانات المستخدم</DialogTitle>
            <DialogDescription className="sr-only">عرض تفاصيل المستخدم المحدد</DialogDescription>
          </DialogHeader>
          {viewUser && (
            <div className="space-y-2">
              <div className="font-semibold">{viewUser.firstName} {viewUser.lastName}</div>
              <div className="text-sm">البريد: {viewUser.email}</div>
              {viewUser.phone && <div className="text-sm">الهاتف: {viewUser.phone}</div>}
              <div className="text-sm">النوع: {viewUser.role === 'admin' ? (isSuper(viewUser.email) ? 'مدير' : 'مشرف') : 'عميل'}</div>
              <div className="text-sm">الحالة: {viewUser.isActive ? 'نشط' : 'محظور'}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewUser(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editUser} onOpenChange={(o) => { if (!o) setEditUser(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription className="sr-only">تعديل بيانات المستخدم المحدد وحفظ التغييرات</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="grid grid-cols-1 gap-3">
              <div>
                <Label htmlFor="e1">الاسم الأول</Label>
                <Input id="e1" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e2">اسم العائلة</Label>
                <Input id="e2" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="e3">الهاتف</Label>
                <Input id="e3" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>إلغاء</Button>
            <Button onClick={async () => {
              if (!editUser) return;
              try {
                await apiPatchJson<User, Partial<User>>(`/api/users/${editUser.id}`, { firstName: editFirstName, lastName: editLastName, phone: editPhone });
                setUsers(prev => prev.map(u => u.id === editUser.id ? { ...u, firstName: editFirstName, lastName: editLastName, phone: editPhone } : u));
                toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات المستخدم' });
                setEditUser(null);
              } catch (e) {
                toast({ title: 'فشل التحديث', description: (e as Error).message, variant: 'destructive' });
              }
            }}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      

    {/* Create Admin Modal */}
    <Dialog open={openCreateAdminModal} onOpenChange={setOpenCreateAdminModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>إنشاء/ترقية مستخدم إلى مشرف</DialogTitle>
          <DialogDescription className="sr-only">قم بإدخال بيانات المشرف وحفظها</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3">
          <div>
            <Label htmlFor="aemail">البريد الإلكتروني</Label>
            <Input id="aemail" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} placeholder="admin@example.com" />
          </div>
          <div>
            <Label htmlFor="apass">كلمة المرور</Label>
            <Input id="apass" type="password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} placeholder="********" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <Label htmlFor="afn">الاسم الأول</Label>
              <Input id="afn" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="aln">اسم العائلة</Label>
              <Input id="aln" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="aph">الهاتف</Label>
            <Input id="aph" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} placeholder="010..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenCreateAdminModal(false)}>إلغاء</Button>
          <Button onClick={handleCreateAdmin} className="bg-purple-600 hover:bg-purple-700">حفظ</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Assign Allowed Actions to User Modal */}
    <Dialog open={openAssignRoleModal} onOpenChange={(o) => { setOpenAssignRoleModal(o); if (!o) { setOpenedFromRow(false); } }}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {(() => {
              const u = users.find(us => us.id === targetUserId);
              return u
                ? <>تعيين الصلاحيات: <span className="font-bold">{u.firstName} {u.lastName}</span> — <span className="text-slate-600">{u.email}</span></>
                : <>تعيين الصلاحيات للمستخدم</>;
            })()}
          </DialogTitle>
          <DialogDescription className="sr-only">اختر المستخدم ثم حدد الصلاحيات المسموحة له</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-4">
          {/* Selected target summary */}
          {targetUserId && (
            <div className="rounded-md bg-primary/5 border border-primary/20 p-3 text-sm text-primary">
              <div className="font-semibold">المستخدم المحدد</div>
              <div className="mt-1">
                {(() => {
                  const u = users.find(us => us.id === targetUserId);
                  return u ? (
                    <span>{u.firstName} {u.lastName} — {u.email}</span>
                  ) : (
                    <span className="text-slate-600">تم اختيار معرف مستخدم</span>
                  );
                })()}
              </div>
            </div>
          )}
          {!openedFromRow && !targetUserId && (
            <div>
              <Label>اختر مستخدمًا</Label>
              <Select
                value={targetUserId}
                onValueChange={(val) => {
                  setTargetUserId(val);
                  const u = users.find(us => us.id === val);
                  setTargetEmail(u?.email || '');
                }}
              >
                <SelectTrigger className="h-10 bg-white/80 border-slate-200 shadow-md">
                  <SelectValue placeholder="اختر مستخدمًا" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter(u => u.role === 'admin' && !!u.id)
                    .map(u => (
                      <SelectItem key={`user-opt-${u.id}`} value={u.id}>
                        {u.firstName} {u.lastName} — {u.email}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="text-xs text-slate-500 mt-1">اختر مشرفًا لتعيين الصلاحيات.</div>
            </div>
          )}
          {/* Actions matrix: resources -> checkboxes of actions */}
          <div>
            <div className="font-semibold mb-2">اختر العمليات المسموحة</div>
            <div className="max-h-80 overflow-auto border rounded-md p-3 space-y-3">
              {resources.map((r) => {
                const selected = selectedResourceActions[r.name] || [];
                const allChecked = selected.length === r.actions.length && r.actions.length > 0;
                return (
                  <div key={r.name} className="border rounded p-2">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{r.name}</div>
                      <div className="flex items-center gap-2">
                        <Checkbox id={`all-${r.name}`} checked={allChecked} onCheckedChange={(v) => toggleAllActions(r.name, r.actions, !!v)} />
                        <Label htmlFor={`all-${r.name}`}>الكل</Label>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {r.actions.map((a) => (
                        <div key={`${r.name}-${a}`} className="flex items-center gap-2">
                          <Checkbox id={`${r.name}-${a}`} checked={selected.includes(a)} onCheckedChange={(v) => toggleAction(r.name, a, !!v)} />
                          <Label htmlFor={`${r.name}-${a}`}>{a}</Label>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              {!resources.length && (
                <div className="text-sm text-slate-500">لا توجد موارد متاحة أو ليس لديك صلاحية لعرضها.</div>
              )}
            </div>
            {/* Selection summary */}
            <div className="text-xs text-slate-600 mt-2">
              المختار: {Object.values(selectedResourceActions).reduce((acc, arr) => acc + (arr?.length || 0), 0)} عملية عبر {Object.keys(selectedResourceActions).length} مورد
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenAssignRoleModal(false)} disabled={savingPerms}>إلغاء</Button>
          <Button
            onClick={async () => {
              await handleAssignPermissions();
            }}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
            disabled={savingPerms || (!targetUserId && !targetEmail) || Object.values(selectedResourceActions).every(a => a.length === 0)}
          >
            {savingPerms ? 'جارٍ الحفظ...' : 'حفظ الصلاحيات'}
          </Button>
          {(!targetUserId && Object.values(selectedResourceActions).every(a => a.length === 0)) && (
            <div className="text-xs text-red-600 mt-2 mr-auto">اختر مستخدمًا وحدد عملية واحدة على الأقل.</div>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>

    </AdminLayout>
  );
};

export default AdminUsers;