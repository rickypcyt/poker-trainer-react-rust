import { Link } from 'react-router-dom';
import React from 'react';

type NavbarProps = {
  onShuffle?: () => void;
  disabled?: boolean;
  actionLabel?: string;
  subtitle?: string;
};

export const Navbar: React.FC<NavbarProps> = ({ onShuffle, disabled, actionLabel = 'Shuffle', subtitle }) => {
  return (
    <nav className="bg-white/5 backdrop-blur-xl border-b border-white/10">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
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
          <div className="flex-1 text-center">
            <h1 className="text-xl sm:text-2xl font-bold text-white bg-gradient-to-r from-white to-white/80 bg-clip-text text-transparent">
              Poker Trainer
            </h1>
            {subtitle && (
              <p className="text-white/60 text-sm hidden sm:block">{subtitle}</p>
            )}
          </div>

          {/* Action Button */}
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
    </nav>
  );
};

export default Navbar;

