import React from 'react';
import type { Rank, Suit } from '../types/cards';

interface HandRankingCardProps {
  title: string;
  description: string;
  cards: Array<{ rank: Rank; suit: Suit }>;
  scale?: number;
  className?: string;
}

const HandRankingCard: React.FC<HandRankingCardProps> = ({
  title,
  description,
  cards,
  scale = 0.55,
  className = '',
}) => {
  const getSuitSymbol = (suit: string) => {
    switch (suit) {
      case 'hearts': return '♥';
      case 'diamonds': return '♦';
      case 'clubs': return '♣';
      case 'spades': return '♠';
      default: return '';
    }
  };

  return (
    <div className={`bg-gradient-to-br from-white/5 to-white/[0.03] border border-white/10 rounded-xl p-3 sm:p-4 flex flex-col min-w-0 transition-all duration-200 hover:border-white/20 hover:shadow-lg hover:scale-[1.02] ${className}`}>
      <div className="mb-2 sm:mb-3 text-center">
        <div className="font-bold text-base sm:text-lg text-white">{title}</div>
        <div className="text-white/60 text-xs sm:text-sm">{description}</div>
      </div>
      <div className="flex items-center justify-center -space-x-10 flex-nowrap overflow-visible">
        {cards.map((card, i) => (
          <div key={`${title}-${i}`} className="flex-shrink-0 hover:-translate-y-1 transition-transform duration-200">
            <div 
              className="card card-3d transition-all duration-200 sm:scale-75 md:scale-90 -mx-0.5"
              style={{
                transform: `scale(${scale})`,
                width: 'clamp(4rem, 8vw, 7rem)',
                height: 'clamp(5.5rem, 11vw, 9.5rem)',
                minWidth: 'clamp(4rem, 8vw, 7rem)',
                minHeight: 'clamp(5.5rem, 11vw, 9.5rem)',
                overflow: 'hidden'
              }}
            >
              <div 
                className="card-inner"
                style={{
                  transitionDuration: '600ms',
                  transitionDelay: '0ms',
                  width: '100%',
                  height: '100%',
                  position: 'relative',
                  transformStyle: 'preserve-3d'
                }}
              >
                <div 
                  className="card-face card-front text-neutral-900"
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '0.5rem',
                    boxSizing: 'border-box',
                    outline: 'none',
                    border: 'none',
                    overflow: 'hidden',
                    backgroundColor: 'white'
                  }}
                >
                  <div 
                    className="card-rank" 
                    style={{
                      fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', 
                      fontWeight: 'bold',
                      color: ['hearts', 'diamonds'].includes(card.suit) ? '#dc2626' : 'inherit'
                    }}
                  >
                    {card.rank}
                  </div>
                  <div 
                    className="card-suit" 
                    style={{
                      fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', 
                      margin: 'auto 0',
                      color: ['hearts', 'diamonds'].includes(card.suit) ? '#dc2626' : 'inherit'
                    }}
                  >
                    {getSuitSymbol(card.suit)}
                  </div>
                  <div 
                    className="card-rank-bottom" 
                    style={{
                      fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', 
                      fontWeight: 'bold', 
                      transform: 'rotate(180deg)',
                      color: ['hearts', 'diamonds'].includes(card.suit) ? '#dc2626' : 'inherit'
                    }}
                  >
                    {card.rank}
                  </div>
                </div>
                <div 
                  className="card-face card-back"
                  style={{
                    position: 'absolute',
                    width: '100%',
                    height: '100%',
                    backfaceVisibility: 'hidden',
                    borderRadius: '0.5rem',
                    background: 'linear-gradient(135deg, rgb(26, 54, 93) 0%, rgb(44, 82, 130) 100%)',
                    outline: 'none',
                    border: 'none',
                    transform: 'rotateY(180deg)'
                  }}
                >
                  <div 
                    className="card-back-pattern" 
                    style={{
                      width: '100%', 
                      height: '100%', 
                      background: 'repeating-linear-gradient(45deg, rgba(255, 255, 255, 0.1), rgba(255, 255, 255, 0.1) 2px, transparent 2px, transparent 4px)',
                      borderRadius: '0.5rem'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default HandRankingCard;
