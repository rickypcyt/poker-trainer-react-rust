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
  gameStage = 'PreFlop'
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

  // For dealer draw, show only the draw card. For regular play, show hole cards
  const cards = showDrawCard && drawCard 
    ? [drawCard] // Only show the draw card during dealer draw
    : (player.holeCards?.length === 2 ? player.holeCards : [
        { suit: 'back' as any, rank: 'back' as any } as Card, 
        { suit: 'back' as any, rank: 'back' as any } as Card
      ]);
  
  const faceDown = showDrawCard ? !reveal : (player.isBot && !shouldShowCards);
  const avatar = isHero ? '🧑‍💻' : '🤖';

  return (
    <div className={`flex items-center gap-3 ${position === 'right' ? 'flex-row-reverse' : 'flex-row'} ${isActive ? 'ring-2 ring-yellow-400 rounded-lg p-2' : ''} bg-black/20 rounded-lg p-1`}>
      {/* Cards - show 1 card for dealer draw, 2 cards for regular play */}
      <div className="flex gap-0.5">
        {cards.map((c, i) => (
          <div key={i} className="relative" style={{ transform: `translateX(${i * -8}px)` }}>
            <PokerCard 
              suit={c.suit} 
              rank={c.rank} 
              isFaceDown={faceDown || (c.suit as any) === 'back'} 
              scale={isHero ? 0.8 : (shouldShowCards ? 0.7 : 0.5)}
              className={`${isHero || shouldShowCards ? '[--card-rank-size:1.1rem] [--card-suit-size:1.1rem]' : '[--card-rank-size:0.9rem] [--card-suit-size:0.9rem]'} 
                hover:z-10 hover:transform hover:translate-y-[-5px] transition-all duration-200`}
            />
          </div>
        ))}
      </div>

      {/* Player info */}
      <div className="group relative">
        <div className={`flex items-center gap-2 ${position === 'right' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className="text-2xl">{avatar}</div>
          <div className={`flex flex-col ${position === 'right' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-1.5">
              {position === 'right' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white border ${tagClass}`}>
                  {tag || ' '}
                </span>
              )}
              <span className="text-white/90 font-bold text-sm">{name}</span>
              {position !== 'right' && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold text-white border ${tagClass}`}>
                  {tag || ' '}
                </span>
              )}
            </div>
            <div className="text-white/80 font-semibold text-sm">${player.chips.toLocaleString()}</div>
            
            {/* Detailed chip stack on hover */}
            <div className={`opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute ${position === 'right' ? 'right-0' : 'left-0'} top-full mt-1 bg-white/95 backdrop-blur-sm rounded-lg p-3 border border-gray-200 shadow-xl z-10 min-w-[140px]`}>
              <div className="text-gray-800 text-sm font-bold mb-2">Chip Stack</div>
              <div className="flex flex-col gap-2">
                {Object.entries(player.chipStack).sort(([a], [b]) => Number(b) - Number(a)).map(([denom, count]) => (
                  count > 0 && (
                    <div key={denom} className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">${denom}:</span>
                      <span className="font-mono font-medium text-gray-800">{count} × ${denom}</span>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>


      {/* Chips stack */}
      <div className="mt-0.5">
        <ChipStack stack={player.chipStack} />
      </div>
    </div>
  );
};

export default PlayerSeat;



