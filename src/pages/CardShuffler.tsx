import { DEFAULT_RANKS, DEFAULT_SUITS } from '../constants/cards';
import React, { useMemo, useState } from 'react';

import CardDeck from '../components/CardDeck';
import type { DeckCard } from '../types/cards';
import Navbar from '../components/Navbar';
import { fetchShuffledDeck } from '../lib/deck';
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

  // Log initial state
  React.useEffect(() => {
    console.log('🎮 [CARDSHUFFLER] Component mounted');
    console.log('📊 [CARDSHUFFLER] Initial deck loaded with', initialDeck.length, 'cards');
    console.log('🔗 [CARDSHUFFLER] Ready to connect to secure backend for shuffling');
  }, [initialDeck.length]);

  async function handleShuffle() {
    if (isShuffling) return;
    
    console.log('🎲 [CARDSHUFFLER] Starting shuffle process...');
    setIsShuffling(true);
    const flipDurationMs = 600;
    
    try {
      console.log('🔗 [CARDSHUFFLER] Attempting to connect to secure backend...');
      const newDeck = await fetchShuffledDeck();
      
      console.log('✅ [CARDSHUFFLER] Successfully received secure deck from backend');
      setTimeout(() => {
        setDeck(newDeck);
        console.log('🎯 [CARDSHUFFLER] Deck updated with cryptographically secure shuffle');
        setTimeout(() => setIsShuffling(false), 50);
      }, flipDurationMs);
    } catch (err) {
      console.warn('⚠️ [CARDSHUFFLER] Backend unavailable, using local fallback shuffle');
      console.error('[CARDSHUFFLER] Error details:', err);
      
      // fallback local shuffle to keep UX responsive
      setTimeout(() => {
        setDeck(prev => shuffleDeck(prev));
        console.log('🔄 [CARDSHUFFLER] Applied local shuffle as fallback');
        setTimeout(() => setIsShuffling(false), 50);
      }, flipDurationMs);
    }
  }

  return (
    <div className="min-h-screen bg-green-700">
      <Navbar onShuffle={handleShuffle} disabled={isShuffling} />
      <CardDeck deck={deck} isShuffling={isShuffling} />
    </div>
  );
};

export default CardShuffler;


