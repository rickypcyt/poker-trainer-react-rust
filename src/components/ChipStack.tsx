import { CHIP_COLOR_CLASS, CHIP_DENOMS } from '../constants/chips';

import type { ChipStack as ChipStackType } from '../types/table';
import React from 'react';

interface ChipStackProps {
  stack: ChipStackType;
  showCounts?: boolean;
}

const ChipStack: React.FC<ChipStackProps> = ({ stack, showCounts = true }) => {
  return (
    <div className="flex items-end gap-2">

    </div>
  );
};

export default ChipStack;


