import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface NavigationControlsProps {
  currentSlide: number;
  totalSlides: number;
  progress: number;
  isAutoPlaying: boolean;
  isTransitioning: boolean;
  onPrevSlide: () => void;
  onNextSlide: () => void;
  onGoToSlide: (index: number) => void;
  onToggleAutoPlay: () => void;
  isMobile: boolean;
}

const NavigationControls: React.FC<NavigationControlsProps> = ({
  currentSlide,
  totalSlides,
  progress,
  isAutoPlaying,
  isTransitioning,
  onPrevSlide,
  onNextSlide,
  onGoToSlide,
  onToggleAutoPlay,
  isMobile
}) => {
  return (
    <>
      {/* Bottom-centered controls: arrows flanking bullets (desktop), bullets only (mobile) */}
      <div className={`absolute ${isMobile ? 'bottom-4' : 'bottom-8'} left-1/2 -translate-x-1/2 z-30 flex items-center gap-4`}>
        {!isMobile && (
          <button
            onClick={onPrevSlide}
            disabled={isTransitioning}
            className="p-4 bg-white/15 backdrop-blur-md rounded-full border border-white/30 transition-all duration-300 disabled:opacity-50"
          >
            <ChevronLeft className={`w-6 h-6 text-white ${!isMobile ? '-scale-x-100' : ''}`} />
          </button>
        )}

        <div className={`flex items-center ${isMobile ? 'gap-3' : 'gap-4'}`}>
          {Array.from({ length: totalSlides }).map((_, index) => (
            <button
              key={index}
              onClick={() => onGoToSlide(index)}
              className={`relative transition-all duration-500 ${
                index === currentSlide
                  ? isMobile ? 'w-8 h-2' : 'w-12 h-3'
                  : isMobile ? 'w-2 h-2' : 'w-3 h-3'
              }`}
            >
              <div className={`w-full h-full rounded-full transition-all duration-500 ${
                index === currentSlide
                  ? 'bg-white shadow-lg'
                  : 'bg-white/40'
              }`} />
              {index === currentSlide && (
                <div 
                  className="absolute top-0 left-0 h-full bg-gradient-to-r from-white to-white/80 rounded-full transition-all duration-100"
                  style={{ width: `${progress}%` }}
                />
              )}
            </button>
          ))}
        </div>

        {!isMobile && (
          <button
            onClick={onNextSlide}
            disabled={isTransitioning}
            className="p-4 bg-white/15 backdrop-blur-md rounded-full border border-white/30 transition-all duration-300 disabled:opacity-50"
          >
            <ChevronRight className={`w-6 h-6 text-white ${!isMobile ? '-scale-x-100' : ''}`} />
          </button>
        )}
      </div>

      {/* Auto-play Control removed */}

      {/* Progress Bar */}
      <div className="absolute top-0 left-0 w-full h-1 bg-white/10 z-30">
        <div 
          className="h-full bg-gradient-to-r from-white via-white/90 to-white/80 transition-all duration-100 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>
    </>
  );
};

export default NavigationControls;