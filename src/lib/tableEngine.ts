import type { ChipStack, DealConfig, Difficulty, Personality, Player, TableState } from '../types/table';

import type { Card } from './pokerService';
import type { DeckCard } from '../types/cards';
import { createStandardDeck } from './deck';
import { pythonBotService } from './pythonBotService';
import { shuffleDeck } from './shuffle';

function generateId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

// Return a denomination breakdown of amount taken, and mutate stack safely (no negatives)
function takeFromChipStackGreedy(stack: ChipStack, amount: number): ChipStack {
  const used: ChipStack = {};
  const denoms = [1000, 500, 100, 25, 5, 1];
  let remaining = amount;
  for (const d of denoms) {
    const have = stack[d] ?? 0;
    if (have <= 0) continue;
    const canUse = Math.min(Math.floor(remaining / d), have);
    if (canUse > 0) {
      stack[d] = have - canUse;
      used[d] = (used[d] ?? 0) + canUse;
      remaining -= canUse * d;
    }
  }
  return used;
}

// Mutate dest by adding counts from src; return dest for convenience
function addToChipStack(dest: ChipStack, src: ChipStack): ChipStack {
  for (const k of Object.keys(src)) {
    const d = Number(k);
    dest[d] = (dest[d] ?? 0) + (src[d] ?? 0);
  }
  return dest;
}

function mapToCardDeck(deck: DeckCard[]): Card[] {
  // Convert DeckCard (frontend type) to Card (engine type)
  return deck.map(c => ({ suit: c.suit as Card['suit'], rank: c.rank as Card['rank'] }));
}

// --- Simple helpers for showdown and winners ---
const suitOrder: Record<string, number> = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 };
const rankOrder: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

// --- Hand category helper (Preflop) ---
// Categories based on user's specification:
// Premium: AA, KK, QQ, AK
// Good: JJ, TT, AQ, AJ, KQ
// Speculative: low pairs (22-99 except TT/JJ counted above), suited connectors (within 1-2 gaps, suited)
// Trash: everything else
function categorizePreflopHand(hole: Card[]): 'Premium' | 'Good' | 'Speculative' | 'Trash' {
  if (!hole || hole.length < 2) return 'Trash';
  const [c1, c2] = hole;
  const r1 = rankOrder[c1.rank];
  const r2 = rankOrder[c2.rank];
  const hi = Math.max(r1, r2);
  const lo = Math.min(r1, r2);
  const pair = c1.rank === c2.rank;
  const suited = c1.suit === c2.suit;
  const gap = Math.abs(r1 - r2);

  // Map numeric to rank string helper
  const valueToRank = (v: number) => Object.keys(rankOrder).find(k => rankOrder[k] === v) as Card['rank'];
  const hiRank = valueToRank(hi);
  const loRank = valueToRank(lo);

  // Premium set
  const isAK = (hiRank === 'A' && loRank === 'K');
  if (pair && (hiRank === 'A' || hiRank === 'K' || hiRank === 'Q')) return 'Premium';
  if (isAK) return 'Premium';

  // Good set
  if (pair && (hiRank === 'J' || hiRank === '10')) return 'Good';
  const isAQ = (hiRank === 'A' && loRank === 'Q');
  const isAJ = (hiRank === 'A' && loRank === 'J');
  const isKQ = (hiRank === 'K' && loRank === 'Q');
  if (isAQ || isAJ || isKQ) return 'Good';

  // Speculative: small pairs 22-99
  const isSmallPair = pair && hiRank !== 'A' && hiRank !== 'K' && hiRank !== 'Q' && hiRank !== 'J' && hiRank !== '10';
  // Suited connectors (allow 0-2 gap) and suitedness
  const suitedConnectors = suited && gap <= 2 && hi >= 5 && lo >= 2; // avoid super low trash like 32s slightly
  if (isSmallPair || suitedConnectors) return 'Speculative';

  return 'Trash';
}

function compareHighCard(a: Card, b: Card): number {
  const ra = rankOrder[a.rank];
  const rb = rankOrder[b.rank];
  if (ra !== rb) return ra - rb;
  return suitOrder[a.suit] - suitOrder[b.suit];
}

function bestHighCard(cards: Card[]): Card {
  return cards.reduce((best, c) => (compareHighCard(c, best) > 0 ? c : best), cards[0] ?? { suit: 'clubs', rank: '2' } as Card);
}

function awardPotToWinner(state: TableState, winnerIndex: number, reason: string): TableState {
  if (state.pot <= 0) return state;
  const amount = state.pot;
  const players = state.players.map((p, i) => i === winnerIndex ? { ...p, chips: p.chips + amount } : p);
  
  // Gather complete hand information for logging
  const winnerInfo = {
    winner_index: winnerIndex,
    winner_name: players[winnerIndex].name,
    winner_is_hero: players[winnerIndex].isHero,
    winning_amount: amount,
    winning_reason: reason,
    final_players: players.map(p => ({
      name: p.name,
      is_hero: p.isHero,
      is_bot: p.isBot,
      final_chips: p.chips,
      final_bet: p.bet,
      has_folded: p.hasFolded,
      hole_cards: p.holeCards || [],
      ai_personality: p.ai?.personality,
      ai_difficulty: p.ai?.difficulty
    })),
    community_cards: state.communityCards || state.board || [],
    final_stage: state.stage,
    hand_number: state.handNumber,
    dealer_index: state.dealerIndex,
    blinds: { small: state.smallBlind, big: state.bigBlind }
  };

  // Log complete hand information
  pythonBotService.logHandComplete(state, winnerInfo).catch(err => {
    console.error('[Table Engine] Error logging hand completion:', err);
  });

  return {
    ...state,
    players,
    pot: 0,
    potStack: {},
    actionLog: [
      ...state.actionLog,
      { message: `${players[winnerIndex].name} wins the pot $${amount}${reason ? ` (${reason})` : ''}`,
        time: new Date().toLocaleTimeString(), isImportant: true }
    ]
  };
}

