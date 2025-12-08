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
  private currentHandId: string | null = null;

  constructor(apiBase: string = 'http://localhost:8001') {
    this.apiBase = apiBase;
    console.log('[Python Bot] Initializing Python bot service...');
    console.log('[Python Bot] Bot service initialized successfully');
  }

  async generateHandId(): Promise<string> {
    try {
      const response = await fetch(`${this.apiBase}/hand_id`);
      const data = await response.json();
      if (data.hand_id) {
        this.currentHandId = data.hand_id;
        console.log(`[Python Bot] Generated hand ID: ${this.currentHandId}`);
        return this.currentHandId;
      } else {
        throw new Error('No hand_id in response');
      }
    } catch (error) {
      console.error('[Python Bot] Error generating hand ID:', error);
      // Fallback: generate simple ID
      const fallbackId = `hand_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.currentHandId = fallbackId;
      return fallbackId;
    }
  }

  getCurrentHandId(): string | null {
    return this.currentHandId;
  }

  async logHandComplete(gameState: TableState, winnerInfo: Record<string, unknown>): Promise<void> {
    if (!this.currentHandId) {
      console.warn('[Python Bot] No hand ID available for logging');
      return;
    }

    try {
      // Gather complete hand information
      const handData = {
        final_stage: gameState.stage,
        final_pot: gameState.pot,
        community_cards: (gameState.communityCards || gameState.board || []).map(card => this.convertCard(card)),
        players: gameState.players.map((player, index) => ({
          name: player.name,
          is_hero: player.isHero,
          position: this.getPositionName(index, gameState.players.length, gameState.dealerIndex),
          chips_start: player.chips + player.bet, // Approximate start chips
          chips_end: player.chips,
          final_bet: player.bet,
          has_folded: player.hasFolded,
          hole_cards: (player.holeCards || []).map(card => this.convertCard(card)),
          ai_personality: player.ai?.personality,
          ai_difficulty: player.ai?.difficulty
        })),
        action_log: gameState.actionLog || [],
        dealer_index: gameState.dealerIndex,
        big_blind: gameState.bigBlind,
        small_blind: gameState.smallBlind,
        winner_info: winnerInfo,
        hand_duration: Date.now() - (this.currentHandId ? parseInt(this.currentHandId.split('_')[1]) : Date.now())
      };

      const response = await fetch(`${this.apiBase}/hand_complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          hand_id: this.currentHandId,
          final_results: handData
        })
      });

      if (response.ok) {
        console.log(`[Python Bot] Hand ${this.currentHandId} logged successfully`);
        this.currentHandId = null; // Reset for next hand
      } else {
        console.error('[Python Bot] Error logging hand completion:', await response.text());
      }
    } catch (error) {
      console.error('[Python Bot] Error logging hand complete:', error);
    }
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
    
    // Calculate effective stack (minimum stack among active players)
    const activePlayers = gameState.players.filter(p => !p.hasFolded);
    const effectiveStack = Math.min(...activePlayers.map(p => p.chips));
    
    // Build action history from game state
    const actionHistory = this.buildActionHistory(gameState);
    
    // Calculate position names using dealerIndex instead of dealerPosition
    const botPosition = this.getPositionName(playerIndex, gameState.players.length, gameState.dealerIndex);
    
    // Build enhanced payload for Python service
    const payload = {
      stage: gameState.stage,
      bigBlind: gameState.bigBlind,
      smallBlind: gameState.smallBlind,
      pot: gameState.pot,
      highestBet: highestBet,
      toCall: toCall,
      hand_id: this.currentHandId, // Include hand_id for logging
      bot: {
        chips: player.chips,
        bet: player.bet,
        holeCards: (player.holeCards || []).map(card => this.convertCard(card)),
        positionIndex: playerIndex,
        seatIndex: player.seatIndex,
        position: botPosition,
        personality: this.convertPersonality(player.ai?.personality || 'Balanced'),
        difficulty: this.convertDifficulty(player.ai?.difficulty || gameState.difficulty || 'Medium')
      },
      players: gameState.players.map((p, idx) => ({
        chips: p.chips,
        bet: p.bet,
        hasFolded: p.hasFolded,
        isHero: p.isHero,
        position: this.getPositionName(idx, gameState.players.length, gameState.dealerIndex)
        // Note: stats not available in current Player interface
      })),
      board: (gameState.communityCards || gameState.board || []).map(card => this.convertCard(card)),
      context: {
        dealerPosition: gameState.dealerIndex,
        playersActive: activePlayers.length,
        effectiveStack: effectiveStack,
        street: gameState.stage,
        actionHistory: actionHistory,
        minRaise: Math.max(gameState.bigBlind * 2, highestBet * 2),
        maxRaise: player.chips,
        canCheck: toCall === 0,
        canRaise: player.chips > toCall
      }
    };

    try {
      const decision = await requestBotDecision(this.apiBase, payload);
      
      const botDecision: BotDecision = {
        action: this.convertAction(decision.action),
        amount: decision.raiseTo || toCall,
        reasoning: decision.rationale || 'Python bot decision'
      };

      // Convert call with 0 amount to check
      if (botDecision.action === 'call' && (!botDecision.amount || botDecision.amount === 0)) {
        botDecision.action = 'check';
        botDecision.amount = undefined;
      }

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

  private buildActionHistory(gameState: TableState): Array<{
    playerIndex: number;
    action: string;
    amount?: number;
    street: string;
  }> {
    // Build action history from actionLog if available
    const history: Array<{
      playerIndex: number;
      action: string;
      amount?: number;
      street: string;
    }> = [];
    
    // Parse action log to extract structured actions
    if (gameState.actionLog) {
      gameState.actionLog.forEach((entry) => {
        // Simple parsing - you can enhance this based on your log format
        if (entry.message.includes('raises') || entry.message.includes('bets')) {
          const match = entry.message.match(/(\w+)\s+(raises|bets)\s+(\d+)/);
          if (match) {
            const playerName = match[1];
            const action = match[2];
            const amount = parseInt(match[3]);
            const playerIndex = gameState.players.findIndex(p => p.name === playerName);
            
            if (playerIndex >= 0) {
              history.push({
                playerIndex,
                action: action.toLowerCase(),
                amount,
                street: gameState.stage
              });
            }
          }
        } else if (entry.message.includes('calls')) {
          const match = entry.message.match(/(\w+)\s+calls/);
          if (match) {
            const playerName = match[1];
            const playerIndex = gameState.players.findIndex(p => p.name === playerName);
            
            if (playerIndex >= 0) {
              history.push({
                playerIndex,
                action: 'call',
                street: gameState.stage
              });
            }
          }
        } else if (entry.message.includes('folds')) {
          const match = entry.message.match(/(\w+)\s+folds/);
          if (match) {
            const playerName = match[1];
            const playerIndex = gameState.players.findIndex(p => p.name === playerName);
            
            if (playerIndex >= 0) {
              history.push({
                playerIndex,
                action: 'fold',
                street: gameState.stage
              });
            }
          }
        } else if (entry.message.includes('checks')) {
          const match = entry.message.match(/(\w+)\s+checks/);
          if (match) {
            const playerName = match[1];
            const playerIndex = gameState.players.findIndex(p => p.name === playerName);
            
            if (playerIndex >= 0) {
              history.push({
                playerIndex,
                action: 'check',
                street: gameState.stage
              });
            }
          }
        }
      });
    }
    
    return history;
  }

  private getPositionName(index: number, totalPlayers: number, dealerPosition: number): string {
    const positions = this.getPositions(totalPlayers);
    const adjustedIndex = (index - dealerPosition + totalPlayers) % totalPlayers;
    return positions[adjustedIndex] || 'Unknown';
  }

  private getPositions(totalPlayers: number): string[] {
    switch (totalPlayers) {
      case 2: return ['BB', 'SB'];
      case 3: return ['BB', 'SB', 'BTN'];
      case 4: return ['BB', 'SB', 'BTN', 'CO'];
      case 5: return ['BB', 'SB', 'BTN', 'CO', 'MP'];
      case 6: return ['BB', 'SB', 'BTN', 'CO', 'MP', 'UTG'];
      case 7: return ['BB', 'SB', 'BTN', 'CO', 'MP1', 'MP2', 'UTG'];
      case 8: return ['BB', 'SB', 'BTN', 'CO', 'MP1', 'MP2', 'UTG1', 'UTG2'];
      case 9: return ['BB', 'SB', 'BTN', 'CO', 'MP1', 'MP2', 'MP3', 'UTG1', 'UTG2'];
      default: return ['BB', 'SB', 'BTN', 'CO', 'MP', 'UTG'];
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
