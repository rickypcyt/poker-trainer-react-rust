import type { FlyingChip } from '../hooks/useUIState';
import React from 'react';

interface FlyingChipsProps {
  flyingChips: FlyingChip[];
}

export const FlyingChips: React.FC<FlyingChipsProps> = ({ flyingChips }) => {
  return (
    <>
      {flyingChips.map((c) => (
        <div
          key={c.id}
          className={`pointer-events-none fixed z-[60] w-5 h-5 rounded-full border-2 border-white/70 shadow ${c.colorClass}`}
          style={{ left: c.left, top: c.top, transition: 'transform 0.75s ease-out', transform: `translate(${c.toLeft - c.left}px, ${c.toTop - c.top}px)` }}
        />
      ))}
    </>
  );
};
