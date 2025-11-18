import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InteractiveSliderProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  interval?: number;
  slidesToShow?: number;
  slidesToScroll?: number;
  className?: string;
  showControls?: boolean;
  showIndicators?: boolean;
  gap?: number;
}

const InteractiveSlider = ({
  children,
  autoPlay = true,
  interval = 4000,
  slidesToShow = 4,
  slidesToScroll = 1,
  className = '',
  showControls = true,
  showIndicators = true,
  gap = 24
}: InteractiveSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isHovered, setIsHovered] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const sliderRef = useRef<HTMLDivElement>(null);

  const totalSlides = children.length;
  const maxIndex = Math.max(0, totalSlides - slidesToShow);

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && !isHovered && totalSlides > slidesToShow) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => {
          const next = prev + slidesToScroll;
          return next > maxIndex ? 0 : next;
        });
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
  }, [isPlaying, isHovered, interval, totalSlides, slidesToShow, slidesToScroll, maxIndex]);

  const handleNext = () => {
    setCurrentIndex(prev => {
      const next = prev + slidesToScroll;
      return next > maxIndex ? 0 : next;
    });
  };

  const handlePrev = () => {
    setCurrentIndex(prev => {
      const next = prev - slidesToScroll;
      return next < 0 ? maxIndex : next;
    });
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(Math.min(index, maxIndex));
  };

  // Touch handlers for mobile swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }
  };

  // Calculate responsive slides to show
  const [responsiveSlidesToShow, setResponsiveSlidesToShow] = useState(slidesToShow);

  useEffect(() => {
    const updateSlidesToShow = () => {
      const width = window.innerWidth;
      if (width < 640) setResponsiveSlidesToShow(1);
      else if (width < 768) setResponsiveSlidesToShow(2);
      else if (width < 1024) setResponsiveSlidesToShow(3);
      else setResponsiveSlidesToShow(slidesToShow);
    };

    updateSlidesToShow();
    window.addEventListener('resize', updateSlidesToShow);
    return () => window.removeEventListener('resize', updateSlidesToShow);
  }, [slidesToShow]);

  const slideWidth = `calc((100% - ${(responsiveSlidesToShow - 1) * gap}px) / ${responsiveSlidesToShow})`;

  return (
    <div
      className={`relative w-full overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main Slider Container */}
      <div className="relative overflow-hidden">
        <div 
          ref={sliderRef}
          className="flex transition-transform duration-500 ease-out"
          style={{
            transform: `translateX(-${currentIndex * (100 / responsiveSlidesToShow + gap / responsiveSlidesToShow)}%)`,
            gap: `${gap}px`
          }}
        >
          {children.map((child, index) => (
            <div
              key={index}
              className="flex-shrink-0"
              style={{ width: slideWidth }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      {showControls && totalSlides > responsiveSlidesToShow && (
        <>
          {/* Previous Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/95 backdrop-blur-sm hover:bg-white shadow-xl border-white/50 hover:scale-110 transition-all duration-300"
            onClick={handlePrev}
            disabled={currentIndex === 0 && !autoPlay}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          {/* Next Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/95 backdrop-blur-sm hover:bg-white shadow-xl border-white/50 hover:scale-110 transition-all duration-300"
            onClick={handleNext}
            disabled={currentIndex >= maxIndex && !autoPlay}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {/* Play/Pause Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white/95 backdrop-blur-sm hover:bg-white shadow-xl border-white/50 hover:scale-110 transition-all duration-300"
            onClick={togglePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-4 h-4" />
            ) : (
              <Play className="w-4 h-4" />
            )}
          </Button>
        </>
      )}

      {/* Slide Indicators */}
      {showIndicators && totalSlides > responsiveSlidesToShow && (
        <div className="absolute bottom-4 right-4 flex gap-2 z-20">
          {Array.from({ length: Math.ceil(totalSlides / responsiveSlidesToShow) }, (_, index) => (
            <button
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 hover:scale-125 ${
                Math.floor(currentIndex / responsiveSlidesToShow) === index
                  ? 'bg-white shadow-lg scale-125'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              onClick={() => goToSlide(index * responsiveSlidesToShow)}
            />
          ))}
        </div>
      )}

      {/* Progress Bar */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 w-full h-1 bg-white/20 z-10">
          <div 
            className="h-full bg-white/60 transition-all duration-100 ease-linear"
            style={{
              width: `${((Date.now() % interval) / interval) * 100}%`
            }}
          />
        </div>
      )}

      {/* Slide Counter */}
      <div className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
        {currentIndex + 1} - {Math.min(currentIndex + responsiveSlidesToShow, totalSlides)} / {totalSlides}
      </div>
    </div>
  );
};

export default InteractiveSlider;
