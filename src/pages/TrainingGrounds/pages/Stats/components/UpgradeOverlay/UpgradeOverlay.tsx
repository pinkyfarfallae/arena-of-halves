import { hexToRgb } from "../../../../../../utils/color";
import { PRACTICE_STATS } from "../../../../../../constants/practice";
import "./UpgradeOverlay.scss";

const emberParticles = Array.from({ length: 48 }, () => {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  return {
    left: `${rand(0, 100)}%`,
    bottom: `${rand(-20, 0)}px`,
    size: `${rand(1.5, 5)}px`,
    delay: `${rand(0, 2)}s`,
    duration: `${rand(3.5, 6)}s`,
    opacity: rand(0.3, 0.8),
    drift: `${rand(-30, 30)}px`,
  };
});

const fallingEmberParticles = Array.from({ length: 36 }, (_, index) => {
  const left = (index * 8.8 + (index % 4) * 3.5) % 100;
  const delay = (index % 9) * 0.22 + Math.floor(index / 9) * 0.12;
  const duration = 5.2 + (index % 5) * 0.3;
  const size = 2 + (index % 4);
  const top = -12 + (index % 6) * 2;

  return {
    left: `${left}%`,
    top: `${top}px`,
    size: `${size}px`,
    delay: `${delay}s`,
    duration: `${duration}s`,
    opacity: 0.3 + (index % 4) * 0.12,
  };
});

interface UpgradeOverlayProps {
  visible: boolean;
  activeUpgradeStat: { name: string; color: string } | null | undefined;
  defaultColor: string;
  statId: string | null;
  statIcons: Record<string, string>;
}

export const UpgradeOverlay = ({ visible, activeUpgradeStat, defaultColor, statId, statIcons }: UpgradeOverlayProps) => {
  return (
    <div
      className={`training-stats__upgrade-overlay ${visible ? 'training-stats__upgrade-overlay--visible' : 'training-stats__upgrade-overlay--hidden'}`}
      role="status"
      aria-live="polite"
      aria-label="Upgrading stat"
      style={{
        '--overlay-stat-rgb': hexToRgb(activeUpgradeStat?.color || defaultColor || '#C0A062'),
      } as React.CSSProperties}
    >
      <div className="training-stats__upgrade-overlay-embers" aria-hidden="true">
        {emberParticles.map((ember, index) => (
          <span
            key={index}
            className="training-stats__upgrade-overlay-ember"
            style={{
              left: ember.left,
              bottom: ember.bottom,
              width: ember.size,
              height: ember.size,
              animationDelay: ember.delay,
              animationDuration: ember.duration,
              opacity: ember.opacity,
            }}
          />
        ))}
        {fallingEmberParticles.map((ember, index) => (
          <span
            key={`falling-${index}`}
            className="training-stats__upgrade-overlay-ember training-stats__upgrade-overlay-ember--falling"
            style={{
              left: ember.left,
              top: ember.top,
              width: ember.size,
              height: ember.size,
              animationDelay: ember.delay,
              animationDuration: ember.duration,
              opacity: ember.opacity,
            }}
          />
        ))}
      </div>
      <div className="training-stats__upgrade-overlay-card">
        <div className="training-stats__upgrade-overlay-icon">
          <img src={statIcons[statId || PRACTICE_STATS.STRENGTH]} alt="" aria-hidden="true" />
        </div>
        <div className="training-stats__upgrade-overlay-text">
          <span className="training-stats__upgrade-overlay-title">
            Upgrading {activeUpgradeStat?.name || 'Strength'}
          </span>
          <span className="training-stats__upgrade-overlay-subtitle">
            {(activeUpgradeStat?.name || 'Strength')} is rising through the camp...
          </span>
        </div>
      </div>
    </div>
  );
};