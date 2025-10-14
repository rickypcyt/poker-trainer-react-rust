import React, { useEffect, useRef } from 'react';

import type { ActionLogEntry } from '../types/table';

interface ActionFeedProps {
  entries: ActionLogEntry[];
  maxEntries?: number;
}

const ActionFeed: React.FC<ActionFeedProps> = ({ entries, maxEntries = 50 }) => {
  const endOfFeedRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wasAtBottom = useRef(true);

  // Show the most recent entries (up to maxEntries)
  const visibleEntries = entries.slice(-maxEntries);

  // Auto-scroll to bottom when new entries are added, but only if already at bottom
  useEffect(() => {
    if (containerRef.current && wasAtBottom.current) {
      endOfFeedRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries]);

  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    const isAtBottom = scrollHeight - (scrollTop + clientHeight) < 10;
    wasAtBottom.current = isAtBottom;
  };

  return (
    <div className="absolute top-4 left-4 right-4 bg-neutral-900/90 backdrop-blur-xl rounded-xl border border-neutral-700/50 shadow-lg flex flex-col w-auto max-w-md h-40 z-50">
      <div className="px-4 py-2 border-b border-neutral-700/50 bg-neutral-900/50 flex justify-between items-center">
        <h3 className="text-white font-semibold text-base uppercase tracking-wider">Game History</h3>
        <span className="text-base text-white/50">{entries.length} actions</span>
      </div>
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-neutral-600/50 scrollbar-track-transparent hover:scrollbar-thumb-neutral-500/70"
      >
        <div className="px-3 py-2 space-y-1">
          {visibleEntries.length === 0 ? (
            <div className="text-white/50 text-base text-center py-4">No actions yet</div>
          ) : (
            visibleEntries.map((entry, index) => {
              // Add special styling for important events
              const isImportant = entry.message.includes('wins') || 
                                entry.message.includes('Showdown') ||
                                entry.message.includes('New hand');
              
              return (
                <div 
                  key={`${entry.time}-${index}`}
                  className={`rounded-md p-1.5 text-base ${
                    isImportant 
                      ? 'text-amber-300 font-medium' 
                      : 'text-white/80'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span>{entry.message}</span>
                    <span className="text-base text-white/40 ml-2 whitespace-nowrap">
                      {entry.time}
                    </span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={endOfFeedRef} />
        </div>
      </div>
    </div>
  );
};

export default ActionFeed;




