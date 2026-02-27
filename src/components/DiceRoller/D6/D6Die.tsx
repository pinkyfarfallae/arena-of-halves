import { useEffect, useRef, useState } from 'react';
import type { DieRendererProps } from '../types';
import CubeShell from '../CubeShell';

const REST = { x: -15, y: 20, z: 0 };

const FACE_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: 180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
};

const PIP_LAYOUTS: Record<number, string[]> = {
  1: ['MC'],
  2: ['TR', 'BL'],
  3: ['TR', 'MC', 'BL'],
  4: ['TL', 'TR', 'BL', 'BR'],
  5: ['TL', 'TR', 'MC', 'BL', 'BR'],
  6: ['TL', 'TR', 'ML', 'MR', 'BL', 'BR'],
};

function Pips({ value }: { value: number }) {
  const positions = PIP_LAYOUTS[value] ?? [];
  return (
    <div className="dr__pips">
      {positions.map((pos, i) => (
        <span key={i} className={`dr__pip dr__pip--${pos}`} />
      ))}
    </div>
  );
}

export default function D6Die({ rolling, onResult, onRollEnd, onClick }: DieRendererProps) {
  const [rotation, setRotation] = useState({ ...REST });
  const [landed, setLanded] = useState(false);
  const spinCountRef = useRef(0);
  const [spinCount, setSpinCount] = useState(0);
  const prevRolling = useRef(false);

  useEffect(() => {
    if (rolling && !prevRolling.current) {
      prevRolling.current = true;
      spinCountRef.current++;
      setSpinCount(spinCountRef.current);

      const finalResult = Math.floor(Math.random() * 6) + 1;
      const r = FACE_ROTATIONS[finalResult] ?? { x: 0, y: 0 };

      const extraX = (3 + Math.floor(Math.random() * 3)) * 360;
      const extraY = (3 + Math.floor(Math.random() * 3)) * 360;
      const extraZ = (1 + Math.floor(Math.random() * 3)) * 360;
      const dirX = Math.random() > 0.5 ? 1 : -1;
      const dirY = Math.random() > 0.5 ? 1 : -1;
      const dirZ = Math.random() > 0.5 ? 1 : -1;

      setRotation({
        x: dirX * extraX + r.x + REST.x,
        y: dirY * extraY + r.y + REST.y,
        z: dirZ * extraZ,
      });

      const t1 = setTimeout(() => onResult(finalResult), 1500);
      const t2 = setTimeout(() => {
        setLanded(true);
        onRollEnd();
        setTimeout(() => setLanded(false), 500);
      }, 2000);

      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    if (!rolling) prevRolling.current = false;
  }, [rolling, onResult, onRollEnd]);

  return (
    <CubeShell die={6} rolling={rolling} landed={landed} rotation={rotation} spinCount={spinCount} onClick={onClick}>
      <div className="dr__face dr__face--front"><Pips value={1} /></div>
      <div className="dr__face dr__face--back"><Pips value={3} /></div>
      <div className="dr__face dr__face--right"><Pips value={2} /></div>
      <div className="dr__face dr__face--left"><Pips value={4} /></div>
      <div className="dr__face dr__face--top"><Pips value={5} /></div>
      <div className="dr__face dr__face--bottom"><Pips value={6} /></div>
    </CubeShell>
  );
}
