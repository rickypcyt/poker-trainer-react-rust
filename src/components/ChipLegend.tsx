import { CHIP_COLOR_CLASS, CHIP_DENOMS, CHIP_LABELS } from '../constants/chips';

import React from 'react';

const ChipLegend: React.FC = () => {
  const denomsAsc = [...CHIP_DENOMS].reverse(); // 1 -> 1000
  return (
    <div className="bg-white/10 border border-white/20 rounded-xl p-3 text-white text-sm">
      <div className="font-semibold mb-2">Chip Legend</div>
      <div className="flex flex-col gap-2">
        {denomsAsc.map((d) => (
          <div key={d} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className={`w-4 h-4 rounded-full ${CHIP_COLOR_CLASS[d]}`} />
              <span>{CHIP_LABELS[d]}</span>
            </div>
            <span className="opacity-80">{d}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ChipLegend;


