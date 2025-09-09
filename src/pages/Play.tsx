// ActionLogEntry is used in the type definition below
import { Toaster, toast } from 'react-hot-toast';
import {
  createInitialTable,
  getHeroIndex,
  heroCall,
  heroFold,
  heroRaiseTo,
  maxBet,
  performDealerDraw,
  prepareNewHandWithoutDealing,
  revealDealerDraw,
  startNewHand
} from '../lib/tableEngine';

import ChipLegend from '../components/ChipLegend';
import LogsModal from '../components/LogsModal';
import Dealer from '../components/Dealer';
import Navbar from '../components/Navbar';
import PlayerSeat from '../components/PlayerSeat';
import PokerCard from '../components/PokerCard';
import React from 'react';
import { createChipStack } from '../utils/chipUtils';
import type { Player, TableState } from '../types/table';

// Game configuration
const GAME_CONFIG = {
  smallBlind: 25,
  bigBlind: 50,
  numBots: 2, // 2 bots + 1 human = 3 players total
  startingChips: 5000, // $5,000 starting stack
  chipDenominations: [1, 5, 25, 100, 500, 1000] as const,
};

const Play: React.FC = () => {
  const [isLogsOpen, setIsLogsOpen] = React.useState(false);
  const [lastToastTime, setLastToastTime] = React.useState<number>(0);
  // Try to hydrate from localStorage
  const savedTable = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_table') : null;

  const [table, setTable] = React.useState(() => {
    // Create initial chip stack for each player
    const initialChipStack = createChipStack(GAME_CONFIG.startingChips);
    
    if (savedTable) {
      try {
        const parsed = JSON.parse(savedTable);
        return parsed;
      } catch (e) {
        console.warn('Failed to parse saved table, starting new table', e);
      }
    }

    return createInitialTable({
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      numBots: GAME_CONFIG.numBots,
      startingChips: GAME_CONFIG.startingChips,
      initialChipStack
    });
  });
  const [reveal, setReveal] = React.useState(false);
  const [isDealing] = React.useState(false);

  // Perform dealer draw on mount only for brand new tables (no saved state)
  React.useEffect(() => {
    if (!savedTable) {
      setTable((prev: TableState) => performDealerDraw(prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist table to localStorage on change
  React.useEffect(() => {
    try {
      localStorage.setItem('poker_trainer_table', JSON.stringify(table));
    } catch (e) {
      console.warn('Failed to save table state', e);
    }
  }, [table]);

  // Show toast for important events
  React.useEffect(() => {
    // Only show toast for new important events when logs modal is closed
    if (!isLogsOpen && table.actionLog.length > 0) {
      const lastEntry = table.actionLog[table.actionLog.length - 1];
      const isImportant = lastEntry.message.includes('wins') || 
                         lastEntry.message.includes('Showdown') ||
                         lastEntry.message.includes('New hand');
      
      if (isImportant && new Date(lastEntry.time).getTime() > lastToastTime) {
        toast(lastEntry.message, {
          duration: 3000,
          position: 'bottom-right',
          className: 'bg-neutral-800 text-white px-4 py-2 rounded-lg shadow-lg',
        });
        setLastToastTime(new Date().getTime());
      }
    }
  }, [table.actionLog, isLogsOpen, lastToastTime]);

  const handleNewHand = () => {
    setReveal(false);
    setTable((prev: TableState) => {
      const newTable = prepareNewHandWithoutDealing(prev);
      
      // Log the start of a new hand with blind information
      const newLog = [
        { message: 'New hand started', time: new Date().toLocaleTimeString() },
        { message: `Blinds: $${GAME_CONFIG.smallBlind}/$${GAME_CONFIG.bigBlind}`, time: new Date().toLocaleTimeString() }
      ];
      
      const updatedTable = {
        ...newTable,
        actionLog: [...newTable.actionLog, ...newLog]
      };
      
      // Start the hand with the new table state
      const handStarted = startNewHand(updatedTable);
      
      // Process the first action if it's a bot's turn
      const heroIdx = getHeroIndex(handStarted);
      if (handStarted.currentPlayerIndex !== heroIdx) {
        // This will process bot actions until it's the hero's turn
        return handStarted;
      }
      
      return handStarted;
    });
  };

  const handlePlayerAction = (action: 'Fold' | 'Call' | 'Raise') => {
    setTable(prev => {
      // Handle the player's action based on the button clicked
      if (action === 'Fold') {
        const newState = heroFold(prev);
        if (newState.stage === 'Showdown') {
          setReveal(true);
        }
        return newState;
      }
      
      if (action === 'Call') {
        const newState = heroCall(prev);
        if (newState.stage === 'Showdown') {
          setReveal(true);
        }
        return newState;
      }
      
      if (action === 'Raise') {
        // For simplicity, raise to 3x the big blind or pot size, whichever is smaller
        const hero = prev.players[getHeroIndex(prev)];
        const raiseTo = Math.min(
          prev.pot + prev.bigBlind * 3,
          hero.chips + hero.bet
        );
        const newState = heroRaiseTo(prev, raiseTo);
        if (newState.stage === 'Showdown') {
          setReveal(true);
        }
        return newState;
      }
      
      return prev;
    });
  };

  const { players, dealerIndex, smallBlindIndex, bigBlindIndex } = table;
  const bots = players.filter((p: Player) => !p.isHero);
  const botPositions = (() => {
    // Distribute bots: for 3 -> two left, one right; for 4 -> two left, two right
    switch (bots.length) {
      case 1:
        return ['right-2 top-1/2 -translate-y-1/2'];
      case 2:
        return ['left-2 top-1/2 -translate-y-1/2', 'right-2 top-1/2 -translate-y-1/2'];
      case 3:
        return ['left-2 bottom-24', 'left-2 top-1/2 -translate-y-1/2', 'right-2 top-1/2 -translate-y-1/2'];
      case 4:
        return ['left-2 bottom-24', 'left-2 top-1/2 -translate-y-1/2', 'right-2 top-1/2 -translate-y-1/2', 'right-2 bottom-24'];
      default:
        return ['left-2 bottom-24', 'left-2 top-1/2 -translate-y-1/2', 'right-2 top-1/2 -translate-y-1/2', 'right-2 bottom-24', 'left-1/2 top-2 -translate-x-1/2'];
    }
  })();

  // Note: animateDeal function was removed as it was not being used
  // and the card dealing animation is handled by the table engine

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      <Navbar 
        subtitle="Play with Bots" 
        onShuffle={handleNewHand} 
        actionLabel="New Hand" 
        onOpenLogs={() => setIsLogsOpen(true)}
      />
      
      {/* Toast notifications */}
      <Toaster />
      
      {/* Logs modal */}
      <LogsModal 
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        entries={table.actionLog}
        onClear={() => setTable((prev: TableState) => ({ ...prev, actionLog: [] }))}
      />

      <div className="relative w-full h-[calc(100vh-6rem)] flex items-center justify-center px-2 py-2 overflow-hidden">
        {/* Chip legend bottom left */}
        <div className="absolute left-2 bottom-2">
          <ChipLegend />
        </div>

        {/* Buttons card right */}
        <div className="absolute right-2 bottom-2 bg-gray-900/90 backdrop-blur-md rounded-xl p-3 border border-gray-600/50 shadow-xl">
          <h3 className="text-white font-bold text-center mb-2 text-sm uppercase tracking-wider">Controls</h3>
          
          {table.dealerDrawInProgress && !table.dealerDrawRevealed ? (
            <div className="flex justify-center">
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-md transition-colors shadow-md"
                onClick={() => setTable((prev: TableState) => revealDealerDraw(prev))}
              >
                Reveal highest card
              </button>
            </div>
          ) : table.dealerDrawInProgress && table.dealerDrawRevealed ? (
            <div className="flex justify-center">
              <button
                className="bg-green-600 hover:bg-green-500 text-white font-semibold px-6 py-2 rounded-md transition-colors shadow-md"
                onClick={handleNewHand}
              >
                Start Hand
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <button 
                  className={`font-semibold px-4 py-2 rounded-md flex-1 transition-colors shadow-md ${
                    table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown'
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-red-700 hover:bg-red-600 text-white'
                  }`}
                  onClick={() => handlePlayerAction('Fold')}
                  disabled={table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown'}
                >
                  Fold
                </button>
                <button 
                  className={`font-semibold px-4 py-2 rounded-md flex-1 transition-colors shadow-md ${
                    table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown'
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-blue-700 hover:bg-blue-600 text-white'
                  }`}
                  onClick={() => handlePlayerAction('Call')}
                  disabled={table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown'}
                >
                  {(() => {
                    const hero = table.players[getHeroIndex(table)];
                    const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                    if (toCall === 0) return 'Check';
                    if (toCall >= (hero?.chips || 0)) return `All-in $${hero?.chips}`;
                    return `Call $${toCall}`;
                  })()}
                </button>
              </div>
              <div className="flex">
                <button 
                  className={`font-semibold px-6 py-2 rounded-md w-full transition-colors shadow-md ${
                    table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown'
                      ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                      : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                  }`}
                  onClick={() => handlePlayerAction('Raise')}
                  disabled={table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown'}
                >
                  {(() => {
                    const hero = table.players[getHeroIndex(table)];
                    const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                    const minRaise = Math.max(table.bigBlind, maxBet(table) * 2 - (hero?.bet || 0));
                    if ((hero?.chips || 0) <= toCall) return 'All-in';
                    if (toCall > 0) return `Raise to $${minRaise}`;
                    return `Raise $${minRaise}`;
                  })()}
                </button>
              </div>
            </div>
          )}
          
          <div className="text-white/90 text-center text-sm mt-3 font-medium">
            <div className="bg-gray-800/80 py-1 px-2 rounded">
              <span className="text-yellow-400 ml-1">{table.stage}</span>
            </div>
          </div>
        </div>
        {/* Poker table - larger and perfectly centered */}
        <div className="relative w-[90vw] max-w-[1200px] h-[65vh] min-h-[500px]">
          {/* Dealer position - higher on the table */}
          <div className="absolute left-1/2 -translate-x-1/2 -top-12 z-10">
            <Dealer isDealing={isDealing} />
          </div>
          {/* Table mat with clean design */}
          <div className="absolute inset-0 bg-green-900/90 rounded-[40%] border-4 border-amber-100/20 shadow-xl overflow-hidden">
            {/* Felt texture with subtle pattern and gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-800/90 to-green-900/90">
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E")',
                }}
              />
            </div>
            
            {/* Main table area */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {/* Pot display - centered and more compact */}
              <div className="bg-black/80 text-white text-xl md:text-2xl font-bold px-6 py-2 rounded-full border border-amber-100/20 shadow-md z-10 mb-6">
                <span className="text-amber-100 font-mono">POT:</span> <span className="text-2xl md:text-3xl text-yellow-300 font-mono">${table.pot.toLocaleString()}</span>
              </div>
              
              {/* Card area - adjusted for better spacing */}
              <div className="relative w-full h-[60%] flex items-center justify-center px-4">
                {/* Card positions - evenly spaced */}
                <div className="flex justify-center items-center w-full max-w-4xl mx-auto">
                  <div className="grid grid-cols-5 gap-2 w-full px-4">
                    {[...Array(5)].map((_, i) => (
                      <div 
                        key={i} 
                        className={`relative w-full aspect-[0.7] rounded-lg ${
                          i < table.board.length 
                            ? 'bg-white shadow-lg transform hover:scale-105 hover:z-10 transition-transform duration-200' 
                            : 'bg-white/5 border-2 border-dashed border-white/20'
                        } flex items-center justify-center`}
                      >
                        {i < table.board.length ? (
                          <PokerCard 
                            suit={table.board[i].suit} 
                            rank={table.board[i].rank} 
                            scale={1.3}
                            className="w-full h-full"
                          />
                        ) : (
                          <span className="text-white/30 text-lg font-bold">{i+1}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              </div>
            </div>
          </div>
          


        {/* Hero bottom center */}
        {players.filter(p => p.isHero).map(p => (
          <div key={p.id} className="absolute left-1/2 bottom-2 -translate-x-1/2">
            <PlayerSeat
              player={p}
              isDealer={players.indexOf(p) === dealerIndex}
              isSmallBlind={players.indexOf(p) === smallBlindIndex}
              isBigBlind={players.indexOf(p) === bigBlindIndex}
              reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
              drawCard={table.dealerDrawCards[p.id]}
              showDrawCard={table.dealerDrawInProgress}
              isActive={players.indexOf(p) === table.currentPlayerIndex}
              position="bottom"
              gameStage={table.stage}
            />
          </div>
        ))}

        {/* Other players clockwise around table edges */}
        {bots.map((p: Player, i: number) => {
          const idx = players.indexOf(p);
          const cls = botPositions[i] || 'right-2 bottom-24';
          // Determine position based on class name
          let position: 'left' | 'right' | 'top' = 'left';
          if (cls.includes('right-')) position = 'right';
          else if (cls.includes('top-')) position = 'top';
          
          return (
            <div key={p.id} className={`absolute ${cls}`}>
              <PlayerSeat
                player={p}
                isDealer={idx === dealerIndex}
                isSmallBlind={idx === smallBlindIndex}
                isBigBlind={idx === bigBlindIndex}
                reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
                drawCard={table.dealerDrawCards[p.id]}
                showDrawCard={table.dealerDrawInProgress}
                isActive={idx === table.currentPlayerIndex}
                position={position}
                gameStage={table.stage}
              />
            </div>
          );
        })}

        
        
      </div>
    </div>
  );
};

export default Play;
