import { Link } from 'react-router-dom';
import { useLogo } from '@/hooks/useLogo';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showText?: boolean;
  className?: string;
  linkTo?: string;
}

const Logo = ({ size = 'md', showText = false, className = '', linkTo = '/' }: LogoProps) => {
  const { logo, isLoading } = useLogo();
  
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16',
    '2xl': 'w-20 h-20'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-xl',
    xl: 'text-2xl',
    '2xl': 'text-3xl'
  };

  const LogoContent = () => (
    <div className={`flex items-center space-x-2 space-x-reverse ${className}`}>
      {!isLoading && logo?.url && (
        <img 
          src={logo.url} 
          alt={logo.altText || 'Store Logo'} 
          className={`${sizeClasses[size]} object-contain transition-transform duration-300 hover:scale-105`}
          onError={(e) => {
            console.error('Logo failed to load:', logo.url);
            e.currentTarget.src = 'https://api.dicebear.com/7.x/shapes/svg?seed=store&backgroundColor=3B82F6';
          }}
        />
      )}
      {isLoading && (
        <div className={`${sizeClasses[size]} bg-slate-200 animate-pulse rounded`} />
      )}
      {showText && logo?.altText && (
        <span className={`font-bold text-primary ${textSizeClasses[size]}`}>
          {logo.altText}
        </span>
      )}
    </div>
  );

  if (linkTo) {
    return (
      <Link to={linkTo} className="transition-opacity duration-300 hover:opacity-80">
        <LogoContent />
      </Link>
    );
  }

  return <LogoContent />;
};

export default Logo;