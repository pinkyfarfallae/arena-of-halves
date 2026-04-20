import React from "react";
import Drachma from "../../icons/Drachma";
import './DailyGift.scss';

interface DailyGiftProps {
  amount?: number;
  onClaim?: () => void;
}

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

export default function DailyGift({ amount, onClaim }: DailyGiftProps) {
  // Random Drachma amount 1 - 5 if not provided
  const drachmaAmount = typeof amount === 'number' ? amount : (Math.floor(Math.random() * 5) + 1) * 10;

  return (
    <div className="modal-overlay daily-gift" role="dialog" aria-modal="true">
      {/* SVG filter for wavy ring effect */}
      <svg className="daily-gift__svg" aria-hidden>
        <defs>
          <filter id="daily-gift-wavy">
            <feTurbulence baseFrequency="0.01" numOctaves="2" />
            <feDisplacementMap in="SourceGraphic" scale="3" />
          </filter>
        </defs>
      </svg>

      {/* Animated golden rings */}
      <div className="daily-gift__circle" aria-hidden />

      {/* Flash burst effect */}
      <div className="daily-gift__flash" aria-hidden />

      {/* Content card */}
      <div className="daily-gift__card">
        <div className="daily-gift__spotlight" aria-hidden />

        <Drachma />
        <h3 className="daily-gift__title">Divine Gift!</h3>
        <p className="daily-gift__amount">{drachmaAmount} Drachmas</p>

        {/* Rising ember particles */}
        <div className="daily-gift__embers" aria-hidden>
          {Array.from({ length: 16 }).map((_, i) => {
            const isFalling = i % 4 === 0;
            const left = (i * 6.25 + (i % 3) * 2) % 95 + 2.5;
            const size = 4 + (i % 4) * 2;
            const delay = i * 180;
            const duration = 3000 + (i % 5) * 600;

            return (
              <span
                key={i}
                className={`daily-gift__ember ${isFalling ? 'daily-gift__ember--falling' : ''}`}
                style={{
                  left: `${left}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  animationDelay: `${delay}ms, ${delay + 200}ms`,
                  animationDuration: `${duration}ms, 2400ms`
                }}
              />
            );
          })}
        </div>

        <button
          className="daily-gift__claim-btn"
          onClick={onClaim}
          aria-label={`Claim ${drachmaAmount} drachmas`}
        >
          Claim Your Daily Gift
        </button>
      </div>

      <div className="training-stats__upgrade-overlay-embers" aria-hidden="true">
        {emberParticles.map((ember, index) => (
          <span
            key={`refund-rise-${index}`}
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
            key={`refund-fall-${index}`}
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
    </div>
  );
}