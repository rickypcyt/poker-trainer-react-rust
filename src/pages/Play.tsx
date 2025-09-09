import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';
import type { Difficulty, Player, TableState } from '../types/table';
import {
  createInitialTable,
  getHeroIndex,
  heroCall,
  heroFold,
  heroRaiseTo,
  maxBet,
  performBotActionNow,
  performDealerDraw,
  prepareNewHandWithoutDealing,
  revealDealerDraw,
  startNewHand
} from '../lib/tableEngine';

import ChipStack from '../components/ChipStack';
import Dealer from '../components/Dealer';
import LogsModal from '../components/LogsModal';
import Navbar from '../components/Navbar';
import PlayerSeat from '../components/PlayerSeat';
import PokerCard from '../components/PokerCard';
import React from 'react';
import { createChipStack } from '../utils/chipUtils';
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
  defaultTimeLimitSeconds: 15 as const,
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
    // Read config overrides (numBots, startingChips)
    let cfgNumBots = GAME_CONFIG.numBots;
    let cfgStartingChips = GAME_CONFIG.startingChips;
    let cfgDifficulty: Difficulty = 'Medium';
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.numBots === 'number') cfgNumBots = parsed.numBots;
          if (typeof parsed.startingChips === 'number') cfgStartingChips = parsed.startingChips;
          if (typeof parsed.difficulty === 'string') cfgDifficulty = parsed.difficulty as Difficulty;
        }
      }
    } catch { /* ignore malformed config */ }

    // Create initial chip stack for each player
    const initialChipStack = createChipStack(cfgStartingChips);
    
    if (savedTable) {
      try {
        const parsed = JSON.parse(savedTable);
        return parsed;
      } catch (e) {
        console.warn('Failed to parse saved table, starting new table', e);
      }
    }

    return createInitialTable({
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      numBots: cfgNumBots,
      startingChips: cfgStartingChips,
      initialChipStack,
      difficulty: cfgDifficulty
    });
  });

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
  const timeLimitOptions = [10, 15, 20, 30, 45, 60] as const;
  const [pendingTimeLimit, setPendingTimeLimit] = React.useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const cfg = localStorage.getItem('poker_trainer_config');
        if (cfg) {
          const parsed = JSON.parse(cfg);
          if (typeof parsed.timeLimitSeconds === 'number') return parsed.timeLimitSeconds;
        }
      }
    } catch { /* ignore */ }
    return GAME_CONFIG.defaultTimeLimitSeconds;
  });
  // Active time limit used by the session for bot thinking
  const [timeLimitSeconds, setTimeLimitSeconds] = React.useState<number>(pendingTimeLimit);
  // Bot thinking timer tracking
  const botDeadlineRef = React.useRef<number | null>(null);
  const botTotalDelayRef = React.useRef<number>(0);
  const [botTimeLeftMs, setBotTimeLeftMs] = React.useState<number>(0);

  const startGameFromSetup = () => {
    // Persist chosen config
    try {
      localStorage.setItem('poker_trainer_config', JSON.stringify({ numBots: pendingNumBots, startingChips: pendingBuyIn, timeLimitSeconds: pendingTimeLimit, difficulty: pendingDifficulty }));
      localStorage.removeItem('poker_trainer_table');
    } catch { /* ignore */ }
    // Create a fresh table using chosen values
    const initialChipStackLocal = createChipStack(pendingBuyIn);
    const newTable = createInitialTable({
      smallBlind: GAME_CONFIG.smallBlind,
      bigBlind: GAME_CONFIG.bigBlind,
      numBots: pendingNumBots,
      startingChips: pendingBuyIn,
      initialChipStack: initialChipStackLocal,
      difficulty: pendingDifficulty,
    });
    // Perform dealer draw at start
    const withDraw = performDealerDraw(newTable);
    setReveal(false);
    setTable(withDraw);
    setShowSetup(false);
    setTimeLimitSeconds(pendingTimeLimit);
  };
  const [reveal, setReveal] = React.useState(false);
  const [isDealing] = React.useState(false);

  // Perform dealer draw on mount only for brand new tables (no saved state)
  React.useEffect(() => {
    if (!savedTable) {
      setTable((prev: TableState) => performDealerDraw(prev));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    const player = table.players.find((p: Player) => (p.isHero ? 'You' : p.name) === name);
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

  // Bot thinking: when a bot is pending, wait then perform action
  React.useEffect(() => {
    if (table.botPendingIndex == null) return;
    // Respect time limit for bot thinking; randomize between 60%-100% of the limit, capped at the limit
    const diff: Difficulty = (table.difficulty as Difficulty) ?? 'Medium';
    const baseLimitMs = Math.max(700, Math.floor(timeLimitSeconds * 1000));
    // Difficulty shifts the typical thinking time, but must never exceed baseLimitMs
    const typicalMult = diff === 'Easy' ? 0.7 : diff === 'Hard' ? 0.95 : 0.85;
    const windowStart = Math.max(0.6, typicalMult - 0.15);
    const windowEnd = Math.min(1.0, typicalMult + 0.15);
    const randFactor = windowStart + Math.random() * Math.max(0.05, (windowEnd - windowStart));
    const delay = Math.min(baseLimitMs, Math.floor(baseLimitMs * randFactor));
    // Track deadline for UI countdown
    botDeadlineRef.current = Date.now() + delay;
    botTotalDelayRef.current = delay;
    setBotTimeLeftMs(delay);
    const t = setTimeout(() => {
      setTable((prev: TableState) => performBotActionNow(prev));
    }, delay);
    return () => clearTimeout(t);
  }, [table.botPendingIndex, timeLimitSeconds, table.difficulty]);

  // Countdown updater for bot thinking overlay
  React.useEffect(() => {
    if (table.botPendingIndex == null || !botDeadlineRef.current) {
      setBotTimeLeftMs(0);
      return;
    }
    const i = setInterval(() => {
      if (!botDeadlineRef.current) return;
      const left = Math.max(0, botDeadlineRef.current - Date.now());
      setBotTimeLeftMs(left);
    }, 100);
    return () => clearInterval(i);
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

  // After revealing highest card, briefly show the cards and toast, then auto-start the hand
  React.useEffect(() => {
    if (table.dealerDrawInProgress && table.dealerDrawRevealed) {
      const t = setTimeout(() => {
        handleNewHand();
      }, 1200); // small pause to let users see the reveal and toast
      return () => clearTimeout(t);
    }
  }, [table.dealerDrawInProgress, table.dealerDrawRevealed]);

  const handleNewHand = () => {
    setReveal(false);
    setTable((prev: TableState) => {
      const newTable = prepareNewHandWithoutDealing(prev);
      
      // Log the start of a new hand with blind information
      const newLog = [
        { message: 'New hand started', time: new Date().toLocaleTimeString() },
        { message: `Blinds: $${GAME_CONFIG.smallBlind}/$${GAME_CONFIG.bigBlind}`, time: new Date().toLocaleTimeString() }
      ];
      
      const updatedTable = {
        ...newTable,
        actionLog: [...newTable.actionLog, ...newLog]
      };

      // Start the hand with the new table state
      const handStarted = startNewHand(updatedTable);
      
      // Process the first action if it's a bot's turn
      const heroIdx = getHeroIndex(handStarted);
      if (handStarted.currentPlayerIndex !== heroIdx) {
        // This will process bot actions until it's the hero's turn
        return handStarted;
      }
      
      return handStarted;
    });
  };

  const handleEndGame = () => {
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
    try {
      localStorage.removeItem('poker_trainer_table');
    } catch { /* ignore */ }
    navigate('/');
  };

  const handlePlayerAction = (action: 'Fold' | 'Call' | 'Raise') => {
    setTable((prev: TableState) => {
      // Do nothing if it's not the hero's turn
      const heroIdxGuard = getHeroIndex(prev);
      if (prev.currentPlayerIndex !== heroIdxGuard || prev.stage === 'Showdown') {
        return prev;
      }
      // Handle the player's action based on the button clicked
      if (action === 'Fold') {
        const newState = heroFold(prev);
        if (newState.stage === 'Showdown') {
          setReveal(true);
        }
        return newState;
      }
      
      if (action === 'Call') {
        const newState = heroCall(prev);
        if (newState.stage === 'Showdown') {
          setReveal(true);
        }
        return newState;
      }
      
      if (action === 'Raise') {
        // For simplicity, raise to 3x the big blind or pot size, whichever is smaller
        const hero = prev.players[getHeroIndex(prev)];
        const raiseTo = Math.min(
          prev.pot + prev.bigBlind * 3,
          hero.chips + hero.bet
        );
        const newState = heroRaiseTo(prev, raiseTo);
        if (newState.stage === 'Showdown') {
          setReveal(true);
        }
        return newState;
      }
      
      return prev;
    });
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
        subtitle="Play with Bots" 
        onShuffle={handleNewHand} 
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
                onClick={() => { setIsEndModalOpen(false); handleNewHand(); }}
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
              {/* Time limit selector */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-white/80 text-base">Time Limit (AI)</label>
                  <span className="text-white font-semibold">{pendingTimeLimit}s</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {timeLimitOptions.map((sec) => (
                    <button
                      key={sec}
                      onClick={() => setPendingTimeLimit(sec)}
                      className={`px-3 py-1.5 rounded-lg border text-base transition-colors ${pendingTimeLimit === sec ? 'bg-yellow-500/20 border-yellow-400 text-yellow-100' : 'bg-white/10 border-white/20 text-white/80 hover:bg-white/20'}`}
                    >
                      {sec}s
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
            <div className="flex justify-center">
              <div className="text-green-300 font-semibold px-4 py-2 rounded-md bg-green-600/20 border border-green-400/40">
                Starting hand...
              </div>
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
        {players.filter(p => p.isHero).map(p => (
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
              />
            </div>
          );
        })}

        
        
      </div>
      {/* Bot time limit overlay */}
      {table.botPendingIndex != null && botTotalDelayRef.current > 0 && (
        <div className="pointer-events-none fixed z-[70] top-3 right-3 bg-black/70 text-white px-3 py-2 rounded-lg shadow border border-white/20">
          {(() => {
            const idx = table.botPendingIndex as number;
            const actor = table.players[idx];
            const secs = Math.max(0, botTimeLeftMs) / 1000;
            const pct = Math.max(0, Math.min(1, botTotalDelayRef.current ? (1 - botTimeLeftMs / botTotalDelayRef.current) : 0));
            return (
              <div className="min-w-[180px]">
                <div className="text-base font-semibold mb-1 flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  Thinking: {actor?.isHero ? 'You' : actor?.name}
                </div>
                <div className="text-xs opacity-80 mb-1">Time left: {secs.toFixed(1)}s</div>
                <div className="h-2 w-full bg-white/15 rounded">
                  <div className="h-full bg-yellow-400 rounded" style={{ width: `${pct * 100}%` }} />
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Flying chips overlay (fixed to viewport for smooth animation) */}
      {flyingChips.map((c) => (
        <div
          key={c.id}
          className={`pointer-events-none fixed z-[60] w-5 h-5 rounded-full border-2 border-white/70 shadow ${c.colorClass}`}
          style={{ left: c.left, top: c.top, transition: 'transform 0.75s ease-out', transform: `translate(${c.toLeft - c.left}px, ${c.toTop - c.top}px)` }}
        />)
      )}
    </div>
  );
};

export default Play;
