
import React, { useState, useCallback } from 'react';
import PlinkoBoard from './components/PlinkoBoard';
import RewardModal from './components/RewardModal';
import { GamePhase } from './types';

const App: React.FC = () => {
  const [shotCount, setShotCount] = useState(1);
  const [phase, setPhase] = useState<GamePhase>(GamePhase.READY);
  const [modalOpen, setModalOpen] = useState(false);
  const [openedSlots, setOpenedSlots] = useState<number[]>([]);

  const getRewardForShot = (shot: number) => {
    switch (shot) {
      case 1:
        return {
          title: "Hard Luck!",
          message: "Try Again — Chances left: 2",
          buttonText: "CONTINUE"
        };
      case 2:
        return {
          title: "Big Win!",
          message: "You got a Up to 100% welcome bonus! More chances left: 1",
          buttonText: "CONTINUE"
        };
      case 3:
      default:
        return {
          title: "JACKPOT!",
          message: "You've won 2,500 Reward Credits + $10 Sign-Up + 100% Deposit Match up to $1,000!",
          buttonText: "CLAIM NOW",
          isFinal: true
        };
    }
  };

  const handleLand = useCallback((slotId: number) => {
    setOpenedSlots(prev => [...prev, slotId]);
    setPhase(GamePhase.REVEALING);
    setTimeout(() => setModalOpen(true), 1000);
  }, []);

  const handleNextShot = () => {
    setModalOpen(false);
    if (shotCount < 3) {
      setShotCount(prev => prev + 1);
      setPhase(GamePhase.READY);
    } else {
      setPhase(GamePhase.FINISHED);
    }
  };

  const currentReward = getRewardForShot(shotCount);

  return (
    <div className="relative h-[100dvh] w-full flex flex-col items-center justify-between py-1 px-1 md:px-2 bg-[#05081a] bg-gradient-to-b from-[#0a0e27] via-[#12183d] to-[#0a0e27] overflow-hidden">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="coin-float left-[2%] top-[10%] w-10 h-10 bg-yellow-500 rounded-full opacity-5 border-2 border-yellow-300 blur-sm"></div>
        <div className="coin-float right-[5%] top-[5%] w-14 h-14 bg-yellow-600 rounded-full opacity-5 border-2 border-yellow-400 blur-md"></div>
      </div>

      {/* Header - Ultra compact */}
      <div className="z-10 text-center shrink-0 mt-0.5">
        <h1 className="text-xl md:text-5xl font-black italic tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#854d0e] drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] leading-none uppercase">
          3 SHOT DROP
        </h1>
        <p className="text-gold-200 text-[7px] md:text-[10px] font-bold tracking-[0.4em] text-[#D4AF37] opacity-80 uppercase leading-none mt-0.5">
          Reveal Your Fortune
        </p>
      </div>

      {/* Plinko Board Container - Narrower max-width to eliminate side bars */}
      <div className="flex-1 flex items-center justify-center w-full max-w-md relative min-h-0 py-0.5 overflow-hidden">
        <PlinkoBoard 
          phase={phase} 
          onLand={handleLand} 
          openedSlots={openedSlots}
          onStartDrop={() => setPhase(GamePhase.DROPPING)}
        />
      </div>

      {/* Bottom Controls - Ultra compact */}
      <div className="z-10 w-full max-w-xs md:max-w-md flex flex-col items-center mb-0.5 gap-0.5 shrink-0">
        <div className="flex gap-2 mb-0.5">
          {[1, 2, 3].map(i => (
            <div 
              key={i} 
              className={`w-6 h-6 md:w-9 md:h-9 rounded-full border flex items-center justify-center font-black transition-all duration-300 ${
                i < shotCount 
                  ? 'bg-blue-900/40 border-blue-400 text-blue-300 opacity-40' 
                  : i === shotCount 
                    ? 'bg-gradient-to-b from-[#fef08a] to-[#eab308] border-white text-[#0a0e27] scale-110 shadow-[0_0_10px_rgba(234,179,8,0.8)]' 
                    : 'bg-transparent border-gray-600 text-gray-500'
              }`}
            >
              <span className="text-[10px] md:text-sm">{i}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => phase === GamePhase.READY && setPhase(GamePhase.DROPPING)}
          disabled={phase !== GamePhase.READY}
          className={`group relative w-full py-2 md:py-4 rounded-md md:rounded-lg text-sm md:text-xl font-black tracking-widest transition-all duration-300 active:scale-95 overflow-hidden ${
            phase === GamePhase.READY 
              ? 'bg-gradient-to-b from-[#fef08a] via-[#eab308] to-[#ca8a04] text-[#0a0e27] shadow-[0_4px_0_#854d0e] hover:shadow-[0_2px_0_#854d0e] hover:translate-y-0.5'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed border-gray-600'
          }`}
        >
          {phase === GamePhase.FINISHED ? 'GAME OVER' : `DROP SHOT ${shotCount}`}
        </button>

        <p className="text-[7px] text-gray-500 uppercase tracking-tighter font-bold text-center opacity-50 mb-0.5">
          PROMOTIONAL OFFER • NO PURCHASE NECESSARY
        </p>
      </div>

      {/* Reward Modal */}
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
