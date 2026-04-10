import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { DualAuthProvider } from "@/context/DualAuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
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
import { useOwnerVisibility } from "@/hooks/useOwnerVisibility";
const lazyWithFallback = (loader: () => Promise<any>, label: string) =>
  lazy(() =>
    loader()
      .then((mod: any) => {
        const candidate = mod?.default;
        const isValidComponent =
          typeof candidate === "function" ||
          (typeof candidate === "object" && candidate !== null && "$$typeof" in candidate);

        if (isValidComponent) return { default: candidate };

        console.error(`[lazy] Invalid default export for ${label}`, mod);
        return {
          default: () => (
            <div className="flex items-center justify-center h-screen">
              <p>تعذر تحميل الصفحة. يرجى تحديث المتصفح.</p>
            </div>
          ),
        };
      })
      .catch((error) => {
        console.error(`[lazy] Failed to load ${label}`, error);
        return {
          default: () => (
            <div className="flex items-center justify-center h-screen">
              <p>تعذر تحميل الصفحة. يرجى تحديث المتصفح.</p>
            </div>
          ),
        };
      })
  );

const HomePage = lazyWithFallback(() => import("@/pages/Index"), "HomePage");
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
const ShopBuilder3DPage = lazyWithFallback(
  () => import("@/features/shop-builder/ShopBuilder3DPage"),
  "ShopBuilder3DPage"
);
const ShopSetup = lazy(() => import("./pages/ShopSetup"));
const ShopBuilderIntro = lazy(() => import("./pages/ShopBuilderIntro"));
const ShopBuilderProjects = lazy(() => import("./pages/ShopBuilderProjects"));
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
  const { siteName } = useSiteName();
  const { toast } = useToast();
  const [docLoaded, setDocLoaded] = useState(false);
  const { loading: ownerVisibilityLoading, isVisible } = useOwnerVisibility();

  // Update favicon and loading screen logo dynamically
  useFavicon();
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
      cacheSiteName(siteName);
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

    return () => {
      document.removeEventListener('DOMContentLoaded', onDomReady);
      document.removeEventListener('click', handleClickCapture, true);
    };
  }, []);

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
      <Layout>
        <Suspense fallback={<div className="p-6 text-center text-white/90">جارٍ تحميل الصفحة...</div>}>
          {ownerVisibilityLoading ? (
            <div className="p-6 text-center text-white/90">جارٍ تجهيز الصلاحيات...</div>
          ) : (
          <Routes>
            <Route path="/" element={isVisible('publicPages', 'home') ? <HomePage /> : <NotFound />} />
            <Route path="/products" element={isVisible('publicPages', 'products') ? <Products /> : <NotFound />} />
            <Route path="/product/:id" element={isVisible('publicPages', 'productDetail') ? <ProductDetail /> : <NotFound />} />
            <Route path="/product/:productId/rating" element={isVisible('featureFlags', 'rating') ? <RatingMessage /> : <NotFound />} />
            <Route path="/categories" element={isVisible('publicPages', 'categories') ? <Categories /> : <NotFound />} />
            <Route path="/category/:slug" element={isVisible('publicPages', 'categories') ? <CategoryPage /> : <NotFound />} />
            <Route path="/featured" element={isVisible('publicPages', 'products') ? <FeaturedProducts /> : <NotFound />} />
            <Route path="/best-sellers" element={isVisible('publicPages', 'products') ? <BestSellers /> : <NotFound />} />
            <Route path="/special-offers" element={isVisible('publicPages', 'products') ? <SpecialOffers /> : <NotFound />} />
            <Route path="/latest" element={isVisible('publicPages', 'products') ? <LatestProducts /> : <NotFound />} />
            <Route path="/cart" element={isVisible('publicPages', 'cart') ? <Cart /> : <NotFound />} />
            <Route path="/checkout" element={isVisible('publicPages', 'checkout') ? <ModernCheckout /> : <NotFound />} />
            <Route path="/checkout/legacy" element={isVisible('publicPages', 'checkout') ? <Checkout /> : <NotFound />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/profile" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'profile') ? <Profile /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/orders" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'orders') ? <Orders /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/order-history" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'orders') ? <OrderHistory /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/order-confirmation" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'orders') ? <OrderConfirmation /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/order/:id" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'orders') ? <EnhancedOrderTracking /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/order/:id/legacy" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'orders') ? <OrderTracking /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/track" element={isVisible('publicPages', 'orders') ? <PublicOrderTracking /> : <NotFound />} />
            <Route path="/favorites" element={
              <ProtectedRoute>
                {(isVisible('publicPages', 'favorites') && isVisible('featureFlags', 'favorites')) ? <Favorites /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/returns/:id" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'orders') ? <Returns /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/addresses" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'profile') ? <Addresses /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/payment-methods" element={
              <ProtectedRoute>
                {isVisible('publicPages', 'profile') ? <PaymentMethods /> : <NotFound />}
              </ProtectedRoute>
            } />
            <Route path="/about" element={isVisible('publicPages', 'about') ? <About /> : <NotFound />} />
            <Route path="/contact" element={isVisible('publicPages', 'contact') ? <Contact /> : <NotFound />} />
            <Route path="/locations" element={isVisible('publicPages', 'locations') ? <Locations /> : <NotFound />} />
            <Route path="/shop-setup" element={isVisible('publicPages', 'shopBuilder') ? <ShopSetup /> : <NotFound />} />
            <Route path="/shop-builder" element={isVisible('publicPages', 'shopBuilder') ? <ShopBuilderIntro /> : <NotFound />} />
            <Route path="/shop-builder/intro" element={isVisible('publicPages', 'shopBuilder') ? <ShopBuilderIntro /> : <NotFound />} />
            <Route path="/shop-builder/projects" element={isVisible('publicPages', 'shopBuilder') ? <ShopBuilderProjects /> : <NotFound />} />
            <Route path="/shop-builder/editor" element={isVisible('publicPages', 'shopBuilder') ? <ShopBuilder3DPage /> : <NotFound />} />
            <Route path="/shop-builder/editor/:projectId" element={isVisible('publicPages', 'shopBuilder') ? <ShopBuilder3DPage /> : <NotFound />} />


            {/* Admin Routes */}
            <Route path="/admin" element={<AdminLogin />} />
            <Route path="/admin/login" element={<AdminLogin />} />
            <Route path="/admin/dashboard" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'dashboard') ? <AdminDashboard /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/products" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'products') ? <AdminProducts /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/products-3d" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'products3d') ? <AdminProducts3D /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/models-3d-analytics" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'products3d') ? <AdminModels3DAnalytics /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/categories" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'categories') ? <AdminCategories /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/orders" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'orders') ? <AdminOrders /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'users') ? <AdminUsers /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/locations" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'locations') ? <AdminLocations /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/qr-codes" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'qrcodes') ? <AdminQRCodes /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/home-config" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'homeConfig') ? <AdminHomeConfig /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/settings" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'settings') ? <AdminSettings /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/history" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'history') ? <AdminHistory /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/order/:id" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'orders') ? <AdminOrderTracking /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/profit" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'profit') ? <AdminProfit /> : <NotFound />}
              </DualProtectedRoute>
            } />
            <Route path="/admin/shareholders" element={
              <DualProtectedRoute requireAdmin={true}>
                {isVisible('adminModules', 'shareholders') ? <AdminShareholders /> : <NotFound />}
              </DualProtectedRoute>
            } />


            {/* Catch-all route */}
            <Route path="*" element={<NotFound />} />
          </Routes>
          )}
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
