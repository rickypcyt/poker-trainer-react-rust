import type { TableState } from '../types/table';

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

  constructor(apiKey: string, model: string = (import.meta.env.VITE_OPENROUTER_MODEL || 'qwen/qwen-2.5-72b-instruct')) {
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

  private formatCards(cards: Array<{rank: string, suit: string}>): string {
    if (!cards) return 'No cards';
    return cards.map(card => `${card.rank} of ${card.suit}`).join(', ');
  }

  private buildPrompt(gameState: TableState, playerIndex: number): string {
    const player = gameState.players[playerIndex];
    const opponents = gameState.players.filter((_, i) => i !== playerIndex);
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
    const lastActions = (gameState.actionLog || []).slice(-6).map(e => e.message).join(' | ');
    
    // Safely access player's hand - using 'holeCards' instead of 'hand' to match the TableState type
    const playerHand = 'holeCards' in player ? player.holeCards : [];
    
    return `You are playing No-Limit Texas Hold'em. Make a single optimal decision.
    Difficulty: ${difficulty}. Personality: ${personality}. Position: ${posName}.
    Game State:
    - Stage: ${gameState.stage}
    - Pot: ${gameState.pot}
    - Current bet to call: ${gameState.currentBet}
    - Your chips: ${player.chips}
    - Your current bet: ${player.bet}
    - Your hand: ${this.formatCards(playerHand || [])}
    - Community cards: ${gameState.communityCards?.length > 0 ? this.formatCards(gameState.communityCards) : 'None yet'}
    - Opponents: ${opponents.length} (${opponents.map(o => `${o.chips} chips, ${o.bet} bet`).join('; ')})
    - Recent actions: ${lastActions || 'none'}
    Guidance:
    - Consider pot odds, stack depths (in BB), position, and aggression frequencies.
    - On Hard, prefer GTO-style ranges and sizing. On Easy, play straightforward.
    - If raising, provide a realistic total bet amount (raise-to), not just the increment.
    Output ONLY a valid JSON object in this exact format without extra text:
    {"action": "fold|check|call|raise|allin", "amount": number, "reasoning": "brief explanation"}`;
  }

  async makeDecision(gameState: TableState, playerIndex: number): Promise<BotDecision> {
    console.log(`[GPT Bot] Starting decision for player ${playerIndex} at ${new Date().toISOString()}`);
    console.log(`[GPT Bot] Using model: ${this.model}`);
    
    const prompt = this.buildPrompt(gameState, playerIndex);
    console.log('[GPT Bot] Generated prompt:', prompt);
    
    const tempByDiff = (d: string) => d === 'Hard' ? 0.2 : d === 'Medium' ? 0.4 : 0.7;
    const difficulty = (gameState.players[playerIndex]?.ai?.difficulty || gameState.difficulty || 'Medium') as string;
    const requestBody = {
      model: this.model,
      messages: [...this.context, { role: 'user', content: prompt }],
      temperature: tempByDiff(difficulty),
      max_tokens: 400,
    };

    console.log('[GPT Bot] Sending request to OpenRouter API...');
    const startTime = performance.now();
    
    try {
      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/yourusername/poker-trainer',
          'X-Title': 'Poker Trainer Bot'
        },
        body: JSON.stringify(requestBody),
      });

      const responseTime = performance.now() - startTime;
      console.log(`[GPT Bot] API response received in ${responseTime.toFixed(2)}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[GPT Bot] API Error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorText
        });
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      const data = await response.json();
      console.log('[GPT Bot] Raw API response:', data);
      
      const content = data.choices[0]?.message?.content;
      console.log('[GPT Bot] Raw content:', content);
      
      try {
        // Try to parse the JSON response
        const decision = JSON.parse(content);
        const result = {
          action: decision.action.toLowerCase(),
          amount: decision.amount,
          reasoning: decision.reasoning || 'No reasoning provided'
        };
        console.log('[GPT Bot] Parsed decision:', result);
        return result;
      } catch (error) {
        console.warn('[GPT Bot] Failed to parse JSON, trying to extract...', error);
        // If parsing fails, try to extract JSON from the response
        if (typeof content === 'string') {
          // Try multiple patterns to find JSON
          const patterns = [
            /\{[\s\S]*\}/,  // Basic JSON object
            /\{.*?"action"[\s\S]*?\}/,  // JSON with action field
            /\{.*?"action".*?\}/s  // JSON with action field (multiline)
          ];
          
          for (const pattern of patterns) {
            const jsonMatch = content.match(pattern);
            if (jsonMatch) {
              try {
                const decision = JSON.parse(jsonMatch[0]);
                if (decision.action && typeof decision.action === 'string') {
                  const result = {
                    action: decision.action.toLowerCase(),
                    amount: decision.amount || 0,
                    reasoning: decision.reasoning || 'No reasoning provided (extracted)'
                  };
                  console.log('[GPT Bot] Extracted decision:', result);
                  return result;
                }
              } catch (extractError) {
                console.warn('[GPT Bot] Failed to parse extracted JSON:', extractError);
                continue; // Try next pattern
              }
            }
          }
        }
        console.warn('[GPT Bot] Using fallback decision due to parsing error');
        return {
          action: 'check',
          amount: 0,
          reasoning: 'Fallback decision due to parsing error'
        };
      }
    } catch (error) {
      console.error('Error making bot decision:', error);
      // Fallback to a simple decision making if API fails
      return this.makeFallbackDecision(gameState, playerIndex);
    }
  }

  private makeFallbackDecision(gameState: TableState, playerIndex: number): BotDecision {
    const player = gameState.players[playerIndex];
    const toCall = gameState.currentBet - player.bet;
    
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

// Get API key from Vite environment variables
const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || '';

// Singleton instance
export const gptBotService = new GPTBotService(OPENROUTER_API_KEY);
