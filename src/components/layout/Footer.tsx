import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter, Linkedin, Youtube, Github, Box, Users, Building2, ShoppingBag, Star, Flame, Gift, Sparkles, Tag, LogIn, UserPlus, ArrowRight, MessageCircle } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';

// Premium footer link styles
const footerLinkClass = `
  relative flex items-center gap-3 px-3 py-2.5 rounded-lg 
  bg-slate-800/30 hover:bg-primary/15 
  transition-all duration-300 ease-out
  group border border-slate-700/50 hover:border-primary/50
  hover:shadow-[0_0_20px_rgba(var(--primary-rgb),0.2)]
  active:scale-95 active:shadow-none
  overflow-hidden
  before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/0 before:via-primary/10 before:to-primary/0
  before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500
`;

const iconAnimationClass = `
  w-4 h-4 text-primary group-hover:text-white 
  group-hover:scale-125 group-hover:drop-shadow-lg
  transition-all duration-300 ease-out
  relative z-10
`;

const textAnimationClass = `
  text-sm text-slate-300 group-hover:text-white 
  transition-colors duration-300 flex-1
  relative z-10
`;

const arrowAnimationClass = `
  w-3 h-3 text-slate-500 group-hover:text-primary 
  group-hover:translate-x-1 transition-all duration-300
  opacity-0 group-hover:opacity-100
  relative z-10
`;

