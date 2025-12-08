import React from 'react';
import type { TableState } from '../types/table';

interface GameInfoProps {
  table: TableState;
  isHeroTurn: boolean;
  currentActorName: string;
  highestBet: number;
  toCallVal: number;
  minRaiseToVal: number;
}

export const GameInfo: React.FC<GameInfoProps> = ({
  table,
  isHeroTurn,
  currentActorName,
  highestBet,
  toCallVal,
  minRaiseToVal,
}) => {
  const lastActionBanner = React.useMemo(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return null;
    const last = table.actionLog[table.actionLog.length - 1];
    const msg = last.message || '';
    const m = msg.match(/^(.*?)\s+(raised to|called|checked|folded)(?:\s+([0-9]+))?/i);
    if (!m) return null;
    const [, nameRaw, actionRaw, amtRaw] = m;
    const isHero = nameRaw === 'You';
    const name = isHero ? 'You' : nameRaw;
    const actionLc = actionRaw.toLowerCase();
    let actionEn = '';
    if (actionLc.startsWith('raised')) actionEn = 'raised to';
    else if (actionLc === 'called') actionEn = 'called';
    else if (actionLc === 'checked') actionEn = 'checked';
    else if (actionLc === 'folded') actionEn = 'folded';
    const amount = amtRaw ? `$${Number(amtRaw).toLocaleString()}` : '';
    const text = amount && actionEn.includes('raised') ? `${name} ${actionEn} ${amount}` : `${name} ${actionEn}${amount ? ' ' + amount : ''}`;
    return { text, isHero } as { text: string; isHero: boolean };
  }, [table.actionLog]);

  return (
    <div className="absolute right-2 top-2 bg-gray-900/90 backdrop-blur-md rounded-xl p-3 border border-gray-600/50 shadow-xl w-[min(360px,42vw)] z-[70]">
      {lastActionBanner && (
        <div className={`mb-2 text-center text-sm font-semibold px-3 py-1 rounded-md border ${lastActionBanner.isHero ? 'bg-emerald-600/20 border-emerald-400/40 text-emerald-200' : 'bg-white/10 border-white/20 text-white/90'}`}>
          Última acción: {lastActionBanner.text}
        </div>
      )}
      <div className="text-white/90 text-sm mb-2 text-center">
        {isHeroTurn ? (
          <div>
            <span className="text-emerald-300 font-semibold">Your turn</span>
          </div>
        ) : (
          <div>
            Waiting for <span className="text-yellow-300 font-semibold">{currentActorName}</span>...
          </div>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2 text-[12px] text-white/80">
        <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Stage: <span className="text-yellow-300 font-semibold">{table.stage}</span></div>
        <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Pot: <span className="text-yellow-300 font-semibold">${(table.pot||0).toLocaleString()}</span></div>
        <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Current bet: <span className="font-semibold">${highestBet}</span></div>
        <div className="bg-black/40 rounded px-2 py-1 border border-white/10">To call: <span className="font-semibold">${toCallVal}</span></div>
        <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Min raise to: <span className="font-semibold">${minRaiseToVal}</span></div>
        <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Blinds: <span className="font-semibold">${table.smallBlind}/{table.bigBlind}</span></div>
      </div>
    </div>
  );
};
