import { Link } from 'react-router-dom';
import React from 'react';

type NavbarProps = {
  onShuffle?: () => void;
  onMenuToggle?: () => void;
  onOpenLogs?: () => void;
  onOpenHands?: () => void;
  onEndGame?: () => void;
  disabled?: boolean;
  actionLabel?: string;
  subtitle?: string;
};

export const Navbar: React.FC<NavbarProps> = ({ 
  onShuffle, 
  onMenuToggle, 
  onOpenLogs,
  onOpenHands,
  onEndGame,
  disabled, 
  actionLabel = 'Shuffle', 
  subtitle 
}) => {
  return (
    <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-3 items-center">
          {/* Home Button */}
          <Link 
            to="/" 
            className="group flex items-center space-x-2 text-white/80 hover:text-white transition-colors duration-300"
          >
            <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors duration-300">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </div>
            <span className="font-medium hidden sm:block">Home</span>
          </Link>

          {/* Title */}
          <div className="text-center justify-self-center">
            <h1 className="text-xl sm:text-2xl font-bold text-white bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Poker Trainer
            </h1>
            {subtitle && (
              <p className="text-white/60 text-base hidden sm:block">{subtitle}</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2 justify-self-end">
            {onMenuToggle && (
              <button 
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors duration-300 md:hidden"
                onClick={onMenuToggle}
                aria-label="Toggle menu"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                </svg>
              </button>
            )}
            {onEndGame && (
              <button
                className="group flex items-center space-x-2 bg-red-500/20 hover:bg-red-500/30 border border-red-400/40 hover:border-red-400/60 text-red-100 px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                onClick={onEndGame}
                aria-label="End game"
              >
                <div className="w-5 h-5 bg-red-500/30 rounded-md flex items-center justify-center group-hover:bg-red-500/40 transition-colors duration-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
                <span className="hidden sm:block">End Game</span>
              </button>
            )}
            {onOpenLogs && (
              <button
                className="group flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                onClick={onOpenLogs}
                aria-label="Open logs"
              >
                <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-6h6v6m2 4H7a2 2 0 01-2-2V7a2 2 0 012-2h3l2-2h4l2 2h3a2 2 0 012 2v12a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <span className="hidden sm:block">Logs</span>
              </button>
            )}
            {onOpenHands && (
              <button
                className="group flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105"
                onClick={onOpenHands}
                aria-label="Open poker hands"
              >
                <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7h18M3 12h18M3 17h18" />
                  </svg>
                </div>
                <span className="hidden sm:block">Hands</span>
              </button>
            )}
            {onShuffle && (
              <button 
                className="group flex items-center space-x-2 bg-white/10 hover:bg-white/20 border border-white/20 hover:border-white/30 text-white px-4 py-2 rounded-xl font-medium transition-all duration-300 hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100" 
                onClick={onShuffle} 
                disabled={disabled}
              >
                <div className="w-5 h-5 bg-white/20 rounded-md flex items-center justify-center group-hover:bg-white/30 transition-colors duration-300">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </div>
                <span className="hidden sm:block">{actionLabel}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

