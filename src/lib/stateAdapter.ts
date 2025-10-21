import type { Card, TableLogEntry, TablePlayer, TableStateServer } from './pokerService';
import type { ChipStack, DealConfig, TableState, Player as UiPlayer } from '../types/table';

// Map server player to UI player
function mapPlayer(p: TablePlayer): UiPlayer {
  return {
    id: p.id,
    name: p.name,
    isBot: p.is_bot,
    isHero: p.is_hero,
    chips: p.chips,
    chipStack: {} as ChipStack, // backend can add denominations later; UI falls back to numeric chips
    bet: p.bet,
    holeCards: p.hole_cards as Card[],
    hasFolded: p.has_folded,
    seatIndex: p.seat_index,
  };
}

// Map server logs to UI ActionLogEntry minimal shape
function mapLogs(logs: TableLogEntry[]): TableState['actionLog'] {
  return (logs || []).map(l => ({
    message: l.message,
    time: l.time,
  }));
}

export function adaptServerToClient(s: TableStateServer): TableState {
  const players = (s.players || []).map(mapPlayer);
  const potStack = (s.pot_stack || {}) as Record<number, number>;
  const actionLog = mapLogs(s.logs || []);

  // Dealer draw helpers (optional on server)
  const dealerDrawCards: Record<string, Card | null> = s.dealer_draw_cards || {};
  const dealerDrawRevealed = Boolean(s.dealer_draw_revealed);
  const dealerDrawInProgress = Boolean(s.dealer_draw_in_progress);

  return {
    deck: s.deck as Card[],
    board: s.board as Card[],
    burned: s.burned as Card[],
    communityCards: s.board as Card[],
    players,
    dealerIndex: s.dealer_index ?? -1,
    smallBlindIndex: s.small_blind_index ?? -1,
    bigBlindIndex: s.big_blind_index ?? -1,
    currentPlayerIndex: s.current_player_index ?? 0,
    pot: s.pot ?? 0,
    potStack,
    smallBlind: s.small_blind,
    bigBlind: s.big_blind,
    handNumber: s.hand_number ?? 1,
    currentBet: s.current_bet ?? 0,
    dealerDrawCards,
    dealerDrawRevealed,
    dealerDrawInProgress,
    actionLog,
    dealingState: {
      isDealing: false,
      currentDealIndex: 0,
      dealOrder: [],
      highlightHighCard: false,
      highCardPlayerIndex: null,
      stage: 'none',
    },
    stage: s.stage,
    botPendingIndex: s.bot_pending_index ?? null,
    botDecisionDueAt: s.bot_decision_due_at ?? null,
    difficulty: s.difficulty,
  } as TableState;
}

// Optionally, convert UI config to server config
export function uiDealConfigToServer(cfg: DealConfig) {
  return {
    small_blind: cfg.smallBlind,
    big_blind: cfg.bigBlind,
    num_bots: cfg.numBots,
    starting_chips: cfg.startingChips,
    difficulty: cfg.difficulty,
  } as const;
}
