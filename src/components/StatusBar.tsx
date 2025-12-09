import React from 'react';

interface StatusBarProps {
  isHeroTurn: boolean;
  stage: string;
  currentBet: number;
  toCall: number;
  minRaiseTo: number;
  smallBlind: number;
  bigBlind: number;
  lastAction?: string;
}

export const StatusBar: React.FC<StatusBarProps> = ({
  isHeroTurn,
  stage,
  currentBet,
  toCall,
  minRaiseTo,
  smallBlind,
  bigBlind,
  lastAction,
}) => {
  return (
    <div className="fixed top-16 left-0 z-[45] w-full">
      <div className="ml-4 max-w-4xl px-3 py-2">
        <div className="bg-black/40 border border-white/10 rounded-xl text-[12px] text-white/80 backdrop-blur-md shadow-md">
          {/* Top section with turn indicator and last action */}
          {lastAction && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 border-b border-white/10">
              <div className="text-center text-sm font-semibold px-3 py-1 rounded-md border bg-white/10 border-white/20 text-white/90 whitespace-nowrap">
                Stage: <span className="text-yellow-300 font-semibold">{stage}</span>
              </div>
              <div className="flex-1 text-center">
                <span className="text-white/90 text-sm">
                  <span className="text-emerald-300 font-semibold">{isHeroTurn ? 'Your turn' : 'Waiting...'}</span>
                </span>
              </div>
              <div className="text-center text-sm font-semibold px-3 py-1 rounded-md border bg-white/10 border-white/20 text-white/90 whitespace-nowrap">
                Last action: {lastAction}
              </div>
            </div>
          )}
          
          {/* Bottom section with game info */}
          <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-2 pt-2">
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10 whitespace-nowrap">
              Current bet: <span className="font-semibold">${currentBet}</span>
            </div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10 whitespace-nowrap">
              To call: <span className="font-semibold">${toCall}</span>
            </div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10 whitespace-nowrap">
              Min raise to: <span className="font-semibold">${minRaiseTo}</span>
            </div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10 whitespace-nowrap">
              Blinds: <span className="font-semibold">${smallBlind}/${bigBlind}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
