import type { Rank, Suit } from '../types/cards';
import { SUIT_COLOR_CLASS, SUIT_SYMBOL } from '../constants/cards';

import type { ActionLogEntry } from '../types/table';
import React from 'react';

type LogsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entries: ActionLogEntry[];
  onClear?: () => void;
  title?: string;
};

// Helper function to get player initial
const getPlayerInitial = (name: string) => name.charAt(0).toUpperCase();

// Helper function to get player color based on name
const getPlayerColor = (name: string) => {
  const colors = [
    'bg-blue-500', 'bg-green-500', 'bg-purple-500', 
    'bg-yellow-500', 'bg-pink-500', 'bg-indigo-500'
  ];
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % colors.length;
  return colors[index];
};

// Helper to parse card string into suit and rank
const parseCard = (cardString: string) => {
  if (!cardString) return null;
  const [rank, suit] = cardString.split(' of ');
  return { rank: rank as Rank, suit: suit?.toLowerCase() as Suit };
};

const LogsModal: React.FC<LogsModalProps> = ({ isOpen, onClose, entries, onClear, title = 'Hand History' }) => {
  const [activeTab, setActiveTab] = React.useState<'all' | 'showdown' | 'actions'>('all');
  const [selectedRound, setSelectedRound] = React.useState<number | null>(null);
  const entriesEndRef = React.useRef<HTMLDivElement>(null);

  // Group entries by rounds
  const groupByRounds = React.useMemo(() => {
    const rounds: { [key: number]: ActionLogEntry[] } = {};
    let currentRound = 1;
    
    entries.forEach(entry => {
      if (entry.message.includes('New hand')) {
        currentRound++;
        rounds[currentRound] = [];
      }
      if (!rounds[currentRound]) {
        rounds[currentRound] = [];
      }
      rounds[currentRound].push(entry);
    });
    
    return rounds;
  }, [entries]);

  const roundNumbers = Object.keys(groupByRounds).map(Number).sort((a, b) => b - a);
  const currentRoundEntries = selectedRound ? groupByRounds[selectedRound] || [] : entries;

  React.useEffect(() => {
    if (isOpen && entriesEndRef.current) {
      entriesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [isOpen, entries]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      
      <div className="relative z-10 w-full max-w-4xl bg-gradient-to-br from-neutral-900 to-neutral-800 text-white rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-gradient-to-r from-neutral-800/80 to-neutral-900/80">
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-amber-200 to-yellow-400 bg-clip-text text-transparent">
              {title}
            </h2>
            <p className="text-xs text-white/60 mt-1">{entries.length} total actions</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Round Tabs */}
            <div className="flex items-center space-x-1 bg-neutral-800/80 rounded-lg p-1 border border-white/10">
              <button
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  selectedRound === null 
                    ? 'bg-white/10 text-white' 
                    : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                }`}
                onClick={() => setSelectedRound(null)}
              >
                All Rounds
              </button>
              {roundNumbers.slice(0, 5).map((roundNum) => (
                <button
                  key={roundNum}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    selectedRound === roundNum 
                      ? 'bg-white/10 text-white' 
                      : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                  }`}
                  onClick={() => setSelectedRound(roundNum)}
                >
                  Hand #{roundNum}
                </button>
              ))}
              {roundNumbers.length > 5 && (
                <span className="px-2 text-xs text-white/40">+{roundNumbers.length - 5} more</span>
              )}
            </div>
            
            {/* Filter Tabs */}
            <div className="flex items-center space-x-1 bg-neutral-800/80 rounded-lg p-1 border border-white/10">
              {['all', 'showdown', 'actions'].map((tab) => (
                <button
                  key={tab}
                  className={`px-3 py-1 text-sm rounded-md capitalize transition-colors ${
                    activeTab === tab 
                      ? 'bg-white/10 text-white' 
                      : 'text-white/60 hover:text-white/90 hover:bg-white/5'
                  }`}
                  onClick={() => setActiveTab(tab as 'all' | 'showdown' | 'actions')}
                >
                  {tab}
                </button>
              ))}
            </div>
            
            <div className="flex items-center gap-2">
              {onClear && (
                <button
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm font-medium border border-white/20 flex items-center gap-1.5 transition-colors"
                  onClick={(e) => { e.stopPropagation(); onClear(); }}
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Clear
                </button>
              )}
              <button
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                onClick={(e) => { e.stopPropagation(); onClose(); }}
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[65vh] overflow-y-auto p-1">
          {currentRoundEntries.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-white/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-white/90 mb-1">
                {selectedRound ? `No actions in Hand #${selectedRound}` : 'No actions recorded yet'}
              </h3>
              <p className="text-white/60 text-sm max-w-md">
                {selectedRound ? 'This round may not have started yet.' : 'Game actions will appear here as they happen.'}
              </p>
            </div>
          ) : (
            <div className="space-y-3 p-3">
              {currentRoundEntries.map((entry, idx) => {
                // Skip if filtered
                if (activeTab === 'showdown' && !entry.message.includes('Showdown')) return null;
                if (activeTab === 'actions' && (entry.message.includes('Showdown') || entry.message.includes('wins'))) return null;
                
                const isImportant = entry.message.includes('wins') || entry.message.includes('Showdown');
                const isAction = ['folds', 'calls', 'raises', 'checks', 'bets'].some(action => 
                  entry.message.toLowerCase().includes(action)
                );
                
                // Extract player name if it's an action
                let playerName = '';
                let actionType = '';
                let actionAmount = '';
                
                if (isAction) {
                  const actionMatch = entry.message.match(/^(.*?) (folds|calls|raises|checks|bets|wins)/i);
                  if (actionMatch) {
                    playerName = actionMatch[1];
                    actionType = actionMatch[2].toLowerCase();
                    
                    // Extract amount if present
                    const amountMatch = entry.message.match(/\$([\d,]+)/);
                    if (amountMatch) {
                      actionAmount = amountMatch[0];
                    }
                  }
                }
                
                return (
                  <div 
                    key={`${entry.time}-${idx}`}
                    className={`relative group rounded-xl p-4 transition-all ${
                      isImportant 
                        ? 'bg-gradient-to-r from-amber-900/30 to-amber-800/20 border-l-4 border-amber-500/80' 
                        : isAction 
                          ? 'bg-white/3 hover:bg-white/5 border-l-2 border-white/10'
                          : 'bg-white/2 hover:bg-white/5 border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Player avatar */}
                      {playerName && (
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-bold ${getPlayerColor(playerName)}`}>
                          {getPlayerInitial(playerName)}
                        </div>
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            {playerName && (
                              <span className="font-medium text-white/90">{playerName}</span>
                            )}
                            {actionType && (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                actionType === 'raises' || actionType === 'bets' ? 'bg-blue-500/20 text-blue-300' :
                                actionType === 'calls' ? 'bg-green-500/20 text-green-300' :
                                actionType === 'folds' ? 'bg-red-500/20 text-red-300' :
                                'bg-white/10 text-white/70'
                              }`}>
                                {actionType}
                                {actionAmount && (
                                  <span className="ml-1 font-semibold">{actionAmount}</span>
                                )}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-white/40 font-mono">{entry.time}</span>
                        </div>
                        
                        <div className={`mt-1 text-sm ${
                          isImportant ? 'text-amber-100' : 'text-white/80'
                        }`}>
                          {entry.message}
                        </div>
                        
                        {/* Show cards if available */}
                        {entry.allCards && entry.allCards.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-white/5">
                            <div className="flex flex-wrap gap-2">
                              {entry.allCards.map((card, cardIdx) => {
                                const cardObj = parseCard(card.card);
                                if (!cardObj) return null;
                                
                                return (
                                  <div 
                                    key={cardIdx}
                                    className={`relative w-8 h-12 rounded-md flex flex-col items-center justify-center text-xs font-bold ${
                                      SUIT_COLOR_CLASS[cardObj.suit as Suit]
                                    } bg-white/10 border ${
                                      card.player === entry.winner 
                                        ? 'border-2 border-yellow-400 shadow-lg shadow-yellow-500/20' 
                                        : 'border-white/20'
                                    }`}
                                    title={`${card.rank} of ${card.suit} (${card.player})`}
                                  >
                                    <div className="absolute top-0.5 left-0.5 text-[8px] opacity-70">
                                      {card.rank}
                                    </div>
                                    <div className="text-base">
                                      {SUIT_SYMBOL[cardObj.suit as Suit]}
                                    </div>
                                    <div className="absolute bottom-0.5 right-0.5 text-[8px] opacity-70 rotate-180">
                                      {card.rank}
                                    </div>
                                    {card.player === entry.winner && (
                                      <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full bg-yellow-400 flex items-center justify-center">
                                        <svg className="w-2.5 h-2.5 text-yellow-900" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Show hand strength if available */}
                        {entry.winner && (
                          <div className="mt-2 text-xs text-white/60">
                            {entry.winningCard && (
                              <span className="inline-flex items-center">
                                <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5"></span>
                                {entry.winner} wins with {entry.winningCard}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={entriesEndRef} />
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="px-4 py-3 border-t border-white/5 bg-neutral-900/50 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="flex items-center text-xs text-white/50">
              <span className="w-2 h-2 rounded-full bg-green-400 mr-1.5"></span>
              <span>Winner</span>
            </div>
            <div className="flex items-center text-xs text-white/50">
              <span className="w-2 h-2 rounded-full bg-blue-400 mr-1.5"></span>
              <span>Raise/Bet</span>
            </div>
            <div className="flex items-center text-xs text-white/50">
              <span className="w-2 h-2 rounded-full bg-red-400 mr-1.5"></span>
              <span>Fold</span>
            </div>
          </div>
          <div className="text-xs text-white/40">
            {currentRoundEntries.length} {currentRoundEntries.length === 1 ? 'entry' : 'entries'}
            {selectedRound && ` in Hand #${selectedRound}`}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LogsModal;
