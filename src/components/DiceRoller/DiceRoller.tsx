import React, { Suspense, useCallback, useRef, useState } from 'react';
import './DiceRoller.scss';

const D4Scene = React.lazy(() => import('./D4Scene'));

const DICE = [4, 6, 8, 10, 12, 20, 100] as const;
type Die = (typeof DICE)[number];

interface HistoryEntry {
  die: Die;
  result: number;
}

interface Props {
  className?: string;
}

/* Resting tilt so the cube sits at an angle (shows depth) */
/* Resting tilt — only d6 gets tilted (cube looks great angled),
   other dice face forward so the clip-path shape stays clean */
const REST_D6 = { x: -15, y: 20, z: 0 };
const REST_FLAT = { x: 0, y: 0, z: 0 };
function restFor(d: Die) { return d === 6 ? REST_D6 : REST_FLAT; }

/* d6 face → cube rotation to show that face in front */
const D6_ROTATIONS: Record<number, { x: number; y: number }> = {
  1: { x: 0, y: 0 },
  2: { x: 0, y: -90 },
  3: { x: 0, y: 180 },
  4: { x: 0, y: 90 },
  5: { x: -90, y: 0 },
  6: { x: 90, y: 0 },
};

/* Pip positions for d6 faces (3x3 grid positions: TL TC TR ML MC MR BL BC BR) */
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

function FaceNumber({ value, label }: { value: number | string; label?: string }) {
  return (
    <div className="dr__face-num">
      <span>{value}</span>
      {label && <span className="dr__face-label">{label}</span>}
    </div>
  );
}

