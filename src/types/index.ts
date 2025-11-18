export interface Product {
  id: string;
  name: string;
  nameAr: string;
  description: string;
  descriptionAr: string;
  price: number;
  originalPrice?: number;
  image: string;
  images: string[];
  category: string;
  categoryAr: string;
  // Deprecated: automatic stock tracking is being removed. Keep optional for backward compatibility.
  stock?: number;
  // New manual visibility flag: when true, product is hidden from storefront
  isHidden?: boolean;
  featured: boolean;
  discount?: number;
  rating: number;
  reviews: number;
  tags: string[];
  sku: string;
  weight?: number;
  dimensions?: {
    length: number;
    width: number;
    height: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  image: string;
  description?: string;
  descriptionAr?: string;
  productCount: number;
  featured: boolean;
  order: number;
  
  // Enhanced category features
  categoryType?: 'product' | 'service' | 'digital' | 'physical';
  icon?: string; // Lucide icon name
  color?: string; // Hex color code
  parentCategory?: string; // Parent category ID for hierarchy
  isActive?: boolean;
  showInMenu?: boolean;
  
  // SEO fields
  metaTitle?: string;
  metaDescription?: string;
  
  // Product preview settings
  useRandomPreview?: boolean;
  previewProducts?: string[];
  
  // Timestamps
  createdAt?: string;
  updatedAt?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  product: Product;
  quantity: number;
  price: number;
  subtotal: number;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  name?: string;
  email?: string;
  phone?: string;
}

export interface DeliveryPreferences {
  preferredDeliveryTime?: 'morning' | 'afternoon' | 'evening' | 'anytime';
  deliveryInstructions?: string;
  preferredContactMethod?: 'phone' | 'email' | 'sms' | 'none';
  allowLeaveAtDoor?: boolean;
  requireSignature?: boolean;
  specialHandling?: string;
}

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  address?: Address;
  deliveryPreferences?: DeliveryPreferences;
  role: 'customer' | 'admin';
  avatar?: string;
  isActive: boolean;
  createdAt: string;
  lastLogin?: string;
}

export interface TrackingEvent {
  status: OrderStatus;
  location?: {
    name: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  timestamp: string;
  description?: string;
  notes?: string;
  carrier?: string;
  trackingNumber?: string;
}

export interface Order {
  id: string;
  _id?: string; // MongoDB ObjectId
  orderNumber?: string; // Human-readable order number
  userId: string;
  items: CartItem[];
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
  status: OrderStatus;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  shippingAddress: Address;
  billingAddress?: Address;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  estimatedDelivery?: string;
  trackingNumber?: string;
  carrier?: string;
  currentLocation?: {
    name: string;
    city: string;
    country: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  trackingEvents?: TrackingEvent[];
  // Cancellation request fields
  cancellationRequested?: boolean;
  cancellationReason?: string;
  cancellationRequestedAt?: string;
  cancellationApprovedAt?: string;
  cancellationApprovedBy?: string;
  // Return request fields
  returnRequested?: boolean;
  returnReason?: string;
  returnRequestedAt?: string;
  returnApprovedAt?: string;
  returnApprovedBy?: string;
  returnTrackingNumber?: string;
  // Email notification tracking
  emailNotifications?: {
    confirmation?: {
      sent: boolean;
      sentAt?: string;
      messageId?: string;
    };
    shipped?: {
      sent: boolean;
      sentAt?: string;
      messageId?: string;
    };
    delivered?: {
      sent: boolean;
      sentAt?: string;
      messageId?: string;
    };
    cancelled?: {
      sent: boolean;
      sentAt?: string;
      messageId?: string;
    };
    returned?: {
      sent: boolean;
      sentAt?: string;
      messageId?: string;
    };
  };
  // Order workflow fields
  assignedTo?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  internalNotes?: Array<{
    text: string;
    createdBy: string;
    createdByName?: string;
    createdAt: string;
  }>;
}

export type OrderStatus = 
  | 'pending' 
  | 'confirmed' 
  | 'processing' 
  | 'shipped' 
  | 'out_for_delivery'
  | 'delivered' 
  | 'cancelled' 
  | 'refunded'
  | 'returned';

export type PaymentStatus = 
  | 'pending' 
  | 'paid' 
  | 'failed' 
  | 'refunded' 
  | 'partially_refunded';

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  token: string | null;
}

export interface CartState {
  items: CartItem[];
  total: number;
  itemCount: number;
  isOpen: boolean;
}

export interface ProductFilters {
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  // Deprecated: use isHidden = false logic instead
  inStock?: boolean;
  // New: include only visible products when false (default)
  isHidden?: boolean;
  featured?: boolean;
  rating?: number;
  tags?: string[];
  search?: string;
}

export interface SortOption {
  value: string;
  label: string;
  labelAr: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
  pagination?: PaginationParams;
}

export interface QRCodeConfig {
  size: number;
  includePrice: boolean;
  includeDescription: boolean;
  backgroundColor: string;
  foregroundColor: string;
  margin: number;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
}

export interface AdminStats {
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  lowStockProducts: number;
  recentOrders: Order[];
  topProducts: Product[];
  salesTrend: {
    date: string;
    sales: number;
    orders: number;
  }[];
}