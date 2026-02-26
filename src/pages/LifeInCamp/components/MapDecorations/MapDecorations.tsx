import React from 'react';
import Compass from './icons/Compass';
import Trails from './icons/Trails';
import Lake from './icons/Lake';
import Tree from './icons/Tree';
import Bush from './icons/Bush';
import Rock from './icons/Rock';
import Flower from './icons/Flower';
import Grass from './icons/Grass';
import Flag from './icons/Flag';
import Bird from './icons/Bird';
import Mushroom from './icons/Mushroom';
import SteppingStone from './icons/SteppingStone';
import Butterfly from './icons/Butterfly';
import Torch from './icons/Torch';
import './MapDecorations.scss';

function MapDecorations() {
  return (
    <>
      {/* Map title */}
      <div className="life__map-title">
        <span className="life__map-title-text">Camp Half-Blood</span>
        <span className="life__map-title-sub">Long Island Sound, New York</span>
      </div>

      {/* Compass rose */}
      <div className="life__compass">
        <Compass />
      </div>

      {/* Trail paths */}
      <Trails className="life__trails" />

      {/* Lake area */}
      <Lake className="life__lake-shape" />

      {/* Forest area */}
      <div className="life__forest-area">
        {Array.from({ length: 8 }).map((_, i) => (
          <Tree key={i} className="life__tree" style={{ left: `${10 + (i % 4) * 22}%`, top: `${10 + Math.floor(i / 4) * 35}%` }} />
        ))}
      </div>

      {/* Scattered decorations */}
      <div className="life__decorations">
        {/* Bushes */}
        {[
          { x: 60, y: 18, s: 1 }, { x: 92, y: 15, s: 0.8 }, { x: 5, y: 35, s: 0.9 },
          { x: 48, y: 62, s: 1.1 }, { x: 75, y: 82, s: 0.7 }, { x: 28, y: 85, s: 0.9 },
          { x: 93, y: 72, s: 0.8 }, { x: 62, y: 8, s: 0.7 }, { x: 3, y: 68, s: 1 },
          { x: 85, y: 88, s: 0.8 }, { x: 45, y: 92, s: 0.9 },
        ].map((b, i) => (
          <Bush key={`bush-${i}`} className="life__deco life__deco--bush" style={{ left: `${b.x}%`, top: `${b.y}%`, transform: `scale(${b.s})` }} />
        ))}

        {/* Rocks */}
        {[
          { x: 70, y: 30, s: 1 }, { x: 30, y: 55, s: 0.8 }, { x: 88, y: 42, s: 0.7 },
          { x: 55, y: 72, s: 0.9 }, { x: 15, y: 90, s: 0.8 }, { x: 42, y: 18, s: 0.7 },
          { x: 78, y: 58, s: 0.9 }, { x: 95, y: 30, s: 0.6 },
        ].map((r, i) => (
          <Rock key={`rock-${i}`} className="life__deco life__deco--rock" style={{ left: `${r.x}%`, top: `${r.y}%`, transform: `scale(${r.s})` }} />
        ))}

        {/* Flowers */}
        {[
          { x: 25, y: 48, c: '#e91e63' }, { x: 58, y: 28, c: '#ff9800' }, { x: 44, y: 82, c: '#9c27b0' },
          { x: 76, y: 18, c: '#f44336' }, { x: 15, y: 72, c: '#ff5722' }, { x: 68, y: 52, c: '#e91e63' },
          { x: 90, y: 82, c: '#ff9800' }, { x: 35, y: 12, c: '#9c27b0' }, { x: 8, y: 50, c: '#f44336' },
          { x: 52, y: 48, c: '#ff5722' },
        ].map((f, i) => (
          <Flower key={`flower-${i}`} color={f.c} className="life__deco life__deco--flower" style={{ left: `${f.x}%`, top: `${f.y}%` }} />
        ))}

        {/* Grass tufts */}
        {[
          { x: 33, y: 30 }, { x: 65, y: 42 }, { x: 82, y: 52 }, { x: 20, y: 18 },
          { x: 50, y: 55 }, { x: 10, y: 82 }, { x: 72, y: 72 }, { x: 40, y: 40 },
          { x: 88, y: 20 }, { x: 55, y: 88 }, { x: 30, y: 65 }, { x: 95, y: 60 },
          { x: 5, y: 25 }, { x: 62, y: 32 },
        ].map((g, i) => (
          <Grass key={`grass-${i}`} className="life__deco life__deco--grass" style={{ left: `${g.x}%`, top: `${g.y}%` }} />
        ))}

        {/* Flags / banners */}
        {[
          { x: 60, y: 38, c: '#f44336' }, { x: 46, y: 70, c: '#2196f3' },
          { x: 78, y: 35, c: '#ff9800' }, { x: 25, y: 52, c: '#4caf50' },
        ].map((fl, i) => (
          <Flag key={`flag-${i}`} color={fl.c} className="life__deco life__deco--flag" style={{ left: `${fl.x}%`, top: `${fl.y}%` }} />
        ))}

        {/* Birds */}
        {[
          { x: 38, y: 8 }, { x: 72, y: 12 }, { x: 55, y: 5 },
          { x: 85, y: 10 }, { x: 18, y: 6 },
        ].map((bd, i) => (
          <Bird key={`bird-${i}`} className="life__deco life__deco--bird" style={{ left: `${bd.x}%`, top: `${bd.y}%` }} />
        ))}

        {/* Mushrooms */}
        {[
          { x: 7, y: 28, c: '#e53935' }, { x: 24, y: 42, c: '#8e24aa' },
          { x: 58, y: 65, c: '#e53935' }, { x: 42, y: 22, c: '#ff8f00' },
          { x: 76, y: 78, c: '#8e24aa' }, { x: 92, y: 38, c: '#e53935' },
        ].map((m, i) => (
          <Mushroom key={`mush-${i}`} color={m.c} className="life__deco life__deco--mushroom" style={{ left: `${m.x}%`, top: `${m.y}%` }} />
        ))}

        {/* Stepping stones */}
        {[
          { x: 47, y: 35 }, { x: 63, y: 55 }, { x: 32, y: 58 },
          { x: 82, y: 48 }, { x: 18, y: 80 },
        ].map((s, i) => (
          <SteppingStone key={`stone-${i}`} className="life__deco life__deco--stone" style={{ left: `${s.x}%`, top: `${s.y}%` }} />
        ))}

        {/* Butterflies */}
        {[
          { x: 42, y: 15, c: '#e91e63' }, { x: 68, y: 25, c: '#ff9800' },
          { x: 22, y: 55, c: '#2196f3' }, { x: 85, y: 58, c: '#9c27b0' },
          { x: 50, y: 75, c: '#ff5722' }, { x: 12, y: 38, c: '#4caf50' },
        ].map((bf, i) => (
          <Butterfly key={`bfly-${i}`} color={bf.c} className="life__deco life__deco--butterfly" style={{ left: `${bf.x}%`, top: `${bf.y}%` }} />
        ))}

        {/* Torches */}
        {[
          { x: 56, y: 30 }, { x: 38, y: 60 }, { x: 74, y: 40 },
          { x: 20, y: 68 }, { x: 88, y: 68 },
        ].map((t, i) => (
          <Torch key={`torch-${i}`} className="life__deco life__deco--torch" style={{ left: `${t.x}%`, top: `${t.y}%` }} />
        ))}
      </div>
    </>
  );
}

export default MapDecorations;