export function createInitialTable(config: DealConfig): TableState {
  const deck: Card[] = mapToCardDeck(shuffleDeck(createStandardDeck()));

  const players: Player[] = [];
  // Hero at seat 0
  players.push({
    id: generateId('hero'),
    name: 'You',
    isBot: false,
    isHero: true,
    chips: config.startingChips,
    chipStack: createDefaultChipStack(config.initialChipStack),
    bet: 0,
    holeCards: [] as Card[],
    hasFolded: false,
    seatIndex: 0,
  });
  
  // Bots next seats - use the same chip distribution as hero
  const botChipStack = createDefaultChipStack(config.initialChipStack);
  // Predefined cycles to ensure diversity across bots
  const personalities: Personality[] = ['Aggressive', 'Passive', 'Balanced', 'Maniac', 'Nit'];
  const difficulties: Difficulty[] = ['Easy', 'Medium', 'Hard'];
  for (let i = 0; i < config.numBots; i += 1) {
    players.push({
      id: generateId('bot'),
      name: `Bot ${i + 1}`,
      isBot: true,
      isHero: false,
      chips: config.startingChips,
      chipStack: { ...botChipStack }, // Clone the chip stack
      bet: 0,
      holeCards: [] as Card[],
      hasFolded: false,
      seatIndex: i + 1,
      ai: {
        // If the table provides a difficulty, keep it as a baseline but vary per-bot if not set
        difficulty: (config.difficulty ?? difficulties[i % difficulties.length]) as Difficulty,
        personality: personalities[i % personalities.length],
      }
    });
  }

  const dealerDrawCards: Record<string, Card | null> = {};
  for (const p of players) dealerDrawCards[p.id] = null;
  const table: TableState = {
    stage: 'DealerDraw',
    deck,
    board: [],
    burned: [],
    communityCards: [],
    players,
    dealerIndex: -1,
    smallBlindIndex: -1,
    bigBlindIndex: -1,
    currentPlayerIndex: 0,
    pot: 0,
    potStack: {},
    smallBlind: config.smallBlind,
    bigBlind: config.bigBlind,
    difficulty: config.difficulty ?? 'Medium',
    handNumber: 0,
    currentBet: 0,
    dealerDrawCards,
    dealerDrawRevealed: false,
    dealerDrawInProgress: true,
    actionLog: [],
    dealingState: {
      isDealing: false,
      currentDealIndex: 0,
      dealOrder: [],
      highlightHighCard: false,
      highCardPlayerIndex: null,
      stage: 'none'
    },
    botPendingIndex: null
  };

  return table;
}

export function startNewHand(state: TableState): TableState {
  // Generate hand ID for logging
  pythonBotService.generateHandId().catch(err => {
    console.error('[Table Engine] Error generating hand ID:', err);
  });

  const nextDealer = (state.dealerIndex + (state.handNumber === 0 ? 0 : 1)) % state.players.length;
  const deck: Card[] = mapToCardDeck(shuffleDeck(createStandardDeck()));
  const players = state.players.map(p => ({ ...p, bet: 0, holeCards: [] as Card[], hasFolded: false }));
  const smallBlindIndex = (nextDealer + 1) % players.length;
  const bigBlindIndex = (nextDealer + 2) % players.length;

  // Post blinds and track denominations into potStack
  const potStack: ChipStack = {};
  players[smallBlindIndex].bet = Math.min(players[smallBlindIndex].chips, state.smallBlind);
  players[smallBlindIndex].chips -= players[smallBlindIndex].bet;
  {
    const used = takeFromChipStackGreedy(players[smallBlindIndex].chipStack, players[smallBlindIndex].bet);
    addToChipStack(potStack, used);
  }
  players[bigBlindIndex].bet = Math.min(players[bigBlindIndex].chips, state.bigBlind);
  players[bigBlindIndex].chips -= players[bigBlindIndex].bet;
  {
    const used = takeFromChipStackGreedy(players[bigBlindIndex].chipStack, players[bigBlindIndex].bet);
    addToChipStack(potStack, used);
  }
  const pot = players[smallBlindIndex].bet + players[bigBlindIndex].bet;

  // Deal two cards to each player clockwise from SB (typical live deal starts left of dealer).
  for (let r = 0; r < 2; r += 1) {
    for (let i = 0; i < players.length; i += 1) {
      const seat = (smallBlindIndex + i) % players.length;
      const card = deck.pop();
      if (!card) continue;
      players[seat].holeCards.push(card);
    }
  }

  // Current player is first to act preflop: seat left of big blind
  const currentPlayerIndex = (bigBlindIndex + 1) % players.length;

  const started: TableState = {
    ...state,
    stage: 'PreFlop' as 'DealerDraw' | 'PreFlop' | 'Flop' | 'Turn' | 'River' | 'Showdown',
    deck,
    board: [],
    burned: [],
    players,
    dealerIndex: nextDealer,
    smallBlindIndex,
    bigBlindIndex,
    currentPlayerIndex,
    pot,
    potStack,
    handNumber: state.handNumber + 1,
    currentBet: players.reduce((max, p) => Math.max(max, p.bet), 0),
    dealerDrawCards: state.dealerDrawCards,
    dealerDrawRevealed: false,
    dealerDrawInProgress: false,
    actionLog: [
      ...state.actionLog,
      { message: `New hand #${state.handNumber + 1}`, time: new Date().toLocaleTimeString() },
      { message: `${players[smallBlindIndex].name} posts small blind ${state.smallBlind}`,
        time: new Date().toLocaleTimeString() },
      { message: `${players[bigBlindIndex].name} posts big blind ${state.bigBlind}`,
        time: new Date().toLocaleTimeString() },
    ],
    dealingState: { ...state.dealingState, stage: 'hole-cards', isDealing: false },
    botPendingIndex: null
  };
  
  // Kick off the action loop so bots play until it's the hero's turn
  return processNextAction(started);
}

export function prepareNewHandWithoutDealing(state: TableState): TableState {
  const nextDealer = (state.dealerIndex + (state.handNumber === 0 ? 0 : 1)) % state.players.length;
  const deck: Card[] = mapToCardDeck(shuffleDeck(createStandardDeck()));
  const players = state.players.map(p => ({ ...p, bet: 0, holeCards: [] as Card[], hasFolded: false }));
  const smallBlindIndex = (nextDealer + 1) % players.length;
  const bigBlindIndex = (nextDealer + 2) % players.length;

  // Post blinds and track denominations into potStack
  const potStack: ChipStack = {};
  players[smallBlindIndex].bet = Math.min(players[smallBlindIndex].chips, state.smallBlind);
  players[smallBlindIndex].chips -= players[smallBlindIndex].bet;
  {
    const used = takeFromChipStackGreedy(players[smallBlindIndex].chipStack, players[smallBlindIndex].bet);
    addToChipStack(potStack, used);
  }
  players[bigBlindIndex].bet = Math.min(players[bigBlindIndex].chips, state.bigBlind);
  players[bigBlindIndex].chips -= players[bigBlindIndex].bet;
  {
    const used = takeFromChipStackGreedy(players[bigBlindIndex].chipStack, players[bigBlindIndex].bet);
    addToChipStack(potStack, used);
  }
  const pot = players[smallBlindIndex].bet + players[bigBlindIndex].bet;

  return {
    ...state,
    stage: 'DealerDraw' as 'DealerDraw' | 'PreFlop' | 'Flop' | 'Turn' | 'River' | 'Showdown',
    deck,
    board: [],
    burned: [],
    players,
    dealerIndex: nextDealer,
    smallBlindIndex,
    bigBlindIndex,
    currentPlayerIndex: -1,
    pot,
    potStack,
    handNumber: state.handNumber + 1,
    dealerDrawInProgress: false,
    dealerDrawRevealed: false,
  };
}

export function proceedToFlop(state: TableState): TableState {
  const deck = state.deck.slice();
  const burned = state.burned.slice();
  // Burn one, deal three
  const burn = deck.pop();
  if (burn) burned.push(burn);
  const board = state.board.slice();
  for (let i = 0; i < 3; i += 1) {
    const c = deck.pop();
    if (c) board.push(c);
  }
  return { ...state, stage: 'Flop', deck, burned, board };
}

