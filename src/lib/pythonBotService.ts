import type { Difficulty, Personality, TableState } from '../types/table';
import type { Card } from './pokerService';
import { requestBotDecision, type BotDecision as PythonBotDecision } from './botService';

export type BotAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface BotDecision {
  action: BotAction;
  amount?: number;
  reasoning: string;
}

export class PythonBotService {
  private apiBase: string;

  constructor(apiBase: string = 'http://localhost:8001') {
    this.apiBase = apiBase;
    console.log('[Python Bot] Initializing Python bot service...');
    console.log('[Python Bot] Bot service initialized successfully');
  }

  private convertCard(card: Card) {
    return {
      rank: card.rank,
      suit: card.suit.toLowerCase() as 'clubs' | 'diamonds' | 'hearts' | 'spades'
    };
  }

  private convertPersonality(personality: Personality): string {
    const personalityMap = {
      'Aggressive': 'Aggressive',
      'Passive': 'Passive', 
      'Balanced': 'Balanced',
      'Maniac': 'Maniac',
      'Nit': 'Nit'
    };
    return personalityMap[personality] || 'Balanced';
  }

  private convertDifficulty(difficulty: Difficulty): string {
    return difficulty;
  }

  private convertAction(action: PythonBotDecision['action']): BotAction {
    switch (action) {
      case 'Fold': return 'fold';
      case 'Call': return 'call';
      case 'Raise': return 'raise';
      case 'AllIn': return 'allin';
      default: return 'fold';
    }
  }

  async makeDecision(gameState: TableState, playerIndex: number): Promise<BotDecision> {
    console.log(`[Python Bot] Making decision for player ${playerIndex} at ${new Date().toISOString()}`);
    
    const player = gameState.players[playerIndex];
    const highestBet = Math.max(0, ...gameState.players.map(p => p.bet));
    const toCall = Math.max(0, highestBet - player.bet);
    
    // Build payload for Python service
    const payload = {
      stage: gameState.stage,
      bigBlind: gameState.bigBlind,
      smallBlind: gameState.smallBlind,
      pot: gameState.pot,
      highestBet: highestBet,
      toCall: toCall,
      bot: {
        chips: player.chips,
        bet: player.bet,
        holeCards: (player.holeCards || []).map(card => this.convertCard(card)),
        positionIndex: playerIndex,
        seatIndex: playerIndex,
        personality: this.convertPersonality(player.ai?.personality || 'Balanced'),
        difficulty: this.convertDifficulty(player.ai?.difficulty || gameState.difficulty || 'Medium')
      },
      players: gameState.players.map(p => ({
        chips: p.chips,
        bet: p.bet,
        hasFolded: p.hasFolded,
        isHero: p.isHero
      })),
      board: (gameState.communityCards || gameState.board || []).map(card => this.convertCard(card))
    };

    try {
      const decision = await requestBotDecision(this.apiBase, payload);
      
      const botDecision: BotDecision = {
        action: this.convertAction(decision.action),
        amount: decision.raiseTo || toCall,
        reasoning: decision.rationale || 'Python bot decision'
      };

      console.log(`[Python Bot] Decision: ${botDecision.action} ${botDecision.amount ? `$${botDecision.amount}` : ''} - ${botDecision.reasoning}`);
      
      return botDecision;
    } catch (error) {
      console.error('[Python Bot] Error getting decision:', error);
      // Fallback to simple decision
      return {
        action: toCall > 0 ? 'fold' : 'check',
        reasoning: 'Python bot unavailable - using fallback'
      };
    }
  }

  updateSettings(): void {
    console.log('[Python Bot] Settings updated (no changes needed for Python bot)');
  }

  getCurrentModel(): string {
    return 'Python Bot (FastAPI + treys)';
  }
}

// Singleton instance
export const pythonBotService = new PythonBotService();
