import React from 'react';
import Navbar from '../components/Navbar';

const Play: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-800 via-green-700 to-green-900">
      <Navbar subtitle="Play with Bots" />
      
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-gradient-to-br from-red-400 to-pink-500 rounded-full mb-6 shadow-lg">
              <span className="text-4xl">🤖</span>
            </div>
            <h1 className="text-white text-5xl font-black mb-4 bg-gradient-to-r from-red-300 to-pink-300 bg-clip-text text-transparent">
              Play with Bots
            </h1>
            <p className="text-white/80 text-xl font-medium mb-8">
              Coming Soon! Challenge AI opponents
            </p>
          </div>

          <div className="bg-white/10 backdrop-blur-xl rounded-2xl p-8 max-w-md mx-auto border border-white/20">
            <div className="space-y-4">
              <div className="flex items-center justify-center space-x-3 text-white/70">
                <div className="w-3 h-3 bg-yellow-400 rounded-full animate-pulse"></div>
                <span className="text-sm font-medium">Feature in development</span>
              </div>
              
              <div className="text-white/60 text-sm">
                <p className="mb-2">🎯 Multiplayer poker with AI</p>
                <p className="mb-2">🧠 Smart bot opponents</p>
                <p className="mb-2">🏆 Tournament mode</p>
                <p>📊 Advanced statistics</p>
              </div>
            </div>
          </div>

          <div className="mt-8">
            <button 
              onClick={() => window.history.back()}
              className="bg-white/20 hover:bg-white/30 text-white px-6 py-3 rounded-xl font-medium transition-all duration-300 hover:scale-105"
            >
              ← Back to Menu
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Play;
