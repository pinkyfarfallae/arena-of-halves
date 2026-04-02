import { useState, useEffect, useMemo, useRef, use } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { useTranslation } from '../../../../hooks/useTranslation';
import { T } from '../../../../constants/translationKeys';
import ChevronLeft from '../../../../icons/ChevronLeft';
import Trophy from '../../../../icons/Trophy';
import { LANGUAGE } from '../../../../constants/language';
import Close from '../../../../icons/Close';
import { Character, fetchAllCharacters } from '../../../../data/characters';
import { hexToRgb } from '../../../../utils/color';
import InfoCircle from '../../../Shop/icons/InfoCircle';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import { BG_ELEMENTS } from '../../components/Background/Background';
import TrainingPoint from '../Stats/icons/TrainingPoint';
import Refund from '../Stats/icons/Refund';
import { fetchTrainings, submitTrainingRoleplay, UserDailyProgress } from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/practiceStates';
import Swords from '../../../../icons/Swords';
import './TrainingRoleplaySubmission.scss';

function TrainingRoleplaySubmission() {
  const { user } = useAuth();
  const { width } = useScreenSize();
  const { t, lang } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userTasks, setUserTasks] = useState<UserDailyProgress | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [allCampData, setAllCampData] = useState<Character[]>([]);
  const [showDescription, setShowDescription] = useState(true);
  const [error, setError] = useState('');
  const [ticketsToApply, setTicketsToApply] = useState(0);

  useEffect(() => {
    let mounted = true;

    fetchAllCharacters()
      .then((data) => {
        if (mounted) setAllCampData(data || []);
      })
      .catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    fetchAllCharacters()
      .then((data) => {
        if (mounted) setAllCampData(data || []);
      })
      .catch(console.error);

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!user?.characterId) return;

    let mounted = true;
    setIsLoading(true);

    fetchTrainings(user.characterId).then((data) => {
      if (mounted && data && data.length > 0) {
        // Get the most recent training (last element)
        setUserTasks(data[data.length - 1]);
      }
    }).catch(console.error)
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  const characterMap = useMemo(() => {
    const map: Record<string, Character> = {};
    allCampData.forEach((c) => {
      map[c.characterId.toLowerCase()] = c;
    });
    return map;
  }, [allCampData]);

  const isValidTwitterUrl = useMemo(() => {
    const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^\/]+\/status\/\d+/i;
    const xRegex = /^https?:\/\/(www\.)?x\.com\/[^\/]+\/status\/\d+/i;
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

    if (!userTasks?.date) {
      setError('No training date found');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      await submitTrainingRoleplay(
        user.characterId,
        userTasks.date,
        firstTweetUrl.trim(),
        ticketsToApply
      );

      setUserTasks((prev) => prev ? {
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
          ) : !userTasks ? (
            <div className="training-roleplay-submission__form-no-data">
              No training data found. Start training to submit your roleplay and earn points!
            </div>
          ) : userTasks.verified === TRAINING_POINT_REQUEST_STATUS.APPROVED ? (
            <div className="training-roleplay-submission__form-approved">
              Training already approved! You can train more to upgrade your skills.
            </div>
          ) : userTasks.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && ((userTasks.roleplay && userTasks.roleplay.trim() !== '') || userTasks?.tickets > 0) ? (
            // Pending with submission - show waiting message
            <>
              <div className="training-roleplay-submission__form-title">
                {lang === LANGUAGE.ENGLISH
                  ? `${user?.nicknameEng}'s Training on ${userTasks?.date ? new Date(userTasks.date).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`
                  : `การฝึกฝนของ${user?.nicknameThai} ประจำวันที่ ${userTasks?.date ? new Date(userTasks.date).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`}
              </div>
              <div className="training-roleplay-submission__form-waiting">
                <div className="training-roleplay-submission__form-waiting-icon">
                  <Trophy width={48} height={48} />
                </div>
                <div className="training-roleplay-submission__form-waiting-title">
                  Submission Under Review
                </div>
                <div className="training-roleplay-submission__form-waiting-text">
                  Your roleplay submission is pending approval from administrators.
                  <br />
                  Please wait for the review process to complete.
                </div>
                {userTasks.roleplay && (
                  <div className="training-roleplay-submission__form-waiting-link">
                    <strong>Submitted:</strong> <a href={userTasks.roleplay} target="_blank" rel="noopener noreferrer">{userTasks.roleplay}</a>
                  </div>
                )}
              </div>
            </>
          ) : (
            // Rejected or Pending without submission - show form
            <>
              <div className="training-roleplay-submission__form-title">
                {lang === LANGUAGE.ENGLISH
                  ? `${user?.nicknameEng}'s Training on ${userTasks?.date ? new Date(userTasks.date).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`
                  : `การฝึกฝนของ${user?.nicknameThai} ประจำวันที่ ${userTasks?.date ? new Date(userTasks.date).toLocaleDateString(lang, { month: 'long', day: 'numeric', year: 'numeric' }) : ''}`}
              </div>

              {/* Roleplay URL Input - Primary Section */}
              <div className="training-roleplay-submission__form-content">
                {userTasks.verified === TRAINING_POINT_REQUEST_STATUS.REJECTED && (
                  <div className="training-roleplay-submission__form-rejected">
                    <div className="training-roleplay-submission__form-rejected-content">
                      <strong>Submission Rejected</strong>
                      {userTasks.rejectReason && (
                        <p>{userTasks.rejectReason}</p>
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
                        Available Tickets: <strong>{userTasks?.tickets || 0}</strong>
                      </span>
                    </div>
                    <div className="training-roleplay-submission__tickets-controls">
                      <label className="training-roleplay-submission__tickets-input-label">
                        Use tickets:
                      </label>
                      <input
                        type="number"
                        min="0"
                        max={Math.min(userTasks?.tickets || 0, 5)}
                        value={ticketsToApply}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          const maxTickets = Math.min(userTasks?.tickets || 0, 5);
                          setTicketsToApply(Math.max(0, Math.min(value, maxTickets)));
                        }}
                        className="training-roleplay-submission__tickets-input"
                      />
                      <button
                        className="training-roleplay-submission__tickets-button"
                        onClick={() => {
                          const maxTickets = Math.min(userTasks?.tickets || 0, 5);
                          setTicketsToApply(maxTickets);
                        }}
                        disabled={!userTasks?.tickets || userTasks.tickets === 0}
                      >
                        Use Max ({Math.min(userTasks?.tickets || 0, 5)})
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default TrainingRoleplaySubmission;
