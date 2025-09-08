export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface DeckCard {
  suit: Suit;
  rank: Rank;
}

export interface PokerCardProps {
  suit: Suit;
  rank: Rank;
  isShuffling?: boolean;
  animationDelayMs?: number;
}

