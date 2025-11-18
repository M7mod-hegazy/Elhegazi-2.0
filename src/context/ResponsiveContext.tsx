import React, { createContext, useContext, useEffect, useState } from 'react';
import useDeviceDetection, { DeviceInfo } from '@/hooks/useDeviceDetection';

interface ResponsiveContextType {
  device: DeviceInfo;
  
  // Layout preferences
  shouldUseDesktopLayout: boolean;
  shouldUseMobileLayout: boolean;
  shouldEnableAnimations: boolean;
  shouldUseParallax: boolean;
  
  // Interaction modes
  interactionMode: 'mouse' | 'touch' | 'hybrid';
  
  // Performance settings
  animationQuality: 'high' | 'medium' | 'low';
  shouldPreloadImages: boolean;
  
  // Debugging (only in development)
  isDebugMode: boolean;
  debugInfo: {
    deviceType: string;
    screenSize: string;
    capabilities: string[];
  };
}

const ResponsiveContext = createContext<ResponsiveContextType | undefined>(undefined);

interface ResponsiveProviderProps {
  children: React.ReactNode;
  debugMode?: boolean;
}

export const ResponsiveProvider: React.FC<ResponsiveProviderProps> = ({ 
  children, 
  debugMode = process.env.NODE_ENV === 'development' 
}) => {
  const device = useDeviceDetection();
  const [isDebugMode, setIsDebugMode] = useState(debugMode);

  // Calculate derived properties
  const shouldUseDesktopLayout = device.isDesktop && !device.isTouchDevice;
  const shouldUseMobileLayout = device.isMobile || (device.isTablet && device.isTouchDevice);
  
  const shouldEnableAnimations = !device.prefersReducedMotion && !device.isLowEndDevice;
  const shouldUseParallax = shouldEnableAnimations && device.isDesktop && device.hasHover;
  
  const interactionMode: ResponsiveContextType['interactionMode'] = 
    device.isTouchDevice && device.hasHover ? 'hybrid' :
    device.isTouchDevice ? 'touch' : 'mouse';
  
  const animationQuality: ResponsiveContextType['animationQuality'] = 
    device.isLowEndDevice ? 'low' :
    device.prefersReducedMotion ? 'low' :
    device.isMobile ? 'medium' : 'high';
  
  const shouldPreloadImages = !device.isLowEndDevice && device.isDesktop;

  // Debug information
  const debugInfo = {
    deviceType: `${device.deviceType} (${device.width}x${device.height})`,
    screenSize: device.screenSize,
    capabilities: [
      device.isTouchDevice && 'Touch',
      device.hasHover && 'Hover',
      device.hasFinePointer && 'Fine Pointer',
      device.isHighDPI && 'High DPI',
      device.prefersReducedMotion && 'Reduced Motion',
      device.isLowEndDevice && 'Low-End Device',
    ].filter(Boolean) as string[],
  };

  // Keyboard shortcut for toggling debug mode in development
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl + Shift + D to toggle debug mode
      if (event.ctrlKey && event.shiftKey && event.key === 'D') {
        event.preventDefault();
        setIsDebugMode(prev => !prev);
        console.log('🔧 Debug mode:', !isDebugMode ? 'enabled' : 'disabled');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDebugMode]);

  // Log device info on mount (development only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.group('📱 Device Detection');
      console.log('Device Type:', device.deviceType);
      console.log('Screen:', `${Number(device.width) || 0}x${Number(device.height) || 0} (${device.screenSize})`);
      console.log('Orientation:', device.orientation);
      console.log('Touch Support:', device.isTouchDevice);
      console.log('Hover Support:', device.hasHover);
      console.log('Animation Quality:', animationQuality);
      console.log('Interaction Mode:', interactionMode);
      console.groupEnd();
    }
  }, [device, animationQuality, interactionMode]);

  const value: ResponsiveContextType = {
    device,
    shouldUseDesktopLayout,
    shouldUseMobileLayout,
    shouldEnableAnimations,
    shouldUseParallax,
    interactionMode,
    animationQuality,
    shouldPreloadImages,
    isDebugMode,
    debugInfo,
  };

  return (
    <ResponsiveContext.Provider value={value}>
      {children}
    </ResponsiveContext.Provider>
  );
};

// Debug panel component disabled for production
const DebugPanel: React.FC<{ context: ResponsiveContextType }> = () => {
  return null;
};

export const useResponsiveContext = (): ResponsiveContextType => {
  const context = useContext(ResponsiveContext);
  if (context === undefined) {
    throw new Error('useResponsiveContext must be used within a ResponsiveProvider');
  }
  return context;
};

export default ResponsiveProvider;