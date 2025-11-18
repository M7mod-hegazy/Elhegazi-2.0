import { useEffect, useRef, useState } from 'react';

interface InteractiveBackgroundProps {
  type: 'featured' | 'bestseller' | 'about' | 'sale' | 'new' | 'location';
  className?: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  angle: number;
  speed: number;
}

const InteractiveBackground = ({ type, className = '' }: InteractiveBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const particlesRef = useRef<Particle[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const parent = canvas.parentElement;
    if (!parent) return;

    // Initialize particles based on section type
    const initParticles = (width: number, height: number) => {
      const count = 15;
      particlesRef.current = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        size: Math.random() * 3 + 1,
        angle: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.5 + 0.2
      }));
    };

    // Set canvas size
    const updateSize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
      // Initialize particles on resize
      initParticles(canvas.width, canvas.height);
    };
    updateSize();
    window.addEventListener('resize', updateSize);

    // Subtle mouse influence - not direct control
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;
      
      // Smooth interpolation for gentle movement
      setMousePos(prev => ({
        x: prev.x + (newX - prev.x) * 0.05,
        y: prev.y + (newY - prev.y) * 0.05
      }));
    };

    parent.addEventListener('mousemove', handleMouseMove);

    // Update particle positions
    const updateParticles = (width: number, height: number, mouse: { x: number; y: number }) => {
      particlesRef.current.forEach(p => {
        // Gentle drift
        p.x += p.vx;
        p.y += p.vy;
        
        // Subtle mouse influence (not direct control)
        const dx = mouse.x - p.x;
        const dy = mouse.y - p.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        if (dist < 150 && dist > 0) {
          // Very gentle push away from mouse
          p.vx -= (dx / dist) * 0.02;
          p.vy -= (dy / dist) * 0.02;
        }
        
        // Damping
        p.vx *= 0.99;
        p.vy *= 0.99;
        
        // Boundaries with wrap
        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;
        
        // Update angle
        p.angle += p.speed * 0.02;
      });
    };

    // Animation loop
    let animationId: number;
    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Update particles
      updateParticles(canvas.width, canvas.height, mousePos);

      // Draw based on section type
      switch (type) {
        case 'featured':
          drawFeaturedEffect(ctx, canvas, particlesRef.current);
          break;
        case 'bestseller':
          drawBestsellerEffect(ctx, canvas, particlesRef.current);
          break;
        case 'about':
          drawAboutEffect(ctx, canvas, particlesRef.current);
          break;
        case 'sale':
          drawSaleEffect(ctx, canvas, particlesRef.current);
          break;
        case 'new':
          drawNewEffect(ctx, canvas, particlesRef.current);
          break;
        case 'location':
          drawLocationEffect(ctx, canvas, particlesRef.current);
          break;
      }

      animationId = requestAnimationFrame(animate);
    };
    animate();

    return () => {
      window.removeEventListener('resize', updateSize);
      parent.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationId);
    };
  }, [type]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 ${className}`}
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    />
  );
};

// Featured: Floating geometric shapes
function drawFeaturedEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  particles.forEach((p, i) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    
    // Draw rotating squares
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 + Math.sin(Date.now() / 1000 + i) * 0.1})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-p.size * 3, -p.size * 3, p.size * 6, p.size * 6);
    
    ctx.restore();
  });
  
  // Ambient glow
  const gradient = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, 0, canvas.width / 2, canvas.height / 2, canvas.width / 2);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.05)');
  gradient.addColorStop(1, 'rgba(168, 85, 247, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Bestseller: Floating circles
function drawBestsellerEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  particles.forEach((p, i) => {
    const pulse = Math.sin(Date.now() / 500 + i) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(34, 197, 94, ${0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 4 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  });
}

// About: Connecting hexagons
function drawAboutEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  // Draw connections between nearby particles
  particles.forEach((p1, i) => {
    particles.slice(i + 1).forEach(p2 => {
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 150) {
        ctx.strokeStyle = `rgba(168, 85, 247, ${0.1 * (1 - dist / 150)})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.stroke();
      }
    });
    
    // Draw hexagon
    ctx.save();
    ctx.translate(p1.x, p1.y);
    ctx.rotate(p1.angle);
    ctx.strokeStyle = `rgba(59, 130, 246, 0.3)`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < 6; j++) {
      const angle = (Math.PI / 3) * j;
      const x = Math.cos(angle) * p1.size * 3;
      const y = Math.sin(angle) * p1.size * 3;
      if (j === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
}

// Sale: Pulsing stars
function drawSaleEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  particles.forEach((p, i) => {
    const pulse = Math.sin(Date.now() / 300 + i) * 0.3 + 0.7;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    ctx.strokeStyle = `rgba(239, 68, 68, ${0.4 * pulse})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let j = 0; j < 5; j++) {
      const angle = (Math.PI * 2 / 5) * j - Math.PI / 2;
      const outerRadius = p.size * 5 * pulse;
      const innerRadius = p.size * 2 * pulse;
      const x1 = Math.cos(angle) * outerRadius;
      const y1 = Math.sin(angle) * outerRadius;
      const x2 = Math.cos(angle + Math.PI / 5) * innerRadius;
      const y2 = Math.sin(angle + Math.PI / 5) * innerRadius;
      if (j === 0) ctx.moveTo(x1, y1);
      else ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  });
}

// New: Rotating diamonds
function drawNewEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  particles.forEach((p, i) => {
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.angle);
    const pulse = Math.sin(Date.now() / 400 + i) * 0.2 + 0.8;
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 * pulse})`;
    ctx.lineWidth = 2;
    ctx.strokeRect(-p.size * 4, -p.size * 4, p.size * 8, p.size * 8);
    ctx.restore();
  });
}

// Location: Floating pins
function drawLocationEffect(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, particles: Particle[]) {
  particles.forEach((p, i) => {
    const pulse = Math.sin(Date.now() / 600 + i) * 0.2 + 0.8;
    
    // Draw pin shape
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = `rgba(239, 68, 68, ${0.3 * pulse})`;
    ctx.beginPath();
    ctx.arc(0, -p.size * 3, p.size * 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-p.size * 1.5, -p.size * 3);
    ctx.lineTo(p.size * 1.5, -p.size * 3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    
    // Pulse ring
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.2 * (1 - pulse + 0.5)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * 6 * pulse, 0, Math.PI * 2);
    ctx.stroke();
  });
}

export default InteractiveBackground;
