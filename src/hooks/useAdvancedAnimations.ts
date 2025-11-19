import { useEffect, useRef, useState, useCallback } from 'react';
import { useResponsiveContext } from '@/context/ResponsiveContext';

export interface AnimationConfig {
  duration: number;
  delay: number;
  easing: string;
  threshold: number;
  rootMargin: string;
}

export interface ScrollAnimationOptions extends Partial<AnimationConfig> {
  animation: 'fadeIn' | 'slideUp' | 'slideDown' | 'slideLeft' | 'slideRight' | 'scaleIn' | 'rotateIn' | 'parallax';
  triggerOnce?: boolean;
  disabled?: boolean;
}

export const useAdvancedScrollAnimation = (options: ScrollAnimationOptions) => {
  const { shouldEnableAnimations, animationQuality, device } = useResponsiveContext();
  const [isVisible, setIsVisible] = useState(false);
  const [isTriggered, setIsTriggered] = useState(false);
  const elementRef = useRef<HTMLElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Default configurations based on animation quality
  const getConfig = useCallback((): AnimationConfig => {
    const baseConfig = {
      duration: 600,
      delay: 0,
      easing: 'cubic-bezier(0.4, 0, 0.2, 1)',
      threshold: 0.1,
      rootMargin: '0px 0px -50px 0px',
    };

    switch (animationQuality) {
      case 'low':
        return {
          ...baseConfig,
          duration: 300,
          threshold: 0.3,
        };
      case 'medium':
        return {
          ...baseConfig,
          duration: 450,
          threshold: 0.2,
        };
      case 'high':
        return {
          ...baseConfig,
          duration: 800,
          threshold: 0.05,
          easing: 'cubic-bezier(0.16, 1, 0.3, 1)',
        };
      default:
        return baseConfig;
    }
  }, [animationQuality]);

  const config = { ...getConfig(), ...options };

  // Check if animations should be disabled
  const isDisabled = options.disabled || !shouldEnableAnimations || device.prefersReducedMotion;

  useEffect(() => {
    if (isDisabled || !elementRef.current) {
      setIsVisible(true);
      return;
    }

    const element = elementRef.current;

    observerRef.current = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && (!options.triggerOnce || !isTriggered)) {
          setTimeout(() => {
            setIsVisible(true);
            if (options.triggerOnce) {
              setIsTriggered(true);
            }
          }, config.delay);
        } else if (!options.triggerOnce && !entry.isIntersecting) {
          setIsVisible(false);
        }
      },
      {
        threshold: config.threshold,
        rootMargin: config.rootMargin,
      }
    );

    observerRef.current.observe(element);

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [isDisabled, config.delay, config.threshold, config.rootMargin, options.triggerOnce, isTriggered]);

  const getAnimationClasses = useCallback(() => {
    if (isDisabled) return '';

    const baseClasses = `transition-all`;
    const durationClass = `duration-${Math.min(config.duration, 1000)}`;
    const easingStyle = { transitionTimingFunction: config.easing };

    if (!isVisible) {
      switch (options.animation) {
        case 'fadeIn':
          return `${baseClasses} ${durationClass} opacity-0`;
        case 'slideUp':
          return `${baseClasses} ${durationClass} opacity-0 translate-y-8`;
        case 'slideDown':
          return `${baseClasses} ${durationClass} opacity-0 -translate-y-8`;
        case 'slideLeft':
          return `${baseClasses} ${durationClass} opacity-0 translate-x-8`;
        case 'slideRight':
          return `${baseClasses} ${durationClass} opacity-0 -translate-x-8`;
        case 'scaleIn':
          return `${baseClasses} ${durationClass} opacity-0 scale-95`;
        case 'rotateIn':
          return `${baseClasses} ${durationClass} opacity-0 rotate-3`;
        case 'parallax':
          return `${baseClasses} ${durationClass} opacity-0 translate-y-4`;
        default:
          return `${baseClasses} ${durationClass} opacity-0`;
      }
    } else {
      return `${baseClasses} ${durationClass} opacity-100 translate-x-0 translate-y-0 scale-100 rotate-0`;
    }
  }, [isVisible, isDisabled, config.duration, config.easing, options.animation]);

  return {
    ref: elementRef,
    className: getAnimationClasses(),
    isVisible,
    isAnimating: !isDisabled && !isVisible,
    style: isDisabled ? {} : { transitionTimingFunction: config.easing },
  };
};

