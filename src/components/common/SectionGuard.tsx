import React from 'react';
import { Navigate } from 'react-router-dom';
import { useSectionVisibility } from '@/hooks/useSectionVisibility';

interface SectionGuardProps {
  section: 'featuredProducts' | 'bestSellers' | 'sale' | 'newArrivals';
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Component that guards section pages based on admin visibility settings
 */
export const SectionGuard: React.FC<SectionGuardProps> = ({ 
  section, 
  children, 
  fallback 
}) => {
  const { visibility, loading } = useSectionVisibility();

  // Show loading state while checking visibility
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 via-white to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-lg text-muted-foreground">جاري التحقق من إعدادات القسم...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to 404 if section is disabled
  if (!visibility[section]) {
    return fallback || <Navigate to="/404" replace />;
  }

  // Render children if section is enabled
  return <>{children}</>;
};
