import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { DieRendererProps } from '../types';
import { useAuth } from '../../../hooks/useAuth';
import LoadingDice from '../LoadingDice/LoadingDice';
import './D10Die.scss';

const D10Scene = lazy(() => import('./D10Scene'));

const WINK_COUNT = 8;

export default function D10Die({ rolling, onResult, onRollEnd, onClick }: DieRendererProps) {
  const [rollTrigger, setRollTrigger] = useState(0);
  const [showWinks, setShowWinks] = useState(false);
  const winksFinished = useRef(0);
  const prevRolling = useRef(false);
  const { user } = useAuth();

  // Accent color (index 3 = accent, index 19 = accent-dark)
  const primary = user?.theme[3] ?? '#b8860b';
  const primaryDark = user?.theme[19] ?? '#8a6d3b';

  useEffect(() => {
    if (rolling && !prevRolling.current) {
      prevRolling.current = true;
      setRollTrigger(t => t + 1);
      setShowWinks(false);
      winksFinished.current = 0;
    }
    if (!rolling) prevRolling.current = false;
  }, [rolling]);

  const handleResult = (n: number) => {
    onResult(n);
    setShowWinks(true);
    setTimeout(() => onRollEnd(), 500);
  };

  const handleWinkEnd = () => {
    winksFinished.current++;
    if (winksFinished.current >= WINK_COUNT) setShowWinks(false);
  };

  return (
    <Suspense fallback={<LoadingDice />}>
      <div className="dr__d10-canvas">
        <D10Scene
          rollTrigger={rollTrigger}
          onResult={handleResult}
          onClick={onClick}
          primary={primary}
          primaryDark={primaryDark}
        />
        {showWinks && Array.from({ length: WINK_COUNT }, (_, i) => (
          <div
            key={`${rollTrigger}-${i}`}
            className={`dr__d10-wink dr__d10-wink--${i + 1}`}
            onAnimationEnd={handleWinkEnd}
          />
        ))}
      </div>
    </Suspense>
  );
}