export default function DiceRoller({ className }: Props) {
  const [die, setDie] = useState<Die>(20);
  const [result, setResult] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const [landed, setLanded] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rotation, setRotation] = useState({ ...REST_D6 });
  const spinCount = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* Random numbers for non-front faces (cosmetic) */
  const [faceNums, setFaceNums] = useState<number[]>([0, 0, 0, 0, 0]);

  /* d4 physics: trigger counter + result callback */
  const [d4RollTrigger, setD4RollTrigger] = useState(0);

  const handleD4Result = useCallback((res: number) => {
    setResult(res);
    setRolling(false);
    setLanded(true);
    setHistory(h => [{ die: 4 as Die, result: res }, ...h].slice(0, 5));
    setTimeout(() => setLanded(false), 500);
  }, []);

  const roll = useCallback(() => {
    if (rolling) return;

    /* d4: delegate to physics engine */
    if (die === 4) {
      setRolling(true);
      setResult(null);
      setD4RollTrigger(t => t + 1);
      return;
    }

    setRolling(true);
    setLanded(false);
    spinCount.current++;

    const max = die;
    const finalResult = Math.floor(Math.random() * max) + 1;

    /* Random cosmetic numbers for non-front faces */
    setFaceNums(Array.from({ length: 5 }, () => Math.floor(Math.random() * max) + 1));

    /* Set tumble: random extra full rotations + landing rotation */
    const extraSpinsX = (3 + Math.floor(Math.random() * 3)) * 360;
    const extraSpinsY = (3 + Math.floor(Math.random() * 3)) * 360;
    const extraSpinsZ = (1 + Math.floor(Math.random() * 3)) * 360;
    const dirX = Math.random() > 0.5 ? 1 : -1;
    const dirY = Math.random() > 0.5 ? 1 : -1;
    const dirZ = Math.random() > 0.5 ? 1 : -1;

    let landX: number;
    let landY: number;
    if (die === 6) {
      const r = D6_ROTATIONS[finalResult] ?? { x: 0, y: 0 };
      landX = r.x;
      landY = r.y;
    } else {
      landX = 0;
      landY = 0;
    }

    /* Hide result during spin — show dash on the face */
    setResult(null);

    /* d6: full 3D tumble to land on correct face.
       Others: flat spin (Z only) — front face stays visible like Google dice. */
    const rest = restFor(die);
    if (die === 6) {
      setRotation({
        x: dirX * extraSpinsX + landX + rest.x,
        y: dirY * extraSpinsY + landY + rest.y,
        z: dirZ * extraSpinsZ,
      });
    } else {
      setRotation({ x: 0, y: 0, z: dirZ * extraSpinsZ });
    }

    /* Reveal result on the face after 1.5s (cube is settling) */
    setTimeout(() => setResult(finalResult), 1500);

    timerRef.current = setTimeout(() => {
      setRolling(false);
      setLanded(true);
      setHistory(h => [{ die, result: finalResult }, ...h].slice(0, 5));
      /* Clear landed after bounce animation */
      setTimeout(() => setLanded(false), 500);
    }, 2000);
  }, [die, rolling]);

  const isD6 = die === 6;
  const isD4 = die === 4;

  return (
    <div className={`dr${className ? ` ${className}` : ''}`}>
      <div className="dr__dice-row">
        {DICE.map(d => (
          <button
            key={d}
            className={`dr__die-btn${d === die ? ' dr__die-btn--active' : ''}`}
            onClick={() => {
              setDie(d);
              setResult(null);
              setFaceNums([0, 0, 0, 0, 0]);
              setRotation({ ...restFor(d) });
              spinCount.current = 0;
              setD4RollTrigger(0);
            }}
            disabled={rolling}
          >
            d{d}
          </button>
        ))}
      </div>

      <div className="dr__display">
        {isD4 ? (
          /* 3D physics-based d4 */
          <div className="dr__d4-canvas">
            <Suspense fallback={<div className="dr__d4-loading">Loading&hellip;</div>}>
              <D4Scene
                rollTrigger={d4RollTrigger}
                onResult={handleD4Result}
                onClick={roll}
              />
            </Suspense>
          </div>
        ) : (
          /* CSS 3D cube for all other dice */
          <div
            className={`dr__cube-scene${rolling ? ' dr__cube-scene--rolling' : ''}${landed ? ' dr__cube-scene--landed' : ''}`}
            onClick={roll}
          >
            <div
              className="dr__cube"
              data-die={die}
              style={{
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg) rotateZ(${rotation.z}deg)`,
                transition: spinCount.current === 0
                  ? 'none'
                  : 'transform 2s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              {/* Front */}
              <div className="dr__face dr__face--front">
                {isD6 ? <Pips value={1} /> : <FaceNumber value={result ?? '\u2014'} label={`d${die}`} />}
              </div>
              {/* Back */}
              <div className="dr__face dr__face--back">
                {isD6 ? <Pips value={3} /> : <FaceNumber value={faceNums[0] || '\u00B7'} />}
              </div>
              {/* Right */}
              <div className="dr__face dr__face--right">
                {isD6 ? <Pips value={2} /> : <FaceNumber value={faceNums[1] || '\u00B7'} />}
              </div>
              {/* Left */}
              <div className="dr__face dr__face--left">
                {isD6 ? <Pips value={4} /> : <FaceNumber value={faceNums[2] || '\u00B7'} />}
              </div>
              {/* Top */}
              <div className="dr__face dr__face--top">
                {isD6 ? <Pips value={5} /> : <FaceNumber value={faceNums[3] || '\u00B7'} />}
              </div>
              {/* Bottom */}
              <div className="dr__face dr__face--bottom">
                {isD6 ? <Pips value={6} /> : <FaceNumber value={faceNums[4] || '\u00B7'} />}
              </div>
            </div>
          </div>
        )}
        {result !== null && !rolling && (
          <span className="dr__result-text">{result}</span>
        )}
        <span className="dr__die-label">d{die}</span>
      </div>

      <button className="dr__roll-btn" onClick={roll} disabled={rolling}>
        {rolling ? 'Rolling\u2026' : 'Roll'}
      </button>

      {history.length > 0 && (
        <div className="dr__history">
          {history.map((h, i) => (
            <span key={i} className="dr__history-entry">
              d{h.die}&thinsp;&rarr;&thinsp;{h.result}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
