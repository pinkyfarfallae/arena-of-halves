import React from 'react';
import { useParams } from 'react-router-dom';
import './PvP.scss';

export default function PvP() {
  const { roomId } = useParams<{ roomId: string }>();

  return (
    <div className="training-pvp">
      <h1>PvP Training</h1>
      <p>Room ID: {roomId}</p>
    </div>
  );
}
