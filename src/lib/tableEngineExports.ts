import type { TableState } from '../types/table';
import { createInitialTable } from './tableEngine';
import { startNewHand } from './tableEngine';
import { prepareNewHandWithoutDealing } from './tableEngine';
import { proceedToFlop } from './tableEngine';
import { proceedToTurn } from './tableEngine';
import { proceedToRiver } from './tableEngine';
import { performDealerDraw } from './tableEngine';
import { revealDealerDraw } from './tableEngine';
import { simpleAdvance } from './tableEngine';
import { advanceToNextStreet } from './tableEngine';
import { processNextAction } from './tableEngine';
import { heroFold } from './tableEngine';
import { heroCall } from './tableEngine';
import { heroRaiseTo } from './tableEngine';
import { getHeroIndex } from './tableEngine';
import { maxBet } from './tableEngine';

export const tableEngine = {
  createInitialTable,
  startNewHand,
  prepareNewHandWithoutDealing,
  proceedToFlop,
  proceedToTurn,
  proceedToRiver,
  performDealerDraw,
  revealDealerDraw,
  simpleAdvance,
  advanceToNextStreet,
  processNextAction,
  heroFold,
  heroCall,
  heroRaiseTo,
  getHeroIndex,
  maxBet
};

export type { TableState };
