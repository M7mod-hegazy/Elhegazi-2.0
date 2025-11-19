import { Product, Category, User, Order, AuthState } from '@/types';

// Sample Categories
export const categories: Category[] = [
  {
    id: 'electronics',
    name: 'Electronics',
    nameAr: 'إلكترونيات',
    slug: 'electronics',
    image: 'https://images.unsplash.com/photo-1498049794561-7780e7231661?w=500',
    description: 'Latest electronic devices and gadgets',
    descriptionAr: 'أحدث الأجهزة الإلكترونية والتقنية',
    productCount: 15,
    featured: true,
    order: 1
  },
  {
    id: 'fashion',
    name: 'Fashion',
    nameAr: 'أزياء',
    slug: 'fashion',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=500',
    description: 'Trendy clothing and accessories',
    descriptionAr: 'ملابس وإكسسوارات عصرية',
    productCount: 25,
    featured: true,
    order: 2
  },
  {
    id: 'home',
    name: 'Home & Garden',
    nameAr: 'منزل وحديقة',
    slug: 'home-garden',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500',
    description: 'Home improvement and gardening essentials',
    descriptionAr: 'مستلزمات تحسين المنزل والحديقة',
    productCount: 18,
    featured: true,
    order: 3
  },
  {
    id: 'sports',
    name: 'Sports & Fitness',
    nameAr: 'رياضة ولياقة',
    slug: 'sports-fitness',
    image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=500',
    description: 'Sports equipment and fitness gear',
    descriptionAr: 'معدات رياضية وأدوات لياقة بدنية',
    productCount: 12,
    featured: false,
    order: 4
  }
];

// Sample Products
export const products: Product[] = [
  {
    id: 'p1',
    name: 'iPhone 15 Pro',
    nameAr: 'آيفون 15 برو',
    description: 'Latest iPhone with advanced features and titanium design',
    descriptionAr: 'أحدث آيفون بميزات متقدمة وتصميم من التيتانيوم',
    price: 4999,
    originalPrice: 5499,
    image: 'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
    images: [
      'https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=500',
      'https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=500',
      'https://images.unsplash.com/photo-1565849904461-04a58ad377e0?w=500'
    ],
    category: 'electronics',
    categoryAr: 'إلكترونيات',
    stock: 15,
    featured: true,
    discount: 9,
    rating: 4.8,
    reviews: 128,
    tags: ['smartphone', 'apple', 'premium'],
    sku: 'IPH15PRO-256',
    weight: 0.19,
    dimensions: {
      length: 146.6,
      width: 70.6,
      height: 8.25
    },
    createdAt: '2024-01-15T10:30:00Z',
    updatedAt: '2024-01-20T14:45:00Z'
  },
  {
    id: 'p2',
    name: 'Samsung Galaxy Watch 6',
    nameAr: 'ساعة سامسونج جالاكسي 6',
    description: 'Advanced smartwatch with health monitoring and GPS',
    descriptionAr: 'ساعة ذكية متقدمة مع مراقبة الصحة ونظام تحديد المواقع',
    price: 1299,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
    images: [
      'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500',
      'https://images.unsplash.com/photo-1434493789847-2f02dc6ca35d?w=500'
    ],
    category: 'electronics',
    categoryAr: 'إلكترونيات',
    stock: 22,
    featured: true,
    rating: 4.6,
    reviews: 89,
    tags: ['smartwatch', 'samsung', 'fitness'],
    sku: 'SGW6-44MM',
    weight: 0.033,
    createdAt: '2024-01-10T08:15:00Z',
    updatedAt: '2024-01-18T16:20:00Z'
  },
  {
    id: 'p3',
    name: 'Nike Air Max 270',
    nameAr: 'نايك إير ماكس 270',
    description: 'Comfortable running shoes with premium cushioning',
    descriptionAr: 'حذاء جري مريح مع توسيد متميز',
    price: 649,
    originalPrice: 799,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
    images: [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500',
      'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=500'
    ],
    category: 'sports',
    categoryAr: 'رياضة ولياقة',
    stock: 8,
    featured: true,
    discount: 19,
    rating: 4.7,
    reviews: 156,
    tags: ['shoes', 'nike', 'running'],
    sku: 'NAM270-42',
    weight: 0.65,
    createdAt: '2024-01-12T12:00:00Z',
    updatedAt: '2024-01-19T09:30:00Z'
  },
  {
    id: 'p4',
    name: 'Elegant Cotton Shirt',
    nameAr: 'قميص قطني أنيق',
    description: 'Premium cotton shirt perfect for business and casual wear',
    descriptionAr: 'قميص قطني متميز مثالي للأعمال والارتداء الكاجوال',
    price: 199,
    image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
    images: [
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=500',
      'https://images.unsplash.com/photo-1602810318383-e386cc2a3ccf?w=500'
    ],
    category: 'fashion',
    categoryAr: 'أزياء',
    stock: 35,
    featured: false,
    rating: 4.3,
    reviews: 67,
    tags: ['shirt', 'cotton', 'business'],
    sku: 'ECS-L-WHT',
    weight: 0.25,
    createdAt: '2024-01-08T14:20:00Z',
    updatedAt: '2024-01-16T11:10:00Z'
  },
  {
    id: 'p5',
    name: 'Modern Coffee Table',
    nameAr: 'طاولة قهوة عصرية',
    description: 'Stylish wooden coffee table for modern living rooms',
    descriptionAr: 'طاولة قهوة خشبية أنيقة لغرف المعيشة العصرية',
    price: 899,
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500',
    images: [
      'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=500',
      'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=500'
    ],
    category: 'home',
    categoryAr: 'منزل وحديقة',
    stock: 12,
    featured: true,
    rating: 4.5,
    reviews: 34,
    tags: ['furniture', 'coffee-table', 'wood'],
    sku: 'MCT-OAK-120',
    weight: 15.5,
    dimensions: {
      length: 120,
      width: 60,
      height: 40
    },
    createdAt: '2024-01-05T16:45:00Z',
    updatedAt: '2024-01-17T13:25:00Z'
  },
  {
    id: 'p6',
    name: 'Wireless Headphones',
    nameAr: 'سماعات لاسلكية',
    description: 'High-quality wireless headphones with noise cancellation',
    descriptionAr: 'سماعات لاسلكية عالية الجودة مع إلغاء الضوضاء',
    price: 449,
    originalPrice: 599,
    image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500',
      'https://images.unsplash.com/photo-1484704849700-f032a568e944?w=500'
    ],
    category: 'electronics',
    categoryAr: 'إلكترونيات',
    stock: 18,
    featured: true,
    discount: 25,
    rating: 4.4,
    reviews: 92,
    tags: ['headphones', 'wireless', 'audio'],
    sku: 'WH-NC-BLK',
    weight: 0.25,
    createdAt: '2024-01-14T09:15:00Z',
    updatedAt: '2024-01-21T15:40:00Z'
  }
];

