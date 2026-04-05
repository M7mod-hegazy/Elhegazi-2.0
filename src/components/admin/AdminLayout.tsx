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
    <div className="min-h-screen bg-background" dir="rtl">
      <AdminSidebar 
        collapsed={collapsed} 
        onToggle={toggleSidebar}
        isMobile={isMobile}
        mobileMenuOpen={mobileMenuOpen}
        onMobileMenuClose={() => setMobileMenuOpen(false)}
      />
      <div className={cn(
        "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
        // On mobile, no padding as sidebar is overlay
        // On desktop, use padding-right for RTL (sidebar is on the right)
        isMobile ? "pr-0" : (collapsed ? "pr-20" : "pr-72")
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
