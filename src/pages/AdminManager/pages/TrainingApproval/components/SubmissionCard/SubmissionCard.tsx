import React, { useMemo } from 'react';
import { useTranslation } from '../../../../../../hooks/useTranslation';
import { T } from '../../../../../../constants/translationKeys';
import { LANGUAGE } from '../../../../../../constants/language';
import Trophy from '../../../../../../icons/Trophy';
import Warning from '../../../../../../icons/Warning';
import Pending from './icons/Pending';
import OpenLink from './icons/OpenLink';
import TweetPreview from '../../../../../../components/TweetPreview/TweetPreview';
import { useScreenSize } from '../../../../../../hooks/useScreenSize';
import { TrainingTask } from '../../../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../../../constants/trainingPointRequestStatus';
import { useAuth } from '../../../../../../hooks/useAuth';
import { hexToRgb } from '../../../../../../utils/color';
import RolePlayers from './icons/RolePlayers';
import Swords from '../../../../../../icons/Swords';
import HeartBroken from './icons/HeartBroken';
import { formatAppDate } from '../../../../../../utils/date';
import './SubmissionCard.scss';

export default function SubmissionCard({ task, focused, onClick, disabled, forcedCompact }: { task: TrainingTask, focused?: boolean, onClick?: () => void, disabled?: boolean, forcedCompact?: boolean }) {
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const { width } = useScreenSize();

  const date = formatAppDate(
    task.date,
    lang === LANGUAGE.ENGLISH ? 'en-US' : 'th-TH'
  );

  const handleLinkClick = () => {
    window.open(task.roleplay, '_blank', 'noopener,noreferrer');
  };

  const colorStyle = useMemo(() => {
    return {
      '--primary-color': user?.theme[0] || '#C0A062',
      '--primary-color-rgb': hexToRgb(user?.theme[0] || '#C0A062'),
      '--dark-color': user?.theme[1] || '#2c2c2c',
      '--dark-color-rgb': hexToRgb(user?.theme[1] || '#2c2c2c'),
      '--light-color': user?.theme[2] || '#f5f5f5',
      '--surface-hover': user?.theme[11] || '#e8e8e8',
      '--overlay-text': user?.theme[17] || '#333333',
      '--accent-dark': user?.theme[19] || '#0f1a2e',
      '--accent-dark-rgb': hexToRgb(user?.theme[19] || '#0f1a2e'),
    } as React.CSSProperties;
  }, [user?.theme, user?.characterId]);

  return (
    <div
      key={task.id}
      className={`training-approval__submission-card training-approval__submission-card--${task.verified.toLowerCase()} ${forcedCompact ? 'training-approval__submission-card--compact' : ''} ${focused ? 'training-approval__submission-card--focused' : ''} ${onClick ? 'canClick' : ''} ${!!onClick && disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{
        ...colorStyle,
        ...(!!onClick && !disabled ? { cursor: "pointer" } : undefined),
        ...((task.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && ((!task.roleplay || task.roleplay.trim() === ''))) ? { height: '142px' } : undefined)
      }}
    >
      <div className="training-approval__submission-card-top">
        <div className="training-approval__submission-card-header">
          <span>{t(T.TRAINING_REPORT_FOR)} {date}</span>
        </div>

        <span
          className="training-approval__submission-card-link-btn-wrapper"
          data-tooltip={"Open"}
          data-tooltip-pos="left"
        >
          <button
            className={`training-approval__submission-card-link-btn ${!task.roleplay ? 'hidden' : ''}`}
            onClick={handleLinkClick}
          >
            <OpenLink />
          </button>
        </span>
      </div>

      <div
        className="training-approval__submission-card-preview"
        style={
          (task.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && (!task.roleplay || task.roleplay.trim() === ''))
            ? { height: '65px' }
            : undefined}
      >
        {task.roleplay && task.roleplay.trim() !== '' && (
          <span className={`training-approval__submission-card-preview-inner training-approval__submission-card-preview-inner--${task.verified.toLowerCase()}`}>
            {task.roleplay ? (
              <TweetPreview url={task.roleplay} scale={(width > 460 && !forcedCompact) ? 0.85 : 0.52} className="training-approval__submission-card-preview-block" />
            ) : (
              null
            )}
          </span>
        )}

        {task.verified === TRAINING_POINT_REQUEST_STATUS.APPROVED && (
          <div className="training-approval__submission-card-details">
            <div className="training-approval__submission-card-stats">
              <div className="training-approval__submission-card__stat-item">
                <Swords width={18} height={18} style={{ marginTop: 2 }} />
                <span className="training-approval__submission-card__stat-value"><b>mode</b></span>
                <span className="training-approval__submission-card-stat-label">{task.mode}</span>
              </div>

              <div className="training-approval__submission-card__stat-item training-approval__submission-card__stat-item--compact">
                {task.success ? <Trophy width={12} height={12} /> : <HeartBroken width={12} height={12} />}
                <span className="training-approval__submission-card__stat-value"><b>result</b></span>
                <span className="training-approval__submission-card-stat-label">{task.success ? 'success' : 'failed'}</span>
              </div>

              <div className="training-approval__submission-card__stat-item training-approval__submission-card__stat-item--compact">
                <RolePlayers />
                <span className="training-approval__submission-card__stat-value"><b>trainee</b></span>
                <span className="training-approval__submission-card-stat-label">{task.userId}</span>
              </div>
            </div>
          </div>
        )}

        {task.verified === TRAINING_POINT_REQUEST_STATUS.REJECTED && (
          <div className="training-approval__submission-card-error-wrapper">
            <div className="training-approval__submission-card-error">
              <Warning />
              <span>rejected</span>
            </div>
          </div>
        )}

        {task.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && (
          <div
            className="training-approval__submission-card-pending-wrapper"
            style={(!task.roleplay || task.roleplay.trim() === '') ? { maxHeight: '30px' } : undefined}
          >
            <div className="training-approval__submission-card-pending">
              <Pending />
              <span>pending...</span>
            </div>
            {task.roleplay && task.roleplay.trim() !== '' && (
              <div className="training-approval__submission-card-submitted-at">
                {width > 375 && <b>trained </b>}
                <span>{date}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {(task.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && task.userId && (!task.roleplay || task.roleplay.trim() === '')) && (
        <div className="training-approval__submission-card-bottom">
          <b>Trainee</b>
          <span>{task.userId}</span>
        </div>
      )}
    </div>
  );
};