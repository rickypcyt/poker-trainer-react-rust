import { Link } from 'react-router-dom';
import React from 'react';

const MainMenu: React.FC = () => {
  return (
    <div className="min-h-screen bg-green-700 flex items-center justify-center px-4">
      <div className="w-full max-w-md bg-white/10 backdrop-blur rounded-xl p-6 sm:p-8 shadow-lg border border-white/20">
        <h1 className="text-white text-3xl sm:text-4xl font-extrabold text-center mb-6">Poker Trainer</h1>
        <div className="space-y-4">
          <Link
            to="/shuffler"
            className="btn btn-primary w-full text-center"
          >
            Card Shuffler
          </Link>
          <Link
            to="/solo"
            className="btn w-full text-center"
          >
            Solo Training
          </Link>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;


