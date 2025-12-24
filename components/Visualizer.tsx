import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  isActive: boolean;
  volume: number; // 0 to 1
}

export const Visualizer: React.FC<VisualizerProps> = ({ isActive, volume }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    let time = 0;

    const render = () => {
      time += 0.05;
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      // Base radius for the circle
      const baseRadius = 60;
      // Pulse effect based on volume
      const pulse = isActive ? volume * 50 : 0;
      
      // Draw outer glow
      if (isActive) {
        const gradient = ctx.createRadialGradient(centerX, centerY, baseRadius, centerX, centerY, baseRadius + pulse + 40);
        gradient.addColorStop(0, 'rgba(16, 185, 129, 0.2)'); // emerald-500 low opacity
        gradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius + pulse + 40, 0, Math.PI * 2);
        ctx.fill();
      }

      // Draw main circle (The "Eye" or Core)
      ctx.beginPath();
      // Add some subtle breathing movement when idle, energetic when active
      const breathing = isActive ? Math.sin(time * 5) * 2 : Math.sin(time) * 2;
      const currentRadius = baseRadius + (isActive ? pulse : 0) + breathing;
      
      ctx.arc(centerX, centerY, currentRadius, 0, Math.PI * 2);
      ctx.fillStyle = isActive ? '#10b981' : '#334155'; // emerald-500 vs slate-700
      ctx.fill();

      // Draw inner ripples if active
      if (isActive && volume > 0.01) {
         ctx.strokeStyle = '#6ee7b7'; // emerald-300
         ctx.lineWidth = 2;
         ctx.beginPath();
         ctx.arc(centerX, centerY, currentRadius * 0.7, 0, Math.PI * 2);
         ctx.stroke();
         
         ctx.strokeStyle = '#d1fae5'; // emerald-100
         ctx.beginPath();
         ctx.arc(centerX, centerY, currentRadius * 0.4, 0, Math.PI * 2);
         ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isActive, volume]);

  return (
    <canvas 
      ref={canvasRef} 
      width={400} 
      height={400} 
      className="w-full max-w-[400px] h-auto"
    />
  );
};
