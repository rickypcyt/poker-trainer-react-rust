import React from 'react';

interface DealerProps {
  isDealing: boolean;
}

const Dealer: React.FC<DealerProps> = ({ isDealing }) => {
  return (
    <div className="flex flex-col items-center">
      
      <div className={`text-5xl ${isDealing ? 'animate-pulse' : ''}`}>🤵</div>
      <div className="text-white/90 text-base font-medium mt-3 bg-black/50 px-3 py-1 rounded-full">Dealer</div>
    </div>
  );
};

export default Dealer;



