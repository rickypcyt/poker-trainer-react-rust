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
  private rateLimitInfo: {
    limit: number;
    remaining: number;
    resetTime: number;
    lastUpdate: number;
  } = {
    limit: 50,
    remaining: 50,
    resetTime: 0,
    lastUpdate: 0
  };
  private baseUrl = 'https://openrouter.ai/api/v1/chat/completions';
  private context: Array<{role: string, content: string}> = [];

  constructor(apiKey: string, model?: string) {
    console.log('[GPT Bot] Initializing bot service...');
    
    // Prioritize environment variable for API key, then use provided key
    const envKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    this.apiKey = envKey || apiKey;
    console.log('[GPT Bot] Initial API key:', this.apiKey ? '***' : 'none', '(env:', !!envKey, ')');
    
    // Prioritize environment variable for model, then localStorage, then provided model, then default
    const envModel = import.meta.env.VITE_OPENROUTER_MODEL;
    const localStorageModel = typeof window !== 'undefined' ? localStorage.getItem('poker-trainer-openrouter-model') : null;
    this.model = envModel || model || localStorageModel || 'qwen/qwen3-235b-a22b:free';
    console.log('[GPT Bot] Initial model resolution:', { envModel, providedModel: model, localStorageModel, final: this.model });
    
    this.initializeContext();
    console.log('[GPT Bot] Bot service initialized with model:', this.model);
  }

  private getRateLimitInfo() {
    const now = Date.now();
    // Reset if past reset time
    if (now > this.rateLimitInfo.resetTime) {
      this.rateLimitInfo.remaining = this.rateLimitInfo.limit;
      this.rateLimitInfo.lastUpdate = now;
    }
    return this.rateLimitInfo;
  }

  private updateRateLimitInfo(headers: Headers) {
    const limit = headers.get('X-RateLimit-Limit');
    const remaining = headers.get('X-RateLimit-Remaining');
    const reset = headers.get('X-RateLimit-Reset');
    
    if (limit) this.rateLimitInfo.limit = parseInt(limit);
    if (remaining) this.rateLimitInfo.remaining = parseInt(remaining);
    if (reset) this.rateLimitInfo.resetTime = parseInt(reset);
    this.rateLimitInfo.lastUpdate = Date.now();
    
    console.log(`[GPT Bot] Rate limit updated: ${this.rateLimitInfo.remaining}/${this.rateLimitInfo.limit} remaining`);
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
    - Pot: $${gameState.pot}
    - Current bet to call: $${gameState.currentBet}
    - Your chips: $${player.chips}
    - Your current bet: $${player.bet}
    - Your hand: ${this.formatCards(playerHand || [])}
    - Community cards (${gameState.stage}): ${gameState.communityCards?.length > 0 ? this.formatCards(gameState.communityCards) : 'No community cards dealt yet'}
    - Board cards: ${gameState.board?.length > 0 ? this.formatCards(gameState.board) : 'No board cards'}
    - Opponents: ${opponents.length} (${opponents.map(o => `$${o.chips} chips, $${o.bet} bet`).join('; ')})
    - Recent actions: ${lastActions || 'none'}
    
    STRATEGIC CONTEXT:
    - If community cards show "None yet" but stage is Flop/Turn/River, there may be a data issue - play conservatively
    - Consider pot odds: ${(gameState.currentBet || 0) > 0 ? ((gameState.currentBet || 0) / ((gameState.pot || 0) + (gameState.currentBet || 0)) * 100).toFixed(1) : 'N/A'}% to call
    - Effective stack: ${Math.min(...opponents.map(o => o.chips), player.chips)} chips
    
    Guidance:
    - Consider pot odds, stack depths (in BB), position, and aggression frequencies.
    - On Hard, prefer GTO-style ranges and sizing. On Easy, play straightforward.
    - If raising, provide a realistic total bet amount (raise-to), not just the increment.
    - If community cards seem missing for your stage, prioritize checking/folding until cards are visible.
    Output ONLY a valid JSON object in this exact format without extra text:
    {"action": "fold|check|call|raise|allin", "amount": number, "reasoning": "brief explanation"}`;
  }

  async makeDecision(gameState: TableState, playerIndex: number): Promise<BotDecision> {
    console.log(`[GPT Bot] Starting decision for player ${playerIndex} at ${new Date().toISOString()}`);
    console.log(`[GPT Bot] Using model: ${this.model}`);
    console.log(`[GPT Bot] Community cards check:`, {
      communityCards: gameState.communityCards,
      board: gameState.board,
      stage: gameState.stage,
      communityCardsLength: gameState.communityCards?.length,
      boardLength: gameState.board?.length
    });
    
    // Check rate limit status before making request
    const rateLimitInfo = this.getRateLimitInfo();
    if (rateLimitInfo.remaining <= 5) {
      console.warn(`[GPT Bot] Rate limit nearly exceeded: ${rateLimitInfo.remaining} requests remaining`);
      // Return a conservative action when rate limited
      return {
        action: 'check',
        amount: 0,
        reasoning: 'Rate limit protection - playing conservatively'
      };
    }
    
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
        
        // Update rate limit info from response headers
        this.updateRateLimitInfo(response.headers);
        
        // Return conservative action on rate limit
        if (response.status === 429) {
          console.warn('[GPT Bot] Rate limit hit, using conservative fallback');
          return {
            action: 'check',
            amount: 0,
            reasoning: 'Rate limit protection - playing conservatively'
          };
        }
        
        throw new Error(`API request failed with status ${response.status}: ${errorText}`);
      }

      // Update rate limit info from successful response
      this.updateRateLimitInfo(response.headers);

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

  updateSettings(apiKey: string, model?: string) {
    console.log('[GPT Bot] Updating settings:', { apiKey: apiKey ? '***' : 'none', model });
    
    // Prioritize environment variable for API key, then use provided key
    const envKey = import.meta.env.VITE_OPENROUTER_API_KEY;
    this.apiKey = envKey || apiKey;
    console.log('[GPT Bot] Final API key:', this.apiKey ? '***' : 'none', '(env:', !!envKey, ')');
    
    if (model) {
      this.model = model;
      console.log('[GPT Bot] Using provided model:', model);
    } else {
      // Prioritize environment variable for model, then localStorage, then default
      const envModel = import.meta.env.VITE_OPENROUTER_MODEL;
      const localStorageModel = typeof window !== 'undefined' ? localStorage.getItem('poker-trainer-openrouter-model') : null;
      this.model = envModel || localStorageModel || 'qwen/qwen3-235b-a22b:free';
      console.log('[GPT Bot] Model resolution:', { envModel, localStorageModel, final: this.model });
    }
    console.log('[GPT Bot] Settings updated successfully:', { 
      apiKey: this.apiKey ? '***' : 'none', 
      model: this.model 
    });
  }

  getCurrentModel(): string {
    return this.model;
  }
}

// Get API key from Vite environment variables first, then localStorage
const getApiKey = (): string => {
  // Prioritize environment variable
  const envKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (envKey) return envKey;
  
  // Fallback to localStorage
  if (typeof window !== 'undefined') {
    const localStorageKey = localStorage.getItem('poker-trainer-openrouter-api-key');
    if (localStorageKey) return localStorageKey;
  }
  
  return '';
};

// Function to refresh the bot service with new settings
export const refreshBotService = () => {
  console.log('[GPT Bot] Refreshing bot service...');
  const newApiKey = getApiKey();
  console.log('[GPT Bot] New API key:', newApiKey ? '***' : 'none');
  
  const oldModel = gptBotService.getCurrentModel();
  gptBotService.updateSettings(newApiKey);
  const newModel = gptBotService.getCurrentModel();
  
  console.log('[GPT Bot] Model updated:', { from: oldModel, to: newModel });
};

// Singleton instance
export const gptBotService = new GPTBotService(getApiKey());
