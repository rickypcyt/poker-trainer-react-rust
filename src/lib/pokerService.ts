// Types matching the Rust backend
export type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface Card {
  suit: Suit;
  rank: Rank;
}

export type HandRank = 
  | 'HighCard' 
  | 'Pair' 
  | 'TwoPair' 
  | 'ThreeOfAKind' 
  | 'Straight' 
  | 'Flush' 
  | 'FullHouse' 
  | 'FourOfAKind' 
  | 'StraightFlush' 
  | 'RoyalFlush';

export interface HandEvaluation {
  rank: HandRank;
  cards: Card[];
  kickers: Rank[];
  highlighted_cards: Card[];
  combination_type: string;
}

export type GameStage = 
  | 'Deal' 
  | 'PreFlop' 
  | 'Flop' 
  | 'Turn' 
  | 'River' 
  | 'Showdown' 
  | 'Folded' 
  | 'GameOver';

export type PlayerAction = 'Fold' | 'Call' | 'Raise';

export type LogKind = 'Info' | 'Action' | 'Deal' | 'Tip';

export interface LogEntry {
  message: string;
  stage: GameStage;
  kind: LogKind;
  time: string;
}

export interface GameState {
  game_id: string;
  deck: Card[];
  hole_cards: Card[];
  board: Card[];
  burned_cards?: Card[];
  stage: GameStage;
  logs: LogEntry[];
  pot: number;
  player_bet: number;
  dealer_bet: number;
  hand_evaluation?: HandEvaluation;
}

export interface PlayerActionRequest {
  action: PlayerAction;
}

class PokerService {
  private baseUrl: string;

  constructor(apiBase?: string) {
    this.baseUrl = apiBase ?? import.meta.env.VITE_BACKEND_URL ?? 'http://127.0.0.1:3000';
  }

  async createGame(): Promise<GameState> {
    console.log('🎮 [FRONTEND] Creating new poker game...');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/game`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to create game: ${response.status}`);
      }

      const gameState = await response.json();
      console.log('✅ [FRONTEND] Game created successfully:', gameState.game_id);
      return gameState;
    } catch (error) {
      console.error('💥 [FRONTEND] Error creating game:', error);
      throw error;
    }
  }

  async getGameState(gameId: string): Promise<GameState> {
    console.log('🔍 [FRONTEND] Getting game state for:', gameId);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/game/${gameId}`);

      if (!response.ok) {
        throw new Error(`Failed to get game state: ${response.status}`);
      }

      const gameState = await response.json();
      console.log('✅ [FRONTEND] Game state retrieved successfully');
      return gameState;
    } catch (error) {
      console.error('💥 [FRONTEND] Error getting game state:', error);
      throw error;
    }
  }

  async playerAction(gameId: string, action: PlayerAction): Promise<GameState> {
    console.log('🎯 [FRONTEND] Sending player action:', action, 'for game:', gameId);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/game/${gameId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      });

      if (!response.ok) {
        throw new Error(`Failed to send action: ${response.status}`);
      }

      const gameState = await response.json();
      console.log('✅ [FRONTEND] Action processed successfully');
      return gameState;
    } catch (error) {
      console.error('💥 [FRONTEND] Error sending action:', error);
      throw error;
    }
  }

  async resetGame(gameId: string): Promise<GameState> {
    console.log('🔄 [FRONTEND] Resetting game:', gameId);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/game/${gameId}/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to reset game: ${response.status}`);
      }

      const gameState = await response.json();
      console.log('✅ [FRONTEND] Game reset successfully');
      return gameState;
    } catch (error) {
      console.error('💥 [FRONTEND] Error resetting game:', error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  async fetchShuffledDeck(): Promise<Card[]> {
    console.log('🔗 [FRONTEND] Fetching shuffled deck from legacy endpoint');
    
    try {
      const response = await fetch(`${this.baseUrl}/api/deck`, { 
        cache: 'no-store' 
      });
      
      if (!response.ok) {
        throw new Error(`Failed to fetch deck: ${response.status}`);
      }
      
      const deck = await response.json();
      console.log('✅ [FRONTEND] Deck fetched successfully:', deck.length, 'cards');
      return deck;
    } catch (error) {
      console.error('💥 [FRONTEND] Error fetching deck:', error);
      throw error;
    }
  }
}

export const pokerService = new PokerService();
export default pokerService;
