import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import * as NavigationMenu from '@radix-ui/react-navigation-menu';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { 
  ShoppingCart, 
  Heart, 
  User, 
  Search, 
  Menu,
  ChevronDown
} from 'lucide-react';

const HeroNavigation: React.FC = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    // Set initial state
    setIsScrolled(window.scrollY > 50);
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav 
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'bg-white/95 backdrop-blur-md shadow-lg border-b border-gray-200/50' 
          : 'bg-white/10 backdrop-blur-md border-b border-white/20'
      }`}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link 
            to="/" 
            className={`text-2xl font-bold transition-colors duration-300 ${
              isScrolled ? 'text-gray-900' : 'text-white'
            }`}
          >
            المتجر
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8 space-x-reverse">
            <NavigationMenu.Root>
              <NavigationMenu.List className="flex items-center space-x-6 space-x-reverse">
                
                {/* Products Dropdown */}
                <NavigationMenu.Item>
                  <DropdownMenu.Root>
                    <DropdownMenu.Trigger asChild>
                      <button 
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                          isScrolled 
                            ? 'text-gray-700 hover:text-primary hover:bg-primary/5' 
                            : 'text-white/90 hover:text-white hover:bg-white/10'
                        }`}
                      >
                        المنتجات
                        <ChevronDown className="w-4 h-4" />
                      </button>
                    </DropdownMenu.Trigger>
                    
                    <DropdownMenu.Portal>
                      <DropdownMenu.Content 
                        className="bg-white rounded-xl shadow-xl border border-gray-200/50 p-2 min-w-[200px] backdrop-blur-md"
                        sideOffset={8}
                      >
                        <DropdownMenu.Item asChild>
                          <Link 
                            to="/products" 
                            className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                          >
                            جميع المنتجات
                          </Link>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item asChild>
                          <Link 
                            to="/categories" 
                            className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                          >
                            الفئات
                          </Link>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item asChild>
                          <Link 
                            to="/products?featured=true" 
                            className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                          >
                            المنتجات المميزة
                          </Link>
                        </DropdownMenu.Item>
                        <DropdownMenu.Item asChild>
                          <Link 
                            to="/products?sale=true" 
                            className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                          >
                            العروض
                          </Link>
                        </DropdownMenu.Item>
                      </DropdownMenu.Content>
                    </DropdownMenu.Portal>
                  </DropdownMenu.Root>
                </NavigationMenu.Item>

                {/* Other Navigation Items */}
                <NavigationMenu.Item>
                  <Link 
                    to="/about" 
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      isScrolled 
                        ? 'text-gray-700 hover:text-primary hover:bg-primary/5' 
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    من نحن
                  </Link>
                </NavigationMenu.Item>

                <NavigationMenu.Item>
                  <Link 
                    to="/contact" 
                    className={`px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
                      isScrolled 
                        ? 'text-gray-700 hover:text-primary hover:bg-primary/5' 
                        : 'text-white/90 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    اتصل بنا
                  </Link>
                </NavigationMenu.Item>
              </NavigationMenu.List>
            </NavigationMenu.Root>
          </div>

          {/* Right Side Actions */}
          <div className="flex items-center space-x-4 space-x-reverse">
            {/* Search */}
            <button 
              className={`p-2 rounded-lg transition-all duration-300 ${
                isScrolled 
                  ? 'text-gray-700 hover:text-primary hover:bg-primary/5' 
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Favorites */}
            <button 
              className={`p-2 rounded-lg transition-all duration-300 relative ${
                isScrolled 
                  ? 'text-gray-700 hover:text-blue-600 hover:bg-blue-50' 
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <Heart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                3
              </span>
            </button>

            {/* Cart */}
            <button 
              className={`p-2 rounded-lg transition-all duration-300 relative ${
                isScrolled 
                  ? 'text-gray-700 hover:text-blue-600 hover:bg-blue-50' 
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
            >
              <ShoppingCart className="w-5 h-5" />
              <span className="absolute -top-1 -right-1 bg-primary text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                2
              </span>
            </button>

            {/* User Account */}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button 
                  className={`p-2 rounded-lg transition-all duration-300 ${
                    isScrolled 
                      ? 'text-gray-700 hover:text-blue-600 hover:bg-blue-50' 
                      : 'text-white/90 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <User className="w-5 h-5" />
                </button>
              </DropdownMenu.Trigger>
              
              <DropdownMenu.Portal>
                <DropdownMenu.Content 
                  className="bg-white rounded-xl shadow-xl border border-gray-200/50 p-2 min-w-[180px] backdrop-blur-md"
                  sideOffset={8}
                  align="end"
                >
                  <DropdownMenu.Item asChild>
                    <Link 
                      to="/profile" 
                      className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                    >
                      الملف الشخصي
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link 
                      to="/orders" 
                      className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                    >
                      طلباتي
                    </Link>
                  </DropdownMenu.Item>
                  <DropdownMenu.Item asChild>
                    <Link 
                      to="/login" 
                      className="block px-4 py-3 text-gray-700 hover:bg-primary/5 hover:text-primary rounded-lg transition-colors"
                    >
                      تسجيل الدخول
                    </Link>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>

            {/* Mobile Menu Button */}
            <button 
              className={`md:hidden p-2 rounded-lg transition-all duration-300 ${
                isScrolled 
                  ? 'text-gray-700 hover:text-blue-600 hover:bg-blue-50' 
                  : 'text-white/90 hover:text-white hover:bg-white/10'
              }`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {isMobileMenuOpen && (
          <div className={`md:hidden py-4 border-t transition-all duration-300 ${
            isScrolled ? 'border-gray-200/50' : 'border-white/20'
          }`}>
            <div className="space-y-2">
              <Link 
                to="/products" 
                className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                  isScrolled 
                    ? 'text-gray-700 hover:bg-primary/5 hover:text-primary' 
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                المنتجات
              </Link>
              <Link 
                to="/about" 
                className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                  isScrolled 
                    ? 'text-gray-700 hover:bg-primary/5 hover:text-primary' 
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                من نحن
              </Link>
              <Link 
                to="/contact" 
                className={`block px-4 py-3 rounded-lg font-medium transition-colors ${
                  isScrolled 
                    ? 'text-gray-700 hover:bg-primary/5 hover:text-primary' 
                    : 'text-white/90 hover:bg-white/10 hover:text-white'
                }`}
              >
                اتصل بنا
              </Link>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default HeroNavigation;