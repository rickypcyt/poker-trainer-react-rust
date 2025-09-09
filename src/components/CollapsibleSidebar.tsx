import { MessageSquare, Trash2, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

import type { ActionLogEntry } from '../types/table';

interface CollapsibleSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  entries: ActionLogEntry[];
  maxEntries?: number;
  onClearLog?: () => void;
}

const CollapsibleSidebar: React.FC<CollapsibleSidebarProps> = ({
  isOpen,
  onToggle,
  entries,
  maxEntries = 100,
  onClearLog,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const visibleEntries = entries.slice(-maxEntries);
  const endOfFeedRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasNewEntries = useRef(false);
  const prevEntriesLength = useRef(entries.length);

  // Helper functions for styling (similar to SoloTraining)
  const stageLabel = (stage: string): string => {
    switch (stage) {
      case 'Deal': return 'Deal';
      case 'PreFlop': return 'Pre-Flop';
      case 'Flop': return 'Flop';
      case 'Turn': return 'Turn';
      case 'River': return 'River';
      case 'Showdown': return 'Showdown';
      case 'Folded': return 'Folded';
      case 'GameOver': return 'Game Over';
      default: return stage;
    }
  };

  const stageBadgeClass = (stage: string): string => {
    switch (stage) {
      case 'Deal': return 'bg-neutral-700/80 text-neutral-200 border-neutral-600/60';
      case 'PreFlop': return 'bg-indigo-600/30 text-indigo-200 border-indigo-600/40';
      case 'Flop': return 'bg-green-600/30 text-green-200 border-green-600/40';
      case 'Turn': return 'bg-yellow-600/30 text-yellow-200 border-yellow-600/40';
      case 'River': return 'bg-rose-600/30 text-rose-200 border-rose-600/40';
      case 'Showdown': return 'bg-blue-600/30 text-blue-200 border-blue-600/40';
      case 'Folded': return 'bg-red-600/30 text-red-200 border-red-600/40';
      case 'GameOver': return 'bg-neutral-800 text-neutral-200 border-neutral-700';
      default: return 'bg-neutral-700/80 text-neutral-200 border-neutral-600/60';
    }
  };

  const logKindIcon = (kind: string): string => {
    switch (kind) {
      case 'Tip': return '💡';
      case 'Action': return '🎯';
      case 'Deal': return '🃏';
      case 'Info': return 'ℹ️';
      default: return '📝';
    }
  };

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (containerRef.current && (isOpen || isHovered)) {
      endOfFeedRef.current?.scrollIntoView({ behavior: 'smooth' });
      hasNewEntries.current = false;
    } else if (entries.length > prevEntriesLength.current) {
      hasNewEntries.current = true;
    }
    prevEntriesLength.current = entries.length;
  }, [entries, isOpen, isHovered]);

  return (
    <>
      {/* Floating open button when sidebar is closed - positioned top right and hidden by default */}
      {!isOpen && (
        <div className="fixed top-4 right-0 group z-30 hover:opacity-100 opacity-0 transition-opacity duration-200">
          <button
            onClick={onToggle}
            className="p-2 bg-black/80 hover:bg-black text-white rounded-l-lg shadow-lg transition-all duration-200 border-l-0 border-t-0 border-b-0 border-r-2 border-neutral-600/50 hover:border-neutral-400/50"
            aria-label="Open game log"
          >
            <div className="relative">
              <MessageSquare className="w-5 h-5" />
              {hasNewEntries.current && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border border-neutral-100"></span>
              )}
            </div>
          </button>
        </div>
      )}

      <div
        className={`fixed top-0 right-0 h-[calc(100vh-56px)] mt-14 bg-neutral-900/95 backdrop-blur-lg border-l border-neutral-700/50 shadow-2xl transition-all duration-300 ease-in-out z-40 ${
          isOpen ? 'w-80' : 'w-0 opacity-0'
        }`}
      >
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className={`absolute -left-10 top-4 p-2 bg-neutral-800/80 hover:bg-neutral-700/80 rounded-l-lg border border-r-0 border-neutral-700/50 transition-colors ${
            isOpen ? 'opacity-100' : 'opacity-70 hover:opacity-100'
          }`}
          aria-label={isOpen ? 'Close sidebar' : 'Open sidebar'}
        >
          <X className="w-5 h-5 text-white" />
        </button>

      {/* Sidebar content */}
      <div className="h-full flex flex-col">
        <div className="sticky top-0 z-10 bg-neutral-800/90 border-b border-neutral-700/50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-white text-sm font-bold shadow-md">
                📝
              </div>
              <h3 className="text-white font-bold text-lg">Action Log & Tips</h3>
            </div>
          </div>
        </div>
        <div
          ref={containerRef}
          className="px-4 py-3 space-y-3 text-white text-base overflow-y-auto no-scrollbar flex-1 pb-20"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {visibleEntries.map((entry, index) => (
            <div key={`log-${index}`} className="bg-neutral-800/60 rounded-xl p-4 border border-neutral-700/40 hover:bg-neutral-800/80 transition-colors duration-200">
              <div className="flex flex-col gap-2">
                <div className={`px-3 py-1 rounded-lg border text-sm font-medium w-fit ${stageBadgeClass(entry.stage)}`}>
                  {stageLabel(entry.stage)}
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-lg flex-shrink-0">{logKindIcon(entry.kind || 'Info')}</span>
                  <div className="min-w-0">
                    <p className="text-white/90 leading-relaxed">{entry.message}</p>
                    <div className="text-neutral-400 text-sm font-medium mt-1">
                      {entry.time}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {visibleEntries.length === 0 && (
            <div className="text-center py-8 text-neutral-400">
              <div className="text-4xl mb-2">📋</div>
              <p className="text-sm">No actions yet</p>
            </div>
          )}
          <div ref={endOfFeedRef} />
        </div>
        {onClearLog && (
          <div className="sticky bottom-0 z-10 bg-neutral-800/90 border-t border-neutral-700/50 px-4 py-3">
            <button 
              className="group flex items-center justify-center space-x-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 border-2 border-red-500 hover:border-red-400 text-white px-4 py-2.5 rounded-xl font-bold text-sm transition-all duration-300 hover:scale-105 w-full shadow-lg hover:shadow-xl" 
              onClick={onClearLog}
            >
              <div className="w-5 h-5 bg-red-500 rounded-lg flex items-center justify-center group-hover:bg-red-400 transition-colors duration-300">
                <Trash2 className="w-3 h-3" />
              </div>
              <span>Clear Log</span>
            </button>
          </div>
        )}
        </div>
      </div>
    </>
  );
};

export default CollapsibleSidebar;
