import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeTheme, getCurrentTheme, clearThemeCache } from '@/lib/themeInit';

interface ThemeContextType {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  isLoading: boolean;
  refreshTheme: () => Promise<void>;
}

interface CachedTheme {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  timestamp: number;
}

const THEME_CACHE_KEY = 'theme_cache';
const THEME_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCachedTheme = () => {
  try {
    const cached = localStorage.getItem(THEME_CACHE_KEY);
    if (!cached) return null;
    
    const data: CachedTheme = JSON.parse(cached);
    const now = Date.now();
    
    // Check if cache is still valid
    if (now - data.timestamp > THEME_CACHE_TTL) {
      localStorage.removeItem(THEME_CACHE_KEY);
      return null;
    }
    
    return {
      logo: data.logo,
      primaryColor: data.primaryColor,
      secondaryColor: data.secondaryColor,
    };
  } catch (error) {
    console.error('Failed to read theme cache:', error);
    return null;
  }
};

const setCachedTheme = (theme: { logo: string; primaryColor: string; secondaryColor: string }) => {
  try {
    const data: CachedTheme = {
      ...theme,
      timestamp: Date.now(),
    };
    localStorage.setItem(THEME_CACHE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to cache theme:', error);
  }
};

const ThemeContext = createContext<ThemeContextType>({
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=store&backgroundColor=3B82F6',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  isLoading: false,
  refreshTheme: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with cached theme if available, otherwise use current theme
  const cachedTheme = getCachedTheme();
  const currentTheme = cachedTheme || getCurrentTheme();
  const [logo, setLogo] = useState(currentTheme.logo);
  const [primaryColor, setPrimaryColor] = useState(currentTheme.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(currentTheme.secondaryColor);
  const [isLoading, setIsLoading] = useState(!cachedTheme); // Only loading if no cache

  const refreshTheme = async () => {
    setIsLoading(true);
    try {
      // Refreshing theme
      const freshTheme = await initializeTheme();
      setLogo(freshTheme.logo);
      setPrimaryColor(freshTheme.primaryColor);
      setSecondaryColor(freshTheme.secondaryColor);
      
      // Cache the theme
      setCachedTheme({
        logo: freshTheme.logo,
        primaryColor: freshTheme.primaryColor,
        secondaryColor: freshTheme.secondaryColor,
      });
      // Theme refreshed
    } catch (error) {
      console.error('❌ ThemeContext: Failed to refresh theme:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initialize theme on mount
    refreshTheme();
  }, []);

  return (
    <ThemeContext.Provider value={{ 
      logo, 
      primaryColor, 
      secondaryColor, 
      isLoading, 
      refreshTheme 
    }}>
      {children}
    </ThemeContext.Provider>
  );
};
