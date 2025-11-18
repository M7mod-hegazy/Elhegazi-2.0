import { Link } from 'react-router-dom';
import { Heart, ArrowRight, Users, Award, Shield, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useHomeConfig } from '@/hooks/useHomeConfig';
import { Card, CardContent } from '@/components/ui/card';

const About = () => {
  // Set page title
  usePageTitle('من نحن');
  
  const { about: aboutData } = useHomeConfig();
  
  // Safe access with defaults
  const title = aboutData?.title || 'من نحن';
  const description = aboutData?.description || 'اكتشف قصتنا ورؤيتنا';
  const image = aboutData?.image || '';
  const vision = aboutData?.vision || '';
  const mission = aboutData?.mission || '';
  const customers = aboutData?.stats?.customers || '';
  const products = aboutData?.stats?.products || '';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section - Premium Design */}
      <section className="relative py-20 md:py-32 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            {/* Icon Badge */}
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 backdrop-blur-sm border border-primary/30 mx-auto">
              <Heart className="w-8 h-8 text-primary fill-primary" />
            </div>
            
            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-black text-slate-900 leading-tight">
              {title}
            </h1>
            
            {/* Description */}
            {description && (
              <p className="text-lg md:text-xl text-slate-600 leading-relaxed max-w-3xl mx-auto">
                {description}
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Stats Section - Only show if data exists */}
      {(customers || products) && (
      <section className="py-20 bg-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
            {customers && (
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-primary/5 to-primary/10">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-gradient-to-br from-primary to-primary/80 shadow-lg">
                    <Users className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <div className="text-4xl font-black text-primary">{customers}</div>
                    <p className="text-slate-600 font-medium mt-2">عميل راضي</p>
                  </div>
                </CardContent>
              </Card>
            )}
            {products && (
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-secondary/5 to-secondary/10">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto bg-gradient-to-br from-secondary to-secondary/80 shadow-lg">
                    <Award className="w-10 h-10 text-white" />
                  </div>
                  <div>
                    <div className="text-4xl font-black text-secondary">{products}</div>
                    <p className="text-slate-600 font-medium mt-2">منتج متاح</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </section>
      )}

      {/* Mission & Vision - Only show if vision or mission exists */}
      {(vision || mission || image) && (
      <section className="py-20 bg-gradient-to-b from-slate-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center max-w-6xl mx-auto">
            {image && (
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-secondary/20 rounded-2xl blur-xl group-hover:blur-2xl transition-all duration-300"></div>
                <img
                  src={image}
                  alt="رؤيتنا ورسالتنا"
                  className="relative w-full rounded-2xl shadow-2xl group-hover:shadow-2xl transition-all duration-300"
                />
              </div>
            )}
            <div className="space-y-8">
              {vision && (
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-blue-50 to-blue-50/50">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 mt-1">
                      <Zap className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-3">رؤيتنا</h2>
                      <p className="text-slate-600 leading-relaxed">
                        {vision}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
              {mission && (
              <Card className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-gradient-to-br from-green-50 to-green-50/50">
                <CardContent className="p-8">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center flex-shrink-0 mt-1">
                      <ArrowRight className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-slate-900 mb-3">رسالتنا</h2>
                      <p className="text-slate-600 leading-relaxed">
                        {mission}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              )}
            </div>
          </div>
        </div>
      </section>
      )}

      {/* CTA Section - Premium Design */}
      <section className="relative py-24 md:py-32 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900 text-white overflow-hidden">
        {/* Decorative Background */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-secondary rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-3xl mx-auto text-center space-y-8">
            {/* Icon */}
            <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 mb-6">
              <Heart className="w-12 h-12 text-white fill-white" />
            </div>
            
            {/* Title */}
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight">
              هل أنت مستعد لتجهيز محلك معنا؟
            </h2>
            
            {/* Subtitle */}
            <p className="text-lg md:text-xl text-white/80 leading-relaxed">
              ابدأ رحلة تجهيز محلك معنا واستخدم أحدث الديكورات والمعدات
            </p>
            
            {/* Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
              <Button 
                size="lg" 
                className="bg-white text-slate-900 hover:bg-white/90 shadow-2xl hover:shadow-2xl hover:scale-105 transition-all duration-300 font-bold px-10 py-6 text-lg rounded-full"
                asChild
              >
                <Link to="/products" className="flex items-center gap-2">
                  تصفح المنتجات
                  <ArrowRight className="w-5 h-5" />
                </Link>
              </Button>
              <Button 
                size="lg" 
                className="border-2 border-white text-white hover:bg-white hover:text-slate-900 shadow-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 font-bold px-10 py-6 text-lg rounded-full backdrop-blur-sm bg-transparent"
                asChild
              >
                <Link to="/contact" className="flex items-center gap-2">
                  تواصل معنا
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </Link>
              </Button>
            </div>
            
            {/* Trust Badges */}
            <div className="flex flex-wrap justify-center gap-8 pt-8 text-white/70 text-sm border-t border-white/10">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>جودة مضمونة</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <span>شحن سريع</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
                <span>دعم 24/7</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default About;