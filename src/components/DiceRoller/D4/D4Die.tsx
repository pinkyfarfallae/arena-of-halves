import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import type { DieRendererProps } from '../types';
import { useAuth } from '../../../hooks/useAuth';
import LoadingDice from '../LoadingDice/LoadingDice';
import './D4Die.scss';

const D4Scene = lazy(() => import('./D4Scene'));

const WINK_COUNT = 8;

export default function D4Die({ rolling, onResult, onRollEnd, onClick }: DieRendererProps) {
  const [rollTrigger, setRollTrigger] = useState(0);
  const [showWinks, setShowWinks] = useState(false);
  const winksFinished = useRef(0);
  const prevRolling = useRef(false);
  const { user } = useAuth();

  // Character theme colors (index 0 = primary, index 18 = primary-dark)
  const primary = user?.theme[0] ?? '#c0a062';
  const primaryDark = user?.theme[18] ?? '#8a6d3b';

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
      <div className="dr__d4-canvas">
        <D4Scene
          rollTrigger={rollTrigger}
          onResult={handleResult}
          onClick={onClick}
          primary={primary}
          primaryDark={primaryDark}
        />
        {showWinks && Array.from({ length: WINK_COUNT }, (_, i) => (
          <div
            key={`${rollTrigger}-${i}`}
            className={`dr__d4-wink dr__d4-wink--${i + 1}`}
            onAnimationEnd={handleWinkEnd}
          />
        ))}
      </div>
    </Suspense>
  );
}