export function proceedToTurn(state: TableState): TableState {
  const deck = state.deck.slice();
  const burned = state.burned.slice();
  const board = state.board.slice();
  const burn = deck.pop();
  if (burn) burned.push(burn);
  const c = deck.pop();
  if (c) board.push(c);
  return { ...state, stage: 'Turn', deck, burned, board };
}

export function proceedToRiver(state: TableState): TableState {
  const deck = state.deck.slice();
  const burned = state.burned.slice();
  const board = state.board.slice();
  const burn = deck.pop();
  if (burn) burned.push(burn);
  const c = deck.pop();
  if (c) board.push(c);
  return { ...state, stage: 'River', deck, burned, board };
}

export type SimpleAction = 'Fold' | 'Check' | 'Call';

export function simpleAdvance(state: TableState): TableState {
  // For first iteration: skip betting rounds, auto-advance streets until showdown
  if (state.stage === 'PreFlop') {
    const next = proceedToFlop(state);
    return { ...next, actionLog: [...next.actionLog, { message: 'Dealing the flop', time: new Date().toLocaleTimeString() }] };
  }
  if (state.stage === 'Flop') {
    const next = proceedToTurn(state);
    return { ...next, actionLog: [...next.actionLog, { message: 'Dealing the turn', time: new Date().toLocaleTimeString() }] };
  }
  if (state.stage === 'Turn') {
    const next = proceedToRiver(state);
    return { ...next, actionLog: [...next.actionLog, { message: 'Dealing the river', time: new Date().toLocaleTimeString() }] };
  }
  if (state.stage === 'River') {
    return { ...state, stage: 'Showdown', actionLog: [...state.actionLog, { message: 'Showdown', time: new Date().toLocaleTimeString() }] } as TableState;
  }
  return state;
}

// Dealer draw: each player gets one card to decide initial dealer
export function performDealerDraw(state: TableState): TableState {
  if (!state.dealerDrawInProgress) return state;
  const deck = state.deck.slice();
  const dealerDrawCards: Record<string, Card | null> = { ...state.dealerDrawCards };
  for (const p of state.players) {
    if (!dealerDrawCards[p.id]) {
      dealerDrawCards[p.id] = deck.pop() ?? null;
    }
  }
  return { ...state, deck, dealerDrawCards };
}

export function revealDealerDraw(state: TableState): TableState {
  if (!state.dealerDrawInProgress) return state;
  // Determine highest card; tie-breaker by suit order (spades > hearts > diamonds > clubs)
  const suitOrder: Record<string, number> = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 };
  const rankOrder: Record<string, number> = {
    '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
    '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
  };
  const entries = state.players.map(p => ({ p, c: state.dealerDrawCards[p.id]! }));
  entries.sort((a, b) => {
    const ra = rankOrder[a.c.rank];
    const rb = rankOrder[b.c.rank];
    if (rb !== ra) return rb - ra;
    const sa = suitOrder[a.c.suit];
    const sb = suitOrder[b.c.suit];
    return sb - sa;
  });
  const winnerIdx = entries[0].p.seatIndex;
  // Set dealer at winner, SB and BB after
  const smallBlindIndex = (winnerIdx + 1) % state.players.length;
  const bigBlindIndex = (winnerIdx + 2) % state.players.length;
  return {
    ...state,
    dealerIndex: winnerIdx,
    smallBlindIndex,
    bigBlindIndex,
    dealerDrawRevealed: true,
    // Keep dealer draw phase active briefly so UI can show revealed cards and toast
    // The UI will transition to Preflop automatically shortly after.
    dealerDrawInProgress: true,
    dealingState: { ...state.dealingState, highlightHighCard: true, highCardPlayerIndex: winnerIdx, stage: 'dealer-draw' },
    actionLog: [
      ...state.actionLog,
      { message: `${state.players[winnerIdx].name} wins dealer button (high card)`, time: new Date().toLocaleTimeString() },
    ]
  };
}

// --- Hero action helpers (very simplified) ---
function getHeroIndex(state: TableState): number { return state.players.findIndex(p => p.isHero); }
function maxBet(state: TableState): number { return Math.max(0, ...state.players.map(p => p.bet)); }

export function heroFold(state: TableState): TableState {
  const heroIdx = getHeroIndex(state);
  if (heroIdx < 0) return state;
  const players = state.players.map((p, i) => i === heroIdx ? { ...p, hasFolded: true } : p);
  const newState = { 
    ...state, 
    players, 
    currentPlayerIndex: (heroIdx + 1) % state.players.length,
    actionLog: [...state.actionLog, { message: `${players[heroIdx].name} folded`, time: new Date().toLocaleTimeString() }] 
  };
  
  // Check if hand should end or continue with next player
  const activePlayers = newState.players.filter(p => !p.hasFolded);
  if (activePlayers.length <= 1) {
    // Hand is over, only one player left -> award pot to that player
    const winnerIndex = newState.players.findIndex(p => !p.hasFolded);
    const awarded = awardPotToWinner(newState, winnerIndex, 'all others folded');
    return { ...awarded, stage: 'Showdown' };
  }
  
  // Process next player's action if it's a bot
  return processNextAction(newState);
}

export function heroCall(state: TableState): TableState {
  const heroIdx = getHeroIndex(state);
  if (heroIdx < 0) return state;
  const highest = maxBet(state);
  const hero = state.players[heroIdx];
  const toCall = Math.max(0, highest - hero.bet);
  
  let newState: TableState;
  if (toCall <= 0) {
    newState = { 
      ...state, 
      currentPlayerIndex: (heroIdx + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: `${hero.name} checked`, time: new Date().toLocaleTimeString() }] 
    };
  } else {
    const pay = Math.min(toCall, hero.chips);
    // Deduct from hero chip stack by denominations immutably and add to potStack
    const newHeroStack = { ...hero.chipStack };
    const used = takeFromChipStackGreedy(newHeroStack, pay);
    const players = state.players.map((p, i) => i === heroIdx ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newHeroStack } : p);
    const pot = state.pot + pay;
    const potStack = { ...state.potStack };
    addToChipStack(potStack, used);
    newState = { 
      ...state, 
      players, 
      pot,
      potStack,
      currentBet: players.reduce((m, p) => Math.max(m, p.bet || 0), 0),
      currentPlayerIndex: (heroIdx + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: `${hero.name} called ${pay}`, time: new Date().toLocaleTimeString() }] 
    };
  }
  
  // Process next player's action if it's a bot
  return processNextAction(newState);
}

