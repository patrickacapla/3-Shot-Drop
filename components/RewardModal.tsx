
import React from 'react';

interface RewardModalProps {
  title: string;
  message: string;
  buttonText: string;
  onAction: () => void;
  isFinal?: boolean;
}

const RewardModal: React.FC<RewardModalProps> = ({ title, message, buttonText, onAction, isFinal }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#161b3d] to-[#0a0e27] border-2 border-[#D4AF37] rounded-3xl p-8 text-center shadow-[0_0_80px_rgba(212,175,55,0.3)] animate-in zoom-in-95 duration-300">
        
        {/* Celebration Decor */}
        {!isFinal && (
           <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-blue-500/20 rounded-full blur-2xl"></div>
        )}
        
        {isFinal && (
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-48 h-48 bg-yellow-500/30 rounded-full blur-3xl animate-pulse"></div>
        )}

        <h2 className={`text-4xl font-black italic mb-4 tracking-tighter ${
          isFinal ? 'text-transparent bg-clip-text bg-gradient-to-b from-white to-[#D4AF37]' : 'text-white'
        }`}>
          {title}
        </h2>

        <div className="bg-black/40 rounded-2xl p-6 mb-8 border border-white/5">
          <p className="text-xl md:text-2xl font-bold leading-relaxed text-blue-50">
            {message}
          </p>
        </div>

        <button
          onClick={onAction}
          className={`w-full py-5 rounded-2xl text-2xl font-black tracking-widest transition-all duration-300 active:scale-95 shadow-xl ${
            isFinal 
            ? 'bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#ca8a04] text-[#0a0e27] hover:brightness-110'
            : 'bg-white/10 hover:bg-white/20 text-white border border-white/20'
          }`}
        >
          {buttonText}
        </button>
        
        {isFinal && (
          <div className="mt-4 text-[10px] text-gray-400 uppercase tracking-widest opacity-60">
            Terms & Conditions Apply
          </div>
        )}
      </div>
    </div>
  );
};

export default RewardModal;
