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
import Refund from '../Stats/icons/Refund';
import { fetchTrainings, getTodayDate, getTodayProgress, submitTrainingRoleplay, UserDailyProgress } from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/practiceStates';
import Swords from '../../../../icons/Swords';
import './TrainingRoleplaySubmission.scss';

function TrainingRoleplaySubmission() {
  const { user } = useAuth();
  const { width } = useScreenSize();
  const { t, lang } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sheetTask, setSheetTask] = useState<UserDailyProgress | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [showDescription, setShowDescription] = useState(true);
  const [error, setError] = useState('');
  const [ticketsToApply, setTicketsToApply] = useState(0);

  useEffect(() => {
    if (!user?.characterId) return;

    let mounted = true;
    setIsLoading(true);

    Promise.all([
      fetchTrainings(user.characterId).catch(() => [] as UserDailyProgress[]),
      getTodayProgress(user.characterId).catch(() => null),
    ]).then(([data, todayProgress]) => {
      if (mounted) {
        setLivePractice(todayProgress);
        const todaySheetTask = [...data].reverse().find((training) => training.date === getTodayDate()) || null;
        setSheetTask(todaySheetTask);
      }
    }).catch(console.error)
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  const isValidTwitterUrl = useMemo(() => {
    const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^/]+\/status\/\d+/i;
    const xRegex = /^https?:\/\/(www\.)?x\.com\/[^/]+\/status\/\d+/i;
    return twitterRegex.test(firstTweetUrl.trim()) || xRegex.test(firstTweetUrl.trim());
  }, [firstTweetUrl]);

  const requiredCharacters = useMemo(() => {
    const baseRequirement = 1000;
    const charReductionPerTicket = 200;
    const reduction = ticketsToApply * charReductionPerTicket;
    return Math.max(0, baseRequirement - reduction);
  }, [ticketsToApply]);

  const canSubmitWithoutTweet = useMemo(() => {
    return requiredCharacters === 0;
  }, [requiredCharacters]);

  const isPvpPracticeLive = livePractice?.practiceMode === 'pvp' && livePractice.practiceState === 'live';
  const isAdminPracticeLive = livePractice?.practiceMode === 'admin' && livePractice.practiceState === 'live';
  const sheetTaskVerified = sheetTask?.verified ?? null;
  const sheetTaskDate = sheetTask?.date ?? '';
  const sheetTaskRoleplay = sheetTask?.roleplay ?? '';
  const sheetTaskTickets = sheetTask?.tickets ?? 0;
  const sheetTaskRejectReason = sheetTask?.rejectReason ?? '';
  const isPvpSheetTask = sheetTask?.practiceMode === 'pvp';
  const pvpBattleRolls = (sheetTask?.practiceBattleRolls || livePractice?.practiceBattleRolls || []).filter((n): n is number => typeof n === 'number' && n > 0);

  const handleSubmit = async () => {
    if (!user?.characterId) {
      setError('You must be logged in');
      return;
    }

    // Only require tweet URL if character requirements aren't fully met with tickets
    if (!canSubmitWithoutTweet) {
      if (!firstTweetUrl.trim()) {
        setError('Please paste the thread URL');
        return;
      }

      if (!isValidTwitterUrl) {
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
      await submitTrainingRoleplay(
        user.characterId,
        sheetTaskDate,
        firstTweetUrl.trim(),
        ticketsToApply
      );

      setSheetTask((prev) => prev ? {
        ...prev,
        roleplay: firstTweetUrl.trim() || null,
        tickets: ticketsToApply,
        verified: TRAINING_POINT_REQUEST_STATUS.PENDING,
        rejectReason: undefined,
      } : prev);
      setFirstTweetUrl('');
      setTicketsToApply(0);
    } catch (err) {
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
          <div className="training-roleplay-submission__header-refund-ticket">
            <span className="training-roleplay-submission__header-refund-ticket-icon">
              <Refund />
            </span>
            <span className="training-roleplay-submission__header-refund-ticket-text">
              <span className="label">Refunds</span>
              <span className="value">
                5
              </span>
            </span>
          </div>
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
              No training data found. Start training to submit your roleplay and earn points!
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
              {livePractice?.practiceArenaId && (
                <div className="training-roleplay-submission__form-waiting-link">
                  <strong>Room:</strong>{' '}
                  <Link to={`/training-grounds/pvp/${livePractice.practiceArenaId}`}>{livePractice.practiceArenaId}</Link>
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
          ) : isPvpSheetTask ? (
            <div className="training-roleplay-submission__form-waiting">
              <div className="training-roleplay-submission__form-waiting-title">
                PvP practice task ready
              </div>
              <div className="training-roleplay-submission__form-waiting-text">
                Battle rounds: <strong>{sheetTask.practiceBattleRounds || 0}</strong>
              </div>
              <div className="training-roleplay-submission__form-waiting-text">
                Result: <strong>{sheetTask.practiceBattleWinner ? 'Winner' : 'Loser'}</strong>
              </div>
              <div className="training-roleplay-submission__form-waiting-text">
                Attack / defend rolls: <strong>{pvpBattleRolls.join(' / ') || 'pvp'}</strong>
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
                {sheetTaskVerified === TRAINING_POINT_REQUEST_STATUS.REJECTED && (
                  <div className="training-roleplay-submission__form-rejected">
                    <div className="training-roleplay-submission__form-rejected-content">
                      <strong>Submission Rejected</strong>
                      {sheetTaskRejectReason && (
                        <p>{sheetTaskRejectReason}</p>
                      )}
                      <p className="training-roleplay-submission__form-rejected-hint">
                        Please review the feedback and submit again.
                      </p>
                    </div>
                  </div>
                )}

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

                <div className="training-roleplay-submission__form-input-group">
                  <input
                    type="text"
                    ref={inputRef}
                    className="training-roleplay-submission__form-input"
                    placeholder={canSubmitWithoutTweet ? "Tweet URL (optional - covered by tickets)" : "Paste thread URL (first tweet)"}
                    style={!isValidTwitterUrl && firstTweetUrl.trim() !== '' ? { paddingRight: "40px" } : {}}
                    value={firstTweetUrl}
                    onChange={(e) => setFirstTweetUrl(e.target.value)}
                  />
                  {!isValidTwitterUrl && firstTweetUrl.trim() !== '' && (
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
                        {/* waiting for edit */}
                        Available Tickets: <strong>{sheetTaskTickets}</strong>
                      </span>
                    </div>
                    <div className="training-roleplay-submission__tickets-controls">
                      <label className="training-roleplay-submission__tickets-input-label">
                        Use tickets:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={Math.min(sheetTaskTickets, 5)}
                        value={ticketsToApply}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          const maxTickets = Math.min(sheetTaskTickets, 5);
                          setTicketsToApply(Math.max(0, Math.min(value, maxTickets)));
                        }}
                        className="training-roleplay-submission__tickets-input"
                      />
                      <button
                        className="training-roleplay-submission__tickets-button"
                        onClick={() => {
                          const maxTickets = Math.min(sheetTaskTickets, 5);
                          setTicketsToApply(maxTickets);
                        }}
                        disabled={sheetTaskTickets === 0}
                      >
                        Use Max ({Math.min(sheetTaskTickets, 5)})
                      </button>
                    </div>
                  </div>
                  {ticketsToApply > 0 && (
                    <div className="training-roleplay-submission__tickets-hint">
                      <span>
                        Applying {ticketsToApply} ticket{ticketsToApply > 1 ? 's' : ''} reduces requirement by {ticketsToApply * 200} chars
                      </span>
                    </div>
                  )}
                </div>

                <button
                  className={`training-roleplay-submission__form-button ${isSubmitting ? 'training-roleplay-submission__form-button--loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || (!canSubmitWithoutTweet && (!firstTweetUrl.trim() || !isValidTwitterUrl))}
                >
                  <Swords className="training-roleplay-submission__form-button-icon" />
                  <span>{isSubmitting ? t(T.SUBMITTING_TRAINING_TASK) : t(T.SUBMIT_TRAINING_TASK)}</span>
                </button>

                {error && (
                  <div className="training-roleplay-submission__form-error">
                    {error}
                  </div>
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
