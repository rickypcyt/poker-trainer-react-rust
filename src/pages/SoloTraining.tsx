import React, { useMemo, useState } from 'react';

import type { DeckCard } from '../types/cards';
import Navbar from '../components/Navbar';
import PokerCard from '../components/PokerCard';
import { SUIT_LABEL_EN } from '../constants/cards';
// Replaced Toast with right-side action log
import { createStandardDeck } from '../lib/deck';
import { shuffleDeck } from '../lib/shuffle';

type Stage = 'deal' | 'preflop' | 'flop' | 'turn' | 'river' | 'showdown' | 'folded' | 'gameover';
type LogKind = 'info' | 'action' | 'deal';
type LogEntry = { message: string; stage: Stage; kind: LogKind; time: string };

const SoloTraining: React.FC = () => {
  const freshDeck = useMemo(() => createStandardDeck(), []);
  const [deck, setDeck] = useState<DeckCard[]>(() => shuffleDeck(freshDeck));
  const [hole, setHole] = useState<DeckCard[]>([]);
  const [flop, setFlop] = useState<DeckCard[]>([]);
  const [stage, setStage] = useState<Stage>('deal');
  const [log, setLog] = useState<LogEntry[]>([]);

  function addLog(kind: LogKind, message: string, stageForLog?: Stage) {
    const when = new Date();
    const time = when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const effectiveStage = stageForLog ?? stage;
    setLog(prev => [...prev, { message, kind, stage: effectiveStage, time }]);
  }

  function stageLabel(s: Stage): string {
    switch (s) {
      case 'deal': return 'Deal';
      case 'preflop': return 'Pre-Flop';
      case 'flop': return 'Flop';
      case 'turn': return 'Turn';
      case 'river': return 'River';
      case 'showdown': return 'Showdown';
      case 'folded': return 'Folded';
      case 'gameover': return 'Game Over';
      default: return s;
    }
  }

  function stageBadgeClass(s: Stage): string {
    switch (s) {
      case 'deal': return 'bg-neutral-700/80 text-neutral-200 border-neutral-600/60';
      case 'preflop': return 'bg-indigo-600/30 text-indigo-200 border-indigo-600/40';
      case 'flop': return 'bg-green-600/30 text-green-200 border-green-600/40';
      case 'turn': return 'bg-yellow-600/30 text-yellow-200 border-yellow-600/40';
      case 'river': return 'bg-rose-600/30 text-rose-200 border-rose-600/40';
      case 'showdown': return 'bg-blue-600/30 text-blue-200 border-blue-600/40';
      case 'folded': return 'bg-red-600/30 text-red-200 border-red-600/40';
      case 'gameover': return 'bg-neutral-800 text-neutral-200 border-neutral-700';
      default: return 'bg-neutral-700/80 text-neutral-200 border-neutral-600/60';
    }
  }

  function resetHand() {
    const newDeck = shuffleDeck(createStandardDeck());
    setDeck(newDeck);
    setHole([]);
    setFlop([]);
    setStage('deal');
    addLog('info', 'New hand started', 'deal');
  }

  function dealHole() {
    if (deck.length < 2) {
      resetHand();
      return;
    }
    const [c1, c2, ...rest] = deck;
    setHole([c1, c2]);
    setDeck(rest);
    setStage('preflop');
    addLog('deal', `Start hand: ${c1.rank} of ${SUIT_LABEL_EN[c1.suit]} and ${c2.rank} of ${SUIT_LABEL_EN[c2.suit]}`, 'preflop');
  }

  function onFold() {
    addLog('action', 'Action: Fold', 'preflop');
    setStage('gameover');
    addLog('info', 'Game ended', 'gameover');
  }

  function onCall() {
    addLog('action', 'Action: Call', 'preflop');
    if (deck.length < 3) {
      resetHand();
      return;
    }
    const [f1, f2, f3, ...rest] = deck;
    setFlop([f1, f2, f3]);
    setDeck(rest);
    setStage('flop');
    addLog('deal', `Flop: ${f1.rank} of ${SUIT_LABEL_EN[f1.suit]}, ${f2.rank} of ${SUIT_LABEL_EN[f2.suit]}, ${f3.rank} of ${SUIT_LABEL_EN[f3.suit]}`, 'flop');
  }

  function onRaise() {
    addLog('action', 'Action: Raise', 'preflop');
  }

  React.useEffect(() => {
    if (stage === 'deal') {
      dealHole();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);

  const isShuffling = false;
  const logContainerRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = logContainerRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
    }
  }, [log]);

  return (
    <div className="min-h-screen bg-green-700">
      <Navbar onShuffle={resetHand} actionLabel="New Hand" />
      <div className="max-w-6xl mx-auto px-4 py-6 md:pr-96">
        <div className="flex flex-col min-h-[calc(100vh-7rem)]">
          <h2 className="text-white text-2xl font-bold mb-4">Solo Training</h2>

          <div className="flex-1 flex flex-col items-center justify-center gap-8">
            <div className="bg-white/10 rounded-lg border border-white/20 p-4 w-full max-w-xl">
              <h3 className="text-white font-semibold mb-3 text-center">Board</h3>
              <div className="flex justify-center gap-3">
                {flop.map((c, idx) => (
                  <PokerCard key={`flop-${idx}`} suit={c.suit} rank={c.rank} isShuffling={isShuffling} />
                ))}
              </div>
            </div>

            <div className="bg-white/10 rounded-lg border border-white/20 p-4 w-full max-w-xl">
              <h3 className="text-white font-semibold mb-3 text-center">Your Hand</h3>
              <div className="flex justify-center gap-3">
                {hole.map((c, idx) => (
                  <PokerCard key={`hole-${idx}`} suit={c.suit} rank={c.rank} isShuffling={isShuffling} />
                ))}
              </div>
            </div>

            <div className="flex items-center justify-center gap-4 pt-2">
              <button className="btn btn-danger btn-lg" onClick={onFold} disabled={stage !== 'preflop'}>Fold</button>
              <button className="btn btn-neutral btn-lg" onClick={onCall} disabled={stage !== 'preflop'}>Call</button>
              <button className="btn btn-success btn-lg" onClick={onRaise} disabled={stage !== 'preflop'}>Raise</button>
            </div>
          </div>
        </div>
      </div>

      <div ref={logContainerRef} className="hidden md:block fixed right-4 top-20 bottom-4 w-80 bg-neutral-950/90 rounded-lg border border-neutral-800 p-0 overflow-auto">
        <div className="sticky top-0 z-10 bg-neutral-950/80 border-b border-neutral-800 px-4 py-3">
          <h3 className="text-white font-semibold">Action Log</h3>
        </div>
        <ul className="px-4 py-3 space-y-2 text-white text-base">
          {log.map((entry, idx) => (
            <li key={`log-${idx}`} className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-md border text-xs sm:text-sm whitespace-nowrap ${stageBadgeClass(entry.stage)}`}>
                [{stageLabel(entry.stage)}]
              </span>
              <div className="flex-1 leading-snug">: {entry.message}
                <span className="ml-2 text-neutral-300 text-xs sm:text-sm">{entry.time}</span>
              </div>
            </li>
          ))}
        </ul>
        <div className="sticky bottom-0 z-10 bg-neutral-950/80 border-t border-neutral-800 px-4 py-3">
          <button className="btn btn-neutral w-full" onClick={() => setLog([])}>Clear Log</button>
        </div>
      </div>
    </div>
  );
};

export default SoloTraining;



