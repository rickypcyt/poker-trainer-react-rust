import type { Card } from '../lib/pokerService';
import ChipStack from './ChipStack';
import type { Player } from '../types/table';
import PokerCard from './PokerCard';
import React from 'react';

interface PlayerSeatProps {
  player: Player;
  isDealer: boolean;
  isSmallBlind: boolean;
  isBigBlind: boolean;
  reveal: boolean;
  drawCard?: Card | null;
  showDrawCard?: boolean;
  isActive?: boolean;
  position?: 'left' | 'right' | 'top' | 'bottom';
  gameStage?: string; // Game stage to control card visibility
  isThinking?: boolean;
  actionText?: string;
  chipAnchorRef?: (el: HTMLDivElement | null) => void;
  compactLevel?: 'normal' | 'compact' | 'ultra';
  isHighlighted?: boolean;
}

const PlayerSeat: React.FC<PlayerSeatProps> = ({ 
  player, 
  isDealer, 
  isSmallBlind, 
  isBigBlind, 
  reveal, 
  drawCard, 
  showDrawCard = false, 
  isActive = false,
  position = 'bottom',
  gameStage = 'PreFlop',
  isThinking = false,
  actionText,
  chipAnchorRef,
  compactLevel = 'normal',
  isHighlighted = false,
}) => {
  const tag = isDealer ? 'D' : isSmallBlind ? 'SB' : isBigBlind ? 'BB' : '';
  const tagClass = isDealer
    ? 'bg-yellow-500/80 border-yellow-400'
    : isSmallBlind
      ? 'bg-blue-500/80 border-blue-400'
      : isBigBlind
        ? 'bg-red-500/80 border-red-400'
        : 'bg-neutral-600/60 border-neutral-500/50';

  const isHero = !player.isBot;
  const name = isHero ? 'You' : player.name;
  // Show cards if it's the showdown phase, or if the player is the hero
  const isShowdown = reveal || gameStage === 'Showdown';
  const shouldShowCards = isHero || isShowdown;

  // For dealer draw, always show exactly ONE card. If the draw card isn't set yet, show a single placeholder face-down.
  // For regular play, show two hole cards or two placeholders.
  const cards = showDrawCard
    ? [drawCard ?? ({ suit: 'spades', rank: 'A' } as Card)]
    : (player.holeCards?.length === 2
        ? player.holeCards
        : [
            { suit: 'spades', rank: 'A' } as Card,
            { suit: 'hearts', rank: 'K' } as Card,
          ]);
  
  const faceDown = showDrawCard ? !reveal : (player.isBot && !shouldShowCards);
  const avatar = isHero ? '🧑‍💻' : '🤖';

  const foldedClass = player.hasFolded ? 'opacity-50 grayscale' : '';
  const activeClass = isActive ? 'ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.35)] animate-pulse' : '';
  const highlightClass = isHighlighted ? 'ring-2 ring-green-400 shadow-[0_0_22px_rgba(74,222,128,0.55)]' : '';

  // Density-driven tweaks for bots
  const botDensity = isHero ? 'normal' : compactLevel;
  const botName = !isHero ? (botDensity === 'ultra' ? (name.length > 6 ? name.slice(0, 6) + '…' : name) : (botDensity === 'compact' ? (name.length > 10 ? name.slice(0, 10) + '…' : name) : name)) : name;

  // Abbreviate chip amounts for compactness (e.g., 5200 -> 5.2K)
  const formatChips = (v: number) => {
    return v.toLocaleString();
  };
  // Decide if we should render the cards row
  const showCardRow = isHero || (shouldShowCards && botDensity !== 'ultra');
  const isAllIn = player.chips === 0 && player.bet > 0;

  // Position action bubble: side for left/right, above for top/bottom
  const bubbleSideClass = position === 'left'
    ? 'top-1/2 -translate-y-1/2 left-full ml-1'
    : position === 'right'
      ? 'top-1/2 -translate-y-1/2 right-full mr-1'
      : (isHero ? '-top-6 left-1/2 -translate-x-1/2' : '-top-5 left-1/2 -translate-x-1/2');

  return (
    <div data-position={position} className={`relative flex items-center ${isHero ? 'gap-2 p-1' : (botDensity === 'ultra' ? 'gap-0.5 p-0.5' : 'gap-1 p-0.5')} ${isHero ? 'bg-black/20' : 'bg-black/30 border border-white/20'} rounded-lg ${activeClass} ${highlightClass} ${foldedClass} ${isHighlighted ? 'w-auto min-w-[160px]' : ''}`}>
      {/* Action bubble */}
      {actionText && (
        <div className={`absolute ${bubbleSideClass} ${isHero ? 'text-base px-3 py-1' : 'text-[11px] px-2 py-0.5'} font-semibold text-white bg-neutral-900/90 border border-white/20 rounded-full shadow-lg whitespace-nowrap`}>
          {actionText}
        </div>
      )}
      {/* Left: Chip column */}
      <div className="hidden">
        <ChipStack stack={player.chipStack} size={isHero ? 'sm' : 'xs'} columns={3} />
      </div>
      {/* Right: Header + Cards */}
      <div className="group relative flex flex-col items-center">
        <div className={`flex items-baseline justify-center ${isHero ? 'gap-2' : (botDensity === 'ultra' ? 'gap-0.5' : 'gap-1')}`}>
          {!isHero && (
            <div className={`text-lg leading-none`}>{avatar}</div>
          )}
          <span className={`text-white/90 font-bold ${isHero ? 'text-base' : (botDensity === 'ultra' ? 'text-[12px]' : 'text-[13px]')} tracking-tight ${isHero ? 'max-w-[88px]' : 'max-w-[72px]'} truncate`} title={!isHero ? name : undefined}>{botName}</span>
          {tag && (
            <span className={`px-1 py-0.5 rounded text-[9px] font-bold text-white border ${tagClass}`}>
              {tag}
            </span>
          )}
          <span className={`text-white/80 font-semibold ${isHero ? 'text-base' : (botDensity === 'ultra' ? 'text-[11px]' : 'text-[12px]')} font-mono tracking-tight whitespace-nowrap`}>${formatChips(player.chips)}</span>
        </div>
        {isThinking && !player.hasFolded && (
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-white/80">
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]"></span>
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:120ms]"></span>
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:240ms]"></span>
          </div>
        )}
        {/* Extra info pills (row 1) */}
        <div className={`mt-1 flex flex-wrap items-center justify-center ${isHero ? 'gap-1.5' : 'gap-1'}`}>
          {player.bet > 0 && (
            <span className={`px-2 py-0.5 rounded-full border border-white/20 bg-black/30 text-white/85 ${isHero ? 'text-[11px]' : 'text-[10px]'} font-mono whitespace-nowrap`}>Bet ${formatChips(player.bet)}</span>
          )}
          {player.hasFolded && (
            <span className={`px-2 py-0.5 rounded-full border border-white/20 bg-red-600/30 text-red-200 ${isHero ? 'text-[11px]' : 'text-[10px]'} font-semibold`}>Folded</span>
          )}
          {!player.hasFolded && isAllIn && (
            <span className={`px-2 py-0.5 rounded-full border border-yellow-400/50 bg-yellow-600/30 text-yellow-100 ${isHero ? 'text-[11px]' : 'text-[10px]'} font-semibold`}>All-in</span>
          )}
          {!player.hasFolded && !isAllIn && isThinking && (
            <span className={`px-2 py-0.5 rounded-full border border-white/20 bg-blue-600/30 text-blue-100 ${isHero ? 'text-[11px]' : 'text-[10px]'} font-semibold`}>Thinking…</span>
          )}
        </div>
        {/* Extra info pills (row 2: AI info) - REMOVED */}
        {/* {!isHero && (player.ai?.difficulty || player.ai?.personality) && (
          <div className={`mt-1 flex flex-wrap items-center justify-center ${isHero ? 'gap-1.5' : 'gap-1'}`}>
            {player.ai?.difficulty && (
              <span className={`px-2 py-0.5 rounded-full border border-white/20 bg-purple-600/30 text-purple-100 ${isHero ? 'text-[11px]' : 'text-[10px]'} font-semibold whitespace-nowrap`}>{player.ai.difficulty}</span>
            )}
            {player.ai?.personality && (
              <span className={`px-2 py-0.5 rounded-full border border-white/20 bg-green-600/30 text-green-100 ${isHero ? 'text-[11px]' : 'text-[10px]'} font-semibold whitespace-nowrap`}>{player.ai.personality}</span>
            )}
          </div>
        )} */}
        {/* Cards - beneath header; show 1 card for dealer draw, 2 for regular play */}
        {showCardRow && (
          <div className={`flex ${isHero ? 'gap-0.5' : 'gap-0'} mt-0.5`}>
            {cards.map((c, i) => {
              const overlap = isHero ? -8 : (botDensity === 'ultra' ? -22 : botDensity === 'compact' ? -19 : -16); // tighter for bots
              const hoverCls = isHero ? 'hover:z-10 hover:transform hover:translate-y-[-5px]' : '';
              const angle = isHero ? 0 : 0; // removed rotation for bots to keep cards straight
              const pointerCls = isHero ? '' : 'pointer-events-none';
              return (
              <div key={i} className={`relative ${pointerCls}`} style={{ transform: `translateX(${i * overlap}px) rotate(${angle}deg)` }}>
                <PokerCard 
                  suit={c.suit} 
                  rank={c.rank} 
                  isFaceDown={faceDown} 
                  scale={
                    isHero
                      ? 0.72
                      : (
                          shouldShowCards
                            ? (botDensity === 'ultra' ? 0.55 : botDensity === 'compact' ? 0.58 : 0.62) // increased sizes for bots
                            : (botDensity === 'ultra' ? 0.50 : botDensity === 'compact' ? 0.52 : 0.55) // increased sizes for face-down
                          )
                  }
                  aspectRatio={
                    isHero 
                      ? 0.73 
                      : 0.73 // same aspect ratio for all cards
                  }
                  className={`${isHero || shouldShowCards ? '[--card-rank-size:0.95rem] [--card-suit-size:0.95rem]' : '[--card-rank-size:0.8rem] [--card-suit-size:0.8rem]'} ${hoverCls} transition-all duration-200`}
                />
              </div>
            );})}
          </div>
        )}
        <div className="mt-1" ref={chipAnchorRef}>
          <ChipStack stack={player.chipStack} size={isHero ? 'sm' : 'sm'} columns={3} />
        </div>
      </div>
    </div>
  );
};

export default PlayerSeat;



