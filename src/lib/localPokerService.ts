import { 
  localPokerEngine, 
  type GameState, 
  type PlayerAction
} from './localPokerEngine';

export class LocalPokerService {
  private botPlayers: Set<number> = new Set();
  
  async createGame(): Promise<GameState> {
    console.log('[LocalPokerService] Creating new game');
    const gameState = await localPokerEngine.resetGame();
    
    // Mark all non-human players as bots
    gameState.players.forEach((_, index) => {
      if (index !== 0) { // Assuming player 0 is the human
        console.log(`[LocalPokerService] Marking player ${index} as bot`);
        this.botPlayers.add(index);
      }
    });
    
    console.log('[LocalPokerService] Game created with state:', gameState);
    return gameState;
  }

  async getGameState(): Promise<GameState> {
    return localPokerEngine.getGameState();
  }

  async playerAction(_gameId: string, action: PlayerAction, amount: number = 0): Promise<GameState> {
    console.log(`[LocalPokerService] Player action: ${action} ${amount > 0 ? `(${amount})` : ''}`);
    // The bot actions are now handled synchronously in tableEngine.processNextAction
    // So we just need to execute the player action and return the result
    return localPokerEngine.playerAction(action, amount);
  }

  async resetGame(_gameId: string): Promise<GameState> {
    this.botPlayers.clear();
    return localPokerEngine.resetGame();
  }
}

export const localPokerService = new LocalPokerService();

export type { 
  GameState, 
  PlayerAction 
};

export default localPokerService;
