import { NavLink, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Users,
  QrCode,
  Settings,
  Sliders,
  Shield,
  ChevronLeft,
  Grid3X3,
  MapPin,
  ChevronRight,
  History,
  DollarSign,
  X,
  Sparkles,
  Box,
  LayoutGrid,
  TrendingUp,
  Activity,
  Layers,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useLogo } from '@/hooks/useLogo';
import { apiGet } from '@/lib/api';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';

// Organized navigation with groups
const navigationGroups = [
  {
    title: 'الرئيسية',
    items: [
      { name: 'لوحة التحكم', href: '/admin/dashboard', icon: LayoutDashboard }
    ]
  },
  {
    title: 'المبيعات',
    items: [
      { name: 'الطلبات', href: '/admin/orders', icon: ShoppingCart },
      { name: 'الأرباح', href: '/admin/profit', icon: DollarSign }
    ]
  },
  {
    title: 'المنتجات',
    items: [
      { name: 'المنتجات', href: '/admin/products', icon: Package },
      { name: 'نماذج 3D', href: '/admin/products-3d', icon: Box },
      { name: 'الفئات', href: '/admin/categories', icon: Grid3X3 },
      { name: 'رموز QR', href: '/admin/qr-codes', icon: QrCode }
    ]
  },
  {
    title: 'الإدارة',
    items: [
      { name: 'المستخدمين', href: '/admin/users', icon: Users },
      { name: 'المواقع', href: '/admin/locations', icon: MapPin },
      { name: 'سجل النشاط', href: '/admin/history', icon: History }
    ]
  },
  {
    title: 'الإعدادات',
    items: [
      { name: 'الصفحة الرئيسية', href: '/admin/home-config', icon: Sliders },
      { name: 'الإعدادات', href: '/admin/settings', icon: Settings }
    ]
  }
];

interface AdminSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  isMobile: boolean;
  mobileMenuOpen: boolean;
  onMobileMenuClose: () => void;
}

