import { Navigate, Route, Routes } from 'react-router-dom';

import CardShuffler from './pages/CardShuffler';
import MainMenu from './pages/MainMenu';
import React from 'react';
import SoloTraining from './pages/SoloTraining';

function App() {
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
