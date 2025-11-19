import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Phone, MapPin, Facebook, Instagram, Twitter, Linkedin, Youtube, Github } from 'lucide-react';
import Logo from '@/components/ui/Logo';
import { Button } from '@/components/ui/button';

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
  };
}

const Footer = () => {
  const currentYear = new Date().getFullYear();
  const [footerSettings, setFooterSettings] = useState<FooterSettings | null>(null);
  const [categories, setCategories] = useState<Array<{ slug: string; nameAr: string }>>([]);

  useEffect(() => {
    const fetchFooterSettings = async () => {
      try {
        const res = await fetch('/api/settings/footer');
        if (!res.ok) return; // Silently fail if endpoint doesn't exist
        const data = await res.json();
        if (data.ok) {
          setFooterSettings(data.settings);
        }
      } catch (error) {
        // Silently fail - endpoint not implemented yet
      }
    };
    fetchFooterSettings();
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/categories?limit=6&featured=true');
        if (!res.ok) return; // Silently fail if endpoint doesn't exist
        const data = await res.json();
        if (data.ok && data.items) {
          setCategories(data.items.map((cat: { slug: string; nameAr?: string; name: string }) => ({
            slug: cat.slug,
            nameAr: cat.nameAr || cat.name
          })));
        }
      } catch (error) {
        // Silently fail - endpoint not implemented yet
      }
    };
    fetchCategories();
  }, []);

  const quickLinks = [
    { path: '/', label: 'الرئيسية' },
    { path: '/categories', label: 'الأقسام' },
    { path: '/about', label: 'من نحن' },
    { path: '/contact', label: 'لمعرفة السعر' },
    { path: '/sitemap', label: 'خريطة الموقع' }
  ];

  return (
    <footer className="bg-gradient-to-b from-slate-900 to-slate-800 text-slate-100">
      <div className="container mx-auto px-4 py-12">
        {/* Main Footer Content */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12 mb-12">
          {/* Company Info */}
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <Logo size="lg" showText={true} linkTo="/" />
            </div>
            <p className="text-sm text-slate-300 leading-relaxed">
              {footerSettings?.storeDescription || 'متخصصون في تجهيز وتزيين المحلات بأحدث الديكورات والمعدات. نقدم حلولاً متكاملة لتجهيز محلاتك بجودة عالية.'}
            </p>
            
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

          {/* Quick Links */}
          <div>
            <h3 className="text-lg font-bold text-white mb-6 pb-2 border-b border-slate-700">روابط سريعة</h3>
            <ul className="space-y-3">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link 
                    to={link.path} 
                    className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Categories */}
          <div>
            <h3 className="text-lg font-bold text-white mb-6 pb-2 border-b border-slate-700">الأقسام</h3>
            <ul className="space-y-3">
              {categories.map((category) => (
                <li key={category.slug}>
                  <Link 
                    to={`/category/${category.slug}`} 
                    className="text-sm text-slate-300 hover:text-white transition-colors flex items-center gap-2 group"
                  >
                    <span className="w-1.5 h-1.5 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></span>
                    {category.nameAr}
                  </Link>
                </li>
              ))}
              {categories.length === 0 && (
                <li className="text-sm text-slate-400">لا توجد أقسام</li>
              )}
            </ul>
          </div>

          {/* Social Media */}
          {footerSettings?.socialLinks && Object.values(footerSettings.socialLinks).some(link => link) && (
            <div>
              <h3 className="text-lg font-bold text-white mb-6 pb-2 border-b border-slate-700">تابعنا</h3>
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
        </div>

        {/* Bottom Bar */}
        <div className="pt-8 border-t border-slate-700">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="text-sm text-slate-400">
              © {currentYear} {footerSettings?.storeName || 'متجر إلكتروني'}. جميع الحقوق محفوظة.
            </div>
            
            <div className="flex flex-wrap justify-center items-center gap-4">
              <Link to="/privacy" className="text-xs text-slate-400 hover:text-white transition-colors">
                الخصوصية
              </Link>
              <span className="text-slate-600">•</span>
              <Link to="/terms" className="text-xs text-slate-400 hover:text-white transition-colors">
                الشروط والأحكام
              </Link>
              <span className="text-slate-600">•</span>
              <Link to="/sitemap" className="text-xs text-slate-400 hover:text-white transition-colors">
                خريطة الموقع
              </Link>
            </div>

            {footerSettings?.developerName && (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-slate-400">Developed by</span>
                {footerSettings.developerUrl ? (
                  <a 
                    href={footerSettings.developerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-bold text-secondary hover:text-secondary/80 transition-colors"
                  >
                    {footerSettings.developerName}
                  </a>
                ) : (
                  <span className="font-bold text-secondary">{footerSettings.developerName}</span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
