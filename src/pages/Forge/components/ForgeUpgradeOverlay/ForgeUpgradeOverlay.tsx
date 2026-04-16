import './ForgeUpgradeOverlay.scss';

// Generate fire ember particles
const emberParticles = Array.from({ length: 48 }, () => {
  const rand = (min: number, max: number) => Math.random() * (max - min) + min;

  return {
    left: `${rand(0, 100)}%`,
    bottom: `${rand(-20, 0)}px`,
    size: `${rand(1.5, 5)}px`,
    delay: `${rand(0, 2)}s`,
    duration: `${rand(3.5, 6)}s`,
    opacity: rand(0.3, 0.8),
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

interface ForgeUpgradeOverlayProps {
  visible: boolean;
  equipmentName: string;
  isGuaranteed: boolean;
  isSuccess: boolean;
  isProcessing: boolean;
  showingImpact: boolean;
}

const ForgeUpgradeOverlay: React.FC<ForgeUpgradeOverlayProps> = ({
  visible,
  equipmentName,
  isGuaranteed,
  isSuccess,
  isProcessing,
  showingImpact
}) => {
  const getStateClass = () => {
    if (showingImpact) {
      return isSuccess ? 'forge-upgrade-overlay--impact-success' : 'forge-upgrade-overlay--impact-failure';
    }
    if (!isProcessing) {
      return isSuccess ? 'forge-upgrade-overlay--success' : 'forge-upgrade-overlay--failure';
    }
    return '';
  };

  return (
    <div className={`forge-upgrade-overlay ${visible ? 'forge-upgrade-overlay--visible' : ''} ${getStateClass()}`}>
      <div className="forge-upgrade-overlay__embers" aria-hidden="true">
        {emberParticles.map((ember, index) => (
          <span
            key={index}
            className="forge-upgrade-overlay__ember"
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
            className="forge-upgrade-overlay__ember forge-upgrade-overlay__ember--falling"
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

      <div className="forge-upgrade-overlay__loader">
        <div className="forge-upgrade-overlay__loader-square"></div>
        <div className="forge-upgrade-overlay__loader-square"></div>
        <div className="forge-upgrade-overlay__loader-square"></div>
        <div className="forge-upgrade-overlay__loader-square"></div>
      </div>

      <div className="forge-upgrade-overlay__circle"></div>
      <div className="forge-upgrade-overlay__circle"></div>

      {showingImpact && (
        <div className="forge-upgrade-overlay__impact-flash"></div>
      )}

      <div className="forge-upgrade-overlay__content">
        {showingImpact || !isProcessing ? (
          <>
            <h2 className="forge-upgrade-overlay__title">
              {isSuccess ? 'Success' : 'Failed'}
            </h2>
          </>
        ) : (
          <>
            <h2 className="forge-upgrade-overlay__title">Upgrading...</h2>
            <p className="forge-upgrade-overlay__subtitle">
              {isGuaranteed ? 'Guaranteed upgrade with enhancement tickets' : 'Testing fate with the flames'}
            </p>
            <p className="forge-upgrade-overlay__equipment">{equipmentName}</p>
          </>
        )}
      </div>

      <svg className="forge-upgrade-overlay__svg">
        <filter id="wavy">
          <feTurbulence x="0" y="0" baseFrequency="0.009" numOctaves="5" seed="2">
            <animate
              attributeName="baseFrequency"
              dur="60s"
              values="0.02;0.005;0.02"
              repeatCount="indefinite"
            />
          </feTurbulence>
          <feDisplacementMap in="SourceGraphic" scale="30" />
        </filter>
      </svg>
    </div>
  );
};

export default ForgeUpgradeOverlay;
