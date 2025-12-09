import type { Player, TableState } from '../types/table';
import { heroCall, heroFold, heroRaiseTo } from '../lib/tableEngine';

import React from 'react';

export const usePlayerActions = (table: TableState, updateTable: (table: TableState) => void) => {
  const getHeroIndex = React.useCallback((t: TableState) => {
    return t?.players?.findIndex(p => p.isHero) ?? -1;
  }, []);

  const maxBet = React.useCallback((t: TableState) => {
    const byField = typeof t.currentBet === 'number' ? t.currentBet : 0;
    const byPlayers = t?.players?.length ? Math.max(...t.players.map(p => p.bet || 0)) : 0;
    return Math.max(byField, byPlayers);
  }, []);

  const computeQuickRaiseTo = React.useCallback((kind: 'half' | 'twoThirds' | 'pot' | 'allin' | 'min') => {
    const hero = table.players?.find((p: Player) => p.isHero);
    if (!hero) return 0;
    const highest = maxBet(table);
    const toCall = Math.max(0, highest - (hero.bet || 0));
    const pot = table.pot || 0;
    const bb = table.bigBlind || 0;

    if (kind === 'allin') return (hero.chips || 0) + (hero.bet || 0);

    let target = 0;
    if (kind === 'half') target = Math.round(0.5 * (pot + toCall));
    if (kind === 'twoThirds') target = Math.round((2 / 3) * (pot + toCall));
    if (kind === 'pot') target = pot + toCall;
    if (kind === 'min') target = Math.max(bb, highest + bb - (hero.bet || 0));

    const minRaiseTo = Math.max(bb, highest + bb);
    let raiseTo = (hero.bet || 0) + Math.max(toCall, target);
    raiseTo = Math.max(raiseTo, minRaiseTo);
    const cap = (hero.chips || 0) + (hero.bet || 0);
    raiseTo = Math.min(raiseTo, cap);
    return raiseTo;
  }, [table, maxBet]);

  const handlePlayerAction = React.useCallback((action: 'Fold' | 'Call' | 'Raise', amount?: number) => {
    const hero = table.players?.find((p: Player) => p.isHero);
    if (!hero) return;
    
    if (table.stage === 'Showdown' || table.players?.indexOf(hero) !== table.currentPlayerIndex) return;

    try {
      let next: TableState = table;
      if (action === 'Fold') {
        next = heroFold(table);
      } else if (action === 'Call') {
        next = heroCall(table);
      } else if (action === 'Raise') {
        const highest = maxBet(table);
        const minRaise = Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
        const raiseTo = amount !== undefined ? amount : minRaise;
        next = heroRaiseTo(table, Math.max(raiseTo, minRaise));
      }
      updateTable(next);
    } catch (e) {
      console.error('Failed to process player action locally', e);
    }
  }, [table, maxBet, updateTable]);

  const handleQuickBet = React.useCallback((kind: 'half' | 'twoThirds' | 'pot' | 'allin' | 'min') => {
    try {
      const val = computeQuickRaiseTo(kind);
      if (!val) return;
      handlePlayerAction('Raise', val);
    } catch (e) {
      console.error('Quick bet failed', e);
    }
  }, [computeQuickRaiseTo, handlePlayerAction]);

  // Derived info for UI
  const heroIdx = getHeroIndex(table);
  const hero = table.players?.[heroIdx];
  const highestBet = maxBet(table);
  // Required to call this street
  const requiredToCall = Math.max(0, highestBet - (hero?.bet || 0));
  // For UI, cap to hero's stack so when opponent is all-in bigger, it displays hero's all-in amount
  const toCallVal = Math.min(requiredToCall, hero?.chips || 0);
  const minRaiseToVal = Math.max((table.bigBlind || 0), (highestBet || 0) + (table.bigBlind || 0));
  const isHeroTurn = heroIdx >= 0 && table.currentPlayerIndex === heroIdx && table.stage !== 'Showdown';

  return {
    handlePlayerAction,
    handleQuickBet,
    computeQuickRaiseTo,
    heroIdx,
    hero,
    highestBet,
    toCallVal,
    minRaiseToVal,
    isHeroTurn,
  };
};
