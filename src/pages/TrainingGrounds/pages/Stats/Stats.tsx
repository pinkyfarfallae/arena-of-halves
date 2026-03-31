import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { PRACTICE_STATES_DETAIL } from '../../../../data/practiceStates';
import { PRACTICE_STATES } from '../../../../constants/practiceStates';
import { hexToRgb } from '../../../../utils/color';
import { upgradeStat, refundStat, getUpgradeCost } from '../../../../services/training/upgradeStats';
import { fetchAllCharacters } from '../../../../data/characters';
import ChevronLeft from '../../../../icons/ChevronLeft';
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

const BG_ELEMENTS = (
  <>
    {/* Light rays */}
    <div className="training-stats__light-rays" />

    {/* Animated pattern */}
    <div className="training-stats__pattern" />

    {/* Floating dust */}
    <div className="training-stats__dust" />

    {/* Magical orbs */}
    <div className="training-stats__orbs">
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
      <div className="orb" />
    </div>

    {/* Header decorative elements */}
    <div className="training-stats__header-particles">
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
      <div className="particle" />
    </div>

    <div className="training-stats__header-sparkles">
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
      <div className="sparkle" />
    </div>

    <div className="training-stats__header-arcs">
      <div className="arc" />
      <div className="arc" />
      <div className="arc" />
    </div>

    {/* Floating crystals */}
    <div className="training-stats__crystals">
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
      <div className="crystal" />
    </div>

    {/* Ancient runes */}
    <div className="training-stats__runes">
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
      <div className="rune" />
    </div>

    {/* Energy pillars */}
    <div className="training-stats__pillars">
      <div className="pillar pillar--left" />
      <div className="pillar pillar--right" />
    </div>

    {/* Starfield */}
    <div className="training-stats__stars" />
    <div className="training-stats__stars training-stats__stars--mid" />
    <div className="training-stats__stars training-stats__stars--slow" />

    {/* Campfire embers */}
    <div className="training-stats__embers">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="training-stats__ember" />
      ))}
    </div>

    {/* Campfire glow */}
    <div className="training-stats__campfire" />

    {/* Mist layer */}
    <div className="training-stats__mist" />
    <div className="training-stats__mist training-stats__mist--reverse" />
  </>
);

export default function Stats({ onSelectTrainingWithAdminMode, onSelectPvPMode, onSelectRolePlaySubmission }: { onSelectTrainingWithAdminMode: () => void; onSelectPvPMode: () => void; onSelectRolePlaySubmission: () => void }) {
  const { user, updateUser } = useAuth();
  const { width } = useScreenSize();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [refunding, setRefunding] = useState<string | null>(null);

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
      alert('This stat is already at maximum level (5)');
      return;
    }

    if ((user.trainingPoints || 0) < cost) {
      alert(`Not enough training points. Need ${cost}, have ${user.trainingPoints || 0}`);
      return;
    }

    setUpgrading(statId);

    const result = await upgradeStat(user.characterId, statId, cost);

    if (result.error) {
      alert(`Error: ${result.error}`);
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

    setUpgrading(null);
  };

  const handleRefund = async (statId: string) => {
    if (!user?.characterId) return;

    const currentValue = getStatValue(statId);

    if (currentValue === 0) {
      alert('This stat is already at minimum level (0)');
      return;
    }

    if (!window.confirm(`Refund 1 level from ${PRACTICE_STATES_DETAIL.find(s => s.id === statId)?.name}? You will get 1 training point back.`)) {
      return;
    }

    setRefunding(statId);

    const result = await refundStat(user.characterId, statId);

    if (result.error) {
      alert(`Error: ${result.error}`);
      setRefunding(null);
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

    setRefunding(null);
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
            <div className="training-stats__header-refund-ticket">
              <span className="training-stats__header-refund-ticket-icon">
                <Refund />
              </span>
              <span className="training-stats__header-refund-ticket-text">
                <span className="label">Refunds</span>
                <span className="value">
                  5
                </span>
              </span>
            </div>
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
            const canRefund = value > 0;
            const isUpgrading = upgrading === stat.id;
            const isRefunding = refunding === stat.id;

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
                    disabled={!canUpgrade || isUpgrading || isRefunding}
                    style={{ borderColor: stat.color }}
                  >
                    Upgrade
                  </button>
                  <button
                    className="training-stats__card-refund"
                    onClick={() => handleRefund(stat.id)}
                    disabled={!canRefund || isUpgrading || isRefunding}
                    style={{ borderColor: stat.color }}
                  >
                    Refund
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
          <div className="training-stats__mode disabled" onClick={onSelectPvPMode}>
            PvP Mode
          </div>
          <div className="training-stats__mode training-stats__roleplay-submission" onClick={onSelectRolePlaySubmission}>
            Roleplay Submission
          </div>
        </div>
      </div>
    </div>
  );
}
