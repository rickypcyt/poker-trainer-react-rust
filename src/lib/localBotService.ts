import type { Difficulty, Personality, TableState } from '../types/table';

import type { Card } from './pokerService';

export type BotAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface BotDecision {
  action: BotAction;
  amount?: number;
  reasoning: string;
}

export class LocalBotService {

  constructor() {
    console.log('[Local Bot] Initializing local bot service...');
    console.log('[Local Bot] Bot service initialized successfully');
  }

  private formatCards(cards: Array<{rank: string, suit: string}>): string {
    if (!cards || cards.length === 0) return 'No cards';
    return cards.map(card => `${card.rank} of ${card.suit}`).join(', ');
  }

  private getRankOrder(): Record<string, number> {
    return {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
      '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
    };
  }

  private categorizePreflopHand(hole: Card[]): 'Premium' | 'Good' | 'Speculative' | 'Trash' {
    if (!hole || hole.length < 2) return 'Trash';
    const rankOrder = this.getRankOrder();
    const [c1, c2] = hole;
    const r1 = rankOrder[c1.rank];
    const r2 = rankOrder[c2.rank];
    const hi = Math.max(r1, r2);
    const lo = Math.min(r1, r2);
    const pair = c1.rank === c2.rank;
    const suited = c1.suit === c2.suit;
    const gap = Math.abs(r1 - r2);

    const valueToRank = (v: number) => Object.keys(rankOrder).find(k => rankOrder[k] === v) as Card['rank'];
    const hiRank = valueToRank(hi);
    const loRank = valueToRank(lo);

    // Premium
    const isAK = (hiRank === 'A' && loRank === 'K');
    if (pair && (hiRank === 'A' || hiRank === 'K' || hiRank === 'Q')) return 'Premium';
    if (isAK) return 'Premium';

    // Good
    if (pair && (hiRank === 'J' || hiRank === '10')) return 'Good';
    const isAQ = (hiRank === 'A' && loRank === 'Q');
    const isAJ = (hiRank === 'A' && loRank === 'J');
    const isKQ = (hiRank === 'K' && loRank === 'Q');
    if (isAQ || isAJ || isKQ) return 'Good';

    // Speculative
    const isSmallPair = pair && hiRank !== 'A' && hiRank !== 'K' && hiRank !== 'Q' && hiRank !== 'J' && hiRank !== '10';
    const suitedConnectors = suited && gap <= 2 && hi >= 5 && lo >= 2;
    if (isSmallPair || suitedConnectors) return 'Speculative';

    return 'Trash';
  }

