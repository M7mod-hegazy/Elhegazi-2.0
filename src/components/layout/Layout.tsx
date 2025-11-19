import { ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import CartSidebar from '@/components/cart/CartSidebar';
import AuthModal from '@/components/ui/auth-modal';
import Logo from '@/components/ui/Logo';
 

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const location = useLocation();
  const [transitioning, setTransitioning] = useState(false);
  const prefersReducedMotion = useMemo(() => {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);
  
  // Removed localStorage initialization; data now fetched from API

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  // Global page transition overlay on route change
  useEffect(() => {
    if (prefersReducedMotion) return; // Respect user preference
    setTransitioning(true);
    const t = setTimeout(() => setTransitioning(false), 900);
    return () => clearTimeout(t);
  }, [location.pathname, prefersReducedMotion]);

  // Check if current route is admin
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Don't show navbar/footer for admin routes
  if (isAdminRoute) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden">
        {children}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      <Navbar />
      <main className="flex-1 overflow-x-hidden">
        {children}
      </main>
      <Footer />
      <CartSidebar />

      {/* Global reload / page transition overlay (refined visuals, very large) */}
      {!prefersReducedMotion && (
        <div
          className={`fixed inset-0 z-[80] ${transitioning ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-700`}
          aria-hidden="true"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/40 backdrop-blur-sm transition-colors duration-700" />
          {/* Expanding circle to fully cover viewport */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            {/* Aura ring */}
            <div
              className="absolute -inset-6 rounded-full opacity-60 blur-2xl"
              style={{
                background: 'conic-gradient(from 0deg, rgba(59,130,246,0.25), rgba(147,51,234,0.25), rgba(59,130,246,0.25))',
                transform: transitioning ? 'scale(1)' : 'scale(0.2)',
                transition: 'transform 900ms ease-out',
              }}
            />
            <div
              className="rounded-full shadow-2xl flex items-center justify-center text-primary-foreground relative overflow-hidden"
              style={{
                width: transitioning ? '200vmax' : '0px',
                height: transitioning ? '200vmax' : '0px',
                transition: 'width 900ms cubic-bezier(0.16, 1, 0.3, 1), height 900ms cubic-bezier(0.16, 1, 0.3, 1)',
                willChange: 'width, height',
                background:
                  'radial-gradient(60% 60% at 50% 50%, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0) 60%), linear-gradient(135deg, var(--tw-color-primary), #6d28d9)',
              }}
            >
              {/* Soft inner ring */}
              <div className="absolute inset-0 rounded-full ring-1 ring-white/20" />
              {/* Centered logo for brand presence */}
              <div className={`transition-transform duration-700 ${transitioning ? 'scale-100' : 'scale-75'}`}>
                <Logo size="xl" showText={false} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
