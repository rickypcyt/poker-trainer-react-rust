import React, { useMemo, useState } from 'react';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

interface PokerCardProps {
  suit: Suit;
  rank: Rank;
  isShuffling?: boolean;
  animationDelayMs?: number;
}

const SUIT_SYMBOL: Record<Suit, string> = {
  hearts: '♥',
  diamonds: '♦',
  clubs: '♣',
  spades: '♠'
};

const SUIT_COLOR_CLASS: Record<Suit, string> = {
  hearts: 'text-red-600',
  diamonds: 'text-red-600',
  clubs: 'text-neutral-900',
  spades: 'text-neutral-900'
};

const PokerCard: React.FC<PokerCardProps> = ({ suit, rank, isShuffling = false, animationDelayMs = 0 }) => {
  const flippedClass = isShuffling ? 'is-flipped' : '';
  return (
    <div className={`card card-3d`}>
      <div className={`card-inner ${flippedClass}`}>
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

interface DeckCard {
  suit: Suit;
  rank: Rank;
}

const CardDeck: React.FC<{ deck: DeckCard[]; isShuffling: boolean }> = ({ deck, isShuffling }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 sm:gap-3 md:gap-4 px-3 sm:px-4 lg:px-6 py-4 sm:py-6 max-w-7xl mx-auto">
      {deck.map(({ suit, rank }, index) => {
        return (
          <PokerCard
            key={`${rank}-${suit}`}
            rank={rank}
            suit={suit}
            isShuffling={isShuffling}
          />
        );
      })}
    </div>
  );
};

function App() {
  const suits: Suit[] = ['hearts', 'diamonds', 'clubs', 'spades'];
  const ranks: Rank[] = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

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

  function getSecureRandomIndex(rangeExclusive: number): number {
    // Rejection sampling to avoid modulo bias using a single byte
    const maxUnbiased = Math.floor(256 / rangeExclusive) * rangeExclusive - 1;
    const buf = new Uint8Array(1);
    let r = 256;
    while (r > maxUnbiased) {
      crypto.getRandomValues(buf);
      r = buf[0];
    }
    return r % rangeExclusive;
  }

  function shuffleDeck(cards: DeckCard[]): DeckCard[] {
    const copy = cards.slice();
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = getSecureRandomIndex(i + 1);
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy;
  }

  function handleShuffle() {
    if (isShuffling) return;
    // Step 1: flip all to back
    setIsShuffling(true);
    const flipDurationMs = 600; // must match CSS transition ~600ms
    // Step 2: after flip-to-back completes, shuffle deck
    setTimeout(() => {
      setDeck(prev => shuffleDeck(prev));
      // Step 3: small delay to commit DOM order, then flip all to front
      setTimeout(() => {
        setIsShuffling(false);
      }, 50);
    }, flipDurationMs);
  }

  return (
    <div className="min-h-screen bg-green-700">
      <nav className="navbar">
        <div className="nav-inner">
          <div />
          <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold text-white">Texas Hold'em Cards</h1>
          <div className="flex justify-end">
            <button className="btn btn-primary border" onClick={handleShuffle} disabled={isShuffling}>
              {isShuffling ? (
                <span className="flex items-center gap-2">
                  <span className="spinner" />
                  Shuffling
                </span>
              ) : (
                'Shuffle'
              )}
            </button>
          </div>
        </div>
      </nav>

      <CardDeck deck={deck} isShuffling={isShuffling} />
    </div>
  );
}

export default App;
