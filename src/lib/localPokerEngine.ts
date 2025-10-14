import { shuffleDeck } from './shuffle';
import { createStandardDeck } from './deck';

type Suit = 'hearts' | 'diamonds' | 'clubs' | 'spades';
type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

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

type LogKind = 'Info' | 'Action' | 'Deal' | 'Tip';

export interface LogEntry {
  message: string;
  stage: GameStage;
  kind: LogKind;
  time: string;
}

export interface Player {
  id: string;
  chips: number;
  current_bet: number;
  hand: Card[];
  isActive: boolean;
  hasFolded: boolean;
  isAllIn: boolean;
}

export interface GameState {
  game_id: string;
  players: Player[];
  currentPlayerIndex: number;
  player_hand: Card[];
  board: Card[];
  communityCards: Card[];
  stage: GameStage;
  pot: number;
  current_bet: number;
  player_chips: number;
  logs: LogEntry[];
  hand_evaluation?: HandEvaluation;
  smallBlind: number;
  bigBlind: number;
  dealerPosition: number;
  smallBlindPosition: number;
  bigBlindPosition: number;
}

export class LocalPokerEngine {
  private deck: Card[] = [];
  private gameState: GameState;
  private smallBlind = 10;
  private bigBlind = 20;
  private playerBet = 0;

  constructor() {
    this.deck = [];
    this.gameState = this.initialGameState();
    this.newHand();
  }

  private initialGameState(): GameState {
    const initialPlayer = {
      id: 'player-1',
      chips: 1000,
      current_bet: 0,
      hand: [],
      isActive: true,
      hasFolded: false,
      isAllIn: false,
    };

    return {
      game_id: 'local-game',
      players: [initialPlayer],
      currentPlayerIndex: 0,
      player_hand: [],
      board: [],
      communityCards: [],
      stage: 'Deal',
      pot: 0,
      current_bet: 0,
      player_chips: 1000,
      logs: [],
      smallBlind: 10,
      bigBlind: 20,
      dealerPosition: 0,
      smallBlindPosition: 0,
      bigBlindPosition: 1,
    };
  }

  private addLog(message: string, kind: LogKind = 'Info') {
    this.gameState.logs.push({
      message,
      stage: this.gameState.stage,
      kind,
      time: new Date().toISOString(),
    });
  }

  private newHand() {
    this.deck = shuffleDeck(createStandardDeck());
    this.gameState = this.initialGameState();
    this.dealHand();
    this.addLog('New hand dealt', 'Deal');
  }

  private dealHand() {
    // Deal player's hole cards
    this.gameState.player_hand = [this.deck.pop()!, this.deck.pop()!];
    this.gameState.stage = 'PreFlop';
    this.addLog(`You were dealt ${this.formatCards(this.gameState.player_hand)}`, 'Deal');
  }

  private formatCards(cards: Card[]): string {
    return cards.map(card => `${card.rank} of ${card.suit}`).join(', ');
  }

  private dealFlop() {
    // Burn a card
    this.deck.pop();
    // Deal flop (3 cards)
    this.gameState.board = [this.deck.pop()!, this.deck.pop()!, this.deck.pop()!];
    this.gameState.stage = 'Flop';
    this.addLog(`Flop: ${this.formatCards(this.gameState.board)}`, 'Deal');
  }

  private dealTurnOrRiver() {
    // Burn a card
    this.deck.pop();
    // Deal one card
    this.gameState.board.push(this.deck.pop()!);
    
    if (this.gameState.stage === 'Flop') {
      this.gameState.stage = 'Turn';
      this.addLog(`Turn: ${this.formatCards([this.gameState.board[3]])}`, 'Deal');
    } else if (this.gameState.stage === 'Turn') {
      this.gameState.stage = 'River';
      this.addLog(`River: ${this.formatCards([this.gameState.board[4]])}`, 'Deal');
    }
  }

  private evaluateHand(): HandEvaluation {
    // This is a simplified evaluation - you'll want to implement proper hand ranking logic
    const allCards = [...this.gameState.player_hand, ...this.gameState.board];
    
    // Placeholder - implement actual hand evaluation
    return {
      rank: 'HighCard',
      cards: [...allCards].sort(() => Math.random() - 0.5).slice(0, 2),
      kickers: [],
      highlighted_cards: [...allCards].sort(() => Math.random() - 0.5).slice(0, 2),
      combination_type: 'High Card',
    };
  }

  public async playerAction(action: PlayerAction, amount: number = 0): Promise<GameState> {
    if (this.gameState.stage === 'GameOver') {
      this.newHand();
      return this.gameState;
    }

    switch (action) {
      case 'Fold':
        this.addLog('You folded', 'Action');
        this.gameState.stage = 'Folded';
        break;
        
      case 'Call':
        const callAmount = this.gameState.current_bet - this.playerBet;
        if (callAmount > 0) {
          this.gameState.player_chips -= callAmount;
          this.gameState.pot += callAmount;
          this.playerBet = this.gameState.current_bet;
          this.addLog(`You called ${callAmount}`, 'Action');
        } else {
          this.addLog('You checked', 'Action');
        }
        break;
        
      case 'Raise':
        const raiseAmount = amount;
        if (raiseAmount > 0) {
          const totalBet = this.playerBet + raiseAmount;
          this.gameState.player_chips -= raiseAmount;
          this.gameState.pot += raiseAmount;
          this.gameState.current_bet = totalBet;
          this.playerBet = totalBet;
          this.addLog(`You raised to ${totalBet}`, 'Action');
        }
        break;
    }

    // Progress the game state
    this.progressGame();
    
    return { ...this.gameState };
  }

  private progressGame() {
    switch (this.gameState.stage) {
      case 'PreFlop':
        this.dealFlop();
        break;
        
      case 'Flop':
      case 'Turn':
        this.dealTurnOrRiver();
        break;
        
      case 'River':
        this.gameState.hand_evaluation = this.evaluateHand();
        this.gameState.stage = 'Showdown';
        this.addLog(`Hand complete! You have ${this.gameState.hand_evaluation.combination_type}`, 'Deal');
        break;
        
      case 'Showdown':
      case 'Folded':
        this.gameState.stage = 'GameOver';
        this.addLog('Hand over. Starting new hand...', 'Info');
        // Auto-start a new hand after a short delay
        setTimeout(() => this.newHand(), 2000);
        break;
    }
  }

  public getGameState(): GameState {
    return { ...this.gameState };
  }

  public async resetGame(): Promise<GameState> {
    this.newHand();
    return this.getGameState();
  }
}

export const localPokerEngine = new LocalPokerEngine();
