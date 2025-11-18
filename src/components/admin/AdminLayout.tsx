import { ReactNode, useEffect, useState, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';
import AdminSidebar from './AdminSidebar';
import AdminHeader from './AdminHeader';
import { logHistory } from '@/lib/history';
import { cn } from '@/lib/utils';
import useDeviceDetection from '@/hooks/useDeviceDetection';

interface AdminLayoutProps {
  children: ReactNode;
}

const AdminLayout = ({ children }: AdminLayoutProps) => {
  const { isAdminAuthenticated, adminUser } = useDualAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useDeviceDetection();
  
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    try { 
      const saved = localStorage.getItem('admin.sidebar.collapsed');
      // Loading sidebar state
      return saved === '1'; 
    } catch { 
      // Failed to load sidebar state
      return false; 
    }
  });
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Toggle handler with audit log and debugging
  const toggleSidebar = useCallback(() => {
    if (isMobile) {
      setMobileMenuOpen(!mobileMenuOpen);
      void logHistory({ section: 'admin', action: 'mobile_menu_toggled', note: !mobileMenuOpen ? 'Opened mobile menu' : 'Closed mobile menu', meta: { open: !mobileMenuOpen } });
    } else {
      setCollapsed((v) => {
        const next = !v;
        // Toggling sidebar
        void logHistory({ section: 'admin', action: 'sidebar_toggled', note: next ? 'Collapsed sidebar' : 'Expanded sidebar', meta: { collapsed: next } });
        return next;
      });
    }
  }, [isMobile, mobileMenuOpen]);

  // Monitor collapsed state changes
  useEffect(() => {
    // Sidebar state changed
  }, [collapsed]);

  useEffect(() => {
    try { 
      localStorage.setItem('admin.sidebar.collapsed', collapsed ? '1' : '0'); 
      // Saved sidebar state
    } catch {
      // Failed to save sidebar state
      // noop: localStorage might be unavailable (SSR or privacy mode)
    }
  }, [collapsed]);

  // Keyboard shortcut to toggle sidebar (Ctrl/Cmd + B)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
        e.preventDefault();
        // Keyboard shortcut triggered
        toggleSidebar();
      }
      // Emergency reset: Ctrl+Shift+R
      if (e.ctrlKey && e.shiftKey && e.key === 'R') {
        e.preventDefault();
        console.log('Emergency sidebar reset triggered');
        setCollapsed(false);
        localStorage.setItem('admin.sidebar.collapsed', '0');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleSidebar]);

  // Double-click on main content to toggle sidebar
  const handleMainDoubleClick = (e: React.MouseEvent) => {
    if (e.detail === 2) {
      console.log('Double-click toggle triggered');
      toggleSidebar();
    }
  };

  useEffect(() => {
    if (!isAdminAuthenticated) {
      if (location.pathname.startsWith('/admin') && location.pathname !== '/admin/login') {
        navigate('/admin/login', { replace: true });
      }
    }
  }, [isAdminAuthenticated, navigate, location.pathname]);

  // Audit: log page views within admin
  useEffect(() => {
    if (isAdminAuthenticated && location.pathname.startsWith('/admin')) {
      const path = location.pathname;
      const section = path.split('/')[2] || 'dashboard';
      void logHistory({ section, action: 'page_view', note: `Visited /admin${section ? '/' + section : ''}`, meta: { path } });
    }
  }, [location.pathname, isAdminAuthenticated]);

  if (!isAdminAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/20" dir="rtl">
      {/* Animated background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-40 h-40 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <AdminSidebar 
        collapsed={collapsed} 
        onToggle={toggleSidebar}
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
      />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        // On mobile, no left margin as sidebar is overlay
        // On desktop, use responsive margins
        isMobile ? "ml-0" : (collapsed ? "ml-16" : "ml-80")
      )}>
        <AdminHeader user={adminUser} onToggleSidebar={toggleSidebar} />
        <main className="flex-1 overflow-y-auto">
          <div className={cn(
            "p-4 sm:p-6 lg:p-8",
            // Reduce padding on mobile for better space utilization
            isMobile && "px-4 py-6"
          )}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;