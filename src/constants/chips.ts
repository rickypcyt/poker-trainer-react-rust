export const CHIP_DENOMS = [1, 5, 25, 100, 500, 1000] as const;
export type ChipDenom = typeof CHIP_DENOMS[number];

// Tailwind color classes per denomination
export const CHIP_COLOR_CLASS: Record<number, string> = {
  1: 'bg-white text-black border border-neutral-300',
  5: 'bg-red-600 text-white border border-red-700',
  25: 'bg-green-600 text-white border border-green-700',
  100: 'bg-black text-white border border-white/30',
  500: 'bg-purple-700 text-white border border-purple-800',
  1000: 'bg-yellow-400 text-black border border-yellow-500',
};

export const CHIP_LABELS: Record<number, string> = {
  1: 'White',
  5: 'Red',
  25: 'Green',
  100: 'Black',
  500: 'Purple',
  1000: 'Yellow',
};