export function heroRaiseTo(state: TableState, raiseTo: number): TableState {
  const heroIdx = getHeroIndex(state);
  if (heroIdx < 0) return state;
  const hero = state.players[heroIdx];
  const highest = maxBet(state);
  const minRaiseTo = (highest || 0) + (state.bigBlind || 0);
  const target = Math.max(raiseTo, hero.bet, minRaiseTo);
  const delta = Math.max(0, target - hero.bet);
  const pay = Math.min(delta, hero.chips);
  const newHeroStack = { ...hero.chipStack };
  const used = takeFromChipStackGreedy(newHeroStack, pay);
  const players = state.players.map((p, i) => i === heroIdx ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newHeroStack } : p);
  const pot = state.pot + pay;
  const potStack = { ...state.potStack };
  addToChipStack(potStack, used);
  const newState = { 
    ...state, 
    players, 
    pot,
    potStack,
    currentBet: players.reduce((m, p) => Math.max(m, p.bet || 0), 0),
    currentPlayerIndex: (heroIdx + 1) % state.players.length, // Move to next player
    actionLog: [...state.actionLog, { message: `${hero.name} raised to ${hero.bet + pay}`, time: new Date().toLocaleTimeString() }] 
  };
  
  // Process next player's action if it's a bot
  return processNextAction(newState);
}

// Process the next player's action (bot or human)
export function processNextAction(state: TableState): TableState {
  // If game is already in showdown or hand is over, don't process more actions
  if (state.stage === 'Showdown' || state.dealerDrawInProgress) {
    return state;
  }

  // Helper: detect if at least one player action occurred in the current street
  const hasAnyActionThisStreet = (): boolean => {
    const logs = state.actionLog || [];
    // Find the last marker indicating start of this street
    const isStreetStart = (msg: string): boolean => {
      if (state.stage === 'PreFlop') return /New hand #/i.test(msg) || /posts (small|big) blind/i.test(msg);
      if (state.stage === 'Flop') return /Dealing the flop/i.test(msg);
      if (state.stage === 'Turn') return /Dealing the turn/i.test(msg);
      if (state.stage === 'River') return /Dealing the river/i.test(msg);
      return false;
    };
    let lastStreetStart = -1;
    for (let i = logs.length - 1; i >= 0; i--) {
      if (isStreetStart(logs[i].message || '')) { lastStreetStart = i; break; }
    }
    // Look for any player action after the start marker
    for (let i = Math.max(0, lastStreetStart + 1); i < logs.length; i++) {
      const m = logs[i].message || '';
      if (/(checked|called|raised|folded|all-in)/i.test(m)) return true;
    }
    return false;
  };

  // If all active players have matched the highest bet and at least one action this street,
  // and action has rotated back to first-to-act, advance the street
  const highestBetNow = maxBet(state);
  const activePlayersNow = state.players.filter(p => !p.hasFolded);
  const allMatched = activePlayersNow.length > 0 && activePlayersNow.every(p => (p.bet || 0) === highestBetNow);
  const nPlayers = state.players.length;
  const anchor = state.stage === 'PreFlop' ? (state.bigBlindIndex + 1) % nPlayers : (state.dealerIndex + 1) % nPlayers;
  const firstToAct = (() => {
    for (let i = 0; i < nPlayers; i++) {
      const idx = (anchor + i) % nPlayers;
      const p = state.players[idx];
      if (!p.hasFolded) return idx;
    }
    return anchor;
  })();
  
  // Debug logging
  console.log(`[DEBUG] allMatched: ${allMatched}, hasAction: ${hasAnyActionThisStreet()}, currentPlayer: ${state.currentPlayerIndex}, firstToAct: ${firstToAct}, highestBet: ${highestBetNow}`);
  
  // Check if betting round is complete with improved logic
  const shouldAdvanceStreet = allMatched && hasAnyActionThisStreet() && 
    state.currentPlayerIndex === firstToAct;
  
  // Safety: detect potential infinite loops (everyone keeps checking)
  const allPlayersChecked = activePlayersNow.length > 1 && 
    activePlayersNow.every(p => (p.bet || 0) === 0) &&
    hasAnyActionThisStreet() &&
    state.actionLog.slice(-activePlayersNow.length).every(log => 
      log.message.includes('checked')
    );
  
  if (shouldAdvanceStreet || allPlayersChecked) {
    const advanced = advanceToNextStreet(state);
    return processNextAction(advanced);
  }

  // Safety: if only one active player remains, immediately award the pot and end the hand
  // (recompute to avoid shadowing)
  const activePlayersNow2 = state.players.filter(p => !p.hasFolded);
  if (activePlayersNow2.length <= 1) {
    const winnerIndex = state.players.findIndex(p => !p.hasFolded);
    if (winnerIndex >= 0) {
      const awarded = awardPotToWinner(state, winnerIndex, 'all others folded');
      return { ...awarded, stage: 'Showdown' };
    }
    return state;
  }

  // Find the next active player who hasn't folded and has chips
  let nextPlayerIndex = state.currentPlayerIndex;
  let attempts = 0;
  const totalPlayers = state.players.length;
  
  while (attempts < totalPlayers) {
    const player = state.players[nextPlayerIndex];
    
    // Skip folded players and players with no chips
    if (!player.hasFolded && player.chips > 0) {
      // If it's a bot, schedule thinking instead of instant action
      if (player.isBot) {
        return { ...state, currentPlayerIndex: nextPlayerIndex, botPendingIndex: nextPlayerIndex };
      }
      // If it's the hero's turn, stop and wait for input
      return { ...state, currentPlayerIndex: nextPlayerIndex };
    }
    
    // Move to next player
    nextPlayerIndex = (nextPlayerIndex + 1) % totalPlayers;
    attempts++;
    
    // If we've gone all the way around, check if betting round is complete
    if (nextPlayerIndex === state.currentPlayerIndex) {
      // Advance to next street and immediately continue action selection
      const advanced = advanceToNextStreet(state);
      return processNextAction(advanced);
    }
  }
  
  return state;
}

// Decide and perform a bot's action immediately (used after UI 'thinking' delay)
export async function performBotActionNow(state: TableState): Promise<TableState> {
  const botIndex = state.botPendingIndex ?? -1;
  if (botIndex < 0) return state;
  
  console.log(`[performBotActionNow] Processing bot action for player ${botIndex}`);
  
  // Check which bot service to use - always use Python now
  const selectedBot = 'python';
  console.log(`[performBotActionNow] Using bot service: ${selectedBot}`);
  
  if (selectedBot === 'python') {
    try {
      // Use Python bot service
      console.log('[performBotActionNow] Using Python bot service');
      const decision = await pythonBotService.makeDecision(state, botIndex);
      
      // Convert decision format - use the correct BotDecision type from botService
      let action: 'Fold' | 'Call' | 'Raise' | 'AllIn' = 'Call';
      let amount: number | undefined = 0;
      
      if (decision.action === 'fold') {
        action = 'Fold';
      } else if (decision.action === 'check') {
        action = 'Call';
        // If there's a bet to match, check becomes a call for the required amount
        const toCall = Math.max(0, maxBet(state) - state.players[botIndex].bet);
        amount = toCall;
      } else if (decision.action === 'call') {
        action = 'Call';
        amount = decision.amount || maxBet(state);
      } else if (decision.action === 'raise') {
        action = 'Raise';
        amount = decision.amount || maxBet(state);
      } else if (decision.action === 'allin') {
        action = 'AllIn';
        amount = state.players[botIndex].chips;
      } else {
        action = 'Fold';
        amount = 0;
      }
      
      console.log(`[performBotActionNow] Python bot decided: ${action} ${amount ? `$${amount}` : ''} - ${decision.reasoning}`);
      
      // Apply the action using the correct function
      const result = applyExternalBotDecision(state, botIndex, { action, raiseTo: amount });
      return processNextAction({ ...result, botPendingIndex: null });
    } catch (error) {
      console.error('[performBotActionNow] Python bot error:', error);
      const fallback = decideAndApplyBotAction(state, botIndex);
      return processNextAction({ ...fallback, botPendingIndex: null });
    }
  }
  
  // This should never be reached since we always use Python bot
  return state;
}

