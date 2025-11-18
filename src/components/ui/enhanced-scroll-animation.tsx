import { useEffect, useRef, useState } from 'react';

interface EnhancedScrollAnimationProps {
  children: React.ReactNode;
  animation?: 'slideInLeft' | 'slideInRight' | 'slideInUp' | 'slideInDown' | 'fadeIn' | 'scaleIn' | 'rotateIn';
  duration?: number;
  delay?: number;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  pauseOnHover?: boolean;
  autoSlide?: boolean;
  slideInterval?: number;
}

const EnhancedScrollAnimation = ({
  children,
  animation = 'slideInUp',
  duration = 700,
  delay = 0,
  threshold = 0.1,
  rootMargin = '0px 0px -10% 0px',
  className = '',
  pauseOnHover = true,
  autoSlide = false,
  slideInterval = 3000
}: EnhancedScrollAnimationProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0);
  const elementRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Intersection Observer for scroll animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => {
            setIsVisible(true);
          }, delay);
        }
      },
      { threshold, rootMargin }
    );

    const currentEl = elementRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, [delay, threshold, rootMargin]);

  // Auto slide functionality
  useEffect(() => {
    if (autoSlide && isVisible && !isHovered) {
      intervalRef.current = setInterval(() => {
        setSlideIndex(prev => prev + 1);
      }, slideInterval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoSlide, isVisible, isHovered, slideInterval]);

  const getAnimationClass = () => {
    if (!isVisible) return 'opacity-0';

    const baseClasses = 'transition-all ease-out';
    const durationClass = `duration-${Math.min(duration, 1000)}`;

    switch (animation) {
      case 'slideInLeft':
        return `${baseClasses} ${durationClass} transform translate-x-0 opacity-100`;
      case 'slideInRight':
        return `${baseClasses} ${durationClass} transform translate-x-0 opacity-100`;
      case 'slideInUp':
        return `${baseClasses} ${durationClass} transform translate-y-0 opacity-100`;
      case 'slideInDown':
        return `${baseClasses} ${durationClass} transform translate-y-0 opacity-100`;
      case 'fadeIn':
        return `${baseClasses} ${durationClass} opacity-100`;
      case 'scaleIn':
        return `${baseClasses} ${durationClass} transform scale-100 opacity-100`;
      case 'rotateIn':
        return `${baseClasses} ${durationClass} transform rotate-0 opacity-100`;
      default:
        return `${baseClasses} ${durationClass} opacity-100`;
    }
  };

  const getInitialClass = () => {
    const baseClasses = 'transition-all ease-out';
    const durationClass = `duration-${Math.min(duration, 1000)}`;

    switch (animation) {
      case 'slideInLeft':
        return `${baseClasses} ${durationClass} transform -translate-x-16 opacity-0`;
      case 'slideInRight':
        return `${baseClasses} ${durationClass} transform translate-x-16 opacity-0`;
      case 'slideInUp':
        return `${baseClasses} ${durationClass} transform translate-y-16 opacity-0`;
      case 'slideInDown':
        return `${baseClasses} ${durationClass} transform -translate-y-16 opacity-0`;
      case 'fadeIn':
        return `${baseClasses} ${durationClass} opacity-0`;
      case 'scaleIn':
        return `${baseClasses} ${durationClass} transform scale-0 opacity-0`;
      case 'rotateIn':
        return `${baseClasses} ${durationClass} transform rotate-180 opacity-0`;
      default:
        return `${baseClasses} ${durationClass} opacity-0`;
    }
  };

  const handleMouseEnter = () => {
    if (pauseOnHover) {
      setIsHovered(true);
    }
  };

  const handleMouseLeave = () => {
    if (pauseOnHover) {
      setIsHovered(false);
    }
  };

  return (
    <div
      ref={elementRef}
      className={`${isVisible ? getAnimationClass() : getInitialClass()} ${className}`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        animationDelay: `${delay}ms`,
        ...(autoSlide && {
          transform: `translateX(-${slideIndex * 100}px)`,
        })
      }}
    >
      {children}
    </div>
  );
};

export default EnhancedScrollAnimation;
