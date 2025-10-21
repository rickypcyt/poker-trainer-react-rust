import type { Card } from '../lib/pokerService';

export type SeatRole = 'Dealer' | 'SmallBlind' | 'BigBlind' | 'None';

export type ChipValue = 1 | 5 | 25 | 100 | 500 | 1000;
export type ChipStack = Record<number, number>; // key is chip value (e.g., 25 -> count)

// Game difficulty levels for bot behavior
export type Difficulty = 'Easy' | 'Medium' | 'Hard';

// Bot personality archetypes to vary style
export type Personality = 'Aggressive' | 'Passive' | 'Balanced' | 'Maniac' | 'Nit';

export interface Player {
  id: string;
  name: string;
  isBot: boolean;
  isHero: boolean;
  chips: number;
  chipStack: ChipStack;
  bet: number;
  holeCards: Card[];
  hasFolded: boolean;
  seatIndex: number;
  // Optional per-bot AI configuration. If omitted, table-level defaults are used.
  ai?: {
    difficulty?: Difficulty;
    personality?: Personality;
  };
}

export interface TableState {
  deck: Card[];
  board: Card[];
  burned: Card[];
  communityCards: Card[];
  players: Player[];
  dealerIndex: number; // -1 until decided by dealer draw
  smallBlindIndex: number;
  bigBlindIndex: number;
  currentPlayerIndex: number;
  pot: number;
  // Exact chip denomination breakdown in the pot
  potStack: ChipStack;
  smallBlind: number;
  bigBlind: number;
  handNumber: number;
  currentBet: number;
  // Dealer selection draw (one card per player)
  dealerDrawCards: Record<string, Card | null>;
  dealerDrawRevealed: boolean;
  dealerDrawInProgress: boolean;
  // Simple action log for play-with-bots
  actionLog: ActionLogEntry[];
  // Card dealing state
  dealingState: {
    isDealing: boolean;
    currentDealIndex: number;
    dealOrder: number[];
    highlightHighCard: boolean;
    highCardPlayerIndex: number | null;
    stage: 'dealer-draw' | 'hole-cards' | 'flop' | 'turn' | 'river' | 'none';
  };
  // Game stage
  stage: 'DealerDraw' | 'PreFlop' | 'Flop' | 'Turn' | 'River' | 'Showdown';
  // Bot thinking scheduling
  botPendingIndex?: number | null;
  // Absolute server-side deadline for the current bot decision (RFC3339)
  botDecisionDueAt?: string | null;
  // Difficulty level that influences bot decisions
  difficulty?: Difficulty;
}

export interface DealConfig {
  smallBlind: number;
  bigBlind: number;
  numBots: number;
  startingChips: number;
  initialChipStack?: ChipStack;
  difficulty?: Difficulty;
}

export interface ActionLogEntry {
  message: string;
  time: string;
  isImportant?: boolean;
  status?: 'unfinished' | 'finished' | 'info' | 'warning' | 'error';
  winner?: string;
  winningCard?: string;
  toastShown?: boolean;
  allCards?: Array<{
    player: string;
    card: string;
    rank: string;
    suit: string;
    rankValue: number;
    suitValue: number;
  }>;
}



