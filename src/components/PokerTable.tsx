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
    const radiusX = 48; // percent width - increased to separate bots more horizontally
    const radiusY = 0; // percent height - completely flat to align exactly with board cards
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
    
    // Special positioning for 4 bots - place them in corners
    if (n === 4) {
      return [
        { left: 15, top: 15, position: 'top' as const },    // top-left corner
        { left: 85, top: 15, position: 'top' as const },    // top-right corner  
        { left: 15, top: 85, position: 'bottom' as const }, // bottom-left corner
        { left: 85, top: 85, position: 'bottom' as const }  // bottom-right corner
      ];
    }

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
      {/* Poker table - larger and perfectly centered */}
      <div className="relative w-[95vw] max-w-[1600px] lg:max-w-[1800px] h-[60vh] min-h-[500px] lg:h-[65vh] -mt-8">
        {/* Dealer position - higher on the table */}
        <div ref={dealerRef} className="absolute left-1/2 -translate-x-1/2 -top-12 z-10">
          <Dealer isDealing={isDealing} />
        </div>
        
        {/* Table mat with enhanced design */}
        <div className="absolute inset-0 bg-gradient-to-br from-green-900/95 via-green-800/90 to-green-900/95 rounded-[50%] border-4 border-amber-200/30 shadow-2xl overflow-hidden backdrop-blur-sm">
          {/* Enhanced felt texture with realistic pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-green-800/80 via-green-900/85 to-green-950/80">
            {/* Subtle wood grain pattern for authenticity */}
            <div 
              className="absolute inset-0 opacity-20"
              style={{
                backgroundImage: `
                  repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
                  repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.03) 2px, rgba(255,255,255,0.03) 4px),
                  radial-gradient(circle at 30% 40%, rgba(255,255,255,0.1) 0%, transparent 50%),
                  radial-gradient(circle at 70% 60%, rgba(255,255,255,0.08) 0%, transparent 40%)
                `
              }}
            />
            {/* Dynamic lighting effect */}
            <div 
              className="absolute inset-0 opacity-30"
              style={{
                background: `
                  radial-gradient(ellipse at 25% 25%, rgba(255,255,255,0.15) 0%, transparent 40%),
                  radial-gradient(ellipse at 75% 75%, rgba(255,255,255,0.1) 0%, transparent 35%),
                  linear-gradient(135deg, transparent 0%, rgba(255,255,255,0.05) 50%, transparent 100%)
                `
              }}
            />
          </div>
          
          {/* Inner rail border for depth */}
          <div className="absolute inset-0 rounded-[50%] border-2 border-amber-300/20 shadow-inner">
            {/* Rail cushion effect */}
            <div className="absolute inset-0 rounded-[48%] border border-amber-100/15 shadow-lg" />
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

            {/* Board area - moved slightly lower */}
            <div className="absolute inset-0 flex items-center justify-center px-4 sm:px-6">
              <div className="flex items-center justify-center gap-3 sm:gap-4 md:gap-6">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className={`relative aspect-[0.7] rounded-lg ${
                      i < (table.board?.length || 0)
                        ? 'bg-white shadow-lg hover:scale-[1.02] hover:z-10 transition-transform duration-200'
                        : 'bg-white/5 border-2 border-dashed border-white/20'
                    } flex items-center justify-center w-[clamp(64px,9vw,140px)]`}
                  >
                    {i < (table.board?.length || 0) && table.board?.[i] ? (
                      <PokerCard
                        suit={table.board[i].suit}
                        rank={table.board[i].rank}
                        scale={0.95}
                        style={{
                          '--card-rank-size': '1rem',
                          '--card-suit-size': '1.6rem'
                        } as React.CSSProperties}
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
          <div key={p.id} className="absolute left-1/2 -bottom-16 -translate-x-1/2">
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
