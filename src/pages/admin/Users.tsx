import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { apiGet, apiPatchJson, apiPostJson } from '@/lib/api';
import { User, Order } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { logHistory } from '@/lib/history';
import useDeviceDetection from '@/hooks/useDeviceDetection';
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
  Mail,
  Phone,
  Calendar,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

function userIdOf(u: User & { _id?: string }): string {
  return String(u.id || u._id || '').trim();
}

/** API may return Mongo `_id` without `id`; normalize so PATCH routes and keys work. */
function normalizeUser(raw: Record<string, unknown>): User {
  const id = String(raw.id ?? raw._id ?? '');
  return {
    id,
    email: String(raw.email ?? ''),
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    phone: raw.phone != null ? String(raw.phone) : undefined,
    role: raw.role === 'admin' ? 'admin' : 'customer',
    isActive: raw.isActive !== false,
    createdAt: raw.createdAt ? String(raw.createdAt) : new Date().toISOString(),
    lastLogin: raw.lastLogin ? String(raw.lastLogin) : undefined,
  };
}

const AdminUsers = () => {
  const { toast } = useToast();
  const { isMobile } = useDeviceDetection();

  const [users, setUsers] = useState<User[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const [viewUser, setViewUser] = useState<User | null>(null);
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');

  const [openCreateAdminModal, setOpenCreateAdminModal] = useState(false);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminFirstName, setAdminFirstName] = useState('');
  const [adminLastName, setAdminLastName] = useState('');
  const [adminPhone, setAdminPhone] = useState('');
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [usersRes, ordersRes] = await Promise.all([
        apiGet<unknown>('/api/users?limit=500'),
        apiGet<unknown>('/api/orders?limit=500'),
      ]);
      if (usersRes.ok && Array.isArray((usersRes as { items?: unknown[] }).items)) {
        const items = (usersRes as { items: Record<string, unknown>[] }).items.map(normalizeUser);
        setUsers(items);
        void logHistory({
          section: 'users',
          action: 'page_loaded',
          note: 'Loaded users list',
          meta: { count: items.length },
        });
      } else {
        setUsers([]);
      }
      if (ordersRes.ok && Array.isArray((ordersRes as { items?: unknown[] }).items)) {
        setOrders(((ordersRes as { items: Order[] }).items) || []);
      } else {
        setOrders([]);
      }
    } catch {
      toast({ title: 'تعذر التحميل', description: 'تحقق من الاتصال وحاول مرة أخرى', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return users.filter((user) => {
      const fn = (user.firstName || '').toLowerCase();
      const ln = (user.lastName || '').toLowerCase();
      const em = (user.email || '').toLowerCase();
      const matchesSearch = !q || fn.includes(q) || ln.includes(q) || em.includes(q);
      const matchesRole = roleFilter === 'all' || user.role === roleFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && user.isActive) ||
        (statusFilter === 'inactive' && !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  const stats = useMemo(() => {
    const total = users.length;
    const active = users.filter((u) => u.isActive).length;
    const admins = users.filter((u) => u.role === 'admin').length;
    return {
      total,
      active,
      admins,
      activePct: total ? Math.round((active / total) * 100) : 0,
    };
  }, [users]);

  const orderCount = useCallback(
    (uid: string) => orders.filter((o) => String(o.userId) === String(uid)).length,
    [orders]
  );

  const orderSpent = useCallback(
    (uid: string) =>
      orders
        .filter((o) => String(o.userId) === String(uid))
        .reduce((s, o) => s + (Number(o.total) || 0), 0),
    [orders]
  );

  const handleToggleUserStatus = async (user: User & { _id?: string }) => {
    const uid = userIdOf(user);
    if (!uid) {
      toast({ title: 'خطأ', description: 'معرّف المستخدم غير صالح', variant: 'destructive' });
      return;
    }
    const nextActive = !user.isActive;
    const prevUsers = users;
    setUsers((prev) =>
      prev.map((u) => (userIdOf(u) === uid ? { ...u, isActive: nextActive } : u))
    );
    try {
      const res = await apiPatchJson<unknown, Partial<User>>(`/api/users/${uid}`, { isActive: nextActive });
      if (!res.ok) throw new Error('error' in res ? String(res.error) : 'فشل التحديث');
      toast({
        title: nextActive ? 'تم إلغاء الحظر' : 'تم الحظر',
        description: nextActive ? 'أصبح الحساب نشطاً' : 'تم تعطيل الحساب',
      });
      void logHistory({
        section: 'users',
        action: 'status_toggled',
        note: `User ${uid} isActive=${nextActive}`,
        meta: { userId: uid, isActive: nextActive },
      });
    } catch {
      setUsers(prevUsers);
      toast({ title: 'فشل التحديث', description: 'لم يُحفظ التغيير', variant: 'destructive' });
    }
  };

  const handleExport = () => {
    const csvContent = [
      ['الاسم', 'البريد', 'الهاتف', 'النوع', 'الحالة', 'الطلبات', 'الإنفاق'].join(','),
      ...filteredUsers.map((user) =>
        [
          `"${(user.firstName + ' ' + user.lastName).trim()}"`,
          user.email,
          user.phone || '',
          user.role === 'admin' ? 'مدير' : 'عميل',
          user.isActive ? 'نشط' : 'معطّل',
          orderCount(userIdOf(user)),
          orderSpent(userIdOf(user)).toFixed(2),
        ].join(',')
      ),
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'users.csv';
    a.click();
    URL.revokeObjectURL(url);
    void logHistory({
      section: 'users',
      action: 'export_downloaded',
      note: 'Exported users CSV',
      meta: { count: filteredUsers.length },
    });
  };

  const handleCreateAdmin = async () => {
    if (!adminEmail.trim() || !adminPassword) {
      toast({ title: 'بيانات ناقصة', description: 'البريد وكلمة المرور مطلوبان', variant: 'destructive' });
      return;
    }
    setCreatingAdmin(true);
    try {
      const res = await apiPostJson<
        { user: { id: string; email: string } },
        { email: string; password: string; firstName?: string; lastName?: string; phone?: string }
      >('/api/admin/users', {
        email: adminEmail.trim(),
        password: adminPassword,
        firstName: adminFirstName.trim() || undefined,
        lastName: adminLastName.trim() || undefined,
        phone: adminPhone.trim() || undefined,
      });
      if (!res.ok) throw new Error('error' in res ? String(res.error) : 'فشل الإنشاء');
      toast({ title: 'تم', description: 'تم إنشاء أو ترقية حساب المشرف' });
      setOpenCreateAdminModal(false);
      setAdminEmail('');
      setAdminPassword('');
      setAdminFirstName('');
      setAdminLastName('');
      setAdminPhone('');
      await loadData();
    } catch (e) {
      toast({
        title: 'فشل',
        description: e instanceof Error ? e.message : 'تعذر إنشاء المشرف',
        variant: 'destructive',
      });
    } finally {
      setCreatingAdmin(false);
    }
  };

  const openEdit = (u: User & { _id?: string }) => {
    setEditUser(u);
    setEditFirstName(u.firstName || '');
    setEditLastName(u.lastName || '');
    setEditPhone(u.phone || '');
    void logHistory({
      section: 'users',
      action: 'edit_opened',
      note: `Opened edit for ${userIdOf(u)}`,
      meta: { userId: userIdOf(u) },
    });
  };

  const saveEdit = async () => {
    if (!editUser) return;
    const uid = userIdOf(editUser);
    if (!uid) return;
    try {
      const res = await apiPatchJson<unknown, Partial<User>>(`/api/users/${uid}`, {
        firstName: editFirstName.trim(),
        lastName: editLastName.trim(),
        phone: editPhone.trim(),
      });
      if (!res.ok) throw new Error('error' in res ? String(res.error) : 'فشل الحفظ');
      setUsers((prev) =>
        prev.map((u) =>
          userIdOf(u) === uid
            ? { ...u, firstName: editFirstName.trim(), lastName: editLastName.trim(), phone: editPhone.trim() }
            : u
        )
      );
      toast({ title: 'تم الحفظ', description: 'تم تحديث بيانات المستخدم' });
      setEditUser(null);
    } catch (e) {
      toast({
        title: 'فشل الحفظ',
        description: e instanceof Error ? e.message : 'خطأ',
        variant: 'destructive',
      });
    }
  };

  const UserActions = ({ u }: { u: User & { _id?: string } }) => {
    const uid = userIdOf(u);
    return (
      <div className="flex flex-wrap items-center gap-1">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => {
            setViewUser(u);
            void logHistory({
              section: 'users',
              action: 'view_opened',
              note: `View ${uid}`,
              meta: { userId: uid },
            });
          }}
        >
          <Eye className="h-3.5 w-3.5 ms-0 me-1" />
          عرض
        </Button>
        <Button type="button" size="sm" variant="outline" className="h-8" onClick={() => openEdit(u)}>
          <Edit className="h-3.5 w-3.5 ms-0 me-1" />
          تعديل
        </Button>
        <Button
          type="button"
          size="sm"
          variant={u.isActive ? 'destructive' : 'default'}
          className="h-8"
          onClick={() => void handleToggleUserStatus(u)}
        >
          <Ban className="h-3.5 w-3.5 ms-0 me-1" />
          {u.isActive ? 'حظر' : 'إلغاء حظر'}
        </Button>
      </div>
    );
  };

  return (
    <AdminLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 md:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">المستخدمون</h1>
            <p className="mt-1 text-sm text-slate-600">إدارة العملاء والمشرفين — وصول كامل لكل المشرفين</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}>
              تحديث
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={handleExport} disabled={!filteredUsers.length}>
              <Download className="h-4 w-4 ms-0 me-2" />
              تصدير CSV
            </Button>
            <Button
              type="button"
              size="sm"
              className="bg-primary"
              onClick={() => setOpenCreateAdminModal(true)}
            >
              <UserPlus className="h-4 w-4 ms-0 me-2" />
              إضافة مشرف
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">إجمالي الحسابات</p>
                <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
              </div>
              <div className="rounded-xl bg-primary/10 p-3 text-primary">
                <UsersIcon className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">نشط</p>
                <p className="text-2xl font-bold text-emerald-700">{stats.active}</p>
                <p className="text-xs text-slate-500">{stats.activePct}% من الإجمالي</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 p-3 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="flex items-center justify-between p-4">
              <div>
                <p className="text-xs font-medium text-slate-500">مشرفون</p>
                <p className="text-2xl font-bold text-violet-700">{stats.admins}</p>
              </div>
              <div className="rounded-xl bg-violet-500/10 p-3 text-violet-600">
                <Shield className="h-5 w-5" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-200/80 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">تصفية وبحث</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="بحث بالاسم أو البريد..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 pe-10"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-10 w-full md:w-[160px]">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأنواع</SelectItem>
                <SelectItem value="customer">عملاء</SelectItem>
                <SelectItem value="admin">مشرفون</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-10 w-full md:w-[160px]">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">معطّل</SelectItem>
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {loading ? (
          <div className="flex justify-center py-20 text-slate-500">جارٍ التحميل…</div>
        ) : isMobile ? (
          <div className="space-y-3">
            {filteredUsers.map((user) => {
              const uid = userIdOf(user);
              return (
                <Card key={uid || user.email} className="overflow-hidden border-slate-200/80 shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Avatar className="h-11 w-11 ring-2 ring-slate-100">
                        <AvatarFallback
                          className={cn(
                            'text-sm font-semibold text-white',
                            user.role === 'admin' ? 'bg-violet-600' : user.isActive ? 'bg-primary' : 'bg-slate-500'
                          )}
                        >
                          {(user.firstName?.[0] || '?').toUpperCase()}
                          {(user.lastName?.[0] || '').toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-900">
                            {user.firstName} {user.lastName}
                          </span>
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className="text-xs">
                            {user.role === 'admin' ? 'مشرف' : 'عميل'}
                          </Badge>
                          <Badge variant={user.isActive ? 'outline' : 'destructive'} className="text-xs">
                            {user.isActive ? 'نشط' : 'معطّل'}
                          </Badge>
                        </div>
                        <div className="mt-2 space-y-1 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Mail className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">{user.email}</span>
                          </div>
                          {user.phone ? (
                            <div className="flex items-center gap-2">
                              <Phone className="h-3.5 w-3.5 shrink-0" />
                              {user.phone}
                            </div>
                          ) : null}
                          <div className="flex gap-4 pt-1 text-xs">
                            <span className="flex items-center gap-1">
                              <ShoppingBag className="h-3.5 w-3.5" />
                              {orderCount(uid)} طلب
                            </span>
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3.5 w-3.5" />
                              {orderSpent(uid).toFixed(0)} ج.م
                            </span>
                          </div>
                        </div>
                        <div className="mt-3 border-t border-slate-100 pt-3">
                          <UserActions u={user} />
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
            {!filteredUsers.length ? (
              <p className="py-12 text-center text-slate-500">لا توجد نتائج مطابقة.</p>
            ) : null}
          </div>
        ) : (
          <Card className="border-slate-200/80 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80 hover:bg-slate-50/80">
                      <TableHead className="font-semibold">المستخدم</TableHead>
                      <TableHead className="font-semibold">البريد</TableHead>
                      <TableHead className="hidden font-semibold lg:table-cell">التسجيل</TableHead>
                      <TableHead className="text-center font-semibold">طلبات</TableHead>
                      <TableHead className="text-center font-semibold">الإنفاق</TableHead>
                      <TableHead className="font-semibold">النوع</TableHead>
                      <TableHead className="font-semibold">الحالة</TableHead>
                      <TableHead className="text-end font-semibold">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers.map((user) => {
                      const uid = userIdOf(user);
                      return (
                        <TableRow key={uid || user.email} className="border-slate-100">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-9 w-9">
                                <AvatarFallback
                                  className={cn(
                                    'text-xs font-semibold text-white',
                                    user.role === 'admin' ? 'bg-violet-600' : 'bg-primary'
                                  )}
                                >
                                  {(user.firstName?.[0] || '?').toUpperCase()}
                                  {(user.lastName?.[0] || '').toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium text-slate-900">
                                  {user.firstName} {user.lastName}
                                </div>
                                {user.phone ? (
                                  <div className="text-xs text-slate-500">{user.phone}</div>
                                ) : null}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm">{user.email}</TableCell>
                          <TableCell className="hidden text-sm text-slate-600 lg:table-cell">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {new Date(user.createdAt).toLocaleDateString('ar-EG')}
                            </div>
                          </TableCell>
                          <TableCell className="text-center text-sm">{orderCount(uid)}</TableCell>
                          <TableCell className="text-center text-sm font-medium text-emerald-700">
                            {orderSpent(uid).toFixed(2)}
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.role === 'admin' ? 'default' : 'secondary'}>
                              {user.role === 'admin' ? 'مشرف' : 'عميل'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={user.isActive ? 'outline' : 'destructive'}>
                              {user.isActive ? 'نشط' : 'معطّل'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-end">
                            <UserActions u={user} />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {!filteredUsers.length ? (
                <p className="py-12 text-center text-slate-500">لا توجد نتائج مطابقة.</p>
              ) : null}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!viewUser} onOpenChange={(o) => !o && setViewUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل المستخدم</DialogTitle>
            <DialogDescription className="sr-only">عرض بيانات المستخدم</DialogDescription>
          </DialogHeader>
          {viewUser ? (
            <div className="space-y-2 text-sm">
              <p className="text-lg font-semibold">
                {viewUser.firstName} {viewUser.lastName}
              </p>
              <p>
                <span className="text-slate-500">البريد: </span>
                {viewUser.email}
              </p>
              {viewUser.phone ? (
                <p>
                  <span className="text-slate-500">الهاتف: </span>
                  {viewUser.phone}
                </p>
              ) : null}
              <p>
                <span className="text-slate-500">النوع: </span>
                {viewUser.role === 'admin' ? 'مشرف' : 'عميل'}
              </p>
              <p>
                <span className="text-slate-500">الحالة: </span>
                {viewUser.isActive ? 'نشط' : 'معطّل'}
              </p>
              <p>
                <span className="text-slate-500">الطلبات: </span>
                {orderCount(userIdOf(viewUser))}
              </p>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setViewUser(null)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل المستخدم</DialogTitle>
            <DialogDescription className="sr-only">تحديث الاسم والهاتف</DialogDescription>
          </DialogHeader>
          {editUser ? (
            <div className="grid gap-3">
              <div>
                <Label htmlFor="ufn">الاسم الأول</Label>
                <Input id="ufn" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="uln">اسم العائلة</Label>
                <Input id="uln" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="uph">الهاتف</Label>
                <Input id="uph" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} />
              </div>
            </div>
          ) : null}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
              إلغاء
            </Button>
            <Button type="button" onClick={() => void saveEdit()}>
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={openCreateAdminModal} onOpenChange={setOpenCreateAdminModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة مشرف</DialogTitle>
            <DialogDescription>إنشاء حساب بصلاحية مشرف في لوحة التحكم</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="ademail">البريد الإلكتروني</Label>
              <Input
                id="ademail"
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <Label htmlFor="adpass">كلمة المرور</Label>
              <Input
                id="adpass"
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="adfn">الاسم الأول</Label>
                <Input id="adfn" value={adminFirstName} onChange={(e) => setAdminFirstName(e.target.value)} />
              </div>
              <div>
                <Label htmlFor="adln">اسم العائلة</Label>
                <Input id="adln" value={adminLastName} onChange={(e) => setAdminLastName(e.target.value)} />
              </div>
            </div>
            <div>
              <Label htmlFor="adph">الهاتف</Label>
              <Input id="adph" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpenCreateAdminModal(false)}>
              إلغاء
            </Button>
            <Button type="button" disabled={creatingAdmin} onClick={() => void handleCreateAdmin()}>
              {creatingAdmin ? 'جارٍ الحفظ…' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminUsers;
