import { useState, useEffect } from 'react';
import { apiGet } from '@/lib/api';
import { cacheSiteName } from '@/hooks/useSiteName';

export interface StoreInfo {
  name: string;
  description: string;
  phone: string;
  email: string;
}

export interface Social {
  facebookUrl?: string;
  messengerUrl?: string;
  whatsappUrl?: string;
  phoneCallLink?: string;
}

export interface AboutUsContent {
  title: string;
  description: string;
  image: string;
  stats: {
    customers: string;
    products: string;
  };
}

export interface WorkHours {
  weekdays: string;
  friday: string;
  phone: string;
  currentStatus: string;
}

export interface LocationData {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  hours: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  googleMapsLink: string;
  googleMapsEmbed: string;
  isActive: boolean;
}

const defaultStoreInfo: StoreInfo = {
  name: 'متجر إلكتروني',
  description: 'متجرك الإلكتروني المتكامل',
  phone: '+966501234567',
  email: 'info@store.com'
};

const defaultAboutUs: AboutUsContent = {
  title: 'من نحن؟',
  description: 'شركة رائدة في التجارة الإلكترونية، نقدم أفضل المنتجات وأجود الخدمات بجودة عالية وخدمة متميزة.',
  image: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop',
  stats: {
    customers: '1000+',
    products: '500+'
  }
};

const defaultWorkHours: WorkHours = {
  weekdays: '9:00 ص - 10:00 م',
  friday: '2:00 م - 10:00 م',
  phone: '+966 12 345 6789',
  currentStatus: 'مفتوح الآن'
};

const defaultLocations: LocationData[] = [];

const defaultSocial: Social = {
  facebookUrl: '',
  messengerUrl: '',
  whatsappUrl: '',
  phoneCallLink: '',
};

export interface Settings {
  storeInfo: StoreInfo;
  aboutUsContent: AboutUsContent;
  workHours: WorkHours;
  locations: LocationData[];
  social: Social;
  loading: boolean;
  error: string | null;
  getActiveLocations: () => LocationData[];
  getBranchLocations: () => Record<string, { name: string; address: string; phone: string; mapUrl: string; coordinates?: { lat: number; lng: number } }>;
  checkoutEnabled: boolean;
  shippingCost: number;
  expressShippingCost: number;
  freeShippingThreshold: number | null;
  taxRate: number | null;
}

export const useSettings = () => {
  const [storeInfo, setStoreInfo] = useState<StoreInfo>(defaultStoreInfo);
  const [aboutUsContent, setAboutUsContent] = useState<AboutUsContent>(defaultAboutUs);
  const [workHours, setWorkHours] = useState<WorkHours>(defaultWorkHours);
  const [locations, setLocations] = useState<LocationData[]>(defaultLocations);
  const [social, setSocial] = useState<Social>(defaultSocial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkoutEnabled, setCheckoutEnabled] = useState(true);
  const [shippingCost, setShippingCost] = useState(25);
  const [expressShippingCost, setExpressShippingCost] = useState(50);
  const [freeShippingThreshold, setFreeShippingThreshold] = useState<number | null>(300);
  const [taxRate, setTaxRate] = useState<number | null>(15);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiGet<{ 
          storeInfo?: StoreInfo; 
          aboutUsContent?: AboutUsContent; 
          workHours?: Partial<WorkHours>; 
          locations?: LocationData[]; 
          social?: Social;
          checkoutEnabled?: boolean;
          shippingCost?: number;
          expressShippingCost?: number;
          freeShippingThreshold?: number | null;
          taxRate?: number | null;
        }>(
          '/api/settings'
        );
        const ok = res as { ok: true; item?: { 
          storeInfo?: StoreInfo; 
          aboutUsContent?: AboutUsContent; 
          workHours?: Partial<WorkHours>; 
          locations?: LocationData[]; 
          social?: Social;
          checkoutEnabled?: boolean;
          shippingCost?: number;
          expressShippingCost?: number;
          freeShippingThreshold?: number | null;
          taxRate?: number | null;
        } };
        if (ok.item) {
          if (ok.item.storeInfo) {
            setStoreInfo(ok.item.storeInfo);
            // Cache current site name for immediate access
            cacheSiteName(ok.item.storeInfo.name);
          }
          if (ok.item.aboutUsContent) setAboutUsContent(ok.item.aboutUsContent);
          if (ok.item.workHours) {
            const { weekdays, friday, phone, currentStatus } = ok.item.workHours;
            setWorkHours({
              weekdays: weekdays ?? defaultWorkHours.weekdays,
              friday: friday ?? defaultWorkHours.friday,
              phone: phone ?? defaultWorkHours.phone,
              currentStatus: currentStatus ?? defaultWorkHours.currentStatus,
            });
          }
          setLocations(ok.item.locations || []);
          setSocial(ok.item.social || defaultSocial);
          
          // Set checkout settings
          setCheckoutEnabled(ok.item.checkoutEnabled ?? true);
          setShippingCost(ok.item.shippingCost ?? 25);
          setExpressShippingCost(ok.item.expressShippingCost ?? 50);
          setFreeShippingThreshold(ok.item.freeShippingThreshold ?? 300);
          setTaxRate(ok.item.taxRate ?? 15);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'تعذر تحميل الإعدادات';
        setError(msg);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const getActiveLocations = () => {
    return locations.filter(location => location.isActive);
  };

  const getBranchLocations = () => {
    const activeLocations = getActiveLocations();
    const source = activeLocations.length > 0 ? activeLocations : [];
    const branchMap: Record<string, { name: string; address: string; phone: string; mapUrl: string; coordinates?: { lat: number; lng: number } }> = {};

    source.forEach((location, index) => {
      const key = location.name.toLowerCase().includes('رياض') ? 'riyadh' :
                  location.name.toLowerCase().includes('جدة') ? 'jeddah' :
                  location.name.toLowerCase().includes('دمام') ? 'dammam' :
                  location.name.toLowerCase().includes('مدينة') ? 'medina' :
                  `branch_${index}`;

      // Build a safe embed URL
      let mapUrl = location.googleMapsEmbed?.trim() || '';
      if (!mapUrl) {
        const lat = typeof location.coordinates?.lat === 'number' ? location.coordinates.lat : undefined;
        const lng = typeof location.coordinates?.lng === 'number' ? location.coordinates.lng : undefined;
        if (typeof lat === 'number' && typeof lng === 'number') {
          mapUrl = `https://www.google.com/maps?q=${lat},${lng}&output=embed`;
        } else if (location.googleMapsLink) {
          try {
            const u = new URL(location.googleMapsLink);
            // If link has q=lat,lng use that; else fall back to plain link in embed format
            const q = u.searchParams.get('q');
            mapUrl = q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&output=embed` : `https://www.google.com/maps?${u.searchParams.toString()}&output=embed`;
          } catch {
            mapUrl = '';
          }
        }
      }

      branchMap[key] = {
        name: location.name,
        address: location.address,
        phone: location.phone,
        mapUrl,
        coordinates: (location.coordinates && typeof location.coordinates.lat === 'number' && typeof location.coordinates.lng === 'number')
          ? { lat: location.coordinates.lat, lng: location.coordinates.lng }
          : undefined
      };
    });

    return branchMap;
  };

  return {
    storeInfo,
    aboutUsContent,
    workHours,
    locations,
    social,
    loading,
    error,
    getActiveLocations,
    getBranchLocations,
    checkoutEnabled,
    shippingCost,
    expressShippingCost,
    freeShippingThreshold,
    taxRate
  };
};
