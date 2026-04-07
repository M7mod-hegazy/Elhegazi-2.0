import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  Menu,
  User,
  LogOut,
  Settings,
  Activity,
  Shield,
  Clock,
  BarChart3,
  Globe,
  ArrowUpRight,
} from 'lucide-react';
import { useDualAuth } from '@/hooks/useDualAuth';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { User as UserType } from '@/types';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPostJson } from '@/lib/api';

interface AdminHeaderProps {
  user: UserType | null;
  onToggleSidebar?: () => void;
}

type HistoryItem = {
  _id: string;
  section: string;
  action: string;
  note?: string;
  details?: string;
  userEmail?: string;
  meta?: { username?: string; keys?: unknown[]; [key: string]: unknown };
  level?: 'info' | 'warning' | 'critical';
  createdAt: string;
};

const prettifyToken = (value?: string) => {
  if (!value) return '';
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
};

const sectionLabel = (value?: string) => {
  const key = String(value || '').toLowerCase();
  const map: Record<string, string> = {
    admin: 'الإدارة',
    orders: 'الطلبات',
    products: 'المنتجات',
    categories: 'الفئات',
    users: 'المستخدمون',
    settings: 'الإعدادات',
    reports: 'التقارير',
    profit: 'الأرباح',
    'profit settings': 'إعدادات الأرباح',
    'profit-settings': 'إعدادات الأرباح',
  };
  return map[key] || 'قسم النظام';
};

const actionLabel = (value?: string) => {
  const key = String(value || '').toLowerCase();
  const map: Record<string, string> = {
    page_view: 'تم فتح الصفحة',
    sidebar_toggled: 'تم تغيير حالة الشريط الجانبي',
    mobile_menu_toggled: 'تم تغيير قائمة الجوال',
    created: 'تم الإنشاء',
    updated: 'تم التحديث',
    deleted: 'تم الحذف',
    exported: 'تم التصدير',
    update: 'تم التحديث',
    delete: 'تم الحذف',
  };
  return map[key] || 'تم تنفيذ إجراء';
};

const changedKeyLabel = (key: string) => {
  const map: Record<string, string> = {
    globalBranches: 'الفروع العامة',
    globalExpenses: 'المصروفات العامة',
    shareholders: 'المساهمون',
    shareHistory: 'سجل الحصص',
    expenseTypes: 'أنواع المصروفات',
    username: 'اسم المستخدم',
  };
  return map[key] || '';
};

const arabicChangeList = (keys: unknown) => {
  if (!Array.isArray(keys) || keys.length === 0) return '';
  const mapped = keys
    .map((k) => changedKeyLabel(String(k)))
    .filter(Boolean);
  if (!mapped.length) return '';
  const shown = mapped.slice(0, 4);
  const extra = mapped.length > 4 ? ` (+${mapped.length - 4})` : '';
  return `${shown.join('، ')}${extra}`;
};

const isArabicText = (value?: string) => /[\u0600-\u06FF]/.test(String(value || ''));

const buildArabicSummary = (item: HistoryItem) => {
  const section = String(item.section || '').toLowerCase();
  const action = String(item.action || '').toLowerCase();
  const note = String(item.note || '').trim();
  const keysText = arabicChangeList(item.meta?.keys);

  if (note && isArabicText(note)) return note;

  if (section.includes('profit') && (action.includes('update') || note.toLowerCase().includes('updated profit settings'))) {
    return keysText
      ? `تم تحديث إعدادات الأرباح. العناصر المتغيرة: ${keysText}.`
      : 'تم تحديث إعدادات الأرباح.';
  }

  if (action === 'page_view') {
    return `تم فتح صفحة ${pageLabel(resolveHistoryTarget(item))}.`;
  }

  if (action === 'mobile_menu_toggled') {
    return note.toLowerCase().includes('closed')
      ? 'تم إغلاق قائمة الجوال.'
      : 'تم فتح قائمة الجوال.';
  }

  if (action === 'sidebar_toggled') {
    return note.toLowerCase().includes('collapsed')
      ? 'تم طي الشريط الجانبي.'
      : 'تم توسيع الشريط الجانبي.';
  }

  if (action.includes('create')) return `تم إنشاء عنصر جديد في ${sectionLabel(item.section)}.`;
  if (action.includes('delete')) return `تم حذف عنصر من ${sectionLabel(item.section)}.`;
  if (action.includes('update')) {
    return keysText
      ? `تم تحديث ${sectionLabel(item.section)}. العناصر المتغيرة: ${keysText}.`
      : `تم تحديث بيانات ${sectionLabel(item.section)}.`;
  }

  return `حدث نشاط جديد في ${sectionLabel(item.section)}.`;
};

const messageEmoji = (item: HistoryItem) => {
  const action = String(item.action || '').toLowerCase();
  if (item.level === 'critical') return '🚨';
  if (action.includes('delete')) return '🗑️';
  if (action.includes('create')) return '🆕';
  if (action.includes('update')) return '✏️';
  if (action === 'page_view') return '👀';
  return '📌';
};

