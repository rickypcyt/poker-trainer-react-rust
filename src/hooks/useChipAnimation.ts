import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';
import type { Player, TableState } from '../types/table';

import type { FlyingChip } from './useUIState';
import React from 'react';

export const useChipAnimation = (
  table: TableState,
  chipAnchorsRef: React.RefObject<Record<string, HTMLDivElement | null>>,
  dealerRef: React.RefObject<HTMLDivElement | null>,
  setFlyingChips: React.Dispatch<React.SetStateAction<FlyingChip[]>>
) => {
  const prevPotRef = React.useRef<number>(0);

  // Animate chips to pot when pot increases
  React.useEffect(() => {
    const prevPot = prevPotRef.current;
    if ((table.pot || 0) > prevPot && table.actionLog && table.actionLog.length > 0) {
      const last = table.actionLog[table.actionLog.length - 1];
      
      // Identify the actor: raised or called
      let actorName: string | null = null;
      if (last) {
        const m = last.message.match(/^(.*?)\s+(raised to|called)/i);
        if (m) actorName = m[1];
      }
      const actor = table.players?.find((p: Player) => (p.isHero ? 'You' : p.name) === actorName) || null;
      const sourceEl = actor ? chipAnchorsRef.current[actor.id] : null;
      
      // Animate towards the Dealer
      const targetEl = dealerRef.current;
      if (sourceEl && targetEl) {
        const s = sourceEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        
        // Choose a color based on a denom close to delta
        const delta = (table.pot || 0) - prevPot;
        let denom: number = CHIP_DENOMS[0] as number;
        for (const d of [...CHIP_DENOMS].sort((a, b) => Number(b) - Number(a))) {
          if (delta >= d) { denom = d; break; }
        }
        const colorClass = CHIP_COLOR_CLASS[denom];
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const chip = { 
          id, 
          colorClass, 
          left: s.left + s.width / 2, 
          top: s.top, 
          toLeft: t.left + t.width / 2, 
          toTop: t.top + t.height / 2 
        };
        setFlyingChips((arr) => [...arr, chip]);
        
        // Remove after animation ends
        setTimeout(() => {
          setFlyingChips((arr) => arr.filter((c) => c.id !== id));
        }, 800);
      }
    }
    prevPotRef.current = table.pot || 0;
  }, [table.pot, table.actionLog, table.players, chipAnchorsRef, dealerRef, setFlyingChips]);

  return { prevPotRef };
};
