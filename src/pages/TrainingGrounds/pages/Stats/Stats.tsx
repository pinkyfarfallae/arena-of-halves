import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { PRACTICE_STATES_DETAIL } from '../../../../data/practiceStates';
import { PRACTICE_STATES } from '../../../../constants/practiceStates';
import { hexToRgb } from '../../../../utils/color';
import { upgradeStat, getUpgradeCost } from '../../../../services/training/upgradeStats';
import { fetchAllCharacters } from '../../../../data/characters';
import ChevronLeft from '../../../../icons/ChevronLeft';
import ConfirmModal from '../../../../components/ConfirmModal/ConfirmModal';
import './Stats.scss';
import TrainingPoint from './icons/TrainingPoint';
import Refund from './icons/Refund';
import strengthBg from './images/card/strength.png';
import mobilityBg from './images/card/mobility.png';
import intelligenceBg from './images/card/intelligence.png';
import techniqueBg from './images/card/technique.png';
import experienceBg from './images/card/experience.png';
import fortuneBg from './images/card/fortune.png';
import strengthIcon from './images/icons/strength.png';
import mobilityIcon from './images/icons/mobility.png';
import intelligenceIcon from './images/icons/intelligence.png';
import techniqueIcon from './images/icons/technique.png';
import experienceIcon from './images/icons/experience.png';
import fortuneIcon from './images/icons/fortune.png';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { BG_ELEMENTS } from '../../components/Background/Background';

const statBackgrounds: Record<string, string> = {
  strength: strengthBg,
  mobility: mobilityBg,
  intelligence: intelligenceBg,
  technique: techniqueBg,
  experience: experienceBg,
  fortune: fortuneBg,
};

const statIcons: Record<string, string> = {
  strength: strengthIcon,
  mobility: mobilityIcon,
  intelligence: intelligenceIcon,
  technique: techniqueIcon,
  experience: experienceIcon,
  fortune: fortuneIcon,
};

