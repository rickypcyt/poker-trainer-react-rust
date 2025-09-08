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

export async function fetchShuffledDeck(apiBase?: string): Promise<DeckCard[]> {
  const base = apiBase ?? import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:3000';
  
  console.log('🔗 [FRONTEND] Connecting to backend at:', base);
  console.log('📡 [FRONTEND] Requesting shuffled deck from /api/deck');
  
  try {
    const res = await fetch(`${base}/api/deck`, { cache: 'no-store' });
    
    if (!res.ok) {
      console.error('❌ [FRONTEND] Backend responded with error:', res.status, res.statusText);
      throw new Error(`Failed to fetch deck: ${res.status}`);
    }
    
    console.log('✅ [FRONTEND] Backend responded successfully');
    const data = await res.json();
    console.log('🎲 [FRONTEND] Received deck with', data.length, 'cards');
    
    return data as DeckCard[];
  } catch (error) {
    console.error('💥 [FRONTEND] Network error connecting to backend:', error);
    throw error;
  }
}


