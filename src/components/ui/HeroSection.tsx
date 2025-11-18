import { ReactNode } from 'react';

interface HeroSectionProps {
  title: string;
  subtitle?: string;
  description?: string;
  backgroundImage?: string;
  backgroundImageAlt?: string;
  children?: ReactNode;
  variant?: 'default' | 'gradient' | 'image';
  size?: 'sm' | 'md' | 'lg';
  overlay?: boolean;
}

const HeroSection = ({
  title,
  subtitle,
  description,
  backgroundImage,
  backgroundImageAlt,
  children,
  variant = 'gradient',
  size = 'lg',
  overlay = true
}: HeroSectionProps) => {
  const sizeClasses = {
    sm: 'py-12',
    md: 'py-16',
    lg: 'py-20 lg:py-28'
  };

  const getBackgroundClasses = () => {
    switch (variant) {
      case 'image':
        return 'relative bg-cover bg-center bg-no-repeat';
      case 'gradient':
        return 'bg-gradient-to-br from-primary via-primary-dark to-primary-light';
      default:
        return 'bg-primary';
    }
  };

  return (
    <section 
      className={`${sizeClasses[size]} ${getBackgroundClasses()} text-primary-foreground relative overflow-hidden`}
      style={variant === 'image' && backgroundImage ? { backgroundImage: `url(${backgroundImage})` } : undefined}
    >
      {/* Background Image (alternative approach) */}
      {variant === 'image' && backgroundImage && (
        <div className="absolute inset-0 z-0">
          <img
            src={backgroundImage}
            alt={backgroundImageAlt || ''}
            className="w-full h-full object-cover"
            style={{ width: '100%', height: '100%' }}
          />
        </div>
      )}

      {/* Overlay */}
      {overlay && variant === 'image' && (
        <div className="absolute inset-0 bg-primary/80 z-10"></div>
      )}

      {/* Animated Background Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-foreground/10 rounded-full animate-float"></div>
        <div className="absolute -bottom-32 -left-32 w-64 h-64 bg-primary-foreground/5 rounded-full animate-float" style={{ animationDelay: '2s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-32 h-32 bg-primary-foreground/5 rounded-full animate-float" style={{ animationDelay: '4s' }}></div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 relative z-20">
        <div className="text-center max-w-4xl mx-auto">
          {subtitle && (
            <div className="inline-block px-4 py-2 bg-primary-foreground/10 rounded-full text-sm font-medium mb-6 backdrop-blur-sm">
              {subtitle}
            </div>
          )}
          
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-6 animate-fade-in">
            <span className="bg-gradient-to-r from-primary-foreground to-primary-foreground/80 bg-clip-text text-transparent">
              {title}
            </span>
          </h1>
          
          {description && (
            <p className="text-lg md:text-xl lg:text-2xl text-primary-foreground/90 leading-relaxed mb-8 max-w-3xl mx-auto animate-fade-in" style={{ animationDelay: '0.2s' }}>
              {description}
            </p>
          )}
          
          {children && (
            <div className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
              {children}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Wave */}
      <div className="absolute bottom-0 left-0 right-0">
        <svg
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
          className="w-full h-12 fill-background"
        >
          <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z"
            opacity=".25"
          />
          <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z"
            opacity=".5"
          />
          <path d="M0,0V5.63C149.93,59,314.09,71.32,475.83,42.57c43-7.64,84.23-20.12,127.61-26.46,59-8.63,112.48,12.24,165.56,35.4C827.93,77.22,886,95.24,951.2,90c86.53-7,172.46-45.71,248.8-84.81V0Z" />
        </svg>
      </div>
    </section>
  );
};

export default HeroSection;