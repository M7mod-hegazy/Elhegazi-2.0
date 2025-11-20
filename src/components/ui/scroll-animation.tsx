import { useEffect, useRef, useState } from 'react';

interface ScrollAnimationProps {
  children: React.ReactNode;
  className?: string;
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scaleIn' | 'rotateIn';
  delay?: number;
  duration?: number;
  threshold?: number;
  rootMargin?: string;
  staggerIndex?: number;
  staggerDelay?: number;
  disabled?: boolean; // NEW: Disable animation for main sections
}

const ScrollAnimation = ({
  children,
  className = '',
  animation = 'fadeIn',
  delay = 0,
  duration = 400,
  threshold = 0.01,
  rootMargin = '200px 0px 0px 0px',
  staggerIndex = 0,
  staggerDelay = 50,
  disabled = false
}: ScrollAnimationProps) => {
  const [isVisible, setIsVisible] = useState(disabled); // Show immediately if disabled
  const elementRef = useRef<HTMLDivElement>(null);
  
  // Check if user prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // If animation is disabled, show immediately (no animation)
    if (disabled) {
      setIsVisible(true);
      return;
    }

    // If user prefers reduced motion, show immediately
    if (prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Add stagger delay if provided
          const totalDelay = delay + (staggerIndex * staggerDelay);
          setTimeout(() => {
            setIsVisible(true);
          }, totalDelay);
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
  }, [delay, threshold, rootMargin, prefersReducedMotion, staggerIndex, staggerDelay, disabled]);

  const getAnimationStyle = (): React.CSSProperties => {
    const animDuration = prefersReducedMotion ? '0ms' : `${duration}ms`;
    const baseStyle: React.CSSProperties = {
      transition: `all ${animDuration} cubic-bezier(0.4, 0, 0.2, 1)`,
      willChange: 'transform, opacity',
    };

    if (!isVisible) {
      switch (animation) {
        case 'fadeIn':
          return { ...baseStyle, opacity: 0, transform: 'translateY(32px)' };
        case 'slideUp':
          return { ...baseStyle, opacity: 0, transform: 'translateY(64px)' };
        case 'slideLeft':
          return { ...baseStyle, opacity: 0, transform: 'translateX(64px)' };
        case 'slideRight':
          return { ...baseStyle, opacity: 0, transform: 'translateX(-64px)' };
        case 'scaleIn':
          return { ...baseStyle, opacity: 0, transform: 'scale(0.75)' };
        case 'rotateIn':
          return { ...baseStyle, opacity: 0, transform: 'rotate(12deg) scale(0.75)' };
        default:
          return { ...baseStyle, opacity: 0 };
      }
    } else {
      return { ...baseStyle, opacity: 1, transform: 'translateY(0) translateX(0) scale(1) rotate(0)' };
    }
  };

  return (
    <div
      ref={elementRef}
      style={getAnimationStyle()}
      className={className}
    >
      {children}
    </div>
  );
};

export default ScrollAnimation;
