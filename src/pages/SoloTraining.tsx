import React, { useState, useEffect, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import PokerCard from '../components/PokerCard';
import localPokerService, { type GameState, type PlayerAction, type Card } from '../lib/localPokerService';

const SoloTraining: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement>(null);

  // Helper function to check if a card should be highlighted
  const isCardHighlighted = useCallback((card: Card): boolean => {
    if (!gameState?.hand_evaluation?.highlighted_cards) return false;
    
    return gameState.hand_evaluation.highlighted_cards.some(highlightedCard => 
      highlightedCard.rank === card.rank && highlightedCard.suit === card.suit
    );
  }, [gameState]);

  const shouldShowWinner = useCallback((stage: string): boolean => {
    return stage === 'Showdown' || stage === 'GameOver';
  }, []);

  const shouldShowBoard = useCallback((stage: string): boolean => {
    return stage === 'Flop' || stage === 'Turn' || stage === 'River' || stage === 'Showdown';
  }, []);

  // Initialize game function
  const initializeGame = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const newGame = await localPokerService.createGame();
      setGameState({
        ...newGame,
        hand_evaluation: shouldShowWinner(newGame.stage) ? newGame.hand_evaluation : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  }, [shouldShowWinner]);

  // Initialize game on component mount
  useEffect(() => {
    initializeGame();
  }, [initializeGame]);

  // Auto-scroll logs to bottom
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [gameState?.logs]);

  const handlePlayerAction = async (action: PlayerAction, amount: number = 0) => {
    if (!gameState) return;

    try {
      setLoading(true);
      setError(null);
      const updatedGame = await localPokerService.playerAction(gameState.game_id, action, amount);
      setGameState(updatedGame);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to process action');
    } finally {
      setLoading(false);
    }
  };

  const handleResetGame = async () => {
    if (!gameState) return;

    try {
      setLoading(true);
      setError(null);
      const resetGame = await localPokerService.resetGame(gameState.game_id);
      setGameState({
        ...resetGame,
        hand_evaluation: shouldShowWinner(resetGame.stage) ? resetGame.hand_evaluation : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset game');
    } finally {
      setLoading(false);
    }
  };

  const stageLabel = (stage: string): string => {
    switch (stage) {
      case 'Deal': return 'Deal';
      case 'PreFlop': return 'Pre-Flop';
      case 'Flop': return 'Flop';
      case 'Turn': return 'Turn';
      case 'River': return 'River';
      case 'Showdown': return 'Showdown';
      case 'Folded': return 'Folded';
      case 'GameOver': return 'Game Over';
      default: return stage;
    }
  };

  const stageBadgeClass = (stage: string): string => {
    switch (stage) {
      case 'Deal': return 'bg-neutral-700/80 text-neutral-200 border-neutral-600/60';
      case 'PreFlop': return 'bg-indigo-600/30 text-indigo-200 border-indigo-600/40';
      case 'Flop': return 'bg-green-600/30 text-green-200 border-green-600/40';
      case 'Turn': return 'bg-yellow-600/30 text-yellow-200 border-yellow-600/40';
      case 'River': return 'bg-rose-600/30 text-rose-200 border-rose-600/40';
      case 'Showdown': return 'bg-blue-600/30 text-blue-200 border-blue-600/40';
      case 'Folded': return 'bg-red-600/30 text-red-200 border-red-600/40';
      case 'GameOver': return 'bg-neutral-800 text-neutral-200 border-neutral-700';
      default: return 'bg-neutral-700/80 text-neutral-200 border-neutral-600/60';
    }
  };

  const logKindIcon = (kind: string): string => {
    switch (kind) {
      case 'Tip': return '💡';
      case 'Action': return '🎯';
      case 'Deal': return '🃏';
      case 'Info': return 'ℹ️';
      default: return '📝';
    }
  };

  const isShuffling = false;
  const isPreflop = gameState?.stage === 'PreFlop';

  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 sm:p-10 shadow-2xl border border-white/30 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
            <span className="text-2xl">🎮</span>
          </div>
          <div className="text-white text-xl font-medium">Creating new game...</div>
        </div>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 sm:p-10 shadow-2xl border border-white/30 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-400 to-pink-500 rounded-full mb-4 shadow-lg">
            <span className="text-2xl">❌</span>
          </div>
          <div className="text-red-200 text-xl mb-6 font-medium">Error: {error}</div>
          <button 
            className="group flex items-center space-x-2 bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-400/30 hover:border-blue-400/50 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105 mx-auto" 
            onClick={initializeGame}
          >
            <div className="w-5 h-5 bg-blue-500/30 rounded-md flex items-center justify-center group-hover:bg-blue-500/50 transition-colors duration-300">
              <span className="text-base">🔄</span>
            </div>
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 flex items-center justify-center px-4">
        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 sm:p-10 shadow-2xl border border-white/30 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
            <span className="text-2xl">🎮</span>
          </div>
          <div className="text-white text-xl font-medium">Initializing...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-32 right-20 w-16 h-16 border-2 border-white/20 rounded-full"></div>
        <div className="absolute bottom-20 left-32 w-12 h-12 border-2 border-white/20 rounded-full"></div>
        <div className="absolute bottom-32 right-10 w-24 h-24 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-1/2 left-1/4 w-8 h-8 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-1/3 right-1/3 w-14 h-14 border-2 border-white/20 rounded-full"></div>
      </div>

      <Navbar onShuffle={handleResetGame} actionLabel="New Hand" />
      <div className="relative mx-auto max-w-none px-1 py-2">
        <div className="flex flex-col">

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <div className="text-red-200">❌ {error}</div>
            </div>
          )}

          <div className="flex gap-6 items-start">

            {/* Center - Main Game Content */}
            <div className="flex-1 min-w-0 flex flex-col items-stretch justify-start gap-6 md:min-h-[20rem] md:h-[calc(100dvh-8rem)]">
              {/* Main Game Card */}
              <div className="bg-white/15 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 w-full mx-2 md:mx-3 flex flex-col h-full">
                {/* Header - Winner */}
                {shouldShowWinner(gameState.stage) && gameState.hand_evaluation && (
                  <div className="sticky top-0 z-10 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border-b border-yellow-400/50 px-6 py-3">
                    <div className="text-yellow-100 text-center">
                      <h3 className="text-yellow-200 font-bold text-lg">🏆 {gameState.hand_evaluation.combination_type}</h3>
                    </div>
                  </div>
                )}

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 pr-7 sm:p-8 sm:pr-9">

                {/* Board - Flop + Turn + River */}
                {shouldShowBoard(gameState.stage) && (
                <div className="bg-neutral-900/60 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-400/20 rounded-xl p-6 mb-6">
                <h3 className="text-white font-semibold mb-4 text-center text-lg">Board</h3>
                <div className="flex justify-center gap-4 flex-wrap">
                  {/* Flop cards */}
                  {gameState.board.slice(0, 3).map((card, idx) => (
                    <div key={`flop-${idx}`} className="flex flex-col items-center">
                      <PokerCard 
                        suit={card.suit} 
                        rank={card.rank} 
                        isShuffling={isShuffling}
                        isHighlighted={isCardHighlighted(card)}
                      />
                      <span className="text-white/70 text-base mt-2 font-medium">Flop</span>
                    </div>
                  ))}
                  
                  {/* Turn card */}
                  {gameState.board.length >= 4 && (
                    <div className="flex flex-col items-center">
                      <PokerCard 
                        suit={gameState.board[3].suit} 
                        rank={gameState.board[3].rank} 
                        isShuffling={isShuffling}
                        isHighlighted={isCardHighlighted(gameState.board[3])}
                      />
                      <span className="text-white/70 text-base mt-2 font-medium">Turn</span>
                    </div>
                  )}
                  
                  {/* River card */}
                  {gameState.board.length >= 5 && (
                    <div className="flex flex-col items-center">
                      <PokerCard 
                        suit={gameState.board[4].suit} 
                        rank={gameState.board[4].rank} 
                        isShuffling={isShuffling}
                        isHighlighted={isCardHighlighted(gameState.board[4])}
                      />
                      <span className="text-white/70 text-base mt-2 font-medium">River</span>
                    </div>
                  )}
                </div>
                </div>
                )}

              {/* Your Hand */}
              <div className="bg-neutral-900/60 bg-gradient-to-r from-green-500/10 to-teal-500/10 border border-green-400/20 rounded-xl p-6 mb-6">
              <h3 className="text-white font-semibold mb-4 text-center text-lg">Your Hand</h3>
              <div className="flex justify-center gap-4">
                {gameState.player_hand.map((card: Card, idx: number) => (
                  <div key={`hole-${idx}`} className="flex flex-col items-center">
                    <PokerCard 
                      suit={card.suit} 
                      rank={card.rank} 
                      isShuffling={isShuffling}
                      isHighlighted={isCardHighlighted(card)}
                    />
                  </div>
                ))}
              </div>
              </div>

              {/* Action Buttons */}
              <div className={`flex items-center justify-center gap-4 mb-6 ${isPreflop ? 'min-h-[30vh] flex-col sm:flex-row' : ''}`}>
                <button 
                  className="group w-full sm:w-auto flex items-center space-x-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-2 border-red-500 hover:border-red-400 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl" 
                  onClick={() => handlePlayerAction('Fold')} 
                  disabled={gameState.stage !== 'PreFlop' || loading}
                >
                  <div className="w-6 h-6 bg-red-500 rounded-lg flex items-center justify-center group-hover:bg-red-400 transition-colors duration-300">
                    <span className="text-base font-bold">✕</span>
                  </div>
                  <span>{loading ? '...' : 'Fold'}</span>
                </button>
                <button 
                  className="group w-full sm:w-auto flex items-center space-x-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-2 border-blue-500 hover:border-blue-400 text-white px-8 py-4 rounded-xl font-bold text-lg transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 shadow-lg hover:shadow-xl" 
                  onClick={() => handlePlayerAction('Call')} 
                  disabled={gameState.stage !== 'PreFlop' || loading}
                >
                  <div className="w-6 h-6 bg-blue-500 rounded-lg flex items-center justify-center group-hover:bg-blue-400 transition-colors duration-300">
                    <span className="text-base font-bold">✓</span>
                  </div>
                  <span>{loading ? '...' : 'Check'}</span>
                </button>
              </div>

              {/* Game Info */}
              <div className={`bg-white/10 rounded-xl p-4 text-center ${isPreflop ? 'mt-12 sm:mt-16' : ''}`}>
                <div className="grid grid-cols-3 gap-4 text-white/80">
                  <div className="flex flex-col">
                    <span className="text-base text-white/60">Stage</span>
                    <span className="font-semibold text-white">{stageLabel(gameState.stage)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base text-white/60">Pot</span>
                    <span className="font-semibold text-white">${gameState.pot}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-base text-white/60">Deck</span>
                    <span className="font-semibold text-white">{gameState.deck?.length ?? 0}</span>
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>

            {/* Right - Action Log Panel */}
            <div 
              className="hidden md:flex w-80 flex-shrink-0 bg-neutral-900/95 backdrop-blur-xl rounded-2xl border border-neutral-700/50 shadow-2xl overflow-hidden flex-col min-h-[20rem] h-[calc(100dvh-8rem)] self-start mr-2 md:mr-3"
            >
        <div className="sticky top-0 z-10 bg-neutral-800/90 border-b border-neutral-700/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-base font-bold shadow-md">
                📝
              </div>
              <h3 className="text-white font-bold text-lg">Action Log & Tips</h3>
            </div>
          </div>
        </div>
        <div ref={logContainerRef} className="px-4 py-3 space-y-3 text-white text-base overflow-y-auto no-scrollbar flex-1 pb-20">
          {gameState.logs.map((entry, idx) => (
            <div key={`log-${idx}`} className="bg-neutral-800/60 rounded-xl p-4 border border-neutral-700/40 hover:bg-neutral-800/80 transition-colors duration-200">
              <div className="flex flex-col gap-2">
                <div className={`px-3 py-1 rounded-lg border text-base font-medium w-fit ${stageBadgeClass(entry.stage)}`}>
                  {stageLabel(entry.stage)}
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">{logKindIcon(entry.kind)}</span>
                  <div className="min-w-0">
                    <p className="text-white/90 leading-relaxed">{entry.message}</p>
                    <div className="text-neutral-400 text-base font-medium mt-1">
                      {entry.time}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {gameState.logs.length === 0 && (
            <div className="text-center py-8 text-neutral-400">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-base">No actions yet</p>
            </div>
          )}
        </div>
        <div className="sticky bottom-0 z-10 bg-neutral-800/90 border-t border-neutral-700/50 px-4 py-3">
          <button 
            className="group flex items-center justify-center space-x-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-2 border-red-500 hover:border-red-400 text-white px-4 py-2.5 rounded-xl font-bold text-base transition-all duration-300 hover:scale-105 w-full shadow-lg hover:shadow-xl" 
            onClick={() => setGameState(prev => prev ? { ...prev, logs: [] } : null)}
          >
            <div className="w-5 h-5 bg-red-500 rounded-lg flex items-center justify-center group-hover:bg-red-400 transition-colors duration-300">
              <span className="text-base font-bold">🗑️</span>
            </div>
            <span>Clear Log</span>
          </button>
        </div>
      </div>
    </div>
  </div>
  </div>
  </div>
  );
};

export default SoloTraining;