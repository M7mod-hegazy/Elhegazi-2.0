import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import type { HomeConfig } from '@/types/home-config';

interface SectionVisibility {
  featuredProducts: boolean;
  bestSellers: boolean;
  sale: boolean;
  newArrivals: boolean;
  categories: boolean;
  hero: boolean;
  promoStrip: boolean;
  about: boolean;
  locations: boolean;
  workHours: boolean;
}

/**
 * Hook to check section visibility based on admin settings
 */
export function useSectionVisibility() {
  const [visibility, setVisibility] = useState<SectionVisibility>({
    featuredProducts: true,
    bestSellers: true,
    sale: true,
    newArrivals: true,
    categories: true,
    hero: true,
    promoStrip: true,
    about: true,
    locations: true,
    workHours: true,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSectionSettings = async () => {
      try {
        const response = await apiGet<HomeConfig>('/api/home-config');
        
        if (response.ok && response.item) {
          const config = response.item;
          
          // Create visibility map based on toggles
          const newVisibility: SectionVisibility = {
            featuredProducts: true,
            bestSellers: true,
            sale: true,
            newArrivals: true,
            categories: true,
            hero: config.heroEnabled ?? true,
            promoStrip: true,
            about: true,
            locations: true,
            workHours: true,
          };

          // Apply toggle settings
          if (config.toggles && Array.isArray(config.toggles)) {
            config.toggles.forEach(toggle => {
              if (toggle.key in newVisibility) {
                (newVisibility as any)[toggle.key] = toggle.enabled;
              }
            });
          }

          setVisibility(newVisibility);
        }
      } catch (error) {
        console.error('Failed to fetch section visibility settings:', error);
        // Keep default visibility (all true) on error
      } finally {
        setLoading(false);
      }
    };

    fetchSectionSettings();
  }, []);

  return {
    visibility,
    loading,
    isVisible: (section: keyof SectionVisibility) => visibility[section],
  };
}

/**
 * Check if a specific section is visible
 */
export async function checkSectionVisibility(section: keyof SectionVisibility): Promise<boolean> {
  try {
    const response = await apiGet<HomeConfig>('/api/home-config');
    
    if (response.ok && response.item) {
      const config = response.item;
      
      // Check hero section
      if (section === 'hero') {
        return config.heroEnabled ?? true;
      }
      
      // Check other sections in toggles
      const toggle = config.toggles?.find(t => t.key === section);
      return toggle?.enabled ?? true;
    }
    
    return true; // Default to visible if no config found
  } catch (error) {
    console.error('Failed to check section visibility:', error);
    return true; // Default to visible on error
  }
}
