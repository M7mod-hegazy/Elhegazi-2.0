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
  Box
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
      { 
        name: 'لوحة التحكم', 
        href: '/admin/dashboard', 
        icon: LayoutDashboard,
        gradient: 'from-primary to-secondary',
        color: 'text-primary'
      },
    ]
  },
  {
    title: 'المبيعات',
    items: [
      { 
        name: 'الطلبات', 
        href: '/admin/orders', 
        icon: ShoppingCart,
        gradient: 'from-orange-500 to-red-600',
        color: 'text-orange-400'
      },
      { 
        name: 'الأرباح', 
        href: '/admin/profit', 
        icon: DollarSign,
        gradient: 'from-emerald-500 to-teal-600',
        color: 'text-emerald-400'
      },
    ]
  },
  {
    title: 'المنتجات',
    items: [
      { 
        name: 'المنتجات', 
        href: '/admin/products', 
        icon: Package,
        gradient: 'from-green-500 to-emerald-600',
        color: 'text-green-400'
      },
      { 
        name: 'نماذج 3D', 
        href: '/admin/products-3d', 
        icon: Box,
        gradient: 'from-blue-500 to-indigo-600',
        color: 'text-blue-400'
      },
      { 
        name: 'الفئات', 
        href: '/admin/categories', 
        icon: Grid3X3,
        gradient: 'from-purple-500 to-violet-600',
        color: 'text-purple-400'
      },
      { 
        name: 'رموز QR', 
        href: '/admin/qr-codes', 
        icon: QrCode,
        gradient: 'from-secondary to-primary',
        color: 'text-secondary'
      },
    ]
  },
  {
    title: 'الإدارة',
    items: [
      { 
        name: 'المستخدمين', 
        href: '/admin/users', 
        icon: Users,
        gradient: 'from-teal-500 to-cyan-600',
        color: 'text-teal-400'
      },
      { 
        name: 'المواقع', 
        href: '/admin/locations', 
        icon: MapPin,
        gradient: 'from-pink-500 to-rose-600',
        color: 'text-pink-400'
      },
      { 
        name: 'سجل النشاط', 
        href: '/admin/history', 
        icon: History,
        gradient: 'from-violet-500 to-purple-600',
        color: 'text-violet-400'
      },
    ]
  },
  {
    title: 'الإعدادات',
    items: [
      { 
        name: 'الصفحة الرئيسية', 
        href: '/admin/home-config', 
        icon: Sliders,
        gradient: 'from-amber-500 to-yellow-600',
        color: 'text-amber-400'
      },
      { 
        name: 'الإعدادات', 
        href: '/admin/settings', 
        icon: Settings,
        gradient: 'from-slate-500 to-gray-600',
        color: 'text-slate-400'
      },
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
        const productsTotal = prods.ok ? prods.total : undefined;
        const categoriesTotal = cats.ok ? cats.total : undefined;
        const ordersTotal = ords.ok ? ords.total : undefined;
        const usersTotal = usrs.ok ? usrs.total : undefined;
        if (!cancelled) setCounts({
          products: productsTotal,
          categories: categoriesTotal,
          orders: ordersTotal,
          users: usersTotal,
        });
      } catch (err) { console.error('Failed to fetch sidebar counts', err); }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, token]);

  // Dynamic width with smooth transitions
  const sidebarWidth = collapsed ? 'w-20' : 'w-72';
  const isExpanded = !collapsed;

  // Render sidebar content
  const sidebarContent = (
    <div 
      className={cn(
        "h-full bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 border-r border-slate-700/50 shadow-2xl transition-all duration-500 ease-in-out overflow-visible flex flex-col relative",
        isMobile ? "w-72" : sidebarWidth
      )}
    >
      {/* Animated Background Effects */}
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="absolute top-20 -left-10 w-40 h-40 bg-blue-500/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-40 -left-10 w-32 h-32 bg-purple-500/30 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 -left-10 w-36 h-36 bg-secondary/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
      </div>

      {/* Enhanced Brand Section */}
      <div className="relative border-b border-slate-700/50 p-4 flex-shrink-0 backdrop-blur-sm bg-slate-900/50">
        <div className="flex items-center justify-between">
          {(isMobile || !collapsed) && (
            <div className="flex items-center gap-3 group">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded-2xl blur-lg opacity-50 group-hover:opacity-75 transition-opacity duration-300" />
                <div className="relative w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-2xl flex items-center justify-center shadow-xl border border-white/10 transform group-hover:scale-110 transition-transform duration-300">
                  {!logoLoading && (
                    <img 
                      src={logo.url} 
                      alt={logo.altText} 
                      className="w-8 h-8 object-contain"
                    />
                  )}
                  {logoLoading && (
                    <div className="w-8 h-8 bg-white/20 animate-pulse rounded" />
                  )}
                </div>
              </div>
              <div className="transform group-hover:translate-x-1 transition-transform duration-300">
                <h2 className="text-xl font-black bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent">
                  لوحة الإدارة
                </h2>
                <p className="text-xs text-slate-400 font-medium">الحجازي لتجهيز المحلات</p>
              </div>
            </div>
          )}
          
          {/* Collapse button for collapsed state */}
          {(!isMobile && collapsed) && (
            <button
              aria-label="Expand sidebar"
              className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary hover:from-primary hover:to-secondary text-white shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center hover:scale-110"
              onClick={(e) => {
                e.preventDefault();
                onToggle();
              }}
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          )}
          
          {/* Mobile Close Button */}
          {isMobile && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onMobileMenuClose}
              className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 text-slate-400 hover:text-white transition-all duration-300 hover:scale-110"
            >
              <X className="w-5 h-5" />
            </Button>
          )}
          
          {/* Desktop Toggle Button */}
          {(!isMobile && !collapsed) && (
            <button
              aria-label="Toggle sidebar"
              className="p-2 rounded-xl bg-slate-800/50 hover:bg-slate-700/70 text-slate-400 hover:text-white transition-all duration-300 hover:scale-110 hover:rotate-180"
              onClick={(e) => {
                e.preventDefault();
                onToggle();
              }}
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
          )}
        </div>
        
      </div>

      {/* Enhanced Navigation with Groups */}
      <nav className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-hide relative">
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.title} className={groupIndex > 0 ? 'mt-4' : ''}>
            {/* Group Title - Only show when expanded */}
            {(isMobile || !collapsed) && (
              <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
                {group.title}
              </div>
            )}
            
            {/* Group Items */}
            {group.items.map((item) => {
          const isActive = location.pathname === item.href;
          const isHovered = hoveredItem === item.name;
          
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
              className="relative"
            >
              <NavLink
                to={item.href}
                onClick={(e) => {
                  if (isMobile) onMobileMenuClose();
                }}
                className={cn(
                  'group relative flex items-center gap-2 p-2 rounded-xl transition-all duration-200 w-full overflow-hidden',
                  isActive
                    ? 'bg-gradient-to-r ' + item.gradient + ' text-white shadow-md' 
                    : 'text-slate-300 hover:bg-slate-800/50 hover:text-white'
                )}
              >
                {/* Animated background on hover */}
                {!isActive && isHovered && (
                  <div className={cn(
                    'absolute inset-0 bg-gradient-to-r opacity-10 rounded-2xl',
                    item.gradient
                  )} />
                )}

                {/* Icon with smaller size */}
                <div className={cn(
                  'relative flex items-center justify-center rounded-lg transition-all duration-200 flex-shrink-0',
                  (isMobile || !collapsed) ? 'w-8 h-8' : 'w-8 h-8 mx-auto',
                  isActive 
                    ? 'bg-white/20' 
                    : 'bg-slate-800/30 group-hover:bg-slate-700/50'
                )}>
                  <item.icon className={cn(
                    "w-4 h-4 relative z-10 transition-all duration-200",
                    isActive ? 'text-white' : item.color
                  )} />
                </div>

                {/* Text Content */}
                {(isMobile || !collapsed) && (
                  <div className="flex-1 min-w-0 relative z-10">
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn(
                        "font-semibold text-sm truncate transition-all duration-200",
                        isActive ? 'text-white' : 'text-slate-200'
                      )}>
                        {item.name}
                      </span>
                      {count !== undefined && (
                        <span className={cn(
                          'text-xs px-2 py-0.5 rounded-full font-semibold transition-all duration-200',
                          isActive 
                            ? 'bg-white/30 text-white' 
                            : 'bg-slate-700/50 text-slate-300 group-hover:bg-slate-600/70'
                        )}>
                          {count}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Active indicator */}
                {isActive && (
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-white rounded-r-full" />
                )}
              </NavLink>
            </div>
          );

          // Wrap with tooltip when collapsed
          if (!isMobile && collapsed) {
            return (
              <Tooltip key={item.name} delayDuration={200}>
                <TooltipTrigger asChild>
                  {navItem}
                </TooltipTrigger>
                <TooltipContent 
                  side="right" 
                  className="bg-slate-900 text-white border-slate-700 shadow-xl p-3 rounded-xl"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'w-6 h-6 rounded-lg flex items-center justify-center',
                      'bg-gradient-to-br ' + item.gradient
                    )}>
                      <item.icon className="w-3 h-3 text-white" />
                    </div>
                    <div className="font-semibold text-sm">{item.name}</div>
                  </div>
                  {count !== undefined && (
                    <div className="text-xs text-slate-400 mt-1">
                      {count} عنصر
                    </div>
                  )}
                </TooltipContent>
              </Tooltip>
            );
          }

          return navItem;
        })}
          </div>
        ))}
      </nav>
    </div>
  );

  // Mobile: Render as Sheet overlay
  if (isMobile) {
    return (
      <TooltipProvider>
        <Sheet open={mobileMenuOpen} onOpenChange={onMobileMenuClose}>
          <SheetContent 
            side="left" 
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

  // Desktop: Render as fixed sidebar
  return (
    <TooltipProvider>
      <div 
        className={cn(
          sidebarWidth,
          'fixed left-0 top-0 z-40 h-screen transition-all duration-500 ease-in-out overflow-visible'
        )}
      >
        {sidebarContent}
      </div>
    </TooltipProvider>
  );
};

export default AdminSidebarEnhanced;
