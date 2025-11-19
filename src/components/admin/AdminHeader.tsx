import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, 
  Menu, 
  User, 
  LogOut, 
  Settings, 
  ChevronDown,
  Search,
  HelpCircle,
  Monitor,
  Moon,
  Sun,
  Activity,
  Shield,
  Clock,
  BarChart3
} from 'lucide-react';
import { useDualAuth } from '@/hooks/useDualAuth';
import Logo from '@/components/common/Logo';
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
import { Badge } from '@/components/ui/badge';
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
  meta?: { username?: string };
  level?: 'info' | 'warning' | 'critical';
  createdAt: string;
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
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HistoryItem[]>([]);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { logout, isAuthenticated, token, user: authUser } = useDualAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const unreadCount = notifications.length; // treat fetched important items as unread badges

  const handleLogout = () => {
    logout();
    toast({
      title: "تم تسجيل الخروج",
      description: "تم تسجيل الخروج بنجاح",
    });
    // Force page reload to clear all state
    window.location.href = '/admin/login';
  };

  const handleMarkAllAsRead = async () => {
    try {
      // Body can be empty; server reads x-user-id header injected by api wrapper
      await apiPostJson('/api/history/mark-read', {});
      setNotifications([]);
      toast({ title: 'تم التعليم كمقروء', description: 'تم تحديث حالة السجل بنجاح' });
    } catch (err) {
      console.error('Failed to mark history as read', err);
      toast({ title: 'تعذر التعليم كمقروء', description: 'حاول مرة أخرى لاحقًا', variant: 'destructive' });
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
    // In a real app, you'd persist this to localStorage and apply to document
    toast({
      title: isDarkMode ? "تم التبديل للوضع الفاتح" : "تم التبديل للوضع الداكن",
      description: "سيتم تطبيق الوضع الجديد قريباً",
    });
  };

  // Load history as notifications (important only) when authenticated
  useEffect(() => {
    if (!isAuthenticated || !authUser) return; // avoid 401s before auth is ready
    let cancelled = false;
    const load = async () => {
      try {
        const res = await apiGet<HistoryItem>('/api/history?important=true&limit=10');
        if (!cancelled && res.ok) setNotifications(res.items || []);
      } catch (err) {
        console.error('Failed to load history notifications', err);
      }
    };
    load();
    const id = setInterval(load, 60_000);
    return () => { cancelled = true; clearInterval(id); };
  }, [isAuthenticated, token, authUser?.id]);

  // Keyboard shortcut for search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(!isSearchOpen);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSearchOpen]);

  return (
    <header className="h-16 sm:h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 flex items-center justify-between px-4 sm:px-6 lg:px-8 relative z-10 shadow-sm">
      {/* Left Section */}
      <div className="flex items-center gap-3 sm:gap-6">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700"
          onClick={onToggleSidebar}
        >
          <Menu className="w-5 h-5" />
        </Button>
        
        <div className="flex items-center gap-3">
          <Logo size="md" />
          <div className="hidden sm:block">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900">نظام إدارة المتجر</h1>
            <p className="text-xs sm:text-sm text-slate-500">لوحة التحكم الإدارية</p>
          </div>
        </div>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Search - Show on small screens, hide on medium+ */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="sm:hidden w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300"
        >
          <Search className="w-4 h-4" />
        </Button>
        
        {/* Search - Hide on small screens, show on medium+ */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          className="hidden sm:flex w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300"
        >
          <Search className="w-5 h-5" />
        </Button>

        {/* Enhanced Notifications */}
        <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 relative transition-all duration-300"
            >
              <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -top-1 -right-1 h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center p-0 bg-gradient-to-r from-red-500 to-red-600 text-white text-xs border-2 border-white">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-72 sm:w-80 bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-xl" align="end">
            <div className="p-4 border-b border-slate-200/50">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900">السجل</h3>
                {unreadCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleMarkAllAsRead}
                    className="text-xs text-primary hover:text-primary"
                  >
                    تحديد الكل كمقروء
                  </Button>
                )}
              </div>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((h) => (
                <div
                  key={h._id}
                  className={`p-4 border-b border-slate-100/50 hover:bg-primary/5 transition-colors ${
                    'bg-primary/5'
                  }`}
                  onClick={() => { setIsNotificationsOpen(false); navigate('/admin/history'); }}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${
                      h.level === 'critical' ? 'bg-red-100 text-red-600' :
                      h.level === 'warning' ? 'bg-orange-100 text-orange-600' :
                      'bg-primary/10 text-primary'
                    }`}>
                      {h.level === 'critical' ? <Shield className="w-4 h-4" /> :
                       h.level === 'warning' ? <Activity className="w-4 h-4" /> :
                       <BarChart3 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900">{h.section} • {h.action}</p>
                      <p className="text-xs text-slate-600 mt-1">{h.details || h.note || h.meta?.username || h.userEmail}</p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span className="text-xs text-slate-500">{timeAgo(h.createdAt)}</span>
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-3 border-t border-slate-200/50">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-primary hover:text-primary hover:bg-primary/5"
                onClick={() => navigate('/admin/history')}
              >
                عرض السجل كاملًا
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Theme Toggle - Hide on very small screens */}
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="hidden xs:flex w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-all duration-300"
        >
          {isDarkMode ? <Sun className="w-4 h-4 sm:w-5 sm:h-5" /> : <Moon className="w-4 h-4 sm:w-5 sm:h-5" />}
        </Button>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 sm:h-12 rounded-xl bg-gradient-to-r from-primary/5 to-secondary/5 hover:from-primary/10 hover:to-secondary/10 px-2 sm:px-4 border border-primary/20 transition-all duration-300">
              <div className="flex items-center gap-2 sm:gap-3">
                <Avatar className="h-6 w-6 sm:h-8 sm:w-8 ring-2 ring-primary/20">
                  <AvatarFallback className="bg-gradient-to-br from-primary to-secondary text-white font-bold text-xs sm:text-sm">
                    {user?.firstName?.charAt(0)}
                    {user?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-right">
                  <p className="text-sm font-semibold text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs text-slate-500">مدير النظام</p>
                </div>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56 sm:w-64 bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-xl" align="end" forceMount>
            <DropdownMenuLabel className="font-normal p-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12 ring-2 ring-blue-200">
                  <AvatarFallback className="bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold">
                    {user?.firstName?.charAt(0)}
                    {user?.lastName?.charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-semibold leading-none text-slate-900">
                    {user?.firstName} {user?.lastName}
                  </p>
                  <p className="text-xs leading-none text-slate-500">
                    {user?.email}
                  </p>
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 mt-1">
                    نشط الآن
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="bg-slate-200/50" />
            <DropdownMenuItem 
              className="p-3 hover:bg-blue-50 cursor-pointer transition-colors"
              onClick={() => navigate('/admin/profile')}
            >
              <User className="mr-3 h-5 w-5 text-blue-600" />
              <span className="font-medium">الملف الشخصي</span>
            </DropdownMenuItem>
            <DropdownMenuItem 
              className="p-3 hover:bg-purple-50 cursor-pointer transition-colors"
              onClick={() => navigate('/admin/settings')}
            >
              <Settings className="mr-3 h-5 w-5 text-purple-600" />
              <span className="font-medium">الإعدادات</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 hover:bg-indigo-50 cursor-pointer transition-colors">
              <Monitor className="mr-3 h-5 w-5 text-indigo-600" />
              <span className="font-medium">نظرة عامة على النظام</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="p-3 hover:bg-green-50 cursor-pointer transition-colors">
              <HelpCircle className="mr-3 h-5 w-5 text-green-600" />
              <span className="font-medium">المساعدة والدعم</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator className="bg-slate-200/50" />
            <DropdownMenuItem onClick={handleLogout} className="p-3 hover:bg-red-50 cursor-pointer transition-colors text-red-600">
              <LogOut className="mr-3 h-5 w-5" />
              <span className="font-medium">تسجيل الخروج</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Enhanced Search Overlay */}
      {isSearchOpen && (
        <div className="absolute top-16 sm:top-20 left-0 right-0 bg-white/95 backdrop-blur-xl border-b border-slate-200/50 p-4 sm:p-6 shadow-xl z-50">
          <div className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute right-3 sm:right-4 top-3 sm:top-4 h-4 w-4 sm:h-5 sm:w-5 text-slate-400" />
              <input
                type="text"
                placeholder="البحث في لوحة التحكم... (المنتجات، الطلبات، العملاء)"
                className="w-full h-12 sm:h-14 pr-10 sm:pr-12 pl-4 border-2 border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-base sm:text-lg bg-white/80 backdrop-blur-sm transition-all duration-300"
                autoFocus
              />
              <div className="absolute left-3 sm:left-4 top-3 sm:top-4 hidden sm:flex items-center gap-2">
                <kbd className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border">Ctrl</kbd>
                <kbd className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded border">K</kbd>
              </div>
            </div>
            <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-slate-500 text-center">
              ابحث عن المنتجات، الطلبات، العملاء، والإعدادات
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default AdminHeader;