// Core bot decision logic that adapts with difficulty - DEPRECATED, using Python bot only
export function decideAndApplyBotAction(state: TableState, botIndex: number): TableState {
  const bot = state.players[botIndex];
  const highestBet = maxBet(state);
  const toCall = Math.max(0, highestBet - bot.bet);
  
  const random = Math.random();
  const isPreflop = state.stage === 'PreFlop';
  const minRaise = Math.max(state.bigBlind, highestBet * 2 - bot.bet);
  // Pull difficulty/personality from the bot if available, else fallback to table defaults
  const diff: Difficulty = (bot.ai?.difficulty ?? state.difficulty ?? 'Medium') as Difficulty;
  const personality: Personality = (bot.ai?.personality ?? 'Balanced') as Personality;

  // Simple hand strength proxies
  const hole = bot.holeCards || [];
  const pair = hole.length >= 2 && hole[0].rank === hole[1].rank;
  const pairRank = pair ? rankOrder[hole[0].rank] : 0;
  const highPair = pair && pairRank >= 11; // JJ+
  const mediumPair = pair && pairRank >= 7; // 77-TT
  const twoBroadway = hole.length >= 2 && ['10','J','Q','K','A'].includes(hole[0].rank) && ['10','J','Q','K','A'].includes(hole[1].rank);
  const suited = hole.length >= 2 && hole[0].suit === hole[1].suit;
  const connected = hole.length >= 2 && Math.abs(rankOrder[hole[0].rank] - rankOrder[hole[1].rank]) <= 2;

  // Position heuristic: later position -> more aggression
  const n = state.players.length;
  const distanceFromDealer = ((botIndex - state.dealerIndex + n) % n);
  const latePosition = distanceFromDealer >= Math.floor(n * 0.6);
  const midPosition = distanceFromDealer >= Math.floor(n * 0.3);

  // Pot odds proxy
  const potOdds = toCall === 0 ? 0 : toCall / Math.max(1, state.pot + toCall);

  // --- New: Dedicated Preflop logic with sizing, ranges, difficulty, RNG, and stacks/position ---
  if (isPreflop) {
    const bb = state.bigBlind;
    const botBB = Math.floor(bot.chips / bb); // stack depth in big blinds
    const category = categorizePreflopHand(hole);
    const opened = highestBet > bb; // someone has already raised beyond BB
    const currentRaiseToBB = Math.max(2, Math.round(highestBet / bb));

    // Random sizing helpers
    const rng = (lo: number, hi: number) => lo + Math.random() * (hi - lo);
    const roundToBB = (x: number) => Math.max(bb * 2, Math.round(x) * bb);

    // Difficulty toggles
    const easy = diff === 'Easy';
    const hard = diff === 'Hard';
    // Personality toggles
    const pAgg = personality === 'Aggressive' || personality === 'Maniac';
    const pPassive = personality === 'Passive' || personality === 'Nit';
    const pManiac = personality === 'Maniac';
    const pNit = personality === 'Nit';

    // Stack rules
    const shortStack = botBB < 20;
    const midStack = botBB >= 20 && botBB <= 60;
    const deepStack = botBB > 60;

    // Determine target action
    type PreAction = { kind: 'Fold' | 'Call' | 'Raise' | 'AllIn'; raiseTo?: number };
    const decidePreflop = (): PreAction => {
      // Short stack policy
      if (shortStack) {
        // Only shove or fold generally; easy bots never shove per difficulty rule
        if (easy) {
          if (category === 'Premium') {
            // Min-raise or call instead of shove for easy
            if (toCall === 0) return { kind: 'Raise', raiseTo: roundToBB(rng(2, 3)) };
            return { kind: 'Call' };
          }
          return { kind: 'Fold' };
        } else {
          // Medium/Hard: Shove with premium only (AA, KK, QQ, AK)
          if (category === 'Premium') return { kind: 'AllIn' };
          // Facing no raise, can open shove with some frequency with good hands if <15bb
          // Spec disallows shoving non-premium; skip any non-premium shove here
          // Otherwise fold or call if pot odds great with speculative
          if (toCall > 0) {
            if (category === 'Speculative' && potOdds <= 0.15) return { kind: 'Call' };
            return { kind: 'Fold' };
          }
          return { kind: 'Fold' };
        }
      }

      // Mid / Deep stack behavior
      // Open raise sizing 2x-3x BB with RNG; position affects size a bit
      const openRaiseToBB = (): number => {
        let base = rng(2.0, 3.0);
        if (latePosition) base -= 0.2;
        if (midStack) base += 0.1;
        if (deepStack) base += 0.2;
        if (pAgg) base += 0.3;
        if (pManiac) base += 0.6;
        if (pPassive) base -= 0.2;
        if (pNit) base -= 0.3;
        return Math.max(2.0, base);
      };

      // 3-bet sizing 2x-4x previous raise
      const reraiseToBB = (): number => {
        let mult = rng(2.0, 4.0);
        if (pAgg) mult += 0.3;
        if (pManiac) mult += 0.8;
        if (pPassive) mult -= 0.3;
        if (pNit) mult -= 0.6;
        const target = currentRaiseToBB * mult;
        return Math.max(currentRaiseToBB * 2.0, target);
      };

      // Choose action by category and difficulty
      if (!opened) {
        // Opening ranges
        if (category === 'Premium') {
          const raiseTo = easy ? roundToBB(2) : roundToBB(openRaiseToBB());
          return { kind: 'Raise', raiseTo };
        } else if (category === 'Good') {
          const raiseTo = easy ? roundToBB(2) : roundToBB(openRaiseToBB());
          return { kind: 'Raise', raiseTo };
        } else if (category === 'Speculative') {
          // Limp/call versus blinds with some frequency; allow opens late more if aggressive personalities
          const openFreq = (hard ? 0.25 : 0.12) + (pAgg ? 0.12 : 0) + (pManiac ? 0.2 : 0) - (pNit ? 0.1 : 0);
          if (latePosition && Math.random() < Math.max(0, openFreq)) {
            const raiseTo = roundToBB(Math.max(2, openRaiseToBB() - 0.2));
            return { kind: 'Raise', raiseTo };
          }
          // If we are just facing the blinds (no raise yet), allow a limp call with reasonable frequency
          const limpFreq = (hard ? 0.45 : 0.35) + (pAgg ? 0.08 : 0) - (pNit ? 0.12 : 0);
          if (toCall > 0 && toCall <= bb && Math.random() < Math.max(0.05, limpFreq)) {
            return { kind: 'Call' };
          }
          return toCall === 0 ? { kind: 'Call' } : { kind: 'Fold' };
        } else {
          // Trash: very occasionally steal from late position, otherwise fold
          const stealFreq = (hard ? 0.06 : 0.03) + (pManiac ? 0.08 : 0) + (pAgg ? 0.03 : 0);
          if (toCall === 0 && latePosition && Math.random() < stealFreq) {
            const raiseTo = roundToBB(2);
            return { kind: 'Raise', raiseTo };
          }
          return { kind: 'Fold' };
        }
      } else {
        // Facing a raise (consider 3-bet or call)
        if (category === 'Premium') {
          // Occasionally jam deep with AA/KK only on Hard
          if (hard && deepStack && Math.random() < 0.1) return { kind: 'AllIn' };
          const raiseTo = easy ? roundToBB(currentRaiseToBB * 2.0) : roundToBB(reraiseToBB());
          return { kind: 'Raise', raiseTo };
        } else if (category === 'Good') {
          // Mix: Medium/Hard sometimes 3-bet; Easy mostly call
          const threeBetFreq = (hard ? 0.45 : 0.25) + (pAgg ? 0.12 : 0) + (pManiac ? 0.2 : 0) - (pPassive ? 0.08 : 0) - (pNit ? 0.12 : 0);
          if (!easy && Math.random() < Math.max(0, threeBetFreq)) {
            const raiseTo = roundToBB(Math.max(currentRaiseToBB * 2.0, reraiseToBB() - (hard ? 0 : bb)));
            return { kind: 'Raise', raiseTo };
          }
          // Call if pot odds reasonable, else fold
          if (potOdds <= 0.33 || latePosition) return { kind: 'Call' };
          return { kind: 'Fold' };
        } else if (category === 'Speculative') {
          // Occasionally 3-bet bluff in position, more with aggressive personalities
          const bluff3BetFreq = (hard ? 0.15 : 0.05) + (pAgg ? 0.08 : 0) + (pManiac ? 0.15 : 0) - (pPassive ? 0.03 : 0) - (pNit ? 0.07 : 0);
          if (latePosition && Math.random() < Math.max(0, bluff3BetFreq)) {
            const raiseTo = roundToBB(Math.max(currentRaiseToBB * 2.0, currentRaiseToBB * rng(2.0, 3.0)));
            return { kind: 'Raise', raiseTo };
          }
          // Otherwise call only with good odds and position
          const callThresh = 0.22 + (pPassive ? 0.02 : 0) - (pManiac ? 0.02 : 0) - (pNit ? 0.02 : 0);
          if (potOdds <= callThresh && (latePosition || suited)) return { kind: 'Call' };
          return { kind: 'Fold' };
        }
        // Trash facing a raise
        return { kind: 'Fold' };
      }
    };

    const action = decidePreflop();
    // Execute action
    if (action.kind === 'Fold') {
      const players = state.players.map((p, i) => i === botIndex ? { ...p, hasFolded: true } : p);
      const newState = {
        ...state,
        players,
        currentPlayerIndex: (botIndex + 1) % state.players.length,
        actionLog: [...state.actionLog, { message: `${bot.name} folded`, time: new Date().toLocaleTimeString() }]
      };
      const activePlayers = newState.players.filter(p => !p.hasFolded);
      if (activePlayers.length <= 1) {
        // Award pot to the last remaining player and transition to showdown
        const winnerIndex = newState.players.findIndex(p => !p.hasFolded);
        const awarded = awardPotToWinner(newState, winnerIndex, 'all others folded');
        return { ...awarded, stage: 'Showdown' };
      }
      return newState;
    }

    if (action.kind === 'Call') {
      const pay = Math.min(toCall, bot.chips);
      const newStack = { ...bot.chipStack };
      const used = takeFromChipStackGreedy(newStack, pay);
      const players = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newStack } : p);
      return {
        ...state,
        players,
        pot: state.pot + pay,
        potStack: addToChipStack({ ...state.potStack }, used),
        currentPlayerIndex: (botIndex + 1) % state.players.length,
        actionLog: [...state.actionLog, { message: `${bot.name} called ${pay}`, time: new Date().toLocaleTimeString() }]
      };
    }

    if (action.kind === 'AllIn') {
      const pay = Math.min(bot.chips, toCall + (bot.chips - toCall)); // all remaining chips
      const newStack = { ...bot.chipStack };
      const used = takeFromChipStackGreedy(newStack, pay);
      const players = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newStack } : p);
      return {
        ...state,
        players,
        pot: state.pot + pay,
        potStack: addToChipStack({ ...state.potStack }, used),
        currentPlayerIndex: (botIndex + 1) % state.players.length,
        actionLog: [...state.actionLog, { message: `${bot.name} went all-in (${pay})`, time: new Date().toLocaleTimeString(), isImportant: true }]
      };
    }

    // Raise branch
    if (action.kind === 'Raise' && action.raiseTo) {
      const targetRaiseTo = Math.max(action.raiseTo, highestBet + state.bigBlind); // ensure legal min raise
      const raiseAmount = Math.max(0, targetRaiseTo - highestBet);
      const pay = Math.min(toCall + raiseAmount, bot.chips);
      if (pay <= 0) {
        // fallback to call if somehow zero
        const payCall = Math.min(toCall, bot.chips);
        const newStackCall = { ...bot.chipStack };
        const usedCall = takeFromChipStackGreedy(newStackCall, payCall);
        const playersCall = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - payCall, bet: p.bet + payCall, chipStack: newStackCall } : p);
        return {
          ...state,
          players: playersCall,
          pot: state.pot + payCall,
          potStack: addToChipStack({ ...state.potStack }, usedCall),
          currentPlayerIndex: (botIndex + 1) % state.players.length,
          actionLog: [...state.actionLog, { message: `${bot.name} called ${payCall}`, time: new Date().toLocaleTimeString() }]
        };
      }
      const newStack = { ...bot.chipStack };
      const used = takeFromChipStackGreedy(newStack, pay);
      const players = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newStack } : p);
      return {
        ...state,
        players,
        pot: state.pot + pay,
        potStack: addToChipStack({ ...state.potStack }, used),
        currentPlayerIndex: (botIndex + 1) % state.players.length,
        actionLog: [...state.actionLog, { message: `${bot.name} raised to ${highestBet + raiseAmount}`, time: new Date().toLocaleTimeString() }]
      };
    }

    // Safety fallback
    return state;
  }

  // Difficulty parameter presets
  let raiseCapBB = isPreflop ? 4 : 8; // baseline
  let baseRaiseChance = isPreflop ? 0.12 : 0.22;
  let baseFoldChance = toCall > 0 ? (isPreflop ? 0.07 : 0.1) : 0.02;
  let bluffChance = 0.1; // medium baseline
  let callMistakeChance = 0.06; // call without odds
  let randomFoldDecentChance = 0.04; // fold decent hands sometimes

  if (diff === 'Easy') {
    raiseCapBB = isPreflop ? 3 : 6;
    baseRaiseChance = isPreflop ? 0.03 : 0.06; // rarely raise
    baseFoldChance = toCall > 0 ? 0.22 : 0.05; // fold more when facing bets
    bluffChance = 0.0; // never bluff
    callMistakeChance = 0.12; // sometimes call incorrectly
    randomFoldDecentChance = 0.10; // sometimes fold decent hands
  } else if (diff === 'Hard') {
    raiseCapBB = isPreflop ? 5 : 10;
    baseRaiseChance = isPreflop ? 0.18 : 0.28;
    baseFoldChance = toCall > 0 ? 0.05 : 0.01; // fewer random folds
    bluffChance = 0.08; // strategic bluffs
    callMistakeChance = 0.03; // fewer mistakes
    randomFoldDecentChance = 0.02;
  }

  // Adjust with position
  if (latePosition) baseRaiseChance += 0.07;
  else if (midPosition) baseRaiseChance += 0.03;

  // Personality adjustments (postflop/general)
  if (personality === 'Aggressive') {
    baseRaiseChance += 0.1;
    bluffChance += 0.05;
    baseFoldChance = Math.max(0, baseFoldChance - 0.03);
    raiseCapBB += 1;
  } else if (personality === 'Passive') {
    baseRaiseChance = Math.max(0, baseRaiseChance - 0.08);
    bluffChance = Math.max(0, bluffChance - 0.05);
    baseFoldChance += 0.05;
    raiseCapBB = Math.max(2, raiseCapBB - 1);
  } else if (personality === 'Maniac') {
    baseRaiseChance += 0.2;
    bluffChance += 0.12;
    baseFoldChance = Math.max(0, baseFoldChance - 0.06);
    raiseCapBB += 3;
  } else if (personality === 'Nit') {
    baseRaiseChance = Math.max(0, baseRaiseChance - 0.12);
    bluffChance = Math.max(0, bluffChance - 0.08);
    baseFoldChance += 0.08;
    raiseCapBB = Math.max(2, raiseCapBB - 2);
  }

  // Scale max raise by difficulty and stack
  const maxReasonableRaise = Math.min(state.bigBlind * raiseCapBB, bot.chips - toCall, Math.max(state.bigBlind * 2, Math.floor(state.pot * 0.9)));
  const canRaise = (bot.chips - toCall) > 0 && maxReasonableRaise > 0;

  // Decide fold paths first (random imperfections)
  const foldChance = baseFoldChance;
  const hasDecentHand = highPair || mediumPair || twoBroadway || (suited && connected);
  if (random < foldChance || (diff === 'Easy' && hasDecentHand && Math.random() < randomFoldDecentChance)) {
    const players = state.players.map((p, i) => 
      i === botIndex ? { ...p, hasFolded: true } : p
    );
    const newState = { 
      ...state, 
      players, 
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: `${bot.name} folded`, time: new Date().toLocaleTimeString() }] 
    };
    
    // Check if hand is over
    const activePlayers = newState.players.filter(p => !p.hasFolded);
    if (activePlayers.length <= 1) {
      return { ...newState, stage: 'Showdown' };
    }
    
    return newState;
  }
  
  // Determine if we prefer aggression
  let raiseChance = baseRaiseChance;
  if (highPair) raiseChance += 0.35;
  else if (mediumPair || twoBroadway) raiseChance += 0.15;
  else if (suited && connected && !isPreflop) raiseChance += 0.05;
  // Pot odds based discouragement to raise when very bad odds
  if (toCall > 0 && potOdds > 0.5) raiseChance *= 0.6;

  // Strategic bluff window (except Easy)
  const considerBluff = !highPair && !mediumPair && !twoBroadway && (Math.random() < bluffChance);

  if (canRaise && (random < raiseChance || considerBluff)) {
    const raiseAmount = Math.max(minRaise, Math.min(maxReasonableRaise, Math.floor(minRaise + Math.random() * (maxReasonableRaise - minRaise))));
    
    if (raiseAmount > 0) {
      const pay = toCall + raiseAmount;
      const newStack = { ...bot.chipStack };
      const used = takeFromChipStackGreedy(newStack, pay);
      const players = state.players.map((p, i) => 
        i === botIndex ? { 
          ...p, 
          chips: p.chips - pay, 
          bet: p.bet + pay,
          chipStack: newStack
        } : p
      );
      
      const newState = { 
        ...state, 
        players, 
        pot: state.pot + pay,
        potStack: addToChipStack({ ...state.potStack }, used),
        currentPlayerIndex: (botIndex + 1) % state.players.length,
        actionLog: [
          ...state.actionLog, 
          { message: `${bot.name} raised to ${highestBet + raiseAmount}`, time: new Date().toLocaleTimeString() }
        ]
      };
      
      return newState;
    }
  }
  
  // Otherwise call/check
  if (toCall > 0) {
    // Call heuristics vary by difficulty using pot odds / hand strength
    let shouldCall = false;
    if (diff === 'Easy') {
      shouldCall = highPair || (Math.random() < callMistakeChance); // mostly pairs; occasional mistake calls
    } else if (diff === 'Medium') {
      shouldCall = highPair || mediumPair || twoBroadway || (potOdds <= 0.33 && (suited || connected));
      if (!shouldCall && Math.random() < 0.12) shouldCall = true; // occasional loose call
    } else { // Hard
      // Call if pot odds are acceptable or hand shows potential
      shouldCall = highPair || mediumPair || (potOdds <= 0.28) || ((suited && connected) && potOdds <= 0.35);
      if (!shouldCall && latePosition && Math.random() < 0.06) shouldCall = true; // light defend late pos
    }

    if (!shouldCall) {
      // Check if we can fold instead of calling
      const players = state.players.map((p, i) => 
        i === botIndex ? { ...p, hasFolded: true } : p
      );
      const newState = { 
        ...state, 
        players, 
        currentPlayerIndex: (botIndex + 1) % state.players.length,
        actionLog: [...state.actionLog, { message: `${bot.name} folded`, time: new Date().toLocaleTimeString() }] 
      };
      const activePlayers = newState.players.filter(p => !p.hasFolded);
      if (activePlayers.length <= 1) {
        // Award pot to the last remaining player and transition to showdown
        const winnerIndex = newState.players.findIndex(p => !p.hasFolded);
        const awarded = awardPotToWinner(newState, winnerIndex, 'all others folded');
        return { ...awarded, stage: 'Showdown' };
      }
      return newState;
    }

    const pay = Math.min(toCall, bot.chips);
    const newStack = { ...bot.chipStack };
    const used = takeFromChipStackGreedy(newStack, pay);
    const players = state.players.map((p, i) => 
      i === botIndex ? { 
        ...p, 
        chips: p.chips - pay, 
        bet: p.bet + pay,
        chipStack: newStack
      } : p
    );
    
    const newState = { 
      ...state, 
      players, 
      pot: state.pot + pay,
      potStack: addToChipStack({ ...state.potStack }, used),
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [
        ...state.actionLog, 
        { message: `${bot.name} called ${pay}`, time: new Date().toLocaleTimeString() }
      ]
    };
    
    return newState;
  } else {
    // Check
    const newState = { 
      ...state, 
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [
        ...state.actionLog, 
        { message: `${bot.name} checked`, time: new Date().toLocaleTimeString() }
      ]
    };
    
    return newState;
  }
}

