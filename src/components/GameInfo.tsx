import React, { useEffect, useRef, useState } from 'react';

import type { TableState } from '../types/table';

interface GameInfoProps {
  table: TableState;
  isHeroTurn: boolean;
  currentActorName: string;
  highestBet: number;
  toCallVal: number;
  minRaiseToVal: number;
  showSetup?: boolean;
  isEndModalOpen?: boolean;
}

export const GameInfo: React.FC<GameInfoProps> = ({
  table,
  isHeroTurn,
  currentActorName,
  highestBet,
  toCallVal,
  minRaiseToVal,
  showSetup = false,
  isEndModalOpen = false,
}) => {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragRef = useRef<HTMLDivElement>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });

  // Load saved position from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('gameInfo_position');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition(pos);
      } catch {
        console.warn('Failed to parse saved position');
      }
    }
  }, []);

  // Save position to localStorage
  useEffect(() => {
    localStorage.setItem('gameInfo_position', JSON.stringify(position));
  }, [position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent default drag behavior
    setIsDragging(true);
    const rect = dragRef.current?.getBoundingClientRect();
    if (rect) {
      dragStartPos.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      
      const newX = e.clientX - dragStartPos.current.x;
      const newY = e.clientY - dragStartPos.current.y;
      
      // Keep within viewport bounds
      const maxX = window.innerWidth - 280; // approximate width
      const maxY = window.innerHeight - 200; // approximate height
      const boundedX = Math.max(0, Math.min(newX, maxX));
      const boundedY = Math.max(0, Math.min(newY, maxY));
      
      setPosition({ x: boundedX, y: boundedY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      // Use passive: false for better performance
      document.addEventListener('mousemove', handleMouseMove, { passive: false });
      document.addEventListener('mouseup', handleMouseUp, { passive: false });
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging]);
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

  return (
    <div 
      ref={dragRef}
      className={`fixed bg-black/40 border border-white/10 rounded-lg p-3 text-[11px] text-white/80 w-[min(280px,35vw)] z-[70] ${showSetup ? 'opacity-50 blur-sm' : ''} ${isDragging ? 'cursor-grabbing select-none' : 'cursor-grab hover:bg-black/50'}`}
      style={{ 
        position: 'fixed',
        left: position.x === 0 ? 'auto' : `${position.x}px`,
        top: position.y === 0 ? 'auto' : `${position.y}px`,
        right: position.x === 0 ? '8px' : 'auto',
        bottom: position.y === 0 ? '8px' : 'auto',
        transform: 'none',
        transition: isDragging ? 'none' : 'all 0.3s ease',
        willChange: isDragging ? 'transform' : 'auto'
      }}
      onMouseDown={handleMouseDown}
    >
      <div className="text-white/90 text-sm mb-2 text-center">
        {isEndModalOpen && table.stage === 'Showdown' ? (
          <div>
            <span className="text-green-300 font-semibold">Round Finished</span>
          </div>
        ) : isHeroTurn ? (
          <div>
            <span className="text-emerald-300 font-semibold">Your turn</span>
          </div>
        ) : (
          <div>
            Waiting for <span className="text-yellow-300 font-semibold">{currentActorName}</span>...
          </div>
        )}
      </div>
      {!(isEndModalOpen && table.stage === 'Showdown') && (
        <div className="grid grid-cols-2 gap-2 text-[12px] text-white/80">
          <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Stage: <span className="text-yellow-300 font-semibold">{table.stage}</span></div>
          <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Pot: <span className="text-yellow-300 font-semibold">${(table.pot||0).toLocaleString()}</span></div>
          <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Current bet: <span className="font-semibold">${highestBet}</span></div>
          <div className="bg-black/40 rounded px-2 py-1 border border-white/10">To call: <span className="font-semibold">${toCallVal}</span></div>
          <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Min raise to: <span className="font-semibold">${minRaiseToVal}</span></div>
          <div className="bg-black/40 rounded px-2 py-1 border border-white/10">Blinds: <span className="font-semibold">${table.smallBlind}/{table.bigBlind}</span></div>
        </div>
      )}
      {lastActionBanner && (
        <div className={`mt-2 text-center text-sm font-semibold px-3 py-1 rounded-md border ${lastActionBanner.isHero ? 'bg-emerald-600/20 border-emerald-400/40 text-emerald-200' : 'bg-white/10 border-white/20 text-white/90'}`}>
          Last action: {lastActionBanner.text}
        </div>
      )}
    </div>
  );
};
