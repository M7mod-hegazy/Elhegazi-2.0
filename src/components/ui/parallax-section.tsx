import { useEffect, useRef, ReactNode, CSSProperties } from 'react';

interface ParallaxSectionProps {
  children?: ReactNode;
  speed?: number; // 0.5 = slower, 1 = normal, 1.5 = faster
  className?: string;
  style?: CSSProperties;
  scale?: boolean; // Add scale effect
  rotate?: boolean; // Add rotation effect
  intensity?: 'subtle' | 'medium' | 'strong'; // Parallax intensity
}

const ParallaxSection = ({ 
  children, 
  speed = 0.5, 
  className = '', 
  style,
  scale = false,
  rotate = false,
  intensity = 'medium'
}: ParallaxSectionProps) => {
  const sectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      if (!sectionRef.current) return;

      const rect = sectionRef.current.getBoundingClientRect();
      const scrolled = window.pageYOffset;
      const windowHeight = window.innerHeight;
      
      // Calculate element's position in viewport (0 to 1)
      const elementTop = rect.top;
      const elementHeight = rect.height;
      const scrollProgress = (windowHeight - elementTop) / (windowHeight + elementHeight);
      
      // Only apply parallax when section is in viewport
      if (rect.top < windowHeight && rect.bottom > 0) {
        let transform = '';
        
        // Parallax movement based on intensity
        const intensityMultiplier = intensity === 'subtle' ? 0.5 : intensity === 'strong' ? 1.5 : 1;
        const rate = scrolled * speed * intensityMultiplier;
        transform += `translate3d(0, ${rate}px, 0)`;
        
        // Scale effect
        if (scale) {
          const scaleValue = 1 + (scrollProgress * 0.1); // Scale from 1 to 1.1
          transform += ` scale(${Math.min(scaleValue, 1.1)})`;
        }
        
        // Rotation effect
        if (rotate) {
          const rotateValue = scrollProgress * 5; // Rotate up to 5 degrees
          transform += ` rotate(${rotateValue}deg)`;
        }
        
        sectionRef.current.style.transform = transform;
      }
    };

    // Throttle scroll event for performance
    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    handleScroll(); // Initial call

    return () => window.removeEventListener('scroll', onScroll);
  }, [speed, scale, rotate, intensity]);

  return (
    <div ref={sectionRef} className={`will-change-transform ${className}`} style={style}>
      {children}
    </div>
  );
};

export default ParallaxSection;
