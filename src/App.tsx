import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { DualAuthProvider } from "@/context/DualAuthContext";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";
import { useFavicon } from "@/hooks/useFavicon";
import { useSiteName, cacheSiteName } from "@/hooks/useSiteName";
import { useLoadingCoordinator } from "@/hooks/useLoadingCoordinator";
import { useServiceWorker, useServiceWorkerUpdate } from "@/hooks/useServiceWorker";
import { usePrefetchOnIdle, usePreloadCritical } from "@/hooks/usePrefetch";
import Layout from "./components/layout/Layout";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import DualProtectedRoute from "./components/auth/DualProtectedRoute";
import { Suspense, lazy } from "react";
import { useToast } from "@/hooks/use-toast";
import ScrollProgressBar from "@/components/ui/scroll-progress-bar";
const HomePage = lazy(() => import("@/pages/Index"));
const Products = lazy(() => import("./pages/Products"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Categories = lazy(() => import("./pages/Categories"));
const CategoryPage = lazy(() => import("./pages/CategoryPage"));
const Category = lazy(() => import("./pages/Category"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const EnhancedCheckout = lazy(() => import("./pages/EnhancedCheckout"));
const ModernCheckout = lazy(() => import("./pages/ModernCheckout"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const Profile = lazy(() => import("./pages/Profile"));
const Orders = lazy(() => import("./pages/Orders"));
const About = lazy(() => import("./pages/About"));
const Contact = lazy(() => import("./pages/Contact"));
const Locations = lazy(() => import("./pages/Locations"));
const OrderTracking = lazy(() => import("./pages/OrderTracking"));
const EnhancedOrderTracking = lazy(() => import("./pages/EnhancedOrderTracking"));
const ShopBuilder3DPage = lazy(() =>
  import("@/features/shop-builder/ShopBuilder3DPage").catch(() => {
    // Fallback if import fails
    return { default: () => <div className="flex items-center justify-center h-screen"><p>Failed to load Shop Builder. Please refresh the page.</p></div> };
  })
);
const ShopSetup = lazy(() => import("./pages/ShopSetup"));
const ShopBuilderIntro = lazy(() => import("./pages/ShopBuilderIntro"));
const PublicOrderTracking = lazy(() => import("./pages/PublicOrderTracking"));
const OrderHistory = lazy(() => import("./pages/OrderHistory"));
const OrderConfirmation = lazy(() => import("./pages/OrderConfirmation"));
const RatingMessage = lazy(() => import("./pages/RatingMessage"));
const AdminLogin = lazy(() => import("./pages/admin/Login"));
const AdminDashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminProducts = lazy(() => import("./pages/admin/Products"));
const AdminProducts3D = lazy(() => import("./pages/admin/Products3D"));
const AdminModels3DAnalytics = lazy(() => import("./pages/admin/Models3DAnalytics"));
const AdminCategories = lazy(() => import("./pages/admin/Categories"));
const AdminOrders = lazy(() => import("./pages/admin/Orders"));
const AdminUsers = lazy(() => import("./pages/admin/Users"));
const AdminLocations = lazy(() => import("./pages/admin/Locations"));
const AdminQRCodes = lazy(() => import("./pages/admin/QRCodes"));
const AdminSettings = lazy(() => import("./pages/admin/Settings"));
const AdminHomeConfig = lazy(() => import("./pages/admin/HomeConfig"));
const AdminHistory = lazy(() => import("./pages/admin/History"));
const AdminProfit = lazy(() => import("./pages/admin/Profit"));
const AdminShareholders = lazy(() => import("./pages/admin/Shareholders"));

const AdminOrderTracking = lazy(() => import("./pages/admin/OrderTracking"));
const Favorites = lazy(() => import("./pages/Favorites"));
const Returns = lazy(() => import("./pages/Returns"));
const Addresses = lazy(() => import("./pages/Addresses"));
const PaymentMethods = lazy(() => import("./pages/PaymentMethods"));
const FeaturedProducts = lazy(() => import("./pages/FeaturedProducts"));
const BestSellers = lazy(() => import("./pages/BestSellers"));
const SpecialOffers = lazy(() => import("./pages/SpecialOffers"));
const LatestProducts = lazy(() => import("./pages/LatestProducts"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const AppInner = () => {
  const { logo } = useTheme();
  const { siteName } = useSiteName();
  const { toast } = useToast();
  const [docLoaded, setDocLoaded] = useState(false);

  // Update favicon and loading screen logo dynamically
  useFavicon();
  const [showSplash, setShowSplash] = useState(true);
  const location = useLocation();

  // Use loading coordinator to wait for all critical data
  const { allReady, isLoading } = useLoadingCoordinator();

  // Register Service Worker for offline support
  useServiceWorker();

  // Handle Service Worker updates
  useServiceWorkerUpdate();

  // Prefetch resources on idle
  usePrefetchOnIdle();

  // Preload critical resources
  usePreloadCritical();

  // Cache site name for immediate access
  useEffect(() => {
    if (siteName) {
      cacheSiteName();
      // Update page title and meta tags
      document.title = siteName;
      const ogTitle = document.getElementById('og-title') as HTMLMetaElement;
      const pageTitle = document.getElementById('page-title') as HTMLTitleElement;
      if (ogTitle) ogTitle.content = siteName;
      if (pageTitle) pageTitle.textContent = siteName;
    }
  }, [siteName]);

  useEffect(() => {
    // Remove the static pre-splash from index.html ONLY after hero is ready or timeout
    const removeSplash = () => {
      const pre = document.getElementById('pre-splash');
      if (pre && pre.parentElement) {
        pre.style.opacity = '0';
        pre.style.transition = 'opacity 0.5s ease';
        setTimeout(() => {
          if (pre.parentElement) pre.parentElement.removeChild(pre);
        }, 500);
      }
      requestAnimationFrame(() => setDocLoaded(true));
    };

    // Listen for hero-ready event from ModernHeroSlider
    window.addEventListener('hero-ready', removeSplash, { once: true });

    // Fallback timeout in case hero takes too long or isn't present
    const fallbackTimer = setTimeout(removeSplash, 3500);

    const onDomReady = () => {
      // We don't remove splash here anymore, we wait for hero-ready
      // But we still ensure docLoaded is set eventually
    };

    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      // requestAnimationFrame(() => setDocLoaded(true)); // Moved to removeSplash
    } else {
      document.addEventListener('DOMContentLoaded', onDomReady, { once: true });
    }

    return () => {
      window.removeEventListener('hero-ready', removeSplash);
      clearTimeout(fallbackTimer);
    };

    // Prevent React Router from hijacking external links (WhatsApp, etc.)
    const handleClickCapture = (e: Event) => {
      const target = (e.target as HTMLElement).closest('a');
      if (target) {
        const href = target.getAttribute('href');
        // If it's an external protocol or WhatsApp link, prevent React Router from hijacking it
        if (href && (
          href.startsWith('http://wa.me/') ||
          href.startsWith('https://wa.me/') ||
          href.startsWith('https://web.whatsapp.com/') ||
          href.startsWith('whatsapp://') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:')
        )) {
          // Prevent React Router from intercepting
          e.preventDefault();
          e.stopPropagation();

          // Let the browser handle it natively
          const newWindow = window.open(href, '_blank', 'noopener,noreferrer');
          if (!newWindow) {
            // Fallback if popup blocked
            window.location.href = href;
          }
        }
      }
    };

    // Intercept window.open calls for WhatsApp links
    const originalWindowOpen = window.open;
    (window as any).open = function (url: string, target?: string, features?: string) {
      // If it's a WhatsApp link, open it directly without React Router interference
      if (url && (
        url.startsWith('http://wa.me/') ||
        url.startsWith('https://wa.me/') ||
        url.startsWith('https://web.whatsapp.com/') ||
        url.startsWith('whatsapp://')
      )) {
        // Use the original window.open but it will be handled by the browser natively
        return originalWindowOpen.call(window, url, target, features);
      }
      // For other URLs, use the original window.open
      return originalWindowOpen.call(window, url, target, features);
    };

    document.addEventListener('click', handleClickCapture, true);

    // Faster fallback to avoid long waits (max 5 seconds)
    const fallback = setTimeout(() => setShowSplash(false), 5000);
    return () => {
      document.removeEventListener('DOMContentLoaded', onDomReady);
      document.removeEventListener('click', handleClickCapture, true);
      clearTimeout(fallback);
    };
  }, []);

  // Hide splash when all critical data is ready
  useEffect(() => {
    if (docLoaded && allReady) {
      const id = requestAnimationFrame(() => setShowSplash(false));
      return () => cancelAnimationFrame(id);
    }
  }, [docLoaded, allReady]);

  // Global permission-denied toast (Arabic)
  useEffect(() => {
    const handler = (e: Event) => {
      const ev = e as CustomEvent<{ status: number; error?: string; resource?: string; action?: string; url?: unknown; userId?: string }>;
      const status = ev.detail?.status;
      const message = ev.detail?.error || (status === 401 ? 'غير مصرح: يرجى تسجيل الدخول' : 'تم رفض الإذن لهذه العملية');
      const extra = ev.detail?.resource ? ` (المورد: ${ev.detail.resource}${ev.detail?.action ? `، العملية: ${ev.detail.action}` : ''})` : '';
      toast({
        title: status === 401 ? 'غير مصرح' : 'صلاحيات غير كافية',
        description: `${message}${extra}`,
        variant: 'destructive',
      });
    };
    window.addEventListener('permission-denied', handler as EventListener);
    return () => window.removeEventListener('permission-denied', handler as EventListener);
  }, [toast]);

  return (
    <>
      {/* Scroll Progress Bar */}
      <ScrollProgressBar />

      {/* Global Splash overlay (desktop + mobile) */}
      {showSplash && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#020617] overflow-hidden transition-opacity duration-700">
          {/* Immersive Deep Space Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#020617] via-[#0f172a] to-[#020617]"></div>
          
          {/* Dynamic Light Rays / Orbs */}
          <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-primary/20 blur-[150px] rounded-full animate-splash-blob mix-blend-screen opacity-50"></div>
          <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-blue-600/15 blur-[150px] rounded-full animate-splash-blob mix-blend-screen opacity-50" style={{ animationDelay: '-4s' }}></div>
          
          <div className="text-center relative z-10 flex flex-col items-center scale-110">
            {/* Orbital Logo System */}
            <div className="relative mb-16 group">
              {/* Outer Orbital Ring 1 */}
              <div className="absolute inset-[-40px] border border-primary/10 rounded-full animate-[spin_8s_linear_infinite] scale-100 opacity-60">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_#3b82f6]"></div>
              </div>
              
              {/* Outer Orbital Ring 2 */}
              <div className="absolute inset-[-40px] border border-blue-500/10 rounded-full animate-[spin_12s_linear_infinite_reverse] scale-90 opacity-40">
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 bg-blue-400 rounded-full shadow-[0_0_8px_#60a5fa]"></div>
              </div>

              {/* Inner Glowing Aura */}
              <div className="absolute inset-[-10px] bg-primary/10 blur-3xl rounded-full scale-110 animate-pulse"></div>
              
              {/* Main Logo Container */}
              <div className="relative w-40 h-40 flex items-center justify-center bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 shadow-[0_35px_60px_-15px_rgba(0,0,0,0.5)] animate-splash-pulse">
                <img src="/iconPng.png" alt="Logo" className="w-24 h-24 object-contain drop-shadow-[0_0_25px_rgba(59,130,246,0.6)]" />
                
                {/* Micro-Interaction Highlight */}
                <div className="absolute inset-0 bg-gradient-to-tr from-white/10 to-transparent rounded-[2.5rem]"></div>
              </div>
            </div>

            {/* Typography Section */}
            <div className="space-y-8 max-w-sm">
              <div className="flex flex-col items-center gap-3">
                <h2 className="text-white text-3xl font-black tracking-[0.25em] uppercase animate-splash-text bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40 drop-shadow-sm font-cairo">
                  {siteName || 'جاري التحميل'}
                </h2>
                <div className="h-1 w-20 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full opacity-50"></div>
              </div>
              
              {/* High-End Progress Section */}
              <div className="relative w-64">
                <p className="text-primary/40 font-black text-[10px] uppercase tracking-[0.5em] mb-4 animate-pulse">
                  SYSTEM INITIALIZING
                </p>
                <div className="h-[2px] w-full bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-primary w-2/3 rounded-full animate-[shimmer_2.5s_infinite] shadow-[0_0_15px_#3b82f6]"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer Detail */}
          <div className="fixed bottom-12 left-0 right-0 flex justify-center opacity-20 hover:opacity-100 transition-opacity duration-1000">
             <div className="flex items-center gap-4 text-[9px] font-black tracking-[0.4em] text-white/50 uppercase">
                <span>Secure Console</span>
                <span className="w-1 h-1 bg-primary rounded-full"></span>
                <span>Powered by Al-Hegazi v2.0</span>
             </div>
          </div>
        </div>
      )}
      <Layout>
        <Suspense fallback={<div className="p-6 text-center text-white/90">جارٍ تحميل الصفحة...</div>}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/products" element={<Products />} />
            <Route path="/product/:id" element={<ProductDetail />} />
            <Route path="/product/:productId/rating" element={<RatingMessage />} />
            <Route path="/categories" element={<Categories />} />
            <Route path="/category/:slug" element={<CategoryPage />} />
            <Route path="/featured" element={<FeaturedProducts />} />
            <Route path="/best-sellers" element={<BestSellers />} />
            <Route path="/special-offers" element={<SpecialOffers />} />
            <Route path="/latest" element={<LatestProducts />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<ModernCheckout />} />
            <Route path="/checkout/legacy" element={<Checkout />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                <Orders />
              </ProtectedRoute>
            } />
            <Route path="/order-history" element={
              <ProtectedRoute>
                <OrderHistory />
              </ProtectedRoute>
            } />
            <Route path="/order-confirmation" element={
              <ProtectedRoute>
                <OrderConfirmation />
              </ProtectedRoute>
            } />
            <Route path="/order/:id" element={
              <ProtectedRoute>
                <EnhancedOrderTracking />
              </ProtectedRoute>
            } />
            <Route path="/order/:id/legacy" element={
              <ProtectedRoute>
                <OrderTracking />
              </ProtectedRoute>
            } />
            <Route path="/track" element={<PublicOrderTracking />} />
            <Route path="/favorites" element={
              <ProtectedRoute>
                <Favorites />
              </ProtectedRoute>
            } />
            <Route path="/returns/:id" element={
              <ProtectedRoute>
                <Returns />
              </ProtectedRoute>
            } />
            <Route path="/addresses" element={
              <ProtectedRoute>
                <Addresses />
              </ProtectedRoute>
            } />
            <Route path="/payment-methods" element={
              <ProtectedRoute>
                <PaymentMethods />
              </ProtectedRoute>
            } />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/shop-setup" element={<ShopSetup />} />
            <Route path="/shop-builder" element={<ShopBuilderIntro />} />
            <Route path="/shop-builder/intro" element={<ShopBuilderIntro />} />
            <Route path="/shop-builder/editor" element={<ShopBuilder3DPage />} />


            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminDashboard />
              </DualProtectedRoute>
            } />
            <Route path="/admin/products" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminProducts />
              </DualProtectedRoute>
            } />
            <Route path="/admin/products-3d" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminProducts3D />
              </DualProtectedRoute>
            } />
            <Route path="/admin/models-3d-analytics" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminModels3DAnalytics />
              </DualProtectedRoute>
            } />
            <Route path="/admin/categories" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminCategories />
              </DualProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminOrders />
              </DualProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminUsers />
              </DualProtectedRoute>
            } />
            <Route path="/admin/locations" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminLocations />
              </DualProtectedRoute>
            } />
            <Route path="/admin/qr-codes" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminQRCodes />
              </DualProtectedRoute>
            } />
            <Route path="/admin/home-config" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminHomeConfig />
              </DualProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminSettings />
              </DualProtectedRoute>
            } />
            <Route path="/admin/history" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminHistory />
              </DualProtectedRoute>
            } />
            <Route path="/admin/order/:id" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminOrderTracking />
              </DualProtectedRoute>
            } />
            <Route path="/admin/profit" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminProfit />
              </DualProtectedRoute>
            } />
            <Route path="/admin/shareholders" element={
              <DualProtectedRoute requireAdmin={true}>
                <AdminShareholders />
              </DualProtectedRoute>
            } />


            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Suspense>
      </Layout>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <ThemeProvider>
        <DualAuthProvider>
          <BrowserRouter>
            <AppInner />
          </BrowserRouter>
        </DualAuthProvider>
      </ThemeProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
