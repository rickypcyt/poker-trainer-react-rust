import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';
import type { Difficulty, Player, TableState } from '../types/table';
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
  const [isLogsOpen, setIsLogsOpen] = React.useState(false);
  // End-of-hand modal
  const [isEndModalOpen, setIsEndModalOpen] = React.useState(false);
  const [endModalResult, setEndModalResult] = React.useState<'won' | 'lost' | null>(null);
  const lastModalHandRef = React.useRef<number>(-1);
  const [seatActions, setSeatActions] = React.useState<Record<string, string>>({});
  const chipAnchorsRef = React.useRef<Record<string, HTMLDivElement | null>>({});
  const potRef = React.useRef<HTMLDivElement | null>(null);
  const dealerRef = React.useRef<HTMLDivElement | null>(null);
  const [flyingChips, setFlyingChips] = React.useState<Array<{ id: string; colorClass: string; left: number; top: number; toLeft: number; toTop: number }>>([]);
  const prevPotRef = React.useRef<number>(0);
  // Try to hydrate from localStorage
  const savedTable = typeof window !== 'undefined' ? localStorage.getItem('poker_trainer_table') : null;
  const [showSetup, setShowSetup] = React.useState<boolean>(() => !savedTable);

  const [table, setTable] = React.useState(() => {
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
    return t;
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

  // Pending setup values (used only when showSetup is true)
  const [pendingNumBots, setPendingNumBots] = React.useState<number>(() => {
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
  });
  const presetBuyins = [1000, 5000, 10000] as const;
  // Difficulty in setup
  const [pendingDifficulty, setPendingDifficulty] = React.useState<Difficulty>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.difficulty === 'string') return parsed.difficulty as Difficulty;
        }
      }
    } catch { /* ignore */ }
    return 'Medium';
  });
  const [pendingBuyIn, setPendingBuyIn] = React.useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.startingChips === 'number') return parsed.startingChips;
        }
      }
    } catch { /* ignore */ }
    return GAME_CONFIG.startingChips;
  });

  const startGameFromSetup = () => {
    // Persist chosen config
    try {
      localStorage.setItem('poker_trainer_config', JSON.stringify({ numBots: pendingNumBots, startingChips: pendingBuyIn, difficulty: pendingDifficulty }));
      localStorage.removeItem('poker_trainer_table');
    } catch { /* ignore */ }
    // Create a fresh local table using engine
    const t = createInitialTable({
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      numBots: pendingNumBots,
      startingChips: pendingBuyIn,
      initialChipStack: { 1: 5, 5: 5, 25: 5, 100: 5, 500: 5, 1000: 5 }, // Default chip distribution
      difficulty: pendingDifficulty,
    });
    setReveal(false);
    setTable(t);
    setShowSetup(false);
  };
  const [reveal, setReveal] = React.useState(false);
  const [isDealing] = React.useState(false);

  // Using local engine: no server initialization effect needed

  // Persist table to localStorage on change
  React.useEffect(() => {
    try {
      localStorage.setItem('poker_trainer_table', JSON.stringify(table));
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
    for (let i = table.actionLog.length - 1; i >= 0; i -= 1) {
      const msg = table.actionLog[i].message || '';
      const m = msg.match(/^(.*?)\s+wins the pot/i);
      if (m) {
        const name = m[1];
        heroWon = (name === 'You');
        break;
      }
    }
    setEndModalResult(heroWon ? 'won' : 'lost');
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
  }, [table.stage, table.handNumber, table.actionLog]);

  // Show toast for EVERY new log entry; use toastShown flag to avoid duplicates
  React.useEffect(() => {
    if (table.actionLog.length === 0) return;
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
    if (table.actionLog.length === 0) return;
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
    if (table.actionLog.length === 0) return;
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
    setTable(async (prev: TableState) => {
      // Use local engine decision
      const next = await performBotActionNow(prev);
      if (next.stage === 'Showdown') setReveal(true);
      return next;
    });
  }, [table.botPendingIndex]);


  // Animate chips to pot when pot increases
  React.useEffect(() => {
    const prevPot = prevPotRef.current;
    if (table.pot > prevPot) {
      const last = table.actionLog[table.actionLog.length - 1];
      // Identify the actor: raised or called
      let actorName: string | null = null;
      if (last) {
        const m = last.message.match(/^(.*?)\s+(raised to|called)/i);
        if (m) actorName = m[1];
      }
      const actor = table.players.find((p: Player) => (p.isHero ? 'You' : p.name) === actorName) || null;
      const sourceEl = actor ? chipAnchorsRef.current[actor.id] : null;
      // Animate towards the Dealer (requested):
      const targetEl = dealerRef.current;
      if (sourceEl && targetEl) {
        const s = sourceEl.getBoundingClientRect();
        const t = targetEl.getBoundingClientRect();
        // Choose a color based on a denom close to delta
        const delta = table.pot - prevPot;
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
    prevPotRef.current = table.pot;
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
          const winner = table.players[winnerIdx];
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

    // Go back to main menu
    navigate('/');
  };

  const handlePlayerAction = (action: 'Fold' | 'Call' | 'Raise') => {
    const hero = table.players.find((p: Player) => p.isHero);
    if (!hero) return;
    // If not hero's turn or already showdown, ignore
    if (table.stage === 'Showdown' || table.players.indexOf(hero) !== table.currentPlayerIndex) return;

    try {
      let next: TableState = table;
      if (action === 'Fold') {
        next = heroFold(table);
      } else if (action === 'Call') {
        next = heroCall(table);
      } else if (action === 'Raise') {
        // Simple: raise to 3x big blind or all-in cap
        const raiseTo = Math.min(table.pot + table.bigBlind * 3, hero.chips + hero.bet);
        next = heroRaiseTo(table, raiseTo);
      }
      setTable(next);
      if (next.stage === 'Showdown') setReveal(true);
    } catch (e) {
      console.error('Failed to process player action locally', e);
    }
  };

  const { players, dealerIndex, smallBlindIndex, bigBlindIndex } = table;
  const bots = players.filter((p: Player) => !p.isHero);
  // Compute bot positions on a ring (percentage-based) avoiding:
  // - bottom-center overlap with the hero
  // - top-center overlap with the dealer
  const botRing = React.useMemo(() => {
    const n = bots.length;
    if (n === 0) return [] as Array<{ left: number; top: number; position: 'left' | 'right' | 'top' | 'bottom' }>;
    const results: Array<{ left: number; top: number; position: 'left' | 'right' | 'top' | 'bottom' }> = [];
    // Define two gaps: top (dealer) and bottom (hero)
    const gapTopDeg = 40;    // centered at 90° (top)
    const gapBottomDeg = 60; // centered at 270° (bottom)
    const startA = 90 + gapTopDeg / 2;          // from just right of top gap
    const endA = 270 - gapBottomDeg / 2;        // to just left of bottom gap
    const startB = 270 + gapBottomDeg / 2;      // from just right of bottom gap
    const endB = 450 - gapTopDeg / 2;           // to just left of top gap (wraps past 360 to 450)
    const lenA = endA - startA;                 // left arc length
    const lenB = endB - startB;                 // right arc length (same as lenA)
    const totalLen = lenA + lenB;
    const radius = 38; // percent of container (fits within padding)
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n; // midpoints for even spacing
      let thetaDeg = startA + t * totalLen;
      if (thetaDeg > endA) {
        // jump into second arc
        const excess = thetaDeg - endA;
        thetaDeg = startB + excess;
      }
      const theta = (thetaDeg * Math.PI) / 180;
      const cx = 50 + radius * Math.cos(theta);
      const cy = 50 + radius * Math.sin(theta);
      // Infer seat position for subtle UI tweaks
      let pos: 'left' | 'right' | 'top' | 'bottom' = 'left';
      if (cy <= 35) pos = 'top';
      else if (cy >= 65) pos = 'bottom';
      else pos = cx < 50 ? 'left' : 'right';
      results.push({ left: cx, top: cy, position: pos });
    }
    return results;
  }, [bots.length]);

  // Note: animateDeal function was removed as it was not being used
  // and the card dealing animation is handled by the table engine

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      <Navbar 
        onShuffle={() => { setReveal(false); setTable((prev: TableState) => startNewHand(prev)); }} 
        actionLabel="New Hand" 
        onOpenLogs={() => setIsLogsOpen(true)}
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
                <input
                  id="bots"
                  type="range"
                  min={1}
                  max={10}
                  step={1}
                  value={pendingNumBots}
                  onChange={(e) => setPendingNumBots(parseInt(e.target.value))}
                  className="w-full accent-yellow-400"
                />
                <div className="flex justify-between text-white/50 text-base mt-1">
                  {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (<span key={n}>{n}</span>))}
                </div>
              </div>

              <div>
                <div className="text-white/80 text-base mb-2">Buy-in</div>
                <div className="flex gap-2 justify-center">
                  {presetBuyins.map(v => (
                    <button
                      key={v}
                      onClick={() => setPendingBuyIn(v)}
                      className={`px-3 py-1.5 rounded-lg border transition-colors ${pendingBuyIn === v ? 'bg-yellow-500/20 border-yellow-400 text-yellow-100' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'}`}
                    >
                      {v >= 1000 ? `${(v/1000).toFixed(v%1000?1:0)}K` : `$${v}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Difficulty selector */}
              <div>
                <div className="text-white/80 text-base mb-2">Difficulty</div>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'Easy', label: '🟢 Easy' },
                    { key: 'Medium', label: '🟡 Medium' },
                    { key: 'Hard', label: '🔴 Hard' },
                  ] as Array<{ key: Difficulty; label: string }>).map(opt => (
                    <button
                      key={opt.key}
                      onClick={() => setPendingDifficulty(opt.key)}
                      className={`px-3 py-2 rounded-lg border text-base transition-colors ${pendingDifficulty === opt.key ? 'bg-yellow-500/20 border-yellow-400 text-yellow-100' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'}`}
                    >
                      <div className="leading-tight font-semibold">{opt.label}</div>
                    </button>
                  ))}
                </div>
              </div>
              {/* Start at bottom */}
              <div className="pt-3">
                <button
                  onClick={startGameFromSetup}
                  className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-400/50 text-yellow-100 px-4 py-2 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02]"
                >
                  Start Game
                </button>
              </div>
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

        {/* Buttons card right */}
        <div className="absolute right-2 bottom-2 bg-gray-900/90 backdrop-blur-md rounded-xl p-3 border border-gray-600/50 shadow-xl">
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
            <div className="flex flex-row flex-wrap gap-2 items-stretch">
              <button 
                className={`font-semibold px-4 py-2 rounded-md flex-1 min-w-[120px] transition-colors shadow-md ${
                  table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-red-700 hover:bg-red-600 text-white'
                }`}
                onClick={() => handlePlayerAction('Fold')}
                disabled={table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
              >
                Fold
              </button>
              <button 
                className={`font-semibold px-4 py-2 rounded-md flex-1 min-w-[140px] transition-colors shadow-md ${
                  table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-700 hover:bg-blue-600 text-white'
                }`}
                onClick={() => handlePlayerAction('Call')}
                disabled={table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
              >
                {(() => {
                  const hero = table.players[getHeroIndex(table)];
                  const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                  if (toCall === 0) return 'Check';
                  if (toCall >= (hero?.chips || 0)) return `All-in $${hero?.chips}`;
                  return `Call $${toCall}`;
                })()}
              </button>
              <button 
                className={`font-semibold px-6 py-2 rounded-md flex-1 min-w-[160px] transition-colors shadow-md ${
                  table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed'
                    : 'bg-yellow-600 hover:bg-yellow-500 text-white'
                }`}
                onClick={() => handlePlayerAction('Raise')}
                disabled={table.players[getHeroIndex(table)]?.hasFolded || table.stage === 'Showdown' || table.currentPlayerIndex !== getHeroIndex(table)}
              >
                {(() => {
                  const hero = table.players[getHeroIndex(table)];
                  const toCall = Math.max(0, maxBet(table) - (hero?.bet || 0));
                  const minRaise = Math.max(table.bigBlind, maxBet(table) * 2 - (hero?.bet || 0));
                  if ((hero?.chips || 0) <= toCall) return 'All-in';
                  if (toCall > 0) return `Raise to $${minRaise}`;
                  return `Raise $${minRaise}`;
                })()}
              </button>
            </div>
          )}
          
          <div className="text-white/90 text-center text-base mt-3 font-medium">
            <div className="bg-gray-800/80 py-1 px-2 rounded">
              <span className="text-yellow-400 ml-1">{table.stage}</span>
            </div>
          </div>
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
                <span className="text-amber-100 font-mono">POT:</span> <span className="text-xl md:text-3xl text-yellow-300 font-mono">${table.pot.toLocaleString()}</span>
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
                        i < table.board.length
                          ? 'bg-white shadow-lg hover:scale-[1.02] hover:z-10 transition-transform duration-200'
                          : 'bg-white/5 border-2 border-dashed border-white/20'
                      } flex items-center justify-center w-[clamp(56px,8vw,120px)]`}
                    >
                      {i < table.board.length ? (
                        <PokerCard
                          suit={table.board[i].suit}
                          rank={table.board[i].rank}
                          className="w-full h-full"
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
        {players.filter((p: Player) => p.isHero).map((p: Player) => (
          <div key={p.id} className="absolute left-1/2 bottom-2 -translate-x-1/2">
            <PlayerSeat
              player={p}
              isDealer={players.indexOf(p) === dealerIndex}
              isSmallBlind={players.indexOf(p) === smallBlindIndex}
              isBigBlind={players.indexOf(p) === bigBlindIndex}
              reveal={table.dealerDrawInProgress ? table.dealerDrawRevealed : reveal}
              drawCard={table.dealerDrawCards[p.id]}
              showDrawCard={table.dealerDrawInProgress}
              isActive={players.indexOf(p) === table.currentPlayerIndex}
              position="bottom"
              gameStage={table.stage}
              isThinking={table.botPendingIndex === players.indexOf(p)}
              actionText={seatActions[p.id]}
              chipAnchorRef={(el) => { chipAnchorsRef.current[p.id] = el; }}
              isHighlighted={table.dealerDrawInProgress && table.dealerDrawRevealed && (players.indexOf(p) === (table.dealingState?.highCardPlayerIndex ?? table.dealerIndex))}
            />
          </div>
        ))}

        {/* Other players placed around a ring */}
        {bots.map((p: Player, i: number) => {
          const idx = players.indexOf(p);
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
                isActive={idx === table.currentPlayerIndex}
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

      {/* End-of-hand modal */}
      {isEndModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70">
          <div className="bg-zinc-900 text-white rounded-xl shadow-2xl border border-white/10 w-[90%] max-w-md p-6 text-center">
            <div className="text-2xl font-extrabold mb-2">
              {endModalResult === 'won' ? 'You won this hand' : endModalResult === 'lost' ? 'You lost this hand' : 'Hand finished'}
            </div>
            <div className="text-sm opacity-80 mb-6">Press Continue to deal the next hand.</div>
            <button
              className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-semibold shadow"
              onClick={() => {
                setIsEndModalOpen(false);
                setReveal(false);
                setTable((prev: TableState) => startNewHand(prev));
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Play;
