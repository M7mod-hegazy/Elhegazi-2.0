import { ReactNode } from 'react';
import { Button } from './button';

interface CTAButton {
  label: string;
  href?: string;
  onClick?: () => void;
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'sm' | 'default' | 'lg';
  icon?: ReactNode;
}

interface HeroCTAProps {
  buttons: CTAButton[];
  layout?: 'horizontal' | 'vertical';
}

const HeroCTA = ({ buttons, layout = 'horizontal' }: HeroCTAProps) => {
  const containerClasses = layout === 'horizontal' 
    ? 'flex flex-col sm:flex-row gap-4 justify-center items-center'
    : 'flex flex-col gap-4 items-center';

  return (
    <div className={containerClasses}>
      {buttons.map((button, index) => (
        <Button
          key={index}
          size={button.size || 'lg'}
          variant={button.variant || 'default'}
          className={`${
            button.variant === 'outline' 
              ? 'border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary' 
              : button.variant === 'ghost'
              ? 'text-primary-foreground hover:bg-primary-foreground/10'
              : 'bg-primary-foreground text-primary hover:bg-primary-foreground/90'
          } min-w-[160px] font-semibold transition-all duration-300 hover:scale-105 hover:shadow-lg`}
          onClick={button.onClick}
          asChild={!!button.href}
        >
          {button.href ? (
            <a href={button.href} className="flex items-center gap-2">
              {button.icon}
              {button.label}
            </a>
          ) : (
            <span className="flex items-center gap-2">
              {button.icon}
              {button.label}
            </span>
          )}
        </Button>
      ))}
    </div>
  );
};

export default HeroCTA;