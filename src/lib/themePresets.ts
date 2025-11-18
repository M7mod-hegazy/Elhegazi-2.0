export interface ThemePreset {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor?: string;
  preview: {
    gradient: string;
    textColor: string;
  };
}

export const themePresets: ThemePreset[] = [
  {
    id: 'default-blue',
    name: 'Classic Blue',
    nameAr: 'الأزرق الكلاسيكي',
    description: 'Professional and trustworthy - Current default',
    descriptionAr: 'احترافي وموثوق - الافتراضي الحالي',
    primaryColor: '#3B82F6',
    secondaryColor: '#8B5CF6',
    accentColor: '#60A5FA',
    preview: {
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #8B5CF6 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'ocean-teal',
    name: 'Ocean Teal',
    nameAr: 'الفيروزي المحيطي',
    description: 'Modern and refreshing - Great for tech',
    descriptionAr: 'عصري ومنعش - مثالي للتقنية',
    primaryColor: '#14B8A6',
    secondaryColor: '#06B6D4',
    accentColor: '#22D3EE',
    preview: {
      gradient: 'linear-gradient(135deg, #14B8A6 0%, #06B6D4 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'emerald-forest',
    name: 'Emerald Forest',
    nameAr: 'الزمرد الطبيعي',
    description: 'Natural and trustworthy - Eco brands',
    descriptionAr: 'طبيعي وموثوق - للعلامات البيئية',
    primaryColor: '#10B981',
    secondaryColor: '#059669',
    accentColor: '#34D399',
    preview: {
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'royal-indigo',
    name: 'Royal Indigo',
    nameAr: 'النيلي الملكي',
    description: 'Luxury and sophistication - Premium brands',
    descriptionAr: 'فاخر ومتطور - للعلامات الفاخرة',
    primaryColor: '#6366F1',
    secondaryColor: '#8B5CF6',
    accentColor: '#818CF8',
    preview: {
      gradient: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'sunset-amber',
    name: 'Sunset Amber',
    nameAr: 'العنبر الغروبي',
    description: 'Warm and energetic - Food & lifestyle',
    descriptionAr: 'دافئ ونشيط - للطعام ونمط الحياة',
    primaryColor: '#F59E0B',
    secondaryColor: '#F97316',
    accentColor: '#FBBF24',
    preview: {
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'crimson-passion',
    name: 'Crimson Passion',
    nameAr: 'القرمزي الشغوف',
    description: 'Bold and exciting - Fashion & beauty',
    descriptionAr: 'جريء ومثير - للأزياء والجمال',
    primaryColor: '#DC2626',
    secondaryColor: '#EF4444',
    accentColor: '#F87171',
    preview: {
      gradient: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'rose-elegance',
    name: 'Rose Elegance',
    nameAr: 'الأناقة الوردية',
    description: 'Feminine and elegant - Beauty & wellness',
    descriptionAr: 'أنثوي وأنيق - للجمال والعافية',
    primaryColor: '#EC4899',
    secondaryColor: '#F472B6',
    accentColor: '#F9A8D4',
    preview: {
      gradient: 'linear-gradient(135deg, #EC4899 0%, #F472B6 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'violet-luxury',
    name: 'Violet Luxury',
    nameAr: 'الفخامة البنفسجية',
    description: 'Creative and premium - Art & design',
    descriptionAr: 'إبداعي وفاخر - للفن والتصميم',
    primaryColor: '#9333EA',
    secondaryColor: '#A855F7',
    accentColor: '#C084FC',
    preview: {
      gradient: 'linear-gradient(135deg, #9333EA 0%, #A855F7 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'sky-bright',
    name: 'Sky Bright',
    nameAr: 'السماء المشرقة',
    description: 'Light and airy - Healthcare & wellness',
    descriptionAr: 'خفيف ومنعش - للصحة والعافية',
    primaryColor: '#0EA5E9',
    secondaryColor: '#38BDF8',
    accentColor: '#7DD3FC',
    preview: {
      gradient: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'slate-professional',
    name: 'Slate Professional',
    nameAr: 'الرمادي الاحترافي',
    description: 'Minimal and modern - Corporate & business',
    descriptionAr: 'بسيط وعصري - للشركات والأعمال',
    primaryColor: '#475569',
    secondaryColor: '#64748B',
    accentColor: '#94A3B8',
    preview: {
      gradient: 'linear-gradient(135deg, #475569 0%, #64748B 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'lime-energy',
    name: 'Lime Energy',
    nameAr: 'الطاقة الليمونية',
    description: 'Fresh and vibrant - Sports & fitness',
    descriptionAr: 'منعش ونابض - للرياضة واللياقة',
    primaryColor: '#84CC16',
    secondaryColor: '#65A30D',
    accentColor: '#A3E635',
    preview: {
      gradient: 'linear-gradient(135deg, #84CC16 0%, #65A30D 100%)',
      textColor: '#FFFFFF'
    }
  },
  {
    id: 'bronze-heritage',
    name: 'Bronze Heritage',
    nameAr: 'التراث البرونزي',
    description: 'Classic and timeless - Traditional brands',
    descriptionAr: 'كلاسيكي وخالد - للعلامات التقليدية',
    primaryColor: '#D97706',
    secondaryColor: '#B45309',
    accentColor: '#F59E0B',
    preview: {
      gradient: 'linear-gradient(135deg, #D97706 0%, #B45309 100%)',
      textColor: '#FFFFFF'
    }
  }
];

export const getThemeById = (id: string): ThemePreset | undefined => {
  return themePresets.find(theme => theme.id === id);
};

export const getCurrentTheme = (primaryColor: string, secondaryColor: string): ThemePreset | undefined => {
  return themePresets.find(
    theme => theme.primaryColor.toLowerCase() === primaryColor.toLowerCase() && 
             theme.secondaryColor.toLowerCase() === secondaryColor.toLowerCase()
  );
};
