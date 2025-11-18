import { Link, useLocation } from 'react-router-dom';
import { LogIn, UserPlus, X, ShoppingCart, Heart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  action?: 'cart' | 'favorites' | 'general';
  title?: string;
  description?: string;
}

const AuthModal = ({
  isOpen,
  onClose,
  action = 'general',
  title,
  description
}: AuthModalProps) => {
  const location = useLocation();
  const getContent = () => {
    switch (action) {
      case 'cart':
        return {
          icon: <ShoppingCart className="w-16 h-16 text-primary mx-auto mb-4" />,
          title: title || 'تسجيل الدخول مطلوب للسلة',
          description: description || 'يجب تسجيل الدخول كعميل لإضافة المنتجات إلى سلة التسوق'
        };
      case 'favorites':
        return {
          icon: <Heart className="w-16 h-16 text-primary mx-auto mb-4" />,
          title: title || 'تسجيل الدخول مطلوب للمفضلة',
          description: description || 'يجب تسجيل الدخول كعميل لإضافة المنتجات إلى المفضلة'
        };
      default:
        return {
          icon: <LogIn className="w-16 h-16 text-primary mx-auto mb-4" />,
          title: title || 'تسجيل الدخول مطلوب',
          description: description || 'يجب تسجيل الدخول للوصول إلى هذه الميزة'
        };
    }
  };

  const content = getContent();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md bg-gradient-to-br from-white to-primary/5 border-0 shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-slate-900 mb-4 bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
            {content.title}
          </DialogTitle>
          <DialogDescription className="text-slate-600 mb-8 leading-relaxed text-base">
            {content.description}
          </DialogDescription>
          <button
            onClick={onClose}
            className="absolute left-4 top-4 p-2 hover:bg-white/80 rounded-full transition-all duration-200 hover:scale-110 z-10"
          >
            <X className="w-5 h-5 text-slate-600" />
          </button>
        </DialogHeader>

        <div className="text-center py-8 px-2">
          <div className="relative mb-6">
            {content.icon}
            {/* Animated background circle */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-20 h-20 bg-gradient-to-r from-primary/10 to-secondary/10 rounded-full animate-pulse opacity-50"></div>
            </div>
          </div>

          <div className="space-y-4">
            <Button asChild className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 text-white font-semibold py-4 rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300">
              <Link
                to="/login"
                state={{ from: location }}
                onClick={onClose}
              >
                <LogIn className="w-5 h-5 mr-3" />
                تسجيل الدخول
              </Link>
            </Button>

            <Button asChild variant="outline" className="w-full border-2 border-primary/20 hover:bg-primary/5 font-semibold py-4 rounded-xl hover:border-primary transition-all duration-300 hover:scale-105">
              <Link
                to="/register"
                state={{ from: location }}
                onClick={onClose}
              >
                <UserPlus className="w-5 h-5 mr-3" />
                إنشاء حساب جديد
              </Link>
            </Button>
          </div>

          <div className="mt-8 pt-6 border-t border-slate-200">
            <p className="text-sm text-slate-500">
              هل تحتاج مساعدة؟{' '}
              <Link
                to="/contact"
                onClick={onClose}
                className="text-primary hover:text-primary font-medium hover:underline transition-colors duration-200"
              >
                تواصل معنا
              </Link>
            </p>
          </div>

          {/* Decorative elements */}
          <div className="absolute top-4 right-4 w-8 h-8 bg-gradient-to-r from-primary/30 to-secondary/30 rounded-full opacity-20 animate-bounce"></div>
          <div className="absolute bottom-4 left-4 w-6 h-6 bg-gradient-to-r from-secondary/30 to-primary/30 rounded-full opacity-20 animate-bounce" style={{ animationDelay: '0.5s' }}></div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AuthModal;
