import React from 'react';

interface BackgroundPatternProps {
  slideIndex: number;
  isActive: boolean;
}

const BackgroundPattern: React.FC<BackgroundPatternProps> = ({ slideIndex, isActive }) => {
  // Different patterns for each slide
  const patterns = [
    // Slide 1 - Tech theme with geometric lines
    () => (
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated grid lines */}
        <div className="absolute inset-0 opacity-10">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="grid1" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid1)" />
          </svg>
        </div>

        {/* Floating geometric shapes */}
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`absolute transition-all duration-1000 ${isActive ? 'opacity-20 scale-100' : 'opacity-0 scale-50'
              }`}
            style={{
              left: `${20 + i * 15}%`,
              top: `${10 + (i % 3) * 30}%`,
              animationDelay: `${i * 0.5}s`,
              transitionDelay: `${i * 200}ms`
            }}
          >
            <div className={`w-16 h-16 border border-white/30 ${i % 2 === 0 ? 'rotate-45' : 'rounded-full'
              } animate-pulse`}
              style={{ animationDuration: `${3 + i}s` }} />
          </div>
        ))}
      </div>
    ),

    // Slide 2 - Sale theme with dynamic circles
    () => (
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated circles */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full border-2 border-white/20 transition-all duration-1500 ${isActive ? 'opacity-30 scale-100' : 'opacity-0 scale-0'
              }`}
            style={{
              left: `${Math.random() * 80 + 10}%`,
              top: `${Math.random() * 80 + 10}%`,
              width: `${60 + i * 20}px`,
              height: `${60 + i * 20}px`,
              animationDelay: `${i * 0.3}s`,
              transitionDelay: `${i * 150}ms`
            }}
          >
            <div className="w-full h-full rounded-full bg-gradient-to-br from-white/10 to-transparent animate-spin"
              style={{ animationDuration: `${8 + i * 2}s` }} />
          </div>
        ))}

        {/* Percentage symbols */}
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={`percent-${i}`}
            className={`absolute text-white/10 font-bold transition-all duration-1000 ${isActive ? 'opacity-100 rotate-0' : 'opacity-0 rotate-180'
              }`}
            style={{
              left: `${25 + i * 20}%`,
              top: `${20 + (i % 2) * 40}%`,
              fontSize: `${2 + i * 0.5}rem`,
              transitionDelay: `${i * 300}ms`
            }}
          >
            %
          </div>
        ))}
      </div>
    ),

    // Slide 3 - Quality theme with elegant waves
    () => (
      <div className="absolute inset-0 overflow-hidden">
        {/* Animated waves */}
        <div className="absolute inset-0 opacity-15">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="white" stopOpacity="0.3" />
                <stop offset="50%" stopColor="white" stopOpacity="0.1" />
                <stop offset="100%" stopColor="white" stopOpacity="0.3" />
              </linearGradient>
            </defs>
            {Array.from({ length: 3 }).map((_, i) => (
              <path
                key={i}
                d={`M0,${30 + i * 20} Q25,${20 + i * 20} 50,${30 + i * 20} T100,${30 + i * 20} V100 H0 Z`}
                fill="url(#waveGradient)"
                className={`transition-all duration-2000 ${isActive ? 'opacity-100' : 'opacity-0'
                  }`}
                style={{
                  transitionDelay: `${i * 400}ms`,
                  animation: `wave-${i} ${6 + i * 2}s ease-in-out infinite`
                }}
              />
            ))}
          </svg>
        </div>

        {/* Floating diamonds */}
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className={`absolute transition-all duration-1200 ${isActive ? 'opacity-25 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            style={{
              left: `${15 + i * 18}%`,
              top: `${15 + (i % 2) * 35}%`,
              transitionDelay: `${i * 250}ms`
            }}
          >
            <div className="w-8 h-8 bg-white/20 transform rotate-45 animate-pulse"
              style={{ animationDuration: `${4 + i}s` }} />
          </div>
        ))}
      </div>
    )
    ,
    // Slide 4 - Dots pattern
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="dots1" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots1)" />
          </svg>
        </div>
      </div>
    )
    ,
    // Slide 5 - Diagonals pattern
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="diag1" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <line x1="0" y1="0" x2="0" y2="10" stroke="white" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#diag1)" />
          </svg>
        </div>
      </div>
    )
  ];

  return (
    <div className="absolute inset-0">
      {patterns[slideIndex] && patterns[slideIndex]()}
    </div>
  );
};

export default BackgroundPattern;