const notificationTitle = (item: HistoryItem) => `${sectionLabel(item.section)} • ${actionLabel(item.action)}`;

const pageLabel = (path: string) => {
  if (path.startsWith('/admin/orders') || path.startsWith('/admin/order/')) return 'الطلبات';
  if (path.startsWith('/admin/products-3d')) return 'نماذج 3D';
  if (path.startsWith('/admin/products')) return 'المنتجات';
  if (path.startsWith('/admin/categories')) return 'الفئات';
  if (path.startsWith('/admin/users')) return 'المستخدمون';
  if (path.startsWith('/admin/locations')) return 'المواقع';
  if (path.startsWith('/admin/qr-codes')) return 'رموز QR';
  if (path.startsWith('/admin/settings')) return 'الإعدادات';
  if (path.startsWith('/admin/profit')) return 'الأرباح';
  if (path.startsWith('/admin/dashboard')) return 'لوحة التحكم';
  if (path.startsWith('/admin/history')) return 'سجل النشاط';
  return path;
};

const extractAdminPath = (...candidates: Array<unknown>) => {
  for (const candidate of candidates) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    const match = candidate.match(/\/admin\/[a-z0-9\-\/]*/i);
    if (match?.[0]) return match[0].replace(/[.,;:!?]+$/, '');
  }
  return '';
};

const resolveHistoryTarget = (item: HistoryItem) => {
  const textPath = extractAdminPath(
    item.note,
    item.details,
    item.meta?.path,
    item.meta?.url,
    item.meta?.route
  );
  if (textPath) return textPath;

  const section = String(item.section || '').toLowerCase();
  const action = String(item.action || '').toLowerCase();
  const note = String(item.note || '').toLowerCase();
  const mixed = `${section} ${action} ${note}`;

  if (mixed.includes('products') && mixed.includes('3d')) return '/admin/products-3d';
  if (mixed.includes('order')) return '/admin/orders';
  if (mixed.includes('product')) return '/admin/products';
  if (mixed.includes('categor')) return '/admin/categories';
  if (mixed.includes('user')) return '/admin/users';
  if (mixed.includes('location')) return '/admin/locations';
  if (mixed.includes('qr')) return '/admin/qr-codes';
  if (mixed.includes('profit') || mixed.includes('report')) return '/admin/profit';
  if (mixed.includes('setting')) return '/admin/settings';
  if (mixed.includes('dashboard')) return '/admin/dashboard';
  return '/admin/history';
};

const notificationMessage = (item: HistoryItem) => {
  return `${messageEmoji(item)} ${buildArabicSummary(item)}`;
};

