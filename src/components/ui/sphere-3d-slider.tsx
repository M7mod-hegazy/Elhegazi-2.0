import { useState, useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Pause } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Sphere3DSliderProps {
  children: React.ReactNode[];
  autoPlay?: boolean;
  interval?: number;
  className?: string;
  showControls?: boolean;
  radius?: number;
}

const Sphere3DSlider = ({
  children,
  autoPlay = true,
  interval = 4000,
  className = '',
  showControls = true,
  radius = 300
}: Sphere3DSliderProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isHovered, setIsHovered] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const totalSlides = children.length;

  // Auto-play functionality
  useEffect(() => {
    if (isPlaying && !isHovered && totalSlides > 1) {
      intervalRef.current = setInterval(() => {
        setCurrentIndex(prev => (prev + 1) % totalSlides);
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
  }, [isPlaying, isHovered, interval, totalSlides]);

  const handleNext = () => {
    setCurrentIndex(prev => (prev + 1) % totalSlides);
  };

  const handlePrev = () => {
    setCurrentIndex(prev => (prev - 1 + totalSlides) % totalSlides);
  };

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  // Calculate 3D positions for each slide - keeping all cards in one horizontal line
  const getSlideStyle = (index: number) => {
    const angle = (index - currentIndex) * (360 / totalSlides);
    const angleRad = (angle * Math.PI) / 180;

    // Calculate position in a horizontal circle (no height difference)
    const x = Math.sin(angleRad) * radius;
    const z = Math.cos(angleRad) * radius * 0.6; // Flatten the circle
    const y = 0; // Keep all cards at the same height

    // Calculate scale based on z position (closer = larger)
    const scale = 0.6 + (z + radius) / (radius * 2.5);

    // Calculate opacity based on position
    const opacity = Math.max(0.3, (z + radius) / (radius * 1.5));

    // Calculate rotation for 3D effect - less aggressive rotation
    const rotateY = -angle * 0.5; // Subtle rotation
    const rotateX = 0; // No X rotation to keep cards flat
    const rotateZ = 0; // No Z rotation

    return {
      transform: `
        translate3d(${x}px, ${y}px, ${z}px)
        rotateY(${rotateY}deg)
        scale(${scale})
      `,
      opacity,
      zIndex: Math.round(z + radius),
      transition: 'all 1.2s cubic-bezier(0.4, 0, 0.2, 1)',
      filter: z < -50 ? 'blur(1px)' : 'blur(0px)', // Only blur items far behind
      pointerEvents: 'auto', // Ensure pointer events work
    };
  };

  return (
    <div 
      className={`relative w-full h-[600px] overflow-hidden ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 3D Container */}
      <div 
        ref={containerRef}
        className="relative w-full h-full"
        style={{
          perspective: '1200px',
          perspectiveOrigin: 'center center',
        }}
      >
        {/* Slides Container */}
        <div className="relative w-full h-full flex items-center justify-center" style={{ pointerEvents: 'none' }}>
          {children.map((child, index) => (
            <div
              key={index}
              className="absolute w-80 h-96"
              style={getSlideStyle(index)}
            >
              <div className="w-full h-full transform-gpu perspective-1000 pointer-events-auto">
                {child}
              </div>
            </div>
          ))}
        </div>

        {/* Center Glow Effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-gradient-radial from-blue-500/30 via-purple-500/20 to-transparent rounded-full blur-2xl animate-pulse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-20 h-20 bg-gradient-radial from-white/40 via-blue-300/30 to-transparent rounded-full blur-xl animate-pulse" style={{ animationDelay: '1s' }} />
        </div>

        {/* Orbital Rings */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-white/15 rounded-full animate-spin-slow" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-white/10 rounded-full animate-spin-reverse" />
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 border border-primary/20 rounded-full animate-spin-slow" style={{ animationDuration: '25s' }} />
        </div>

        {/* Particle Effects */}
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/60 rounded-full animate-pulse"
              style={{
                top: `${20 + Math.sin(i * 0.8) * 30}%`,
                left: `${20 + Math.cos(i * 0.8) * 30}%`,
                animationDelay: `${i * 0.5}s`,
                animationDuration: '3s'
              }}
            />
          ))}
        </div>
      </div>

      {/* Navigation Controls */}
      {showControls && totalSlides > 1 && (
        <>
          {/* Previous Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl border-white/50"
            onClick={handlePrev}
          >
            <ChevronRight className="w-5 h-5" />
          </Button>

          {/* Next Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl border-white/50"
            onClick={handleNext}
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>

          {/* Play/Pause Button */}
          <Button
            variant="outline"
            size="icon"
            className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20 bg-white/90 backdrop-blur-sm hover:bg-white shadow-xl border-white/50"
            onClick={togglePlayPause}
          >
            {isPlaying ? (
              <Pause className="w-5 h-5" />
            ) : (
              <Play className="w-5 h-5" />
            )}
          </Button>
        </>
      )}

      {/* Slide Indicators */}
      {totalSlides > 1 && (
        <div className="absolute bottom-4 right-4 flex gap-2 z-20">
          {children.map((_, index) => (
            <button
              key={index}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentIndex
                  ? 'bg-white shadow-lg scale-125'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              onClick={() => setCurrentIndex(index)}
            />
          ))}
        </div>
      )}

      {/* Slide Counter */}
      <div className="absolute top-4 right-4 z-20 bg-black/50 backdrop-blur-sm text-white px-3 py-1 rounded-full text-sm font-medium">
        {currentIndex + 1} / {totalSlides}
      </div>
    </div>
  );
};

export default Sphere3DSlider;
