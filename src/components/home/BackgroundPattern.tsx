import React from 'react';

interface BackgroundPatternProps {
  slideIndex: number;
  isActive: boolean;
}

const BackgroundPattern: React.FC<BackgroundPatternProps> = ({ slideIndex, isActive }) => {
  const patterns = [
    // 0 - Grid
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-15">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="bg-grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg-grid)" />
          </svg>
        </div>
      </div>
    ),
    // 1 - Circles
    () => (
      <div className="absolute inset-0 overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className={`absolute rounded-full border border-white/30 transition-all duration-700 ${isActive ? 'opacity-60' : 'opacity-0'}`}
            style={{
              left: `${12 + i * 14}%`,
              top: `${20 + (i % 2) * 30}%`,
              width: `${24 + i * 6}px`,
              height: `${24 + i * 6}px`
            }}
          />
        ))}
      </div>
    ),
    // 2 - Waves
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <svg className="w-full h-full opacity-25" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0,35 Q25,28 50,35 T100,35" fill="none" stroke="white" strokeWidth="1.2" />
          <path d="M0,55 Q25,48 50,55 T100,55" fill="none" stroke="white" strokeWidth="1.2" />
          <path d="M0,75 Q25,68 50,75 T100,75" fill="none" stroke="white" strokeWidth="1.2" />
        </svg>
      </div>
    ),
    // 3 - Dots
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-25">
          <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <pattern id="bg-dots" width="8" height="8" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="1" fill="white" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg-dots)" />
          </svg>
        </div>
      </div>
    ),
    // 4 - Diagonals
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="bg-diag-moving" width="40" height="40" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                {isActive && (
                  <>
                    <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="0 40" dur="4s" repeatCount="indefinite" />
                  </>
                )}
                <line x1="0" y1="0" x2="0" y2="40" stroke="white" strokeWidth="2" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#bg-diag-moving)" />
          </svg>
        </div>
      </div>
    ),
    // 5 - Lines (Animated Waves)
    () => (
      <div className="absolute inset-0 overflow-hidden opacity-25">
        <svg className="w-full h-full" preserveAspectRatio="none">
          {Array.from({length: 12}).map((_, i) => (
            <line key={i} x1={`${5 + i*8}%`} y1="0" x2={`${5 + i*8}%`} y2="100%" stroke="white" strokeWidth="1.5" strokeDasharray="30 15">
              {isActive && <animate attributeName="stroke-dashoffset" from="0" to="90" dur={`${2 + (i%3)}s`} repeatCount="indefinite" />}
            </line>
          ))}
        </svg>
      </div>
    ),
    // 6 - Cross (Rotating and pulsing)
    () => (
      <div className="absolute inset-0 overflow-hidden opacity-25">
         <svg className="w-full h-full text-white" fill="none" stroke="currentColor">
          <defs>
            <pattern id="bg-cross-moving" width="40" height="40" patternUnits="userSpaceOnUse">
              <g className={isActive ? "origin-center animate-[spin_8s_linear_infinite]" : ""} style={{ transformOrigin: "20px 20px" }}>
                <path d="M20 10v20M10 20h20" strokeWidth="1.5" strokeLinecap="round" />
              </g>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg-cross-moving)" />
        </svg>
      </div>
    ),
    // 7 - Checker (Isometric fade)
    () => (
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="bg-checker-moving" width="60" height="60" patternUnits="userSpaceOnUse">
              <rect x="0" y="0" width="30" height="30" fill="white">
                {isActive && <animate attributeName="opacity" values="0.1;0.9;0.1" dur="3s" repeatCount="indefinite" />}
              </rect>
              <rect x="30" y="30" width="30" height="30" fill="white">
                {isActive && <animate attributeName="opacity" values="0.9;0.1;0.9" dur="3s" repeatCount="indefinite" />}
              </rect>
              <rect x="30" y="0" width="30" height="30" fill="white" opacity="0.05" />
              <rect x="0" y="30" width="30" height="30" fill="white" opacity="0.05" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#bg-checker-moving)" />
        </svg>
      </div>
    ),
    // 8 - Noise (Floating Orbs)
    () => (
      <div className="absolute inset-0 overflow-hidden opacity-30 blur-2xl flex items-center justify-center">
        {Array.from({length: 3}).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white" style={{
            width: `${150 + i*50}px`, height: `${150 + i*50}px`,
            animation: isActive ? `orb-float-${i} ${8 + i*2}s infinite alternate ease-in-out` : 'none'
          }} />
        ))}
        {isActive && (
          <style>{`
            @keyframes orb-float-0 { 0% { transform: translate(-50px, -50px) scale(0.8); } 100% { transform: translate(50px, 50px) scale(1.2); } }
            @keyframes orb-float-1 { 0% { transform: translate(50px, -30px) scale(1.1); } 100% { transform: translate(-30px, 60px) scale(0.9); } }
            @keyframes orb-float-2 { 0% { transform: translate(0px, 50px) scale(1); } 100% { transform: translate(20px, -40px) scale(1.3); } }
          `}</style>
        )}
      </div>
    ),
    // 9 - Scan (Sci-fi Sweeper)
    () => (
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute inset-0 opacity-15 bg-[linear-gradient(0deg,rgba(255,255,255,0.7)1px,transparent_1px)] bg-[length:100%_8px]" />
        <div className={`absolute inset-x-0 h-32 bg-gradient-to-b from-transparent via-white/20 to-transparent flex items-center justify-center -translate-y-full ${isActive ? 'animate-[scan-sweep_5s_linear_infinite]' : ''}`}>
          <div className="w-full h-[2px] bg-white/60 shadow-[0_0_15px_3px_rgba(255,255,255,0.7)]" />
        </div>
        {isActive && (
          <style>{`
            @keyframes scan-sweep {
              0% { transform: translateY(-100%); }
              100% { transform: translateY(100vh); }
            }
          `}</style>
        )}
      </div>
    ),
    // 10 - Mesh (Perspectives Grid)
    () => (
      <div className="absolute inset-0 overflow-hidden perspective-[800px]">
        <div
          className={`absolute w-[200%] h-[200%] -left-[50%] -top-[50%] opacity-20 bg-[linear-gradient(90deg,rgba(255,255,255,0.5)1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,0.5)1px,transparent_1px)] bg-[length:40px_40px] ${isActive ? 'animate-[mesh-fly_15s_linear_infinite]' : ''}`}
          style={{ transform: 'rotateX(70deg) translateZ(-50px)' }}
        />
        {isActive && (
          <style>{`
            @keyframes mesh-fly {
              0% { background-position: 0 0; }
              100% { background-position: 0 400px; }
            }
          `}</style>
        )}
      </div>
    ),
    // 11 - Ripples (Expanding Water Rings)
    () => (
      <div className="absolute inset-0 overflow-hidden flex items-center justify-center opacity-30">
        {Array.from({length: 4}).map((_, i) => (
          <div key={i} className={`absolute rounded-full border border-white ${isActive ? 'animate-[ripple-grow_4s_infinite_cubic-bezier(0.1,0.8,0.3,1)]' : ''}`}
               style={{ animationDelay: `${i * 1}s`, width: 0, height: 0, opacity: 0 }} />
        ))}
        {isActive && (
          <style>{`
            @keyframes ripple-grow {
              0% { width: 0; height: 0; opacity: 1; border-width: 2px; }
              100% { width: 120vmin; height: 120vmin; opacity: 0; border-width: 1px; }
            }
          `}</style>
        )}
      </div>
    )
  ];

  return <div className="absolute inset-0">{patterns[slideIndex] ? patterns[slideIndex]() : patterns[0]()}</div>;
};

export default BackgroundPattern;
