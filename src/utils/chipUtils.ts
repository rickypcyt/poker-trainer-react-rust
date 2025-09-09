import { CHIP_DENOMS } from '../constants/chips';

export interface ChipDistribution {
  denom: number;
  count: number;
  percentage: number;
  totalValue: number;
}

export function calculateChipDistribution(buyIn: number, numPlayers: number): ChipDistribution[] {
  // Chip denominations in descending order
  const denoms = [...CHIP_DENOMS].sort((a, b) => b - a);
  
  // Define the percentage distribution for each chip type
  // These values can be adjusted based on preference
  const distribution = [
    { denom: 1000, percentage: 0.05 },  // 5%
    { denom: 500, percentage: 0.15 },   // 15%
    { denom: 100, percentage: 0.20 },   // 20%
    { denom: 25, percentage: 0.20 },    // 20%
    { denom: 5, percentage: 0.20 },     // 20%
    { denom: 1, percentage: 0.20 }      // 20%
  ].sort((a, b) => b.denom - a.denom); // Sort by denomination descending

  // Calculate the target value for each chip type
  const targetValues = distribution.map(d => ({
    denom: d.denom,
    targetValue: Math.floor(buyIn * d.percentage)
  }));

  // Calculate the number of chips for each denomination
  let remaining = buyIn;
  const result: ChipDistribution[] = [];
  
  for (const { denom, targetValue } of targetValues) {
    if (remaining <= 0) {
      result.push({ denom, count: 0, percentage: 0, totalValue: 0 });
      continue;
    }
    
    // Calculate the maximum possible chips of this denomination
    let count = Math.min(
      Math.floor(targetValue / denom) || 0,
      Math.floor(remaining / denom) || 0
    );
    
    // Ensure we have at least 1 of the smallest denomination if we have remaining value
    if (denom === 1 && remaining > 0 && count === 0) {
      count = 1;
    }
    
    const totalValue = count * denom;
    const percentage = totalValue / buyIn;
    
    result.push({ denom, count, percentage, totalValue });
    remaining -= totalValue;
  }

  // If there's any remaining value, add it to the smallest denomination
  if (remaining > 0) {
    const smallest = result[result.length - 1];
    const additional = Math.floor(remaining / smallest.denom);
    if (additional > 0) {
      smallest.count += additional;
      smallest.totalValue = smallest.count * smallest.denom;
      remaining -= additional * smallest.denom;
    }
  }

  // Sort by denomination descending
  return result.sort((a, b) => b.denom - a.denom);
}

export function createChipStack(buyIn: number): Record<number, number> {
  const distribution = calculateChipDistribution(buyIn, 1);
  const stack: Record<number, number> = {};
  
  for (const { denom, count } of distribution) {
    if (count > 0) {
      stack[denom] = count;
    }
  }
  
  return stack;
}

export function getTotalChips(chipStack: Record<number, number>): number {
  return Object.entries(chipStack).reduce(
    (total, [denom, count]) => total + (Number(denom) * count),
    0
  );
}

export function getTotalChipCount(chipStack: Record<number, number>): number {
  return Object.values(chipStack).reduce(
    (total, count) => total + count,
    0
  );
}