interface FooterSettings {
  storeName?: string;
  storeDescription?: string;
  phone?: string;
  email?: string;
  address?: string;
  developerName?: string;
  developerUrl?: string;
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    twitter?: string;
    linkedin?: string;
    youtube?: string;
    github?: string;
    whatsapp?: string;
  };
}

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const location = useLocation();
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>('products');
  // Helper function to check if link is active
  const isLinkActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  // Get active link class
  const getActiveLinkClass = (path: string) => {
    const isActive = isLinkActive(path);
    return isActive 
      ? 'bg-primary/25 border-l-4 border-primary text-white pl-2 font-semibold' 
      : '';
  };

  useEffect(() => {
    const fetchFooterSettings = async () => {
      try {
        const res = await fetch('/api/settings/footer');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok) {
          setFooterSettings(data.settings);
        }
      } catch (error) {
        // Silently fail
      }
    };
    fetchFooterSettings();
  }, []);

  // Main navigation links
  const mainLinks = [
    { path: '/shop-setup', label: 'مُخطط المتجر 3D', icon: Box },
    { path: '/about', label: 'من نحن', icon: Users },
    { path: '/locations', label: 'فروعنا', icon: Building2 },
  ];

  // Product categories links
  const [categories, setCategories] = useState<Array<{ slug: string; nameAr: string }>>([]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories');
        if (!res.ok) return;
        const data = await res.json();
        if (data.ok && data.items) {
          setCategories(data.items.slice(0, 8).map((cat: { slug: string; nameAr?: string; name: string }) => ({
            slug: cat.slug,
            nameAr: cat.nameAr || cat.name
          })));
        }
      } catch (error) {
        // Silently fail
      }
    };
    fetchCategories();
  }, []);

  return (
    <footer className="bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100 border-t border-slate-700">
      <div className="container mx-auto px-4 py-8 md:py-12">
        {/* Main Footer Content - Desktop */}
        <div className="hidden md:grid grid-cols-4 gap-8 mb-12">
          {/* Company Info & Contact */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {footerSettings?.storeDescription || 'متخصصون في تجهيز وتزيين المحلات بأحدث الديكورات والمعدات. نقدم حلولاً متكاملة لتجهيز محلاتك بجودة عالية.'}
            </p>

            {/* Auth Buttons - Under Description */}
            <div className="flex gap-3">
              <Link 
                to="/login"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-200 hover:text-white transition-all duration-300 border border-slate-600 hover:border-slate-500 group"
              >
                <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">دخول</span>
              </Link>
              <Link 
                to="/register"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-primary/80 hover:bg-primary text-white transition-all duration-300 border border-primary/50 hover:border-primary group shadow-lg hover:shadow-primary/20"
              >
                <UserPlus className="w-4 h-4 group-hover:scale-110 transition-transform" />
                <span className="text-sm font-medium">تسجيل</span>
              </Link>
            </div>

            {/* Contact Us Section */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white">تواصل معنا</h4>
              <div className="flex gap-2 w-full">
                <a
                  href="https://wa.me/201001234567"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-green-600/20 text-slate-300 hover:text-white transition-all duration-300 border border-slate-700/50 hover:border-green-600/50 text-xs font-medium group"
                >
                  <MessageCircle className="w-4 h-4 text-green-500 group-hover:scale-110 transition-transform" />
                  <span>واتس</span>
                </a>
                <a
                  href="https://m.me/elhegazi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-blue-600/20 text-slate-300 hover:text-white transition-all duration-300 border border-slate-700/50 hover:border-blue-600/50 text-xs font-medium group"
                >
                  <MessageCircle className="w-4 h-4 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span>ماسنجر</span>
                </a>
              </div>
            </div>
            
            {/* Contact Info */}
            <div className="space-y-3">
              {footerSettings?.phone && (
                <a 
                  href={`tel:${footerSettings.phone}`}
                  className="flex items-center space-x-3 space-x-reverse group"
                >
                  <div className="bg-slate-700 p-2 rounded-lg group-hover:bg-primary transition-colors">
                    <Phone className="w-4 h-4 text-slate-300 group-hover:text-white" />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{footerSettings.phone}</span>
                </a>
              )}
              {footerSettings?.email && (
                <a 
                  href={`mailto:${footerSettings.email}`}
                  className="flex items-center space-x-3 space-x-reverse group"
                >
                  <div className="bg-slate-700 p-2 rounded-lg group-hover:bg-primary transition-colors">
                    <Mail className="w-4 h-4 text-slate-300 group-hover:text-white" />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{footerSettings.email}</span>
                </a>
              )}
              {footerSettings?.address && (
                <div className="flex items-center space-x-3 space-x-reverse group">
                  <div className="bg-slate-700 p-2 rounded-lg group-hover:bg-primary transition-colors">
                    <MapPin className="w-4 h-4 text-slate-300 group-hover:text-white" />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{footerSettings.address}</span>
                </div>
              )}
            </div>
          </div>

          {/* Main Navigation Links */}
          <div>
            <h3 className="text-lg font-bold text-white mb-6 pb-2 border-b border-slate-700">الروابط الرئيسية</h3>
            <div className="space-y-3">
              {mainLinks.map((link) => {
                const IconComponent = link.icon;
                return (
                  <Link 
                    key={link.path}
                    to={link.path} 
                    className={`${footerLinkClass} ${getActiveLinkClass(link.path)}`}
                  >
                    <IconComponent className={`${iconAnimationClass} w-5 h-5`} />
                    <span className={textAnimationClass}>{link.label}</span>
                    <ArrowRight className={arrowAnimationClass} />
                  </Link>
                );
              })}
            </div>
          </div>

          {/* Product Categories */}
          <div>
            <h3 className="text-lg font-bold text-white mb-6 pb-2 border-b border-slate-700">الأقسام</h3>
            <div className="space-y-3">
              {categories.length > 0 ? (
                categories.map((cat) => (
                  <Link 
                    key={cat.slug}
                    to={`/category/${cat.slug}`} 
                    className={`${footerLinkClass} ${getActiveLinkClass(`/category/${cat.slug}`)}`}
                  >
                    <span className="w-2 h-2 bg-primary rounded-full group-hover:scale-150 group-hover:shadow-lg group-hover:shadow-primary/50 transition-all relative z-10"></span>
                    <span className={textAnimationClass}>{cat.nameAr}</span>
                    <ArrowRight className={arrowAnimationClass} />
                  </Link>
                ))
              ) : (
                <p className="text-sm text-slate-400">جاري التحميل...</p>
              )}
            </div>
          </div>

          {/* Product Details & Links */}
          <div>
            <h3 className="text-lg font-bold text-white mb-6 pb-2 border-b border-slate-700">المنتجات</h3>
            <div className="space-y-2">
              <Link 
                to="/products" 
                className={`${footerLinkClass} ${getActiveLinkClass('/products')}`}
              >
                <ShoppingBag className={`${iconAnimationClass} group-hover:rotate-12`} />
                <span className={textAnimationClass}>جميع المنتجات</span>
                <ArrowRight className={arrowAnimationClass} />
              </Link>

              {/* جميع الفئات - Under جميع المنتجات */}
              <Link
                to="/categories"
                className={`${footerLinkClass} ${getActiveLinkClass('/categories')}`}
              >
                <Tag className={`${iconAnimationClass} group-hover:-rotate-12`} />
                <span className={textAnimationClass}>جميع الفئات</span>
                <ArrowRight className={arrowAnimationClass} />
              </Link>

              <Link 
                to="/featured" 
                className={`${footerLinkClass} ${getActiveLinkClass('/featured')}`}
              >
                <Star className={`${iconAnimationClass} group-hover:animate-spin`} />
                <span className={textAnimationClass}>المنتجات المميزة</span>
                <ArrowRight className={arrowAnimationClass} />
              </Link>
              <Link 
                to="/best-sellers" 
                className={`${footerLinkClass} ${getActiveLinkClass('/best-sellers')}`}
              >
                <Flame className={`${iconAnimationClass} group-hover:animate-pulse`} />
                <span className={textAnimationClass}>الأفضل مبيعاً</span>
                <ArrowRight className={arrowAnimationClass} />
              </Link>
              <Link 
                to="/special-offers" 
                className={`${footerLinkClass} ${getActiveLinkClass('/special-offers')}`}
              >
                <Gift className={`${iconAnimationClass} group-hover:bounce`} />
                <span className={textAnimationClass}>العروض الخاصة</span>
                <ArrowRight className={arrowAnimationClass} />
              </Link>
              <Link 
                to="/latest" 
                className={`${footerLinkClass} ${getActiveLinkClass('/latest')}`}
              >
                <Sparkles className={iconAnimationClass} />
                <span className={textAnimationClass}>الجديد</span>
                <ArrowRight className={arrowAnimationClass} />
              </Link>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <div className="md:hidden mb-8 space-y-4">
          {/* Mobile Logo & Description */}
          <div className="space-y-3 pb-4 border-b border-slate-700">
            <Logo size="lg" showText={true} linkTo="/" />
            <p className="text-xs text-slate-300 leading-relaxed">
              {footerSettings?.storeDescription || 'متخصصون في تجهيز وتزيين المحلات بأحدث الديكورات والمعدات.'}
            </p>

            {/* Mobile Auth Buttons */}
            <div className="flex gap-2">
              <Link 
                to="/login"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-700/50 hover:bg-slate-600 text-slate-200 hover:text-white transition-all duration-300 border border-slate-600 hover:border-slate-500 group text-xs"
              >
                <LogIn className="w-3 h-3" />
                <span>دخول</span>
              </Link>
              <Link 
                to="/register"
                className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-primary/80 hover:bg-primary text-white transition-all duration-300 border border-primary/50 hover:border-primary group text-xs"
              >
                <UserPlus className="w-3 h-3" />
                <span>تسجيل</span>
              </Link>
            </div>

            {/* Contact Us Section */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white px-2">تواصل معنا</h4>
              <div className="flex gap-2 w-full">
                <a
                  href="https://wa.me/201001234567"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-green-600/20 text-slate-300 hover:text-white transition-all duration-300 border border-slate-700/50 hover:border-green-600/50 text-xs font-medium group"
                >
                  <MessageCircle className="w-3 h-3 text-green-500 group-hover:scale-110 transition-transform" />
                  <span>واتس</span>
                </a>
                <a
                  href="https://m.me/elhegazi"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-slate-800/30 hover:bg-blue-600/20 text-slate-300 hover:text-white transition-all duration-300 border border-slate-700/50 hover:border-blue-600/50 text-xs font-medium group"
                >
                  <MessageCircle className="w-3 h-3 text-blue-500 group-hover:scale-110 transition-transform" />
                  <span>ماسنجر</span>
                </a>
              </div>
            </div>

            {/* Social Media Icons - Under Login Buttons */}
            {footerSettings?.socialLinks && Object.values(footerSettings.socialLinks).some(link => link) && (
              <div className="flex flex-wrap gap-2 justify-center pt-2">
                {footerSettings.socialLinks.facebook && (
                  <a
                    href={footerSettings.socialLinks.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-blue-600 text-slate-300 hover:text-white transition-all"
                  >
                    <Facebook className="w-4 h-4" />
                  </a>
                )}
                {footerSettings.socialLinks.instagram && (
                  <a
                    href={footerSettings.socialLinks.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-pink-600 text-slate-300 hover:text-white transition-all"
                  >
                    <Instagram className="w-4 h-4" />
                  </a>
                )}
                {footerSettings.socialLinks.twitter && (
                  <a
                    href={footerSettings.socialLinks.twitter}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-sky-500 text-slate-300 hover:text-white transition-all"
                  >
                    <Twitter className="w-4 h-4" />
                  </a>
                )}
                {footerSettings.socialLinks.youtube && (
                  <a
                    href={footerSettings.socialLinks.youtube}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-red-600 text-slate-300 hover:text-white transition-all"
                  >
                    <Youtube className="w-4 h-4" />
                  </a>
                )}
                {footerSettings.socialLinks.linkedin && (
                  <a
                    href={footerSettings.socialLinks.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg bg-slate-800/50 hover:bg-blue-700 text-slate-300 hover:text-white transition-all"
                  >
                    <Linkedin className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Mobile Contact Info */}
          {(footerSettings?.phone || footerSettings?.email || footerSettings?.address) && (
            <div className="space-y-2 pb-4 border-b border-slate-700">
              {footerSettings?.phone && (
                <a href={`tel:${footerSettings.phone}`} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors">
                  <Phone className="w-3 h-3 text-primary" />
                  <span>{footerSettings.phone}</span>
                </a>
              )}
              {footerSettings?.email && (
                <a href={`mailto:${footerSettings.email}`} className="flex items-center gap-2 text-xs text-slate-300 hover:text-white transition-colors">
                  <Mail className="w-3 h-3 text-primary" />
                  <span>{footerSettings.email}</span>
                </a>
              )}
              {footerSettings?.address && (
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <MapPin className="w-3 h-3 text-primary flex-shrink-0" />
                  <span>{footerSettings.address}</span>
                </div>
              )}
            </div>
          )}

          {/* Mobile Sections - 2 Column Layout */}
          <div className="space-y-4">
            {/* الروابط & الأقسام - 2 Columns */}
            <div className="grid grid-cols-2 gap-3">
              {/* الروابط الرئيسية */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white px-2">الروابط</h4>
              {mainLinks.map((link) => {
                const IconComponent = link.icon;
                const isActive = isLinkActive(link.path);
                return (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`relative flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all group border border-slate-700/50 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] active:scale-95 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/0 before:via-primary/10 before:to-primary/0 before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500 ${
                      isActive 
                        ? 'bg-primary/25 text-white border-l-4 border-primary pl-1 font-semibold' 
                        : 'text-slate-300 hover:text-white hover:bg-slate-800/30 hover:bg-primary/15 bg-slate-800/30'
                    }`}
                  >
                    <IconComponent className="w-3 h-3 text-primary group-hover:text-white group-hover:scale-110 transition-all duration-300 relative z-10" />
                    <span className="relative z-10">{link.label}</span>
                  </Link>
                );
              })}
            </div>

            {/* الأقسام */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white px-2">الأقسام</h4>
              {categories.length > 0 ? (
                categories.map((cat) => {
                  const isActive = isLinkActive(`/category/${cat.slug}`);
                  return (
                    <Link
                      key={cat.slug}
                      to={`/category/${cat.slug}`}
                      className={`relative flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all group border border-slate-700/50 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] active:scale-95 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/0 before:via-primary/10 before:to-primary/0 before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500 ${
                        isActive 
                          ? 'bg-primary/25 text-white border-l-4 border-primary pl-1 font-semibold' 
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/30 hover:bg-primary/15 bg-slate-800/30'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 bg-primary rounded-full group-hover:scale-125 transition-transform relative z-10"></span>
                      <span className="relative z-10">{cat.nameAr}</span>
                    </Link>
                  );
                })
              ) : (
                <p className="text-xs text-slate-400 p-2">جاري التحميل...</p>
              )}
              </div>
            </div>

            {/* المنتجات - 2 Column Grid */}
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-white px-2">المنتجات</h4>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { path: '/products', label: 'جميع المنتجات', Icon: ShoppingBag },
                  { path: '/categories', label: 'جميع الفئات', Icon: Tag },
                  { path: '/featured', label: 'المنتجات المميزة', Icon: Star },
                  { path: '/best-sellers', label: 'الأفضل مبيعاً', Icon: Flame },
                  { path: '/special-offers', label: 'العروض الخاصة', Icon: Gift },
                  { path: '/latest', label: 'الجديد', Icon: Sparkles },
                ].map((item) => {
                  const isActive = isLinkActive(item.path);
                  return (
                    <Link 
                      key={item.path}
                      to={item.path} 
                      className={`relative flex items-center gap-1 px-2 py-1.5 rounded text-xs transition-all group border border-slate-700/50 hover:border-primary/50 hover:shadow-[0_0_15px_rgba(var(--primary-rgb),0.15)] active:scale-95 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-primary/0 before:via-primary/10 before:to-primary/0 before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-500 ${
                        isActive 
                          ? 'bg-primary/25 text-white border-l-4 border-primary pl-1 font-semibold' 
                          : 'text-slate-300 hover:text-white hover:bg-slate-800/30 hover:bg-primary/15 bg-slate-800/30'
                      }`}
                    >
                      <item.Icon className="w-3 h-3 text-primary group-hover:text-white group-hover:scale-110 transition-all duration-300 flex-shrink-0 relative z-10" />
                      <span className="truncate relative z-10">{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Social Media */}
        {footerSettings?.socialLinks && Object.values(footerSettings.socialLinks).some(link => link) && (
          <div className="mb-8 pb-8 border-b border-slate-700">
            <h3 className="text-lg font-bold text-white mb-4">تابعنا</h3>
            <div className="flex flex-wrap gap-3">
              {footerSettings.socialLinks.facebook && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-slate-700 hover:bg-primary text-slate-300 hover:text-white transition-all"
                  asChild
                >
                  <a href={footerSettings.socialLinks.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook">
                    <Facebook className="h-5 w-5" />
                  </a>
                </Button>
              )}
              {footerSettings.socialLinks.instagram && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-slate-700 hover:bg-primary text-slate-300 hover:text-white transition-all"
                  asChild
                >
                  <a href={footerSettings.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram">
                    <Instagram className="h-5 w-5" />
                  </a>
                </Button>
              )}
              {footerSettings.socialLinks.twitter && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-slate-700 hover:bg-primary text-slate-300 hover:text-white transition-all"
                  asChild
                >
                  <a href={footerSettings.socialLinks.twitter} target="_blank" rel="noopener noreferrer" aria-label="Twitter">
                    <Twitter className="h-5 w-5" />
                  </a>
                </Button>
              )}
              {footerSettings.socialLinks.linkedin && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-slate-700 hover:bg-primary text-slate-300 hover:text-white transition-all"
                  asChild
                >
                  <a href={footerSettings.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn">
                    <Linkedin className="h-5 w-5" />
                  </a>
                </Button>
              )}
              {footerSettings.socialLinks.youtube && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-slate-700 hover:bg-primary text-slate-300 hover:text-white transition-all"
                  asChild
                >
                  <a href={footerSettings.socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube">
                    <Youtube className="h-5 w-5" />
                  </a>
                </Button>
              )}
              {footerSettings.socialLinks.github && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="bg-slate-700 hover:bg-primary text-slate-300 hover:text-white transition-all"
                  asChild
                >
                  <a href={footerSettings.socialLinks.github} target="_blank" rel="noopener noreferrer" aria-label="GitHub">
                    <Github className="h-5 w-5" />
                  </a>
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-700">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-slate-400">
              © {currentYear} {footerSettings?.storeName || 'متجر إلكتروني'}. جميع الحقوق محفوظة.
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
