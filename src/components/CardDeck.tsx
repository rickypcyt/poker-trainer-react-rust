import type { DeckCard } from '../types/cards';
import PokerCard from './PokerCard';
import React from 'react';

export const CardDeck: React.FC<{ deck: DeckCard[]; isShuffling: boolean }> = ({ deck, isShuffling }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 sm:gap-4 md:gap-5 lg:gap-6 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-7xl mx-auto">
      {deck.map(({ suit, rank }) => (
        <PokerCard key={`${rank}-${suit}`} rank={rank} suit={suit} isShuffling={isShuffling} />
      ))}
    </div>
  );
};

export default CardDeck;

