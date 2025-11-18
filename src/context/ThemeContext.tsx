import React, { createContext, useContext, useEffect, useState } from 'react';
import { initializeTheme, getCurrentTheme, clearThemeCache } from '@/lib/themeInit';

interface ThemeContextType {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  isLoading: boolean;
  refreshTheme: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType>({
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=store&backgroundColor=3B82F6',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  isLoading: false,
  refreshTheme: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Initialize with current theme (from cache or default)
  const currentTheme = getCurrentTheme();
  const [logo, setLogo] = useState(currentTheme.logo);
  const [primaryColor, setPrimaryColor] = useState(currentTheme.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(currentTheme.secondaryColor);
  const [isLoading, setIsLoading] = useState(false);

  const refreshTheme = async () => {
    setIsLoading(true);
    try {
      // Refreshing theme
      const freshTheme = await initializeTheme();
      setLogo(freshTheme.logo);
      setPrimaryColor(freshTheme.primaryColor);
      setSecondaryColor(freshTheme.secondaryColor);
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
