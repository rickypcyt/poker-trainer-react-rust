import React, { useState, useEffect, useRef } from 'react';

import Navbar from '../components/Navbar';
import PokerCard from '../components/PokerCard';
import { SUIT_LABEL_EN } from '../constants/cards';
import pokerService, { type GameState, type PlayerAction, type LogEntry, type Card } from '../lib/pokerService';

const SoloTraining: React.FC = () => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

  // Helper function to check if a card should be highlighted
  const isCardHighlighted = (card: Card): boolean => {
    if (!gameState?.hand_evaluation?.highlighted_cards) return false;
    return gameState.hand_evaluation.highlighted_cards.some(
      highlightedCard => 
        highlightedCard.suit === card.suit && highlightedCard.rank === card.rank
    );
  };

  // Initialize game on component mount
  useEffect(() => {
    initializeGame();
  }, []);

  // Auto-scroll logs to bottom
  useEffect(() => {
    const el = logContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [gameState?.logs]);

  const initializeGame = async () => {
    try {
      setLoading(true);
      setError(null);
      const newGame = await pokerService.createGame();
      setGameState(newGame);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerAction = async (action: PlayerAction) => {
    if (!gameState) return;

    try {
      setLoading(true);
      setError(null);
      const updatedGame = await pokerService.playerAction(gameState.game_id, action);
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
      const resetGame = await pokerService.resetGame(gameState.game_id);
      setGameState(resetGame);
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

  if (loading && !gameState) {
    return (
      <div className="min-h-screen bg-green-700 flex items-center justify-center">
        <div className="text-white text-xl">🎮 Creating new game...</div>
      </div>
    );
  }

  if (error && !gameState) {
    return (
      <div className="min-h-screen bg-green-700 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-300 text-xl mb-4">❌ Error: {error}</div>
          <button 
            className="btn btn-primary" 
            onClick={initializeGame}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <div className="min-h-screen bg-green-700 flex items-center justify-center">
        <div className="text-white text-xl">🎮 Initializing...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-green-700">
      <Navbar onShuffle={handleResetGame} actionLabel="New Hand" />
      <div className="max-w-6xl mx-auto px-4 py-6 md:pr-96">
        <div className="flex flex-col min-h-[calc(100vh-7rem)]">
          <h2 className="text-white text-2xl font-bold mb-4">Solo Training</h2>

          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4">
              <div className="text-red-200">❌ {error}</div>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center gap-6">
            {/* Board - Flop + Turn + River */}
            <div className="bg-white/10 rounded-lg border border-white/20 p-6 w-full max-w-5xl">
              <h3 className="text-white font-semibold mb-4 text-center text-lg">Board</h3>
              <div className="flex justify-center gap-4">
                {/* Flop cards */}
                {gameState.board.slice(0, 3).map((card, idx) => (
                  <div key={`flop-${idx}`} className="flex flex-col items-center">
                    <PokerCard 
                      suit={card.suit} 
                      rank={card.rank} 
                      isShuffling={isShuffling}
                      isHighlighted={isCardHighlighted(card)}
                    />
                    <span className="text-white/70 text-sm mt-2 font-medium">Flop</span>
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
                    <span className="text-white/70 text-sm mt-2 font-medium">Turn</span>
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
                    <span className="text-white/70 text-sm mt-2 font-medium">River</span>
                  </div>
                )}
              </div>
            </div>

            {/* Your Hand */}
            <div className="bg-white/10 rounded-lg border border-white/20 p-6 w-full max-w-2xl">
              <h3 className="text-white font-semibold mb-4 text-center text-lg">Your Hand</h3>
              <div className="flex justify-center gap-4">
                {gameState.hole_cards.map((card, idx) => (
                  <div key={`hole-${idx}`} className="flex flex-col items-center">
                    <PokerCard 
                      suit={card.suit} 
                      rank={card.rank} 
                      isShuffling={isShuffling}
                      isHighlighted={isCardHighlighted(card)}
                    />
                    <span className="text-white/70 text-sm mt-2 font-medium">Hole Card {idx + 1}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Burned Cards - What Would Have Been */}
            {gameState.burned_cards && gameState.burned_cards.length > 0 && (
              <div className="bg-white/10 rounded-lg border border-white/20 p-6 w-full max-w-5xl">
                <h3 className="text-white font-semibold mb-4 text-center text-lg">Burned Cards (What Would Have Been)</h3>
                <div className="flex justify-center gap-4">
                  {/* Flop burn cards */}
                  {gameState.burned_cards.length >= 3 && (
                    <>
                      {gameState.burned_cards.slice(0, 3).map((card, idx) => (
                        <div key={`flop-burn-${idx}`} className="flex flex-col items-center">
                          <PokerCard 
                            suit={card.suit} 
                            rank={card.rank} 
                            isShuffling={isShuffling} 
                          />
                          <span className="text-white/70 text-sm mt-2 font-medium">Flop Burn</span>
                        </div>
                      ))}
                    </>
                  )}
                  
                  {/* Turn burn card */}
                  {gameState.burned_cards.length >= 4 && (
                    <div className="flex flex-col items-center">
                      <PokerCard 
                        suit={gameState.burned_cards[3].suit} 
                        rank={gameState.burned_cards[3].rank} 
                        isShuffling={isShuffling} 
                      />
                      <span className="text-white/70 text-sm mt-2 font-medium">Turn Burn</span>
                    </div>
                  )}
                  
                  {/* River burn card */}
                  {gameState.burned_cards.length >= 5 && (
                    <div className="flex flex-col items-center">
                      <PokerCard 
                        suit={gameState.burned_cards[4].suit} 
                        rank={gameState.burned_cards[4].rank} 
                        isShuffling={isShuffling} 
                      />
                      <span className="text-white/70 text-sm mt-2 font-medium">River Burn</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Hand Evaluation Display */}
            {gameState.hand_evaluation && (
              <div className="bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg border border-yellow-400/50 p-6 w-full max-w-2xl">
                <h3 className="text-yellow-200 font-bold mb-3 text-center text-xl">
                  🏆 {gameState.hand_evaluation.combination_type}
                </h3>
                <div className="text-yellow-100 text-center">
                  <p className="text-lg font-semibold mb-2">
                    {gameState.hand_evaluation.combination_type} Detected!
                  </p>
                  <p className="text-sm opacity-90">
                    {gameState.hand_evaluation.highlighted_cards.length} card(s) highlighted above
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-center gap-4 pt-2">
              <button 
                className="btn btn-danger btn-lg" 
                onClick={() => handlePlayerAction('Fold')} 
                disabled={gameState.stage !== 'PreFlop' || gameState.stage === 'Deal' || loading}
              >
                {loading ? '...' : 'Fold'}
              </button>
              <button 
                className="btn btn-neutral btn-lg" 
                onClick={() => handlePlayerAction('Call')} 
                disabled={gameState.stage !== 'PreFlop' || gameState.stage === 'Deal' || loading}
              >
                {loading ? '...' : 'Call (Play Full Hand)'}
              </button>
              <button 
                className="btn btn-success btn-lg" 
                onClick={() => handlePlayerAction('Raise')} 
                disabled={gameState.stage !== 'PreFlop' || gameState.stage === 'Deal' || loading}
              >
                {loading ? '...' : 'Raise (Play Full Hand)'}
              </button>
            </div>

            <div className="text-center text-white/70">
              <div>Stage: <span className="font-semibold">{stageLabel(gameState.stage)}</span></div>
              <div>Pot: <span className="font-semibold">${gameState.pot}</span></div>
              <div>Cards in deck: <span className="font-semibold">{gameState.deck.length}</span></div>
              {gameState.fold_cards && gameState.fold_cards.length > 0 && (
                <div>Fold cards: <span className="font-semibold">{gameState.fold_cards.length}</span></div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Log Panel */}
      <div 
        ref={logContainerRef} 
        className="hidden md:block fixed right-4 top-20 bottom-4 w-80 bg-neutral-950/90 rounded-lg border border-neutral-800 p-0 overflow-auto"
      >
        <div className="sticky top-0 z-10 bg-neutral-950/80 border-b border-neutral-800 px-4 py-3">
          <h3 className="text-white font-semibold">Action Log & Tips</h3>
        </div>
        <ul className="px-4 py-3 space-y-2 text-white text-base">
          {gameState.logs.map((entry, idx) => (
            <li key={`log-${idx}`} className="flex items-start gap-2">
              <span className={`px-2 py-0.5 rounded-md border text-xs sm:text-sm whitespace-nowrap ${stageBadgeClass(entry.stage)}`}>
                [{stageLabel(entry.stage)}]
              </span>
              <div className="flex-1 leading-snug">
                <span className="mr-1">{logKindIcon(entry.kind)}</span>
                {entry.message}
                <span className="ml-2 text-neutral-300 text-xs sm:text-sm">{entry.time}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 z-10 bg-neutral-950/80 border-t border-neutral-800 px-4 py-3">
          <button 
            className="btn btn-neutral w-full" 
            onClick={() => setGameState(prev => prev ? { ...prev, logs: [] } : null)}
          >
            Clear Log
          </button>
        </div>
      </div>
    </div>
  );
};

export default SoloTraining;