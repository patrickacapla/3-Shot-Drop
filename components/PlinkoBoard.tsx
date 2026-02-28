
import React, { useRef, useEffect } from 'react';
import { GamePhase, Peg, Vector } from '../types';

interface PlinkoBoardProps {
  phase: GamePhase;
  openedSlots: number[];
  onLand: (slotId: number) => void;
  onStartDrop: () => void;
}

// ── Trail particle ──────────────────────────────────────────────────────────
interface TrailParticle {
  x: number; y: number;
  alpha: number;
  radius: number;
}

// ── Squash/Stretch visual state ──────────────────────────────────────────────
// Physics always uses a perfect circle. This is purely cosmetic for drawing.
interface SquashState {
  scaleX: number;
  scaleY: number;
}

const PlinkoBoard: React.FC<PlinkoBoardProps> = ({ phase, openedSlots, onLand }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Internal canvas resolution
  const BASE_WIDTH = 450;
  const BASE_HEIGHT = 750;

  // ─────────────────────────────────────────────────────────────────────────
  // Physics constants — all tuned for one fixed 60fps tick (16.6ms).
  //
  // Fix 5 (delta-time): We use a fixed-timestep accumulator (see game loop).
  // The physics step size is always exactly FIXED_STEP ms (1/60s ≈ 16.6ms).
  // On 120Hz displays rAF fires every ~8ms: we accumulate two ticks per frame.
  // On 60Hz: one tick per frame. On 30Hz or tab-background: we cap accumulation
  // so physics never "fast-forwards" after a long stall.
  //
  // ─────────────────────────────────────────────────────────────────────────
  const FIXED_STEP = 1000 / 60;          // 16.6̄ms — one physics tick
  const MAX_TICK_BUDGET = 3;              // never run more than 3 ticks/rAF frame (prevents runaway on tab-wake)

  // Each fixed tick applies exactly these values (no scaling needed):
  const GRAVITY = 0.09;                  // pixels/tick² (higher than before — snappy fall)
  const DAMPING = 0.52;                  // velocity retain after peg bounce
  const FRICTION = 0.998;               // per-tick horizontal air resistance

  const PEG_RADIUS = 7;
  // Fix 1: physics hitbox = 85% of visual radius → 1px slide gap around each peg
  const PEG_COLLISION_RADIUS = PEG_RADIUS * 0.85; // ~5.95px
  const BALL_RADIUS = 11;
  const NUM_SLOTS = 11;
  const MAX_BALL_LIFETIME_MS = 9000;

  // Layout markers
  const PIPE_BOTTOM_Y = 80;
  const TRI_TOP_Y = 120;
  const TRI_BOTTOM_Y = 640;
  const TRI_MARGIN = 10;

  // ── Fix 2: Velocity anti-sleep constants ─────────────────────────────────
  // Measured once per physics tick (not per sub-step) BEFORE gravity is added.
  const STUCK_SPEED_THRESHOLD = 0.3;   // px/tick — if slower than this, we're stuck
  const STUCK_KICK_DELAY = 20;         // ticks before kick fires (was 30 frames)

  // ── Fix 3: Y-stall watchdog (per physics tick) ───────────────────────────
  const YSTALL_THRESHOLD = 0.8;        // px/tick — expected minimum movement from gravity alone
  const YSTALL_KICK_DELAY = 18;        // ticks before stall kick fires

  // Ball state
  const ballRef = useRef<{
    pos: Vector;
    vel: Vector;
    active: boolean;
    targetSlotId: number | null;
    stuckFrames: number;
    yStalledFrames: number;
    spawnTime: number;
    prevY: number;       // Y at the previous tick (for Y-stall watchdog)
  }>({
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    active: false,
    targetSlotId: null,
    stuckFrames: 0,
    yStalledFrames: 0,
    spawnTime: 0,
    prevY: 0,
  });

  // Visual / animation state (separate from physics — runs every rAF)
  const animationState = useRef<{
    popSlotId: number | null;
    popStartTime: number | null;
    pegFlashes: Map<number, number>;
    trail: TrailParticle[];
    pulsePhase: number;
    squash: SquashState;         // Fix 4: cosmetic squash/stretch (purely visual)
    accumulator: number;         // Fix 5: fixed-timestep leftover ms
    lastRafTime: number;         // Fix 5: previous rAF timestamp
  }>({
    popSlotId: null,
    popStartTime: null,
    pegFlashes: new Map(),
    trail: [],
    pulsePhase: 0,
    squash: { scaleX: 1, scaleY: 1 },
    accumulator: 0,
    lastRafTime: -1,
  });

  // ── Spawn ball on DROPPING ────────────────────────────────────────────────
  useEffect(() => {
    if (phase === GamePhase.DROPPING && !ballRef.current.active) {
      const availableSlots = Array.from({ length: NUM_SLOTS }, (_, i) => i)
        .filter(id => !openedSlots.includes(id));
      const targetId = availableSlots.length > 0
        ? availableSlots[Math.floor(Math.random() * availableSlots.length)]
        : Math.floor(Math.random() * NUM_SLOTS);

      // Guaranteed off-center spawn — prevents symmetric approach to top peg
      let spawnXOffset = (Math.random() - 0.5) * 50;
      if (Math.abs(spawnXOffset) < 14) {
        spawnXOffset = spawnXOffset < 0 ? -14 : 14;
      }

      ballRef.current = {
        pos: { x: BASE_WIDTH / 2 + spawnXOffset, y: 5 },
        vel: { x: (Math.random() - 0.5) * 1.0, y: 2.0 },
        active: true,
        targetSlotId: targetId,
        stuckFrames: 0,
        yStalledFrames: 0,
        spawnTime: Date.now(),
        prevY: 5,
      };
      animationState.current.popSlotId = null;
      animationState.current.popStartTime = null;
      animationState.current.trail = [];
      animationState.current.squash = { scaleX: 1, scaleY: 1 };
      animationState.current.accumulator = 0;
      animationState.current.lastRafTime = -1;
    }
  }, [phase, openedSlots]);

  // ── Main game loop ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let animationId: number;

    // ── Generate pegs ───────────────────────────────────────────────────────
    const pegs: Peg[] = [];
    const numRows = 11;
    const verticalSpacing = (TRI_BOTTOM_Y - TRI_TOP_Y) / (numRows - 1);
    const maxRowWidth = BASE_WIDTH - TRI_MARGIN * 2;
    const horizontalSpacing = maxRowWidth / (numRows + 1);

    for (let r = 0; r < numRows; r++) {
      const pegsInRow = 3 + r;
      const rowWidth = (pegsInRow - 1) * horizontalSpacing;
      const startX = (BASE_WIDTH - rowWidth) / 2;
      for (let c = 0; c < pegsInRow; c++) {
        pegs.push({
          pos: { x: startX + c * horizontalSpacing, y: TRI_TOP_Y + r * verticalSpacing },
          radius: PEG_RADIUS,
        });
      }
    }

    // ── Force-land safety net ───────────────────────────────────────────────
    const forceLand = () => {
      ballRef.current.active = false;
      const targetId = ballRef.current.targetSlotId ?? Math.floor(Math.random() * NUM_SLOTS);
      const landedId = Math.min(Math.max(targetId, 0), NUM_SLOTS - 1);
      animationState.current.trail = [];
      animationState.current.squash = { scaleX: 1, scaleY: 1 };
      animationState.current.popSlotId = landedId;
      animationState.current.popStartTime = Date.now();
      onLand(landedId);
    };

    // ─────────────────────────────────────────────────────────────────────
    // ONE FIXED PHYSICS TICK
    // This runs at exactly 16.6ms equivalents regardless of display refresh.
    // All constants (GRAVITY, FRICTION, etc.) are tuned to this step size.
    // ─────────────────────────────────────────────────────────────────────
    const physicsTick = (nowMs: number): boolean => {
      // returns true if the ball landed (caller should stop ticking this frame)
      const ball = ballRef.current;
      if (!ball.active) return false;

      if (nowMs - ball.spawnTime > MAX_BALL_LIFETIME_MS) {
        forceLand();
        return true;
      }

      // ── Fix 2: Velocity stuck-check BEFORE gravity is added ──────────────
      const speedBefore = Math.hypot(ball.vel.x, ball.vel.y);
      if (speedBefore < STUCK_SPEED_THRESHOLD) {
        ball.stuckFrames++;
        if (ball.stuckFrames > STUCK_KICK_DELAY) {
          const kick = 1.2 + (ball.stuckFrames - STUCK_KICK_DELAY) * 0.25;
          ball.vel.x += (Math.random() - 0.5) * 3.5 * kick;
          ball.vel.y += 2.5 * kick;
          // Don't reset stuckFrames — keep escalating until the ball escapes
        }
      } else {
        ball.stuckFrames = 0;
      }

      // ── Fix 3: Y-stall watchdog — compare to previous tick's Y ───────────
      const yMoved = Math.abs(ball.pos.y - ball.prevY);
      if (yMoved < YSTALL_THRESHOLD) {
        ball.yStalledFrames++;
        if (ball.yStalledFrames > YSTALL_KICK_DELAY) {
          ball.vel.x += (Math.random() - 0.5) * 5.0;
          ball.vel.y += 3.5;
          ball.yStalledFrames = 0;
        }
      } else {
        ball.yStalledFrames = 0;
      }
      ball.prevY = ball.pos.y;

      // ── Apply gravity & friction (fixed step, no scaling) ─────────────────
      ball.vel.y += GRAVITY;
      ball.vel.x *= FRICTION;

      // ── Steering toward target slot ───────────────────────────────────────
      if (ball.targetSlotId !== null) {
        const slotWidth = BASE_WIDTH / NUM_SLOTS;
        const targetX = ball.targetSlotId * slotWidth + slotWidth / 2;
        const dx = targetX - ball.pos.x;
        const steering = 0.0008 + (ball.pos.y / BASE_HEIGHT) * 0.003;
        ball.vel.x += dx * steering;
      }

      // ── Integrate position ────────────────────────────────────────────────
      ball.pos.x += ball.vel.x;
      ball.pos.y += ball.vel.y;

      // ── Triangle wall collision ───────────────────────────────────────────
      // After integration, clamp and give the ball a strong enough bounce to
      // escape. Minimum horizontal escape velocity = 1.2px/tick after bounce.
      const dyTotal = TRI_BOTTOM_Y - TRI_TOP_Y;
      const progressY = Math.max(0, ball.pos.y - TRI_TOP_Y);
      const triangleHalfWidthAtY = (progressY / dyTotal) * (BASE_WIDTH / 2 - TRI_MARGIN) + 35;
      const leftBound = BASE_WIDTH / 2 - triangleHalfWidthAtY;
      const rightBound = BASE_WIDTH / 2 + triangleHalfWidthAtY;

      // Wall check: extend to TRI_BOTTOM_Y+30 (matches the landing threshold below)
      // This closes the previous dead-zone gap between +10 and +15.
      if (ball.pos.y >= TRI_TOP_Y - 20 && ball.pos.y < TRI_BOTTOM_Y + 30) {
        if (ball.pos.x < leftBound + BALL_RADIUS) {
          ball.pos.x = leftBound + BALL_RADIUS + 1.0;
          ball.vel.x = Math.max(Math.abs(ball.vel.x) * 0.65, 2.0) + Math.random() * 1.0;
          ball.vel.y += (Math.random() - 0.5) * 0.5;
        } else if (ball.pos.x > rightBound - BALL_RADIUS) {
          ball.pos.x = rightBound - BALL_RADIUS - 1.0;
          ball.vel.x = -(Math.max(Math.abs(ball.vel.x) * 0.65, 2.0) + Math.random() * 1.0);
          ball.vel.y += (Math.random() - 0.5) * 0.5;
        }
      }

      // ── Bottom-funnel gravity assist ──────────────────────────────────────
      // If the ball is in the lower 20% of the board and barely moving downward,
      // it's trapped in the bottom corner. Apply a mandatory downward push so
      // it cannot oscillate horizontally without also falling.
      const lowerBoardThreshold = TRI_TOP_Y + (TRI_BOTTOM_Y - TRI_TOP_Y) * 0.80;
      if (ball.pos.y > lowerBoardThreshold && ball.vel.y < 0.5) {
        ball.vel.y += 2.5; // guaranteed fall toward the slots
      }

      // ── Fix 1: Peg collisions using PEG_COLLISION_RADIUS (85% of visual) ──
      // Physics circle is always a perfect circle.
      // Peg is drawn at PEG_RADIUS=7; collision uses PEG_COLLISION_RADIUS≈5.95.
      for (let pi = 0; pi < pegs.length; pi++) {
        const peg = pegs[pi];
        const dx = ball.pos.x - peg.pos.x;
        const dy = ball.pos.y - peg.pos.y;
        const distSq = dx * dx + dy * dy;
        const minDist = BALL_RADIUS + PEG_COLLISION_RADIUS;
        if (distSq < minDist * minDist) {
          const dist = Math.sqrt(distSq) || 0.001;
          const nx = dx / dist;
          const ny = dy / dist;

          // Push ball cleanly outside the collision boundary
          ball.pos.x = peg.pos.x + nx * (minDist + 1.0);
          ball.pos.y = peg.pos.y + ny * (minDist + 1.0);

          // Reflect velocity along normal with damping
          const dot = ball.vel.x * nx + ball.vel.y * ny;
          if (dot < 0) {
            ball.vel.x = (ball.vel.x - 2 * dot * nx) * DAMPING;
            ball.vel.y = (ball.vel.y - 2 * dot * ny) * DAMPING;
          }

          // Anti-symmetry nudge — prevents perfectly centered hits from re-locking
          ball.vel.x += (Math.random() - 0.5) * 0.5;
          // Ensure ball always has some downward component after a peg hit
          if (ball.vel.y < 0.5) ball.vel.y = 0.5;

          // Fix 4: Trigger squash/stretch based on impact normal direction.
          // This is COSMETIC ONLY — physics is not affected.
          if (Math.abs(ny) > Math.abs(nx)) {
            // Vertical hit (ball hits top/bottom of peg)
            animationState.current.squash = { scaleX: 1.40, scaleY: 0.65 };
          } else {
            // Horizontal hit (ball hits side of peg)
            animationState.current.squash = { scaleX: 0.65, scaleY: 1.40 };
          }

          // Record peg flash for visual hit feedback
          animationState.current.pegFlashes.set(pi, Date.now());
        }
      }

      // ── Landing check ──────────────────────────────────────────────────────
      // Threshold lowered from +15 to +5 — triggers landing immediately when
      // the ball clears the last peg row, closing the bottom dead-zone trap.
      if (ball.pos.y > TRI_BOTTOM_Y + 5) {
        ball.active = false;
        const slotWidth = BASE_WIDTH / NUM_SLOTS;
        const landedId = Math.min(Math.max(Math.floor(ball.pos.x / slotWidth), 0), NUM_SLOTS - 1);
        animationState.current.popSlotId = landedId;
        animationState.current.popStartTime = Date.now();
        onLand(landedId);
        return true; // ball landed, stop processing ticks this frame
      }

      return false;
    };

    // ── Draw ────────────────────────────────────────────────────────────────
    const draw = () => {
      const now = Date.now();

      // Advance ambient pulse
      animationState.current.pulsePhase = (animationState.current.pulsePhase + 0.008) % 1;
      const pulse = Math.sin(animationState.current.pulsePhase * Math.PI * 2);

      // ── Background ───────────────────────────────────────────────────────
      ctx.fillStyle = '#070b20';
      ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

      // Subtle dot-grid texture
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      const gridSpacing = 24;
      for (let gx = gridSpacing; gx < BASE_WIDTH; gx += gridSpacing) {
        for (let gy = gridSpacing; gy < BASE_HEIGHT; gy += gridSpacing) {
          ctx.beginPath();
          ctx.arc(gx, gy, 1, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Radial ambient glow at centre
      const bgGlow = ctx.createRadialGradient(BASE_WIDTH / 2, BASE_HEIGHT * 0.45, 0, BASE_WIDTH / 2, BASE_HEIGHT * 0.45, 260);
      bgGlow.addColorStop(0, 'rgba(234,179,8,0.07)');
      bgGlow.addColorStop(1, 'transparent');
      ctx.fillStyle = bgGlow;
      ctx.fillRect(0, 0, BASE_WIDTH, BASE_HEIGHT);

      // ── Frame: triangle border with strong outer glow ────────────────────
      ctx.save();
      ctx.shadowBlur = 18 + pulse * 10;
      ctx.shadowColor = 'rgba(212,175,55,0.6)';
      ctx.strokeStyle = '#D4AF37';
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.55 + pulse * 0.1;
      ctx.beginPath();
      ctx.moveTo(BASE_WIDTH / 2 - 35, TRI_TOP_Y - 30);
      ctx.lineTo(BASE_WIDTH / 2 + 35, TRI_TOP_Y - 30);
      ctx.lineTo(BASE_WIDTH - TRI_MARGIN, TRI_BOTTOM_Y + 10);
      ctx.lineTo(TRI_MARGIN, TRI_BOTTOM_Y + 10);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // ── Pipe / dispenser ─────────────────────────────────────────────────
      const pipeX = BASE_WIDTH / 2;
      const pipeW = 80;
      const pipeGrad = ctx.createLinearGradient(pipeX - pipeW / 2, 0, pipeX + pipeW / 2, 0);
      pipeGrad.addColorStop(0, '#5a3307');
      pipeGrad.addColorStop(0.15, '#c07000');
      pipeGrad.addColorStop(0.3, '#fef08a');
      pipeGrad.addColorStop(0.5, '#eab308');
      pipeGrad.addColorStop(0.7, '#fef08a');
      pipeGrad.addColorStop(0.85, '#c07000');
      pipeGrad.addColorStop(1, '#5a3307');
      ctx.fillStyle = pipeGrad;
      ctx.beginPath();
      ctx.roundRect(pipeX - pipeW / 2, 0, pipeW, PIPE_BOTTOM_Y - 8, [0, 0, 6, 6]);
      ctx.fill();

      // Rivet accents on pipe
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      for (const rv of [-24, 0, 24]) {
        ctx.beginPath();
        ctx.arc(pipeX + rv, PIPE_BOTTOM_Y - 22, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Pipe lip
      ctx.save();
      ctx.shadowBlur = 10;
      ctx.shadowColor = '#fef08a';
      ctx.fillStyle = '#fef08a';
      ctx.beginPath();
      ctx.roundRect(pipeX - pipeW / 2 - 6, PIPE_BOTTOM_Y - 10, pipeW + 12, 10, [0, 0, 4, 4]);
      ctx.fill();
      ctx.restore();

      // ── Pegs ─────────────────────────────────────────────────────────────
      // ↓ Draw at PEG_RADIUS (7px). Collision uses PEG_COLLISION_RADIUS (~5.95).
      pegs.forEach((peg, pi) => {
        const flashTime = animationState.current.pegFlashes.get(pi);
        const flashAge = flashTime ? now - flashTime : 9999;
        const isFlashing = flashAge < 200;
        const flashT = isFlashing ? 1 - flashAge / 200 : 0;

        ctx.save();
        ctx.shadowBlur = (6 + pulse * 4) + flashT * 30;
        ctx.shadowColor = isFlashing ? `rgba(255,255,255,${0.9 * flashT})` : `rgba(234,179,8,${0.3 + pulse * 0.15})`;

        const pGrad = ctx.createRadialGradient(
          peg.pos.x - 2.5, peg.pos.y - 2.5, 0,
          peg.pos.x, peg.pos.y, peg.radius // visual radius
        );
        if (isFlashing) {
          pGrad.addColorStop(0, `rgba(255,255,255,${0.7 + 0.3 * flashT})`);
          pGrad.addColorStop(0.4, `rgba(254,240,138,1)`);
          pGrad.addColorStop(1, `rgba(234,179,8,1)`);
        } else {
          pGrad.addColorStop(0, '#fef08a');
          pGrad.addColorStop(0.5, '#d4a017');
          pGrad.addColorStop(1, '#854d0e');
        }
        ctx.fillStyle = pGrad;
        ctx.beginPath();
        ctx.arc(peg.pos.x, peg.pos.y, peg.radius + (isFlashing ? flashT * 2 : 0), 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = `rgba(255,255,255,${0.35 + flashT * 0.3})`;
        ctx.beginPath();
        ctx.arc(peg.pos.x - 2, peg.pos.y - 2, peg.radius * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      });

      // ── Slots ─────────────────────────────────────────────────────────────
      const slotWidth = BASE_WIDTH / NUM_SLOTS;
      for (let i = 0; i < NUM_SLOTS; i++) {
        const isOpened = openedSlots.includes(i);
        const isPopping = animationState.current.popSlotId === i;
        let scale = 1.0;
        let glow = 0;
        if (isPopping) {
          const elapsed = now - (animationState.current.popStartTime || 0);
          if (elapsed < 900) {
            scale = 1.0 + Math.sin((elapsed / 900) * Math.PI) * 0.45;
            glow = Math.sin((elapsed / 900) * Math.PI) * 70;
          }
        }

        const slotInnerW = slotWidth - 5;
        const slotInnerH = 75;
        const rectW = slotInnerW * scale;
        const rectH = slotInnerH * scale;
        const rectX = (i * slotWidth + 2.5) - (rectW - slotInnerW) / 2;
        const rectY = (TRI_BOTTOM_Y + 22) - (rectH - slotInnerH) / 2;

        ctx.save();
        if (isPopping || isOpened) {
          ctx.shadowBlur = isPopping ? glow : 8;
          ctx.shadowColor = isPopping ? '#fef08a' : 'rgba(74,222,128,0.5)';
        }

        const sGrad = ctx.createLinearGradient(rectX, rectY, rectX, rectY + rectH);
        if (isPopping) {
          sGrad.addColorStop(0, '#fff7c0');
          sGrad.addColorStop(0.4, '#fef08a');
          sGrad.addColorStop(1, '#92400e');
        } else if (isOpened) {
          sGrad.addColorStop(0, '#14532d');
          sGrad.addColorStop(1, '#052e16');
        } else {
          sGrad.addColorStop(0, '#1a2040');
          sGrad.addColorStop(1, '#080c1e');
        }

        ctx.fillStyle = sGrad;
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 10);
        ctx.fill();

        ctx.strokeStyle = isPopping ? '#ffffff' : (isOpened ? '#22c55e' : '#D4AF37');
        ctx.lineWidth = isPopping ? 2.5 : 2;
        ctx.beginPath();
        ctx.roundRect(rectX, rectY, rectW, rectH, 10);
        ctx.stroke();

        if (!isPopping) {
          ctx.strokeStyle = 'rgba(255,255,255,0.12)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(rectX + 8, rectY + 4);
          ctx.lineTo(rectX + rectW - 8, rectY + 4);
          ctx.stroke();
        }
        ctx.restore();

        const fontSize = Math.round(36 * scale);
        ctx.font = `900 ${fontSize}px Montserrat, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        if (isPopping) {
          ctx.fillStyle = '#0a0e27';
          ctx.shadowBlur = 0;
          ctx.fillText('★', rectX + rectW / 2, rectY + rectH / 2 + 2);
        } else if (isOpened) {
          ctx.fillStyle = '#4ade80';
          ctx.fillText('✓', rectX + rectW / 2, rectY + rectH / 2 + 2);
        } else {
          const tGrad = ctx.createLinearGradient(0, rectY, 0, rectY + rectH);
          tGrad.addColorStop(0, '#fef08a');
          tGrad.addColorStop(1, '#d4a017');
          ctx.fillStyle = tGrad;
          ctx.fillText('?', rectX + rectW / 2, rectY + rectH / 2 + 2);
        }
      }

      // ── Ball trail ───────────────────────────────────────────────────────
      for (const p of animationState.current.trail) {
        if (p.alpha < 0.02) continue;
        const tGrad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.radius);
        tGrad.addColorStop(0, `rgba(254,240,138,${p.alpha})`);
        tGrad.addColorStop(1, `rgba(234,179,8,0)`);
        ctx.fillStyle = tGrad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
      }

      // ── Ball (Fix 4: cosmetic squash/stretch, physics circle unchanged) ──
      if (ballRef.current.active) {
        const { x, y } = ballRef.current.pos;
        const { scaleX, scaleY } = animationState.current.squash;

        ctx.save();
        ctx.shadowBlur = 35;
        ctx.shadowColor = 'rgba(234,179,8,1)';

        // Cosmetic transform: translate to ball center, scale, translate back.
        // The physics collision still uses BALL_RADIUS as a perfect circle.
        ctx.translate(x, y);
        ctx.scale(scaleX, scaleY);
        ctx.translate(-x, -y);

        const bGrad = ctx.createRadialGradient(x - 4, y - 4, 2, x, y, BALL_RADIUS);
        bGrad.addColorStop(0, '#ffffff');
        bGrad.addColorStop(0.25, '#fef08a');
        bGrad.addColorStop(0.7, '#eab308');
        bGrad.addColorStop(1, '#ca8a04');
        ctx.fillStyle = bGrad;
        ctx.beginPath();
        ctx.arc(x, y, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        ctx.beginPath();
        ctx.arc(x - 3.5, y - 3.5, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    };

    // ─────────────────────────────────────────────────────────────────────────
    // Fix 5: FIXED-TIMESTEP GAME LOOP
    //
    // rAF provides a DOMHighResTimeStamp. We accumulate the elapsed real time
    // and drain it in fixed 16.6ms physics ticks. This means:
    //
    //   60Hz display  → 1 tick per rAF call  (16.6ms accumulated, 1 drained)
    //   120Hz display → ½ tick per call on average, but we wait until we've
    //                   accumulated ≥ 16.6ms before ticking (so 1 tick every
    //                   2 rAF calls). Physics runs at exactly 60fps pace.
    //   Tab wake-up   → accumulator could be huge; MAX_TICK_BUDGET caps it at
    //                   3 ticks so physics doesn't "catch up" through 5 seconds
    //                   at once.
    //
    // Draw() always runs every rAF — so rendering is still silky smooth at
    // whatever the display's native rate is, while physics is deterministic.
    // ─────────────────────────────────────────────────────────────────────────
    const loop = (rafTimestamp: number) => {
      const anim = animationState.current;

      if (ballRef.current.active) {
        // First frame after ball spawn — initialise the clock
        if (anim.lastRafTime < 0) {
          anim.lastRafTime = rafTimestamp;
        }

        // Accumulate real elapsed time; cap to prevent spiral-of-death
        const rawDelta = rafTimestamp - anim.lastRafTime;
        anim.lastRafTime = rafTimestamp;
        // Cap at MAX_TICK_BUDGET fixed steps worth of time
        anim.accumulator += Math.min(rawDelta, FIXED_STEP * MAX_TICK_BUDGET);

        // Drain in fixed steps
        let ticks = 0;
        while (anim.accumulator >= FIXED_STEP && ticks < MAX_TICK_BUDGET) {
          anim.accumulator -= FIXED_STEP;
          ticks++;
          const landed = physicsTick(rafTimestamp);
          if (landed) {
            anim.accumulator = 0; // discard leftover—ball is done
            break;
          }
        }

        // Update trail (once per rAF, not per tick — purely visual)
        if (ballRef.current.active) {
          const trail = anim.trail;
          trail.push({
            x: ballRef.current.pos.x,
            y: ballRef.current.pos.y,
            alpha: 0.55,
            radius: BALL_RADIUS * 0.85,
          });
          if (trail.length > 14) trail.shift();
          for (const p of trail) { p.alpha *= 0.82; p.radius *= 0.93; }
        }

        // Decay squash/stretch back to neutral (cosmetic, once per rAF)
        const sq = anim.squash;
        sq.scaleX += (1 - sq.scaleX) * 0.20;
        sq.scaleY += (1 - sq.scaleY) * 0.20;
        if (Math.abs(sq.scaleX - 1) < 0.005) sq.scaleX = 1;
        if (Math.abs(sq.scaleY - 1) < 0.005) sq.scaleY = 1;

      } else {
        // Ball inactive — reset the rAF clock so we're fresh when next shot spawns
        anim.lastRafTime = -1;
      }

      draw();
      animationId = requestAnimationFrame(loop);
    };

    animationId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animationId);
  }, [openedSlots, onLand]);

  return (
    <div
      className="relative flex flex-col items-center justify-center w-full h-full max-h-full aspect-[3/5] mx-auto overflow-hidden"
      style={{
        borderRadius: 20,
        border: '3px solid #2d3561',
        background: '#070b20',
        boxShadow: '0 0 60px rgba(234,179,8,0.18), 0 0 120px rgba(0,0,0,0.95), inset 0 0 30px rgba(0,0,0,0.5)',
      }}
    >
      {/* Outer gold glow ring */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          borderRadius: 18,
          border: '1px solid rgba(212,175,55,0.25)',
          boxShadow: 'inset 0 0 40px rgba(234,179,8,0.06)',
        }}
      />
      <canvas
        ref={canvasRef}
        width={BASE_WIDTH}
        height={BASE_HEIGHT}
        className="w-full h-full object-contain block pointer-events-none"
      />
    </div>
  );
};

export default PlinkoBoard;
