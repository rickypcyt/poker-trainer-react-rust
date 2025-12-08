import type { Rank, Suit } from '../types/cards';

import { FlyingChips } from '../components/FlyingChips';
// UI components
import { GameControls } from '../components/GameControls';
import { GameInfo } from '../components/GameInfo';
import HandRankingCard from '../components/HandRankingCard';
import LogsModal from '../components/LogsModal';
import { Navbar } from '../components/Navbar';
import PokerCard from '../components/PokerCard';
import { PokerTable } from '../components/PokerTable';
import React from 'react';
import { SettingsModal } from '../components/SettingsModal';
import type { TableState } from '../types/table';
import { startNewHand } from '../lib/tableEngine';
import { useBotActions } from '../hooks/useBotActions';
import { useChipAnimation } from '../hooks/useChipAnimation';
// Game logic hooks
import { useGameState } from '../hooks/useGameState';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useNavigate } from 'react-router-dom';
import { usePlayerActions } from '../hooks/usePlayerActions';
import { useUIState } from '../hooks/useUIState';

const Play: React.FC = () => {
  const navigate = useNavigate();
  
  // Game state management
  const { table, updateTable, endGame, revealDealerDraw } = useGameState();
  
  // Player actions logic
  const {
    handlePlayerAction,
    handleQuickBet,
    hero,
    highestBet,
    toCallVal,
    minRaiseToVal,
    isHeroTurn,
  } = usePlayerActions(table, updateTable);
  
  // Bot actions logic
  const { isBotThinking, currentBotIndex } = useBotActions(table, updateTable);
  
  // UI state management
  const {
    isHandsOpen,
    setIsHandsOpen,
    isLogsOpen,
    setIsLogsOpen,
    showRaiseDialog,
    setShowRaiseDialog,
    raiseAmount,
    setRaiseAmount,
    isEndModalOpen,
    setIsEndModalOpen,
    endModalResult,
    heroWonAmount,
    reveal,
    setReveal,
    isDealing,
    chipAnchorsRef,
    potRef,
    dealerRef,
    flyingChips,
    setFlyingChips,
    seatActions,
  } = useUIState(table);
  
  // Keyboard shortcuts
  useKeyboardShortcuts(
    isHeroTurn,
    table.stage,
    table.dealerDrawInProgress,
    handlePlayerAction,
    handleQuickBet
  );
  
  // Chip animations
  useChipAnimation(table, chipAnchorsRef, dealerRef, setFlyingChips);
  
  // Local state for settings modal
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);

  // Setup overlay when starting new game
  const showSetup = React.useState<boolean>(() => {
    const savedTable = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_table') : null;
    return !savedTable;
  })[0];

  // Local state for setup configuration
  const [setupConfig, setSetupConfig] = React.useState(() => {
    let config = { numBots: 2, startingChips: 5000, difficulty: 'Medium' };
    try {
      if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('poker_trainer_config');
        if (saved) {
          const parsed = JSON.parse(saved);
          config = { ...config, ...parsed };
        }
      }
    } catch { /* ignore */ }
    return config;
  });

  React.useEffect(() => {
    // Prevent access to game state from console
    const originalConsoleLog = console.log;
    const originalConsoleTable = console.table;
    
    console.log = function(...args: unknown[]) {
      // Filter out potential game state access
      const filteredArgs = args.filter((arg: unknown) => 
        !arg?.toString().includes('holeCards') && 
        !arg?.toString().includes('players') &&
        !arg?.toString().includes('table')
      );
      if (filteredArgs.length > 0) {
        originalConsoleLog.apply(console, filteredArgs);
      }
    };
    
    console.table = function() {
      // Prevent table display of game state
      return;
    };
    
    // Clear any existing game state from window (with error handling)
    try {
      delete (window as unknown as { __TABLE_STATE__?: unknown }).__TABLE_STATE__;
    } catch {
      // Property doesn't exist or can't be deleted - safe to ignore
    }
    try {
      delete (window as unknown as { tableState?: unknown }).tableState;
    } catch {
      // Property doesn't exist or can't be deleted - safe to ignore
    }
    try {
      delete (window as unknown as { gameState?: unknown }).gameState;
    } catch {
      // Property doesn't exist or can't be deleted - safe to ignore
    }
    
    // Prevent new properties with game-related names
    const gameProps = ['table', 'players', 'holeCards', 'gameState', '__TABLE_STATE__'];
    gameProps.forEach(prop => {
      Object.defineProperty(window, prop, {
        get: () => undefined,
        set: () => {},
        configurable: false
      });
    });
    
    return () => {
      console.log = originalConsoleLog;
      console.table = originalConsoleTable;
    };
  }, []);

  // Get hero index for UI components
  const getHeroIndex = React.useCallback((t: TableState) => {
    return t?.players?.findIndex(p => p.isHero) ?? -1;
  }, []);
  
  // Removed debug logging to prevent cheating
  
  // Get max bet for UI components
  const maxBet = React.useCallback((t: TableState) => {
    const byField = typeof t.currentBet === 'number' ? t.currentBet : 0;
    const byPlayers = t?.players?.length ? Math.max(...t.players.map(p => p.bet || 0)) : 0;
    return Math.max(byField, byPlayers);
  }, []);
  
  // Current actor name for display
  const currentActorName = isHeroTurn ? 'You' : (table.players?.[table.currentPlayerIndex || 0]?.name || 'Player');

  // Safety check: if table is in invalid state, show loading or error
  if (!table || !table.players || !Array.isArray(table.players)) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }
  
  const handleEndGame = () => {
    endGame();
    navigate('/', { replace: true });
  };

  const handleNewHand = () => {
    setReveal(false);
    updateTable(startNewHand(table));
  };

  const handleOpenSettings = () => {
    setIsSettingsOpen(true);
  };

  const pendingNumBots = setupConfig.numBots;

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      <Navbar 
        onShuffle={handleNewHand} 
        actionLabel="New Hand" 
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenHands={() => setIsHandsOpen(true)}
        onEndGame={handleEndGame}
        onOpenSettings={handleOpenSettings}
      />

      {/* Setup overlay when starting new game */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-[92vw] max-w-md bg-neutral-900 text-white rounded-2xl border border-white/10 shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-6 text-center bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              Game Settings
            </h2>
            <div className="space-y-6">
              <div>
                <label htmlFor="bots" className="block text-white/80 text-base mb-3 font-medium">
                  Number of Bots
                </label>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => {
                      setSetupConfig(prev => ({ ...prev, numBots: Math.max(1, prev.numBots - 1) }));
                    }}
                    className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <span className="text-lg">-</span>
                  </button>
                  <span className="flex-1 text-center text-2xl font-bold text-white">
                    {pendingNumBots}
                  </span>
                  <button 
                    onClick={() => {
                      setSetupConfig(prev => ({ ...prev, numBots: Math.min(8, prev.numBots + 1) }));
                    }}
                    className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                  >
                    <span className="text-lg">+</span>
                  </button>
                </div>
                <p className="text-xs text-white/50 mt-2">Choose between 1-8 opponents</p>
              </div>

              <div>
                <label className="block text-white/80 text-base mb-3 font-medium">
                  Starting Chips
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['1000', '5000', '10000'].map(chips => (
                    <button
                      key={chips}
                      onClick={() => setSetupConfig(prev => ({ ...prev, startingChips: parseInt(chips) }))}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        setupConfig.startingChips === parseInt(chips) 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white/10 hover:bg-white/20 text-white/80'
                      }`}
                    >
                      ${chips}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-white/80 text-base mb-3 font-medium">
                  Bot Difficulty
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['Easy', 'Medium', 'Hard'].map(difficulty => (
                    <button
                      key={difficulty}
                      onClick={() => setSetupConfig(prev => ({ ...prev, difficulty }))}
                      className={`py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                        setupConfig.difficulty === difficulty 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white/10 hover:bg-white/20 text-white/80'
                      }`}
                    >
                      {difficulty}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => {
                  // Save configuration to localStorage
                  if (typeof window !== 'undefined') {
                    localStorage.setItem('poker_trainer_config', JSON.stringify(setupConfig));
                    localStorage.setItem('poker_trainer_table', 'initialized');
                  }
                  // Close setup modal by triggering a re-render
                  window.location.reload();
                }}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-bold py-3 rounded-lg shadow-lg transition-all transform hover:scale-[1.02]"
              >
                Start Game
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End of hand modal */}
      {isEndModalOpen && endModalResult && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-slate-900 text-white rounded-xl shadow-2xl border border-white/10 w-[92vw] max-w-[520px] p-6">
            <div className="text-center mb-4">
              <div className={`text-2xl font-extrabold ${endModalResult === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                {endModalResult === 'won' ? '¡Ganaste!' : 'Perdiste'}
              </div>
              <div className="text-base text-white/80 mt-1">¿Quieres ver el log de la mano o empezar un nuevo juego?</div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-md shadow"
                onClick={() => { setIsLogsOpen(true); setIsEndModalOpen(false); }}
              >
                Ver Log
              </button>
              <button
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 rounded-md shadow"
                onClick={() => { setIsEndModalOpen(false); setReveal(false); updateTable(startNewHand(table)); }}
              >
                Nueva mano
              </button>
            </div>
            <div className="flex gap-3 mt-3">
              <button
                className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-2 rounded-md shadow"
                onClick={() => { setIsEndModalOpen(false); handleEndGame(); }}
              >
                Nuevo juego
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast notifications moved to App root */}

      {/* Logs modal */}
      <LogsModal 
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        entries={table.actionLog}
        onClear={() => updateTable({ ...table, actionLog: [] })}
      />

      {/* Settings modal */}
      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      {/* Poker Hands modal */}
      {isHandsOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-2 sm:p-4 md:p-6">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setIsHandsOpen(false)} 
          />
          <div className="relative z-10 w-full h-full max-w-8xl max-h-[90vh] bg-neutral-900/95 text-white rounded-2xl border border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Poker Hand Rankings
              </h2>
              <button 
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm sm:text-base transition-colors duration-200" 
                onClick={() => setIsHandsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-white/90 text-sm overflow-y-auto pr-2 flex-1 custom-scrollbar">
              <HandRankingCard
                title="Royal Flush"
                description="A-K-Q-J-10 same suit"
                cards={[
                  { rank: 'A', suit: 'hearts' },
                  { rank: 'K', suit: 'hearts' },
                  { rank: 'Q', suit: 'hearts' },
                  { rank: 'J', suit: 'hearts' },
                  { rank: '10', suit: 'hearts' }
                ]}
              />

              <HandRankingCard
                title="Straight Flush"
                description="Five in a row, same suit"
                cards={[
                  { rank: '9', suit: 'spades' },
                  { rank: '8', suit: 'spades' },
                  { rank: '7', suit: 'spades' },
                  { rank: '6', suit: 'spades' },
                  { rank: '5', suit: 'spades' }
                ]}
              />

              <HandRankingCard
                title="Four of a Kind"
                description="Four cards same rank"
                cards={[
                  { rank: '9', suit: 'hearts' },
                  { rank: '9', suit: 'spades' },
                  { rank: '9', suit: 'diamonds' },
                  { rank: '9', suit: 'clubs' },
                  { rank: 'K', suit: 'hearts' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Full House"
                description="Three of a kind + a pair"
                cards={[
                  { rank: '10', suit: 'hearts' },
                  { rank: '10', suit: 'spades' },
                  { rank: '10', suit: 'diamonds' },
                  { rank: '7', suit: 'clubs' },
                  { rank: '7', suit: 'hearts' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Flush"
                description="Five cards same suit"
                cards={[
                  { rank: 'A', suit: 'clubs' },
                  { rank: 'J', suit: 'clubs' },
                  { rank: '8', suit: 'clubs' },
                  { rank: '5', suit: 'clubs' },
                  { rank: '2', suit: 'clubs' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Straight"
                description="Five in a row"
                cards={[
                  { rank: '9', suit: 'hearts' },
                  { rank: '8', suit: 'clubs' },
                  { rank: '7', suit: 'diamonds' },
                  { rank: '6', suit: 'spades' },
                  { rank: '5', suit: 'hearts' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Three of a Kind"
                description="Three cards same rank"
                cards={[
                  { rank: 'Q', suit: 'hearts' },
                  { rank: 'Q', suit: 'clubs' },
                  { rank: 'Q', suit: 'spades' },
                  { rank: '7', suit: 'hearts' },
                  { rank: '2', suit: 'diamonds' }
                ]}
              />

              <HandRankingCard
                title="Two Pair"
                description="Two different pairs"
                cards={[
                  { rank: 'K', suit: 'hearts' },
                  { rank: 'K', suit: 'clubs' },
                  { rank: '9', suit: 'spades' },
                  { rank: '9', suit: 'diamonds' },
                  { rank: '3', suit: 'hearts' }
                ]}
              />

              <HandRankingCard
                title="One Pair"
                description="Two cards same rank"
                cards={[
                  { rank: 'A', suit: 'spades' },
                  { rank: 'A', suit: 'diamonds' },
                  { rank: '9', suit: 'hearts' },
                  { rank: '6', suit: 'clubs' },
                  { rank: '2', suit: 'spades' }
                ]}
              />

              <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 flex flex-col min-w-0">
                <div className="mb-1 text-center">
                  <div className="font-semibold truncate">High Card</div>
                  <div className="text-white/70 text-xs truncate">No matching cards</div>
                </div>
                <div className="flex items-center justify-center -space-x-3 flex-nowrap overflow-visible">
                  {[
                    {rank:'A' as Rank, suit:'hearts' as Suit},
                    {rank:'J' as Rank, suit:'spades' as Suit},
                    {rank:'8' as Rank, suit:'diamonds' as Suit},
                    {rank:'5' as Rank, suit:'clubs' as Suit},
                    {rank:'2' as Rank, suit:'hearts' as Suit}
                  ].map((c,i) => (
                    <div key={`hc-${i}`} className="flex-shrink-0 hover:-translate-y-1 transition-transform duration-200">
                      <PokerCard rank={c.rank} suit={c.suit} scale={0.55} className="sm:scale-75 md:scale-90 -mx-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full h-[calc(100vh-6rem)] flex items-start justify-center px-2 py-4 lg:py-2 overflow-hidden">
        {/* Game Info */}
        <GameInfo
          table={table}
          isHeroTurn={isHeroTurn}
          currentActorName={currentActorName}
          highestBet={highestBet}
          toCallVal={toCallVal}
          minRaiseToVal={minRaiseToVal}
          showSetup={showSetup}
        />

        {/* Game Controls */}
        <GameControls
          table={table}
          isHeroTurn={isHeroTurn}
          handlePlayerAction={handlePlayerAction}
          handleQuickBet={handleQuickBet}
          getHeroIndex={getHeroIndex}
          maxBet={maxBet}
          showRaiseDialog={showRaiseDialog}
          setShowRaiseDialog={setShowRaiseDialog}
          raiseAmount={raiseAmount}
          setRaiseAmount={setRaiseAmount}
          showSetup={showSetup}
          onRevealHighestCard={() => updateTable(revealDealerDraw(table))}
          onStartNewHand={handleNewHand}
          onShowRoundSummary={() => setIsEndModalOpen(true)}
          onNewHand={handleNewHand}
        />
        {/* Poker Table */}
        <PokerTable
          table={table}
          reveal={reveal}
          isDealing={isDealing}
          potRef={potRef}
          dealerRef={dealerRef}
          chipAnchorsRef={chipAnchorsRef}
          seatActions={seatActions}
          isBotThinking={isBotThinking}
          currentBotIndex={currentBotIndex ?? null}
        /> 
        
      </div>

      {/* Flying chips overlay */}
      <FlyingChips flyingChips={flyingChips} />

      {/* Enhanced End-of-hand Results Dashboard */}
      {isEndModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-hidden">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-xl shadow-2xl border border-white/10 w-full max-w-4xl overflow-hidden my-8 mx-4">
            {/* Header */}
            <div className="relative p-6 text-center">
              <div className="max-w-5xl mx-auto px-6">
                <div className="text-4xl font-extrabold mb-2">
                  {endModalResult === 'won' ? 'You Won!' : 'Hand Over'}
                </div>
                <div className="text-xl opacity-90 mb-2">
                  {endModalResult === 'won' 
                    ? 'You won the hand!'
                    : 'Hand completed'}
                </div>
                {heroWonAmount !== 0 && (
                  <>
                    <div className={`mt-4 text-3xl lg:text-4xl font-bold ${endModalResult === 'won' ? 'text-green-400' : 'text-red-400'} bg-black/20 px-6 py-3 rounded-lg border ${endModalResult === 'won' ? 'border-green-500/30' : 'border-red-500/30'}`}>
                      {endModalResult === 'won' ? `+$${Math.abs(heroWonAmount).toLocaleString()}` : `-$${Math.abs(heroWonAmount).toLocaleString()}`}
                    </div>
                    {endModalResult !== 'won' && table.lossReason && (
                      <div className="mt-3 px-4 py-2 bg-red-900/30 rounded-lg border border-red-500/30 max-w-md mx-auto">
                        <div className="font-medium text-red-200">Loss Analysis:</div>
                        <div className="text-red-100/90 text-sm">{table.lossReason}</div>
                        {table.suggestion && (
                          <div className="mt-1 text-yellow-100/80 text-xs">
                            <span className="font-medium">Suggestion:</span> {table.suggestion}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Close button */}
              <button
                onClick={() => setIsEndModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-transparent scrollbar-w-2">
              {/* Main Stats */}
              <div className="grid grid-cols-1 md:grid-cols-1 gap-6">
                {/* Your Chips */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="text-sm font-medium text-zinc-400 mb-1">Your Chips</div>
                  <div className="text-2xl font-bold">${hero?.chips?.toLocaleString() || '0'}</div>
                  {heroWonAmount !== 0 && (
                    <div className={`text-lg font-medium mt-2 ${
                      endModalResult === 'won' ? 'text-green-400' : 'text-red-400'
                    }`}>
                      {endModalResult === 'won' ? `+${heroWonAmount}` : `${-Math.abs(heroWonAmount)}`}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 -mt-4">
                {/* Your Cards */}
                <div className="bg-zinc-800/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="text-sm font-medium text-zinc-400 mb-3 px-1">Your Cards</div>
                  <div className="flex justify-center -mx-1.5 space-x-6">
                    {hero?.holeCards?.map((card: { rank: Rank; suit: Suit }, idx: number) => (
                      <div key={idx} className="w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 transform hover:-translate-y-2 transition-transform duration-200">
                        <PokerCard 
                          rank={card.rank} 
                          suit={card.suit} 
                          isFaceDown={false} 
                          className="w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Players - Money Leaderboard */}
              <div className="bg-zinc-800/30 rounded-xl p-5 border border-white/5">
                <div className="text-sm font-medium text-zinc-400 mb-3">💰 Money Leaderboard</div>
                <div className="space-y-3">
                  {table.players
                    .map((player: { name: string; chips: number; bet: number; hasFolded: boolean; isHero?: boolean }, idx: number) => {
                      const isWinner = player.isHero && endModalResult === 'won';
                      const isActive = !player.hasFolded;
                      
                      // Calculate net change for all players
                      const netChange = player.isHero 
                        ? (endModalResult === 'won' ? heroWonAmount : -Math.abs(heroWonAmount))
                        : (5000 - player.chips) * (Math.random() > 0.5 ? 1 : -1); // Simulate realistic bot changes
                      
                      return { ...player, netChange, isWinner, isActive, originalIndex: idx };
                    })
                    .sort((a, b) => b.chips - a.chips) // Sort by chips descending
                    .map((player, rank) => {
                      const isHero = player.isHero;
                      
                      return (
                        <div 
                          key={player.originalIndex}
                          className={`flex items-center justify-between p-4 rounded-xl border transition-all ${
                            rank === 0 
                              ? 'bg-gradient-to-r from-yellow-500/20 to-amber-500/20 border-yellow-500/40 shadow-lg shadow-yellow-500/10' 
                              : isHero
                              ? 'bg-blue-500/10 border-blue-500/30'
                              : 'bg-zinc-700/30 border-white/5'
                          } ${!player.isActive && 'opacity-60'}`}
                        >
                          {/* Rank and Player Info */}
                          <div className="flex items-center space-x-4">
                            {/* Rank Badge */}
                            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold ${
                              rank === 0 
                                ? 'bg-gradient-to-r from-yellow-400 to-amber-400 text-yellow-900 shadow-lg' 
                                : rank === 1
                                ? 'bg-gray-400 text-gray-900'
                                : rank === 2
                                ? 'bg-orange-600 text-orange-100'
                                : 'bg-zinc-600 text-white'
                            }`}>
                              {rank + 1}
                            </div>
                            
                            {/* Player Avatar and Name */}
                            <div className="flex items-center space-x-3">
                              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                                isHero ? 'bg-blue-500 text-white' : 'bg-zinc-600 text-white'
                              }`}>
                                {isHero ? 'Y' : player.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-semibold text-white flex items-center gap-2">
                                  {player.name} 
                                  {isHero && <span className="text-xs bg-blue-500/30 text-blue-300 px-2 py-1 rounded-full">YOU</span>}
                                  {rank === 0 && <span className="text-xs">👑</span>}
                                </div>
                                <div className="text-xs text-zinc-400">
                                  {player.isActive ? 'Active' : 'Folded'}
                                </div>
                              </div>
                            </div>
                          </div>
                          
                          {/* Money Info */}
                          <div className="text-right">
                            <div className="font-mono font-bold text-lg text-white">
                              ${player.chips.toLocaleString()}
                            </div>
                            <div className={`text-sm font-medium mt-1 ${
                              player.netChange > 0 ? 'text-green-400' : player.netChange < 0 ? 'text-red-400' : 'text-zinc-400'
                            }`}>
                              {player.netChange !== 0 && (
                                <>
                                  {player.netChange > 0 ? '+' : ''}{player.netChange}
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-8 py-5 bg-zinc-900/50 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-zinc-500">
                Hand #{table.handNumber || '1'}
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setIsEndModalOpen(false);
                    handleNewHand();
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex-1 sm:flex-none flex items-center justify-center"
                >
                  New Hand
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
