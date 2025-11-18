import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle, XCircle, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from './button';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  variant?: 'default' | 'dots' | 'pulse' | 'bars';
}

export const LoadingSpinner = ({ size = 'md', className, variant = 'default' }: LoadingSpinnerProps) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12'
  };

  const variants = {
    default: (
      <Loader2 className={cn(
        'animate-spin text-primary',
        sizeClasses[size],
        className
      )} />
    ),
    dots: (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={cn(
              'bg-primary rounded-full animate-pulse',
              size === 'sm' ? 'h-1 w-1' : size === 'md' ? 'h-2 w-2' : 'h-3 w-3'
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    ),
    pulse: (
      <div className={cn(
        'bg-gradient-to-r from-blue-400 to-blue-600 rounded-full animate-pulse',
        sizeClasses[size],
        className
      )} />
    ),
    bars: (
      <div className={cn('flex space-x-1', className)}>
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            className={cn(
              'bg-primary animate-bounce',
              size === 'sm' ? 'h-3 w-0.5' : size === 'md' ? 'h-4 w-1' : 'h-6 w-1'
            )}
            style={{ animationDelay: `${i * 0.1}s` }}
          />
        ))}
      </div>
    )
  };

  return variants[variant];
};

interface LoadingButtonProps {
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  onClick?: () => void;
  type?: 'button' | 'submit';
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loadingText?: string;
}

export const LoadingButton = ({ 
  isLoading, 
  children, 
  className, 
  disabled,
  onClick,
  type = 'button',
  variant = 'default',
  size = 'md',
  loadingText
}: LoadingButtonProps) => {
  const baseClasses = 'flex items-center justify-center gap-2 font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed';
  
  const variantClasses = {
    default: 'bg-gradient-to-r from-primary to-secondary hover:from-primary-dark hover:to-secondary text-white shadow-lg hover:shadow-xl',
    outline: 'border-2 border-primary text-primary hover:bg-primary/5 hover:border-primary',
    ghost: 'text-primary hover:bg-primary/5'
  };
  
  const sizeClasses = {
    sm: 'h-8 px-3 text-sm rounded-md',
    md: 'h-10 px-4 rounded-lg',
    lg: 'h-12 px-6 text-lg rounded-xl'
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || isLoading}
      className={cn(
        baseClasses,
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
    >
      {isLoading && <LoadingSpinner size="sm" />}
      <span>{isLoading && loadingText ? loadingText : children}</span>
    </button>
  );
};

interface LoadingOverlayProps {
  isLoading: boolean;
  message?: string;
  className?: string;
  variant?: 'overlay' | 'inline' | 'card';
  size?: 'sm' | 'md' | 'lg';
}

export const LoadingOverlay = ({ 
  isLoading, 
  message = 'جاري التحميل...', 
  className,
  variant = 'overlay',
  size = 'md'
}: LoadingOverlayProps) => {
  if (!isLoading) return null;

  const variants = {
    overlay: (
      <div className={cn(
        'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center',
        className
      )}>
        <div className="bg-white/95 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-2xl p-8 flex flex-col items-center gap-4 max-w-sm mx-4">
          <LoadingSpinner size="lg" />
          <p className="text-slate-700 font-medium text-center">{message}</p>
        </div>
      </div>
    ),
    inline: (
      <div className={cn(
        'flex items-center justify-center gap-3 p-4',
        className
      )}>
        <LoadingSpinner size={size} />
        <span className="text-slate-600 font-medium">{message}</span>
      </div>
    ),
    card: (
      <div className={cn(
        'bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg p-6 flex flex-col items-center gap-4',
        className
      )}>
        <LoadingSpinner size="lg" />
        <p className="text-slate-700 font-medium text-center">{message}</p>
      </div>
    )
  };

  return variants[variant];
};

interface SkeletonProps {
  className?: string;
  variant?: 'default' | 'rounded' | 'circle';
  animate?: boolean;
}

export const Skeleton = ({ className, variant = 'default', animate = true }: SkeletonProps) => {
  const variantClasses = {
    default: 'rounded-lg',
    rounded: 'rounded-2xl',
    circle: 'rounded-full'
  };

  return (
    <div className={cn(
      'bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200',
      variantClasses[variant],
      animate && 'animate-pulse',
      className
    )} />
  );
};

export const ProductCardSkeleton = () => {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg p-4 space-y-4">
      <Skeleton className="aspect-square w-full" variant="rounded" />
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-5 w-5" variant="circle" />
        </div>
        <Skeleton className="h-10 w-full" variant="rounded" />
      </div>
    </div>
  );
};