// Advance to the next betting round or showdown
function advanceToNextStreet(state: TableState): TableState {
  // Reset player bets for the new street
  const players = state.players.map(p => ({ ...p, bet: 0 }));
  
  // Move to next street
  if (state.stage === 'PreFlop') {
    const flopState = proceedToFlop({ ...state, players });
    return { 
      ...flopState, 
      currentBet: 0,
      currentPlayerIndex: (state.dealerIndex + 1) % state.players.length,
      actionLog: [
        ...flopState.actionLog, 
        { message: 'Dealing the flop', time: new Date().toLocaleTimeString() }
      ]
    };
  } else if (state.stage === 'Flop') {
    const turnState = proceedToTurn({ ...state, players });
    return { 
      ...turnState, 
      currentBet: 0,
      currentPlayerIndex: (state.dealerIndex + 1) % state.players.length,
      actionLog: [
        ...turnState.actionLog, 
        { message: 'Dealing the turn', time: new Date().toLocaleTimeString() }
      ]
    };
  } else if (state.stage === 'Turn') {
    const riverState = proceedToRiver({ ...state, players });
    return { 
      ...riverState, 
      currentBet: 0,
      currentPlayerIndex: (state.dealerIndex + 1) % state.players.length,
      actionLog: [
        ...riverState.actionLog, 
        { message: 'Dealing the river', time: new Date().toLocaleTimeString() }
      ]
    };
  } else if (state.stage === 'River') {
    // Move to showdown and award pot to best high card among active players
    const active = players
      .map((p, idx) => ({ p, idx }))
      .filter(x => !x.p.hasFolded);
    let winnerIdx = active[0]?.idx ?? 0;
    let winnerCard = { suit: 'clubs', rank: '2' } as Card;
    let bestScore = -1;
    for (const { p, idx } of active) {
      const cards: Card[] = [...p.holeCards, ...state.board];
      if (cards.length === 0) continue;
      const best = bestHighCard(cards);
      const score = rankOrder[best.rank] * 10 + suitOrder[best.suit];
      if (score > bestScore) {
        bestScore = score;
        winnerIdx = idx;
        winnerCard = best;
      }
    }
    const afterAward = awardPotToWinner({ ...state, players }, winnerIdx, `Showdown high card ${winnerCard.rank} of ${winnerCard.suit}`);
    return { 
      ...afterAward, 
      stage: 'Showdown',
    };
  }
  
  return state;
}

