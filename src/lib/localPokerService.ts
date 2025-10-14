import { 
  localPokerEngine, 
  type GameState, 
  type PlayerAction, 
  type Card,
  type HandEvaluation,
  type LogEntry
} from './localPokerEngine';
import { gptBotService, type BotAction } from './gptBotService';

export class LocalPokerService {
  private gameId: string = 'local-game';
  private botPlayers: Set<number> = new Set();
  
  async createGame(): Promise<GameState> {
    const gameState = await localPokerEngine.resetGame();
    // Mark all non-human players as bots
    gameState.players.forEach((_, index) => {
      if (index !== 0) { // Assuming player 0 is the human
        this.botPlayers.add(index);
      }
    });
    return gameState;
  }

  async getGameState(): Promise<GameState> {
    return localPokerEngine.getGameState();
  }

  async playerAction(_gameId: string, action: PlayerAction, amount: number = 0): Promise<GameState> {
    const gameState = await localPokerEngine.playerAction(action, amount);
    
    // Process bot actions if it's their turn
    if (this.isBotsTurn(gameState)) {
      return this.processBotTurn(gameState);
    }
    
    return gameState;
  }

  async resetGame(_gameId: string): Promise<GameState> {
    this.botPlayers.clear();
    return localPokerEngine.resetGame();
  }

  private isBotsTurn(gameState: GameState): boolean {
    const currentPlayerIndex = gameState.currentPlayerIndex;
    return this.botPlayers.has(currentPlayerIndex);
  }

  private async processBotTurn(gameState: GameState): Promise<GameState> {
    const currentPlayerIndex = gameState.currentPlayerIndex;
    
    try {
      // Get bot's decision
      const decision = await gptBotService.makeDecision(gameState, currentPlayerIndex);
      
      // Map bot action to game action
      let action: PlayerAction;
      let amount = 0;
      
      switch (decision.action) {
        case 'fold':
          action = 'Fold';
          break;
        case 'check':
          action = 'Call';
          amount = 0;
          break;
        case 'call':
          action = 'Call';
          amount = gameState.current_bet - gameState.players[currentPlayerIndex].current_bet;
          break;
        case 'raise':
        case 'allin':
          action = 'Raise';
          amount = decision.amount || (gameState.current_bet * 2);
          break;
        default:
          action = 'Call';
      }
      
      // Execute the bot's action
      const updatedState = await localPokerEngine.playerAction(action, amount);
      
      // If it's still the bot's turn (e.g., after a raise), process the next action
      if (this.isBotsTurn(updatedState) && updatedState.currentPlayerIndex === currentPlayerIndex) {
        return this.processBotTurn(updatedState);
      }
      
      return updatedState;
    } catch (error) {
      console.error('Error processing bot turn:', error);
      // Default to check/call if there's an error
      return localPokerEngine.playerAction('Call', 0);
    }
  }
}

export const localPokerService = new LocalPokerService();

export type { 
  GameState, 
  PlayerAction, 
  Card, 
  HandEvaluation, 
  LogEntry 
};

export default localPokerService;
