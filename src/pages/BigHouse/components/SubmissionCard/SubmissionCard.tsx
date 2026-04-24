import React, { useMemo } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import { LANGUAGE } from '../../../../constants/language';
import Trophy from '../../../../icons/Trophy';
import Warning from '../../../../icons/Warning';
import Pending from './icons/Pending';
import OpenLink from './icons/OpenLink';
import TweetPreview from '../../../../components/TweetPreview/TweetPreview';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { TrainingTask } from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import { useAuth } from '../../../../hooks/useAuth';
import { hexToRgb } from '../../../../utils/color';
import RolePlayers from './icons/RolePlayers';
import Swords from '../../../../icons/Swords';
import HeartBroken from './icons/HeartBroken';
import './SubmissionCard.scss';
import { BigHouseSubmission } from '../../../../types/bigHouse';
import { BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS } from '../../../../constants/bigHouse';

export default function SubmissionCard({ submission, focused, onClick, disabled, forcedCompact }: { submission: BigHouseSubmission, focused?: boolean, onClick?: () => void, disabled?: boolean, forcedCompact?: boolean }) {
  const { user } = useAuth();
  const { t, lang } = useTranslation();
  const { width } = useScreenSize();

  const date = new Date(submission.submittedAt)
    .toLocaleDateString(
      lang === LANGUAGE.ENGLISH ?
        'en-US' : 'th-TH', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });

  const handleLinkClick = () => {
    window.open(submission.roleplayUrl, '_blank', 'noopener,noreferrer');
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
      key={submission.id}
      className={`big-house__submission-card big-house__submission-card--${submission.status.toLowerCase()} ${forcedCompact ? 'big-house__submission-card--compact' : ''} ${focused ? 'big-house__submission-card--focused' : ''} ${onClick ? 'canClick' : ''} ${!!onClick && disabled ? 'disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
      style={{
        ...colorStyle,
        ...(!!onClick && !disabled ? { cursor: "pointer" } : undefined),
        ...((submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING && ((!submission.roleplayUrl || submission.roleplayUrl.trim() === ''))) ? { height: '142px' } : undefined)
      }}
    >
      <div className="big-house__submission-card-top">
        <div className="big-house__submission-card-header">
          <span>{t(T.BIG_HOUSE_SUBMISSION_ON)} {date}</span>
        </div>

        <span
          className="big-house__submission-card-link-btn-wrapper"
          data-tooltip={"Open"}
          data-tooltip-pos="left"
        >
          <button
            className={`big-house__submission-card-link-btn ${!submission.roleplayUrl ? 'hidden' : ''}`}
            onClick={handleLinkClick}
          >
            <OpenLink />
          </button>
        </span>
      </div>

      <div
        className="big-house__submission-card-preview"
        style={
          (submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING && (!submission.roleplayUrl || submission.roleplayUrl.trim() === ''))
            ? { height: '65px' }
            : undefined}
      >
        {submission.roleplayUrl && submission.roleplayUrl.trim() !== '' && (
          <span className={`big-house__submission-card-preview-inner big-house__submission-card-preview-inner--${submission.status.toLowerCase()}`}>
            {submission.roleplayUrl ? (
              <TweetPreview url={submission.roleplayUrl} scale={(width > 460 && !forcedCompact) ? 0.85 : 0.52} className="big-house__submission-card-preview-block" />
            ) : (
              null
            )}
          </span>
        )}

        {/* {submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.APPROVED && (
          <div className="big-house__submission-card-details">
            <div className="big-house__submission-card-stats">
              <div className="big-house__submission-card__stat-item">
                <Swords width={18} height={18} style={{ marginTop: 2 }} />
                <span className="big-house__submission-card__stat-value"><b>mode</b></span>
                <span className="big-house__submission-card-stat-label">{submission.mode}</span>
              </div>

              <div className="big-house__submission-card__stat-item big-house__submission-card__stat-item--compact">
                {submission.success ? <Trophy width={12} height={12} /> : <HeartBroken width={12} height={12} />}
                <span className="big-house__submission-card__stat-value"><b>result</b></span>
                <span className="big-house__submission-card-stat-label">{submission.success ? 'success' : 'failed'}</span>
              </div>

              <div className="big-house__submission-card__stat-item big-house__submission-card__stat-item--compact">
                <RolePlayers />
                <span className="big-house__submission-card__stat-value"><b>trainee</b></span>
                <span className="big-house__submission-card-stat-label">{submission.characterId}</span>
              </div>
            </div>
          </div>
        )} */}

        {submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.REJECTED && (
          <div className="big-house__submission-card-error-wrapper">
            <div className="big-house__submission-card-error">
              <Warning />
              <span>rejected</span>
            </div>
          </div>
        )}

        {submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING && (
          <div
            className="big-house__submission-card-pending-wrapper"
            style={(!submission.roleplayUrl || submission.roleplayUrl.trim() === '') ? { maxHeight: '30px' } : undefined}
          >
            <div className="big-house__submission-card-pending">
              <Pending />
              <span>pending...</span>
            </div>
            {submission.roleplayUrl && submission.roleplayUrl.trim() !== '' && (
              <div className="big-house__submission-card-submitted-at">
                {width > 375 && <b>trained </b>}
                <span>{date}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {(submission.status === TRAINING_POINT_REQUEST_STATUS.PENDING && submission.characterId && (!submission.roleplayUrl || submission.roleplayUrl.trim() === '')) && (
        <div className="big-house__submission-card-bottom">
          <b>submitted by</b>
          <span>{submission.characterId}</span>
        </div>
      )}
    </div>
  );
};