import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ShoppingCart, User, LogOut, Settings, Package, Heart, ChevronDown } from 'lucide-react';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useCart } from '@/hooks/useCart';
import { useFavorites } from '@/hooks/useFavorites';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { Button } from '@/components/ui/button';
import Logo from '@/components/ui/Logo';
import SearchSuggestions from '@/components/search/SearchSuggestions';
import AuthModal from '@/components/ui/auth-modal';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { apiGet, type ApiResponse } from '@/lib/api';
import type { Category } from '@/types';

type ApiCategory = {
  _id: string;
  name: string;
  nameAr?: string;
  slug: string;
  description?: string;
  featured?: boolean;
  image?: string;
  order?: number;
  productCount?: number;
};

const Navbar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [liveCategories, setLiveCategories] = useState<Category[]>([]);
  const [hoveredCatId, setHoveredCatId] = useState<string | null>(null);
  const [loadingCategories, setLoadingCategories] = useState<boolean>(true);
  const [mounted, setMounted] = useState(false);
  const prefersReducedMotion = useMemo(() => {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isAdmin, logout } = useDualAuth();
  const { itemCount } = useCart();
  const { favoritesCount } = useFavorites();
  const { hidePrices } = usePricingSettings();

  const isActivePath = (path: string) => location.pathname === path;

  // Build a friendly display name from auth user
  const displayName = (() => {
    const fn = user?.firstName?.trim() || '';
    const ln = user?.lastName?.trim() || '';
    const full = `${fn} ${ln}`.trim();
    if (full) return full;
    const email = user?.email || '';
    return email ? email.split('@')[0] : '';
  })();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  // Load categories from backend API (live refresh)
  useEffect(() => {
    let isMounted = true;
    const fetchCategories = async () => {
      try {
        const res = await apiGet<ApiCategory>('/api/categories');
        const items = (res as Extract<ApiResponse<ApiCategory>, { ok: true }>).items ?? [];
        const mapped: Category[] = items.map((c) => ({
          id: c._id,
          name: c.name,
          nameAr: c.nameAr ?? c.name,
          slug: c.slug,
          image: c.image ?? '',
          description: c.description ?? '',
          descriptionAr: undefined,
          productCount: typeof c.productCount === 'number' ? c.productCount : 0,
          featured: !!c.featured,
          order: typeof c.order === 'number' ? c.order : 0,
        }));
        if (isMounted) setLiveCategories(mapped);
      } catch (e) {
        console.error('Failed to fetch categories:', e);
        if (isMounted) setLiveCategories([]);
      } finally {
        if (isMounted) setLoadingCategories(false);
      }
    };

    // initial load
    fetchCategories();

    // refresh when window regains focus / tab visible
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchCategories();
    };
    window.addEventListener('focus', fetchCategories);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMounted = false;
      window.removeEventListener('focus', fetchCategories);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []);

  // Trigger entrance animations once on mount
  useEffect(() => {
    setMounted(true);
  }, []);

  const mainNavItems = [
    { path: '/', label: 'الرئيسية', labelEn: 'Home' },
    { path: '/products', label: 'المنتجات', labelEn: 'Products' },
    { path: '/shop-builder', label: 'مُخطط المتجر 3D', labelEn: 'Shop Builder 3D' },
    { path: '/about', label: 'من نحن', labelEn: 'About' },
    { path: '/locations', label: 'فروعنا', labelEn: 'Locations' },
    // Contact removed as requested
  ];

  return (
    <>
    <nav className="bg-card border-b border-border sticky top-0 z-50 shadow-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className={
              prefersReducedMotion
                ? ''
                : `transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`
            }
            style={prefersReducedMotion ? undefined : { transitionDelay: '120ms' }}
          >
            <Logo size="xl" showText={false} />
          </div>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center space-x-8 space-x-reverse">
            {mainNavItems.map((item, idx) => {
              // Special handling for products with categories dropdown
              if (item.path === '/products') {
                return (
                  <DropdownMenu key={item.path}>
                    <DropdownMenuTrigger
                      className={`nav-link transition-all duration-300 ease-out flex items-center gap-1 ${
                        isActivePath(item.path) || location.pathname.startsWith('/category') ? 'nav-link-active' : ''
                      } ${mounted ? 'animate-in fade-in slide-in-from-top-2 duration-1100' : ''}`}
                      style={mounted ? { animationDelay: `${idx * 160}ms` } : undefined}
                    >
                      {item.label}
                      <ChevronDown className="w-4 h-4" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[560px] p-0 overflow-hidden">
                      <div className="flex">
                        {/* Left: list */}
                        <div className="w-1/2 max-h-96 overflow-y-auto p-2">
                          {/* Quick Links with Images */}
                          <div className="px-2 mb-2">
                            <DropdownMenuItem asChild>
                              <Link to="/products" className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center flex-shrink-0">
                                  <Package className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-sm">جميع المنتجات</div>
                                  <div className="text-xs text-muted-foreground">تصفح كامل المتجر</div>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                          </div>
                          
                          <div className="px-2 mb-3">
                            <DropdownMenuItem asChild>
                              <Link to="/categories" className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-primary/10">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-secondary to-primary flex items-center justify-center flex-shrink-0">
                                  <Menu className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1">
                                  <div className="font-semibold text-sm">كل الأقسام</div>
                                  <div className="text-xs text-muted-foreground">استعرض حسب القسم</div>
                                </div>
                              </Link>
                            </DropdownMenuItem>
                          </div>
                          
                          {/* Separator */}
                          <DropdownMenuSeparator className="my-2" />
                          
                          {/* Categories List */}
                          <div className="px-2 mb-1">
                            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">الأقسام</div>
                          </div>
                          
                          {loadingCategories ? (
                            Array.from({ length: 8 }).map((_, i) => (
                              <div key={i} className="px-2 py-2">
                                <div className="h-4 w-40 bg-muted animate-pulse rounded" />
                              </div>
                            ))
                          ) : (
                            liveCategories
                              .slice()
                              .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.nameAr.localeCompare(b.nameAr))
                              .slice(0, 12)
                              .map((category) => (
                                <div
                                  key={category.id}
                                  onMouseEnter={() => setHoveredCatId(category.id)}
                                  onMouseLeave={() => setHoveredCatId((prev) => (prev === category.id ? null : prev))}
                                  className="px-2"
                                >
                                  <DropdownMenuItem asChild>
                                    <Link to={`/category/${category.slug}`} className="w-full flex items-center justify-between">
                                      <span>{category.nameAr}</span>
                                      {typeof category.productCount === 'number' && (
                                        <span className="text-xs text-muted-foreground">{category.productCount}</span>
                                      )}
                                    </Link>
                                  </DropdownMenuItem>
                                </div>
                              ))
                          )}
                        </div>
                        {/* Right: preview */}
                        <div className="w-1/2 relative bg-gradient-to-br from-purple-50 to-pink-50 hidden md:block">
                          {(() => {
                            const cat = (hoveredCatId && liveCategories.find(c => c.id === hoveredCatId)) || liveCategories[0];
                            if (!cat) return null;
                            return (
                              <div className="h-96 p-3 flex items-center justify-center">
                                <div className="relative w-full h-full rounded-lg overflow-hidden shadow-lg">
                                  <img
                                    src={cat.image}
                                    alt={cat.nameAr}
                                    className="w-full h-full object-cover transition-transform duration-700 ease-out will-change-transform"
                                    style={{ transform: hoveredCatId ? 'scale(1.06) rotate(0.5deg)' : 'scale(1.02)' }}
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/10 to-transparent" />
                                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between">
                                    <div className="text-white">
                                      <div className="text-sm opacity-90">فئة</div>
                                      <div className="text-lg font-bold drop-shadow">{cat.nameAr}</div>
                                    </div>
                                    {typeof cat.productCount === 'number' && (
                                      <div className="bg-white/90 text-slate-800 text-xs px-2 py-1 rounded-full shadow">
                                        {cat.productCount} منتج
                                      </div>
                                    )}
                                  </div>
                                  {/* shimmer */}
                                  <div className="absolute inset-0 pointer-events-none">
                                    <div className="absolute -inset-[40%] bg-gradient-to-r from-transparent via-white/10 to-transparent rotate-12 animate-[shimmer_2.2s_infinite]" />
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`nav-link transition-all duration-300 ease-out ${
                    isActivePath(item.path) ? 'nav-link-active' : ''
                  } ${mounted ? 'animate-in fade-in slide-in-from-top-2 duration-1100' : ''}`}
                  style={mounted ? { animationDelay: `${idx * 160}ms` } : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>

          {/* Search Bar - Desktop */}
          <div
            className={`hidden md:block flex-1 max-w-md mx-8 ${
              prefersReducedMotion ? '' : `transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`
            }`}
            style={prefersReducedMotion ? undefined : { transitionDelay: '280ms' }}
          >
            <SearchSuggestions
              placeholder="البحث عن المنتجات..."
              onSearch={() => setIsMobileMenuOpen(false)}
            />
          </div>

          {/* Actions */}
          <div
            className={`flex items-center space-x-4 space-x-reverse ${
              prefersReducedMotion ? '' : `transition-all duration-1000 ease-out ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-6'}`
            }`}
            style={prefersReducedMotion ? undefined : { transitionDelay: '360ms' }}
          >
            {/* Favorites Button - Available for all users */}
            <Link
              to={isAuthenticated && !isAdmin ? "/favorites" : "#"}
              onClick={(e) => {
                if (!isAuthenticated || isAdmin) {
                  e.preventDefault();
                  setShowAuthModal(true);
                }
              }}
              className="relative p-2 hover:bg-muted rounded-lg transition-all duration-300 ease-out"
            >
              <Heart className="w-6 h-6 text-foreground" />
              {isAuthenticated && !isAdmin && favoritesCount > 0 && (
                <Badge className="absolute -top-1 -right-1 bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full px-1">
                  {favoritesCount > 99 ? '99+' : favoritesCount}
                </Badge>
              )}
            </Link>

            {/* Cart Button - Hidden when prices are hidden */}
            {!hidePrices && (
              <Link
                to="/cart"
                className="relative p-2 hover:bg-muted rounded-lg transition-all duration-300 ease-out group"
              >
                <ShoppingCart className="w-6 h-6 text-foreground group-hover:scale-110 transition-transform duration-200" />
                {itemCount > 0 && (
                  <Badge className="absolute -top-1 -right-1 bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center rounded-full px-1 animate-in zoom-in duration-300 shadow-lg">
                    {itemCount > 99 ? '99+' : itemCount}
                  </Badge>
                )}
              </Link>
            )}

            {/* User Menu */}
            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2 space-x-reverse">
                    <User className="w-5 h-5" />
                    <span className="hidden md:inline">{displayName}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center space-x-2 space-x-reverse">
                      <User className="w-4 h-4" />
                      <span>الملف الشخصي</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/orders" className="flex items-center space-x-2 space-x-reverse">
                      <Package className="w-4 h-4" />
                      <span>طلباتي</span>
                    </Link>
                  </DropdownMenuItem>
                  {isAdmin && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link to="/admin/dashboard" className="flex items-center space-x-2 space-x-reverse">
                          <Settings className="w-4 h-4" />
                          <span>لوحة الإدارة</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                    <LogOut className="w-4 h-4 ml-2" />
                    <span>تسجيل الخروج</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/login">تسجيل الدخول</Link>
                </Button>
                <Button size="sm" asChild>
                  <Link to="/register">إنشاء حساب</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2 hover:bg-muted rounded-lg transition-all duration-300 ease-out"
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden border-t border-border py-4 animate-fade-in">
            {/* Mobile Search */}
            <div className="mb-4">
              <SearchSuggestions
                placeholder="البحث عن المنتجات..."
                onSearch={() => setIsMobileMenuOpen(false)}
              />
            </div>

            {/* Mobile Navigation Links */}
            <div className="space-y-2">
              {mainNavItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block py-2 px-4 rounded-lg transition-all duration-300 ease-out ${
                    isActivePath(item.path)
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
              
              {/* Mobile Category Links */}
              <div className="pt-2">
                <div className="px-4 py-2 text-sm font-medium text-slate-500">الفئات</div>
                {loadingCategories ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="px-4 py-2">
                      <div className="h-4 w-32 bg-muted animate-pulse rounded" />
                    </div>
                  ))
                ) : (
                  liveCategories
                    .slice()
                    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.nameAr.localeCompare(b.nameAr))
                    .slice(0, 8)
                    .map((category) => (
                      <Link
                        key={category.id}
                        to={`/category/${category.slug}`}
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="block py-2 px-4 rounded-lg hover:bg-muted transition-all duration-300 ease-out"
                      >
                        <div className="flex items-center justify-between">
                          <span>{category.nameAr}</span>
                          {typeof category.productCount === 'number' && (
                            <span className="text-xs text-slate-500">{category.productCount}</span>
                          )}
                        </div>
                      </Link>
                    ))
                )}
              </div>
              
              {isAuthenticated && (
                <>
                  <Link
                    to="/profile"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-2 px-4 rounded-lg hover:bg-muted transition-all duration-300 ease-out"
                  >
                    الملف الشخصي
                  </Link>
                  <Link
                    to="/orders"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="block py-2 px-4 rounded-lg hover:bg-muted transition-all duration-300 ease-out"
                  >
                    طلباتي
                  </Link>
                  {isAdmin && (
                    <Link
                      to="/admin/dashboard"
                      onClick={() => setIsMobileMenuOpen(false)}
                      className="block py-2 px-4 rounded-lg hover:bg-muted transition-all duration-300 ease-out"
                    >
                      لوحة الإدارة
                    </Link>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </nav>
    {showAuthModal && (
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        action="cart"
      />
    )}
    </>
  );
};

export default Navbar;
