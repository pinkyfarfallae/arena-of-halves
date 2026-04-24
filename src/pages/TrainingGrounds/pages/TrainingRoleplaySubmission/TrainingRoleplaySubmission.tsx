import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import ChevronLeft from '../../../../icons/ChevronLeft';
import Trophy from '../../../../icons/Trophy';
import { LANGUAGE } from '../../../../constants/language';
import Close from '../../../../icons/Close';
import { hexToRgb } from '../../../../utils/color';
import InfoCircle from '../../../Shop/icons/InfoCircle';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { BG_ELEMENTS } from '../../components/Background/Background';
import TrainingPoint from '../Stats/icons/TrainingPoint';
import { fetchUserTrainingTasks, getTodayProgress, submitTrainingRoleplay, recheckTrainingTask, UserDailyProgress, TrainingTask } from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import Swords from '../../../../icons/Swords';
import { PRACTICE_MODE, PRACTICE_STATES } from '../../../../constants/practice';
import Alert from './icons/Alert';
import { useBag } from '../../../../hooks/useBag';
import './TrainingRoleplaySubmission.scss';
import { ITEMS } from '../../../../constants/items';
import { consumeItem, giveItem } from '../../../../services/bag/bagService';
import { BAG_ITEM_TYPES } from '../../../../constants/bag';
import { isValidTwitterUrl } from '../../../../utils/twitterUrlValidation';

