import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema(
  {
    storeInfo: {
      name: { type: String, default: '\u0645\u062a\u062c\u0631 \u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a' },
      description: { type: String, default: '\u0645\u062a\u062c\u0631\u0643 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a \u0627\u0644\u0645\u062a\u0643\u0627\u0645\u0644' },
      phone: { type: String, default: '+966501234567' },
      email: { type: String, default: 'info@store.com' },
    },
    logo: {
      url: { type: String, default: '/iconPng.png' },
      publicId: { type: String, default: '' },
      altText: { type: String, default: 'Store Logo' },
      width: { type: Number, default: 150 },
      height: { type: Number, default: 150 },
    },
    favicon: {
      url: { type: String, default: '/iconPng.png' },
      publicId: { type: String, default: '' },
    },
    aboutUsContent: {
      title: { type: String, default: '\u0645\u0646 \u0646\u062d\u0646\u061f' },
      description: {
        type: String,
        default: '\u0634\u0631\u0643\u0629 \u0631\u0627\u0626\u062f\u0629 \u0641\u064a \u0627\u0644\u062a\u062c\u0627\u0631\u0629 \u0627\u0644\u0625\u0644\u0643\u062a\u0631\u0648\u0646\u064a\u0629\u060c \u0646\u0642\u062f\u0645 \u0623\u0641\u0636\u0644 \u0627\u0644\u0645\u0646\u062a\u062c\u0627\u062a \u0648\u0623\u062c\u0648\u062f \u0627\u0644\u062e\u062f\u0645\u0627\u062a \u0628\u062c\u0648\u062f\u0629 \u0639\u0627\u0644\u064a\u0629 \u0648\u062e\u062f\u0645\u0629 \u0645\u062a\u0645\u064a\u0632\u0629\u002e',
      },
      image: { type: String, default: 'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&h=400&fit=crop' },
      stats: {
        customers: { type: String, default: '1000+' },
        products: { type: String, default: '500+' },
      },
    },
    workHours: {
      weekdays: { type: String, default: '9:00 \u0635 - 10:00 \u0645' },
      friday: { type: String, default: '2:00 \u0645 - 10:00 \u0645' },
      phone: { type: String, default: '+966 12 345 6789' },
      currentStatus: { type: String, default: '\u0645\u0641\u062a\u0648\u062d \u0627\u0644\u0622\u0646' },
    },
    locations: { type: Array, default: [] },
    social: {
      facebookUrl: { type: String, default: '' },
      messengerUrl: { type: String, default: '' },
      whatsappUrl: { type: String, default: '' },
      phoneCallLink: { type: String, default: '' },
    },
    theme: {
      logo: { type: String, default: '' },
      primaryColor: { type: String, default: '' },
      secondaryColor: { type: String, default: '' },
      preset: { type: String, default: 'blue' },
    },
    products3DCategories: {
      type: [String],
      default: ['\u0623\u062b\u0627\u062b', '\u0623\u062c\u0647\u0632\u0629', '\u0625\u0636\u0627\u0621\u0629', '\u062f\u064a\u0643\u0648\u0631', '\u0623\u062e\u0631\u0649'],
    },
    shopBuilderDefaults: {
      floorTexture: { type: String, default: 'tiles_white' },
      wallTexture: { type: String, default: 'painted_white' },
      wallColor: { type: String, default: '#ffffff' },
    },
    pricingSettings: {
      hidePrices: { type: Boolean, default: false },
      contactMessage: { type: String, default: '\u0627\u0644\u0633\u0644\u0627\u0645 \u0639\u0644\u064a\u0643\u0645\u060c \u0623\u0648\u062f \u0645\u0639\u0631\u0641\u0629 \u0633\u0639\u0631 \u0627\u0644\u0645\u0646\u062a\u062c' },
    },
    ownerVault: {
      enabled: { type: Boolean, default: true },
      passwordHash: { type: String, default: '' },
      session: {
        tokenHash: { type: String, default: '' },
        expiresAt: { type: Date, default: null },
        lastActivityAt: { type: Date, default: null },
      },
      visibility: {
        publicPages: {
          home: { type: Boolean, default: true },
          products: { type: Boolean, default: true },
          productDetail: { type: Boolean, default: true },
          categories: { type: Boolean, default: true },
          cart: { type: Boolean, default: true },
          checkout: { type: Boolean, default: true },
          favorites: { type: Boolean, default: true },
          profile: { type: Boolean, default: true },
          orders: { type: Boolean, default: true },
          about: { type: Boolean, default: true },
          contact: { type: Boolean, default: true },
          locations: { type: Boolean, default: true },
          shopBuilder: { type: Boolean, default: true },
        },
        adminModules: {
          dashboard: { type: Boolean, default: true },
          products: { type: Boolean, default: true },
          products3d: { type: Boolean, default: true },
          categories: { type: Boolean, default: true },
          orders: { type: Boolean, default: true },
          users: { type: Boolean, default: true },
          locations: { type: Boolean, default: true },
          qrcodes: { type: Boolean, default: true },
          homeConfig: { type: Boolean, default: true },
          settings: { type: Boolean, default: true },
          history: { type: Boolean, default: true },
          profit: { type: Boolean, default: true },
          shareholders: { type: Boolean, default: true },
        },
        featureFlags: {
          rating: { type: Boolean, default: true },
          favorites: { type: Boolean, default: true },
          shopBuilder3d: { type: Boolean, default: true },
          prices: { type: Boolean, default: true },
        },
      },
      updatedBy: { type: String, default: '' },
      updatedAt: { type: Date, default: null },
    },
  },
  { timestamps: true }
);

const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
export default Settings;
