
import React, { useState, useCallback, useEffect, useRef } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import RewardModal from './components/RewardModal';
import { GamePhase } from './types';

// ── Floating background star particle ──────────────────────────────────────
interface StarProps { style: React.CSSProperties }
const Star: React.FC<StarProps> = ({ style }) => (
  <div className="star" style={style} />
);

// ── Confetti particle for final win screen ──────────────────────────────────
const ConfettiPiece: React.FC<{ style: React.CSSProperties }> = ({ style }) => (
  <div style={{
    position: 'absolute',
    width: 8, height: 12,
    borderRadius: 2,
    animation: 'confettiFall 1.8s ease-in forwards',
    ...style,
  }} />
);

const CONFETTI_COLORS = ['#fef08a', '#eab308', '#f97316', '#ec4899', '#a78bfa', '#34d399'];

// ── Main App ────────────────────────────────────────────────────────────────
const App: React.FC = () => {
  const [shotCount, setShotCount] = useState(1);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.READY);
  const [modalOpen, setModalOpen] = useState(false);
  const [openedSlots, setOpenedSlots] = useState<number[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const confettiPieces = useRef<{ id: number; style: React.CSSProperties }[]>([]);

  // Pre-generate confetti pieces once
  useEffect(() => {
    confettiPieces.current = Array.from({ length: 48 }, (_, i) => ({
      id: i,
      style: {
        left: `${Math.random() * 100}%`,
        top: '-10px',
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        animationDelay: `${Math.random() * 0.6}s`,
        animationDuration: `${1.4 + Math.random() * 0.8}s`,
        transform: `rotate(${Math.random() * 360}deg)`,
      }
    }));
  }, []);

  const getRewardForShot = (shot: number) => {
    switch (shot) {
      case 1:
        return {
          title: "So Close! 🎯",
          message: "Not this time — but your next shot is loaded with bonus power!",
          subMessage: "🔥 Next up: Up to 100% Welcome Bonus is waiting!",
          buttonText: "TAKE SHOT 2",
        };
      case 2:
        return {
          title: "Big Win! 🎉",
          message: "You unlocked a 100% Welcome Bonus on your first deposit!",
          subMessage: "🏆 One more shot — your JACKPOT chance is now!",
          buttonText: "TAKE FINAL SHOT",
        };
      case 3:
      default:
        return {
          title: "🎰 JACKPOT!",
          message: "You've won 2,500 Reward Credits  +  $10 Sign-Up Bonus  +  100% Deposit Match up to $1,000!",
          subMessage: "",
          buttonText: "CLAIM MY REWARD NOW →",
          isFinal: true
        };
    }
  };

  const handleLand = useCallback((slotId: number) => {
    setOpenedSlots(prev => [...prev, slotId]);
    setPhase(GamePhase.REVEALING);
    setTimeout(() => setModalOpen(true), 900);
  }, []);

  const handleNextShot = () => {
    setModalOpen(false);
    if (shotCount < 3) {
      setShotCount(prev => prev + 1);
      setPhase(GamePhase.READY);
    } else {
      setPhase(GamePhase.FINISHED);
      setShowConfetti(true);
    }
  };

  const currentReward = getRewardForShot(shotCount);
  const isFinished = phase === GamePhase.FINISHED;

  // ── Stars: generate once ─────────────────────────────────────────────────
  const stars = useRef(
    Array.from({ length: 22 }, (_, i) => {
      const size = 2 + Math.random() * 4;
      return {
        id: i,
        style: {
          width: size, height: size,
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animation: `twinkle ${3 + Math.random() * 5}s ease-in-out ${Math.random() * 4}s infinite`,
        } as React.CSSProperties
      };
    })
  );

  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-between overflow-hidden bg-gradient-to-b from-[#0a0e27] via-[#12183d] to-[#0a0e27]">

      {/* ── Background: stars + orbs ───────────────────────────────────── */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">

        {/* Stars */}
        {stars.current.map(s => <Star key={s.id} style={s.style} />)}

        {/* Floating orbs */}
        <div className="orb-a" style={{ left: '3%', top: '12%', width: 52, height: 52, background: '#eab308', borderRadius: '50%', filter: 'blur(6px)' }} />
        <div className="orb-b" style={{ right: '4%', top: '6%', width: 68, height: 68, background: '#ca8a04', borderRadius: '50%', filter: 'blur(10px)' }} />
        <div className="orb-c" style={{ left: '8%', bottom: '20%', width: 40, height: 40, background: '#eab308', borderRadius: '50%', filter: 'blur(8px)' }} />
        <div className="orb-a" style={{ right: '10%', bottom: '30%', width: 30, height: 30, background: '#fef08a', borderRadius: '50%', filter: 'blur(5px)', animationDelay: '2s' }} />
        <div className="orb-b" style={{ left: '50%', top: '5%', width: 20, height: 20, background: '#fef08a', borderRadius: '50%', filter: 'blur(4px)', animationDelay: '1.5s' }} />
        <div className="orb-c" style={{ right: '20%', top: '50%', width: 14, height: 14, background: '#fbbf24', borderRadius: '50%', filter: 'blur(3px)', animationDelay: '3s' }} />
        <div className="orb-a" style={{ left: '20%', top: '45%', width: 16, height: 16, background: '#fef08a', borderRadius: '50%', filter: 'blur(3px)', animationDelay: '0.8s' }} />

        {/* Ambient radial glow */}
        <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translateX(-50%)', width: '600px', height: '400px', background: 'radial-gradient(ellipse at center, rgba(234,179,8,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />
      </div>

      {/* ── Confetti (final win) ────────────────────────────────────────── */}
      {showConfetti && (
        <div className="absolute inset-0 pointer-events-none z-40 overflow-hidden">
          {confettiPieces.current.map(p => <ConfettiPiece key={p.id} style={p.style} />)}
        </div>
      )}

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="z-10 text-center shrink-0 pt-2 md:pt-3 px-2">
        <h1 className="text-3xl sm:text-4xl md:text-6xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#854d0e] leading-none uppercase"
          style={{ filter: 'drop-shadow(0 3px 8px rgba(0,0,0,0.9))' }}>
          3 SHOT DROP
        </h1>
        <p className="text-[11px] sm:text-xs md:text-sm font-bold tracking-[0.3em] text-[#D4AF37] uppercase leading-none mt-1" style={{ opacity: 0.9 }}>
          Reveal Your Fortune
        </p>
        <p className="text-[10px] sm:text-[11px] font-semibold text-yellow-300/70 tracking-wide mt-0.5 hidden sm:block">
          3 Drops · 3 Chances · One Jackpot
        </p>
      </div>

      {/* ── Game Board + optional desktop side panels ──────────────────── */}
      <div className="flex-1 flex items-center justify-center w-full min-h-0 z-10 px-1 md:px-4 gap-3 lg:gap-6 overflow-hidden">

        {/* LEFT side panel – desktop only */}
        <div className="hidden lg:flex flex-col items-center gap-3 w-44 xl:w-52 shrink-0">
          <div className="w-full rounded-2xl border border-yellow-500/30 bg-white/5 backdrop-blur-sm p-3 text-center">
            <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-2">🏆 Prizes</p>
            <div className="space-y-1.5 text-left">
              {[
                { shot: 'Shot 1', label: 'Warm-Up', color: 'text-blue-300' },
                { shot: 'Shot 2', label: '100% Bonus', color: 'text-green-300' },
                { shot: 'Shot 3', label: 'JACKPOT!', color: 'text-yellow-300' },
              ].map(r => (
                <div key={r.shot} className="flex items-center gap-2">
                  <span className="text-gray-400 text-[10px] w-10 shrink-0">{r.shot}</span>
                  <span className={`font-bold text-[11px] ${r.color}`}>{r.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="w-full rounded-2xl border border-yellow-500/20 bg-white/5 backdrop-blur-sm p-3 text-center">
            <p className="text-yellow-400 font-black text-[10px] uppercase tracking-widest mb-1.5">🔥 Recent Wins</p>
            {['Alex W. – $1,000', 'Maria L. – $500', 'James K. – $250'].map(w => (
              <p key={w} className="text-[10px] text-gray-300 py-0.5 border-b border-white/5 last:border-0">{w}</p>
            ))}
          </div>
        </div>

        {/* Board Container – ensures board shrinks on shorter viewports */}
        <div className="flex-1 h-full flex items-center justify-center max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl relative overflow-hidden">
          <PlinkoBoard
            phase={phase}
            onLand={handleLand}
            openedSlots={openedSlots}
            onStartDrop={() => setPhase(GamePhase.DROPPING)}
          />
        </div>

        {/* RIGHT side panel – desktop only */}
        <div className="hidden lg:flex flex-col items-center gap-3 w-44 xl:w-52 shrink-0">
          <div className="w-full rounded-2xl border border-yellow-500/30 bg-white/5 backdrop-blur-sm p-3 text-center">
            <p className="text-yellow-400 font-black text-xs uppercase tracking-widest mb-2">🎁 Your Reward</p>
            <p className="text-white font-black text-lg leading-tight">$1,000</p>
            <p className="text-gray-300 text-[10px] mt-1">100% Deposit Match</p>
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-white font-black text-base leading-tight">$10</p>
              <p className="text-gray-300 text-[10px]">Free Sign-Up Bonus</p>
            </div>
            <div className="mt-2 pt-2 border-t border-white/10">
              <p className="text-yellow-300 font-black text-base leading-tight">2,500</p>
              <p className="text-gray-300 text-[10px]">Reward Credits</p>
            </div>
          </div>
          <div className="w-full rounded-2xl border border-yellow-500/20 bg-white/5 backdrop-blur-sm p-3 text-center">
            <p className="text-[11px] text-gray-300 leading-relaxed">
              🔒 Secure &amp; Verified<br />
              <span className="text-yellow-400 font-bold">No purchase required</span><br />
              to claim prizes
            </p>
          </div>
        </div>
      </div>

      {/* ── Bottom controls ─────────────────────────────────────────────── */}
      <div className="z-10 w-full max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg flex flex-col items-center pb-2 pt-1 gap-1 md:gap-1.5 shrink-0 px-3 bg-[#0a0e27]/80 backdrop-blur-xs">

        {/* Shot counter label */}
        <p className="text-[10px] sm:text-xs font-bold tracking-[0.25em] text-gray-400 uppercase">
          {isFinished ? 'ALL SHOTS USED' : `SHOT ${shotCount} OF 3`}
        </p>

        {/* Shot indicator circles */}
        <div className="flex gap-3 mb-1">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full border-2 flex items-center justify-center font-black transition-all duration-300 ${i < shotCount
                ? 'bg-green-900/40 border-green-500 text-green-400'
                : i === shotCount && !isFinished
                  ? 'bg-gradient-to-b from-[#fef08a] to-[#eab308] border-white text-[#0a0e27] scale-110 shot-active'
                  : 'bg-transparent border-gray-600 text-gray-600'
                }`}
            >
              <span className="text-sm sm:text-base">
                {i < shotCount ? '✓' : i}
              </span>
            </div>
          ))}
        </div>

        {/* CTA button or Game-Over conversion */}
        {isFinished ? (
          <div className="w-full flex flex-col items-center gap-2">
            <a
              href="#claim"
              className="claim-btn relative w-full py-3 sm:py-4 rounded-xl text-base sm:text-xl font-black tracking-widest text-center text-[#0a0e27] bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#ca8a04] shadow-[0_6px_0_#854d0e] block overflow-hidden btn-shine"
            >
              🎰 CLAIM MY REWARD NOW →
            </a>
            <p className="text-[9px] text-yellow-400/60 uppercase tracking-widest font-bold animate-pulse">
              ⏳ Limited time offer — act now!
            </p>
          </div>
        ) : (
          <button
            onClick={() => phase === GamePhase.READY && setPhase(GamePhase.DROPPING)}
            disabled={phase !== GamePhase.READY}
            className={`relative w-full py-2.5 sm:py-4 rounded-xl text-sm sm:text-xl font-black tracking-widest transition-all duration-300 active:scale-95 overflow-hidden ${phase === GamePhase.READY
              ? 'bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#ca8a04] text-[#0a0e27] shadow-[0_4px_0_#854d0e] hover:shadow-[0_2px_0_#854d0e] hover:translate-y-0.5 btn-shine'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-gray-700'
              }`}
          >
            {phase === GamePhase.READY ? `🎯 DROP SHOT ${shotCount}` : phase === GamePhase.DROPPING ? '🎱 DROPPING...' : '⌛ REVEALING...'}
          </button>
        )}

        <p className="text-[9px] text-gray-500 uppercase tracking-tight font-bold text-center mt-0.5" style={{ opacity: 0.65 }}>
          PROMOTIONAL OFFER • NO PURCHASE NECESSARY • T&amp;Cs APPLY
        </p>
      </div>

      {/* ── Reward Modal ────────────────────────────────────────────────── */}
      {modalOpen && (
        <RewardModal
          {...currentReward}
          onAction={handleNextShot}
        />
      )}
    </div>
  );
};

export default App;
