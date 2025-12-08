import React from 'react';

export const useKeyboardShortcuts = (
  isHeroTurn: boolean,
  stage: string,
  dealerDrawInProgress: boolean,
  handlePlayerAction: (action: 'Fold' | 'Call' | 'Raise', amount?: number) => void,
  handleQuickBet: (kind: 'half' | 'twoThirds' | 'pot' | 'allin' | 'min') => void
) => {
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!isHeroTurn || stage === 'Showdown' || dealerDrawInProgress) return;
      const k = e.key.toLowerCase();
      if (['f', 'c', 'r', '1', '2', '3', 'a', 'm'].includes(k)) {
        e.preventDefault();
      }
      if (k === 'f') return handlePlayerAction('Fold');
      if (k === 'c') return handlePlayerAction('Call');
      if (k === 'r') return handlePlayerAction('Raise');
      if (k === '1') return handleQuickBet('half');
      if (k === '2') return handleQuickBet('twoThirds');
      if (k === '3') return handleQuickBet('pot');
      if (k === 'a') return handleQuickBet('allin');
      if (k === 'm') return handleQuickBet('min');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHeroTurn, stage, dealerDrawInProgress, handlePlayerAction, handleQuickBet]);
};
