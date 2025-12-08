import type { Difficulty, TableState } from '../types/table';
import {
  createInitialTable,
  performDealerDraw,
  revealDealerDraw as revealDealerDrawEngine,
  startNewHand,
} from '../lib/tableEngine';

import React from 'react';
import { toast } from 'react-toastify';

const GAME_CONFIG = {
  smallBlind: 25,
  bigBlind: 50,
  numBots: 2,
  startingChips: 5000,
  chipDenominations: [1, 5, 25, 100, 500, 1000] as const,
};

export const useGameState = () => {
  const [table, setTable] = React.useState<TableState>(() => {
    // Read config overrides (difficulty)
    let cfgDifficulty: Difficulty = 'Medium';
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.difficulty === 'string') cfgDifficulty = parsed.difficulty as Difficulty;
        }
      }
    } catch { /* ignore malformed config */ }

    // Try to hydrate from localStorage
    const savedTable = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_table') : null;
    if (savedTable) {
      try {
        const parsed = JSON.parse(savedTable);
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.players)) {
          return parsed;
        } else {
          console.warn('Saved table has invalid structure, starting new table');
        }
      } catch (e) {
        console.warn('Failed to parse saved table, starting new table', e);
      }
    }

    // Initialize a fresh local engine table
    const numBots = (() => {
      try {
        const cfg = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_config') : null;
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.numBots === 'number') return parsed.numBots;
        }
      } catch { /* ignore */ }
      return GAME_CONFIG.numBots;
    })();
    
    const startingChips = (() => {
      try {
        const cfg = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_config') : null;
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.startingChips === 'number') return parsed.startingChips;
        }
      } catch { /* ignore */ }
      return GAME_CONFIG.startingChips;
    })();

    const t = createInitialTable({
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      numBots,
      startingChips,
      initialChipStack: { 1: 5, 5: 5, 25: 5, 100: 5, 500: 5, 1000: 5 },
      difficulty: cfgDifficulty,
    });
    return { ...t, lossReason: '', suggestion: '' };
  });

  const isEndingRef = React.useRef<boolean>(false);

  // Persist table to localStorage on change
  React.useEffect(() => {
    try {
      if (!isEndingRef.current && table && Array.isArray(table.players) && table.players.length > 0) {
        localStorage.setItem('poker_trainer_table', JSON.stringify(table));
      }
    } catch (e) {
      console.warn('Failed to save table state', e);
    }
  }, [table]);

  // Show toast for EVERY new log entry
  React.useEffect(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return;
    const lastIndex = table.actionLog.length - 1;
    const lastEntry = table.actionLog[lastIndex];

    if (!lastEntry.toastShown) {
      toast(lastEntry.message, {
        autoClose: 3000,
        position: 'top-center',
        theme: 'dark',
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
      });
      // Mark the entry as shown to prevent duplicate toasts
      setTable((prev: TableState) => {
        const idx = prev.actionLog.length - 1;
        if (idx < 0) return prev;
        const updated = prev.actionLog.map((e, i) =>
          i === idx ? { ...e, toastShown: true } : e
        );
        return { ...prev, actionLog: updated } as TableState;
      });
    }
  }, [table.actionLog]);

  // Track hero wins in localStorage
  React.useEffect(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return;
    const last = table.actionLog[table.actionLog.length - 1];
    if (/^You\s+wins the pot\s+\$/.test(last.message)) {
      try {
        const key = 'poker_trainer_play_wins';
        const prev = Number(localStorage.getItem(key) || '0') || 0;
        localStorage.setItem(key, String(prev + 1));
      } catch { /* ignore */ }
    }
  }, [table.actionLog]);

  // When entering DealerDraw, auto-draw exactly ONE card per player if not already drawn
  React.useEffect(() => {
    if (table?.dealerDrawInProgress && !table?.dealerDrawRevealed && table?.players?.length) {
      const cards = table.dealerDrawCards || {};
      const needsCards = Object.keys(cards).length === 0 || Object.values(cards).some((c) => c == null);
      if (needsCards) {
        setTable((prev: TableState) => performDealerDraw(prev));
      }
    }
  }, [table?.dealerDrawInProgress, table?.dealerDrawRevealed, table?.dealerDrawCards, table?.players?.length]);

  // After revealing highest card, show the cards and toast, then auto-start the hand after 5 seconds
  React.useEffect(() => {
    if (table.dealerDrawInProgress && table.dealerDrawRevealed) {
      // Toast winner and dealer seat
      try {
        const winnerIdx = table.dealingState?.highCardPlayerIndex ?? table.dealerIndex;
        if (winnerIdx != null && winnerIdx >= 0) {
          const winner = table.players?.[winnerIdx];
          const winnerCard = table.dealerDrawCards[winner.id];
          if (winner && winnerCard) {
            toast.success(`${winner.name} wins the dealer button (high card ${winnerCard.rank} of ${winnerCard.suit})`);
          } else if (winner) {
            toast.success(`${winner.name} wins the dealer button (high card)`);
          }
        }
      } catch (e) {
        try { console.warn('Dealer draw toast failed', e); } catch { /* noop */ }
      }
      const t = setTimeout(() => {
        setTable((prev: TableState) => startNewHand(prev));
      }, 1500);
      return () => clearTimeout(t);
    }
  }, [table.dealerDrawInProgress, table.dealerDrawRevealed, table.dealerDrawCards, table.players, table.dealerIndex, table.dealingState?.highCardPlayerIndex]);

  const updateTable = React.useCallback((newTable: TableState) => {
    setTable(newTable);
  }, []);

  const revealDealerDraw = React.useCallback((prev: TableState) => {
    return revealDealerDrawEngine(prev);
  }, []);

  const endGame = React.useCallback(() => {
    isEndingRef.current = true;
    // Append a log entry in the in-memory state for UX continuity
    setTable((prev: TableState) => ({
      ...prev,
      actionLog: [
        ...prev.actionLog,
        {
          message: 'Game ended — unfinished',
          time: new Date().toLocaleTimeString(),
          isImportant: true,
          status: 'unfinished'
        }
      ]
    }));

    // Hard clear any persisted table/cache
    try {
      localStorage.removeItem('poker_trainer_table');
      localStorage.removeItem('poker_trainer_table_id');
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('poker_trainer_table')) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }
  }, []);

  return {
    table,
    updateTable,
    revealDealerDraw,
    endGame,
  };
};
