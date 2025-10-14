import React from 'react';
import ChipStack from './ChipStack';
import type { ChipStack as ChipStackType } from '../types/table';

interface DealerProps {
  isDealing: boolean;
  stack?: ChipStackType; // optional: show breakdown (e.g., pot)
}

const Dealer: React.FC<DealerProps> = ({ isDealing, stack }) => {
  return (
    <div className="flex flex-col items-center">
      <div className={`text-5xl ${isDealing ? 'animate-pulse' : ''}`}>🤵</div>
      <div className="text-white/90 text-base font-medium mt-3 bg-black/50 px-3 py-1 rounded-full">Dealer</div>
      {stack && (
        <div className="mt-2">
          <ChipStack stack={stack} showCounts />
        </div>
      )}
    </div>
  );
};

export default Dealer;




