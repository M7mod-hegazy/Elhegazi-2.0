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

const defaultLocations: LocationData[] = [
  {
    id: '1',
    name: 'الفرع الرئيسي - الرياض',
    address: 'شارع الملك فهد، حي العليا، الرياض 12211',
    phone: '+966 11 123 4567',
    email: 'riyadh@arabianbluebloom.com',
    hours: 'السبت - الخميس: 9:00 ص - 10:00 م',
    coordinates: { lat: 24.7136, lng: 46.6753 },
    googleMapsLink: 'https://maps.google.com/?q=24.7136,46.6753',
    googleMapsEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3624.4!2d46.6753!3d24.7136!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjRCsDQyJzQ5LjAiTiA0NsKwNDAnMzEuMSJF!5e0!3m2!1sen!2ssa!4v1234567890',
    isActive: true
  },
  {
    id: '2',
    name: 'فرع جدة',
    address: 'طريق الملك عبدالعزيز، حي الروضة، جدة 23432',
    phone: '+966 12 234 5678',
    email: 'jeddah@arabianbluebloom.com',
    hours: 'السبت - الخميس: 10:00 ص - 11:00 م',
    coordinates: { lat: 21.3891, lng: 39.8579 },
    googleMapsLink: 'https://maps.google.com/?q=21.3891,39.8579',
    googleMapsEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3710.2!2d39.8579!3d21.3891!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjHCsDIzJzIwLjgiTiAzOcKwNTEnMjguNCJF!5e0!3m2!1sen!2ssa!4v1234567891',
    isActive: true
  },
  {
    id: '3',
    name: 'فرع الدمام',
    address: 'الواجهة البحرية، حي الشاطئ، الدمام',
    phone: '+966 13 345 6789',
    email: 'dammam@arabianbluebloom.com',
    hours: 'السبت - الخميس: 9:00 ص - 10:00 م',
    coordinates: { lat: 26.4207, lng: 50.1063 },
    googleMapsLink: 'https://maps.google.com/?q=26.4207,50.1063',
    googleMapsEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3576.1!2d50.1063!3d26.4207!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjbCsDI1JzE0LjUiTiA1MMKwMDYnMjIuNyJF!5e0!3m2!1sen!2ssa!4v1234567892',
    isActive: true
  },
  {
    id: '4',
    name: 'فرع المدينة المنورة',
    address: 'شارع قباء، حي قربان، المدينة المنورة',
    phone: '+966 14 456 7890',
    email: 'medina@arabianbluebloom.com',
    hours: 'السبت - الخميس: 9:00 ص - 10:00 م',
    coordinates: { lat: 24.4539, lng: 39.6142 },
    googleMapsLink: 'https://maps.google.com/?q=24.4539,39.6142',
    googleMapsEmbed: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3627.1!2d39.6142!3d24.4539!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjTCsDI3JzE0LjAiTiAzOcKwMzYnNTEuMSJF!5e0!3m2!1sen!2ssa!4v1234567893',
    isActive: true
  }
];

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
            // Cache hardcoded site name for immediate access
            cacheSiteName();
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
    // Use active locations if available; otherwise fall back to defaults
    const activeLocations = getActiveLocations();
    const source = activeLocations.length > 0 ? activeLocations : defaultLocations;
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
