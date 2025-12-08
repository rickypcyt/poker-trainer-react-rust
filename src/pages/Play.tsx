import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';
import type { Difficulty, Player, TableState } from '../types/table';
import type { Rank, Suit } from '../types/cards';
import {
  createInitialTable,
  heroCall,
  heroFold,
  heroRaiseTo,
  performBotActionNow,
  performDealerDraw,
  revealDealerDraw as revealDealerDrawEngine,
  startNewHand,
} from '../lib/tableEngine';

import ChipStack from '../components/ChipStack';
import Dealer from '../components/Dealer';
import HandRankingCard from '../components/HandRankingCard';
import LogsModal from '../components/LogsModal';
import Navbar from '../components/Navbar';
import PlayerSeat from '../components/PlayerSeat';
import PokerCard from '../components/PokerCard';
import React from 'react';
// import { createChipStack } from '../utils/chipUtils'; // no longer used with server-side engine
// ActionLogEntry is used in the type definition below
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';

// Game configuration
const GAME_CONFIG = {
  smallBlind: 25,
  bigBlind: 50,
  numBots: 2, // 2 bots + 1 human = 3 players total
  startingChips: 5000, // $5,000 starting stack
  chipDenominations: [1, 5, 25, 100, 500, 1000] as const,
};

const Play: React.FC = () => {
  const navigate = useNavigate();
  const [isHandsOpen, setIsHandsOpen] = React.useState(false);
  const [isLogsOpen, setIsLogsOpen] = React.useState(false);
  const [showRaiseDialog, setShowRaiseDialog] = React.useState(false);
  const [raiseAmount, setRaiseAmount] = React.useState(0);
  // End-of-hand modal
  const [heroWonAmount, setHeroWonAmount] = React.useState(0);
  const [isEndModalOpen, setIsEndModalOpen] = React.useState(false);
  const [endModalResult, setEndModalResult] = React.useState<'won' | 'lost' | null>(null);
  const lastModalHandRef = React.useRef<number>(-1);
  const isEndingRef = React.useRef<boolean>(false);
  const [seatActions, setSeatActions] = React.useState<Record<string, string>>({});
  const chipAnchorsRef = React.useRef<Record<string, HTMLDivElement | null>>({});
  const potRef = React.useRef<HTMLDivElement | null>(null);
  const dealerRef = React.useRef<HTMLDivElement | null>(null);
  const [flyingChips, setFlyingChips] = React.useState<Array<{ id: string; colorClass: string; left: number; top: number; toLeft: number; toTop: number }>>([]);
  const prevPotRef = React.useRef<number>(0);
  // Try to hydrate from localStorage
  const savedTable = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_table') : null;
  const showSetup = React.useState<boolean>(() => !savedTable)[0];

  const [table, setTable] = React.useState<TableState>(() => {
    // Read config overrides (difficulty)
    let cfgDifficulty: Difficulty = 'Medium';
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.difficulty === 'string') cfgDifficulty = parsed.difficulty as Difficulty;
        }
      }
    } catch { /* ignore malformed config */ }

    if (savedTable) {
      try {
        const parsed = JSON.parse(savedTable);
        // Validate that the parsed table has the required structure
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.players)) {
          return parsed;
        } else {
          console.warn('Saved table has invalid structure, starting new table');
        }
      } catch (e) {
        console.warn('Failed to parse saved table, starting new table', e);
      }
    }

    // Initialize a fresh local engine table
    const numBots = (() => {
      try {
        const cfg = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_config') : null;
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.numBots === 'number') return parsed.numBots;
        }
      } catch { /* ignore */ }
      return GAME_CONFIG.numBots;
    })();
    const startingChips = (() => {
      try {
        const cfg = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_config') : null;
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.startingChips === 'number') return parsed.startingChips;
        }
      } catch { /* ignore */ }
      return GAME_CONFIG.startingChips;
    })();
    const t = createInitialTable({
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      numBots,
      startingChips,
      initialChipStack: { 1: 5, 5: 5, 25: 5, 100: 5, 500: 5, 1000: 5 }, // Default chip distribution
      difficulty: cfgDifficulty,
    });
    return { ...t, lossReason: '', suggestion: '' };
  });
  // No server id when using local engine
  // Local helpers replacing former tableEngine utilities, backed by server state
  const getHeroIndex = React.useCallback((t: TableState) => {
    return t?.players?.findIndex(p => p.isHero) ?? -1;
  }, []);
  const maxBet = React.useCallback((t: TableState) => {
    // Prefer server-provided currentBet, fallback to max player bet
    const byField = typeof t.currentBet === 'number' ? t.currentBet : 0;
    const byPlayers = t?.players?.length ? Math.max(...t.players.map(p => p.bet || 0)) : 0;
    return Math.max(byField, byPlayers);
  }, []);
  // Reveal winner of Dealer Draw using frontend engine (single-card reveal with tie-breaker by suit)
  const revealDealerDraw = React.useCallback((prev: TableState) => {
    return revealDealerDrawEngine(prev);
  }, []);

  // When entering DealerDraw, auto-draw exactly ONE card per player if not already drawn
  React.useEffect(() => {
    if (table?.dealerDrawInProgress && !table?.dealerDrawRevealed && table?.players?.length) {
      const cards = table.dealerDrawCards || {};
      const needsCards = Object.keys(cards).length === 0 || Object.values(cards).some((c) => c == null);
      if (needsCards) {
        setTable((prev: TableState) => performDealerDraw(prev));
      }
    }
  }, [table?.dealerDrawInProgress, table?.dealerDrawRevealed, table?.dealerDrawCards, table?.players?.length]);

  const pendingNumBots = (() => {
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.numBots === 'number') return parsed.numBots;
        }
      }
    } catch { /* ignore */ }
    return GAME_CONFIG.numBots;
  })();

  const computeQuickRaiseTo = React.useCallback((kind: 'half' | 'twoThirds' | 'pot' | 'allin' | 'min') => {
    const hero = table.players?.find((p: Player) => p.isHero);
    if (!hero) return 0;
    const highest = maxBet(table);
    const toCall = Math.max(0, highest - (hero.bet || 0));
    const pot = table.pot || 0;
    const bb = table.bigBlind || 0;

    if (kind === 'allin') return (hero.chips || 0) + (hero.bet || 0);

    // Base target sizing on current pot + toCall (common quick sizing baseline)
    let target = 0;
    if (kind === 'half') target = Math.round(0.5 * (pot + toCall));
    if (kind === 'twoThirds') target = Math.round((2 / 3) * (pot + toCall));
    if (kind === 'pot') target = pot + toCall;
    if (kind === 'min') target = Math.max(bb, highest + bb - (hero.bet || 0));

    // Convert target sizing to total bet amount (hero.bet after action)
    // Ensure at least a min-raise if calling a raise
    const minRaiseTo = Math.max(bb, highest + bb);
    let raiseTo = (hero.bet || 0) + Math.max(toCall, target);
    raiseTo = Math.max(raiseTo, minRaiseTo);
    // Cap at all-in
    const cap = (hero.chips || 0) + (hero.bet || 0);
    raiseTo = Math.min(raiseTo, cap);
    return raiseTo;
  }, [table, maxBet]);

  const handleQuickBet = React.useCallback((kind: 'half' | 'twoThirds' | 'pot' | 'allin' | 'min') => {
    try {
      const val = computeQuickRaiseTo(kind);
      if (!val) return;
      const next = heroRaiseTo(table, val);
      setTable(next);
      if (next.stage === 'Showdown') setReveal(true);
    } catch (e) {
      console.error('Quick bet failed', e);
    }
  }, [table, computeQuickRaiseTo]);
  const [reveal, setReveal] = React.useState(false);
  const [isDealing] = React.useState(false);

  // Using local engine: no server initialization effect needed

  // Persist table to localStorage on change
  React.useEffect(() => {
    try {
      if (!isEndingRef.current && table && Array.isArray(table.players) && table.players.length > 0) {
        localStorage.setItem('poker_trainer_table', JSON.stringify(table));
      }
    } catch (e) {
      console.warn('Failed to save table state', e);
    }
  }, [table]);

  // Show end-of-hand modal at Showdown once per hand
  React.useEffect(() => {
    if (table.stage !== 'Showdown') return;
    if (lastModalHandRef.current === table.handNumber) return;
    // Try to find the latest winner in the actionLog
    let heroWon = false;
    if (table.actionLog && table.actionLog.length > 0) {
      for (let i = table.actionLog.length - 1; i >= 0; i -= 1) {
        const msg = table.actionLog[i].message || '';
        const m = msg.match(/^(.*?)\s+wins the pot/i);
        if (m) {
          const name = m[1];
          heroWon = (name === 'You');
          break;
        }
      }
    }
    const result = heroWon ? 'won' : 'lost';
    setEndModalResult(result);
    const winAmount = Math.abs(table.pot || 0);
    setHeroWonAmount(heroWon ? winAmount : -winAmount);
    setIsEndModalOpen(true);
    lastModalHandRef.current = table.handNumber;
    // Append a concise result log entry for clarity
    setTable((prev: TableState) => ({
      ...prev,
      actionLog: [
        ...prev.actionLog,
        { message: heroWon ? 'You won this hand' : 'You lost this hand', time: new Date().toLocaleTimeString(), isImportant: true }
      ]
    }));
  }, [table.stage, table.handNumber, table.actionLog, table.pot]);

  // Show toast for EVERY new log entry; use toastShown flag to avoid duplicates
  React.useEffect(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return;
    const lastIndex = table.actionLog.length - 1;
    const lastEntry = table.actionLog[lastIndex];

    if (!lastEntry.toastShown) {
      toast(lastEntry.message, {
        autoClose: 3000,
        position: 'top-center',
        theme: 'dark',
        hideProgressBar: true,
        closeOnClick: true,
        pauseOnHover: false,
      });
      // Mark the entry as shown to prevent duplicate toasts
      setTable((prev: TableState) => {
        const idx = prev.actionLog.length - 1;
        if (idx < 0) return prev;
        const updated = prev.actionLog.map((e, i) =>
          i === idx ? { ...e, toastShown: true } : e
        );
        return { ...prev, actionLog: updated } as TableState;
      });
    }
  }, [table.actionLog]);

  // Track hero wins ("Play" wins) in localStorage when an actionLog says You wins the pot
  React.useEffect(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return;
    const last = table.actionLog[table.actionLog.length - 1];
    // Expect format "You wins the pot $<amount>" or "You wins the pot $<amount> (reason)"
    if (/^You\s+wins the pot\s+\$/.test(last.message)) {
      try {
        const key = 'poker_trainer_play_wins';
        const prev = Number(localStorage.getItem(key) || '0') || 0;
        localStorage.setItem(key, String(prev + 1));
      } catch { /* ignore */ }
    }
  }, [table.actionLog]);

  // Mini action bubbles near players: derive from last actionLog
  React.useEffect(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return;
    const last = table.actionLog[table.actionLog.length - 1];
    const msg = last.message;
    // Expected formats: "<Name> raised to X", "<Name> called Y", "<Name> checked", "<Name> folded"
    const match = msg.match(/^(.*?)\s+(raised to|called|checked|folded)(?:\s+([0-9]+))?/i);
    if (!match) return;
    const [, name, action, amount] = match;
    const player = table?.players?.find((p: Player) => (p.isHero ? 'You' : p.name) === name);
    if (!player) return;
    let text = '';
    if (action.toLowerCase().startsWith('raised')) text = amount ? `Raise to ${amount}` : 'Raise';
    else if (action.toLowerCase() === 'called') text = amount ? `Call ${amount}` : 'Call';
    else if (action.toLowerCase() === 'checked') text = 'Check';
    else if (action.toLowerCase() === 'folded') text = 'Fold';

    if (!text) return;
    setSeatActions(prev => ({ ...prev, [player.id]: text }));
    const tid = setTimeout(() => {
      setSeatActions(prev => {
        const cp = { ...prev };
        delete cp[player.id];
        return cp;
      });
    }, 1800);
    return () => clearTimeout(tid);
  }, [table.actionLog, table.players]);

  // Bot thinking: when a bot is pending, perform the action immediately
  React.useEffect(() => {
    if (table.botPendingIndex == null) {
      return;
    }

    // Bot decision handling is now done locally through the table engine
    const botIndex = table.botPendingIndex;
    if (botIndex !== null) {
      console.log(`[Bot] Processing bot move for player ${botIndex}`);
    }

    // Perform bot action immediately without delay
    (async () => {
      // Use local engine decision without putting a Promise into state
      const next = await performBotActionNow(table);
      if (next.stage === 'Showdown') setReveal(true);
      setTable(next);
    })();
  }, [table.botPendingIndex, table]);


  // Animate chips to pot when pot increases
  React.useEffect(() => {
    const prevPot = prevPotRef.current;
    if ((table.pot || 0) > prevPot && table.actionLog && table.actionLog.length > 0) {
      const last = table.actionLog[table.actionLog.length - 1];
      // Identify the actor: raised or called
      let actorName: string | null = null;
      if (last) {
        const m = last.message.match(/^(.*?)\s+(raised to|called)/i);
        if (m) actorName = m[1];
      }
      const actor = table.players?.find((p: Player) => (p.isHero ? 'You' : p.name) === actorName) || null;
      const sourceEl = actor ? chipAnchorsRef.current[actor.id] : null;
      // Animate towards the Dealer (requested):
      const targetEl = dealerRef.current;
      if (sourceEl && targetEl) {
        const s = sourceEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        // Choose a color based on a denom close to delta
        const delta = (table.pot || 0) - prevPot;
        let denom: number = CHIP_DENOMS[0] as number;
        for (const d of [...CHIP_DENOMS].sort((a, b) => Number(b) - Number(a))) {
          if (delta >= d) { denom = d; break; }
        }
        const colorClass = CHIP_COLOR_CLASS[denom];
        const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        const chip = { id, colorClass, left: s.left + s.width / 2, top: s.top, toLeft: t.left + t.width / 2, toTop: t.top + t.height / 2 };
        setFlyingChips((arr) => [...arr, chip]);
        // Remove after animation ends
        setTimeout(() => {
          setFlyingChips((arr) => arr.filter((c) => c.id !== id));
        }, 800);
      }
    }
    prevPotRef.current = table.pot || 0;
  }, [table.pot, table.actionLog, table.players]);

  // Use exact pot breakdown tracked by the engine
  const potChipStack: Record<number, number> = React.useMemo(() => {
    return table.potStack || {} as Record<number, number>;
  }, [table.potStack]);

  // Using local engine: no server polling while a bot is pending

  // After revealing highest card, show the cards and toast, then auto-start the hand after 5 seconds
  React.useEffect(() => {
    if (table.dealerDrawInProgress && table.dealerDrawRevealed) {
      // Toast winner and dealer seat
      try {
        const winnerIdx = table.dealingState?.highCardPlayerIndex ?? table.dealerIndex;
        if (winnerIdx != null && winnerIdx >= 0) {
          const winner = table.players?.[winnerIdx];
          const winnerCard = table.dealerDrawCards[winner.id];
          if (winner && winnerCard) {
            toast.success(`${winner.name} wins the dealer button (high card ${winnerCard.rank} of ${winnerCard.suit})`);
          } else if (winner) {
            toast.success(`${winner.name} wins the dealer button (high card)`);
          }
        }
      } catch (e) {
        // Non-fatal: toasting winner is best-effort only
        try { console.warn('Dealer draw toast failed', e); } catch { /* noop */ }
      }
      const t = setTimeout(() => {
        // Start the hand locally with the engine
        setReveal(false);
        setTable((prev: TableState) => startNewHand(prev));
      }, 1500); // shorter wait so we don't linger on starting state
      return () => clearTimeout(t);
    }
  }, [table.dealerDrawInProgress, table.dealerDrawRevealed, table.dealerDrawCards, table.players, table.dealerIndex, table.dealingState?.highCardPlayerIndex]);

  // (removed handleNewHand to avoid reference before init in dependencies)

  const handleEndGame = () => {
    // Prevent persistence effect from re-saving the table while ending
    isEndingRef.current = true;
    // Append a log entry in the in-memory state for UX continuity
    setTable((prev: TableState) => ({
      ...prev,
      actionLog: [
        ...prev.actionLog,
        {
          message: 'Game ended — unfinished',
          time: new Date().toLocaleTimeString(),
          isImportant: true,
          status: 'unfinished'
        }
      ]
    }));

    // Hard clear any persisted table/cache so a new session starts clean
    try {
      // Explicit known keys
      localStorage.removeItem('poker_trainer_table');
      localStorage.removeItem('poker_trainer_table_id');
      // Clean any other stray keys that belong to the saved table namespace
      const toRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k) continue;
        if (k.startsWith('poker_trainer_table')) {
          toRemove.push(k);
        }
      }
      toRemove.forEach((k) => localStorage.removeItem(k));
    } catch { /* ignore */ }

    // Go back to main menu and replace history entry to avoid returning to Play with Back
    navigate('/', { replace: true });
  };

  const handlePlayerAction = React.useCallback((action: 'Fold' | 'Call' | 'Raise', amount?: number) => {
    const hero = table.players?.find((p: Player) => p.isHero);
    if (!hero) return;
    // If not hero's turn or already showdown, ignore
    if (table.stage === 'Showdown' || table.players?.indexOf(hero) !== table.currentPlayerIndex) return;

    try {
      let next: TableState = table;
      if (action === 'Fold') {
        next = heroFold(table);
      } else if (action === 'Call') {
        next = heroCall(table);
      } else if (action === 'Raise') {
        const highest = maxBet(table);
        const minRaise = Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
        const raiseTo = amount !== undefined ? amount : minRaise;
        next = heroRaiseTo(table, Math.max(raiseTo, minRaise));
        setShowRaiseDialog(false);
      }
      setTable(next);
      if (next.stage === 'Showdown') setReveal(true);
    } catch (e) {
      console.error('Failed to process player action locally', e);
    }
  }, [table, maxBet]);

  const handleRaiseClick = () => {
    const hero = table.players?.find((p: Player) => p.isHero);
    if (!hero) return;
    const highest = maxBet(table);
    const minRaise = Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
    setRaiseAmount(minRaise);
    setShowRaiseDialog(true);
  };

  const { players, dealerIndex, smallBlindIndex, bigBlindIndex } = table;
  const bots = React.useMemo(() => (players?.filter((p: Player) => !p.isHero) || []), [players]);
  // Compute bot positions by actual table seat positions around an oval.
  // Hero is anchored at bottom (270°). Others placed by angular offset from hero.
  const botRing = React.useMemo(() => {
    const all = players ?? [];
    const n = bots.length;
    if (n === 0) return [] as Array<{ left: number; top: number; position: 'left' | 'right' | 'top' | 'bottom' }>;
    const totalSeats = all.length || n;
    const heroSeat = all.find((p: Player) => p.isHero)?.seatIndex ?? 0;
    const radiusX = 38; // percent width
    const radiusY = 32; // percent height for nicer oval
    const arr = bots.map((bot) => {
      const rel = ((bot.seatIndex - heroSeat + totalSeats) % totalSeats);
      const angleDeg = 270 + (360 / totalSeats) * rel;
      const theta = (angleDeg * Math.PI) / 180;
      const cx = 50 + radiusX * Math.cos(theta);
      const cy = 50 + radiusY * Math.sin(theta);
      let pos: 'left' | 'right' | 'top' | 'bottom' = 'left';
      if (cy <= 35) pos = 'top';
      else if (cy >= 65) pos = 'bottom';
      else pos = cx < 50 ? 'left' : 'right';
      return { left: cx, top: cy, position: pos };
    });
    // Nudge bots #1 and #10 upward when exactly 10 bots are present
    if (n === 10) {
      const up = (i: number) => {
        if (!arr[i]) return;
        const t = Math.max(2, arr[i].top - 8);
        const pos: 'left' | 'right' | 'top' | 'bottom' = t <= 35 ? 'top' : arr[i].position;
        arr[i] = { ...arr[i], top: t, position: pos };
      };
      up(0);        // bot #1 (first in list)
      up(n - 1);   // bot #10 (last in list)

      // Horizontal tweak: move #6 left and #5 right slightly to improve spacing
      const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
      const shiftX = (i: number, dx: number) => {
        if (!arr[i]) return;
        const nx = clamp(arr[i].left + dx, 6, 94);
        let pos: 'left' | 'right' | 'top' | 'bottom' = arr[i].position;
        if (arr[i].top > 35 && arr[i].top < 65) {
          pos = nx < 50 ? 'left' : 'right';
        }
        arr[i] = { ...arr[i], left: nx, position: pos };
      };
      shiftX(5, -6); // bot #6 more to the left
      shiftX(4, +6); // bot #5 more to the right
    }
    return arr;
  }, [bots, players]);

  // Derived info for UI hints and status
  const heroIdx = getHeroIndex(table);
  const hero = table.players?.[heroIdx];
  const highestBet = maxBet(table);
  const toCallVal = Math.max(0, highestBet - (hero?.bet || 0));
  const minRaiseToVal = Math.max((table.bigBlind || 0), (highestBet || 0) + (table.bigBlind || 0));
  const isHeroTurn = heroIdx >= 0 && table.currentPlayerIndex === heroIdx && table.stage !== 'Showdown';
  const currentActorName = isHeroTurn ? 'You' : (table.players?.[table.currentPlayerIndex || 0]?.name || 'Player');

  // Last action banner (English): derive from last actionLog
  const lastActionBanner = React.useMemo(() => {
    if (!table?.actionLog || table.actionLog.length === 0) return null;
    const last = table.actionLog[table.actionLog.length - 1];
    const msg = last.message || '';
    const m = msg.match(/^(.*?)\s+(raised to|called|checked|folded)(?:\s+([0-9]+))?/i);
    if (!m) return null;
    const [, nameRaw, actionRaw, amtRaw] = m;
    const isHero = nameRaw === 'You';
    const name = isHero ? 'You' : nameRaw;
    const actionLc = actionRaw.toLowerCase();
    let actionEn = '';
    if (actionLc.startsWith('raised')) actionEn = 'raised to';
    else if (actionLc === 'called') actionEn = 'called';
    else if (actionLc === 'checked') actionEn = 'checked';
    else if (actionLc === 'folded') actionEn = 'folded';
    const amount = amtRaw ? `$${Number(amtRaw).toLocaleString()}` : '';
    const text = amount && actionEn.includes('raised') ? `${name} ${actionEn} ${amount}` : `${name} ${actionEn}${amount ? ' ' + amount : ''}`;
    return { text, isHero } as { text: string; isHero: boolean };
  }, [table.actionLog]);

  // Keyboard shortcuts for quick actions when it's hero's turn
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHeroTurn || table.stage === 'Showdown' || table.dealerDrawInProgress) return;
      const k = e.key.toLowerCase();
      if (['f', 'c', 'r', '1', '2', '3', 'a', 'm'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'f') return handlePlayerAction('Fold');
      if (k === 'c') return handlePlayerAction('Call');
      if (k === 'r') return handlePlayerAction('Raise');
      if (k === '1') return handleQuickBet('half');
      if (k === '2') return handleQuickBet('twoThirds');
      if (k === '3') return handleQuickBet('pot');
      if (k === 'a') return handleQuickBet('allin');
      if (k === 'm') return handleQuickBet('min');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHeroTurn, table.stage, table.dealerDrawInProgress, handlePlayerAction, handleQuickBet]);

  // Note: animateDeal function was removed as it was not being used
  // and the card dealing animation is handled by the table engine

  // Safety check: if table is in invalid state, show loading or error
  if (!table || !table.players || !Array.isArray(table.players)) {
    return (
      <div className="min-h-screen bg-green-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading game...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      <Navbar 
        onShuffle={() => { setReveal(false); setTable((prev: TableState) => startNewHand(prev)); }} 
        actionLabel="New Hand" 
        onOpenLogs={() => setIsLogsOpen(true)}
        onOpenHands={() => setIsHandsOpen(true)}
        onEndGame={handleEndGame}
      />

      {/* Setup overlay when starting new game */}
      {showSetup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          <div className="relative z-10 w-[92vw] max-w-md bg-neutral-900 text-white rounded-2xl border border-white/10 shadow-2xl p-6">
            <h2 className="text-xl font-bold mb-4 text-center">Game Settings</h2>
            <div className="space-y-5">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="bots" className="text-white/80 text-base">Number of Bots</label>
                  <span className="text-white font-semibold">{pendingNumBots}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* End of hand modal */}
      {isEndModalOpen && endModalResult && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/70" />
          <div className="relative bg-slate-900 text-white rounded-xl shadow-2xl border border-white/10 w-[92vw] max-w-[520px] p-6">
            <div className="text-center mb-4">
              <div className={`text-2xl font-extrabold ${endModalResult === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                {endModalResult === 'won' ? '¡Ganaste!' : 'Perdiste'}
              </div>
              <div className="text-base text-white/80 mt-1">¿Quieres ver el log de la mano o empezar un nuevo juego?</div>
            </div>
            <div className="flex gap-3 mt-4">
              <button
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 rounded-md shadow"
                onClick={() => { setIsLogsOpen(true); setIsEndModalOpen(false); }}
              >
                Ver Log
              </button>
              <button
                className="flex-1 bg-yellow-600 hover:bg-yellow-500 text-white font-semibold py-2 rounded-md shadow"
                onClick={() => { setIsEndModalOpen(false); setReveal(false); setTable((prev: TableState) => startNewHand(prev)); }}
              >
                Nueva mano
              </button>
            </div>
            <div className="flex gap-3 mt-3">
              <button
                className="w-full bg-red-700 hover:bg-red-600 text-white font-semibold py-2 rounded-md shadow"
                onClick={() => { setIsEndModalOpen(false); handleEndGame(); }}
              >
                Nuevo juego
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast notifications moved to App root */}

      {/* Logs modal */}
      <LogsModal 
        isOpen={isLogsOpen}
        onClose={() => setIsLogsOpen(false)}
        entries={table.actionLog}
        onClear={() => setTable((prev: TableState) => ({ ...prev, actionLog: [] }))}
      />

      {/* Poker Hands modal */}
      {isHandsOpen && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center p-2 sm:p-4 md:p-6">
          <div 
            className="absolute inset-0 bg-black/70 backdrop-blur-sm" 
            onClick={() => setIsHandsOpen(false)} 
          />
          <div className="relative z-10 w-full h-full max-w-8xl max-h-[90vh] bg-neutral-900/95 text-white rounded-2xl border border-white/10 shadow-2xl p-6 sm:p-8 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between mb-4 sm:mb-6">
              <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Poker Hand Rankings
              </h2>
              <button 
                className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg bg-white/10 hover:bg-white/20 border border-white/20 text-sm sm:text-base transition-colors duration-200" 
                onClick={() => setIsHandsOpen(false)}
              >
                Close
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 text-white/90 text-sm overflow-y-auto pr-2 flex-1 custom-scrollbar">
              <HandRankingCard
                title="Royal Flush"
                description="A-K-Q-J-10 same suit"
                cards={[
                  { rank: 'A', suit: 'hearts' },
                  { rank: 'K', suit: 'hearts' },
                  { rank: 'Q', suit: 'hearts' },
                  { rank: 'J', suit: 'hearts' },
                  { rank: '10', suit: 'hearts' }
                ]}
              />

              <HandRankingCard
                title="Straight Flush"
                description="Five in a row, same suit"
                cards={[
                  { rank: '9', suit: 'spades' },
                  { rank: '8', suit: 'spades' },
                  { rank: '7', suit: 'spades' },
                  { rank: '6', suit: 'spades' },
                  { rank: '5', suit: 'spades' }
                ]}
              />

              <HandRankingCard
                title="Four of a Kind"
                description="Four cards same rank"
                cards={[
                  { rank: '9', suit: 'hearts' },
                  { rank: '9', suit: 'spades' },
                  { rank: '9', suit: 'diamonds' },
                  { rank: '9', suit: 'clubs' },
                  { rank: 'K', suit: 'hearts' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Full House"
                description="Three of a kind + a pair"
                cards={[
                  { rank: '10', suit: 'hearts' },
                  { rank: '10', suit: 'spades' },
                  { rank: '10', suit: 'diamonds' },
                  { rank: '7', suit: 'clubs' },
                  { rank: '7', suit: 'hearts' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Flush"
                description="Five cards same suit"
                cards={[
                  { rank: 'A', suit: 'clubs' },
                  { rank: 'J', suit: 'clubs' },
                  { rank: '8', suit: 'clubs' },
                  { rank: '5', suit: 'clubs' },
                  { rank: '2', suit: 'clubs' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Straight"
                description="Five in a row"
                cards={[
                  { rank: '9', suit: 'hearts' },
                  { rank: '8', suit: 'clubs' },
                  { rank: '7', suit: 'diamonds' },
                  { rank: '6', suit: 'spades' },
                  { rank: '5', suit: 'hearts' }
                ]}
                scale={0.5}
              />

              <HandRankingCard
                title="Three of a Kind"
                description="Three cards same rank"
                cards={[
                  { rank: 'Q', suit: 'hearts' },
                  { rank: 'Q', suit: 'clubs' },
                  { rank: 'Q', suit: 'spades' },
                  { rank: '7', suit: 'hearts' },
                  { rank: '2', suit: 'diamonds' }
                ]}
              />

              <HandRankingCard
                title="Two Pair"
                description="Two different pairs"
                cards={[
                  { rank: 'K', suit: 'hearts' },
                  { rank: 'K', suit: 'clubs' },
                  { rank: '9', suit: 'spades' },
                  { rank: '9', suit: 'diamonds' },
                  { rank: '3', suit: 'hearts' }
                ]}
              />

              <HandRankingCard
                title="One Pair"
                description="Two cards same rank"
                cards={[
                  { rank: 'A', suit: 'spades' },
                  { rank: 'A', suit: 'diamonds' },
                  { rank: '9', suit: 'hearts' },
                  { rank: '6', suit: 'clubs' },
                  { rank: '2', suit: 'spades' }
                ]}
              />

              <div className="bg-white/5 border border-white/10 rounded-lg p-1.5 flex flex-col min-w-0">
                <div className="mb-1 text-center">
                  <div className="font-semibold truncate">High Card</div>
                  <div className="text-white/70 text-xs truncate">No matching cards</div>
                </div>
                <div className="flex items-center justify-center -space-x-3 flex-nowrap overflow-visible">
                  {[
                    {rank:'A' as Rank, suit:'hearts' as Suit},
                    {rank:'J' as Rank, suit:'spades' as Suit},
                    {rank:'8' as Rank, suit:'diamonds' as Suit},
                    {rank:'5' as Rank, suit:'clubs' as Suit},
                    {rank:'2' as Rank, suit:'hearts' as Suit}
                  ].map((c,i) => (
                    <div key={`hc-${i}`} className="flex-shrink-0 hover:-translate-y-1 transition-transform duration-200">
                      <PokerCard rank={c.rank} suit={c.suit} scale={0.55} className="sm:scale-75 md:scale-90 -mx-0.5" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="relative w-full h-[calc(100vh-6rem)] flex items-center justify-center px-2 py-2 overflow-hidden">
        {/* Chip legend removed; hover details are shown on each ChipStack */}
        {/* Simple chip legend row for reference (colors and labels) */}
        <div className="absolute left-2 top-2 flex items-center gap-2 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[11px] text-white/80">
          {CHIP_DENOMS.map((d) => (
            <div key={`legend-${d}`} className="flex items-center gap-1">
              <span className={`w-3 h-3 rounded-full border border-white/50 ${CHIP_COLOR_CLASS[d]}`} />
              <span>${d}</span>
            </div>
          ))}
        </div>

        {/* Top-right info panel */}
        <div className="absolute right-2 top-2 bg-gray-900/90 backdrop-blur-md rounded-xl p-3 border border-gray-600/50 shadow-xl w-[min(360px,42vw)] z-[70]">
          {lastActionBanner && (
            <div className={`mb-2 text-center text-sm font-semibold px-3 py-1 rounded-md border ${lastActionBanner.isHero ? 'bg-emerald-600/20 border-emerald-400/40 text-emerald-200' : 'bg-white/10 border-white/20 text-white/90'}`}>
              Última acción: {lastActionBanner.text}
            </div>
          )}
          <div className="text-white/90 text-sm mb-2 text-center">
            {isHeroTurn ? (
              <div>
                <span className="text-emerald-300 font-semibold">Your turn</span>
              </div>
            ) : (
              <div>
                Waiting for <span className="text-yellow-300 font-semibold">{currentActorName}</span>...
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 text-[12px] text-white/80">
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Stage: <span className="text-yellow-300 font-semibold">{table.stage}</span></div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Pot: <span className="text-yellow-300 font-semibold">${(table.pot||0).toLocaleString()}</span></div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Current bet: <span className="font-semibold">${highestBet}</span></div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10">To call: <span className="font-semibold">${toCallVal}</span></div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Min raise to: <span className="font-semibold">${minRaiseToVal}</span></div>
            <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Blinds: <span className="font-semibold">${table.smallBlind}/{table.bigBlind}</span></div>
          </div>
        </div>

        {/* Buttons card right (controls only) */}
        <div className="absolute right-2 bottom-2 bg-gray-900/90 backdrop-blur-md rounded-xl p-3 border border-gray-600/50 shadow-xl w-[min(360px,42vw)] z-[70]">
          <h3 className="text-white font-bold text-center mb-2 text-base uppercase tracking-wider">Controls</h3>
          
          {table.dealerDrawInProgress && !table.dealerDrawRevealed ? (
            <div className="flex justify-center">
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold px-6 py-2 rounded-md transition-colors shadow-md"
                onClick={() => setTable((prev: TableState) => revealDealerDraw(prev))}
              >
                Reveal highest card
              </button>
            </div>
          ) : table.dealerDrawInProgress && table.dealerDrawRevealed ? (
            <div className="flex flex-col gap-2 items-center">
              <div className="text-green-300 font-semibold px-4 py-2 rounded-md bg-green-600/20 border border-green-400/40">
                Starting hand...
              </div>
              <button
                className="bg-green-600 hover:bg-green-500 text-white font-semibold px-4 py-2 rounded-md transition-colors shadow-md"
                onClick={() => {
                  setReveal(false);
                  setTable((prev: TableState) => startNewHand(prev));
                }}
              >
                Start hand now
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {isHeroTurn && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                    onClick={() => handleQuickBet('half')}
                  >1/2 Pot (1)</button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                    onClick={() => handleQuickBet('twoThirds')}
                  >2/3 Pot (2)</button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                    onClick={() => handleQuickBet('pot')}
                  >Pot (3)</button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15"
                    onClick={() => handleQuickBet('min')}
                  >Min (M)</button>
                  <button
                    className="px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-white text-sm border border-white/15 col-span-2 sm:col-span-1"
                    onClick={() => handleQuickBet('allin')}
                  >All-in (A)</button>
                </div>
              )}
              <div className="flex flex-row flex-wrap gap-2 items-stretch">
              <button 
                className={`font-semibold px-4 py-2 rounded-md flex-1 min-w-[120px] transition-colors shadow-md ${
                  table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-red-700 hover:bg-red-600 text-white'
                }`}
                onClick={() => handlePlayerAction('Fold')}
                disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
              >
                Fold
              </button>
              <button 
                className={`font-semibold px-4 py-2 rounded-md flex-1 min-w-[140px] transition-colors shadow-md ${
                  table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
                }`}
                onClick={() => handlePlayerAction('Call')}
                disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
              >
                {(() => {
                  const hero = table.players?.[getHeroIndex(table)];
                  const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                  if (toCall === 0) return 'Check';
                  if (toCall >= (hero?.chips || 0)) return `All-in $${hero?.chips}`;
                  return `Call $${toCall}`;
                })()}
              </button>
              <button 
                className={`font-semibold px-6 py-2 rounded-md flex-1 min-w-[160px] transition-colors shadow-md ${
                  table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
                onClick={handleRaiseClick}
                disabled={table.players?.[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
              >
                {(() => {
                  const hero = table.players?.[getHeroIndex(table)];
                  const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                  const highest = maxBet(table);
                  const minRaise = Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                  if ((hero?.chips || 0) <= toCall) return 'All-in';
                  return `Raise to $${minRaise}`;
                })()}
              </button>
              
              {showRaiseDialog && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                  <div className="bg-gray-800 p-6 rounded-xl w-96">
                    <h3 className="text-xl font-bold mb-4 text-white">Raise Amount</h3>
                    <div className="mb-4">
                      <label className="block text-gray-300 mb-2">
                        Amount (Min: ${(() => {
                          const highest = maxBet(table);
                          return Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                        })()})
                      </label>
                      <input
                        type="number"
                        value={raiseAmount}
                        onChange={(e) => setRaiseAmount(Number(e.target.value))}
                        className="w-full p-2 rounded bg-gray-700 text-white border border-gray-600 focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setShowRaiseDialog(false)}
                        className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-500"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handlePlayerAction('Raise', raiseAmount)}
                        className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-500"
                        disabled={raiseAmount < (() => {
                          const highest = maxBet(table);
                          return Math.max(table.bigBlind || 0, highest + (table.bigBlind || 0));
                        })()}
                      >
                        Raise to ${raiseAmount}
                      </button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
          
          
        </div>
        {/* Poker table - larger and perfectly centered */}
        <div className="relative w-[90vw] max-w-[1200px] h-[65vh] min-h-[500px]">
          {/* Dealer position - higher on the table */}
          <div ref={dealerRef} className="absolute left-1/2 -translate-x-1/2 -top-12 z-10">
            <Dealer isDealing={isDealing} />
          </div>
          {/* Table mat with clean design */}
          <div className="absolute inset-0 bg-green-900/90 rounded-[40%] border-4 border-amber-100/20 shadow-xl overflow-hidden">
            {/* Felt texture with subtle pattern and gradient */}
            <div className="absolute inset-0 bg-gradient-to-br from-green-800/90 to-green-900/90">
              <div 
                className="absolute inset-0 opacity-10"
                style={{
                  backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'0.1\' fill-rule=\'evenodd\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/svg%3E")',
                }}
              />
            </div>
            
            {/* Main table area */}
            <div className="absolute inset-0">  
              {/* Pot display - absolute so it doesn't affect vertical centering of the board */}
              <div ref={potRef} className="absolute left-1/2 -translate-x-1/2 top-10 md:top-12 bg-black/80 text-white text-base md:text-2xl font-bold px-4 md:px-6 py-1.5 md:py-2 rounded-full border border-amber-100/20 shadow-md z-10">
                <span className="text-amber-100 font-mono">POT:</span> <span className="text-xl md:text-3xl text-yellow-300 font-mono">${(table.pot || 0).toLocaleString()}</span>
              </div>

              {/* Pot chip stack visualization */}
              <div className="absolute left-1/2 -translate-x-1/2 top-[96px] md:top-[120px] z-10">
                <div className="scale-[0.98]">
                  <ChipStack stack={potChipStack} showCounts countFormat="prefixX" size="md" columns={2} />
                </div>
              </div>

              {/* Board area - perfectly centered in Y axis */}
              <div className="absolute inset-0 flex items-center justify-center px-2 sm:px-4">
                <div className="flex items-center justify-center gap-2 sm:gap-3 md:gap-4">
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className={`relative aspect-[0.7] rounded-lg ${
                        i < (table.board?.length || 0)
                          ? 'bg-white shadow-lg hover:scale-[1.02] hover:z-10 transition-transform duration-200'
                          : 'bg-white/5 border-2 border-dashed border-white/20'
                      } flex items-center justify-center w-[clamp(56px,8vw,120px)]`}
                    >
                      {i < (table.board?.length || 0) && table.board?.[i] ? (
                        <PokerCard
                          suit={table.board[i].suit}
                          rank={table.board[i].rank}
                          className="w-full h-full [--card-rank-size:0.9rem] [--card-suit-size:1.4rem]"
                          scale={0.9}
                        />
                      ) : (
                        <span className="text-white/30 text-base sm:text-base md:text-lg font-bold">{i + 1}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            </div>
          </div>
          


        {/* Hero bottom center */}
        {players?.filter((p: Player) => p.isHero).map((p: Player) => (
          <div key={p.id} className="absolute left-1/2 bottom-2 -translate-x-1/2">
            <PlayerSeat
              player={p}
              isDealer={players?.indexOf(p) === dealerIndex}
              isSmallBlind={players?.indexOf(p) === smallBlindIndex}
              isBigBlind={players?.indexOf(p) === bigBlindIndex}
              reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
              drawCard={table.dealerDrawCards[p.id]}
              showDrawCard={table.dealerDrawInProgress}
              isActive={players?.indexOf(p) === (table.currentPlayerIndex ?? -1)}
              position="bottom"
              gameStage={table.stage}
              isThinking={table.botPendingIndex === players?.indexOf(p)}
              actionText={seatActions[p.id]}
              chipAnchorRef={(el) => { chipAnchorsRef.current[p.id] = el; }}
              isHighlighted={table.dealerDrawInProgress && table.dealerDrawRevealed && (players?.indexOf(p) === (table.dealingState?.highCardPlayerIndex ?? table.dealerIndex))}
            />
          </div>
        ))}

        {/* Other players placed around a ring */}
        {bots.map((p: Player, i: number) => {
          const idx = players?.indexOf(p) ?? -1;
          const pos = botRing[i] || { left: 88, top: 25, position: 'right' as const };
          const compactLevel = bots.length > 6 ? 'ultra' : (bots.length > 3 ? 'compact' : 'normal');
          return (
            <div
              key={p.id}
              className="absolute"
              style={{ left: `${pos.left}%`, top: `${pos.top}%`, transform: 'translate(-50%, -50%)' }}
            >
              <PlayerSeat
                player={p}
                isDealer={idx === dealerIndex}
                isSmallBlind={idx === smallBlindIndex}
                isBigBlind={idx === bigBlindIndex}
                reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
                drawCard={table.dealerDrawCards[p.id]}
                showDrawCard={table.dealerDrawInProgress}
                isActive={idx === (table.currentPlayerIndex ?? -1)}
                position={pos.position}
                gameStage={table.stage}
                isThinking={table.botPendingIndex === idx}
                actionText={seatActions[p.id]}
                chipAnchorRef={(el) => { chipAnchorsRef.current[p.id] = el; }}
                compactLevel={compactLevel as 'normal' | 'compact' | 'ultra'}
                isHighlighted={table.dealerDrawInProgress && table.dealerDrawRevealed && (idx === (table.dealingState?.highCardPlayerIndex ?? table.dealerIndex))}
              />
            </div>
          );
        })}

        
        
      </div>

      {/* Flying chips overlay (fixed to viewport for smooth animation) */}
      {flyingChips.map((c) => (
        <div
          key={c.id}
          className={`pointer-events-none fixed z-[60] w-5 h-5 rounded-full border-2 border-white/70 shadow ${c.colorClass}`}
          style={{ left: c.left, top: c.top, transition: 'transform 0.75s ease-out', transform: `translate(${c.toLeft - c.left}px, ${c.toTop - c.top}px)` }}
        />)
      )}

      {/* Enhanced End-of-hand Results Dashboard */}
      {isEndModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4 overflow-y-auto">
          <div className="bg-gradient-to-br from-zinc-900 to-zinc-800 text-white rounded-xl shadow-2xl border border-white/10 w-full max-w-7xl overflow-hidden my-8 mx-4">
            {/* Header */}
            <div className={`relative p-6 text-center ${endModalResult === 'won' ? 'bg-gradient-to-r from-green-600/30 to-emerald-600/30' : 'bg-gradient-to-r from-red-600/30 to-rose-600/30'}`}>
              <div className="max-w-5xl mx-auto px-6">
                <div className="text-4xl font-extrabold mb-2">
                  {endModalResult === 'won' ? 'You Won!' : 'Hand Over'}
                </div>
                <div className="text-xl opacity-90 mb-2">
                  {endModalResult === 'won' 
                    ? 'You won the hand!'
                    : 'Hand completed'}
                </div>
                {heroWonAmount !== 0 && (
                  <>
                    <div className={`mt-2 text-2xl font-bold ${endModalResult === 'won' ? 'text-green-300' : 'text-red-300'}`}>
                      {endModalResult === 'won' ? `+$${Math.abs(heroWonAmount).toLocaleString()}` : `-$${Math.abs(heroWonAmount).toLocaleString()}`}
                    </div>
                    {endModalResult !== 'won' && table.lossReason && (
                      <div className="mt-3 px-4 py-2 bg-red-900/30 rounded-lg border border-red-500/30 max-w-md mx-auto">
                        <div className="font-medium text-red-200">Loss Analysis:</div>
                        <div className="text-red-100/90 text-sm">{table.lossReason}</div>
                        {table.suggestion && (
                          <div className="mt-1 text-yellow-100/80 text-xs">
                            <span className="font-medium">Suggestion:</span> {table.suggestion}
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
              
              {/* Close button */}
              <button
                onClick={() => setIsEndModalOpen(false)}
                className="absolute top-4 right-4 p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Content */}
            <div className="p-8 space-y-8 max-h-[75vh] overflow-y-auto">
              {/* Main Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Pot Size */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="text-sm font-medium text-zinc-400 mb-1">Total Pot</div>
                  <div className="text-2xl font-bold">${table.pot?.toLocaleString() || '0'}</div>
                </div>
                
                {/* Your Chips */}
                <div className="bg-zinc-800/50 rounded-xl p-5 border border-white/10 hover:border-white/20 transition-colors">
                  <div className="text-sm font-medium text-zinc-400 mb-1">Your Chips</div>
                  <div className="text-2xl font-bold">${hero?.chips?.toLocaleString() || '0'}</div>
                </div>
                
                {/* Net Result */}
                <div className={`bg-zinc-800/50 rounded-xl p-5 border ${endModalResult === 'won' ? 'border-green-500/30 hover:border-green-500/50' : 'border-red-500/30 hover:border-red-500/50'} transition-colors`}>
                  <div className="text-sm font-medium text-zinc-400 mb-1">Net Result</div>
                  <div className={`text-2xl font-bold ${endModalResult === 'won' ? 'text-green-400' : 'text-red-400'}`}>
                    {endModalResult === 'won' ? '+' : '-'}${Math.abs(heroWonAmount).toLocaleString()}
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 -mt-4">
                {/* Your Cards */}
                <div className="bg-zinc-800/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="text-sm font-medium text-zinc-400 mb-3 px-1">Your Cards</div>
                  <div className="flex justify-center -mx-1.5 space-x-2">
                    {hero?.holeCards?.map((card: { rank: Rank; suit: Suit }, idx: number) => (
                      <div key={idx} className="w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 transform hover:-translate-y-2 transition-transform duration-200">
                        <PokerCard 
                          rank={card.rank} 
                          suit={card.suit} 
                          isFaceDown={false} 
                          className="w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Community Cards */}
                <div className="bg-zinc-800/40 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="text-sm font-medium text-zinc-400 mb-3 px-1">Community Cards</div>
                  <div className="flex justify-center -mx-1.5 space-x-2">
                    {table.communityCards?.map((card: { rank: Rank; suit: Suit }, idx: number) => (
                      <div key={idx} className="w-16 h-24 sm:w-20 sm:h-28 md:w-24 md:h-36 transform hover:-translate-y-2 transition-transform duration-200">
                        <PokerCard 
                          rank={card.rank} 
                          suit={card.suit} 
                          isFaceDown={false} 
                          className="w-full h-full"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Players */}
              <div className="bg-zinc-800/30 rounded-xl p-5 border border-white/5">
                <div className="text-sm font-medium text-zinc-400 mb-3">Players</div>
                <div className="space-y-4">
                  {table.players.map((player: { name: string; chips: number; bet: number; hasFolded: boolean; isHero?: boolean }, idx: number) => {
                    const isWinner = player.isHero && endModalResult === 'won';
                    const isActive = !player.hasFolded;
                    
                    return (
                      <div 
                        key={idx} 
                        className={`flex items-center justify-between p-3 rounded-lg ${isWinner ? 'bg-gradient-to-r from-yellow-500/10 to-amber-500/10 border border-yellow-500/30' : 'bg-zinc-700/30 border border-white/5'} ${!isActive && 'opacity-60'}`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${isWinner ? 'bg-yellow-500 text-yellow-900' : 'bg-zinc-600 text-white'}`}>
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-medium text-white">{player.name} {player.isHero && '(You)'}</div>
                            <div className="text-xs text-zinc-400">{isActive ? 'Active' : 'Folded'}</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono">${player.chips.toLocaleString()}</div>
                          {player.bet > 0 && (
                            <div className="text-xs text-zinc-400">Bet: ${player.bet.toLocaleString()}</div>
                          )}
                          {isWinner && (
                            <div className="text-xs font-medium text-yellow-400 mt-1">
                              Winner!
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {/* Footer */}
            <div className="px-8 py-5 bg-zinc-900/50 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm text-zinc-500">
                Hand #{table.handNumber || '1'}
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  onClick={() => {
                    setIsEndModalOpen(false);
                    handleEndGame();
                  }}
                  className="px-6 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-medium rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex-1 sm:flex-none flex items-center justify-center space-x-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                  Start New Game
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
