import { Navigate, Route, Routes } from 'react-router-dom';
import { startHotRefreshServer, stopHotRefreshServer } from './lib/hotRefresh';

import CardShuffler from './pages/CardShuffler';
import MainMenu from './pages/MainMenu';
import SoloTraining from './pages/SoloTraining';
import { useEffect } from 'react';

function App() {
  useEffect(() => {
    // Start hot refresh server in development
    startHotRefreshServer();
    
    // Cleanup on unmount
    return () => {
      stopHotRefreshServer();
    };
  }, []);

  return (
    <Routes>
      <Route path="/" element={<MainMenu />} />
      <Route path="/shuffler" element={<CardShuffler />} />
      <Route path="/solo" element={<SoloTraining />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
