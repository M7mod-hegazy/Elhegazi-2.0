import { ReactNode, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDualAuth } from '@/hooks/useDualAuth';

interface DualProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
  redirectTo?: string;
}

const DualProtectedRoute = ({ 
  children, 
  requireAdmin = false, 
  redirectTo 
}: DualProtectedRouteProps) => {
  const { isAuthenticated, isAdminAuthenticated, loading } = useDualAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Don't redirect while auth is still loading
    if (loading) return;

    // Check if user is authenticated
    if (requireAdmin) {
      // For admin routes, check admin authentication
      if (!isAdminAuthenticated) {
        navigate(redirectTo || '/admin/login', {
          replace: true,
          state: { from: location }
        });
        return;
      }
    } else {
      // For regular routes, check regular authentication
      if (!isAuthenticated) {
        navigate(redirectTo || '/login', {
          replace: true,
          state: { from: location }
        });
        return;
      }
    }
  }, [isAuthenticated, isAdminAuthenticated, loading, navigate, location, requireAdmin, redirectTo]);

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

  // Don't render children if not authenticated
  if (requireAdmin && !isAdminAuthenticated) {
    return null;
  }
  
  if (!requireAdmin && !isAuthenticated) {
    return null;
  }

  return <>{children}</>;
};

export default DualProtectedRoute;