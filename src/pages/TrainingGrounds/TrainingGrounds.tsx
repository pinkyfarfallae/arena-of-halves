import React, { useState } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import Stats from './pages/Stats/Stats';
import PvP from './pages/PvP/PvP';
import TrainWithAdmin from './pages/TrainWithAdmin/TrainWithAdmin';
import './TrainingGrounds.scss';
import TrainingRoleplaySubmission from './pages/TrainingRoleplaySubmission/TrainingRoleplaySubmission';

export default function TrainingGrounds() {
  const navigate = useNavigate();

  const handleTrainWithAdmin = () => {
    navigate('/training-grounds/guided');
  };

  const handlePvPMode = () => {
    // navigate(`/training-grounds/pvp/${randomRoomId}`);
  }

  const handleRolePlaySubmission = () => {
    navigate('/training-grounds/tasks');
  }

  return (
    <div className="training-grounds">
      <Routes>
        <Route path="/" element={<Stats onSelectTrainingWithAdminMode={handleTrainWithAdmin} onSelectPvPMode={handlePvPMode} onSelectRolePlaySubmission={handleRolePlaySubmission} />} />
        <Route path="/pvp/:roomId" element={<PvP />} />
        <Route path="/guided" element={<TrainWithAdmin />} />
        <Route path="/tasks" element={<TrainingRoleplaySubmission />} />
      </Routes>
    </div>
  );
}