function TrainingRoleplaySubmission() {
  const { user } = useAuth();
  const { width } = useScreenSize();
  const { t, lang } = useTranslation();
  const { bagEntries } = useBag(user?.characterId || '');
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetTask, setSheetTask] = useState<TrainingTask | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [showDescription, setShowDescription] = useState(true);
  // eslint-disable-next-line
  const [_error, setError] = useState('');
  const [ticketsToApply, setTicketsToApply] = useState(0);
  const [isChangeRoleplayUrl, setIsChangeRoleplayUrl] = useState(false);
  const [isSubmittingRecheck, setIsSubmittingRecheck] = useState(false);

  // Initialize ticketsToApply when sheet task loads
  useEffect(() => {
    if (sheetTask && sheetTask.tickets !== undefined) {
      setTicketsToApply(sheetTask.tickets);
    }
  }, [sheetTask]);

  useEffect(() => {
    if (!user?.characterId) return;

    let mounted = true;
    setIsLoading(true);

    Promise.all([
      fetchUserTrainingTasks(user.characterId).catch(() => [] as TrainingTask[]),
      getTodayProgress(user.characterId).catch(() => null),
    ]).then(([data, todayProgress]) => {
      if (mounted) {
        setLivePractice(todayProgress);
        const todaySheetTask = [...data].reverse()[0] || null;
        setSheetTask(todaySheetTask);
      }
    }).catch(() => { })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  const _isValidTwitterUrl = useMemo(() => isValidTwitterUrl(firstTweetUrl), [firstTweetUrl]);

  const requiredCharacters = useMemo(() => {
    const baseRequirement = 1000;
    const charReductionPerTicket = 200;
    const reduction = ticketsToApply * charReductionPerTicket;
    return Math.max(0, baseRequirement - reduction);
  }, [ticketsToApply]);

  const canSubmitWithoutTweet = useMemo(() => {
    return requiredCharacters === 0;
  }, [requiredCharacters]);

  const isPvpPracticeLive = livePractice?.mode === PRACTICE_MODE.PVP && livePractice.state === PRACTICE_STATES.LIVE;
  const isAdminPracticeLive = livePractice?.mode === PRACTICE_MODE.NORMAL && livePractice.state === PRACTICE_STATES.LIVE;
  const sheetTaskVerified = sheetTask?.verified ?? null;
  const sheetTaskDate = sheetTask?.date ?? '';
  const sheetTaskRoleplay = sheetTask?.roleplay ?? '';
  const sheetTaskTickets = sheetTask?.tickets ?? 0;

  const availableTickets = useMemo(() => {
    return bagEntries.find(entry => entry.itemId === ITEMS.SKIP_TICKET)?.amount || 0;
  }, [bagEntries]);

  // Calculate min and max tickets
  const minTickets = 0;
  const maxTickets = Math.min(availableTickets + sheetTaskTickets, 5);

  const handleRecheck = async () => {
    if (!user?.characterId) {
      setError('You must be logged in');
      return;
    }

    if (!sheetTaskDate) {
      setError('No training date found');
      return;
    }

    setIsSubmittingRecheck(true);
    setError('');

    try {
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok'
      }).format(new Date(sheetTaskDate));

      await recheckTrainingTask(user.characterId, date);

      setSheetTask((prev) => prev ? {
        ...prev,
        verified: TRAINING_POINT_REQUEST_STATUS.PENDING,
        rejectReason: '',
      } : prev);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recheck training task');
    } finally {
      setIsSubmittingRecheck(false);
    }
  };

  console.log(_error)

  const handleSubmit = async () => {
    if (!user?.characterId) {
      setError('You must be logged in');
      return;
    }

    // Use existing roleplay URL if no new one is provided and we're in change mode
    const urlToSubmit = firstTweetUrl.trim() || (isChangeRoleplayUrl ? sheetTaskRoleplay : '');

    // Only require tweet URL if character requirements aren't fully met with tickets
    if (!canSubmitWithoutTweet) {
      if (!urlToSubmit) {
        setError('Please paste the thread URL');
        return;
      }

      const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^/]+\/status\/\d+/i;
      const xRegex = /^https?:\/\/(www\.)?x\.com\/[^/]+\/status\/\d+/i;
      const isValid = twitterRegex.test(urlToSubmit) || xRegex.test(urlToSubmit);

      if (!isValid) {
        setError('Invalid Twitter/X URL');
        return;
      }
    }

    if (!sheetTaskDate) {
      setError('No training date found');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const date = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Bangkok'
      }).format(new Date(sheetTaskDate));

      const ticketDifference = ticketsToApply - sheetTaskTickets;

      if (ticketDifference > 0) {
        // Using more tickets than before - consume additional tickets
        await Promise.all([
          submitTrainingRoleplay(
            user.characterId,
            date,
            urlToSubmit,
            ticketsToApply
          ),
          consumeItem(user.characterId, ITEMS.SKIP_TICKET, ticketDifference)
        ]);
      } else if (ticketDifference < 0) {
        // Using fewer tickets than before - return unused tickets
        await Promise.all([
          submitTrainingRoleplay(
            user.characterId,
            date,
            urlToSubmit,
            ticketsToApply
          ),
          giveItem(user.characterId, ITEMS.SKIP_TICKET, Math.abs(ticketDifference), BAG_ITEM_TYPES.ITEM)
        ]);
      } else {
        // Same number of tickets - just submit
        await submitTrainingRoleplay(
          user.characterId,
          date,
          urlToSubmit,
          ticketsToApply
        );
      }

      setSheetTask((prev) => prev ? {
        ...prev,
        roleplay: urlToSubmit,
        tickets: ticketsToApply,
        verified: TRAINING_POINT_REQUEST_STATUS.PENDING,
        rejectReason: '',
      } : prev);
      setFirstTweetUrl('');
      // Don't reset ticketsToApply - it stays as the committed amount
      setIsChangeRoleplayUrl(false);
    } catch (err) {
      console.error('Error submitting training roleplay:', err);
      setError(err instanceof Error ? err.message : 'Failed to submit training task');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="training-roleplay-submission"
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

      {/* Background elements */}
      {BG_ELEMENTS}

      {/* Compact header */}
      <div className="training-roleplay-submission__header">

        <Link to="/training-grounds" className="training-roleplay-submission__header-back">
          <ChevronLeft width={14} height={14} />
          Back
        </Link>

        <div className="training-roleplay-submission__header-title">Tasks</div>

        <div className="training-roleplay-submission__header-points-container">
          <div className="training-roleplay-submission__header-points">
            <span className="training-roleplay-submission__header-points-icon">
              <TrainingPoint />
            </span>
            <span className="training-roleplay-submission__header-points-text">
              <span className="label">Points</span>
              <span className="value">
                {user?.trainingPoints || 0}
                <span>TP</span>
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Body with split layout */}
      <div className="training-roleplay-submission__container">
        {showDescription && (
          <div className="training-roleplay-submission__description">
            <InfoCircle />
            <p>{t(T.ROLEPLAY_SUBMISSION_DESC)}</p>
            <div
              className="training-roleplay-submission__description-close"
              onClick={() => setShowDescription(false)}
            >
              <Close width={12} height={12} />
            </div>
          </div>
        )}

        <div className="training-roleplay-submission__form">
          {isLoading ? (
            <div className="training-roleplay-submission__form-loading">Loading...</div>
          ) : !sheetTask && !livePractice ? (
            <div className="training-roleplay-submission__form-no-data">
              No training data found. <br />
              Start training to submit your roleplay and earn points!
            </div>
          ) : isPvpPracticeLive ? (
            <div className="training-roleplay-submission__form-waiting">
              <div className="training-roleplay-submission__form-waiting-title">
                PvP practice is still live
              </div>
              <div className="training-roleplay-submission__form-waiting-text">
                Finish the battle first. <br />
                The task will appear after the match ends.
              </div>
              {livePractice?.arenaId && (
                <div className="training-roleplay-submission__form-waiting-link">
                  <strong>Room:</strong>{' '}
                  <Link to={`/training-grounds/pvp/${livePractice.arenaId}`}>{livePractice.arenaId}</Link>
                </div>
              )}
            </div>
          ) : isAdminPracticeLive ? (
            <div className="training-roleplay-submission__form-waiting">
              <div className="training-roleplay-submission__form-waiting-title">
                Normal training is still live
              </div>
              <div className="training-roleplay-submission__form-waiting-text">
                Finish the dice training first. <br />
                The task will be created after the session ends.
              </div>
            </div>
          ) : sheetTaskVerified === TRAINING_POINT_REQUEST_STATUS.APPROVED ? (
            <div className="training-roleplay-submission__form-approved">
              Training already approved! You can train more to upgrade your skills.
            </div>
          ) : sheetTask && sheetTaskVerified === TRAINING_POINT_REQUEST_STATUS.PENDING && ((sheetTaskRoleplay && sheetTaskRoleplay.trim() !== '') || sheetTaskTickets > 0) ? (
            // Pending with submission - show waiting message
            <>
              <div className="training-roleplay-submission__form-title">
                {lang === LANGUAGE.ENGLISH
                  ? `${user?.nicknameEng}'s Training on ${sheetTaskDate ? new Date(sheetTaskDate).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`
                  : `การฝึกฝนของ${user?.nicknameThai} ประจำวันที่ ${sheetTaskDate ? new Date(sheetTaskDate).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`}
              </div>
              <div className="training-roleplay-submission__form-waiting">
                <div className="training-roleplay-submission__form-waiting-icon">
                  <Trophy width={48} height={48} />
                </div>
                <div className="training-roleplay-submission__form-waiting-title">
                  Submission Under Review
                </div>
                <div className="training-roleplay-submission__form-waiting-text">
                  Your task is pending approval from administrators.
                  <br />
                  Please wait for the review process to complete.
                </div>
                {sheetTaskRoleplay && (
                  <div className="training-roleplay-submission__form-waiting-link">
                    <strong>Submitted:</strong> <a href={sheetTaskRoleplay} target="_blank" rel="noopener noreferrer">{sheetTaskRoleplay}</a>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Rejected or Pending without submission - show form
            <>
              <div className="training-roleplay-submission__form-title">
                {lang === LANGUAGE.ENGLISH
                  ? `${user?.nicknameEng}'s Training on ${sheetTaskDate ? new Date(sheetTaskDate).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`
                  : `การฝึกฝนของ${user?.nicknameThai} ประจำวันที่ ${sheetTaskDate ? new Date(sheetTaskDate).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`}
              </div>

              {/* Roleplay URL Input - Primary Section */}
              <div className="training-roleplay-submission__form-content">
                {sheetTaskVerified === TRAINING_POINT_REQUEST_STATUS.REJECTED && !isChangeRoleplayUrl && (
                  <div className="training-roleplay-submission__form-waiting">
                    <div className="training-roleplay-submission__form-waiting-icon">
                      <Alert width={48} height={48} />
                    </div>
                    <div className="training-roleplay-submission__form-waiting-title">
                      Submission Rejected
                    </div>
                    <div className="training-roleplay-submission__form-waiting-text">
                      Your task has been rejected by administrators.
                      <br />
                      Please rewrite and resubmit.
                    </div>
                    {sheetTaskRoleplay && (
                      <div className="training-roleplay-submission__form-waiting-link">
                        <strong>Submitted:</strong> <a href={sheetTaskRoleplay} target="_blank" rel="noopener noreferrer">{sheetTaskRoleplay}</a>
                      </div>
                    )}
                    <div className="training-roleplay-submission__form-waiting-actions">
                      <button
                        className="training-roleplay-submission__form-waiting-button"
                        onClick={() => {
                          setIsChangeRoleplayUrl(true);
                        }}
                        disabled={isSubmittingRecheck}
                      >
                        Change Roleplay URL
                      </button>
                      <button
                        className="training-roleplay-submission__form-waiting-button"
                        onClick={handleRecheck}
                        disabled={isSubmittingRecheck}
                      >
                        {isSubmittingRecheck ? 'Submitting...' : 'Recheck'}
                      </button>
                    </div>
                  </div>
                )}

                {(sheetTaskVerified !== TRAINING_POINT_REQUEST_STATUS.REJECTED || isChangeRoleplayUrl) && (
                  <>
                    <div className="training-roleplay-submission__form-requirements">
                      <div className="training-roleplay-submission__form-requirements-text">
                        <strong>Required:</strong> {canSubmitWithoutTweet ? (
                          <strong className="highlight">No tweet needed!</strong>
                        ) : (
                          <>
                            At least <strong className="highlight">{requiredCharacters}</strong> characters
                          </>
                        )}
                      </div>
                      <div className="training-roleplay-submission__form-requirements-note">
                        Base: 1,000 chars • 1 ticket = 200 chars • 5 tickets = No tweet needed
                      </div>
                    </div>

                    {isChangeRoleplayUrl && (
                      <div className="training-roleplay-submission__form-change-note">
                        <div className="training-roleplay-submission__form-change-note-content">
                          <span className="training-roleplay-submission__form-change-note-text">
                            You can change the roleplay URL to update your submission. <br />
                            If you want to keep the same URL, just click <b>Recheck</b> without changing it.
                          </span>
                          <button
                            className="training-roleplay-submission__form-change-note-button"
                            onClick={handleRecheck}
                            disabled={isSubmittingRecheck}
                          >
                            {isSubmittingRecheck ? 'Submitting...' : 'Recheck'}
                          </button>
                        </div>
                        <div className="training-roleplay-submission__form-change-note-footer">
                          <b>current URL:</b> {sheetTaskRoleplay ? (
                            <a href={sheetTaskRoleplay} target="_blank" rel="noopener noreferrer">{sheetTaskRoleplay}</a>
                          ) : (
                            <span className="highlight">No URL submitted</span>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="training-roleplay-submission__form-input-group">
                      <input
                        type="text"
                        ref={inputRef}
                        className="training-roleplay-submission__form-input"
                        placeholder={canSubmitWithoutTweet ? "Tweet URL (optional - covered by tickets)" : "Paste thread URL (first tweet)"}
                        style={!_isValidTwitterUrl && firstTweetUrl.trim() !== '' ? { paddingRight: "40px" } : {}}
                        value={firstTweetUrl}
                        onChange={(e) => setFirstTweetUrl(e.target.value)}
                      />
                      {!_isValidTwitterUrl && firstTweetUrl.trim() !== '' && (
                        <div
                          className="training-roleplay-submission__form-error-icon"
                          data-tooltip={t(T.INVALID_TWITTER_URL)}
                          data-tooltip-pos={width < 480 ? "left" : "top"}
                        >
                          <InfoCircle />
                        </div>
                      )}
                    </div>

                    {/* Mention Tickets Section */}
                    <div className="training-roleplay-submission__tickets">
                      <div className="training-roleplay-submission__tickets-content">
                        <div className="training-roleplay-submission__tickets-info">
                          <Trophy width={14} height={14} />
                          <span className="training-roleplay-submission__tickets-label">
                            Available Tickets: <strong>{availableTickets}</strong>
                            {sheetTaskTickets > ticketsToApply && (
                              <span className="training-roleplay-submission__tickets-committed">
                                {' '}(+{sheetTaskTickets - ticketsToApply} ticket{sheetTaskTickets - ticketsToApply > 1 ? 's' : ''} refunded)
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="training-roleplay-submission__tickets-controls">
                          <label className="training-roleplay-submission__tickets-input-label">
                            Use tickets:
                          </label>
                          <input
                            type="number"
                            min={minTickets}
                            max={maxTickets}
                            value={ticketsToApply}
                            onChange={(e) => {
                              const value = parseInt(e.target.value) || minTickets;
                              setTicketsToApply(Math.max(minTickets, Math.min(value, maxTickets)));
                            }}
                            className="training-roleplay-submission__tickets-input"
                          />
                          <button
                            className="training-roleplay-submission__tickets-button"
                            onClick={() => setTicketsToApply(maxTickets)}
                            disabled={ticketsToApply >= maxTickets}
                          >
                            Use Max ({maxTickets})
                          </button>
                        </div>
                      </div>
                    </div>

                    <button
                      className={`training-roleplay-submission__form-button ${isSubmitting || isSubmittingRecheck ? 'training-roleplay-submission__form-button--loading' : ''}`}
                      onClick={handleSubmit}
                      disabled={isSubmitting || isSubmittingRecheck || (!canSubmitWithoutTweet && (!firstTweetUrl.trim() || !_isValidTwitterUrl))}
                    >
                      <Swords className="training-roleplay-submission__form-button-icon" />
                      <span>{isSubmitting || isSubmittingRecheck ? t(T.SUBMITTING_TRAINING_TASK) : t(T.SUBMIT_TRAINING_TASK)}</span>
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrainingRoleplaySubmission;
