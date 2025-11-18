import { useState, useEffect, useCallback, useRef } from 'react';
import { CartItem, Product, CartState, User } from '@/types';
import { useDualAuth } from '@/hooks/useDualAuth';
import { apiDelete, apiGet, apiPostJson, apiPatchJson } from '@/lib/api';

const CART_STORAGE_KEY = 'shopping_cart';

const initialCartState: CartState = {
  items: [],
  total: 0,
  itemCount: 0,
  isOpen: false
};

// Load cart from localStorage
const loadCartFromStorage = (): CartItem[] => {
  try {
    const stored = localStorage.getItem(CART_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

// Save cart to localStorage
const saveCartToStorage = (items: CartItem[]) => {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error('Failed to save cart to localStorage:', error);
  }
};

export const useCart = () => {
  const [cartState, setCartState] = useState<CartState>(() => {
    const items = loadCartFromStorage();
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return { items, total, itemCount, isOpen: false };
  });
  
  // Use ref to always have latest cart state (avoids React batching issues)
  const cartStateRef = useRef(cartState);
  useEffect(() => {
    cartStateRef.current = cartState;
  }, [cartState]);
  
  // Queue to ensure sequential processing of cart operations
  const operationQueue = useRef<Promise<void>>(Promise.resolve());
  
  const [loading, setLoading] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { isAuthenticated, isAdmin, user } = useDualAuth() as { isAuthenticated: boolean; isAdmin: boolean; user: User | null };

  // Calculate totals
  const calculateTotals = useCallback((items: CartItem[]) => {
    const total = items.reduce((sum, item) => sum + item.subtotal, 0);
    const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
    return { total, itemCount };
  }, []);

  // Update cart state and save to localStorage
  const updateCart = useCallback((items: CartItem[]) => {
    const { total, itemCount } = calculateTotals(items);
    setCartState(prev => ({ ...prev, items, total, itemCount }));
    saveCartToStorage(items);
  }, [calculateTotals]);

  // Sync cart to backend (called manually when needed, e.g., at checkout)
  const syncToBackend = useCallback(async () => {
    if (!isAuthenticated || isAdmin || !user?.id) return;
    
    try {
      // Sync each item individually using existing API
      for (const item of cartState.items) {
        await apiPostJson(`/api/users/${user.id}/cart`, {
          productId: item.productId,
          product: item.product,
          quantity: item.quantity,
          price: item.price
        });
      }
    } catch (err) {
      console.error('Cart sync failed:', err);
    }
  }, [isAuthenticated, isAdmin, user?.id, cartState.items]);

  // Add item to cart (INSTANT with queue to prevent race conditions)
  const addItem = useCallback((product: Product, quantity: number = 1) => {
    // Prevent adding hidden products
    if (product.isHidden) {
      return {
        success: false,
        error: 'هذا المنتج مخفي وغير متاح للشراء'
      };
    }

    // Queue the operation to ensure sequential processing
    operationQueue.current = operationQueue.current.then(() => {
      return new Promise<void>((resolve) => {
        // Read directly from localStorage as source of truth (survives re-renders)
        const currentItems = loadCartFromStorage();
        
        const existingItem = currentItems.find(item => item.productId === product.id);
        
        let newItems: CartItem[];
        if (existingItem) {
          // Update quantity
          newItems = currentItems.map(item =>
            item.productId === product.id
              ? { ...item, quantity: item.quantity + quantity, subtotal: item.price * (item.quantity + quantity) }
              : item
          );
        } else {
          // Add new item
          const newItem: CartItem = {
            id: `cart-${product.id}`,
            productId: product.id,
            product,
            quantity,
            price: product.price,
            subtotal: product.price * quantity
          };
          newItems = [...currentItems, newItem];
        }

        const { total, itemCount } = calculateTotals(newItems);
        
        // Save to localStorage FIRST (source of truth)
        saveCartToStorage(newItems);
        
        // Then update React state
        const newState = { items: newItems, total, itemCount, isOpen: false };
        setCartState(newState);
        cartStateRef.current = newState;
        
        resolve();
      });
    });

    return { success: true };
  }, [calculateTotals]);

  // Remove item from cart (INSTANT)
  const removeItem = useCallback((itemId: string) => {
    setCartState(prev => {
      const newItems = prev.items.filter(i => i.id !== itemId);
      const { total, itemCount } = calculateTotals(newItems);
      saveCartToStorage(newItems);
      return { ...prev, items: newItems, total, itemCount };
    });
  }, [calculateTotals]);

  // Update item quantity (INSTANT)
  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(itemId);
      return;
    }
    
    setCartState(prev => {
      const newItems = prev.items.map(i => 
        i.id === itemId 
          ? { ...i, quantity, subtotal: i.price * quantity }
          : i
      );
      const { total, itemCount } = calculateTotals(newItems);
      saveCartToStorage(newItems);
      return { ...prev, items: newItems, total, itemCount };
    });
  }, [calculateTotals, removeItem]);

  // Clear entire cart (INSTANT)
  const clearCart = useCallback(() => {
    setCartState(prev => ({
      ...prev,
      items: [],
      total: 0,
      itemCount: 0
    }));
    localStorage.removeItem(CART_STORAGE_KEY);
  }, []);

  // Toggle cart visibility
  const toggleCart = useCallback(() => {
    // Check authentication before opening cart
    if (!isAuthenticated || isAdmin) {
      setShowAuthModal(true);
      return;
    }
    setCartState(prev => ({
      ...prev,
      isOpen: !prev.isOpen
    }));
  }, [isAuthenticated, isAdmin]);

  // Open cart
  const openCart = useCallback(() => {
    setCartState(prev => ({
      ...prev,
      isOpen: true
    }));
  }, []);

  // Close cart
  const closeCart = useCallback(() => {
    setCartState(prev => ({
      ...prev,
      isOpen: false
    }));
  }, []);

  // Get item by product ID
  const getItemByProductId = useCallback((productId: string) => {
    return cartState.items.find(item => item.productId === productId);
  }, [cartState.items]);

  // Check if product is in cart
  const isInCart = useCallback((productId: string) => {
    return cartState.items.some(item => item.productId === productId);
  }, [cartState.items]);

  // Get cart summary for checkout
  const getCartSummary = useCallback(() => {
    const subtotal = cartState.total;
    const shipping = subtotal > 500 ? 0 : 50; // Free shipping over 500 SAR
    const tax = subtotal * 0.15; // 15% VAT
    const total = subtotal + shipping + tax;

    return {
      subtotal,
      shipping,
      tax,
      total,
      itemCount: cartState.itemCount,
      items: cartState.items
    };
  }, [cartState]);

  return {
    // State
    items: cartState.items,
    total: cartState.total,
    itemCount: cartState.itemCount,
    isOpen: cartState.isOpen,
    loading,
    showAuthModal,
    setShowAuthModal,

    // Actions
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    toggleCart,
    openCart,
    closeCart,
    syncToBackend, // Manual sync for checkout

    // Utilities
    getItemByProductId,
    isInCart,
    getCartSummary
  };
};