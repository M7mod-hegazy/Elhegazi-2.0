import React, { useEffect, useRef, useState } from 'react';

interface StaggerAnimationProps {
  children: React.ReactNode[];
  animation?: 'fadeIn' | 'slideUp' | 'slideLeft' | 'slideRight' | 'scaleIn' | 'rotateIn';
  staggerDelay?: number;
  duration?: number;
  threshold?: number;
  rootMargin?: string;
  className?: string;
  disabled?: boolean; // NEW: Disable animation for main sections
}

/**
 * StaggerAnimation Component
 * Animates a list of children with a staggered delay
 * Perfect for product grids, lists, and other sequential content
 * 
 * Usage:
 * <StaggerAnimation staggerDelay={50} duration={400}>
 *   {items.map((item, i) => <div key={i}>{item}</div>)}
 * </StaggerAnimation>
 */
const StaggerAnimation = ({
  children,
  animation = 'fadeIn',
  staggerDelay = 50,
  duration = 400,
  threshold = 0.01,
  rootMargin = '200px 0px 0px 0px',
  className = '',
  disabled = false,
}: StaggerAnimationProps) => {
  // If disabled, show all items immediately
  const initialVisibleSet: Set<number> = disabled ? new Set(Array.from({ length: React.Children.count(children) }, (_, i) => i)) : new Set();
  const [visibleIndices, setVisibleIndices] = useState<Set<number>>(initialVisibleSet);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Check if user prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined' && 
    window.matchMedia && 
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  useEffect(() => {
    // If animation is disabled, show all immediately (no animation)
    if (disabled) {
      setVisibleIndices(new Set(Array.from({ length: React.Children.count(children) }, (_, i) => i)));
      return;
    }

    // If user prefers reduced motion, show all immediately
    if (prefersReducedMotion) {
      setVisibleIndices(new Set(Array.from({ length: React.Children.count(children) }, (_, i) => i)));
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Animate each child with stagger
          const childCount = React.Children.count(children);
          Array.from({ length: childCount }).forEach((_, index) => {
            setTimeout(() => {
              setVisibleIndices(prev => new Set([...prev, index]));
            }, index * staggerDelay);
          });
        }
      },
      { threshold, rootMargin }
    );

    const currentContainer = containerRef.current;
    if (currentContainer) {
      observer.observe(currentContainer);
    }

    return () => {
      if (currentContainer) {
        observer.unobserve(currentContainer);
      }
    };
  }, [children, staggerDelay, threshold, rootMargin, prefersReducedMotion, disabled]);

  const getAnimationStyle = (index: number): React.CSSProperties => {
    const isVisible = visibleIndices.has(index);
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
    <div ref={containerRef} className={className}>
      {React.Children.map(children, (child, index) => (
        <div key={index} style={getAnimationStyle(index)}>
          {child}
        </div>
      ))}
    </div>
  );
};

export default StaggerAnimation;
