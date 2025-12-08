import { SUIT_COLOR_CLASS, SUIT_SYMBOL } from '../constants/cards';

import type { PokerCardProps } from '../types/cards';
import React from 'react';

export const PokerCard: React.FC<PokerCardProps> = ({ 
  suit, 
  rank, 
  isShuffling = false, 
  animationDelayMs = 0, 
  isHighlighted = false, 
  isFaceDown = false, 
  scale = 1,
  aspectRatio = 0.73, // default aspect ratio
  className = ''
}) => {
  const flippedClass = (isFaceDown || isShuffling) ? 'is-flipped' : '';
  const highlightClass = isHighlighted
    ? 'ring-4 ring-green-600 shadow-xl shadow-green-700/30 scale-[1.02]'
    : '';

  // Calculate dimensions based on aspect ratio
  const baseHeight = 'clamp(5.5rem, 11vw, 9.5rem)';
  const baseWidth = `calc(${baseHeight} * ${aspectRatio})`;

  return (
    <div 
      className={`card card-3d transition-all duration-200 ${highlightClass} ${className}`} 
      style={{
        transform: `scale(${scale})`,
        width: baseWidth,
        height: baseHeight,
        minWidth: baseWidth,
        minHeight: baseHeight,
        overflow: 'hidden'
      }}
    >
      <div
        className={`card-inner ${flippedClass}`}
        style={{ 
          transitionDuration: '600ms', 
          transitionDelay: `${animationDelayMs}ms`,
          width: '100%',
          height: '100%',
          position: 'relative',
          transformStyle: 'preserve-3d'
        }}
      >
        <div 
          className={`card-face card-front ${SUIT_COLOR_CLASS[suit]}`}
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
            overflow: 'hidden'
          }}
        >
          <div className="card-rank" style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', fontWeight: 'bold' }}>{rank}</div>
          <div className="card-suit" style={{ fontSize: 'clamp(1.5rem, 3vw, 2.5rem)', margin: 'auto 0' }}>{SUIT_SYMBOL[suit]}</div>
          <div className="card-rank-bottom" style={{ fontSize: 'clamp(1rem, 1.8vw, 1.5rem)', fontWeight: 'bold', transform: 'rotate(180deg)' }}>{rank}</div>
        </div>
        <div 
          className="card-face card-back"
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            backfaceVisibility: 'hidden',
            borderRadius: '0.5rem',
            background: 'linear-gradient(135deg, #1a365d 0%, #2c5282 100%)',
            outline: 'none',
            border: 'none',
            transform: 'rotateY(180deg)'
          }}
        >
          <div 
            className={`card-back-pattern ${isShuffling ? 'back-shimmer' : ''}`}
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
  );
};

export default PokerCard;

