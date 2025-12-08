import React from 'react';
import type { TableState } from '../types/table';

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

  return (
    <div className={`absolute right-2 bottom-2 bg-gray-900/90 backdrop-blur-md rounded-xl p-3 border border-gray-600/50 shadow-xl w-[min(360px,42vw)] z-[70] transition-all duration-300 ${showSetup ? 'opacity-50 blur-sm' : ''}`}>
      <h3 className="text-white font-bold text-center mb-2 text-base uppercase tracking-wider">Controls</h3>
      
      {table.dealerDrawInProgress && !table.dealerDrawRevealed ? (
        <div className="flex justify-center">
          <button
            className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-md transition-colors shadow-md"
            onClick={() => {/* TODO: Implement revealDealerDraw */}}
          >
            Reveal highest card
          </button>
        </div>
      ) : table.dealerDrawInProgress && table.dealerDrawRevealed ? (
        <div className="flex flex-col gap-2 items-center">
          <div className="text-green-300 font-semibold px-4 py-2 rounded-md bg-green-600/20 border border-green-400/40">
            Starting hand...
          </div>
          <button
            className="bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-md transition-colors shadow-md"
            onClick={() => {/* TODO: Implement startNewHand */}}
          >
            Start hand now
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {isHeroTurn && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                onClick={() => handleQuickBet('half')}
              >1/2 Pot (1)</button>
              <button
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                onClick={() => handleQuickBet('twoThirds')}
              >2/3 Pot (2)</button>
              <button
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                onClick={() => handleQuickBet('pot')}
              >Pot (3)</button>
              <button
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                onClick={() => handleQuickBet('min')}
              >Min (M)</button>
              <button
                className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 col-span-2 sm:col-span-1"
                onClick={() => handleQuickBet('allin')}
              >All-in (A)</button>
            </div>
          )}
          <div className="flex flex-row flex-wrap gap-2 items-stretch">
            <button 
              className={`font-semibold px-4 py-2 rounded-md flex-1 min-w-[120px] transition-colors shadow-md ${
                table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-red-700 hover:bg-red-600 text-white'
              }`}
              onClick={() => handlePlayerAction('Fold')}
              disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
            >
              Fold
            </button>
            <button 
              className={`font-semibold px-4 py-2 rounded-md flex-1 min-w-[140px] transition-colors shadow-md ${
                table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-700 hover:bg-blue-600 text-white'
              }`}
              onClick={() => handlePlayerAction('Call')}
              disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
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
              className={`font-semibold px-6 py-2 rounded-md flex-1 min-w-[160px] transition-colors shadow-md ${
                table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                  ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                  : 'bg-yellow-600 hover:bg-yellow-500 text-white'
              }`}
              onClick={handleRaiseClick}
              disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
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
        </div>
      )}
      
      {showRaiseDialog && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl w-96">
            <h3 className="text-xl font-bold mb-4 text-white">Raise Amount</h3>
            <div className="mb-4">
              <label className="block text-gray-300 mb-2">
                Amount (Min: ${(() => {
                  const highest = maxBet(table);
                  return Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                })()})
              </label>
              <input
                type="number"
                value={raiseAmount}
                onChange={(e) => setRaiseAmount(Number(e.target.value))}
                className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                autoFocus
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowRaiseDialog(false)}
                className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
              >
                Cancel
              </button>
              <button
                onClick={() => handlePlayerAction('Raise', raiseAmount)}
                className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500"
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
      )}
    </div>
  );
};
