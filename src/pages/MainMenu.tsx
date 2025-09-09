import { Link } from 'react-router-dom';
import React from 'react';

const MainMenu: React.FC = () => {
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900 flex items-center justify-center px-4">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-10">
        <div className="absolute top-10 left-10 w-20 h-20 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-32 right-20 w-16 h-16 border-2 border-white/20 rounded-full"></div>
        <div className="absolute bottom-20 left-32 w-12 h-12 border-2 border-white/20 rounded-full"></div>
        <div className="absolute bottom-32 right-10 w-24 h-24 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-1/2 left-1/4 w-8 h-8 border-2 border-white/20 rounded-full"></div>
        <div className="absolute top-1/3 right-1/3 w-14 h-14 border-2 border-white/20 rounded-full"></div>
      </div>

      <div className="relative w-full max-w-lg">
        {/* Main Card */}
        <div className="bg-white/15 backdrop-blur-xl rounded-2xl p-8 sm:p-10 shadow-2xl border border-white/30">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mb-4 shadow-lg">
              <span className="text-3xl">🃏</span>
            </div>
            <h1 className="text-white text-4xl sm:text-5xl font-black mb-2 bg-gradient-to-r from-yellow-300 to-orange-300 bg-clip-text text-transparent">
              Poker Trainer
            </h1>
            <p className="text-white/80 text-lg font-medium">
              Master the art of poker
            </p>
          </div>

          {/* Menu Options */}
          <div className="space-y-4">
            {/* Play with Bots - First */}
            <Link
              to="/play"
              className="group block w-full"
            >
              <div className="bg-gradient-to-r from-red-500/20 to-pink-500/20 hover:from-red-500/30 hover:to-pink-500/30 border border-red-400/30 hover:border-red-400/50 rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-400 to-pink-500 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md">
                    🤖
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white text-xl font-bold mb-1">Play with Bots</h3>
                    <p className="text-white/70 text-base">Challenge AI opponents</p>
                  </div>
                  <div className="text-white/50 group-hover:text-white/80 transition-colors">
                    →
                  </div>
                </div>
              </div>
            </Link>


            {/* Pre Flop Trainer (renamed from Solo Training) - Second */}
            <Link
              to="/solo"
              className="group block w-full"
            >
              <div className="bg-gradient-to-r from-green-500/20 to-teal-500/20 hover:from-green-500/30 hover:to-teal-500/30 border border-green-400/30 hover:border-green-400/50 rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-green-400 to-teal-500 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md">
                    🎯
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white text-xl font-bold mb-1">Pre Flop Trainer</h3>
                    <p className="text-white/70 text-base">Practice against the house</p>
                  </div>
                  <div className="text-white/50 group-hover:text-white/80 transition-colors">
                    →
                  </div>
                </div>
              </div>
            </Link>

            {/* Card Shuffler - Third */}
            <Link
              to="/shuffler"
              className="group block w-full"
            >
              <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 hover:from-blue-500/30 hover:to-purple-500/30 border border-blue-400/30 hover:border-blue-400/50 rounded-xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-purple-500 rounded-lg flex items-center justify-center text-white text-xl font-bold shadow-md">
                    🔀
                  </div>
                  <div className="flex-1 text-left">
                    <h3 className="text-white text-xl font-bold mb-1">Card Shuffler</h3>
                    <p className="text-white/70 text-base">Practice with secure shuffling</p>
                  </div>
                  <div className="text-white/50 group-hover:text-white/80 transition-colors">
                    →
                  </div>
                </div>
              </div>
            </Link>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-white/20">
            <p className="text-white/60 text-center text-base">
              🎲 Built for poker enthusiasts
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MainMenu;


