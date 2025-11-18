import { useTheme } from '@/context/ThemeContext';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'w-6 h-6',
  md: 'w-8 h-8',
  lg: 'w-12 h-12',
};

export const Logo = ({ className = '', size = 'md' }: LogoProps) => {
  const { logo } = useTheme();
  
  return (
    <div className={`bg-white rounded-xl flex items-center justify-center shadow-lg border border-slate-200/50 p-2 ${className}`}>
      <img 
        src={logo || 'https://api.dicebear.com/7.x/shapes/svg?seed=store&backgroundColor=3B82F6'} 
        alt="Logo" 
        className={`${sizeClasses[size]} object-contain`}
      />
    </div>
  );
};

export default Logo;
