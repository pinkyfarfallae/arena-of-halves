import { useCallback, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { DICE, type Die, type HistoryEntry, type DieRendererProps } from './types';
import D4Die from './D4/D4Die';
import D6Die from './D6/D6Die';
import D8Die from './D8/D8Die';
import D10Die from './D10/D10Die';
import D12Die from './D12/D12Die';
import D20Die from './D20/D20Die';
import D100Die from './D100/D100Die';
import './DiceRoller.scss';

interface Props {
  className?: string;
}

const DIE_COMPONENTS: Record<Die, React.ComponentType<DieRendererProps>> = {
  4: D4Die,
  6: D6Die,
  8: D8Die,
  10: D10Die,
  12: D12Die,
  20: D20Die,
  100: D100Die,
};

export default function DiceRoller({ className }: Props) {
  const { user } = useAuth();
  const accent = user?.theme[9] ?? '#b8860b';
  const [die, setDie] = useState<Die>(20);
  const [rolling, setRolling] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [rollCount, setRollCount] = useState(0);

  const roll = useCallback(() => {
    if (rolling) return;
    setRolling(true);
  }, [rolling]);

  const handleResult = useCallback((n: number) => {
    setHistory(h => [{ die, result: n }, ...h].slice(0, 5));
    setRollCount(c => c + 1);
  }, [die]);

  const handleRollEnd = useCallback(() => {
    setRolling(false);
  }, []);

  const DieComponent = DIE_COMPONENTS[die];

  return (
    <div className={`dr${className ? ` ${className}` : ''}`}>
      {/* Prism light rays */}
      <div className="dr__prism dr__prism--1" />
      <div className="dr__prism dr__prism--2" />
      <div className="dr__prism dr__prism--3" />

      {/* Rainbow bands (iris-style) */}
      <div className="dr__band" />
      <div className="dr__band dr__band--2" />
      <div className="dr__band dr__band--3" />

      {/* Background wink decorations */}
      <div className="dr__bg-wink" style={{ top: '8%', left: '6%', animationDelay: '0s' }} />
      <div className="dr__bg-wink" style={{ top: '18%', left: '85%', animationDelay: '-1.8s' }} />
      <div className="dr__bg-wink" style={{ top: '40%', left: '3%', animationDelay: '-3.5s' }} />
      <div className="dr__bg-wink" style={{ top: '55%', left: '92%', animationDelay: '-0.6s' }} />
      <div className="dr__bg-wink" style={{ top: '75%', left: '12%', animationDelay: '-4.2s' }} />
      <div className="dr__bg-wink" style={{ top: '30%', left: '50%', animationDelay: '-2.2s' }} />
      <div className="dr__bg-wink" style={{ top: '85%', left: '78%', animationDelay: '-5.5s' }} />
      <div className="dr__bg-wink" style={{ top: '65%', left: '35%', animationDelay: '-6.8s' }} />

      {/* Rising motes */}
      <div className="dr__mote" style={{ left: '12%', animationDelay: '0s' }} />
      <div className="dr__mote" style={{ left: '28%', animationDelay: '-3s' }} />
      <div className="dr__mote" style={{ left: '45%', animationDelay: '-7s' }} />
      <div className="dr__mote" style={{ left: '62%', animationDelay: '-2s' }} />
      <div className="dr__mote" style={{ left: '78%', animationDelay: '-5s' }} />
      <div className="dr__mote" style={{ left: '90%', animationDelay: '-9s' }} />

      {/* Floating pastel orbs */}
      <div className="dr__orb dr__orb--1" />
      <div className="dr__orb dr__orb--2" />
      <div className="dr__orb dr__orb--3" />
      <div className="dr__orb dr__orb--4" />

      {/* Vignette overlay */}
      <div className="dr__vignette" />

      <div className="dr__display">
        {/* Colorful bloom behind die on result */}
        {rollCount > 0 && (
          <div key={`bloom-${rollCount}`} className="dr__bloom" />
        )}
        {/* Persistent glow pulse behind die */}
        <div className={`dr__result-glow${!rolling && history.length > 0 ? ' dr__result-glow--visible' : ''}`} />
        {/* Big result number — blooms behind die with bloom */}
        {rollCount > 0 && (
          <span
            key={`result-${rollCount}`}
            className="dr__result-text"
            style={{ color: accent, textShadow: `0 2px 20px ${accent}88, 0 0 40px ${accent}44` }}
          >
            {history[0].result}
          </span>
        )}
        {/* White wink sparkles on result */}
        {rollCount > 0 && [1,2,3,4,5,6].map(i => (
          <span key={`wink-${rollCount}-${i}`} className={`dr__wink dr__wink--${i}`} />
        ))}
        <span className="dr__twinkle dr__twinkle--tl" />
        <span className="dr__twinkle dr__twinkle--tr" />
        <span className="dr__twinkle dr__twinkle--bl" />
        <span className="dr__twinkle dr__twinkle--br" />
        <div className="dr__die-wrap">
          <DieComponent
            key={die}
            rolling={rolling}
            onResult={handleResult}
            onRollEnd={handleRollEnd}
            onClick={roll}
          />
          <div className="dr__die-shimmer" />
        </div>
        <span className={`dr__tap-prompt${!rolling ? ' dr__tap-prompt--visible' : ''}`}>
          Tap to roll
        </span>
      </div>

      <div className="dr__dice-row">
        {DICE.map(d => (
          <button
            key={d}
            className={`dr__die-btn${d === die ? ' dr__die-btn--active' : ''}`}
            onClick={() => setDie(d)}
            disabled={rolling}
          >
            d{d}
          </button>
        ))}
      </div>
    </div>
  );
}
