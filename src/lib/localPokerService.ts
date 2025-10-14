import { 
  localPokerEngine, 
  type GameState, 
  type PlayerAction, 
  type Card,
  type HandEvaluation,
  type LogEntry
} from './localPokerEngine';
import { gptBotService } from './gptBotService';

export class LocalPokerService {
  private gameId: string = 'local-game';
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
    const gameState = await localPokerEngine.playerAction(action, amount);
    
    // Process bot actions if it's their turn
    if (this.isBotsTurn(gameState)) {
      console.log(`[LocalPokerService] Bot's turn detected for player ${gameState.currentPlayerIndex}`);
      return this.processBotTurn(gameState);
    } else {
      console.log('[LocalPokerService] Not bot\'s turn, returning game state');
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
    const player = gameState.players[currentPlayerIndex];
    
    console.log(`[processBotTurn] Processing bot turn for player ${currentPlayerIndex}`, {
      playerChips: player.chips,
      currentBet: gameState.current_bet,
      playerBet: player.current_bet,
      toCall: gameState.current_bet - player.current_bet,
      pot: gameState.pot,
      stage: gameState.stage
    });
    
    try {
      console.log('[processBotTurn] Requesting decision from GPT bot service...');
      const decision = await gptBotService.makeDecision(gameState, currentPlayerIndex);
      console.log('[processBotTurn] Received bot decision:', decision);
      
      // Map bot action to game action
      let action: PlayerAction;
      let amount = 0;
      
      switch (decision.action) {
        case 'fold':
          action = 'Fold';
          console.log(`[processBotTurn] Bot chose to fold`);
          break;
        case 'check':
          action = 'Call';
          amount = 0;
          console.log(`[processBotTurn] Bot chose to check`);
          break;
        case 'call':
          action = 'Call';
          amount = gameState.current_bet - player.current_bet;
          console.log(`[processBotTurn] Bot chose to call ${amount}`);
          break;
        case 'raise':
        case 'allin':
          action = 'Raise';
          amount = decision.amount || (gameState.current_bet * 2);
          console.log(`[processBotTurn] Bot chose to raise to ${amount} (${decision.action})`);
          break;
        default:
          action = 'Call';
          console.warn(`[processBotTurn] Unknown bot action: ${decision.action}, defaulting to call`);
      }
      
      console.log(`[processBotTurn] Executing bot action: ${action} ${amount > 0 ? `(${amount})` : ''}`);
      const updatedState = await localPokerEngine.playerAction(action, amount);
      
      // If it's still the bot's turn (e.g., after a raise), process the next action
      if (this.isBotsTurn(updatedState) && updatedState.currentPlayerIndex === currentPlayerIndex) {
        console.log('[processBotTurn] Bot still has actions, processing next action...');
        return this.processBotTurn(updatedState);
      }
      
      console.log('[processBotTurn] Bot turn complete');
      return updatedState;
    } catch (error) {
      console.error('[processBotTurn] Error processing bot turn:', error);
      // Default to check/call if there's an error
      console.log('[processBotTurn] Falling back to check/call due to error');
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