const timeAgo = (iso: string) => {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'الآن';
  if (m < 60) return `${m} دقيقة`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ساعة`;
  const days = Math.floor(h / 24);
  return `${days} يوم`;
};

const AdminHeader = ({ user, onToggleSidebar }: AdminHeaderProps) => {
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HistoryItem[]>([]);

  const { logout, isAuthenticated, isAdminAuthenticated, user: authUser, adminUser } = useDualAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const unreadCount = notifications.length;

  const loadNotifications = useCallback(async () => {
    try {
      const res = await apiGet<HistoryItem>('/api/history?limit=10');
      if (res.ok) setNotifications(res.items || []);
    } catch (err) {
      console.error('Failed to load history notifications', err);
    }
  }, []);

  const handleLogout = () => {
    logout();
    toast({
      title: 'تم تسجيل الخروج',
      description: 'تم تسجيل الخروج بنجاح',
    });
    window.location.href = '/admin/login';
  };

  const handleMarkAllAsRead = async () => {
    try {
      const userId = adminUser?.id || authUser?.id;
      await apiPostJson('/api/history/mark-read', userId ? { userId } : {});
      setNotifications([]);
      toast({ title: 'تم التعليم كمقروء', description: 'تم تحديث الإشعارات بنجاح' });
    } catch (err) {
      console.error('Failed to mark history as read', err);
      toast({ title: 'تعذر التعليم كمقروء', description: 'حاول مرة أخرى لاحقًا', variant: 'destructive' });
    }
  };

  useEffect(() => {
    if (!isAuthenticated && !isAdminAuthenticated) return;

    let cancelled = false;
    const runLoad = async () => {
      try {
        const res = await apiGet<HistoryItem>('/api/history?limit=10');
        if (!cancelled && res.ok) setNotifications(res.items || []);
      } catch (err) {
        console.error('Failed to load history notifications', err);
      }
    };

    void runLoad();
    const id = setInterval(runLoad, 60_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [isAuthenticated, isAdminAuthenticated]);

  return (
    <header className="h-16 sm:h-20 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 relative z-50 shadow-sm transition-colors duration-300">
      <div className="flex items-center gap-3 sm:gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden w-10 h-10 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground transition-all"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5 text-foreground" />
        </Button>

        <div className="flex items-center gap-3">
          <div className="hidden sm:block">
            <h1 className="text-lg sm:text-xl font-black text-foreground tracking-tight underline decoration-primary decoration-2 underline-offset-4">نظام التحكم</h1>
            <p className="text-[10px] sm:text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-70">ADMINISTRATION PANEL</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="group w-10 h-10 rounded-xl border border-border/70 bg-gradient-to-b from-muted/70 to-muted/40 hover:from-primary/10 hover:to-primary/5 hover:border-primary/30 hover:text-primary relative transition-all shadow-sm hover:shadow-md"
              >
                <Bell className="w-[18px] h-[18px] transition-transform duration-200 group-hover:scale-110" />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-primary rounded-full ring-2 ring-card animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>

            <DropdownMenuContent className="w-80 bg-card border border-border shadow-xl backdrop-blur-md rounded-2xl p-0 overflow-hidden" align="end">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">الإشعارات</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="h-7 px-3 rounded-full text-[11px] font-bold border border-primary/25 bg-primary/5 text-primary hover:bg-primary/12 hover:border-primary/40 transition-all"
                    >
                      تحديد الكل كمقروء
                    </Button>
                  )}
                </div>
              </div>

              <div className="max-h-80 overflow-y-auto">
                {notifications.length > 0 ? (
                  notifications.map((h) => (
                    <div
                      key={h._id}
                      className="mx-2 my-2 p-3 rounded-xl border border-transparent hover:border-primary/20 hover:bg-primary/5 transition-all cursor-pointer"
                      onClick={() => {
                        setIsNotificationsOpen(false);
                        navigate(resolveHistoryTarget(h));
                      }}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={`p-2 rounded-lg shrink-0 ${
                            h.level === 'critical'
                              ? 'bg-red-100 text-red-600'
                              : h.level === 'warning'
                                ? 'bg-orange-100 text-orange-600'
                                : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {h.level === 'critical' ? (
                            <Shield className="w-4 h-4" />
                          ) : h.level === 'warning' ? (
                            <Activity className="w-4 h-4" />
                          ) : (
                            <BarChart3 className="w-4 h-4" />
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{notificationTitle(h)}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-5">{notificationMessage(h)}</p>
                          <div className="flex items-center justify-between mt-2 gap-2">
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">{timeAgo(h.createdAt)}</span>
                            </div>
                            <button
                              type="button"
                              className="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:text-primary/80"
                              onClick={(e) => {
                                e.stopPropagation();
                                setIsNotificationsOpen(false);
                                navigate(resolveHistoryTarget(h));
                              }}
                            >
                              فتح
                              <ArrowUpRight className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">لا توجد إشعارات جديدة</div>
                )}
              </div>

              <div className="p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-primary hover:bg-primary/5 text-xs font-bold"
                  onClick={() => {
                    setIsNotificationsOpen(false);
                    void loadNotifications();
                    navigate('/admin/history');
                  }}
                >
                  عرض السجل كاملًا
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate('/')}
            className="flex items-center gap-2 h-10 rounded-xl border-border bg-background hover:bg-muted text-foreground transition-all px-4 shadow-sm"
          >
            <Globe className="w-4 h-4 text-primary" />
            <span className="font-bold text-xs sm:text-sm">الموقع</span>
          </Button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 sm:h-12 rounded-xl bg-muted/30 hover:bg-muted/50 px-2 sm:px-4 border border-border transition-all">
              <div className="flex items-center gap-2 sm:gap-3">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8 ring-1 ring-border">
                  <AvatarFallback className="bg-primary text-primary-foreground font-bold text-xs sm:text-sm">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden lg:block text-right">
                  <p className="text-sm font-black text-foreground">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-[10px] text-muted-foreground font-bold">Admin Panel</p>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>

          <DropdownMenuContent className="w-64 bg-card border border-border shadow-xl backdrop-blur-md" align="end">
            <DropdownMenuLabel className="font-normal p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-primary text-primary-foreground font-black">
                    {user?.firstName?.charAt(0)}{user?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <p className="text-sm font-black text-foreground">{user?.firstName} {user?.lastName}</p>
                  <p className="text-xs text-muted-foreground truncate max-w-[150px]">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem className="p-3 cursor-pointer hover:bg-muted" onClick={() => navigate('/admin/profile')}>
              <User className="mr-3 h-4 w-4 text-primary" />
              <span className="font-bold text-sm">الملف الشخصي</span>
            </DropdownMenuItem>

            <DropdownMenuItem className="p-3 cursor-pointer hover:bg-muted" onClick={() => navigate('/admin/settings')}>
              <Settings className="mr-3 h-4 w-4 text-primary" />
              <span className="font-bold text-sm">الإعدادات</span>
            </DropdownMenuItem>

            <DropdownMenuSeparator className="bg-border" />

            <DropdownMenuItem onClick={handleLogout} className="p-3 cursor-pointer hover:bg-red-50 text-red-600 transition-colors">
              <LogOut className="mr-3 h-4 w-4" />
              <span className="font-black text-sm">تسجيل الخروج</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};

export default AdminHeader;
