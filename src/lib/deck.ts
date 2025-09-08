import { DEFAULT_RANKS, DEFAULT_SUITS } from '../constants/cards';

import type { DeckCard } from '../types/cards';

export function createStandardDeck(): DeckCard[] {
  const cards: DeckCard[] = [];
  for (const suit of DEFAULT_SUITS) {
    for (const rank of DEFAULT_RANKS) {
      cards.push({ suit, rank });
    }
  }
  return cards;
}


