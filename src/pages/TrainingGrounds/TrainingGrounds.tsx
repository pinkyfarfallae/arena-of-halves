import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Stats from './pages/Stats/Stats';
import PvP from './pages/PvP/PvP';
import TrainWithAdmin from './pages/TrainWithAdmin/TrainWithAdmin';
import './TrainingGrounds.scss';

export default function TrainingGrounds() {
  const navigate = useNavigate();
  const [showModeSelector, setShowModeSelector] = useState(false);

  const handleTrainWithAdmin = () => {
    setShowModeSelector(false);
    navigate('/training-grounds/guided');
  };

  return (
    <div className="training-grounds">
      <Routes>
        <Route path="/" element={<Stats onSelectMode={() => setShowModeSelector(true)} />} />
        <Route path="/pvp/:roomId" element={<PvP />} />
        <Route path="/guided" element={<TrainWithAdmin />} />
      </Routes>
    </div>
  );
}