import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Crown, ShoppingBag, Eye } from 'lucide-react';

interface SlideContentProps {
  slide: {
    id: number;
    title: string;
    subtitle: string;
    badge: string;
    features: string[];
    ctaText: string;
    ctaLink: string;
    stats: {
      label: string;
      value: string;
      icon: React.ReactNode;
    }[];
  };
  isActive: boolean;
  isMobile: boolean;
}

const SlideContent: React.FC<SlideContentProps> = ({ slide, isActive, isMobile }) => {
  return (
    <div className={`space-y-6 ${isMobile ? 'text-center' : ''}`}>
      {/* Badge */}
      <div 
        className={`transition-all duration-500 ${
          isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
        }`}
        style={{ transitionDelay: isActive ? '0ms' : '0ms' }}
      >
        <div className={`inline-flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-white/15 backdrop-blur-md rounded-full border border-white/30 text-xs sm:text-sm md:text-base`}>
          <Crown className={`w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6 text-white`} />
          <span className="text-white font-semibold">
            {slide.badge}
          </span>
        </div>
      </div>

      {/* Title with dramatic entrance */}
      <h1 
        className={`font-black text-white leading-tight text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl`}
      >
        {slide.title.split(' ').map((word, idx) => (
          <span 
            key={idx}
            className={`inline-block mx-1 sm:ml-2 md:ml-3 lg:ml-4 transition-all duration-1000 ${
              isActive 
                ? 'opacity-100 translate-y-0 rotate-0' 
                : 'opacity-0 translate-y-16 -rotate-12'
            }`}
            style={{ 
              transitionDelay: isActive ? `${50 + idx * 50}ms` : '0ms',
              transformOrigin: 'bottom center'
            }}
          >
            {word}
          </span>
        ))}
      </h1>

      {/* Subtitle */}
      <p 
        className={`leading-relaxed max-w-xl md:max-w-2xl bg-gradient-to-r from-white via-white/95 to-white/85 bg-clip-text text-transparent transition-all duration-1200 ${
          isActive ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'
        } text-base sm:text-lg md:text-2xl lg:text-3xl`}
        style={{ transitionDelay: isActive ? '150ms' : '0ms' }}
      >
        {slide.subtitle}
      </p>

      {/* Features */}
      <div 
        className={`flex ${isMobile ? 'flex-col' : 'flex-wrap'} gap-3 sm:gap-4 md:gap-6 transition-all duration-1000 ${
          isActive ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
        style={{ transitionDelay: isActive ? '200ms' : '0ms' }}
      >
        {slide.features.map((feature, idx) => (
          <div 
            key={idx} 
            className={`flex items-center gap-3 text-white/90 group transition-all duration-500 ${
              isActive ? 'translate-x-0 opacity-100' : 'translate-x-8 opacity-0'
            }`}
            style={{ transitionDelay: isActive ? `${250 + idx * 30}ms` : '0ms' }}
          >
            <div className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-white/15 backdrop-blur-sm rounded-full flex items-center justify-center group-hover:bg-white/25 group-hover:scale-110 transition-all duration-300">
              <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-white rounded-full" />
            </div>
            <span className={`font-medium text-sm sm:text-base`}>{feature}</span>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div 
        className={`flex ${isMobile ? 'flex-col gap-3' : 'flex-row gap-3 sm:gap-4'} transition-all duration-1200 ${
          isActive ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-12 scale-95'
        }`}
        style={{ transitionDelay: isActive ? '300ms' : '0ms' }}
      >
        <Button
          asChild
          size={isMobile ? "default" : "lg"}
          className="btn-hero-primary font-bold rounded-2xl shadow-2xl transform hover:scale-105 transition-all duration-300 relative overflow-hidden group border-0 min-w-[140px] sm:min-w-[160px] md:min-w-[180px]"
        >
          <Link to={slide.ctaLink} className="flex items-center justify-center text-black hover:text-black">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-gray-200/50 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></div>
            <ShoppingBag className={`w-4 h-4 mr-2 sm:w-5 sm:h-5 sm:mr-2 md:w-6 md:h-6 md:mr-3 text-black`} />
            <span className="text-black font-semibold">{slide.ctaText}</span>
          </Link>
        </Button>
        
        <Button
          variant="outline"
          size={isMobile ? "default" : "lg"}
          className="btn-hero-secondary backdrop-blur-md font-bold rounded-2xl hover:scale-105 transition-all duration-300 min-w-[130px] sm:min-w-[150px] md:min-w-[160px]"
        >
          <Eye className={`w-4 h-4 mr-2 sm:w-5 sm:h-5 sm:mr-2 md:w-6 md:h-6 md:mr-3 text-white`} />
          <span className="text-white font-semibold">استكشف المزيد</span>
        </Button>
      </div>

      {/* Stats removed */}
    </div>
  );
};

export default SlideContent;