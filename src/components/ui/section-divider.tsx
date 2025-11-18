import { FC } from 'react';

interface SectionDividerProps {
  type: 'wave' | 'curve' | 'zigzag' | 'triangle' | 'circle' | 'diagonal' | 'dots';
  position?: 'top' | 'bottom' | 'both';
  color?: 'primary' | 'secondary' | 'white' | 'slate';
  flip?: boolean;
}

const SectionDivider: FC<SectionDividerProps> = ({ 
  type, 
  position = 'bottom', 
  color = 'white',
  flip = false 
}) => {
  const getColor = () => {
    switch (color) {
      case 'primary': return 'hsl(var(--primary))';
      case 'secondary': return 'hsl(var(--secondary))';
      case 'white': return '#ffffff';
      case 'slate': return '#f8fafc';
      default: return '#ffffff';
    }
  };

  const renderDivider = () => {
    const fillColor = getColor();
    const transform = flip ? 'scaleY(-1)' : '';

    switch (type) {
      case 'wave':
        return (
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ transform }}>
            <path d="M0,0V46.29c47.79,22.2,103.59,32.17,158,28,70.36-5.37,136.33-33.31,206.8-37.5C438.64,32.43,512.34,53.67,583,72.05c69.27,18,138.3,24.88,209.4,13.08,36.15-6,69.85-17.84,104.45-29.34C989.49,25,1113-14.29,1200,52.47V0Z" fill={fillColor} />
          </svg>
        );
      
      case 'curve':
        return (
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ transform }}>
            <path d="M0,0V15.81C13,36.92,27.64,56.86,47.69,72.05,99.41,111.27,165,111,224.58,91.58c31.15-10.15,60.09-26.07,89.67-39.8,40.92-19,84.73-46,130.83-49.67,36.26-2.85,70.9,9.42,98.6,31.56,31.77,25.39,62.32,62,103.63,73,40.44,10.79,81.35-6.69,119.13-24.28s75.16-39,116.92-43.05c59.73-5.85,113.28,22.88,168.9,38.84,30.2,8.66,59,6.17,87.09-7.5,22.43-10.89,48-26.93,60.65-49.24V0Z" fill={fillColor} />
          </svg>
        );
      
      case 'zigzag':
        return (
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ transform }}>
            <path d="M0,0 L100,100 L200,0 L300,100 L400,0 L500,100 L600,0 L700,100 L800,0 L900,100 L1000,0 L1100,100 L1200,0 L1200,120 L0,120 Z" fill={fillColor} />
          </svg>
        );
      
      case 'triangle':
        return (
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ transform }}>
            <path d="M0,120 L600,0 L1200,120 Z" fill={fillColor} />
          </svg>
        );
      
      case 'circle':
        return (
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ transform }}>
            <path d="M0,120 Q300,0 600,60 T1200,120 Z" fill={fillColor} />
          </svg>
        );
      
      case 'diagonal':
        return (
          <svg viewBox="0 0 1200 120" preserveAspectRatio="none" style={{ transform }}>
            <polygon points="0,120 1200,0 1200,120" fill={fillColor} />
          </svg>
        );
      
      case 'dots':
        return (
          <div className="flex justify-center items-center h-full gap-2">
            {[...Array(20)].map((_, i) => (
              <div
                key={i}
                className="rounded-full animate-pulse"
                style={{
                  width: `${4 + Math.sin(i) * 2}px`,
                  height: `${4 + Math.sin(i) * 2}px`,
                  backgroundColor: fillColor,
                  animationDelay: `${i * 0.1}s`
                }}
              />
            ))}
          </div>
        );
      
      default:
        return null;
    }
  };

  const positionClass = position === 'top' ? '-top-px' : position === 'both' ? 'top-0' : '-bottom-px';

  return (
    <div className={`absolute left-0 right-0 ${positionClass} w-full h-16 md:h-24 overflow-hidden z-10`}>
      {renderDivider()}
    </div>
  );
};

export default SectionDivider;
