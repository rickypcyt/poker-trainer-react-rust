import { 
  localPokerEngine, 
  type GameState, 
  type PlayerAction, 
  type Card,
  type HandEvaluation,
  type LogEntry
} from './localPokerEngine';

export class LocalPokerService {
  private gameId: string = 'local-game';
  
  async createGame(): Promise<GameState> {
    return localPokerEngine.resetGame();
  }

  async getGameState(): Promise<GameState> {
    return localPokerEngine.getGameState();
  }

  async playerAction(_gameId: string, action: PlayerAction, amount: number = 0): Promise<GameState> {
    return localPokerEngine.playerAction(action, amount);
  }

  async resetGame(_gameId: string): Promise<GameState> {
    return localPokerEngine.resetGame();
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
