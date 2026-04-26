import React, { use, useMemo, useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import { LANGUAGE } from '../../../../constants/language';
import Trophy from '../../../../icons/Trophy';
import Warning from '../../../../icons/Warning';
import Pending from './icons/Pending';
import OpenLink from './icons/OpenLink';
import TweetPreview from '../../../../components/TweetPreview/TweetPreview';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import { useAuth } from '../../../../hooks/useAuth';
import { hexToRgb } from '../../../../utils/color';
import RolePlayers from './icons/RolePlayers';
import Swords from '../../../../icons/Swords';
import { BigHouseSubmission } from '../../../../types/bigHouse';
import { BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS } from '../../../../constants/bigHouse';
import './SubmissionCard.scss';
import Characters from './icons/Characters';
import Drachma from '../../../../icons/Drachma';
import HarvestorChip from '../../../StrawberryFields/components/HarvestRecordCard/components/HarvestorChip/HarvestorChip';
import { Character } from '../../../../data/characters';

export default function SubmissionCard({ isAdmin = false, submission, characters, focused, onClick, disabled, forcedCompact }: { isAdmin?: boolean, submission: BigHouseSubmission, characters: Character[], focused?: boolean, onClick?: () => void, disabled?: boolean, forcedCompact?: boolean }) {
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

  const reward = useMemo(() => {
    if (submission.status !== BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.APPROVED) return null;
    // console.log(submission.drachmaReward, typeof submission.drachmaReward);
    if (isAdmin) {
      const rewards: Record<string, number> = JSON.parse(
        submission.drachmaReward as string || '{}'
      );

      return Object.values(rewards).reduce((sum, val) => sum + val, 0);
    }
    const jsonFormat = typeof submission.drachmaReward === 'string' ? (() => {
      try {
        return JSON.parse(submission.drachmaReward);
      } catch {
        return null;
      }
    })() : null;

    return jsonFormat ? jsonFormat[user?.characterId ?? 'default'] : submission.drachmaReward;
  }, [submission, user?.characterId, isAdmin]);

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

        {submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.APPROVED && (
          <div className="big-house__submission-card-details">
            <div className="big-house__submission-card-stats">
              <div className="big-house__submission-card__stat-item">
                <Characters width={18} height={18} style={{ marginTop: 2 }} />
                <span className="big-house__submission-card__stat-value"><b>count</b></span>
                <span className="big-house__submission-card-stat-label">{submission.charCount?.toLocaleString() ?? '-'}</span>
              </div>

              <div className="big-house__submission-card__stat-item big-house__submission-card__stat-item--compact">
                <Drachma />
                <span className="big-house__submission-card__stat-value"><b>reward</b></span>
                <span className="big-house__submission-card-stat-label">{reward}</span>
              </div>

              <div className="big-house__submission-card__stat-item big-house__submission-card__stat-item--compact">
                <RolePlayers />
                <span className="big-house__submission-card__stat-value"><b>player{submission.roleplayers ? 's' : ''}</b></span>
                <span className="big-house__submission-card-stat-label">{submission.roleplayers ? submission.roleplayers.split(',').length : '1'}</span>
              </div>
            </div>
          </div>
        )}

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
                {width > 375 && <b>submitted </b>}
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

      {(submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.REJECTED || submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING) && submission.rejectReason && (
        <div className={`big-house__submission-card-reason big-house__submission-card-reason--${submission.status.toLowerCase()}`}>
          <b>{submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.REJECTED ? 'rejected' : 'pending review'}</b>
          <span>: {submission.rejectReason}</span>
        </div>
      )}

      {(submission.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.APPROVED && submission.roleplayers) && (
        <div className="big-house__submission-card-roleplayers-wrapper">
          {submission.roleplayers.split(',').slice(0, 8).map(rp => {
            const rpCharacter = characters.find(c => c.characterId.toLowerCase() === rp.toLowerCase());
            return rpCharacter ? <HarvestorChip key={rpCharacter.characterId} character={rpCharacter} /> : null;
          })}
        </div>
      )}
    </div>
  );
};