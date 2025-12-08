import React from 'react';
import type { TableState } from '../types/table';

type TableStage = TableState['stage'];

interface GameControlsProps {
  table: TableState;
  isHeroTurn: boolean;
  handlePlayerAction: (action: 'Fold' | 'Call' | 'Raise', amount?: number) => void;
  handleQuickBet: (kind: 'half' | 'twoThirds' | 'pot' | 'allin' | 'min') => void;
  getHeroIndex: (t: TableState) => number;
  maxBet: (t: TableState) => number;
  showRaiseDialog: boolean;
  setShowRaiseDialog: (show: boolean) => void;
  raiseAmount: number;
  setRaiseAmount: (amount: number) => void;
  showSetup?: boolean;
  onRevealHighestCard?: () => void;
  onStartNewHand?: () => void;
  onShowRoundSummary?: () => void;
  onNewHand?: () => void;
  onOpenStats?: () => void;
  isGameEnded?: boolean;
}

export const GameControls: React.FC<GameControlsProps> = ({
  table,
  isHeroTurn,
  handlePlayerAction,
  handleQuickBet,
  getHeroIndex,
  maxBet,
  showRaiseDialog,
  setShowRaiseDialog,
  raiseAmount,
  setRaiseAmount,
  showSetup = false,
  onRevealHighestCard,
  onStartNewHand,
  onShowRoundSummary,
  onNewHand,
  onOpenStats,
  isGameEnded = false,
}) => {
  const handleRaiseClick = () => {
    const hero = table.players?.find((p) => p.isHero);
    if (!hero) return;
    const highest = maxBet(table);
    const minRaise = Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
    setRaiseAmount(minRaise);
    setShowRaiseDialog(true);
  };

  const getHero = () => table.players?.[getHeroIndex(table)];

  const handlePlayerActionWithDialog = (action: 'Fold' | 'Call' | 'Raise', amount?: number) => {
    if (action === 'Raise' && amount !== undefined) {
      // Close the dialog first, then execute the raise
      setShowRaiseDialog(false);
      setTimeout(() => {
        handlePlayerAction(action, amount);
      }, 100); // Small delay to ensure dialog closes before action
    } else {
      handlePlayerAction(action, amount);
    }
  };

  return (
    <>
      <div 
        className={`fixed left-1/2 bottom-4 z-40 w-full max-w-4xl bg-gradient-to-r from-neutral-900 to-neutral-800 text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden transform transition-all duration-300 ease-out translate-x-[-50%] ${
          showSetup ? 'opacity-50 blur-sm' : ''
        }`}
      >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10 bg-gradient-to-r from-neutral-800/80 to-neutral-900/80">
        <div className="flex items-center gap-3">
          <div className="w-1 h-5 bg-gradient-to-b from-amber-200 to-yellow-400 rounded-full"></div>
          <h2 className="text-lg font-bold bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
            Game Controls
          </h2>
        </div>
      </div>

      {/* Body - Horizontal Layout */}
      <div className="px-6 py-3 flex items-center justify-between gap-4">
      
      {table.dealerDrawInProgress && !table.dealerDrawRevealed ? (
        <div className="flex justify-center flex-1">
          <button
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 transition-colors"
            onClick={onRevealHighestCard}
          >
            Reveal highest card
          </button>
        </div>
      ) : table.dealerDrawInProgress && table.dealerDrawRevealed ? (
        <div className="flex items-center justify-center gap-3 flex-1">
          <button
            className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 transition-colors"
            onClick={onStartNewHand}
          >
            Start game
          </button>
        </div>
      ) : (
        <>
          {/* Showdown controls */}
          {table.stage === 'Showdown' as TableStage && !showSetup ? (
            <div className="flex items-center justify-center gap-3 flex-1">
              <button
                className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 font-medium border border-blue-500/30 transition-colors"
                onClick={onShowRoundSummary}
              >
                Round Summary
              </button>
              <button
                className="px-4 py-2 rounded-xl bg-green-600/20 hover:bg-green-600/30 text-green-300 font-medium border border-green-500/30 transition-colors"
                onClick={onNewHand}
              >
                New Hand
              </button>
            </div>
          ) : isGameEnded ? (
            <div className="flex items-center justify-center gap-3 flex-1">
              <button
                className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 font-medium border border-purple-500/30 transition-colors"
                onClick={onOpenStats}
              >
                Ver Estadísticas
              </button>
            </div>
          ) : (
            <>
              {isHeroTurn && (
                <div className="flex items-center gap-1 px-2 py-1 rounded-xl bg-white/5 border border-white/10">
                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 transition-colors"
                    onClick={() => handleQuickBet('half')}
                  >1/2 Pot</button>
                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 transition-colors"
                    onClick={() => handleQuickBet('twoThirds')}
                  >2/3 Pot</button>
                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 transition-colors"
                    onClick={() => handleQuickBet('pot')}
                  >Pot</button>
                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 transition-colors"
                    onClick={() => handleQuickBet('min')}
                  >Min</button>
                  <button
                    className="px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 transition-colors"
                    onClick={() => handleQuickBet('allin')}
                  >All-in</button>
                </div>
              )}
            </>
          )}
          
          {/* Regular game controls (not showdown) */}
          {table.stage !== 'Showdown' as TableStage && (
            <div className="flex items-center gap-1">
            <button 
              className={`font-semibold px-4 py-3 rounded-xl transition-colors ${
                table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' as TableStage || table.currentPlayerIndex !== getHeroIndex(table)
                  ? 'bg-white/5 text-white/50 cursor-not-allowed border border-white/10'
                  : 'bg-red-600/20 hover:bg-red-600/30 text-red-300 border border-red-500/30'
              }`}
              onClick={() => handlePlayerActionWithDialog('Fold')}
              disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' as TableStage || table.currentPlayerIndex !== getHeroIndex(table)}
            >
              Fold
            </button>
            <button 
              className={`font-semibold px-4 py-3 rounded-xl transition-colors ${
                table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' as TableStage || table.currentPlayerIndex !== getHeroIndex(table)
                  ? 'bg-white/5 text-white/50 cursor-not-allowed border border-white/10'
                  : 'bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30'
              }`}
              onClick={() => handlePlayerActionWithDialog('Call')}
              disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' as TableStage || table.currentPlayerIndex !== getHeroIndex(table)}
            >
              {(() => {
                const hero = getHero();
                const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                if (toCall === 0) return 'Check';
                if (toCall >= (hero?.chips || 0)) return `All-in $${hero?.chips}`;
                return `Call $${toCall}`;
              })()}
            </button>
            <button 
              className={`font-semibold px-4 py-3 rounded-xl transition-colors ${
                table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' as TableStage || table.currentPlayerIndex !== getHeroIndex(table)
                  ? 'bg-white/5 text-white/50 cursor-not-allowed border border-white/10'
                  : 'bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30'
              }`}
              onClick={handleRaiseClick}
              disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' as TableStage || table.currentPlayerIndex !== getHeroIndex(table)}
            >
              {(() => {
                const hero = getHero();
                const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                const highest = maxBet(table);
                const minRaise = Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                if ((hero?.chips || 0) <= toCall) return 'All-in';
                return `Raise to $${minRaise}`;
              })()}
            </button>
          </div>
          )}
        </>
      )}
      </div>
    </div>
    
    {/* Raise Dialog - Moved outside main container */}
    {showRaiseDialog && (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && setShowRaiseDialog(false)}>
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        
        <div className="relative z-10 w-full max-w-md bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden transform transition-all duration-300 ease-out animate-in zoom-in-95">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-neutral-800/80 to-neutral-900/80">
            <h2 className="text-xl font-bold bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
              Raise Amount
            </h2>
            <button
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
              onClick={(e) => { e.stopPropagation(); setShowRaiseDialog(false); }}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <div className="p-6">
            <div className="mb-4">
              <label className="block text-white/80 mb-2">
                Amount (Min: ${(() => {
                  const highest = maxBet(table);
                  return Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                })()})
              </label>
              <input
                type="number"
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-full p-3 rounded-xl bg-white/10 text-white border border-white/20 focus:border-yellow-400 focus:ring-2 focus:ring-yellow-400/20 transition-all duration-200"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowRaiseDialog(false)}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/20 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePlayerActionWithDialog('Raise', raiseAmount)}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-500 hover:from-amber-500 hover:to-yellow-400 text-white font-medium transition-all duration-200 shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={raiseAmount < (() => {
                  const highest = maxBet(table);
                  return Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                })()}
              >
                Raise to ${raiseAmount}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  );
};
