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
  BarChart3,
  Globe
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<HistoryItem[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [isDarkMode, setIsDarkMode] = useState(false);
  const { logout, isAuthenticated, token, user: authUser } = useDualAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const unreadCount = notifications.length;

  const handleLogout = () => {
    logout();
    toast({
      title: "تم تسجيل الخروج",
      description: "تم تسجيل الخروج بنجاح",
    });
    window.location.href = '/admin/login';
  };

  const handleMarkAllAsRead = async () => {
    try {
      await apiPostJson('/api/history/mark-read', {});
      setNotifications([]);
      toast({ title: 'تم التعليم كمقروء', description: 'تم تحديث حالة السجل بنجاح' });
    } catch (err) {
      console.error('Failed to mark history as read', err);
      toast({ title: 'تعذر التعليم كمقروء', description: 'حاول مرة أخرى لاحقًا', variant: 'destructive' });
    }
  };

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
    toast({
      title: "تغيير المظهر",
      description: "سيتم تطبيق التعديلات على مستوى النظام",
    });
  };

  useEffect(() => {
    if (!isAuthenticated || !authUser) return;
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

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(prev => !prev);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <header className="h-16 sm:h-20 bg-card border-b border-border flex items-center justify-between px-4 sm:px-6 lg:px-8 relative z-50 shadow-sm transition-colors duration-300">
      {/* Left Section */}
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

      {/* Right Section */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Enhanced Notifications Group */}
          <DropdownMenu open={isNotificationsOpen} onOpenChange={setIsNotificationsOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground relative transition-all"
              >
                <Bell className="w-[18px] h-[18px]" />
                {unreadCount > 0 && (
                  <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-primary rounded-full ring-2 ring-card animate-pulse" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-72 sm:w-80 bg-card border border-border shadow-xl backdrop-blur-md" align="end">
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-foreground">الإشعارات</h3>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="text-xs text-primary hover:text-primary transition-colors"
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
                      className="p-4 border-b border-border hover:bg-muted/50 transition-colors cursor-pointer"
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
                          <p className="text-sm font-bold text-foreground truncate">{h.section} • {h.action}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{h.note || h.details}</p>
                          <div className="flex items-center gap-2 mt-2">
                             <Clock className="w-3 h-3 text-muted-foreground" />
                             <span className="text-[10px] text-muted-foreground">{timeAgo(h.createdAt)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-muted-foreground text-sm">
                    لا توجد إشعارات جديدة
                  </div>
                )}
              </div>
              <div className="p-3 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-primary hover:bg-primary/5 text-xs font-bold"
                  onClick={() => navigate('/admin/history')}
                >
                  عرض السجل كاملاً
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Theme Toggle Button (Implicitly working with system themes) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleTheme}
            className="w-10 h-10 rounded-xl bg-muted/50 hover:bg-muted text-muted-foreground transition-all"
          >
            <Moon className="w-4 h-4" />
          </Button>

          {/* Return to Site Button */}
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

        {/* User Menu */}
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
