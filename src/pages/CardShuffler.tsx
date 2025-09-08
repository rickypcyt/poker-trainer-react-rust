import { DEFAULT_RANKS, DEFAULT_SUITS } from '../constants/cards';
import React, { useMemo, useState } from 'react';

import CardDeck from '../components/CardDeck';
import type { DeckCard } from '../types/cards';
import Navbar from '../components/Navbar';
import { shuffleDeck } from '../lib/shuffle';

const CardShuffler: React.FC = () => {
  const suits = DEFAULT_SUITS;
  const ranks = [...DEFAULT_RANKS];

  const initialDeck = useMemo(() => {
    const cards: DeckCard[] = [];
    for (const suit of suits) {
      for (const rank of ranks) {
        cards.push({ suit, rank });
      }
    }
    return cards;
  }, []);

  const [deck, setDeck] = useState<DeckCard[]>(initialDeck);
  const [isShuffling, setIsShuffling] = useState<boolean>(false);

  function handleShuffle() {
    if (isShuffling) return;
    setIsShuffling(true);
    const flipDurationMs = 600;
    setTimeout(() => {
      setDeck(prev => shuffleDeck(prev));
      setTimeout(() => {
        setIsShuffling(false);
      }, 50);
    }, flipDurationMs);
  }

  return (
    <div className="min-h-screen bg-green-700">
      <Navbar onShuffle={handleShuffle} disabled={isShuffling} />
      <CardDeck deck={deck} isShuffling={isShuffling} />
    </div>
  );
};

export default CardShuffler;


