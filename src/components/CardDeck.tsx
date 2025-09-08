import type { DeckCard } from '../types/cards';
import PokerCard from './PokerCard';
import React from 'react';

export const CardDeck: React.FC<{ deck: DeckCard[]; isShuffling: boolean }> = ({ deck, isShuffling }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-7xl mx-auto">
      {deck.map(({ suit, rank }) => (
        <PokerCard key={`${rank}-${suit}`} rank={rank} suit={suit} isShuffling={isShuffling} />
      ))}
    </div>
  );
};

export default CardDeck;

