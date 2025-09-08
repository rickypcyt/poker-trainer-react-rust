import { Link } from 'react-router-dom';
import React from 'react';

export const Navbar: React.FC<{ onShuffle: () => void; disabled?: boolean; actionLabel?: string }> = ({ onShuffle, disabled, actionLabel = 'Shuffle' }) => {
  return (
    <nav className="navbar">
      <div className="nav-inner">
        <div>
          <Link to="/" className="btn text-white hover:bg-neutral-800/60 active:bg-neutral-800/80">
            Home
          </Link>
        </div>
        <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold text-white">Texas Hold'em Cards</h1>
        <div className="flex justify-end">
          <button className="btn btn-primary border" onClick={onShuffle} disabled={disabled}>
            {actionLabel}
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

