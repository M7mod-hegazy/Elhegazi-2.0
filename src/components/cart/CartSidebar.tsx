import { Fragment } from 'react';
import { Link } from 'react-router-dom';
import { X, Plus, Minus, ShoppingBag, Trash2 } from 'lucide-react';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import AuthModal from '@/components/ui/auth-modal';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';

const CartSidebar = () => {
  const { hidePrices } = usePricingSettings();
  const {
    items,
    isOpen,
    closeCart,
    updateQuantity,
    removeItem,
    getCartSummary,
    clearCart,
    showAuthModal,
    setShowAuthModal
  } = useCart();
  
  const { isAuthenticated, isAdmin } = useDualAuth();

  const summary = getCartSummary();

  const handleQuantityChange = (itemId: string, newQuantity: number) => {
    if (!isAuthenticated || isAdmin) {
      setShowAuthModal(true);
      return;
    }
    updateQuantity(itemId, newQuantity);
  };

  const handleRemoveItem = (itemId: string) => {
    if (!isAuthenticated || isAdmin) {
      setShowAuthModal(true);
      return;
    }
    removeItem(itemId);
  };

  if (items.length === 0 && isOpen) {
    return (
      <Sheet open={isOpen} onOpenChange={closeCart}>
        <SheetContent side="left" className="w-full sm:w-96">
          <SheetHeader>
            <SheetTitle className="text-right">سلة التسوق</SheetTitle>
            <SheetDescription className="text-right">
              سلة التسوق فارغة
            </SheetDescription>
          </SheetHeader>
          
          <div className="flex flex-col items-center justify-center h-96 space-y-4">
            <ShoppingBag className="w-16 h-16 text-muted-foreground" />
            <p className="body-text text-center">سلة التسوق فارغة</p>
            <p className="text-sm text-muted-foreground text-center">
              ابدأ بإضافة منتجات إلى سلتك
            </p>
            <Button asChild onClick={closeCart}>
              <Link to="/products">تسوق الآن</Link>
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Fragment>
    <Sheet open={isOpen} onOpenChange={closeCart}>
      <SheetContent side="left" className="w-full sm:w-96 flex flex-col">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <SheetTitle className="text-right">سلة التسوق</SheetTitle>
            <Badge variant="secondary">{summary.itemCount} منتج</Badge>
          </div>
          <SheetDescription className="text-right">
            مراجعة وتعديل منتجاتك المختارة
          </SheetDescription>
        </SheetHeader>

        {/* Cart Items */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {items.map((item) => (
            <div key={item.id} className="border-b border-border pb-4 last:border-b-0">
              <div className="flex items-start space-x-3 space-x-reverse">
                {/* Product Image */}
                <div className="flex-shrink-0">
                  <img
                    src={item.product.image}
                    alt={item.product.nameAr}
                    className="w-16 h-16 object-cover rounded-button"
                  />
                </div>

                {/* Product Details */}
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-medium text-sm line-clamp-2 text-right">
                      {item.product.nameAr}
                    </h3>
                    <button
                      onClick={() => handleRemoveItem(item.id)}
                      className="text-muted-foreground hover:text-destructive transition-all duration-300 ease-out p-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <p className="text-sm text-muted-foreground text-right">
                    {item.product.categoryAr}
                  </p>

                  {/* Quantity Controls */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 space-x-reverse border border-border rounded-button">
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-all duration-300 ease-out"
                        disabled={item.quantity <= 1}
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-8 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                        className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-all duration-300 ease-out"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>

                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        {item.subtotal.toLocaleString()} ج.م
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.price.toLocaleString()} ج.م للوحدة
                      </p>
                    </div>
                  </div>

                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Cart Summary */}
        <div className="border-t border-border pt-4 space-y-3">
          <div className="flex justify-between text-sm">
            <span>المجموع الفرعي:</span>
            <span>{summary.subtotal.toLocaleString()} ج.م</span>
          </div>
          
          <div className="flex justify-between text-sm">
            <span>الضريبة (15%):</span>
            <span>{summary.tax.toLocaleString()} ج.م</span>
          </div>
          
          <div className="border-t border-border pt-2">
            <div className="flex justify-between font-bold text-lg">
              <span>المجموع:</span>
              <span className="text-primary">{summary.total.toLocaleString()} ج.م</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3 pt-4">
          <Button 
            className="w-full btn-primary" 
            asChild
            onClick={closeCart}
          >
            <Link to="/checkout">متابعة للدفع</Link>
          </Button>
          
          <div className="flex space-x-2 space-x-reverse">
            <Button 
              variant="outline" 
              className="flex-1"
              asChild
              onClick={closeCart}
            >
              <Link to="/cart">عرض السلة</Link>
            </Button>
            
            <Button 
              variant="ghost" 
              className="flex-1"
              asChild
              onClick={closeCart}
            >
              <Link to="/products">متابعة التسوق</Link>
            </Button>
          </div>

          {/* Clear Cart */}
          <Button
            variant="outline"
            size="sm"
            onClick={clearCart}
            className="w-full text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            مسح السلة
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    {/* Auth Modal */}
    <AuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
      action="cart"
    />
  </Fragment>
  );
};

export default CartSidebar;