import React from 'react';
import type { ActionLogEntry } from '../types/table';

type LogsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  entries: ActionLogEntry[];
  onClear?: () => void;
  title?: string;
};

const LogsModal: React.FC<LogsModalProps> = ({ isOpen, onClose, entries, onClear, title = 'Action Log' }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative z-10 w-[90vw] max-w-2xl bg-neutral-900 text-white rounded-2xl border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h2 className="text-lg font-bold">{title}</h2>
          <div className="flex items-center gap-2">
            {onClear && (
              <button
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm border border-white/20"
                onClick={onClear}
              >
                Clear
              </button>
            )}
            <button
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {entries.length === 0 ? (
            <div className="text-white/60 text-center py-6">No logs yet.</div>
          ) : (
            <ul className="space-y-2">
              {entries.map((e, idx) => (
                <li key={idx} className="flex items-start gap-3 p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs text-white/50 font-mono mt-0.5">{e.time}</span>
                  <div className="flex-1">
                    <div className={`text-sm ${e.isImportant ? 'font-bold text-yellow-200' : 'text-white/90'}`}>{e.message}</div>
                    {e.winner && e.winningCard && (
                      <div className="text-xs text-white/70 mt-0.5">Winner: {e.winner} — {e.winningCard}</div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default LogsModal;
