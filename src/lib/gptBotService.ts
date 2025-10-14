import { Card, GameState } from './localPokerEngine';

export type BotAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export interface BotDecision {
  action: BotAction;
  amount?: number;
  reasoning: string;
}

export class GPTBotService {
  private apiKey: string;
  private model: string;
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private context: Array<{role: string, content: string}> = [];

  constructor(apiKey: string, model: string = 'openai/gpt-3.5-turbo') {
    this.apiKey = apiKey;
    this.model = model;
    this.initializeContext();
  }

  private initializeContext() {
    this.context = [
      {
        role: 'system',
        content: `You are an expert poker player. You are playing No-Limit Texas Hold'em. 
        Your goal is to make optimal decisions based on the current game state, your cards, 
        and the community cards. You should consider pot odds, hand strength, position, 
        and opponent tendencies. Provide your decision in the format: 
        { "action": "fold|check|call|raise|allin", "amount": number, "reasoning": "your reasoning here" }`
      }
    ];
  }

  private formatCards(cards: Card[]): string {
    return cards.map(card => `${card.rank} of ${card.suit}`).join(', ');
  }

  private buildPrompt(gameState: GameState, playerIndex: number): string {
    const player = gameState.players[playerIndex];
    const opponents = gameState.players.filter((_, i) => i !== playerIndex);
    
    return `Game State:
    - Stage: ${gameState.stage}
    - Pot: ${gameState.pot}
    - Current bet to call: ${gameState.current_bet}
    - Your chips: ${player.chips}
    - Your current bet: ${player.current_bet}
    - Your hand: ${this.formatCards(player.hand)}
    - Community cards: ${gameState.communityCards.length > 0 ? this.formatCards(gameState.communityCards) : 'None yet'}
    - Opponents: ${opponents.length} (${opponents.map(o => `${o.chips} chips, ${o.current_bet} bet`).join('; ')})
    
    Make your decision based on the current game state. Consider your position, stack sizes, pot odds, and hand strength.`;
  }

  async makeDecision(gameState: GameState, playerIndex: number): Promise<BotDecision> {
    const prompt = this.buildPrompt(gameState, playerIndex);
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [...this.context, { role: 'user', content: prompt }],
          temperature: 0.7,
          max_tokens: 500,
        }),
      });

      if (!response.ok) {
        throw new Error(`API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content;
      
      try {
        // Try to parse the JSON response
        const decision = JSON.parse(content);
        return {
          action: decision.action.toLowerCase(),
          amount: decision.amount,
          reasoning: decision.reasoning || 'No reasoning provided'
        };
      } catch (e) {
        // If parsing fails, try to extract JSON from the response
        const jsonMatch = content.match(/\{.*\}/s);
        if (jsonMatch) {
          const decision = JSON.parse(jsonMatch[0]);
          return {
            action: decision.action.toLowerCase(),
            amount: decision.amount,
            reasoning: decision.reasoning || 'No reasoning provided'
          };
        }
        throw new Error('Could not parse bot response');
      }
    } catch (error) {
      console.error('Error making bot decision:', error);
      // Fallback to a simple decision making if API fails
      return this.makeFallbackDecision(gameState, playerIndex);
    }
  }

  private makeFallbackDecision(gameState: GameState, playerIndex: number): BotDecision {
    const player = gameState.players[playerIndex];
    const toCall = gameState.current_bet - player.current_bet;
    
    // Simple fallback logic
    if (toCall > player.chips * 0.5) {
      return { action: 'fold', reasoning: 'Fallback: Bet too high relative to stack' };
    }
    
    if (toCall === 0) {
      return { action: 'check', reasoning: 'Fallback: No bet to call' };
    }
    
    if (toCall > 0) {
      return { action: 'call', amount: toCall, reasoning: 'Fallback: Calling the current bet' };
    }
    
    return { action: 'check', reasoning: 'Fallback: Default action' };
  }
}

// Singleton instance
export const gptBotService = new GPTBotService(process.env.REACT_APP_OPENROUTER_API_KEY || '');
