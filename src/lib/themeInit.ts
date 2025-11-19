import { apiGet } from '@/lib/api';

interface ThemeData {
  logo: string;
  primaryColor: string;
  secondaryColor: string;
  timestamp: number;
}

interface Settings {
  logo?: {
    url?: string;
    altText?: string;
    width?: number;
    height?: number;
  };
  theme?: {
    logo?: string;
    primaryColor?: string;
    secondaryColor?: string;
  };
  storeInfo?: {
    name?: string;
  };
}

const STORAGE_KEY = 'app-theme-data';
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Default fallback theme
const DEFAULT_THEME: ThemeData = {
  logo: 'https://api.dicebear.com/7.x/shapes/svg?seed=store&backgroundColor=3B82F6',
  primaryColor: '#3B82F6',
  secondaryColor: '#8B5CF6',
  timestamp: 0
};

/**
 * Get cached theme data from localStorage
 */
function getCachedTheme(): ThemeData | null {
  try {
    const cached = localStorage.getItem(STORAGE_KEY);
    if (!cached) return null;
    
    const data = JSON.parse(cached) as ThemeData;
    const isExpired = Date.now() - data.timestamp > CACHE_DURATION;
    
    if (isExpired) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('Failed to parse cached theme:', error);
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

/**
 * Save theme data to localStorage
 */
function setCachedTheme(theme: ThemeData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(theme));
  } catch (error) {
    console.warn('Failed to cache theme:', error);
  }
}

/**
 * Convert hex color to HSL values for CSS variables
 */
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return { h: 217, s: 91, l: 60 }; // fallback blue
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  
  h = Math.round(h * 360);
  s = Math.round(s * 100);
  l = Math.round(l * 100);
  
  return { h, s, l };
}

/**
 * Generate complete color palette with all shades
 */
function generateColorPalette(baseColor: string, prefix: string): string {
  const { h, s, l } = hexToHsl(baseColor);
  
  // Generate all shades from 50 (lightest) to 950 (darkest)
  const shades = {
    50: { s: Math.max(s - 10, 10), l: 97 },
    100: { s: Math.max(s - 5, 15), l: 94 },
    200: { s, l: 86 },
    300: { s, l: 77 },
    400: { s, l: 66 },
    500: { s, l: l }, // Base color
    600: { s, l: Math.max(l - 10, 45) },
    700: { s, l: Math.max(l - 20, 35) },
    800: { s, l: Math.max(l - 30, 25) },
    900: { s, l: Math.max(l - 40, 15) },
    950: { s, l: Math.max(l - 50, 10) },
  };

  // Set all shade variables
  Object.entries(shades).forEach(([shade, { s: shadeS, l: shadeL }]) => {
    document.documentElement.style.setProperty(
      `--${prefix}-${shade}`,
      `${h} ${shadeS}% ${shadeL}%`
    );
  });

  // Set base color
  const hslValue = `${h} ${s}% ${l}%`;
  document.documentElement.style.setProperty(`--${prefix}`, hslValue);
  
  // Set light and dark variants
  document.documentElement.style.setProperty(`--${prefix}-light`, `${h} ${s}% ${Math.min(l + 15, 85)}%`);
  document.documentElement.style.setProperty(`--${prefix}-dark`, `${h} ${s}% ${Math.max(l - 15, 25)}%`);
  
  return hslValue;
}

/**
 * Apply theme colors to CSS variables immediately
 */
function applyThemeColors(primaryColor: string, secondaryColor: string): void {
  // Applying theme colors
  
  const primaryHsl = generateColorPalette(primaryColor, 'primary');
  const secondaryHsl = generateColorPalette(secondaryColor, 'secondary');
  
  // Set foreground colors
  document.documentElement.style.setProperty('--primary-foreground', '0 0% 100%');
  document.documentElement.style.setProperty('--secondary-foreground', '0 0% 100%');
  document.documentElement.style.setProperty('--primary-accent', primaryHsl);
  
  // Set accent to use primary color
  document.documentElement.style.setProperty('--accent', primaryHsl);
  document.documentElement.style.setProperty('--accent-foreground', '0 0% 100%');
  
  // Set ring color (focus outlines) to primary
  document.documentElement.style.setProperty('--ring', primaryHsl);
  
  // Also set hex for direct use
  document.documentElement.style.setProperty('--color-primary', primaryColor);
  document.documentElement.style.setProperty('--color-secondary', secondaryColor);
  
  // Theme colors applied
}

/**
 * Initialize theme immediately with cached data, then update from API
 */
export async function initializeTheme(): Promise<ThemeData> {
  // Initializing theme system
  
  // First, try to get cached theme and apply immediately
  const cachedTheme = getCachedTheme();
  if (cachedTheme) {
    // Using cached theme
    applyThemeColors(cachedTheme.primaryColor, cachedTheme.secondaryColor);
  } else {
    // No cache, applying default theme
    applyThemeColors(DEFAULT_THEME.primaryColor, DEFAULT_THEME.secondaryColor);
  }
  
  // Then fetch fresh data from API
  try {
    // Fetching fresh theme from API
    const response = await apiGet<Settings>('/api/settings');
    
    if (response.ok && response.item) {
      const settings = response.item;
      const freshTheme: ThemeData = {
        logo: settings.theme?.logo || settings.logo?.url || DEFAULT_THEME.logo,
        primaryColor: settings.theme?.primaryColor || DEFAULT_THEME.primaryColor,
        secondaryColor: settings.theme?.secondaryColor || DEFAULT_THEME.secondaryColor,
        timestamp: Date.now()
      };
      
      // Fresh theme loaded
      
      // Apply fresh colors if different from cached
      if (!cachedTheme || 
          cachedTheme.primaryColor !== freshTheme.primaryColor || 
          cachedTheme.secondaryColor !== freshTheme.secondaryColor) {
        applyThemeColors(freshTheme.primaryColor, freshTheme.secondaryColor);
      }
      
      // Cache the fresh data
      setCachedTheme(freshTheme);
      
      return freshTheme;
    }
  } catch (error) {
    console.error('❌ Failed to fetch fresh theme:', error);
  }
  
  // Return cached theme or default
  return cachedTheme || DEFAULT_THEME;
}

/**
 * Get current theme data synchronously (from cache or default)
 */
export function getCurrentTheme(): ThemeData {
  return getCachedTheme() || DEFAULT_THEME;
}

/**
 * Clear theme cache (call when theme is updated)
 */
export function clearThemeCache(): void {
  localStorage.removeItem(STORAGE_KEY);

}

/**
 * Preload theme on app startup - call this as early as possible
 */
export function preloadTheme(): void {
  // Apply cached theme immediately if available
  const cached = getCachedTheme();
  if (cached) {
    // Preloading cached theme
    applyThemeColors(cached.primaryColor, cached.secondaryColor);
  } else {
    // Preloading default theme
    applyThemeColors(DEFAULT_THEME.primaryColor, DEFAULT_THEME.secondaryColor);
  }
}
