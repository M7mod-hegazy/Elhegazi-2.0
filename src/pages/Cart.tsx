import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Plus, Minus, Trash2, ArrowLeft, Star, ShoppingCart, CreditCard, MessageCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ScrollAnimation from '@/components/ui/scroll-animation';
import { useCart } from '@/hooks/useCart';
import { useDualAuth } from '@/hooks/useDualAuth';
import { useToast } from '@/hooks/use-toast';
import { usePageTitle } from '@/hooks/usePageTitle';
import { usePricingSettings } from '@/hooks/usePricingSettings';
import { ContactButtons } from '@/components/ui/ContactButtons';
import AuthModal from '@/components/ui/auth-modal';

const Cart = () => {
  // Set page title
  usePageTitle('سلة التسوق');
  
  const { items, total, itemCount, updateQuantity, removeItem, clearCart } = useCart();
  const { isAuthenticated, isAdmin } = useDualAuth();
  const { toast } = useToast();
  const { hidePrices, contactMessage } = usePricingSettings();
  const navigate = useNavigate();
  const [promoCode, setPromoCode] = useState('');
  const [isClearing, setIsClearing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
    }
  }, [isAuthenticated]);

  const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      await removeItem(itemId);
    } else {
      await updateQuantity(itemId, newQuantity);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    await removeItem(itemId);
    toast({
      title: "تم حذف المنتج",
      description: "تم حذف المنتج من سلة التسوق",
    });
  };

  const handleClearCart = async () => {
    setIsClearing(true);
    await clearCart();
    setIsClearing(false);
    toast({
      title: "تم مسح السلة",
      description: "تم حذف جميع المنتجات من سلة التسوق",
    });
  };

  const applyPromoCode = () => {
    toast({
      title: "كود الخصم",
      description: "سيتم تطبيق كود الخصم قريباً",
    });
  };

  // Check if user is authenticated and not admin
  if (!isAuthenticated || isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <ScrollAnimation animation="scaleIn" className="text-center max-w-md mx-auto p-8">
          <ShoppingCart className="w-24 h-24 text-slate-300 mx-auto mb-6" />
          <h1 className="text-3xl font-bold text-slate-700 mb-4">تسجيل الدخول مطلوب</h1>
          <p className="text-slate-500 mb-8">يجب تسجيل الدخول كعميل للوصول إلى سلة التسوق</p>
          <div className="space-y-4">
            <Button asChild className="w-full">
              <Link to="/login">تسجيل الدخول</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link to="/register">إنشاء حساب جديد</Link>
            </Button>
          </div>
        </ScrollAnimation>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <ShoppingCart className="w-8 h-8 text-primary" />
              <h1 className="heading-1">سلة التسوق</h1>
              {itemCount > 0 && (
                <Badge variant="secondary" className="text-sm">
                  {itemCount} منتج
                </Badge>
              )}
            </div>

            {items.length > 0 && (
              <Button
                variant="outline"
                onClick={handleClearCart}
                disabled={isClearing}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {isClearing ? 'جاري المسح...' : 'مسح الكل'}
              </Button>
            )}
          </div>

          <p className="body-large text-slate-600">
            {items.length > 0
              ? "راجع منتجاتك وأكمل عملية الشراء"
              : "لم تقم بإضافة أي منتجات للسلة بعد"
            }
          </p>
        </div>

        {items.length === 0 ? (
            <ScrollAnimation animation="fadeIn" className="text-center py-20">
              <ShoppingBag className="w-32 h-32 text-slate-300 mx-auto mb-8" />
              <h2 className="text-4xl font-bold text-slate-700 mb-6">سلة التسوق فارغة</h2>
              <p className="text-xl text-slate-500 mb-8">ابدأ بإضافة المنتجات إلى سلة التسوق</p>
              <Button asChild size="lg" className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 px-8 rounded-full">
                <Link to="/products">
                  <ArrowLeft className="w-6 h-6 mr-3 rtl-flip" />
                  تصفح المنتجات
                </Link>
              </Button>
            </ScrollAnimation>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Cart Items */}
              <div className="lg:col-span-2 space-y-4">
                  {items.map((item, index) => (
                    <ScrollAnimation
                      key={item.id}
                      animation="slideUp"
                      delay={index * 100}
                    >
                      <div className="bg-white rounded-2xl p-6 shadow-lg border border-slate-200 hover:shadow-xl transition-all duration-300">
                        <div className="flex items-center gap-6">
                          {/* Product Image */}
                          <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 flex-shrink-0">
                            <img
                              src={item.product.image || `/api/categories/${item.product.category}/image`}
                              alt={item.product.nameAr}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.onerror = null;
                                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="96" height="96"%3E%3Crect fill="%23f1f5f9" width="96" height="96"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-size="12" fill="%2394a3b8"%3Eلا توجد %3C/text%3E%3C/svg%3E';
                              }}
                            />
                          </div>

                          {/* Product Info */}
                          <div className="flex-1 min-w-0">
                            <Link
                              to={`/product/${item.productId}`}
                              className="text-xl font-bold text-slate-900 hover:text-primary transition-colors duration-300 line-clamp-2"
                            >
                              {item.product.nameAr}
                            </Link>
                            <p className="text-slate-500 mt-1">{item.product.categoryAr}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <div className="flex items-center">
                                {Array.from({ length: 5 }, (_, i) => (
                                  <Star
                                    key={i}
                                    className={`w-4 h-4 ${
                                      i < Math.floor(item.product.rating || 0)
                                        ? 'text-yellow-400 fill-current'
                                        : 'text-slate-300'
                                    }`}
                                  />
                                ))}
                              </div>
                              <span className="text-sm text-slate-500">({item.product.rating})</span>
                            </div>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleUpdateQuantity(item.id, item.quantity - 1);
                              }}
                              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors duration-200"
                            >
                              <Minus className="w-4 h-4 text-slate-600" />
                            </button>
                            
                            <span className="w-12 text-center font-bold text-lg">{item.quantity}</span>
                            
                            <button
                              type="button"
                              onClick={(e) => {
                                e.preventDefault();
                                handleUpdateQuantity(item.id, item.quantity + 1);
                              }}
                              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors duration-200"
                            >
                              <Plus className="w-4 h-4 text-slate-600" />
                            </button>
                          </div>

                          {/* Price and Actions */}
                          <div className="text-left">
                            {hidePrices ? (
                              <div className="flex flex-col gap-2">
                                <span className="text-sm text-slate-500 font-medium">السعر مخفي</span>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleRemoveItem(item.id);
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </div>
                            ) : (
                              <>
                                <div className="text-2xl font-bold text-primary mb-2">
                                  {item.subtotal.toLocaleString()} ج.م
                                </div>
                                <div className="text-sm text-slate-500 mb-3">
                                  {item.price.toLocaleString()} ج.م × {item.quantity}
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleRemoveItem(item.id);
                                  }}
                                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors duration-200"
                                >
                                  <Trash2 className="w-5 h-5" />
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </ScrollAnimation>
                  ))}
              </div>

              {/* Order Summary */}
              <div className="lg:col-span-1">
                <ScrollAnimation animation="slideUp" delay={200}>
                  <div className="bg-white rounded-2xl p-8 shadow-xl border border-slate-200 sticky top-8">
                    <h3 className="text-2xl font-bold text-slate-900 mb-6">ملخص الطلب</h3>
                    
                    {/* Promo Code */}
                    <div className="mb-6">
                      <label className="block text-sm font-semibold text-slate-700 mb-3">كود الخصم</label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="أدخل كود الخصم"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            applyPromoCode();
                          }} 
                          variant="outline"
                        >
                          تطبيق
                        </Button>
                      </div>
                    </div>

                    {/* Order Details */}
                    {hidePrices ? (
                      <div className="space-y-4 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                        <p className="text-sm text-amber-800 font-medium">الأسعار مخفية حالياً</p>
                        <p className="text-xs text-amber-700">يرجى التواصل معنا للحصول على الأسعار والمتابعة</p>
                      </div>
                    ) : (
                      <div className="space-y-4 mb-6">
                        <div className="flex justify-between text-slate-600">
                          <span>المجموع الفرعي:</span>
                          <span>{total.toLocaleString()} ج.م</span>
                        </div>
                        
                        <div className="flex justify-between text-slate-600">
                          <span>الضريبة:</span>
                          <span>{(total * 0.15).toLocaleString()} ج.م</span>
                        </div>
                        <hr className="border-slate-200" />
                        <div className="flex justify-between text-xl font-bold text-slate-900">
                          <span>المجموع الكلي:</span>
                          <span className="text-primary">{(total * 1.15).toLocaleString()} ج.م</span>
                        </div>
                      </div>
                    )}

                    {/* Checkout Button or Contact Button */}
                    {hidePrices ? (
                      <Button 
                        onClick={() => {
                          const whatsappUrl = localStorage.getItem('WHATSAPP_URL') || '';
                          const message = `${contactMessage}\n\nلدي ${itemCount} منتج في السلة`;
                          const encodedMessage = encodeURIComponent(message);
                          if (whatsappUrl) {
                            window.open(`${whatsappUrl}?text=${encodedMessage}`, '_blank');
                          } else {
                            toast({
                              title: 'خطأ',
                              description: 'رقم الواتس غير متوفر',
                              variant: 'destructive'
                            });
                          }
                        }}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold py-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 text-lg"
                      >
                        <MessageCircle className="w-6 h-6 mr-3" />
                        اتصل للحصول على السعر
                      </Button>
                    ) : (
                      <Button 
                        onClick={() => navigate('/checkout')}
                        className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-4 rounded-xl shadow-lg transform hover:scale-105 transition-all duration-300 text-lg"
                      >
                        <CreditCard className="w-6 h-6 mr-3" />
                        إتمام الطلب
                      </Button>
                    )}

                    {/* Continue Shopping */}
                    <Button asChild variant="outline" className="w-full mt-4">
                      <Link to="/products">
                        <ArrowLeft className="w-5 h-5 mr-2 rtl-flip" />
                        متابعة التسوق
                      </Link>
                    </Button>

                    <div className="mt-6 text-center">
                      <p className="text-sm text-slate-500">
                        🔒 عملية دفع آمنة ومشفرة
                      </p>
                    </div>
                  </div>
                </ScrollAnimation>

                {/* Contact Help Card */}
                <ScrollAnimation animation="slideUp" delay={300}>
                  <ContactButtons 
                    title="تحتاج مساعدة؟"
                    description="تواصل معنا للاستفسار عن طلبك"
                    className="mt-6"
                  />
                </ScrollAnimation>
              </div>
            </div>
          )}
      </div>

      {/* Auth Modal - Requires login to view cart */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => {
          setShowAuthModal(false);
          navigate('/');
        }}
        action="cart"
      />
    </div>
  );
};

export default Cart;
