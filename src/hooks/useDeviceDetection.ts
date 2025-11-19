import { useState, useEffect, useCallback } from 'react';

export interface DeviceInfo {
  // Device type detection
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  
  // Screen size categories
  screenSize: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  
  // Exact dimensions
  width: number;
  height: number;
  
  // Interaction capabilities
  isTouchDevice: boolean;
  hasHover: boolean;
  hasFinePointer: boolean;
  
  // Orientation
  orientation: 'portrait' | 'landscape';
  
  // Performance indicators
  prefersReducedMotion: boolean;
  isHighDPI: boolean;
  
  // Browser capabilities
  supportsTouch: boolean;
  supportsHover: boolean;
  
  // Device context
  deviceType: 'mobile' | 'tablet' | 'desktop';
  isLowEndDevice: boolean;
}

const useDeviceDetection = (): DeviceInfo => {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>(() => {
    // Initialize with safe defaults for SSR
    if (typeof window === 'undefined') {
      return {
        isMobile: false,
        isTablet: false,
        isDesktop: true,
        screenSize: 'lg',
        width: 1024,
        height: 768,
        isTouchDevice: false,
        hasHover: true,
        hasFinePointer: true,
        orientation: 'landscape',
        prefersReducedMotion: false,
        isHighDPI: false,
        supportsTouch: false,
        supportsHover: true,
        deviceType: 'desktop',
        isLowEndDevice: false,
      };
    }

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    return {
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      screenSize: getScreenSize(width),
      width,
      height,
      isTouchDevice: 'ontouchstart' in window,
      hasHover: window.matchMedia('(hover: hover)').matches,
      hasFinePointer: window.matchMedia('(pointer: fine)').matches,
      orientation: width > height ? 'landscape' : 'portrait',
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      isHighDPI: window.devicePixelRatio > 1.5,
      supportsTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      supportsHover: window.matchMedia('(hover: hover)').matches,
      deviceType: getDeviceType(width, 'ontouchstart' in window),
      isLowEndDevice: getIsLowEndDevice(),
    };
  });

  const updateDeviceInfo = useCallback(() => {
    if (typeof window === 'undefined') return;

    const width = window.innerWidth;
    const height = window.innerHeight;
    
    setDeviceInfo({
      isMobile: width < 768,
      isTablet: width >= 768 && width < 1024,
      isDesktop: width >= 1024,
      screenSize: getScreenSize(width),
      width,
      height,
      isTouchDevice: 'ontouchstart' in window,
      hasHover: window.matchMedia('(hover: hover)').matches,
      hasFinePointer: window.matchMedia('(pointer: fine)').matches,
      orientation: width > height ? 'landscape' : 'portrait',
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
      isHighDPI: window.devicePixelRatio > 1.5,
      supportsTouch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      supportsHover: window.matchMedia('(hover: hover)').matches,
      deviceType: getDeviceType(width, 'ontouchstart' in window),
      isLowEndDevice: getIsLowEndDevice(),
    });
  }, []);

  useEffect(() => {
    // Update on mount
    updateDeviceInfo();

    // Throttled resize handler for performance
    let timeoutId: NodeJS.Timeout;
    const handleResize = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(updateDeviceInfo, 100);
    };

    // Media query listeners for dynamic changes
    const mediaQueries = [
      window.matchMedia('(hover: hover)'),
      window.matchMedia('(pointer: fine)'),
      window.matchMedia('(prefers-reduced-motion: reduce)'),
    ];

    const handleMediaChange = () => {
      updateDeviceInfo();
    };

    // Add event listeners
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', updateDeviceInfo);
    
    mediaQueries.forEach(mq => {
      if (mq.addEventListener) {
        mq.addEventListener('change', handleMediaChange);
      } else {
        // Fallback for older browsers
        mq.addListener(handleMediaChange);
      }
    });

    return () => {
      clearTimeout(timeoutId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', updateDeviceInfo);
      
      mediaQueries.forEach(mq => {
        if (mq.removeEventListener) {
          mq.removeEventListener('change', handleMediaChange);
        } else {
          // Fallback for older browsers
          mq.removeListener(handleMediaChange);
        }
      });
    };
  }, [updateDeviceInfo]);

  return deviceInfo;
};

// Helper functions
function getScreenSize(width: number): DeviceInfo['screenSize'] {
  if (width < 640) return 'sm';
  if (width < 768) return 'md';
  if (width < 1024) return 'lg';
  if (width < 1280) return 'xl';
  return '2xl';
}

function getDeviceType(width: number, hasTouch: boolean): DeviceInfo['deviceType'] {
  if (width < 768) return 'mobile';
  if (width < 1024 && hasTouch) return 'tablet';
  return 'desktop';
}

function getIsLowEndDevice(): boolean {
  if (typeof window === 'undefined') return false;
  
  // Detect low-end devices based on various indicators
  const hardwareConcurrency = navigator.hardwareConcurrency || 4;
  const deviceMemory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory || 8;
  const connection = (navigator as Navigator & { connection?: { effectiveType: string } }).connection;
  const connectionEffectiveType = connection?.effectiveType;
  
  return (
    hardwareConcurrency <= 2 ||
    deviceMemory <= 2 ||
    connectionEffectiveType === 'slow-2g' ||
    connectionEffectiveType === '2g'
  );
}

export default useDeviceDetection;