const AdminSidebarEnhanced = ({ collapsed, onToggle, isMobile, mobileMenuOpen, onMobileMenuClose }: AdminSidebarProps) => {
  const location = useLocation();
  const [counts, setCounts] = useState<{ products?: number; categories?: number; orders?: number; users?: number }>({});
  const { isAuthenticated, token } = useDualAuth();
  const { logo, isLoading: logoLoading } = useLogo();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    (async () => {
      try {
        type Paged = { ok: boolean; items: unknown[]; total: number; page: number; pages: number };
        const [prods, cats, ords, usrs] = await Promise.all([
          apiGet<Paged>('/api/products?limit=1'),
          apiGet<Paged>('/api/categories?limit=1'),
          apiGet<Paged>('/api/orders?limit=1'),
          apiGet<Paged>('/api/users?limit=1'),
        ]);
        if (!cancelled) setCounts({
          products: prods.ok ? prods.total : undefined,
          categories: cats.ok ? cats.total : undefined,
          orders: ords.ok ? ords.total : undefined,
          users: usrs.ok ? usrs.total : undefined,
        });
      } catch (err) { console.error('Failed to fetch sidebar counts', err); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token]);

  const sidebarContent = (
    <div 
      className={cn(
        "h-full bg-card border-l border-border shadow-2xl transition-all duration-300 ease-in-out flex flex-col overflow-hidden relative",
        isMobile ? "w-72" : (collapsed ? "w-20" : "w-72")
      )}
    >
      {/* Brand Section */}
      <div className="relative border-b border-border p-4 flex-shrink-0 bg-background/50">
        <div className="flex items-center justify-between">
          {(isMobile || !collapsed) && (
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 shadow-sm flex-shrink-0 transition-transform hover:scale-105 active:scale-95 cursor-pointer">
                {!logoLoading ? (
                  <img src={logo.url} alt={logo.altText} className="w-8 h-8 object-contain" />
                ) : (
                  <div className="w-8 h-8 bg-black/5 animate-pulse rounded" />
                )}
              </div>
              <div className="min-w-0">
                <h2 className="text-lg font-black text-foreground tracking-tight truncate underline underline-offset-4 decoration-primary/50">لوحة الإدارة</h2>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-70">Control Panel</p>
              </div>
            </div>
          )}
          
          {/* Toggle button - Corrected logic for RTL right-to-left sidebar */}
          {!isMobile && (
            <button
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "w-10 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary transition-all flex items-center justify-center border border-primary/10",
                collapsed ? "mx-auto" : ""
              )}
              onClick={(e) => {
                e.preventDefault();
                onToggle();
              }}
            >
              {collapsed ? (
                 <ChevronLeft className="w-5 h-5" /> // Point into screen to expand
              ) : (
                 <ChevronRight className="w-5 h-5" /> // Point out to screen edge to collapse
              )}
            </button>
          )}
          
          {/* Mobile Close Button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMobileMenuClose}
              className="p-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
            >
              <X className="w-5 h-5 font-black" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-hide relative bg-background/30">
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.title} className={groupIndex > 0 ? 'mt-8' : ''}>
            {(isMobile || !collapsed) && (
              <div className="px-4 py-2 font-black text-[10px] text-muted-foreground uppercase opacity-50 tracking-[0.2em]">
                {group.title}
              </div>
            )}
            
            {group.items.map((item) => {
              const isActive = location.pathname === item.href;
              const count =
                item.href === '/admin/products' ? counts.products :
                item.href === '/admin/categories' ? counts.categories :
                item.href === '/admin/orders' ? counts.orders :
                item.href === '/admin/users' ? counts.users : undefined;
              
              const navItem = (
                <div 
                  key={item.name}
                  onMouseEnter={() => setHoveredItem(item.name)}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <NavLink
                    to={item.href}
                    onClick={() => { if (isMobile) onMobileMenuClose(); }}
                    className={cn(
                      'group relative flex items-center gap-3 px-3 py-2.5 rounded-2xl transition-all duration-300 overflow-hidden outline-none',
                      isActive
                        ? 'bg-primary/10 font-bold text-primary shadow-sm scale-[1.02]' 
                        : 'text-foreground/60 hover:bg-primary/5 hover:text-primary font-medium hover:translate-x-[-4px]',
                      (!isMobile && collapsed) && 'justify-center px-0'
                    )}
                  >
                    <div className={cn(
                      'relative flex items-center justify-center rounded-xl w-9 h-9 flex-shrink-0 transition-all duration-300',
                      isActive ? 'bg-primary text-primary-foreground shadow-lg rotate-0' : 'bg-transparent group-hover:bg-primary/10 text-muted-foreground group-hover:text-primary group-hover:rotate-12',
                      (!isMobile && collapsed) && 'mx-auto'
                    )}>
                      {item.href === '/admin/products-3d' ? (
                        <span className="text-xs font-black font-mono">3D</span>
                      ) : (
                        <item.icon className="w-[20px] h-[20px]" />
                      )}
                    </div>

                    {(isMobile || !collapsed) && (
                      <div className="flex-1 flex justify-between items-center w-full min-w-0">
                        <span className="truncate font-black text-sm tracking-tight">{item.name}</span>
                        {count !== undefined && (
                          <span className={cn(
                            'text-[10px] px-2 py-0.5 rounded-lg font-black min-w-[20px] text-center transition-all',
                            isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                          )}>
                            {count}
                          </span>
                        )}
                      </div>
                    )}

                    {isActive && (
                      <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1.5 h-1/2 bg-primary rounded-r-full" />
                    )}
                  </NavLink>
                </div>
              );

              if (!isMobile && collapsed) {
                return (
                  <Tooltip key={item.name} delayDuration={0}>
                    <TooltipTrigger asChild>{navItem}</TooltipTrigger>
                    <TooltipContent side="left" className="font-black bg-card border-border shadow-xl px-4 py-2 rounded-xl text-xs" sideOffset={10}>
                      {item.name} {count !== undefined && <span className="text-primary ml-1 opacity-70">({count})</span>}
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return navItem;
            })}
          </div>
        ))}
      </nav>
      
      {/* Footer Info */}
      {!collapsed && (
        <div className="p-4 border-t border-border bg-background/50 flex flex-col gap-2">
            <div className="flex items-center justify-between text-[10px] font-black text-muted-foreground tracking-widest uppercase opacity-40">
                <span>Version</span>
                <span>2.0.4 - RTL</span>
            </div>
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return (
      <TooltipProvider>
        <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuClose}>
          <SheetContent 
            side="right" // Sheet on right for RTL
            className="w-72 p-0 border-0 bg-transparent"
          >
            <SheetHeader>
              <VisuallyHidden>
                <SheetTitle>قائمة التنقل الرئيسية</SheetTitle>
              </VisuallyHidden>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </TooltipProvider>
    );
  }

  return (
    <TooltipProvider>
      <div 
        className={cn(
          'fixed right-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out',
          collapsed ? "w-20" : "w-72"
        )}
      >
        {sidebarContent}
      </div>
    </TooltipProvider>
  );
};

export default AdminSidebarEnhanced;
