import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';
import { CHIP_LABELS, CHIP_LABELS_ES } from '../constants/chips';

import type { ChipStack as ChipStackType } from '../types/table';
import React from 'react';

interface ChipStackProps {
  stack: ChipStackType;
  showCounts?: boolean;
  showLabels?: boolean;
  labelLocale?: 'en' | 'es';
  lowercaseLabels?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  countFormat?: 'suffixTimes' | 'prefixX';
  columns?: 1 | 2 | 3;
}

const ChipStack: React.FC<ChipStackProps> = ({ 
  stack, 
  showCounts = true,
  showLabels = false,
  labelLocale = 'en',
  lowercaseLabels = false,
  size = 'sm',
  countFormat = 'suffixTimes',
  columns = 1,
}) => {
  // Render compact row: color dot + quantity per denomination (no stacked visuals)
  const denoms = [...CHIP_DENOMS].sort((a, b) => Number(b) - Number(a));
  const labels = labelLocale === 'es' ? CHIP_LABELS_ES : CHIP_LABELS;
  const sizeClasses = {
    xs: {
      containerGap: 'gap-0.5',
      pill: 'px-1.5 py-0.5',
      dot: 'w-2.5 h-2.5',
      text: 'text-[10px]'
    },
    sm: {
      containerGap: 'gap-1',
      pill: 'px-2 py-0.5',
      dot: 'w-3 h-3',
      text: 'text-[11px]'
    },
    md: {
      containerGap: 'gap-1.5',
      pill: 'px-2.5 py-0.5',
      dot: 'w-4 h-4',
      text: 'text-[12px]'
    },
    lg: {
      containerGap: 'gap-2',
      pill: 'px-3 py-1',
      dot: 'w-5 h-5',
      text: 'text-[13px]'
    }
  } as const;
  const s = sizeClasses[size];
  const containerClass = columns === 3
    ? `grid grid-cols-3 items-center justify-center ${s.containerGap} gap-x-2`
    : columns === 2
    ? `grid grid-cols-3 grid-rows-2 items-center justify-center ${s.containerGap} gap-1`
    : `flex flex-row items-center justify-center flex-nowrap ${s.containerGap}`;
  return (
    <div className={containerClass}>
      {denoms.map((d) => {
        const count = stack[d] ?? 0;
        if (count <= 0) return null;
        const labelText = labels[d] ? (lowercaseLabels ? labels[d].toLowerCase() : labels[d]) : '';
        return (
          <div
            key={d}
            className={`flex items-center justify-center bg-black/30 border border-white/20 rounded-lg px-2 py-1`}
          >
            <span className={`${s.dot} rounded-full border border-white/50 ${CHIP_COLOR_CLASS[d]} mr-1 flex-shrink-0`} />
            <div className="flex flex-col items-center justify-center flex-1">
              {showCounts && !showLabels && (
                <span className={`text-white/80 ${s.text} font-mono text-center`}>
                  {countFormat === 'prefixX' ? `x${count}` : `${count}×`}
                </span>
              )}
              {showLabels && (
                <div className="flex flex-col items-center">
                  <span className={`text-white/90 ${s.text} font-mono text-center`}>
                    {labelText}
                  </span>
                  <span className={`text-white/70 ${s.text} font-mono text-center`}>
                    {countFormat === 'prefixX' ? `x${count}` : `${count}×`}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
;

export default ChipStack;


