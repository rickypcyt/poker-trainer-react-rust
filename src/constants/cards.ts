import type { Suit } from '../types/cards';

export const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

export const SUIT_COLOR_CLASS: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-neutral-900',
  spades: 'text-neutral-900'
};

export const DEFAULT_SUITS: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
export const DEFAULT_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'] as const;

// Suit labels for logging/messages
export const SUIT_LABEL_EN: Record<Suit, string> = {
  hearts: 'hearts',
  diamonds: 'diamonds',
  clubs: 'clubs',
  spades: 'spades'
};

