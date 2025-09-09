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
  const activeClass = isActive ? 'ring-2 ring-yellow-400 shadow-[0_0_16px_rgba(250,204,21,0.35)]' : '';
  const highlightClass = isHighlighted ? 'ring-2 ring-green-400 shadow-[0_0_22px_rgba(74,222,128,0.55)]' : '';

  // Density-driven tweaks for bots
  const botDensity = isHero ? 'normal' : compactLevel;
  const botName = !isHero ? (botDensity === 'ultra' ? (name.length > 6 ? name.slice(0, 6) + '…' : name) : (botDensity === 'compact' ? (name.length > 10 ? name.slice(0, 10) + '…' : name) : name)) : name;

  // Abbreviate chip amounts for compactness (e.g., 5200 -> 5.2K)
  const formatChips = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 ? 1 : 0)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(v % 1_000 ? 1 : 0)}K`;
    return `${v}`;
  };

  return (
    <div data-position={position} className={`relative flex items-center ${isHero ? 'gap-2 p-1' : (botDensity === 'ultra' ? 'gap-0.5 p-0.5' : 'gap-1 p-0.5')} bg-black/20 rounded-lg ${activeClass} ${highlightClass} ${foldedClass}`}>
      {/* Action bubble */}
      {actionText && (
        <div className={`absolute ${isHero ? '-top-6' : '-top-5'} left-1/2 -translate-x-1/2 ${isHero ? 'text-base px-3 py-1' : 'text-[11px] px-2 py-0.5'} font-semibold text-white bg-neutral-900/90 border border-white/20 rounded-full shadow-lg whitespace-nowrap`}>
          {actionText}
        </div>
      )}
      {/* Left: Chip column */}
      <div className="flex shrink-0" ref={chipAnchorRef}>
        <ChipStack stack={player.chipStack} size={isHero ? 'sm' : 'xs'} columns={(!isHero && botDensity === 'ultra') ? 2 : 1} />
      </div>
      {/* Right: Header + Cards */}
      <div className="group relative flex flex-col items-center">
        <div className={`flex items-center justify-center ${isHero ? 'gap-2' : (botDensity === 'ultra' ? 'gap-0.5' : 'gap-1')}`}>
          {!isHero && botDensity === 'ultra' ? null : (
            <div className={`${isHero ? 'text-2xl' : (botDensity === 'ultra' ? 'text-lg' : 'text-xl')} leading-none`}>{avatar}</div>
          )}
          <span className={`text-white/90 font-bold ${isHero ? 'text-base' : (botDensity === 'ultra' ? 'text-[12px]' : 'text-[13px]')} max-w-[88px] truncate`} title={!isHero ? name : undefined}>{botName}</span>
          {tag && (
            <span className={`px-1 py-0.5 rounded text-[9px] font-bold text-white border ${tagClass}`}>
              {tag}
            </span>
          )}
          <span className={`text-white/80 font-semibold ${isHero ? 'text-base' : (botDensity === 'ultra' ? 'text-[11px]' : 'text-[12px]')} font-mono`}>${isHero ? player.chips.toLocaleString() : formatChips(player.chips)}</span>
        </div>
        {isThinking && !player.hasFolded && (
          <div className="mt-2 flex items-center justify-center gap-1 text-[10px] text-white/80">
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]"></span>
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:120ms]"></span>
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:240ms]"></span>
          </div>
        )}
        {/* Chip stack hover removed as requested */}
        {/* Cards - beneath header; show 1 card for dealer draw, 2 for regular play */}
        <div className={`flex ${isHero ? 'gap-0.5' : 'gap-0'} mt-0.5`}>
          {cards.map((c, i) => {
            const overlap = isHero ? -8 : (botDensity === 'ultra' ? -20 : botDensity === 'compact' ? -17 : -14); // tighter with density
            const hoverCls = isHero ? 'hover:z-10 hover:transform hover:translate-y-[-5px]' : '';
            const angle = isHero ? 0 : (i === 0 ? -8 : 8); // fan cards slightly for bots
            const pointerCls = isHero ? '' : 'pointer-events-none';
            return (
            <div key={i} className={`relative ${pointerCls}`} style={{ transform: `translateX(${i * overlap}px) rotate(${angle}deg)` }}>
              <PokerCard 
                suit={c.suit} 
                rank={c.rank} 
                isFaceDown={faceDown} 
                scale={isHero ? 0.72 : (shouldShowCards ? (botDensity === 'ultra' ? 0.5 : botDensity === 'compact' ? 0.54 : 0.58) : (botDensity === 'ultra' ? 0.44 : 0.48))}
                className={`${isHero || shouldShowCards ? '[--card-rank-size:0.95rem] [--card-suit-size:0.95rem]' : '[--card-rank-size:0.8rem] [--card-suit-size:0.8rem]'} ${hoverCls} transition-all duration-200`}
              />
            </div>
          );})}
        </div>
      </div>
    </div>
  );
};

export default PlayerSeat;



