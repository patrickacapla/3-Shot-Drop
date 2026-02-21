
import React, { useRef, useEffect } from 'react';
import { GamePhase, Peg, Vector } from '../types';

interface PlinkoBoardProps {
  phase: GamePhase;
  openedSlots: number[];
  onLand: (slotId: number) => void;
  onStartDrop: () => void;
}

const PlinkoBoard: React.FC<PlinkoBoardProps> = ({ phase, openedSlots, onLand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // High resolution internal dimensions - Optimized for tight mobile-first aspect ratio
  const BASE_WIDTH = 450; 
  const BASE_HEIGHT = 750; 

  // Physics constants
  const SUB_STEPS = 10; // High sub-stepping for ultra-smooth physics
  const GRAVITY = 0.035; // Per sub-step
  const DAMPING = 0.55; 
  const FRICTION = 0.998;
  const PEG_RADIUS = 7;
  const BALL_RADIUS = 11;
  const NUM_SLOTS = 11;

  // Layout markers - Tight margins
  const PIPE_BOTTOM_Y = 80;
  const TRI_TOP_Y = 120;
  const TRI_BOTTOM_Y = 640; 
  const TRI_MARGIN = 10; 

  const ballRef = useRef<{ 
    pos: Vector; 
    vel: Vector; 
    active: boolean;
    targetSlotId: number | null;
    prevY: number;
    stuckFrames: number;
  }>({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    active: false,
    targetSlotId: null,
    prevY: 0,
    stuckFrames: 0
  });

  const animationState = useRef<{
    popSlotId: number | null;
    popStartTime: number | null;
  }>({
    popSlotId: null,
    popStartTime: null
  });

  useEffect(() => {
    if (phase === GamePhase.DROPPING && !ballRef.current.active) {
      const availableSlots = Array.from({ length: NUM_SLOTS }, (_, i) => i)
        .filter(id => !openedSlots.includes(id));
      
      const targetId = availableSlots.length > 0 
        ? availableSlots[Math.floor(Math.random() * availableSlots.length)]
        : Math.floor(Math.random() * NUM_SLOTS);

      ballRef.current = {
        pos: { x: BASE_WIDTH / 2, y: 5 },
        vel: { x: (Math.random() - 0.5) * 0.2, y: 0.5 },
        active: true,
        targetSlotId: targetId,
        prevY: 5,
        stuckFrames: 0
      };
      animationState.current.popSlotId = null;
      animationState.current.popStartTime = null;
    }
  }, [phase, openedSlots]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;

    // Generate Pyramid Pegs - Carefully calculated to fill BASE_WIDTH
    const pegs: Peg[] = [];
    const numRows = 11;
    const verticalSpacing = (TRI_BOTTOM_Y - TRI_TOP_Y) / (numRows - 1);
    const maxRowWidth = BASE_WIDTH - (TRI_MARGIN * 2);

    for (let r = 0; r < numRows; r++) {
      const pegsInRow = 3 + r;
      const horizontalSpacing = maxRowWidth / (numRows + 1);
      const rowWidth = (pegsInRow - 1) * horizontalSpacing;
      const startX = (BASE_WIDTH - rowWidth) / 2;
      for (let c = 0; c < pegsInRow; c++) {
        pegs.push({
          pos: { x: startX + c * horizontalSpacing, y: TRI_TOP_Y + r * verticalSpacing },
          radius: PEG_RADIUS
        });
      }
    }

    const update = () => {
      if (ballRef.current.active) {
        for (let s = 0; s < SUB_STEPS; s++) {
          ballRef.current.vel.y += GRAVITY;
          ballRef.current.vel.x *= FRICTION;
          
          // Anti-gravity stuck prevention: nudge if staying at same height
          if (Math.abs(ballRef.current.pos.y - ballRef.current.prevY) < 0.05) {
            ballRef.current.stuckFrames++;
            if (ballRef.current.stuckFrames > 30) {
              ballRef.current.vel.x += (Math.random() - 0.5) * 0.5;
              ballRef.current.vel.y += 0.5;
              ballRef.current.stuckFrames = 0;
            }
          } else {
            ballRef.current.stuckFrames = 0;
          }
          ballRef.current.prevY = ballRef.current.pos.y;

          // Gentle steering
          if (ballRef.current.targetSlotId !== null) {
            const slotWidth = BASE_WIDTH / NUM_SLOTS;
            const targetX = (ballRef.current.targetSlotId * slotWidth) + (slotWidth / 2);
            const dx = targetX - ballRef.current.pos.x;
            const steering = 0.0008 + (ballRef.current.pos.y / BASE_HEIGHT) * 0.0025;
            ballRef.current.vel.x += dx * steering;
          }

          ballRef.current.pos.x += ballRef.current.vel.x;
          ballRef.current.pos.y += ballRef.current.vel.y;

          // Frame Constraints
          const dyTotal = TRI_BOTTOM_Y - TRI_TOP_Y;
          const progressY = Math.max(0, ballRef.current.pos.y - TRI_TOP_Y);
          const triangleHalfWidthAtY = (progressY / dyTotal) * ((BASE_WIDTH / 2) - TRI_MARGIN) + 35; 
          const leftBound = (BASE_WIDTH / 2) - triangleHalfWidthAtY;
          const rightBound = (BASE_WIDTH / 2) + triangleHalfWidthAtY;

          if (ballRef.current.pos.y >= TRI_TOP_Y - 20 && ballRef.current.pos.y < TRI_BOTTOM_Y + 10) {
            if (ballRef.current.pos.x < leftBound + BALL_RADIUS) {
              ballRef.current.pos.x = leftBound + BALL_RADIUS;
              ballRef.current.vel.x = Math.abs(ballRef.current.vel.x) * 0.5 + 0.1;
            } else if (ballRef.current.pos.x > rightBound - BALL_RADIUS) {
              ballRef.current.pos.x = rightBound - BALL_RADIUS;
              ballRef.current.vel.x = -Math.abs(ballRef.current.vel.x) * 0.5 - 0.1;
            }
          }

          // Peg Collisions
          for (const peg of pegs) {
            const dx = ballRef.current.pos.x - peg.pos.x;
            const dy = ballRef.current.pos.y - peg.pos.y;
            const distSq = dx * dx + dy * dy;
            const minDist = BALL_RADIUS + peg.radius;
            if (distSq < minDist * minDist) {
              const dist = Math.sqrt(distSq);
              const nx = dx / dist;
              const ny = dy / dist;
              ballRef.current.pos.x = peg.pos.x + nx * minDist;
              ballRef.current.pos.y = peg.pos.y + ny * minDist;
              const dot = ballRef.current.vel.x * nx + ballRef.current.vel.y * ny;
              ballRef.current.vel.x = (ballRef.current.vel.x - 2 * dot * nx) * DAMPING;
              ballRef.current.vel.y = (ballRef.current.vel.y - 2 * dot * ny) * DAMPING;
              // Add a bit of chaotic spin/nudge to prevent vertical lock
              ballRef.current.vel.x += (Math.random() - 0.5) * 0.08;
            }
          }

          if (ballRef.current.pos.y > TRI_BOTTOM_Y + 15) {
            ballRef.current.active = false;
            const slotWidth = BASE_WIDTH / NUM_SLOTS;
            const landedId = Math.min(Math.max(Math.floor(ballRef.current.pos.x / slotWidth), 0), NUM_SLOTS - 1);
            animationState.current.popSlotId = landedId;
            animationState.current.popStartTime = Date.now();
            onLand(landedId);
            break;
          }
        }
      }
    };

    const draw = () => {
      ctx.fillStyle = '#0a0e27';
      ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

      // Frame Visual - Tight Gold Boundary enclosing only the triangle
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 4;
      ctx.globalAlpha = 0.2;
      ctx.beginPath();
      // Start near pipe
      ctx.moveTo(BASE_WIDTH / 2 - 35, TRI_TOP_Y - 30);
      ctx.lineTo(BASE_WIDTH / 2 + 35, TRI_TOP_Y - 30);
      ctx.lineTo(BASE_WIDTH - TRI_MARGIN, TRI_BOTTOM_Y + 10);
      ctx.lineTo(TRI_MARGIN, TRI_BOTTOM_Y + 10);
      ctx.closePath();
      ctx.stroke();
      ctx.globalAlpha = 1.0;

      // Metallic Pipe
      const pipeX = BASE_WIDTH / 2;
      const pipeW = 80;
      const pipeGrad = ctx.createLinearGradient(pipeX - pipeW/2, 0, pipeX + pipeW/2, 0);
      pipeGrad.addColorStop(0, '#854d0e');
      pipeGrad.addColorStop(0.3, '#fef08a');
      pipeGrad.addColorStop(0.5, '#eab308');
      pipeGrad.addColorStop(0.7, '#fef08a');
      pipeGrad.addColorStop(1, '#854d0e');
      ctx.fillStyle = pipeGrad;
      ctx.fillRect(pipeX - pipeW/2, 0, pipeW, PIPE_BOTTOM_Y);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(pipeX - pipeW/2 - 5, PIPE_BOTTOM_Y - 12, pipeW + 10, 12);

      // Pegs
      pegs.forEach(peg => {
        const pGrad = ctx.createRadialGradient(peg.pos.x - 2, peg.pos.y - 2, 0, peg.pos.x, peg.pos.y, peg.radius);
        pGrad.addColorStop(0, '#fef08a');
        pGrad.addColorStop(1, '#854d0e');
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(peg.pos.x, peg.pos.y, peg.radius, 0, Math.PI * 2);
        ctx.fill();
      });

      // Slots
      const slotWidth = BASE_WIDTH / NUM_SLOTS;
      const now = Date.now();
      for (let i = 0; i < NUM_SLOTS; i++) {
        const isOpened = openedSlots.includes(i);
        const isPopping = animationState.current.popSlotId === i;
        let scale = 1.0;
        let glow = 0;
        if (isPopping) {
          const elapsed = now - (animationState.current.popStartTime || 0);
          if (elapsed < 800) {
            scale = 1.0 + Math.sin((elapsed / 800) * Math.PI) * 0.4;
            glow = Math.sin((elapsed / 800) * Math.PI) * 60;
          }
        }

        const rectW = (slotWidth - 4) * scale;
        const rectH = 75 * scale;
        const rectX = (i * slotWidth + 2) - (rectW - (slotWidth - 4)) / 2;
        const rectY = (TRI_BOTTOM_Y + 25) - (rectH - 75) / 2;

        const sGrad = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectH);
        sGrad.addColorStop(0, isPopping ? '#fef08a' : (isOpened ? '#1e293b' : '#111827'));
        sGrad.addColorStop(1, isPopping ? '#854d0e' : (isOpened ? '#0f172a' : '#020617'));
        
        ctx.save();
        if (isPopping) {
          ctx.shadowBlur = glow;
          ctx.shadowColor = '#fef08a';
        }
        ctx.fillStyle = sGrad;
        ctx.strokeStyle = '#D4AF37';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 10);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        ctx.fillStyle = isPopping ? '#0a0e27' : (isOpened ? '#475569' : '#fef08a');
        ctx.font = `900 ${Math.round(40 * scale)}px Montserrat`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(isOpened ? '✓' : '?', rectX + rectW / 2, rectY + rectH / 2 + 2);
      }

      // Ball
      if (ballRef.current.active) {
        const { x, y } = ballRef.current.pos;
        const bGrad = ctx.createRadialGradient(x - 5, y - 5, 4, x, y, BALL_RADIUS);
        bGrad.addColorStop(0, '#ffffff');
        bGrad.addColorStop(0.3, '#fef08a');
        bGrad.addColorStop(1, '#eab308');
        ctx.shadowBlur = 30;
        ctx.shadowColor = 'rgba(234, 179, 8, 1)';
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    };

    const loop = () => {
      update();
      draw();
      animationId = requestAnimationFrame(loop);
    };

    loop();
    return () => cancelAnimationFrame(animationId);
  }, [openedSlots, onLand]);

  return (
    <div className="relative shadow-[0_0_80px_rgba(0,0,0,1)] rounded-[20px] md:rounded-[40px] overflow-hidden border-[4px] md:border-[6px] border-[#1e293b] bg-[#020617] flex flex-col items-center justify-center w-full h-full max-h-full aspect-[4/5] mx-auto">
      <canvas 
        ref={canvasRef} 
        width={BASE_WIDTH} 
        height={BASE_HEIGHT} 
        className="w-full h-full object-contain block pointer-events-none"
      />
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none border-[1px] border-white/5 rounded-[18px] md:rounded-[38px]"></div>
    </div>
  );
};

export default PlinkoBoard;
