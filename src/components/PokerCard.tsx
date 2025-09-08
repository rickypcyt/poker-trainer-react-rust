import { SUIT_COLOR_CLASS, SUIT_SYMBOL } from '../constants/cards';

import type { PokerCardProps } from '../types/cards';
import React from 'react';

export const PokerCard: React.FC<PokerCardProps> = ({ suit, rank, isShuffling = false, animationDelayMs = 0 }) => {
  const flippedClass = isShuffling ? 'is-flipped' : '';
  return (
    <div className={`card card-3d`}>
      <div className={`card-inner ${flippedClass}`} style={{ transitionDuration: '600ms' }}>
        <div className={`card-face card-front ${SUIT_COLOR_CLASS[suit]}`}>
          <div className="card-rank">{rank}</div>
          <div className="card-suit">{SUIT_SYMBOL[suit]}</div>
          <div className="card-rank-bottom">{rank}</div>
        </div>
        <div className="card-face card-back">
          <div className={`card-back-pattern ${isShuffling ? 'back-shimmer' : ''}`} />
        </div>
      </div>
    </div>
  );
};

export default PokerCard;

