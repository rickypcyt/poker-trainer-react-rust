import React from 'react';
import type { TableState } from '../types/table';
import { performBotActionNow } from '../lib/tableEngine';

export const useBotActions = (table: TableState, updateTable: (table: TableState) => void) => {
  // Bot thinking: when a bot is pending, perform the action immediately
  React.useEffect(() => {
    if (table.botPendingIndex == null) {
      return;
    }

    const botIndex = table.botPendingIndex;
    if (botIndex !== null) {
      console.log(`[Bot] Processing bot move for player ${botIndex}`);
    }

    // Perform bot action immediately without delay
    (async () => {
      const next = await performBotActionNow(table);
      updateTable(next);
    })();
  }, [table.botPendingIndex, table, updateTable]);

  return {
    isBotThinking: table.botPendingIndex !== null,
    currentBotIndex: table.botPendingIndex,
  };
};