export default function Stats({ onSelectTrainingWithAdminMode, onSelectPvPMode, onSelectRolePlaySubmission }: { onSelectTrainingWithAdminMode: () => void; onSelectPvPMode: () => void; onSelectRolePlaySubmission: () => void }) {
  const { user, updateUser } = useAuth();
  const { width } = useScreenSize();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [isUpgradeOverlayVisible, setIsUpgradeOverlayVisible] = useState(false);
  const [showRefundConfirm, setShowRefundConfirm] = useState(false);
  const [noticeModal, setNoticeModal] = useState<{ title: string; message: string } | null>(null);
  const refundTicketCount = 1; // Mock for now. Replace with real ticket data later.
  const MIN_UPGRADE_OVERLAY_MS = 3000;
  const UPGRADE_FADE_MS = 280;
  const showUpgradeOverlay = upgrading !== null;
  const upgradeOverlayVisible = isUpgradeOverlayVisible;

  const activeUpgradeStat = upgrading
    ? PRACTICE_STATES_DETAIL.find((stat) => stat.id === upgrading)
    : null;
  const emberParticles = Array.from({ length: 30 }, (_, index) => {
    const left = (index * 7.5 + (index % 3) * 4.25) % 100;
    const delay = (index % 10) * 0.24 + Math.floor(index / 10) * 0.16;
    const duration = 5.2 + (index % 6) * 0.42;
    const size = 2 + (index % 5);
    const bottom = -18 + (index % 6) * 3;

    return {
      left: `${left}%`,
      bottom: `${bottom}px`,
      size: `${size}px`,
      delay: `${delay}s`,
      duration: `${duration}s`,
      opacity: 0.28 + (index % 5) * 0.12,
    };
  });
  const fallingEmberParticles = Array.from({ length: 24 }, (_, index) => {
    const left = (index * 8.8 + (index % 4) * 3.5) % 100;
    const delay = (index % 8) * 0.3 + Math.floor(index / 8) * 0.14;
    const duration = 5.6 + (index % 5) * 0.38;
    const size = 2 + (index % 4);
    const top = -12 + (index % 6) * 2;

    return {
      left: `${left}%`,
      top: `${top}px`,
      size: `${size}px`,
      delay: `${delay}s`,
      duration: `${duration}s`,
      opacity: 0.24 + (index % 4) * 0.12,
    };
  });

  const getStatValue = (id: string) => {
    if (!user) return 0;
    switch (id) {
      case PRACTICE_STATES.STRENGTH:
        return user.strength || 0;
      case PRACTICE_STATES.MOBILITY:
        return user.mobility || 0;
      case PRACTICE_STATES.INTELLIGENCE:
        return user.intelligence || 0;
      case PRACTICE_STATES.TECHNIQUE:
        return user.technique || 0;
      case PRACTICE_STATES.EXPERIENCE:
        return user.experience || 0;
      case PRACTICE_STATES.FORTUNE:
        return user.fortune || 0;
      default:
        return 0;
    }
  };

  const handleUpgrade = async (statId: string) => {
    if (!user?.characterId) return;

    const currentValue = getStatValue(statId);
    const cost = getUpgradeCost(currentValue);

    if (cost === 0) {
      setNoticeModal({
        title: 'Stat Maxed',
        message: 'This stat is already at maximum level (5).',
      });
      return;
    }

    if ((user.trainingPoints || 0) < cost) {
      setNoticeModal({
        title: 'Not Enough Training Points',
        message: `Need ${cost} training points, but you only have ${user.trainingPoints || 0}.`,
      });
      return;
    }

    setUpgrading(statId);
    setIsUpgradeOverlayVisible(true);
    const startedAt = Date.now();

    const result = await upgradeStat(user.characterId, statId, cost);

    if (result.error) {
      setNoticeModal({
        title: 'Upgrade Failed',
        message: `Error: ${result.error}`,
      });
      const elapsed = Date.now() - startedAt;
      if (elapsed < MIN_UPGRADE_OVERLAY_MS) {
        await new Promise((resolve) => setTimeout(resolve, MIN_UPGRADE_OVERLAY_MS - elapsed));
      }
      setIsUpgradeOverlayVisible(false);
      await new Promise((resolve) => setTimeout(resolve, UPGRADE_FADE_MS));
      setUpgrading(null);
      return;
    }

    if (result.success) {
      // Refresh character data
      const characters = await fetchAllCharacters();
      const updated = characters.find(c => c.characterId === user.characterId);
      if (updated) {
        updateUser(updated);
      }
    }

    const elapsed = Date.now() - startedAt;
    if (elapsed < MIN_UPGRADE_OVERLAY_MS) {
      await new Promise((resolve) => setTimeout(resolve, MIN_UPGRADE_OVERLAY_MS - elapsed));
    }

    setIsUpgradeOverlayVisible(false);
    await new Promise((resolve) => setTimeout(resolve, UPGRADE_FADE_MS));
    setUpgrading(null);
  };

  const handleOpenRefundModal = () => {
    if (!user) return;
    if (refundTicketCount <= 0) return;
    setShowRefundConfirm(true);
  };

  const handleConfirmRefundAllStats = () => {
    if (!user) return;

    const statIds = PRACTICE_STATES_DETAIL.map((stat) => stat.id);
    const totalRefundPoints = statIds.reduce((sum, statId) => sum + getStatValue(statId), 0);

    if (totalRefundPoints <= 0) {
      setShowRefundConfirm(false);
      setNoticeModal({
        title: 'Nothing To Refund',
        message: 'There are no stat points to refund.',
      });
      return;
    }

    updateUser({
      strength: 0,
      mobility: 0,
      intelligence: 0,
      technique: 0,
      experience: 0,
      fortune: 0,
      trainingPoints: (user.trainingPoints || 0) + totalRefundPoints,
    });

    setShowRefundConfirm(false);
  };

  return (
    <div
      className="training-stats"
      style={{
        '--primary-color': user?.theme[0] || '#C0A062',
        '--primary-color-rgb': hexToRgb(user?.theme[0] || '#C0A062'),
        '--dark-color': user?.theme[1] || '#2c2c2c',
        '--dark-color-rgb': hexToRgb(user?.theme[1] || '#2c2c2c'),
        '--light-color': user?.theme[2] || '#f5f5f5',
        '--surface-hover': user?.theme[11] || '#e8e8e8',
        '--overlay-text': user?.theme[17] || '#333333',
        '--accent-dark': user?.theme[19] || '#0f1a2e',
      } as React.CSSProperties}
    >
      {BG_ELEMENTS}

      <div className="training-stats__container">
        <div className="training-stats__header">
          {/* Decorative corner ornaments */}
          <div className="training-stats__header-ornament training-stats__header-ornament--top-left" />
          <div className="training-stats__header-ornament training-stats__header-ornament--top-right" />

          <Link to="/life" className="training-stats__header-back">
            <ChevronLeft width={14} height={14} />
            Back
          </Link>
          <div className="training-stats__header-title">Stats</div>
          <div className="training-stats__header-points-container">
            <button
              type="button"
              className="training-stats__header-refund-ticket"
              onClick={handleOpenRefundModal}
              disabled={refundTicketCount <= 0}
              data-tooltip={refundTicketCount <= 0 ? 'No refund ticket available' : 'Refund all stats'}
              data-tooltip-pos="bottom"
            >
              <span className="training-stats__header-refund-ticket-icon">
                <Refund />
              </span>
              <span className="training-stats__header-refund-ticket-text">
                <span className="label">Refunds</span>
              </span>
            </button>
            <div className="training-stats__header-points">
              <span className="training-stats__header-points-icon">
                <TrainingPoint />
              </span>
              <span className="training-stats__header-points-text">
                <span className="label">Points</span>
                <span className="value">
                  {user?.trainingPoints || 0}
                  <span>TP</span>
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="training-stats__grid">
          {width < 460 && (
            <div
              key="dummy-1"
              className="training-stats__card"
              style={{ width: `${width / 6}px`, minWidth: `${width / 6}px` }}
            />
          )}
          {PRACTICE_STATES_DETAIL.map((stat) => {
            const value = getStatValue(stat.id);
            const maxValue = 5;
            const cost = getUpgradeCost(value);
            const canUpgrade = cost > 0 && (user?.trainingPoints || 0) >= cost;
            const isUpgrading = upgrading === stat.id;

            return (
              <div
                key={stat.id}
                className="training-stats__card"
                style={{
                  '--card-background': `url(${statBackgrounds[stat.id]})`,
                  '--stat-color': stat.color,
                } as React.CSSProperties}
              >
                <div className="training-stats__card-header-icon" style={{ color: stat.color }}>
                  <img src={statIcons[stat.id]} alt={stat.name} />
                </div>
                <div className="training-stats__card-icon" style={{ backgroundColor: stat.color }}>
                  <div className="training-stats__card-hexagon" />
                </div>
                <div className="training-stats__card-name">{stat.name}</div>
                <div className="training-stats__card-value">{value} / {maxValue}</div>
                <div className="training-stats__card-progress">
                  {Array.from({ length: maxValue }).map((_, index) => (
                    <React.Fragment key={index}>
                      <span
                        className={`training-stats__card-progress-dot ${value >= index + 1 ? 'active' : ''}`}
                      />
                      {index < maxValue - 1 && (
                        <span
                          className={`training-stats__card-progress-dot-connector ${value >= index + 2 ? 'active' : ''}`}
                        />
                      )}
                    </React.Fragment>
                  ))}
                </div>
                <div className="training-stats__card-actions">
                  <button
                    className="training-stats__card-upgrade"
                    onClick={() => handleUpgrade(stat.id)}
                    disabled={!canUpgrade || isUpgrading}
                    style={{ borderColor: stat.color }}
                  >
                    Upgrade
                  </button>
                </div>
              </div>
            );
          })}
          {width < 460 && (
            <div
              key="dummy-2"
              className="training-stats__card"
              style={{ width: `${width / 6}px`, minWidth: `${width / 6}px` }}
            />
          )}
        </div>

        <div className="training-stats__modes">
          <div className="training-stats__mode" onClick={onSelectTrainingWithAdminMode}>
            Normal Mode
          </div>
          <div className="training-stats__mode" onClick={onSelectPvPMode}>
            PvP Mode
          </div>
          <div className="training-stats__mode training-stats__roleplay-submission" onClick={onSelectRolePlaySubmission}>
            Roleplay Submission
          </div>
        </div>
      </div>

      {showUpgradeOverlay && (
        <div
          className={`training-stats__upgrade-overlay ${upgradeOverlayVisible ? 'training-stats__upgrade-overlay--visible' : 'training-stats__upgrade-overlay--hidden'}`}
          role="status"
          aria-live="polite"
          aria-label="Upgrading stat"
          style={{
            '--overlay-stat-rgb': hexToRgb(activeUpgradeStat?.color || user?.theme[0] || '#C0A062'),
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
              <img src={statIcons[upgrading || PRACTICE_STATES.STRENGTH]} alt="" aria-hidden="true" />
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
      )}

      {showRefundConfirm && (
        <ConfirmModal
          title="Refund All Stats?"
          message="This will reset all of your stats to 0 and return the spent training points to your account."
          confirmLabel="Refund"
          cancelLabel="Cancel"
          danger
          onConfirm={handleConfirmRefundAllStats}
          onCancel={() => setShowRefundConfirm(false)}
        />
      )}

      {noticeModal && (
        <div className="training-stats__notice-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="training-stats-notice-title">
          <div className="training-stats__notice-modal">
            <h3 id="training-stats-notice-title" className="training-stats__notice-modal-title">
              {noticeModal.title}
            </h3>
            <p className="training-stats__notice-modal-message">{noticeModal.message}</p>
            <button
              type="button"
              className="training-stats__notice-modal-button"
              onClick={() => setNoticeModal(null)}
            >
              OK
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