export const TableRowSkeleton = ({ columns = 4 }: { columns?: number }) => {
  return (
    <tr className="border-b border-slate-100">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-4">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
};

export const CardSkeleton = ({ lines = 3 }: { lines?: number }) => {
  return (
    <div className="bg-white/80 backdrop-blur-xl border border-slate-200/50 rounded-2xl shadow-lg p-6 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8" variant="circle" />
        <Skeleton className="h-5 w-1/3" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
};

export const ProductGridSkeleton = ({ count = 6 }: { count?: number }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
};

// Enhanced Error Handling Components
interface ErrorStateProps {
  error: string | Error | null;
  onRetry?: () => void;
  className?: string;
  variant?: 'card' | 'inline' | 'page';
  title?: string;
  showRetry?: boolean;
}

export const ErrorState = ({
  error,
  onRetry,
  className,
  variant = 'card',
  title,
  showRetry = true
}: ErrorStateProps) => {
  if (!error) return null;

  const errorMessage = typeof error === 'string' ? error : error.message;
  const errorTitle = title || 'حدث خطأ';

  const variants = {
    card: (
      <div className={cn(
        'bg-red-50/80 backdrop-blur-xl border border-red-200 rounded-2xl shadow-lg p-6 text-center',
        className
      )}>
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-red-100 rounded-full">
            <XCircle className="w-8 h-8 text-red-600" />
          </div>
          <div>
            <h3 className="font-bold text-red-900 text-lg mb-2">{errorTitle}</h3>
            <p className="text-red-700 text-sm leading-relaxed">{errorMessage}</p>
          </div>
          {showRetry && onRetry && (
            <Button
              onClick={onRetry}
              variant="outline"
              className="border-red-300 text-red-700 hover:bg-red-50 hover:border-red-400"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              إعادة المحاولة
            </Button>
          )}
        </div>
      </div>
    ),
    inline: (
      <div className={cn(
        'flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-lg',
        className
      )}>
        <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-red-800 font-medium">{errorTitle}</p>
          <p className="text-red-600 text-sm">{errorMessage}</p>
        </div>
        {showRetry && onRetry && (
          <Button
            onClick={onRetry}
            size="sm"
            variant="ghost"
            className="text-red-700 hover:bg-red-100"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        )}
      </div>
    ),
    page: (
      <div className={cn(
        'min-h-[400px] flex items-center justify-center',
        className
      )}>
        <div className="text-center max-w-md">
          <div className="p-4 bg-red-100 rounded-full w-fit mx-auto mb-6">
            <XCircle className="w-12 h-12 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-900 mb-4">{errorTitle}</h1>
          <p className="text-red-700 mb-6 leading-relaxed">{errorMessage}</p>
          {showRetry && onRetry && (
            <Button
              onClick={onRetry}
              className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              إعادة المحاولة
            </Button>
          )}
        </div>
      </div>
    )
  };

  return variants[variant];
};

// Success State Component
interface SuccessStateProps {
  message: string;
  description?: string;
  className?: string;
  variant?: 'card' | 'inline';
  onClose?: () => void;
}

export const SuccessState = ({
  message,
  description,
  className,
  variant = 'card',
  onClose
}: SuccessStateProps) => {
  const variants = {
    card: (
      <div className={cn(
        'bg-green-50/80 backdrop-blur-xl border border-green-200 rounded-2xl shadow-lg p-6 text-center',
        className
      )}>
        <div className="flex flex-col items-center gap-4">
          <div className="p-3 bg-green-100 rounded-full">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <div>
            <h3 className="font-bold text-green-900 text-lg mb-2">{message}</h3>
            {description && <p className="text-green-700 text-sm">{description}</p>}
          </div>
          {onClose && (
            <Button
              onClick={onClose}
              variant="outline"
              className="border-green-300 text-green-700 hover:bg-green-50"
            >
              موافق
            </Button>
          )}
        </div>
      </div>
    ),
    inline: (
      <div className={cn(
        'flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-lg',
        className
      )}>
        <CheckCircle className="w-5 h-5 text-green-600" />
        <div className="flex-1">
          <p className="text-green-800 font-medium">{message}</p>
          {description && <p className="text-green-600 text-sm">{description}</p>}
        </div>
        {onClose && (
          <Button
            onClick={onClose}
            size="sm"
            variant="ghost"
            className="text-green-700 hover:bg-green-100"
          >
            ✕
          </Button>
        )}
      </div>
    )
  };

  return variants[variant];
};

// Page Loading State
export const PageLoadingState = ({ message = 'جاري تحميل الصفحة...' }: { message?: string }) => {
  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="text-center">
        <LoadingSpinner size="xl" className="mx-auto mb-4" />
        <p className="text-slate-600 font-medium">{message}</p>
      </div>
    </div>
  );
};

// Empty State Component
interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ComponentType<{ className?: string }>;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
}

export const EmptyState = ({
  title,
  description,
  icon: Icon = AlertCircle,
  action,
  className
}: EmptyStateProps) => {
  return (
    <div className={cn(
      'flex flex-col items-center justify-center text-center p-8 min-h-[300px]',
      className
    )}>
      <div className="p-4 bg-slate-100 rounded-full mb-6">
        <Icon className="w-12 h-12 text-slate-400" />
      </div>
      <h3 className="text-xl font-bold text-slate-900 mb-2">{title}</h3>
      {description && (
        <p className="text-slate-600 mb-6 max-w-md leading-relaxed">{description}</p>
      )}
      {action && (
        <Button
          onClick={action.onClick}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
        >
          {action.label}
        </Button>
      )}
    </div>
  );
};