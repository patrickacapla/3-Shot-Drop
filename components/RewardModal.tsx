
import React, { useEffect, useState } from 'react';

interface RewardModalProps {
  title: string;
  message: string;
  subMessage?: string;
  buttonText: string;
  onAction: () => void;
  isFinal?: boolean;
}

const RewardModal: React.FC<RewardModalProps> = ({ title, message, subMessage, buttonText, onAction, isFinal }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Small delay triggers CSS transition for the zoom-in entrance
    const t = setTimeout(() => setVisible(true), 20);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)' }}
    >
      {/* Outer glow ring for final win */}
      {isFinal && (
        <div
          className="absolute rounded-full animate-pulse"
          style={{ width: 340, height: 340, background: 'radial-gradient(circle, rgba(234,179,8,0.22) 0%, transparent 70%)', pointerEvents: 'none' }}
        />
      )}

      <div
        className="relative w-full max-w-sm sm:max-w-md z-10 rounded-3xl p-6 sm:p-8 text-center"
        style={{
          background: 'linear-gradient(160deg, #1a1f45 0%, #0d1128 100%)',
          border: `2px solid ${isFinal ? '#eab308' : '#4a5568'}`,
          boxShadow: isFinal
            ? '0 0 60px rgba(234,179,8,0.35), 0 0 120px rgba(234,179,8,0.12), inset 0 1px 0 rgba(255,255,255,0.08)'
            : '0 0 40px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
          transform: visible ? 'scale(1)' : 'scale(0.88)',
          opacity: visible ? 1 : 0,
          transition: 'transform 0.28s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s ease',
        }}
      >
        {/* Emoji / icon accent above title */}
        <div className="text-3xl sm:text-4xl mb-2 leading-none">
          {isFinal ? '🏆' : '🎯'}
        </div>

        {/* Title */}
        <h2
          className={`text-2xl sm:text-3xl font-black italic mb-4 leading-tight ${isFinal
              ? 'text-transparent bg-clip-text bg-gradient-to-b from-white via-[#fef08a] to-[#D4AF37]'
              : 'text-white'
            }`}
        >
          {title}
        </h2>

        {/* Main message box */}
        <div
          className="rounded-2xl px-4 py-4 mb-3"
          style={{
            background: 'rgba(0,0,0,0.4)',
            border: '1px solid rgba(255,255,255,0.07)',
          }}
        >
          <p className="text-base sm:text-lg font-bold leading-snug text-blue-50">
            {message}
          </p>
        </div>

        {/* Sub-message / prize teaser */}
        {subMessage && (
          <p className="text-xs sm:text-sm font-bold text-yellow-300/80 mb-4 tracking-wide">
            {subMessage}
          </p>
        )}

        {/* Action button – always gold for consistency */}
        <button
          onClick={onAction}
          className="relative w-full py-4 sm:py-5 rounded-2xl font-black tracking-widest transition-all duration-200 active:scale-95 overflow-hidden btn-shine"
          style={{
            fontSize: isFinal ? '1.1rem' : '1rem',
            background: 'linear-gradient(180deg, #fef08a 0%, #eab308 50%, #ca8a04 100%)',
            color: '#0a0e27',
            boxShadow: '0 5px 0 #854d0e, 0 0 30px rgba(234,179,8,0.4)',
          }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'brightness(1)')}
        >
          {buttonText}
        </button>

        {/* T&Cs */}
        {isFinal && (
          <p className="mt-3 text-[10px] text-gray-400 uppercase tracking-widest opacity-60">
            Terms &amp; Conditions Apply
          </p>
        )}
      </div>
    </div>
  );
};

export default RewardModal;