// Sample Users
export const users: User[] = [
  {
    id: 'u1',
    email: 'user@test.com',
    firstName: 'أحمد',
    lastName: 'محمد',
    phone: '+966501234567',
    role: 'customer',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-01-21T10:30:00Z',
    address: {
      street: 'شارع الملك فهد، الحي التجاري',
      city: 'الرياض',
      state: 'منطقة الرياض',
      postalCode: '12345',
      country: 'المملكة العربية السعودية',
      isDefault: true
    }
  },
  {
    id: 'u2',
    email: 'admin@superuser.com',
    firstName: 'مدير',
    lastName: 'النظام',
    phone: '+966501234568',
    role: 'admin',
    isActive: true,
    createdAt: '2024-01-01T00:00:00Z',
    lastLogin: '2024-01-21T08:00:00Z'
  }
];

// Sample Orders
export const orders: Order[] = [
  {
    id: 'ord-001',
    userId: 'u1',
    items: [
      {
        id: 'ci1',
        productId: 'p1',
        product: products[0],
        quantity: 1,
        price: 4999,
        subtotal: 4999
      },
      {
        id: 'ci2',
        productId: 'p2',
        product: products[1],
        quantity: 1,
        price: 1299,
        subtotal: 1299
      }
    ],
    subtotal: 6298,
    shipping: 50,
    tax: 944.7,
    total: 7292.7,
    status: 'confirmed',
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    shippingAddress: {
      street: 'شارع الملك فهد، الحي التجاري',
      city: 'الرياض',
      state: 'منطقة الرياض',
      postalCode: '12345',
      country: 'المملكة العربية السعودية',
      isDefault: true
    },
    createdAt: '2024-01-20T14:30:00Z',
    updatedAt: '2024-01-21T09:15:00Z',
    estimatedDelivery: '2024-01-25T16:00:00Z',
    trackingNumber: 'TRK123456789'
  }
];

// Initial auth state
export const initialAuthState: AuthState = {
  user: null,
  isAuthenticated: false,
  isAdmin: false,
  token: null
};

// Local storage keys
export const STORAGE_KEYS = {
  AUTH: 'ecommerce_auth',
  CART: 'ecommerce_cart',
  PRODUCTS: 'ecommerce_products',
  CATEGORIES: 'ecommerce_categories',
  USERS: 'ecommerce_users',
  ORDERS: 'ecommerce_orders'
};

// Initialize local storage with sample data
export const initializeLocalStorage = () => {
  if (typeof window === 'undefined') return;

  // Initialize products if not exists
  if (!localStorage.getItem(STORAGE_KEYS.PRODUCTS)) {
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(products));
  }

  // Initialize categories if not exists
  if (!localStorage.getItem(STORAGE_KEYS.CATEGORIES)) {
    localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(categories));
  }

  // Initialize users if not exists
  if (!localStorage.getItem(STORAGE_KEYS.USERS)) {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  }

  // Initialize orders if not exists
  if (!localStorage.getItem(STORAGE_KEYS.ORDERS)) {
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(orders));
  }

  // Initialize auth if not exists
  if (!localStorage.getItem(STORAGE_KEYS.AUTH)) {
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(initialAuthState));
  }

  // Initialize cart if not exists
  if (!localStorage.getItem(STORAGE_KEYS.CART)) {
    localStorage.setItem(STORAGE_KEYS.CART, JSON.stringify({ items: [], total: 0, itemCount: 0, isOpen: false }));
  }
};

// Helper functions for localStorage operations
export const getFromStorage = <T>(key: string, defaultValue: T): T => {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (error) {
    console.error('Error reading from localStorage:', error);
    return defaultValue;
  }
};

export const setToStorage = <T>(key: string, value: T): void => {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error('Error writing to localStorage:', error);
  }
};