  private evaluateHandStrength(hole: Card[], community: Card[]): number {
    const allCards = [...hole, ...community];
    if (allCards.length < 2) return 0;

    const rankOrder = this.getRankOrder();
    let score = 0;

    // Check for pairs
    const rankCounts: Record<string, number> = {};
    for (const card of allCards) {
      rankCounts[card.rank] = (rankCounts[card.rank] || 0) + 1;
    }

    // Score based on best combination
    const counts = Object.values(rankCounts).sort((a, b) => b - a);
    
    if (counts[0] === 4) score += 8000; // Four of a kind
    else if (counts[0] === 3 && counts[1] === 2) score += 7000; // Full house
    else if (counts[0] === 3) score += 4000; // Three of a kind
    else if (counts[0] === 2 && counts[1] === 2) score += 3000; // Two pair
    else if (counts[0] === 2) score += 2000; // One pair

    // Add high card value
    const highCard = Math.max(...allCards.map(c => rankOrder[c.rank]));
    score += highCard;

    // Check for flush potential
    const suitCounts: Record<string, number> = {};
    for (const card of allCards) {
      suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
    }
    if (Math.max(...Object.values(suitCounts)) >= 4) score += 1000;

    // Check for straight potential
    const ranks = [...new Set(allCards.map(c => rankOrder[c.rank]))].sort((a, b) => a - b);
    let consecutive = 1;
    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i-1] + 1) consecutive++;
      else consecutive = 1;
      if (consecutive >= 4) score += 500;
    }

    return score;
  }

  private makePreflopDecision(gameState: TableState, playerIndex: number): BotDecision {
    const player = gameState.players[playerIndex];
    const hole = player.holeCards || [];
    const category = this.categorizePreflopHand(hole);
    const difficulty = (player.ai?.difficulty || gameState.difficulty || 'Medium') as Difficulty;
    const personality = (player.ai?.personality || 'Balanced') as Personality;
    
    const highestBet = Math.max(0, ...gameState.players.map(p => p.bet));
    const toCall = Math.max(0, highestBet - player.bet);
    const bigBlind = gameState.bigBlind;
    const pot = gameState.pot;
    const potOdds = toCall === 0 ? 0 : toCall / Math.max(1, pot + toCall);

    // Position calculation
    const n = gameState.players.length;
    const dealerIndex = gameState.dealerIndex ?? 0;
    const posIndex = ((playerIndex - dealerIndex + n) % n);
    const latePosition = posIndex >= Math.floor(n * 0.6);
    const midPosition = posIndex >= Math.floor(n * 0.3);

    // Personality adjustments
    const isAggressive = personality === 'Aggressive' || personality === 'Maniac';
    const isPassive = personality === 'Passive' || personality === 'Nit';
    const isManiac = personality === 'Maniac';
    const isNit = personality === 'Nit';

    // Stack depth
    const stackBB = Math.floor(player.chips / bigBlind);
    const shortStack = stackBB < 20;
    const deepStack = stackBB > 60;

    // Use personality and stack variables in decision logic
    const shouldAdjustForPersonality = isAggressive || isPassive || isManiac || isNit;
    const stackAdjustment = shortStack ? -0.2 : deepStack ? 0.2 : 0;
    
    console.log(`[Local Bot] Strategy: ${personality}, Stack: ${stackBB}BB, Position: ${posIndex}, Personality Adj: ${shouldAdjustForPersonality}`);
    
    // Decision logic based on hand category
    if (category === 'Premium') {
      if (toCall === 0) {
        const raiseSize = Math.floor(bigBlind * (2.5 + Math.random() * 2 + stackAdjustment));
        return {
          action: 'raise',
          amount: raiseSize,
          reasoning: `Premium hand (${this.formatCards(hole)}) - raising for value${shortStack ? ' (short stack)' : deepStack ? ' (deep stack)' : ''}`
        };
      } else {
        if (potOdds <= 0.3 || (isAggressive && Math.random() < 0.7)) {
          const raiseSize = Math.floor(highestBet * (2 + Math.random() * 2 + stackAdjustment));
          return {
            action: 'raise',
            amount: raiseSize,
            reasoning: `Premium hand facing bet - 3-betting for value${shortStack ? ' (short stack)' : deepStack ? ' (deep stack)' : ''}`
          };
        }
        return {
          action: 'call',
          amount: toCall,
          reasoning: `Premium hand with good pot odds - calling (difficulty: ${difficulty})`
        };
      }
    }

    if (category === 'Good') {
      if (toCall === 0) {
        if ((latePosition || isAggressive) && Math.random() < 0.8) {
          const raiseSize = Math.floor(bigBlind * (2 + Math.random() * 1.5 + stackAdjustment));
          return {
            action: 'raise',
            amount: raiseSize,
            reasoning: `Good hand in position - raising${shortStack ? ' (short stack)' : deepStack ? ' (deep stack)' : ''}`
          };
        }
        return {
          action: 'check',
          reasoning: `Good hand - checking to see flop (difficulty: ${difficulty})`
        };
      } else {
        if (potOdds <= 0.25 && (midPosition || latePosition)) {
          return {
            action: 'call',
            amount: toCall,
            reasoning: `Good hand with decent pot odds - calling (difficulty: ${difficulty})`
          };
        }
        return {
          action: 'fold',
          reasoning: `Good hand but poor pot odds/position - folding (difficulty: ${difficulty})`
        };
      }
    }

    if (category === 'Speculative') {
      if (toCall === 0) {
        if (latePosition && (isAggressive || Math.random() < 0.3)) {
          const raiseSize = Math.floor(bigBlind * (2 + Math.random() + stackAdjustment));
          return {
            action: 'raise',
            amount: raiseSize,
            reasoning: `Speculative hand in position - semi-bluff raising${shortStack ? ' (short stack)' : deepStack ? ' (deep stack)' : ''}`
          };
        }
        return {
          action: 'check',
          reasoning: `Speculative hand - checking to see flop cheap (difficulty: ${difficulty})`
        };
      } else {
        if (potOdds <= 0.15 && (latePosition || hole[0]?.suit === hole[1]?.suit)) {
          return {
            action: 'call',
            amount: toCall,
            reasoning: `Speculative hand with excellent pot odds - calling (difficulty: ${difficulty})`
          };
        }
        return {
          action: 'fold',
          reasoning: `Speculative hand without good odds - folding (difficulty: ${difficulty})`
        };
      }
    }

    // Trash hands
    if (toCall === 0 && latePosition && isManiac && Math.random() < 0.1) {
      const raiseSize = Math.floor(bigBlind * 2);
      return {
        action: 'raise',
        amount: raiseSize,
        reasoning: `Trash hand but stealing from late position (difficulty: ${difficulty})`
      };
    }
    
    if (toCall === 0) {
      return {
        action: 'check',
        reasoning: `Trash hand - checking for free flop (difficulty: ${difficulty})`
      };
    }
    
    return {
      action: 'fold',
      reasoning: `Trash hand facing bet - folding (difficulty: ${difficulty})`
    };
  }

  private makePostflopDecision(gameState: TableState, playerIndex: number): BotDecision {
    const player = gameState.players[playerIndex];
    const hole = player.holeCards || [];
    const community = gameState.communityCards || gameState.board || [];
    const handStrength = this.evaluateHandStrength(hole, community);
    
    const difficulty = (player.ai?.difficulty || gameState.difficulty || 'Medium') as Difficulty;
    const personality = (player.ai?.personality || 'Balanced') as Personality;
    
    const highestBet = Math.max(0, ...gameState.players.map(p => p.bet));
    const toCall = Math.max(0, highestBet - player.bet);
    const pot = gameState.pot;
    const potOdds = toCall === 0 ? 0 : toCall / Math.max(1, pot + toCall);

    // Position calculation
    const n = gameState.players.length;
    const dealerIndex = gameState.dealerIndex ?? 0;
    const posIndex = ((playerIndex - dealerIndex + n) % n);
    const latePosition = posIndex >= Math.floor(n * 0.6);

    // Personality adjustments
    const isAggressive = personality === 'Aggressive' || personality === 'Maniac';
    const isPassive = personality === 'Passive' || personality === 'Nit';
    const isManiac = personality === 'Maniac';

    // Use personality variables in decision logic
    const aggressionFactor = isAggressive ? 1.2 : isPassive ? 0.8 : 1.0;
    const maniacAdjustment = isManiac ? 0.1 : 0;
    
    console.log(`[Local Bot] Postflop Strategy: ${personality}, Aggressive: ${isAggressive}, Maniac: ${isManiac}, Factor: ${aggressionFactor}`);
    
    // Hand strength thresholds (adjust based on community cards)
    const strongHand = handStrength >= 3000;
    const mediumHand = handStrength >= 1500;
    const weakHand = handStrength < 1500;

    // Use hand strength classification
    const handCategory = strongHand ? 'strong' : mediumHand ? 'medium' : 'weak';
    console.log(`[Local Bot] Hand strength: ${handCategory} (${handStrength})`);

    // Decision logic
    if (strongHand) {
      if (toCall === 0) {
        const betSize = Math.floor(pot * (0.5 + Math.random() * 0.5) * aggressionFactor + maniacAdjustment);
        return {
          action: 'raise',
          amount: betSize,
          reasoning: `Strong hand (${handStrength}) - betting for value${isManiac ? ' (maniac aggression)' : ''}`
        };
      } else {
        if (potOdds <= 0.4 || (isAggressive && Math.random() < 0.8)) {
          const raiseSize = Math.floor(pot * (0.8 + Math.random() * 0.8) * aggressionFactor + maniacAdjustment);
          return {
            action: 'raise',
            amount: raiseSize,
            reasoning: `Strong hand facing bet - raising for value${isManiac ? ' (maniac aggression)' : ''}`
          };
        }
        return {
          action: 'call',
          amount: toCall,
          reasoning: `Strong hand - calling (difficulty: ${difficulty})`
        };
      }
    }

    if (mediumHand) {
      if (toCall === 0) {
        if ((latePosition || isAggressive) && Math.random() < 0.6) {
          const betSize = Math.floor(pot * (0.3 + Math.random() * 0.3) * aggressionFactor + maniacAdjustment);
          return {
            action: 'raise',
            amount: betSize,
            reasoning: `Medium hand in position - betting${isManiac ? ' (maniac aggression)' : ''}`
          };
        }
        return {
          action: 'check',
          reasoning: `Medium hand - checking (difficulty: ${difficulty})`
        };
      } else {
        if (potOdds <= 0.2 && (latePosition || isAggressive)) {
          return {
            action: 'call',
            amount: toCall,
            reasoning: `Medium hand with good odds - calling (difficulty: ${difficulty})`
          };
        }
        return {
          action: 'fold',
          reasoning: `Medium hand without good odds - folding (difficulty: ${difficulty})`
        };
      }
    }

    // Weak hands - use weakHand variable in logic
    if (weakHand) {
      if (toCall === 0) {
        if (latePosition && isManiac && Math.random() < 0.2) {
          const betSize = Math.floor(pot * 0.3 * aggressionFactor + maniacAdjustment);
          return {
            action: 'raise',
            amount: betSize,
            reasoning: `Weak hand but bluffing in position${isManiac ? ' (maniac bluff)' : ''}`
          };
        }
        return {
          action: 'check',
          reasoning: `Weak hand - checking (difficulty: ${difficulty})`
        };
      }

      if (potOdds <= 0.1 && latePosition) {
        return {
          action: 'call',
          amount: toCall,
          reasoning: `Weak hand with excellent pot odds - calling (difficulty: ${difficulty})`
        };
      }

      return {
        action: 'fold',
        reasoning: `Weak hand facing bet - folding (difficulty: ${difficulty})`
      };
    }

    // Default fallback (should not reach here, but TypeScript requires it)
    return {
      action: toCall > 0 ? 'fold' : 'check',
      reasoning: `Default decision (difficulty: ${difficulty})`
    };
  }

  async makeDecision(gameState: TableState, playerIndex: number): Promise<BotDecision> {
    console.log(`[Local Bot] Making decision for player ${playerIndex} at ${new Date().toISOString()}`);
    
    const player = gameState.players[playerIndex];
    const isPreflop = gameState.stage === 'PreFlop';
    
    // Get player context for reasoning
    const n = gameState.players.length;
    const dealerIndex = gameState.dealerIndex ?? 0;
    const posIndex = ((playerIndex - dealerIndex + n) % n);
    const posName = (() => {
      if (n <= 2) return posIndex === 0 ? 'Button/SB' : 'BB';
      const map = ['Button', 'SB', 'BB', 'UTG', 'MP', 'HJ', 'CO'];
      return map[Math.min(posIndex, map.length - 1)];
    })();

    const difficulty = (player.ai?.difficulty || gameState.difficulty || 'Medium');
    const personality = (player.ai?.personality || 'Balanced');

    console.log(`[Local Bot] Player: ${player.name}, Position: ${posName}, Difficulty: ${difficulty}, Personality: ${personality}`);
    console.log(`[Local Bot] Stage: ${gameState.stage}, Pot: $${gameState.pot}, To Call: $${Math.max(0, Math.max(...gameState.players.map(p => p.bet)) - player.bet)}`);
    console.log(`[Local Bot] Hand: ${this.formatCards(player.holeCards || [])}, Community: ${this.formatCards(gameState.communityCards || gameState.board || [])}`);

    let decision: BotDecision;

    if (isPreflop) {
      decision = this.makePreflopDecision(gameState, playerIndex);
    } else {
      decision = this.makePostflopDecision(gameState, playerIndex);
    }

    // Apply difficulty-based adjustments
    if (difficulty === 'Easy' && decision.action === 'raise' && Math.random() < 0.3) {
      // Easy bots sometimes miss value bets
      decision.action = decision.amount && decision.amount > 0 ? 'call' : 'check';
      decision.reasoning += ' (Easy difficulty - missed value bet)';
    }

    if (difficulty === 'Hard' && decision.action === 'fold' && Math.random() < 0.1) {
      // Hard bots sometimes make hero calls
      const toCall = Math.max(0, Math.max(...gameState.players.map(p => p.bet)) - player.bet);
      decision.action = 'call';
      decision.amount = toCall;
      decision.reasoning += ' (Hard difficulty - hero call)';
    }

    console.log(`[Local Bot] Decision: ${decision.action} ${decision.amount ? `$${decision.amount}` : ''} - ${decision.reasoning}`);
    
    return decision;
  }

  updateSettings(): void {
    console.log('[Local Bot] Settings updated (no changes needed for local bot)');
  }

  getCurrentModel(): string {
    return 'Local TypeScript Bot v1.0';
  }
}

// Singleton instance
export const localBotService = new LocalBotService();
