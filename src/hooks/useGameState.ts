import type { Difficulty, TableState } from '../types/table';
import {
  createInitialTable,
  performDealerDraw,
  revealDealerDraw as revealDealerDrawEngine,
} from '../lib/tableEngine';

import React from 'react';

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

  // After revealing highest card, show the cards, but wait for user to click "Start hand now"
  React.useEffect(() => {
    if (table.dealerDrawRevealed && table.dealingState?.highCardPlayerIndex !== null && table.dealingState.highCardPlayerIndex !== undefined) {
      const winnerIndex = table.dealingState.highCardPlayerIndex;
      const winner = table.players[winnerIndex];
      const winnerCard = winner?.holeCards?.[0];
      if (winner && winnerCard) {
        // Log winner and dealer seat to console instead of toast
        console.log(`${winner.name} wins the dealer button (high card ${winnerCard.rank} of ${winnerCard.suit})`);
      } else if (winner) {
        console.log(`${winner.name} wins the dealer button (high card)`);
      }
      // const t = setTimeout(() => {
      //   setTable((prev: TableState) => startNewHand(prev));
      // }, 1500);
      // return () => clearTimeout(t);
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
