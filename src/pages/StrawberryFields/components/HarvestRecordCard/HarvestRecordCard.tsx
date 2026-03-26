import React from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import { HarvestSubmission } from '../../../../types/harvest';
import { HARVEST_SUBMISSION_STATUS } from '../../../../constants/harvest';
import Drachma from '../../../../icons/Drachma';
import { LANGUAGE } from '../../../../constants/language';
import OpenLink from '../SubmissionCard/icons/OpenLink';
import Strawberry from '../../../LifeInCamp/components/LocationIcon/icons/Strawberry';
import { Character } from '../../../../data/characters';
import { hexToRgb } from '../../../../utils/color';
import HarvestorChip from './components/HarvestorChip/HarvestorChip';
import { DEITY_DISPLAY_OVERRIDES } from '../../../CharacterInfo/constants/overrides';
import { DEITY_SVG } from '../../../../data/deities';
import './HarvestRecordCard.scss';

export default function HarvestRecordCard({ submission, characterMap }: { submission: HarvestSubmission, characterMap: Record<string, Character> }) {
  const { t, lang } = useTranslation();

  const date = new Date(submission.submittedAt)
    .toLocaleDateString(
      lang === LANGUAGE.ENGLISH ?
        'en-US' : 'th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

  const handleLinkClick = () => {
    window.open(submission.firstTweetUrl, '_blank', 'noopener,noreferrer');
  };

  const submitter = characterMap[submission.characterId.toLowerCase()] || null;
  const submitterDisplayDeity = DEITY_DISPLAY_OVERRIDES[submission.characterId.toLowerCase()] ?? submitter?.deityBlood;

  const roleplayers = submission.roleplayers?.split(',').map(r => r.trim()) || [];
  const isSolo = roleplayers.length === 1;

  return (
    <div key={submission.id} className={`strawberry-fields__harvest-record-card strawberry-fields__harvest-record-card--${submission.status.toLowerCase()}`}>
      <div className="strawberry-fields__harvest-record-top">
        <div className="strawberry-fields__harvest-record-header">
          <span>{t(T.HARVEST_REPORT_FOR)} {date}</span>
        </div>

        <span
          className="strawberry-fields__harvest-record-link-btn-wrapper"
          data-tooltip={"Open"}
          data-tooltip-pos="left"
        >
          <button
            className="strawberry-fields__harvest-record-link-btn"
            onClick={handleLinkClick}
          >
            <OpenLink />
          </button>
        </span>
      </div>

      {submission.status === HARVEST_SUBMISSION_STATUS.APPROVED && (
        <>
          {isSolo ? (
            <div className="strawberry-fields__harvest-record-submitted-by">
              {submitter && (
                <>
                  <HarvestorChip character={submitter} />
                  <div
                    className="strawberry-fields__harvest-record-submitter-label"
                    style={{
                      '--submitter-primary-color': hexToRgb(submitter.theme[0]),
                    } as React.CSSProperties}
                  >
                    <span><b>harvested by</b>{submitter.nicknameEng}</span>
                    {submitterDisplayDeity && submitterDisplayDeity in DEITY_SVG && DEITY_SVG[submitterDisplayDeity as keyof typeof DEITY_SVG]}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="strawberry-fields__harvest-record-roleplayers">
              {roleplayers.slice(0, Math.min(roleplayers.length, 8)).map((rp) => {
                const rpCharacter = characterMap[rp.toLowerCase()] || null;
                if (!rpCharacter) return null;
                return (
                  <HarvestorChip key={rpCharacter.characterId} character={rpCharacter} />
                );
              })}
            </div>
          )}
          <div className="strawberry-fields__harvest-record-info">
            <div className="strawberry-fields__harvest-record-info-item">
              <Strawberry />
              <span>
                {submission.mentionCount}
                <span style={{ color: '#e57aaf', fontSize: '0.575rem' }}>strawberry mention{(submission.mentionCount || 0) > 1 ? 's' : ''}</span>
              </span>
            </div>
            <div className="strawberry-fields__harvest-record-info-item">
              <Drachma />
              <span>{submission.drachmaReward}</span>
            </div>
          </div>
        </>
      )}

      {(submission.status === HARVEST_SUBMISSION_STATUS.REJECTED || submission.status === HARVEST_SUBMISSION_STATUS.PENDING) && (
        <>
          <div className="strawberry-fields__harvest-record-submitted-by">
            {submitter && (
              <>
                <HarvestorChip character={submitter} />
                <div
                  className="strawberry-fields__harvest-record-submitter-label"
                  style={{
                    '--submitter-primary-color': hexToRgb(submitter.theme[0]),
                  } as React.CSSProperties}
                >
                  <span><b>submitted by</b>{submitter.nicknameEng}</span>
                  <span><b>submitted at</b>{date}</span>
                  <Strawberry style={{ color: submitter.theme[0] }} />
                </div>
              </>
            )}
          </div>
          <div className={`strawberry-fields__harvest-record-reason strawberry-fields__harvest-record-reason--${submission.status.toLowerCase()}`}>
            {submission.status === HARVEST_SUBMISSION_STATUS.REJECTED ? (
              <>
                <span><b>rejected</b>{submission.rejectReason ? `: ${submission.rejectReason}` : ''}</span>
              </>
            ) : (
              <span><b>pending review</b></span>
            )}
          </div>
        </>
      )}
    </div>
  );
};