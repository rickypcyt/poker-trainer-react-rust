import type { HandEvaluation, HandRank } from './pokerService';

import type { Card } from './pokerService';

const rankOrder: Record<string, number> = {
  '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9,
  '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14,
};

const suitOrder: Record<string, number> = { spades: 4, hearts: 3, diamonds: 2, clubs: 1 };

function compareCards(a: Card, b: Card): number {
  const rankDiff = rankOrder[b.rank] - rankOrder[a.rank];
  if (rankDiff !== 0) return rankDiff;
  return suitOrder[b.suit] - suitOrder[a.suit];
}

function isFlush(cards: Card[]): boolean {
  const suitCounts: Record<string, number> = {};
  for (const card of cards) {
    suitCounts[card.suit] = (suitCounts[card.suit] || 0) + 1;
  }
  return Object.values(suitCounts).some(count => count >= 5);
}

function isStraight(cards: Card[]): boolean {
  const ranks = [...new Set(cards.map(c => rankOrder[c.rank]))].sort((a, b) => b - a);
  
  // Check for regular straight
  for (let i = 0; i <= ranks.length - 5; i++) {
    if (ranks[i] - ranks[i + 4] === 4) return true;
  }
  
  // Check for A-2-3-4-5 straight (wheel)
  const hasAce = ranks.includes(14);
  const has2to5 = [2, 3, 4, 5].every(rank => ranks.includes(rank));
  return hasAce && has2to5;
}

function getRankCounts(cards: Card[]): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const card of cards) {
    const rank = rankOrder[card.rank];
    counts[rank] = (counts[rank] || 0) + 1;
  }
  return counts;
}

function findBestHand(cards: Card[]): { cards: Card[], rank: HandRank, name: string } {
  const allCombinations: Card[][] = [];
  
  // Generate all 5-card combinations
  for (let i = 0; i < cards.length - 4; i++) {
    for (let j = i + 1; j < cards.length - 3; j++) {
      for (let k = j + 1; k < cards.length - 2; k++) {
        for (let l = k + 1; l < cards.length - 1; l++) {
          for (let m = l + 1; m < cards.length; m++) {
            allCombinations.push([cards[i], cards[j], cards[k], cards[l], cards[m]]);
          }
        }
      }
    }
  }
  
  let bestHand = allCombinations[0];
  let bestRank: HandRank = 'HighCard';
  let bestName = 'High Card';
  
  for (const combo of allCombinations) {
    const { rank, name } = evaluateFiveCards(combo);
    if (compareHandRanks(rank, bestRank) > 0) {
      bestHand = combo;
      bestRank = rank;
      bestName = name;
    }
  }
  
  return { cards: bestHand, rank: bestRank, name: bestName };
}

function evaluateFiveCards(cards: Card[]): { rank: HandRank, name: string } {
  const sortedCards = [...cards].sort(compareCards);
  const rankCounts = getRankCounts(cards);
  const counts = Object.values(rankCounts).sort((a, b) => b - a);
  const isFlushHand = isFlush(cards);
  const isStraightHand = isStraight(cards);
  
  // Royal Flush
  if (isFlushHand && isStraightHand && rankOrder[sortedCards[0].rank] === 14) {
    return { rank: 'RoyalFlush', name: 'Royal Flush' };
  }
  
  // Straight Flush
  if (isFlushHand && isStraightHand) {
    return { rank: 'StraightFlush', name: 'Straight Flush' };
  }
  
  // Four of a Kind
  if (counts[0] === 4) {
    return { rank: 'FourOfAKind', name: 'Four of a Kind' };
  }
  
  // Full House
  if (counts[0] === 3 && counts[1] === 2) {
    return { rank: 'FullHouse', name: 'Full House' };
  }
  
  // Flush
  if (isFlushHand) {
    return { rank: 'Flush', name: 'Flush' };
  }
  
  // Straight
  if (isStraightHand) {
    return { rank: 'Straight', name: 'Straight' };
  }
  
  // Three of a Kind
  if (counts[0] === 3) {
    return { rank: 'ThreeOfAKind', name: 'Three of a Kind' };
  }
  
  // Two Pair
  if (counts[0] === 2 && counts[1] === 2) {
    return { rank: 'TwoPair', name: 'Two Pair' };
  }
  
  // Pair
  if (counts[0] === 2) {
    return { rank: 'Pair', name: 'Pair' };
  }
  
  // High Card
  return { rank: 'HighCard', name: 'High Card' };
}

function compareHandRanks(rank1: HandRank, rank2: HandRank): number {
  const rankValues: Record<HandRank, number> = {
    'RoyalFlush': 9,
    'StraightFlush': 8,
    'FourOfAKind': 7,
    'FullHouse': 6,
    'Flush': 5,
    'Straight': 4,
    'ThreeOfAKind': 3,
    'TwoPair': 2,
    'Pair': 1,
    'HighCard': 0,
  };
  
  return rankValues[rank1] - rankValues[rank2];
}

export function evaluateHand(holeCards: Card[], board: Card[]): HandEvaluation {
  const allCards = [...holeCards, ...board];
  const bestHand = findBestHand(allCards);
  
  return {
    rank: bestHand.rank,
    cards: bestHand.cards,
    kickers: [], // Simplified - would need proper kicker calculation
    highlighted_cards: bestHand.cards,
    combination_type: bestHand.name,
  };
}

export function getHandDisplayName(rank: HandRank): string {
  const names: Record<HandRank, string> = {
    'RoyalFlush': 'Royal Flush',
    'StraightFlush': 'Straight Flush',
    'FourOfAKind': 'Four of a Kind',
    'FullHouse': 'Full House',
    'Flush': 'Flush',
    'Straight': 'Straight',
    'ThreeOfAKind': 'Three of a Kind',
    'TwoPair': 'Two Pair',
    'Pair': 'Pair',
    'HighCard': 'High Card',
  };
  return names[rank];
}
