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
  current_player: 'player' | 'dealer';
  dealer_hand: Card[];
  community_cards: Card[];
  current_bet: number;
  big_blind: number;
  hand_evaluation?: HandEvaluation;
}

export interface PlayerActionRequest {
  action: PlayerAction;
}

export interface BotDecisionRequest {
  hole_cards: Card[];
  board: Card[];
  stage: GameStage;
  pot: number;
  to_call: number;
  big_blind: number;
  min_raise: number;
}

export interface BotDecisionResponse {
  action: PlayerAction;
  raise_to?: number;
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

  async playerAction(gameId: string, action: PlayerAction, raiseAmount?: number): Promise<GameState> {
    console.log('🎯 [FRONTEND] Sending player action:', action, 'for game:', gameId, raiseAmount ? `(raise to: ${raiseAmount})` : '');
    
    try {
      const requestBody: any = { action };
      if (action === 'Raise' && raiseAmount !== undefined) {
        requestBody.raise_amount = raiseAmount;
      }
      
      const response = await fetch(`${this.baseUrl}/api/game/${gameId}/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
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

  // Get bot decision
  async getBotDecision(request: BotDecisionRequest): Promise<BotDecisionResponse> {
    console.log('🤖 [FRONTEND] Getting bot decision for stage:', request.stage);
    
    try {
      const response = await fetch(`${this.baseUrl}/api/bot/decide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Failed to get bot decision: ${response.status}`);
      }

      const decision = await response.json();
      console.log('✅ [FRONTEND] Bot decision received:', decision.action);
      return decision;
    } catch (error) {
      console.error('💥 [FRONTEND] Error getting bot decision:', error);
      // Default to fold on error
      return { action: 'Fold' };
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

// --- Multi-player table (server-side) API ---
// These types mirror the desired Rust backend for multi-seat tables (1 hero + up to 10 bots)
export type TableStage = 'DealerDraw' | 'PreFlop' | 'Flop' | 'Turn' | 'River' | 'Showdown';

export interface TablePlayer {
  id: string;
  name: string;
  is_bot: boolean;
  is_hero: boolean;
  chips: number;
  bet: number;
  hole_cards: Card[];
  has_folded: boolean;
  seat_index: number;
}

export interface TableLogEntry {
  message: string;
  time: string;
  kind?: LogKind;
  stage?: TableStage;
}

export interface PotStackBreakdown {
  [denom: number]: number;
}

export interface TableConfigRequest {
  small_blind: number;
  big_blind: number;
  num_bots: number; // 0..10
  starting_chips: number;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
}

export interface TableStateServer {
  table_id: string;
  deck: Card[];
  board: Card[];
  burned: Card[];
  players: TablePlayer[];
  dealer_index: number;
  small_blind_index: number;
  big_blind_index: number;
  current_player_index: number;
  pot: number;
  pot_stack: PotStackBreakdown;
  small_blind: number;
  big_blind: number;
  hand_number: number;
  current_bet: number;
  stage: TableStage;
  logs: TableLogEntry[];
  bot_pending_index?: number | null;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  // Optional dealer draw helpers
  dealer_draw_cards?: Record<string, Card | null>;
  dealer_draw_revealed?: boolean;
  dealer_draw_in_progress?: boolean;
}

export type TableAction = 'Fold' | 'Call' | 'Raise' | 'Check' | 'AllIn';

export interface TablePlayerActionRequest {
  player_id: string; // hero id
  action: TableAction;
  raise_to?: number; // absolute amount to raise to (bet size)
}

export const tableApi = {
  baseUrl: (apiBase?: string) => apiBase ?? (import.meta.env.VITE_BACKEND_URL as string) ?? 'http://127.0.0.1:3000',

  async createTable(config: TableConfigRequest, apiBase?: string): Promise<TableStateServer> {
    const base = tableApi.baseUrl(apiBase);
    const resp = await fetch(`${base}/api/table`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    });
    if (!resp.ok) throw new Error(`Failed to create table: ${resp.status}`);
    return await resp.json();
  },

  async getTableState(tableId: string, apiBase?: string): Promise<TableStateServer> {
    const base = tableApi.baseUrl(apiBase);
    const resp = await fetch(`${base}/api/table/${tableId}`);
    if (!resp.ok) throw new Error(`Failed to get table state: ${resp.status}`);
    return await resp.json();
  },

  async postAction(tableId: string, req: TablePlayerActionRequest, apiBase?: string): Promise<TableStateServer> {
    const base = tableApi.baseUrl(apiBase);
    const resp = await fetch(`${base}/api/table/${tableId}/action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });
    if (!resp.ok) throw new Error(`Failed to post action: ${resp.status}`);
    return await resp.json();
  },

  async nextStreet(tableId: string, apiBase?: string): Promise<TableStateServer> {
    const base = tableApi.baseUrl(apiBase);
    const resp = await fetch(`${base}/api/table/${tableId}/next_street`, {
      method: 'POST',
    });
    if (!resp.ok) throw new Error(`Failed to advance street: ${resp.status}`);
    return await resp.json();
  },

  async resetTable(tableId: string, apiBase?: string): Promise<TableStateServer> {
    const base = tableApi.baseUrl(apiBase);
    const resp = await fetch(`${base}/api/table/${tableId}/reset`, {
      method: 'POST',
    });
    if (!resp.ok) throw new Error(`Failed to reset table: ${resp.status}`);
    return await resp.json();
  },
};
