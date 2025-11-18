import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema(
  {
    storeInfo: {
      name: { type: String, default: 'متجر إلكتروني' },
      description: { type: String, default: 'متجرك الإلكتروني المتكامل' },
      phone: { type: String, default: '+966501234567' },
      email: { type: String, default: 'info@store.com' },
    },
    // Logo configuration
    logo: {
      url: { type: String, default: '/iconPng.png' }, // Cloudinary URL or local path
      publicId: { type: String, default: '' }, // Cloudinary public ID for deletion
      altText: { type: String, default: 'Store Logo' },
      width: { type: Number, default: 150 },
      height: { type: Number, default: 150 },
    },
    // Favicon
    favicon: {
      url: { type: String, default: '/favicon.ico' },
      publicId: { type: String, default: '' },
    },
    aboutUsContent: {
      title: { type: String, default: 'من نحن؟' },
      description: {
        type: String,
        default:
          'شركة رائدة في التجارة الإلكترونية، نقدم أفضل المنتجات وأجود الخدمات بجودة عالية وخدمة متميزة.',
      },
      image: {
        type: String,
        default:
          'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop',
      },
      stats: {
        customers: { type: String, default: '1000+' },
        products: { type: String, default: '500+' },
      },
    },
    workHours: {
      weekdays: { type: String, default: '9:00 ص - 10:00 م' },
      friday: { type: String, default: '2:00 م - 10:00 م' },
      phone: { type: String, default: '+966 12 345 6789' },
      currentStatus: { type: String, default: 'مفتوح الآن' },
    },
    locations: { type: Array, default: [] },

    // Social and communication links
    social: {
      facebookUrl: { type: String, default: '' },
      messengerUrl: { type: String, default: '' },
      whatsappUrl: { type: String, default: '' },
      phoneCallLink: { type: String, default: '' }, // e.g., tel:+966501234567
    },

    // Theme settings
    theme: {
      logo: { type: String, default: '' }, // Base64 or URL
      primaryColor: { type: String, default: '' }, // Empty default - will use CSS variable fallback
      secondaryColor: { type: String, default: '' }, // Empty default - will use CSS variable fallback
      preset: { type: String, default: 'blue' }, // Theme preset name
    },

    // 3D Products Categories
    products3DCategories: { 
      type: [String], 
      default: ['أثاث', 'أجهزة', 'إضاءة', 'ديكور', 'أخرى'] 
    },

    // Shop Builder Default Settings
    shopBuilderDefaults: {
      floorTexture: { type: String, default: 'tiles_white' },
      wallTexture: { type: String, default: 'painted_white' },
      wallColor: { type: String, default: '#ffffff' },
    },

    // Pricing Settings
    pricingSettings: {
      hidePrices: { type: Boolean, default: false },
      contactMessage: { type: String, default: 'السلام عليكم، أود معرفة سعر المنتج' },
    },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
export default Settings;