// Mouse tracking hook for desktop interactions
export const useMouseTracking = (sensitivity: number = 1) => {
  const { device, shouldUseParallax } = useResponsiveContext();
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [normalizedPosition, setNormalizedPosition] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!shouldUseParallax || device.isTouchDevice) return;

    const handleMouseMove = (event: MouseEvent) => {
      const x = event.clientX;
      const y = event.clientY;
      
      setMousePosition({ x, y });
      
      // Normalize to -1 to 1 range
      const normalizedX = ((x / window.innerWidth) - 0.5) * 2 * sensitivity;
      const normalizedY = ((y / window.innerHeight) - 0.5) * 2 * sensitivity;
      
      setNormalizedPosition({ x: normalizedX, y: normalizedY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [shouldUseParallax, device.isTouchDevice, sensitivity]);

  return {
    mousePosition,
    normalizedPosition,
    isTracking: shouldUseParallax && !device.isTouchDevice,
  };
};

// Touch gesture tracking for mobile
export const useTouchGestures = () => {
  const { device } = useResponsiveContext();
  const [touchState, setTouchState] = useState({
    isActive: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    deltaX: 0,
    deltaY: 0,
    direction: null as 'left' | 'right' | 'up' | 'down' | null,
  });

  const handleTouchStart = useCallback((event: TouchEvent) => {
    if (!device.isTouchDevice) return;
    
    const touch = event.touches[0];
    setTouchState(prev => ({
      ...prev,
      isActive: true,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      deltaX: 0,
      deltaY: 0,
      direction: null,
    }));
  }, [device.isTouchDevice]);

  const handleTouchMove = useCallback((event: TouchEvent) => {
    if (!device.isTouchDevice) return;
    
    const touch = event.touches[0];
    setTouchState(prev => {
      const deltaX = touch.clientX - prev.startX;
      const deltaY = touch.clientY - prev.startY;
      
      let direction: typeof prev.direction = null;
      
      if (Math.abs(deltaX) > Math.abs(deltaY)) {
        direction = deltaX > 0 ? 'right' : 'left';
      } else {
        direction = deltaY > 0 ? 'down' : 'up';
      }
      
      return {
        ...prev,
        currentX: touch.clientX,
        currentY: touch.clientY,
        deltaX,
        deltaY,
        direction,
      };
    });
  }, [device.isTouchDevice]);

  const handleTouchEnd = useCallback(() => {
    if (!device.isTouchDevice) return;
    
    setTouchState(prev => ({
      ...prev,
      isActive: false,
    }));
  }, [device.isTouchDevice]);

  useEffect(() => {
    if (!device.isTouchDevice) return;

    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener('touchstart', handleTouchStart);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [device.isTouchDevice, handleTouchStart, handleTouchMove, handleTouchEnd]);

  return touchState;
};

// Scroll progress tracking
export const useScrollProgress = () => {
  const [scrollProgress, setScrollProgress] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const lastScrollY = useRef(0);

  useEffect(() => {
    const updateScrollProgress = () => {
      const currentScrollY = window.scrollY;
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = Math.min(currentScrollY / scrollHeight, 1);
      
      setScrollProgress(progress);
      setScrollDirection(currentScrollY > lastScrollY.current ? 'down' : 'up');
      lastScrollY.current = currentScrollY;
    };

    window.addEventListener('scroll', updateScrollProgress, { passive: true });
    updateScrollProgress(); // Initial call

    return () => window.removeEventListener('scroll', updateScrollProgress);
  }, []);

  return {
    progress: scrollProgress,
    direction: scrollDirection,
    percentage: Math.round(scrollProgress * 100),
  };
};

export default useAdvancedScrollAnimation;
