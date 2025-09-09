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
  chipAnchorRef
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

  // For dealer draw, show only the draw card. For regular play, show hole cards.
  // When hole cards are unknown, provide valid placeholder cards; they'll be face-down via isFaceDown.
  const cards = showDrawCard && drawCard 
    ? [drawCard] // Only show the draw card during dealer draw
    : (player.holeCards?.length === 2 ? player.holeCards : [
        { suit: 'spades', rank: 'A' } as Card,
        { suit: 'hearts', rank: 'K' } as Card
      ]);
  
  const faceDown = showDrawCard ? !reveal : (player.isBot && !shouldShowCards);
  const avatar = isHero ? '🧑‍💻' : '🤖';

  const foldedClass = player.hasFolded ? 'opacity-50 grayscale' : '';
  const activeClass = isActive ? 'ring-4 ring-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.35)]' : '';

  return (
    <div data-position={position} className={`relative flex items-center gap-2 bg-black/20 rounded-lg p-1 ${activeClass} ${foldedClass}`}>
      {/* Action bubble */}
      {actionText && (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-semibold text-white bg-neutral-900/90 border border-white/20 rounded-full px-3 py-1 shadow-lg whitespace-nowrap">
          {actionText}
        </div>
      )}
      {/* Left: Chip column */}
      <div className="flex shrink-0" ref={chipAnchorRef}>
        <ChipStack stack={player.chipStack} />
      </div>
      {/* Right: Header + Cards */}
      <div className="group relative flex flex-col items-center">
        <div className={`flex items-center justify-center gap-2`}>
          <div className="text-2xl leading-none">{avatar}</div>
          <span className="text-white/90 font-bold text-sm">{name}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white border ${tagClass}`}>
            {tag || ' '}
          </span>
          <span className="text-white/80 font-semibold text-sm">${player.chips.toLocaleString()}</span>
        </div>
        {isThinking && !player.hasFolded && (
          <div className="mt-1 flex items-center justify-center gap-1 text-[11px] text-white/80">
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:0ms]"></span>
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:120ms]"></span>
            <span className="inline-block w-1.5 h-1.5 bg-white/70 rounded-full animate-bounce [animation-delay:240ms]"></span>
          </div>
        )}
        {/* Chip stack hover removed as requested */}
        {/* Cards - beneath header; show 1 card for dealer draw, 2 for regular play */}
        <div className={`flex ${isHero ? 'gap-0.5' : 'gap-0'} mt-1`}>
          {cards.map((c, i) => {
            const overlap = isHero ? -8 : -12; // bots overlap a bit more to look tighter
            return (
            <div key={i} className="relative" style={{ transform: `translateX(${i * overlap}px)` }}>
              <PokerCard 
                suit={c.suit} 
                rank={c.rank} 
                isFaceDown={faceDown} 
                scale={isHero ? 0.75 : (shouldShowCards ? 0.65 : 0.5)}
                className={`${isHero || shouldShowCards ? '[--card-rank-size:1.05rem] [--card-suit-size:1.05rem]' : '[--card-rank-size:0.9rem] [--card-suit-size:0.9rem]'} 
                  hover:z-10 hover:transform hover:translate-y-[-5px] transition-all duration-200`}
              />
            </div>
          );})}
        </div>
      </div>
    </div>
  );
};

export default PlayerSeat;



