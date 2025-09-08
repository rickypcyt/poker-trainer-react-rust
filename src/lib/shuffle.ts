import type { DeckCard } from '../types/cards';

function getSecureRandomIndex(rangeExclusive: number): number {
  const maxUnbiased = Math.floor(256 / rangeExclusive) * rangeExclusive - 1;
  const buf = new Uint8Array(1);
  let r = 256;
  while (r > maxUnbiased) {
    crypto.getRandomValues(buf);
    r = buf[0];
  }
  return r % rangeExclusive;
}

export function shuffleDeck(cards: DeckCard[]): DeckCard[] {
  const copy = cards.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = getSecureRandomIndex(i + 1);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