// Export types and functions
export type { TableState } from '../types/table';
export { getHeroIndex, maxBet };

// Chip helpers
export function createDefaultChipStack(initialChipStack?: ChipStack): ChipStack {
  // Use provided initial chip stack or fall back to default distribution
  return initialChipStack || {
    1: 20,
    5: 20,
    25: 20,
    100: 10,
    500: 5,
    1000: 5
  };
}

export function deductFromChipStack(stack: ChipStack, amount: number): void {
  // Greedy deduction using highest denominations first
  const denoms = [1000, 500, 100, 25, 5, 1];
  let remaining = amount;
  for (const d of denoms) {
    const have = stack[d] ?? 0;
    if (have <= 0) continue;
    const use = Math.min(Math.floor(remaining / d), have);
    if (use > 0) {
      stack[d] = have - use;
      remaining -= use * d;
    }
  }
  // If couldn't cover exactly, allow negative chips fallback already handled by numeric chips
}



// Apply a decision coming from an external bot service
export function applyExternalBotDecision(
  state: TableState,
  botIndex: number,
  decision: { action: 'Fold' | 'Call' | 'Raise' | 'AllIn'; raiseTo?: number }
): TableState {
  const bot = state.players[botIndex];
  const highestBet = maxBet(state);
  const toCall = Math.max(0, highestBet - bot.bet);

  if (decision.action === 'Fold') {
    const players = state.players.map((p, i) => i === botIndex ? { ...p, hasFolded: true } : p);
    const next = {
      ...state,
      players,
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: `${bot.name} folded`, time: new Date().toLocaleTimeString() }]
    } as TableState;
    const active = next.players.filter(p => !p.hasFolded);
    if (active.length <= 1) {
      const winnerIndex = next.players.findIndex(p => !p.hasFolded);
      const awarded = awardPotToWinner(next, winnerIndex, 'all others folded');
      return { ...awarded, stage: 'Showdown' };
    }
    return next;
  }

  if (decision.action === 'Call') {
    const pay = Math.min(toCall, bot.chips);
    const newStack = { ...bot.chipStack };
    const used = takeFromChipStackGreedy(newStack, pay);
    const players = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newStack } : p);
    
    // Log as check if pay is 0, otherwise as call
    const actionMessage = pay === 0 ? `${bot.name} checked` : `${bot.name} called ${pay}`;
    
    return {
      ...state,
      players,
      pot: state.pot + pay,
      potStack: addToChipStack({ ...state.potStack }, used),
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: actionMessage, time: new Date().toLocaleTimeString() }]
    } as TableState;
  }

  if (decision.action === 'AllIn') {
    const pay = bot.chips; // shove remaining
    const newStack = { ...bot.chipStack };
    const used = takeFromChipStackGreedy(newStack, pay);
    const players = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newStack } : p);
    return {
      ...state,
      players,
      pot: state.pot + pay,
      potStack: addToChipStack({ ...state.potStack }, used),
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: `${bot.name} went all-in (${pay})`, time: new Date().toLocaleTimeString(), isImportant: true }]
    } as TableState;
  }

  // Raise
  const target = Math.max(decision.raiseTo ?? (highestBet + state.bigBlind), highestBet + state.bigBlind);
  const delta = Math.max(0, target - bot.bet);
  const pay = Math.min(delta, bot.chips);
  if (pay <= 0) {
    // Fallback to call
    const payCall = Math.min(toCall, bot.chips);
    const newStackCall = { ...bot.chipStack };
    const usedCall = takeFromChipStackGreedy(newStackCall, payCall);
    const playersCall = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - payCall, bet: p.bet + payCall, chipStack: newStackCall } : p);
    return {
      ...state,
      players: playersCall,
      pot: state.pot + payCall,
      potStack: addToChipStack({ ...state.potStack }, usedCall),
      currentPlayerIndex: (botIndex + 1) % state.players.length,
      actionLog: [...state.actionLog, { message: `${bot.name} called ${payCall}`, time: new Date().toLocaleTimeString() }]
    } as TableState;
  }
  const newStack = { ...bot.chipStack };
  const used = takeFromChipStackGreedy(newStack, pay);
  const players = state.players.map((p, i) => i === botIndex ? { ...p, chips: p.chips - pay, bet: p.bet + pay, chipStack: newStack } : p);
  return {
    ...state,
    players,
    pot: state.pot + pay,
    potStack: addToChipStack({ ...state.potStack }, used),
    currentPlayerIndex: (botIndex + 1) % state.players.length,
    actionLog: [...state.actionLog, { message: `${bot.name} raised to ${bot.bet + pay}`, time: new Date().toLocaleTimeString() }]
  } as TableState;
}
