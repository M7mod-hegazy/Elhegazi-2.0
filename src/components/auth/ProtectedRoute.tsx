import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
}

const ProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  redirectTo 
}: ProtectedRouteProps) => {
  const { isAuthenticated, isAdmin, loading } = useDualAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't redirect while auth is still loading
    if (loading) return;

    // Check if user is authenticated
    if (!isAuthenticated) {
      const defaultRedirect = requireAdmin ? '/admin/login' : '/login';
      navigate(redirectTo || defaultRedirect, {
        replace: true,
        state: { from: location }
      });
      return;
    }

    // Check if admin access is required
    if (requireAdmin && !isAdmin) {
      navigate('/admin/login', {
        replace: true,
        state: { from: location }
      });
      return;
    }
  }, [isAuthenticated, isAdmin, loading, navigate, location, requireAdmin, redirectTo]);

  // Show loading or nothing while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-slate-600">جاري التحقق من الصلاحيات...</span>
        </div>
      </div>
    );
  }

  // Don't render children if not authenticated or not admin (when required)
  if (!isAuthenticated || (requireAdmin && !isAdmin)) {
    return null;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
