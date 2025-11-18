import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreativeSliderProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  interval?: number;
  slidesToShow?: number;
  slidesToScroll?: number;
  className?: string;
  showControls?: boolean;
  showIndicators?: boolean;
  animationType?: 'slide' | 'fade' | 'scale' | 'rotate';
}

const CreativeSlider = ({
  children,
  autoPlay = true,
  interval = 4000,
  slidesToShow = 1,
  slidesToScroll = 1,
  className = '',
  showControls = true,
  showIndicators = true,
  animationType = 'slide'
}: CreativeSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const totalSlides = children.length;
  const maxIndex = Math.max(0, totalSlides - slidesToShow);

  const handleNext = useCallback(() => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev >= maxIndex ? 0 : prev + slidesToScroll));
    setTimeout(() => setIsTransitioning(false), 600);
  }, [isTransitioning, maxIndex, slidesToScroll]);

  const handlePrev = () => {
    if (isTransitioning) return;
    setIsTransitioning(true);
    setCurrentIndex((prev) => (prev <= 0 ? maxIndex : prev - slidesToScroll));
    setTimeout(() => setIsTransitioning(false), 600);
  };

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentIndex) return;
    setIsTransitioning(true);
    setCurrentIndex(index);
    setTimeout(() => setIsTransitioning(false), 600);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const getSlideStyle = (index: number) => {
    const isActive = index >= currentIndex && index < currentIndex + slidesToShow;
    const translateX = -(currentIndex * 100);

    switch (animationType) {
      case 'fade':
        return {
          opacity: isActive ? 1 : 0,
          transform: 'translateX(0)',
          transition: 'opacity 0.6s ease-in-out'
        };
      case 'scale':
        return {
          transform: `translateX(${translateX}%) scale(${isActive ? 1 : 0.8})`,
          opacity: isActive ? 1 : 0.6,
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        };
      case 'rotate':
        return {
          transform: `translateX(${translateX}%) rotateY(${isActive ? 0 : 45}deg)`,
          opacity: isActive ? 1 : 0.7,
          transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        };
      default: // slide
        return {
          transform: `translateX(${translateX}%)`,
          transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)'
        };
    }
  };

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && !isHovered && totalSlides > slidesToShow) {
      intervalRef.current = setInterval(() => {
        handleNext();
      }, interval);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isPlaying, isHovered, interval, totalSlides, slidesToShow, handleNext]);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Main Slider */}
      <div
        ref={sliderRef}
        className="flex"
        style={{ width: `${totalSlides * (100 / slidesToShow)}%` }}
      >
        {children.map((child, index) => (
          <div
            key={index}
            className="flex-shrink-0"
            style={{
              width: `${100 / slidesToShow}%`,
              ...getSlideStyle(index)
            }}
          >
            {child}
          </div>
        ))}
      </div>

      {/* Navigation Controls */}
      {showControls && totalSlides > slidesToShow && (
        <>
          <button
            onClick={handlePrev}
            disabled={isTransitioning}
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-300 disabled:opacity-50"
          >
            <ChevronRight className="w-6 h-6 text-slate-700" />
          </button>

          <button
            onClick={handleNext}
            disabled={isTransitioning}
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-10 p-3 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-300 disabled:opacity-50"
          >
            <ChevronLeft className="w-6 h-6 text-slate-700" />
          </button>
        </>
      )}

      {/* Play/Pause Button */}
      {autoPlay && totalSlides > slidesToShow && (
        <button
          onClick={togglePlayPause}
          className="absolute top-4 right-4 z-10 p-2 bg-white/90 backdrop-blur-sm rounded-full shadow-lg hover:bg-white hover:scale-110 transition-all duration-300"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5 text-slate-700" />
          ) : (
            <Play className="w-5 h-5 text-slate-700" />
          )}
        </button>
      )}

      {/* Indicators */}
      {showIndicators && totalSlides > slidesToShow && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2 space-x-reverse">
          {Array.from({ length: maxIndex + 1 }).map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-white scale-125 shadow-lg'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {isPlaying && totalSlides > slidesToShow && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-100"
            style={{
              width: `${((currentIndex + 1) / (maxIndex + 1)) * 100}%`
            }}
          />
        </div>
      )}
    </div>
  );
};

export default CreativeSlider;
