import { useEffect, useState, ReactNode } from 'react';
import { canAccessPage, isSuperAdmin } from '@/lib/permissions';
import UnauthorizedAccess from './UnauthorizedAccess';
import { LoadingSpinner } from '@/components/ui/loading';

interface PermissionGuardProps {
  children: ReactNode;
  pageName: string;
  resource?: string;
}

const PermissionGuard = ({ children, pageName, resource }: PermissionGuardProps) => {
  const [isChecking, setIsChecking] = useState(true);
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkPermission = async () => {
      setIsChecking(true);
      
      // SuperAdmin always has access
      if (isSuperAdmin()) {
        setHasAccess(true);
        setIsChecking(false);
        return;
      }

      // Check specific page permission
      const canAccess = await canAccessPage(pageName);
      setHasAccess(canAccess);
      setIsChecking(false);
    };

    checkPermission();
  }, [pageName]);

  if (isChecking) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner />
      </div>
    );
  }

  if (!hasAccess) {
    return <UnauthorizedAccess resource={resource || pageName} />;
  }

  return <>{children}</>;
};

export default PermissionGuard;
