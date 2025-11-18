import { useEffect, useRef, useState } from 'react';

interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scaleIn' | 'rotateIn';
  delay?: number;
  duration?: number;
  threshold?: number;
  rootMargin?: string;
}

const ScrollAnimation = ({
  children,
  className = '',
  animation = 'fadeIn',
  delay = 0,
  duration = 400,
  threshold = 0.01,
  rootMargin = '100px 0px -10% 0px'
}: ScrollAnimationProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const elementRef = useRef<HTMLDivElement>(null);

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

    const currentElement = elementRef.current;
    if (currentElement) {
      observer.observe(currentElement);
    }

    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [delay, threshold, rootMargin]);

  const getAnimationClasses = () => {
    const baseClasses = `transition-all ease-out`;
    const durationClass = `duration-${duration}`;
    
    if (!isVisible) {
      switch (animation) {
        case 'fadeIn':
          return `${baseClasses} ${durationClass} opacity-0 translate-y-8`;
        case 'slideUp':
          return `${baseClasses} ${durationClass} opacity-0 translate-y-16`;
        case 'slideLeft':
          return `${baseClasses} ${durationClass} opacity-0 translate-x-16`;
        case 'slideRight':
          return `${baseClasses} ${durationClass} opacity-0 -translate-x-16`;
        case 'scaleIn':
          return `${baseClasses} ${durationClass} opacity-0 scale-75`;
        case 'rotateIn':
          return `${baseClasses} ${durationClass} opacity-0 rotate-12 scale-75`;
        default:
          return `${baseClasses} ${durationClass} opacity-0`;
      }
    } else {
      return `${baseClasses} ${durationClass} opacity-100 translate-y-0 translate-x-0 scale-100 rotate-0`;
    }
  };

  return (
    <div
      ref={elementRef}
      className={`${getAnimationClasses()} ${className}`}
    >
      {children}
    </div>
  );
};

export default ScrollAnimation;
