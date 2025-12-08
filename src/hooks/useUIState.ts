import React from 'react';
import type { TableState } from '../types/table';

export interface SeatAction {
  [playerId: string]: string;
}

export interface FlyingChip {
  id: string;
  colorClass: string;
  left: number;
  top: number;
  toLeft: number;
  toTop: number;
}

export const useUIState = (table: TableState) => {
  const [isHandsOpen, setIsHandsOpen] = React.useState(false);
  const [isLogsOpen, setIsLogsOpen] = React.useState(false);
  const [showRaiseDialog, setShowRaiseDialog] = React.useState(false);
  const [raiseAmount, setRaiseAmount] = React.useState(0);
  const [reveal, setReveal] = React.useState(false);
  const [isDealing, setIsDealing] = React.useState(false);
  
  // End-of-hand modal
  const [heroWonAmount, setHeroWonAmount] = React.useState(0);
  const [isEndModalOpen, setIsEndModalOpen] = React.useState(false);
  const [endModalResult, setEndModalResult] = React.useState<'won' | 'lost' | null>(null);
  const lastModalHandRef = React.useRef<number>(-1);
  
  // UI refs
  const chipAnchorsRef = React.useRef<Record<string, HTMLDivElement | null>>({});
  const potRef = React.useRef<HTMLDivElement | null>(null);
  const dealerRef = React.useRef<HTMLDivElement | null>(null);
  
  // Flying chips animation
  const [flyingChips, setFlyingChips] = React.useState<FlyingChip[]>([]);
  const prevPotRef = React.useRef<number>(0);
  
  // Seat actions
  const [seatActions, setSeatActions] = React.useState<SeatAction>({});

  // Show end-of-hand modal at Showdown once per hand
  React.useEffect(() => {
    if (table.stage !== 'Showdown') return;
    if (lastModalHandRef.current === table.handNumber) return;
    
    // Try to find the latest winner in the actionLog
    let heroWon = false;
    if (table.actionLog && table.actionLog.length > 0) {
      for (let i = table.actionLog.length - 1; i >= 0; i -= 1) {
        const msg = table.actionLog[i].message || '';
        const m = msg.match(/^(.*?)\s+wins the pot/i);
        if (m) {
          const name = m[1];
          heroWon = (name === 'You');
          break;
        }
      }
    }
    const result = heroWon ? 'won' : 'lost';
    setEndModalResult(result);
    const winAmount = Math.abs(table.pot || 0);
    setHeroWonAmount(heroWon ? winAmount : -winAmount);
    setIsEndModalOpen(true);
    lastModalHandRef.current = table.handNumber;
  }, [table.stage, table.handNumber, table.actionLog, table.pot]);

  // Mini action bubbles near players: derive from last actionLog
  React.useEffect(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return;
    const last = table.actionLog[table.actionLog.length - 1];
    const msg = last.message;
    
    const match = msg.match(/^(.*?)\s+(raised to|called|checked|folded)(?:\s+([0-9]+))?/i);
    if (!match) return;
    const [, name, action, amount] = match;
    const player = table?.players?.find((p) => (p.isHero ? 'You' : p.name) === name);
    if (!player) return;
    
    let text = '';
    if (action.toLowerCase().startsWith('raised')) text = amount ? `Raise to ${amount}` : 'Raise';
    else if (action.toLowerCase() === 'called') text = amount ? `Call ${amount}` : 'Call';
    else if (action.toLowerCase() === 'checked') text = 'Check';
    else if (action.toLowerCase() === 'folded') text = 'Fold';

    if (!text) return;
    setSeatActions(prev => ({ ...prev, [player.id]: text }));
    const tid = setTimeout(() => {
      setSeatActions(prev => {
        const cp = { ...prev };
        delete cp[player.id];
        return cp;
      });
    }, 1800);
    return () => clearTimeout(tid);
  }, [table.actionLog, table.players]);

  return {
    // Modal states
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
    
    // Game state
    reveal,
    setReveal,
    isDealing,
    setIsDealing,
    
    // Refs
    chipAnchorsRef,
    potRef,
    dealerRef,
    
    // Animations
    flyingChips,
    setFlyingChips,
    prevPotRef,
    
    // Actions
    seatActions,
  };
};
