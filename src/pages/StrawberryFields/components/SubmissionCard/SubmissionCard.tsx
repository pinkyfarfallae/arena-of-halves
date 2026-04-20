import React from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import { HarvestSubmission } from '../../../../types/harvest';
import { HARVEST_SUBMISSION_STATUS } from '../../../../constants/harvest';
import Drachma from '../../../../icons/Drachma';
import Basket from '../../../LifeInCamp/components/ActionIcon/icons/Basket';
import { LANGUAGE } from '../../../../constants/language';
import Trophy from '../../../../icons/Trophy';
import Warning from '../../../../icons/Warning';
import Pending from './icons/Pending';
import Characters from './icons/Characters';
import OpenLink from './icons/OpenLink';
import Tweets from './icons/Tweets';
import RolePlayers from './icons/RolePlayers';
import TweetPreview from '../../../../components/TweetPreview/TweetPreview';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { parseDrachmaReward } from '../../../../utils/harvestReward';
import './SubmissionCard.scss';

export default function SubmissionCard({ submission, focused, onClick, forcedCompact }: { submission: HarvestSubmission, focused?: boolean, onClick?: () => void, forcedCompact?: boolean }) {
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
    window.open(submission.firstTweetUrl, '_blank', 'noopener,noreferrer');
  };

  const roleplayers = submission.roleplayers?.split(',').map(r => r.trim()) || [];
  const isSolo = roleplayers.length === 1;
  const { display: rewardDisplay, label: rewardLabel } = parseDrachmaReward(submission.drachmaReward, isSolo);

  return (
    <div
      key={submission.id}
      className={`strawberry-fields__submission-card strawberry-fields__submission-card--${submission.status.toLowerCase()} ${forcedCompact ? 'strawberry-fields__submission-card--compact' : ''} ${focused ? 'strawberry-fields__submission-card--focused' : ''}`}
      onClick={onClick}
      style={!!onClick ? { cursor: "pointer" } : undefined}
    >
      <div className="strawberry-fields__submission-top">
        <div className="strawberry-fields__submission-header">
          <Basket />
          <span>{t(T.HARVEST_REPORT_FOR)} {date}</span>
        </div>

        <span
          className="strawberry-fields__submission-link-btn-wrapper"
          data-tooltip={"Open"}
          data-tooltip-pos="left"
        >
          <button
            className="strawberry-fields__submission-link-btn"
            onClick={handleLinkClick}
          >
            <OpenLink />
          </button>
        </span>
      </div>

      <div className="strawberry-fields__submission-preview">
        <span className={`strawberry-fields__submission-preview-inner strawberry-fields__submission-preview-inner--${submission.status.toLowerCase()}`}>
          {submission.firstTweetUrl ? (
            <TweetPreview url={submission.firstTweetUrl} scale={(width > 460 && !forcedCompact) ? 0.85 : 0.52} className="strawberry-fields__submission-preview-block" />
          ) : (
            null
          )}
        </span>

        {submission.status === HARVEST_SUBMISSION_STATUS.APPROVED && (
          <div className="strawberry-fields__submission-details">
            <div className="strawberry-fields__submission-stats">
              <div className="strawberry-fields__stat-item">
                <Drachma />
                <span className="strawberry-fields__stat-value">{rewardDisplay}</span>
                <span className="strawberry-fields__stat-label">{rewardLabel}</span>
              </div>

              <div className="strawberry-fields__stat-item strawberry-fields__stat-item--compact">
                <Characters />
                <span><b>{submission.charCount || 0}</b></span>
                <span className="strawberry-fields__stat-label">chars</span>
              </div>

              <div className="strawberry-fields__stat-item strawberry-fields__stat-item--compact">
                <Tweets />
                <span><b>{submission.mentionCount || 0}</b></span>
                <span className="strawberry-fields__stat-label">tweets</span>
              </div>
            </div>
          </div>
        )}

        {submission.status === HARVEST_SUBMISSION_STATUS.REJECTED && submission.rejectReason && (
          <div className="strawberry-fields__submission-error-wrapper">
            <div className="strawberry-fields__submission-error">
              <Warning />
              <span>rejected</span>
            </div>
            <div className="strawberry-fields__submission-submitted-at">
              <span><b>by</b>{submission.reviewedBy || "unknown"}</span>
            </div>
          </div>
        )}

        {submission.status === HARVEST_SUBMISSION_STATUS.PENDING && (
          <div className="strawberry-fields__submission-pending-wrapper">
            <div className="strawberry-fields__submission-pending">
              <Pending />
              <span>pending...</span>
            </div>
            <div className="strawberry-fields__submission-submitted-at">
              {width > 375 && <b>submitted </b>}
              <span>{date}</span>
            </div>
          </div>
        )}
      </div>

      {submission.status === HARVEST_SUBMISSION_STATUS.APPROVED && roleplayers.length > 0 && (
        <div className="strawberry-fields__submission-roleplayers">
          <div className="strawberry-fields__roleplayers-header">
            <RolePlayers />
            <span>Roleplayers</span>
            {isSolo && (
              <div className="strawberry-fields__solo-badge">
                <Trophy />
                SOLO
              </div>
            )}
          </div>
          {!isSolo && (
            <div className="strawberry-fields__roleplayers-list">
              {roleplayers.map((rp, idx) => (
                <span key={idx} className="strawberry-fields__roleplayer-tag">
                  {rp}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {submission.status === HARVEST_SUBMISSION_STATUS.REJECTED && submission.rejectReason && (
        <div className="strawberry-fields__submission-reject-reason">
          <span><b>Reason:</b> {submission.rejectReason}</span>
        </div>
      )}
    </div>
  );
};