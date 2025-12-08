import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';
import type { ChipStack as ChipStackType, Player, TableState } from '../types/table';

import ChipStack from './ChipStack';
import Dealer from './Dealer';
import PlayerSeat from './PlayerSeat';
import PokerCard from './PokerCard';
import React from 'react';

interface PokerTableProps {
  table: TableState;
  reveal: boolean;
  isDealing: boolean;
  potRef: React.Ref<HTMLDivElement>;
  dealerRef: React.Ref<HTMLDivElement>;
  chipAnchorsRef: React.RefObject<Record<string, HTMLDivElement | null>>;
  seatActions: Record<string, string>;
  isBotThinking: boolean;
  currentBotIndex: number | null;
}

export const PokerTable: React.FC<PokerTableProps> = ({
  table,
  reveal,
  isDealing,
  potRef,
  dealerRef,
  chipAnchorsRef,
  seatActions,
  isBotThinking,
  currentBotIndex,
}) => {
  const { players, dealerIndex, smallBlindIndex, bigBlindIndex } = table;
  const bots = React.useMemo(() => (players?.filter((p: Player) => !p.isHero) || []), [players]);
  
  // Compute bot positions by actual table seat positions around an oval
  const botRing = React.useMemo(() => {
    const all = players ?? [];
    const n = bots.length;
    if (n === 0) return [] as Array<{ left: number; top: number; position: 'left' | 'right' | 'top' | 'bottom' }>;
    const totalSeats = all.length || n;
    const heroSeat = all.find((p: Player) => p.isHero)?.seatIndex ?? 0;
    const radiusX = 38; // percent width
    const radiusY = 32; // percent height for nicer oval
    const arr = bots.map((bot) => {
      const rel = ((bot.seatIndex - heroSeat + totalSeats) % totalSeats);
      const angleDeg = 270 + (360 / totalSeats) * rel;
      const theta = (angleDeg * Math.PI) / 180;
      const cx = 50 + radiusX * Math.cos(theta);
      const cy = 50 + radiusY * Math.sin(theta);
      let pos: 'left' | 'right' | 'top' | 'bottom' = 'left';
      if (cy <= 35) pos = 'top';
      else if (cy >= 65) pos = 'bottom';
      else pos = cx < 50 ? 'left' : 'right';
      return { left: cx, top: cy, position: pos };
    });
    
    // Nudge bots #1 and #10 upward when exactly 10 bots are present
    if (n === 10) {
      const up = (i: number) => {
        if (!arr[i]) return;
        const t = Math.max(2, arr[i].top - 8);
        const pos: 'left' | 'right' | 'top' | 'bottom' = t <= 35 ? 'top' : arr[i].position;
        arr[i] = { ...arr[i], top: t, position: pos };
      };
      up(0);        // bot #1 (first in list)
      up(n - 1);   // bot #10 (last in list)

      // Horizontal tweak: move #6 left and #5 right slightly to improve spacing
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const shiftX = (i: number, dx: number) => {
        if (!arr[i]) return;
        const nx = clamp(arr[i].left + dx, 6, 94);
        let pos: 'left' | 'right' | 'top' | 'bottom' = arr[i].position;
        if (arr[i].top > 35 && arr[i].top < 65) {
          pos = nx < 50 ? 'left' : 'right';
        }
        arr[i] = { ...arr[i], left: nx, position: pos };
      };
      shiftX(5, -6); // bot #6 more to the left
      shiftX(4, +6); // bot #5 more to the right
    }
    return arr;
  }, [bots, players]);

  // Use exact pot breakdown tracked by the engine
  const potChipStack: ChipStackType = React.useMemo(() => {
    return table.potStack || {} as ChipStackType;
  }, [table.potStack]);

  return (
    <div className="relative w-full h-[calc(100vh-6rem)] flex items-center justify-center px-2 py-2 overflow-hidden">
      {/* Chip legend in two columns */}
      <div className="absolute left-2 top-2 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-[11px] text-white/80">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {CHIP_DENOMS.map((d) => (
            <div key={`legend-${d}`} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full border border-white/50 ${CHIP_COLOR_CLASS[d]}`} />
              <span>${d}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Poker table - larger and perfectly centered */}
      <div className="relative w-[90vw] max-w-[1200px] h-[65vh] min-h-[500px]">
        {/* Dealer position - higher on the table */}
        <div ref={dealerRef} className="absolute left-1/2 -translate-x-1/2 -top-12 z-10">
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
          <div className="absolute inset-0">  
            {/* Pot display */}
            <div ref={potRef} className="absolute left-1/2 -translate-x-1/2 top-10 md:top-12 bg-black/80 text-white text-base md:text-2xl font-bold px-4 md:px-6 py-1.5 md:py-2 rounded-full border border-amber-100/20 shadow-md z-10">
              <span className="text-amber-100 font-mono">POT:</span> <span className="text-xl md:text-3xl text-yellow-300 font-mono">${(table.pot || 0).toLocaleString()}</span>
            </div>

            {/* Pot chip stack visualization */}
            <div className="absolute left-1/2 -translate-x-1/2 top-[96px] md:top-[120px] z-10">
              <div className="scale-[0.98]">
                <ChipStack stack={potChipStack} showCounts countFormat="prefixX" size="md" columns={2} />
              </div>
            </div>

            {/* Board area - perfectly centered in Y axis */}
            <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4">
              <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`relative aspect-[0.7] rounded-lg ${
                      i < (table.board?.length || 0)
                        ? 'bg-white shadow-lg hover:scale-[1.02] hover:z-10 transition-transform duration-200'
                        : 'bg-white/5 border-2 border-dashed border-white/20'
                    } flex items-center justify-center w-[clamp(56px,8vw,120px)]`}
                  >
                    {i < (table.board?.length || 0) && table.board?.[i] ? (
                      <PokerCard
                        suit={table.board[i].suit}
                        rank={table.board[i].rank}
                        className="w-full h-full [--card-rank-size:0.9rem] [--card-suit-size:1.4rem]"
                        scale={0.9}
                      />
                    ) : (
                      <span className="text-white/30 text-base sm:text-base md:text-lg font-bold">{i + 1}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
        
        {/* Hero bottom center */}
        {players?.filter((p: Player) => p.isHero).map((p: Player) => (
          <div key={p.id} className="absolute left-1/2 bottom-2 -translate-x-1/2">
            <PlayerSeat
              player={p}
              isDealer={players?.indexOf(p) === dealerIndex}
              isSmallBlind={players?.indexOf(p) === smallBlindIndex}
              isBigBlind={players?.indexOf(p) === bigBlindIndex}
              reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
              drawCard={table.dealerDrawCards[p.id]}
              showDrawCard={table.dealerDrawInProgress}
              isActive={players?.indexOf(p) === (table.currentPlayerIndex ?? -1)}
              position="bottom"
              gameStage={table.stage}
              isThinking={isBotThinking && currentBotIndex === players?.indexOf(p)}
              actionText={seatActions[p.id]}
              chipAnchorRef={(el) => { if (chipAnchorsRef.current) chipAnchorsRef.current[p.id] = el; }}
              isHighlighted={table.dealerDrawInProgress && table.dealerDrawRevealed && (players?.indexOf(p) === (table.dealingState?.highCardPlayerIndex ?? table.dealerIndex))}
            />
          </div>
        ))}

        {/* Other players placed around a ring */}
        {bots.map((p: Player, i: number) => {
          const idx = players?.indexOf(p) ?? -1;
          const pos = botRing[i] || { left: 88, top: 25, position: 'right' as const };
          const compactLevel = bots.length > 6 ? 'ultra' : (bots.length > 3 ? 'compact' : 'normal');
          return (
            <div
              key={p.id}
              className="absolute"
              style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: 'translate(-50%, -50%)' }}
            >
              <PlayerSeat
                player={p}
                isDealer={idx === dealerIndex}
                isSmallBlind={idx === smallBlindIndex}
                isBigBlind={idx === bigBlindIndex}
                reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
                drawCard={table.dealerDrawCards[p.id]}
                showDrawCard={table.dealerDrawInProgress}
                isActive={idx === (table.currentPlayerIndex ?? -1)}
                position={pos.position}
                gameStage={table.stage}
                isThinking={isBotThinking && currentBotIndex === idx}
                actionText={seatActions[p.id]}
                chipAnchorRef={(el) => { if (chipAnchorsRef.current) chipAnchorsRef.current[p.id] = el; }}
                compactLevel={compactLevel as 'normal' | 'compact' | 'ultra'}
                isHighlighted={table.dealerDrawInProgress && table.dealerDrawRevealed && (idx === (table.dealingState?.highCardPlayerIndex ?? table.dealerIndex))}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
