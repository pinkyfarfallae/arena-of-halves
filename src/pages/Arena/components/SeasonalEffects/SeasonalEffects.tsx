import { useMemo } from 'react';
import type { SeasonKey } from '../../../../data/seasons';
import './SeasonalEffects.scss';

interface Props {
  season?: SeasonKey;
  side: 'left' | 'right';
  isActive: boolean;
}

/**
 * SeasonalEffects — Displays visual theme effects based on selected season
 * Appears on both sides of the arena field during Borrowed Season power duration
 */
export default function SeasonalEffects({ season, side, isActive }: Props) {
  const effectClass = useMemo(() => {
    if (!season || !isActive) return '';
    return `seasonal-effects--${season}`;
  }, [season, isActive]);

  if (!isActive || !season) return null;

  return (
    <div className={`seasonal-effects ${effectClass} seasonal-effects--${side}`}>
      {/* Animated particles/effects based on season */}
      <div className="seasonal-effects__particles">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="seasonal-effects__particle"
            style={{
              '--delay': `${i * 0.1}s`,
              '--duration': `${3 + (i % 2)}s`,
            } as React.CSSProperties}
          />
        ))}
      </div>

      {/* Background glow overlay */}
      <div className="seasonal-effects__glow" />

      {/* Top accent bar */}
      <div className="seasonal-effects__accent-top" />

      {/* Bottom accent bar */}
      <div className="seasonal-effects__accent-bottom" />
    </div>
  );
}
