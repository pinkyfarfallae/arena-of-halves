import { useState, useEffect, useMemo, useRef, CSSProperties } from 'react';
import { DEITY_THEMES, fetchAllCharacters } from '../../../../data/characters';
import { ACTIONS } from '../../../../constants/action';
import { Character } from '../../../../types/character';
import { type HarvestScriptCopyStatus } from '../../../../types/harvest';
import { COPY_RESULT_SCRIPT, THREAD_EXTRACTOR_SCRIPT } from '../../../../constants/threadExtractor';
import { useAuth } from '../../../../hooks/useAuth';
import { HARVEST_SCRIPT_COPY_STATUS } from '../../../../constants/harvest';
import { parseScriptOutput, extractTwitterHandle } from '../../../../services/harvest/harvestApproval';
import Close from '../../../../icons/Close';
import ChevronLeft from '../../../../icons/ChevronLeft';
import SubmissionCard from './components/SubmissionCard/SubmissionCard';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import InfoCircle from '../../../Shop/icons/InfoCircle';
import OpenLink from '../../../StrawberryFields/components/SubmissionCard/icons/OpenLink';
import CopyIcon from '../../../Arena/icons/Copy';
import ApproveModal from './components/ApproveModal/ApproveModal';
import RejectModal from './components/RejectModal/RejectModal';
import SuccessModal from './components/SuccessModal/SuccessModal';
import { fetchAllTrainingTasks, TrainingTask, verifyTrainingTask } from '../../../../services/training/dailyTrainingDice';
import { darken, hexToRgb, rgbToHex, isNearWhite, contrastText } from '../../../../utils/color';
import { BG_ELEMENTS } from '../../../TrainingGrounds/components/Background/Background';
import { TRAINING_POINT_REQUEST_STATUS, TrainingPointRequestStatus } from '../../../../constants/trainingPointRequestStatus';
import { useTranslation } from '../../../../hooks/useTranslation';
import { LANGUAGE } from '../../../../constants/language';
import { PRACTICE_MODE } from '../../../../constants/practice';
import { fetchIrisWishesByDate } from '../../../../data/wishes';
import { DEITY } from '../../../../constants/deities';
import Athena from '../../../../data/icons/deities/Athena';
import { updateTrainingPoints } from '../../../../services/training/trainingPoints';
import { logActivity } from '../../../../services/activityLog/activityLogService';
import './TrainingApproval.scss';
import Crown from '../../../../icons/Crown';
import { PRACTICE_STATES_DETAIL } from '../../../../data/practiceStates';
import { formatAppDate, getAppDateString } from '../../../../utils/date';
import { ACTIVITY_LOG_ACTIONS } from '../../../../constants/activityLog';

function TrainingApproval() {
  const { user } = useAuth();
  const { lang } = useTranslation();
  const { width } = useScreenSize();

  const [characters, setCharacters] = useState<Character[]>([]);

  const [trainingTasks, setTrainingTasks] = useState<TrainingTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [reviewText, setReviewText] = useState('');

  const approvingRef = useRef(false); // sync guard against double-click
  const [approving, setApproving] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<TrainingPointRequestStatus>(TRAINING_POINT_REQUEST_STATUS.PENDING);

  const [reviewingTask, setReviewingTask] = useState<TrainingTask | null>(trainingTasks[0] || null);
  const [reviewingTaskDateWishes, setReviewingTaskDateWishes] = useState<any[]>([]);

  const [scriptCopyStatus, setScriptCopyStatus] =
    useState<HarvestScriptCopyStatus>(
      HARVEST_SCRIPT_COPY_STATUS.IDLE
    );

  const [scriptResultCopyStatus, setScriptResultCopyStatus] =
    useState<HarvestScriptCopyStatus>(
      HARVEST_SCRIPT_COPY_STATUS.IDLE
    )

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [approveData, setApproveData] = useState<{
    charCount: number;
    tweetCount: number;
    reward: number;
    roleplayers: string[];
    isSolo: boolean;
    withFullLevelFortune: boolean;
    isTraineeBlessedByAthena: boolean;
  } | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);

      if (!user || (characters.length > 0 && trainingTasks.length > 0)) return;

      await Promise.all([
        fetchAllCharacters(user)
          .then(setCharacters)
          .catch(() => setCharacters([])),

        fetchAllTrainingTasks()
          .then((tasks) => {
            setTrainingTasks(tasks);

            const pending = tasks.filter(
              (t) =>
                t.verified === TRAINING_POINT_REQUEST_STATUS.PENDING &&
                ((t.roleplay && t.roleplay.trim() !== '') || (t.tickets || 0) >= 5)
            );

            if (pending.length > 0) {
              setReviewingTask(pending[0]);
            }
          })
          .catch(() => {
            setTrainingTasks([]);
            setLoadError('Failed to load training tasks');
          }),
      ]);

      setLoading(false);
    };

    fetchData();
  }, [user?.characterId]);

  useEffect(() => {
    if (!reviewText.trim()) return;

    const traineeUsername = reviewingTask
      ? extractTwitterHandle(characters.find((c) => c.characterId === reviewingTask.userId)?.twitter || '')
      : null;

    const scriptParsed = parseScriptOutput(reviewText, traineeUsername || undefined);

    if (!scriptParsed) return;
  }, [reviewText, characters, reviewingTask]);

  useEffect(() => {
    if (!reviewingTask) {
      setReviewingTaskDateWishes([]);
      return;
    }

    const formattedDate = getAppDateString(reviewingTask.date);

    fetchIrisWishesByDate(formattedDate)
      .then((wishes) => {
        setReviewingTaskDateWishes(wishes);
      })
      .catch((error) => {
        setReviewingTaskDateWishes([]);
      });
  }, [reviewingTask]);

  const countCharacters = (text: string) =>
    text.replace(/\s+/g, '').length;

  const trainee = useMemo(() => {
    return characters.find((c) => c.characterId === reviewingTask?.userId);
  }, [characters, reviewingTask?.userId]);

  const isTraineeBlessedByAthena = useMemo(() => {
    const submissionTime = reviewingTask?.submittedAt;
    const hasAthena = reviewingTaskDateWishes.some(
      (wish) =>
        wish.deity === DEITY.ATHENA &&
        wish.userId === reviewingTask?.userId &&
        !wish.canceled &&
        (!wish.tossedAt || !submissionTime || wish.tossedAt <= submissionTime)
    );
    if (reviewingTask?.mode === PRACTICE_MODE.NORMAL) {
      return reviewingTask?.success && hasAthena;
    }
    return hasAthena;
  }, [reviewingTask, reviewingTaskDateWishes]);

  // Training passes if character count (including ticket bonus) >= 1000
  const checkTrainingPass = (charCount: number, tickets: number) => {
    const totalChars = charCount + (tickets * 200);
    const passes = totalChars >= 1000;
    const charsNeeded = Math.max(0, 1000 - totalChars);
    return { passes, totalChars, charsNeeded };
  };

  const getCharacterName = (id: string) => {
    const c = characters.find((x) => x.characterId === id);
    return c ? c.nicknameEng || id : id;
  };

  const navigateToNextPending = () => {
    const pending = trainingTasks.filter(
      (t) => {
        const isCurrent = reviewingTask ? t.id === reviewingTask.id : false;
        const hasSubmission = (t.roleplay && t.roleplay.trim() !== '') || (t.tickets || 0) >= 5 || t.mode === PRACTICE_MODE.PVP;
        return t.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && hasSubmission && !isCurrent;
      }
    );

    if (pending.length > 0) {
      setReviewingTask(pending[0]);
      setReviewText('');
    } else {
      setReviewingTask(null);
      setReviewText('');
    }
  };

  const handleApproveClick = () => {
    if (!reviewingTask) return;

    const isTicketOnly = ((reviewingTask.tickets || 0) >= 5 && (!reviewingTask.roleplay || reviewingTask.roleplay.trim() === '')) || reviewingTask.mode === PRACTICE_MODE.PVP;

    let charCount = 0;
    let tweetCount = 0;

    if (!isTicketOnly) {
      const scriptParsed = parseScriptOutput(reviewText);
      if (!scriptParsed) return;

      charCount = countCharacters(scriptParsed.text);
      tweetCount = scriptParsed.tweetCount;

      const trainingCheck = checkTrainingPass(charCount, reviewingTask.tickets || 0);
      if (!trainingCheck.passes) return;
    }

    let reward = 0;
    if (reviewingTask.mode === PRACTICE_MODE.NORMAL) {
      if (reviewingTask.success || isTicketOnly) {
        reward = (isTraineeBlessedByAthena ? 1 : 0) + (reviewingTask.withFullLevelFortune ? 1 : 0) + (isTraineeBlessedByAthena && reviewingTask.withFullLevelFortune ? 1 : 0) + 1;
      }
    } else {
      reward = (isTraineeBlessedByAthena ? 1 : 0) + (reviewingTask.withFullLevelFortune ? 1 : 0) + (isTraineeBlessedByAthena && reviewingTask.withFullLevelFortune ? 1 : 0) + 1;
    }

    setApproveData({
      charCount,
      tweetCount,
      reward,
      roleplayers: [reviewingTask.userId],
      isSolo: true,
      withFullLevelFortune: !!reviewingTask.withFullLevelFortune,
      isTraineeBlessedByAthena,
    });
    setShowApproveModal(true);
  };

  const handleApprove = async (submissionId: string) => {
    if (!approveData) return;
    if (approvingRef.current) return; // sync guard: block before React re-renders

    if (!reviewingTask) {
      return;
    }

    if (!reviewingTask.userId || !reviewingTask.date) {
      return;
    }

    approvingRef.current = true;
    try {
      setApproving(true);

      await verifyTrainingTask(
        reviewingTask.userId,
        reviewingTask.date,
        TRAINING_POINT_REQUEST_STATUS.APPROVED,
        user?.characterId || 'admin'
      );

      // Apps Script verifyTraining already awards base TP + fortune bonus (withFullLevelFortune ? 2 : 1).
      // Only award extra TPs here for Athena blessing (+1) and Athena+Fortune combo (+1).
      const baseTP = approveData.withFullLevelFortune ? 2 : 1;
      let pointsAwarded = 0;
      if (approveData.isTraineeBlessedByAthena && approveData.reward > 0) {
        pointsAwarded += 1;
      }
      if (approveData.isTraineeBlessedByAthena && approveData.withFullLevelFortune && approveData.reward > 0) {
        pointsAwarded += 1;
      }

      // Log the base TP that Apps Script awarded (it can't call Firestore itself)
      logActivity({
        category: 'stat',
        action: ACTIVITY_LOG_ACTIONS.APPROVE_TRAINING,
        characterId: reviewingTask.userId,
        performedBy: user?.characterId || 'admin',
        amount: baseTP,
        metadata: {
          source: 'admin_training_approval',
          date: reviewingTask.date,
          withFullLevelFortune: approveData.withFullLevelFortune,
          isAthena: approveData.isTraineeBlessedByAthena,
          athenaBonus: pointsAwarded,
          totalTP: baseTP + pointsAwarded,
        },
      });

      if (pointsAwarded > 0) {
        await updateTrainingPoints(reviewingTask.userId, pointsAwarded, {
          performedBy: user?.characterId || 'admin',
          source: 'admin_training_approval_athena_bonus',
        });
      }

    } catch (error) {
      // console.error('Failed to approve training task:', error);
      approvingRef.current = false;
      return;
    } finally {
      setApproving(false);
    }

    setTrainingTasks((prev) =>
      prev.map((t) =>
        t.id === submissionId
          ? {
            ...t,
            verified: TRAINING_POINT_REQUEST_STATUS.APPROVED,
            verifiedAt: new Date().toISOString(),
            verifiedBy: user?.characterId || 'admin',
          }
          : t
      )
    );

    setShowApproveModal(false);
    setApproveData(null);

    const pendingCount = trainingTasks.filter(
      (t) => {
        const isCurrent = reviewingTask ? t.id === reviewingTask.id : false;
        const hasSubmission = (t.roleplay && t.roleplay.trim() !== '') || (t.tickets || 0) >= 5 || t.mode === PRACTICE_MODE.PVP;
        return t.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && hasSubmission && !isCurrent;
      }
    ).length;

    if (pendingCount > 0) {
      setSuccessMessage(`Approved successfully!\nMoving to next pending submission...`);
    } else {
      setSuccessMessage('Approved successfully!\nNo more pending submissions.');
    }
    setShowSuccessModal(true);

    setTimeout(() => {
      setShowSuccessModal(false);
      navigateToNextPending();
    }, 2000);
    approvingRef.current = false;
  };

  const handleRejectClick = () => {
    setShowRejectModal(true);
  };

  const handleReject = async (submissionId: string) => {
    if (!reviewingTask) {
      return;
    }

    if (!reviewingTask.userId || !reviewingTask.date) {
      return;
    }

    try {
      await verifyTrainingTask(
        reviewingTask.userId,
        reviewingTask.date,
        TRAINING_POINT_REQUEST_STATUS.REJECTED,
        user?.characterId || 'admin'
      );
      logActivity({
        category: 'stat',
        action: ACTIVITY_LOG_ACTIONS.REJECT_TRAINING,
        characterId: reviewingTask.userId,
        performedBy: user?.characterId || 'admin',
        amount: 0,
        metadata: { source: 'admin_training_approval', date: reviewingTask.date },
      });
    } catch (error) {
      // console.error('Failed to reject training task:', error);
      return;
    }

    setTrainingTasks((prev) =>
      prev.map((t) =>
        t.id === submissionId
          ? {
            ...t,
            verified: TRAINING_POINT_REQUEST_STATUS.REJECTED,
            verifiedAt: new Date().toISOString(),
            verifiedBy: user?.characterId || 'admin',
          }
          : t
      )
    );

    setShowRejectModal(false);
    const pendingCount = trainingTasks.filter((t) => {
      const isCurrent = reviewingTask ? t.id === reviewingTask.id : false;
      const hasSubmission = (t.roleplay && t.roleplay.trim() !== '') || (t.tickets || 0) >= 5 || t.mode === PRACTICE_MODE.PVP;
      return t.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && hasSubmission && !isCurrent;
    }).length;

    if (pendingCount > 0) {
      setSuccessMessage('Rejected successfully!\nMoving to next pending submission...');
    } else {
      setSuccessMessage('Rejected successfully!\nNo more pending submissions.');
    }
    setShowSuccessModal(true);

    setTimeout(() => {
      setShowSuccessModal(false);
      navigateToNextPending();
    }, 2000);
  };

  const handleCopyExtractorScript = async () => {
    try {
      await navigator.clipboard.writeText(
        THREAD_EXTRACTOR_SCRIPT
      );
      setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.SUCCESS);
    } catch {
      setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.ERROR);
    }

    setTimeout(
      () => setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.IDLE),
      2000
    );
  };

  const handleCopyResultScript = async () => {
    try {
      await navigator.clipboard.writeText(COPY_RESULT_SCRIPT);
      setScriptResultCopyStatus(HARVEST_SCRIPT_COPY_STATUS.SUCCESS);
    } catch {
      setScriptResultCopyStatus(HARVEST_SCRIPT_COPY_STATUS.ERROR);
    }

    setTimeout(
      () => setScriptResultCopyStatus(HARVEST_SCRIPT_COPY_STATUS.IDLE),
      2000
    );
  };

  const colorStyle = useMemo(() => {
    const primaryColor = (!isNearWhite(user?.theme[0]) ? user?.theme[0] : undefined) || DEITY_THEMES[user?.deityBlood?.toLowerCase() as any]?.[0] || '#C0A062';
    const darkColor = (!isNearWhite(user?.theme[1]) ? user?.theme[1] : undefined) || DEITY_THEMES[user?.deityBlood?.toLowerCase() as any]?.[1] || '#2c2c2c';
    return {
      '--primary-color': primaryColor,
      '--primary-color-rgb': hexToRgb(primaryColor),
      '--dark-color': darkColor,
      '--dark-color-rgb': hexToRgb(darkColor),
      '--text-color': contrastText(darkColor),
      '--light-color': user?.theme[2] || '#f5f5f5',
      '--surface-hover': user?.theme[11] || '#e8e8e8',
      '--overlay-text': user?.theme[17] || '#333333',
      '--accent-dark': user?.theme[19] || '#0f1a2e',
      '--accent-dark-rgb': hexToRgb(user?.theme[19] || '#0f1a2e'),
    } as React.CSSProperties;
  }, [user?.theme, user?.characterId]);

  return (
    <div className="harvest-approval" style={colorStyle}>
      {/* Layout */}
      <div className={`training-approval__container ${sidebarOpen ? 'training-approval__container--sidebar-open' : ''}`}>
        {/* Main */}
        <main className="training-approval__main">
          {/* Top bar */}
          <header className="training-approval__bar">
            <div className="training-approval__bar-title">
              {reviewingTask?.id
                ? `${getCharacterName(reviewingTask.userId)}'s training on ${formatAppDate(reviewingTask.date)}`
                : 'Task Submissions'}
            </div>
            {/* Mobile toggle */}
            <button className={`training-approval__bar-chevron ${sidebarOpen ? 'training-approval__bar-chevron--open' : ''}`} onClick={() => setSidebarOpen(true)}>
              <ChevronLeft />
            </button>
          </header>

          {/* Review area */}
          <div className="training-approval__review-area">
            {BG_ELEMENTS}
            {loading ? (
              <div className="training-approval__review-loading">Loading...</div>
            ) : loadError ? (
              <div className="training-approval__review-error">Something went wrong</div>
            ) : reviewingTask ? (
              (() => {
                const isPvPTask = reviewingTask.mode === PRACTICE_MODE.PVP;
                const isTicketOnly = !isPvPTask && (reviewingTask.tickets || 0) >= 5 && (!reviewingTask.roleplay || reviewingTask.roleplay.trim() === '');
                if (isPvPTask) {
                  const trainee = characters.find((c) => c.characterId === reviewingTask.userId);
                  return (
                    <div className="training-approval__review-sheet">
                      <div className="training-approval__review-section training-approval__review-section--result">
                        <div className="training-approval__review-section-header">
                          <span className="training-approval__review-section-title">PvP Battle Submission</span>
                        </div>
                        <div className="training-approval__review-section-content">
                          <div style={{ marginBottom: '0.75rem', opacity: 0.8 }}>
                            This is a PvP practice battle — no roleplay thread required.
                          </div>

                          {/* Trainee */}
                          <div className="training-approval__trainee">
                            <div className="training-approval__trainee-avatar">
                              {trainee ? (
                                <img src={trainee.image} alt={getCharacterName(trainee.characterId)} referrerPolicy="no-referrer" />
                              ) : (
                                <span>{getCharacterName(reviewingTask.userId)[0]?.toUpperCase() || '?'}</span>
                              )}
                            </div>
                            <span className="training-approval__trainee-name">
                              <b>Trainee </b>
                              {trainee ? `${trainee.nameEng} (${trainee.nicknameEng})` : getCharacterName(reviewingTask.userId)}
                            </span>
                          </div>

                          {/* Battle stats */}
                          <div className="training-approval__stats">
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Result</span>
                              <span className="training-approval__stat-value" style={{ color: reviewingTask.success ? '#2ecc71' : '#e74c3c' }}>
                                {reviewingTask.success ? 'Win' : 'Loss'}
                              </span>
                            </div>
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Opponent</span>
                              <span className="training-approval__stat-value">{reviewingTask.opponentName || reviewingTask.opponentId || '—'}</span>
                            </div>
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Rounds</span>
                              <span className="training-approval__stat-value">{reviewingTask.battleRounds ?? '—'}</span>
                            </div>
                          </div>

                          <div className="training-approval__result">
                            <div className="training-approval__result-title">Training Status</div>
                            <div className="training-approval__result-status training-approval__result-status--pass">
                              <span className="training-approval__result-status-head">✓ BATTLE COMPLETED</span>
                              <small style={{ opacity: 0.8, fontWeight: 500 }}>PvP awards TP for both win and loss</small>
                            </div>
                          </div>

                          {/* Fortune blessing */}
                          {reviewingTask.withFullLevelFortune && (
                            <div
                              className="training-approval__fortune-blessing"
                              style={{
                                '--fortune-primary-color': PRACTICE_STATES_DETAIL[5].color,
                                '--fortune-primary-color-rgb': hexToRgb(PRACTICE_STATES_DETAIL[5].color),
                                '--fortune-dark-color': rgbToHex(darken(PRACTICE_STATES_DETAIL[5].color, 0.5)),
                                '--fortune-dark-color-rgb': hexToRgb(darken(PRACTICE_STATES_DETAIL[5].color, 0.5))
                              } as CSSProperties}
                            >
                              <div className="training-approval__fortune-blessing-header">
                                <div className="training-approval__fortune-blessing-icon"><Crown /></div>
                                <span>This trainee had max Fortune (level 5) on the training day!</span>
                              </div>
                              <div className="training-approval__fortune-blessing-content">
                                Full Fortune grants an extra training point for this submission.
                              </div>
                            </div>
                          )}

                          {/* Athena blessing */}
                          {isTraineeBlessedByAthena && (
                            <div
                              className="training-approval__athena-blessing"
                              style={{
                                '--athena-primary-color': DEITY_THEMES[DEITY.ATHENA.toLowerCase()][0],
                                '--athena-primary-color-rgb': hexToRgb(DEITY_THEMES[DEITY.ATHENA.toLowerCase()][0]),
                                '--athena-dark-color': DEITY_THEMES[DEITY.ATHENA.toLowerCase()][1],
                                '--athena-dark-color-rgb': hexToRgb(DEITY_THEMES[DEITY.ATHENA.toLowerCase()][1]),
                              } as CSSProperties}
                            >
                              <div className="training-approval__athena-blessing-header">
                                <div className="training-approval__athena-blessing-icon"><Athena /></div>
                                <span>Goddess Athena has blessed this trainee on the training day!</span>
                              </div>
                              <div className="training-approval__athena-blessing-content">
                                As a blessing from Athena, this trainee's will receive 2 training point reward for this submission.
                              </div>
                            </div>
                          )}

                          {/* Quick Reject */}
                          <div className="training-approval__quick-reject" style={{ marginTop: '0.5rem' }}>
                            <div className="training-approval__quick-reject-content">
                              <span className="training-approval__quick-reject-label">Need to reject this submission?</span>
                              <button className="training-approval__quick-reject-btn" onClick={handleRejectClick}>Reject Submission</button>
                            </div>
                          </div>

                          <div className="training-approval__actions">
                            <button
                              className="training-approval__action-btn training-approval__action-btn--approve"
                              onClick={handleApproveClick}
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                if (isTicketOnly) {
                  const trainee = characters.find((c) => c.characterId === reviewingTask.userId);
                  return (
                    <div className="training-approval__review-sheet">
                      <div className="training-approval__review-section training-approval__review-section--result">
                        <div className="training-approval__review-section-header">
                          <span className="training-approval__review-section-title">Ticket-Only Submission</span>
                        </div>
                        <div className="training-approval__review-section-content">
                          <div style={{ marginBottom: '0.75rem', opacity: 0.8 }}>
                            This submission uses <strong>5 tickets</strong> — no roleplay required.
                          </div>

                          {/* Trainee */}
                          <div className="training-approval__trainee">
                            <div className="training-approval__trainee-avatar">
                              {trainee ? (
                                <img src={trainee.image} alt={getCharacterName(trainee.characterId)} referrerPolicy="no-referrer" />
                              ) : (
                                <span>{getCharacterName(reviewingTask.userId)[0]?.toUpperCase() || '?'}</span>
                              )}
                            </div>
                            <span className="training-approval__trainee-name">
                              <b>Trainee </b>
                              {trainee
                                ? `${trainee.nameEng} (${trainee.nicknameEng})`
                                : getCharacterName(reviewingTask.userId)}
                            </span>
                          </div>

                          {/* Stats */}
                          <div className="training-approval__stats">
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Tickets Used</span>
                              <span className="training-approval__stat-value">{reviewingTask.tickets}</span>
                            </div>
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Ticket Bonus</span>
                              <span className="training-approval__stat-value">+{reviewingTask.tickets * 200}</span>
                            </div>
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Total</span>
                              <span className="training-approval__stat-value">{reviewingTask.tickets * 200}</span>
                            </div>
                          </div>

                          <div className="training-approval__result">
                            <div className="training-approval__result-title">Training Status</div>
                            <div className="training-approval__result-status training-approval__result-status--pass">
                              <span className="training-approval__result-status-head">✓ PASSED</span>
                              <small style={{ opacity: 0.8, fontWeight: 500 }}>5 tickets = 1,000 characters (fully waived)</small>
                            </div>
                          </div>

                          {/* Fortune blessing */}
                          {reviewingTask.withFullLevelFortune && (
                            <div
                              className="training-approval__fortune-blessing"
                              style={{
                                '--fortune-primary-color': PRACTICE_STATES_DETAIL[5].color,
                                '--fortune-primary-color-rgb': hexToRgb(PRACTICE_STATES_DETAIL[5].color),
                                '--fortune-dark-color': rgbToHex(darken(PRACTICE_STATES_DETAIL[5].color, 0.5)),
                                '--fortune-dark-color-rgb': hexToRgb(darken(PRACTICE_STATES_DETAIL[5].color, 0.5))
                              } as CSSProperties}
                            >
                              <div className="training-approval__fortune-blessing-header">
                                <div className="training-approval__fortune-blessing-icon"><Crown /></div>
                                <span>This trainee had max Fortune (level 5) on the training day!</span>
                              </div>
                              <div className="training-approval__fortune-blessing-content">
                                Full Fortune grants an extra training point for this submission.
                              </div>
                            </div>
                          )}

                          {/* Athena blessing */}
                          {isTraineeBlessedByAthena && (
                            <div
                              className="training-approval__athena-blessing"
                              style={{
                                '--athena-primary-color': DEITY_THEMES[DEITY.ATHENA.toLowerCase()][0],
                                '--athena-primary-color-rgb': hexToRgb(DEITY_THEMES[DEITY.ATHENA.toLowerCase()][0]),
                                '--athena-dark-color': DEITY_THEMES[DEITY.ATHENA.toLowerCase()][1],
                                '--athena-dark-color-rgb': hexToRgb(DEITY_THEMES[DEITY.ATHENA.toLowerCase()][1]),
                              } as CSSProperties}
                            >
                              <div className="training-approval__athena-blessing-header">
                                <div className="training-approval__athena-blessing-icon"><Athena /></div>
                                <span>Goddess Athena has blessed this trainee on the training day!</span>
                              </div>
                              <div className="training-approval__athena-blessing-content">
                                As a blessing from Athena, this trainee's will receive 2 training point reward for this submission.
                              </div>
                            </div>
                          )}

                          {/* Quick Reject */}
                          <div className="training-approval__quick-reject" style={{ marginTop: '0.5rem' }}>
                            <div className="training-approval__quick-reject-content">
                              <span className="training-approval__quick-reject-label">Need to reject this submission?</span>
                              <button className="training-approval__quick-reject-btn" onClick={handleRejectClick}>Reject Submission</button>
                            </div>
                          </div>

                          <div className="training-approval__actions">
                            <button
                              className="training-approval__action-btn training-approval__action-btn--approve"
                              onClick={handleApproveClick}
                            >
                              Approve
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                <div className="training-approval__review-sheet">
                  {/* 1. Open link of tweet */}
                  <div className="training-approval__review-section">
                    <div className="training-approval__review-section-header">
                      <span className='training-approval__review-section-number'>1</span>
                      <span className='training-approval__review-section-title'>Open link of tweet</span>
                      <button
                        className="training-approval__open-link-btn"
                        onClick={() => {
                          if (reviewingTask?.roleplay && reviewingTask.roleplay.trim() !== '') {
                            window.open(reviewingTask.roleplay, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        data-tooltip={"Open"}
                        data-tooltip-pos="left"
                      >
                        <OpenLink />
                      </button>
                    </div>
                    <div className="training-approval__review-section-content">
                      Open the submitted thread link in a new tab. Make sure the thread is accessible, complete, and not deleted or restricted.
                      Review the overall conversation flow to ensure it is a valid roleplay interaction and not spam, duplicate content, or unrelated posts.
                    </div>
                  </div>

                  {/* Quick Reject Option */}
                  {reviewingTask && (
                    <div className="training-approval__quick-reject">
                      <div className="training-approval__quick-reject-content">
                        <span className="training-approval__quick-reject-label">
                          Need to reject this submission?
                        </span>
                        <button
                          className="training-approval__quick-reject-btn"
                          onClick={handleRejectClick}
                        >
                          Reject Submission
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Open console */}
                  <div className="training-approval__review-section">
                    <div className="training-approval__review-section-header">
                      <span className='training-approval__review-section-number'>2</span>
                      <span className='training-approval__review-section-title'>Open console</span>
                    </div>
                    <div className="training-approval__review-section-content">
                      Open your browser's developer console using any of these methods:
                      <br />
                      <div className="training-approval__console-options">
                        <div className="training-approval__option-box">
                          <span className="training-approval__option-box-title">Option 1: Right-click</span>
                          <div className="training-approval__option-box-steps">
                            • Right-click anywhere on the page
                            <br />• Click <strong>"Inspect"</strong>
                            <br />• Go to the <strong>Console</strong> tab
                          </div>
                        </div>

                        <div className="training-approval__option-box">
                          <span className="training-approval__option-box-title">Option 2: Menu</span>
                          <div className="training-approval__option-box-steps">
                            • Click the <strong>⋮ (three-dot menu)</strong>
                            <br />• Go to <strong>More tools → Developer tools</strong>
                            <br />• Switch to the <strong>Console</strong> tab
                          </div>
                        </div>

                        <div className="training-approval__option-box">
                          <span className="training-approval__option-box-title">Option 3: Shortcut</span>
                          <div className="training-approval__option-box-steps">
                            • Windows: <strong>F12</strong> or <strong>Ctrl + Shift + I</strong>
                            <br />• Mac: <strong>Cmd + Option + I</strong>
                          </div>
                        </div>
                      </div>
                      <br />
                      Make sure you are on the <strong>Console</strong> tab before running the script.
                    </div>
                  </div>

                  {/* 3. Copy Thread Extractor Script */}
                  <div className="training-approval__review-section">
                    <div className="training-approval__review-section-header">
                      <span className='training-approval__review-section-number'>3</span>
                      <span className='training-approval__review-section-title'>Thread Extractor</span>
                      <button
                        className={`training-approval__copy-btn training-approval__copy-btn--${scriptCopyStatus.toLowerCase()}`}
                        onClick={handleCopyExtractorScript}
                      >
                        <CopyIcon />
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                      </button>
                    </div>
                    <div className="training-approval__review-section-content">
                      Click <strong>Copy Script</strong> and paste it into the browser console, then press <b>Enter</b>.
                      Wait for the script to scan through the entire thread and extract all tweets.
                    </div>
                  </div>

                  {/* 4. Copy Result Script */}
                  <div className="training-approval__review-section">
                    <div className="training-approval__review-section-header">
                      <span className='training-approval__review-section-number'>4</span>
                      <span className='training-approval__review-section-title'>Result Copy</span>
                      <button
                        className={`training-approval__copy-btn training-approval__copy-btn--${scriptResultCopyStatus.toLowerCase()}`}
                        onClick={handleCopyResultScript}
                      >
                        <CopyIcon />
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                      </button>
                    </div>
                    <div className="training-approval__review-section-content">
                      After the thread extractor finishes, click <strong>Copy Script</strong> and paste it into the console, then press <b>Enter</b>.
                      This will copy the extracted thread content to your clipboard.
                    </div>
                  </div>

                  {/* 5. Paste script output */}
                  <div className="training-approval__review-section">
                    <div className="training-approval__review-section-header">
                      <span className='training-approval__review-section-number'>5</span>
                      <span className='training-approval__review-section-title'>Paste Script Output</span>
                    </div>
                    <div className="training-approval__review-section-content">
                      Paste the extracted thread content into the textarea below.
                      This data will be used to calculate character count and complete the training approval process.
                    </div>
                    <textarea
                      className="training-approval__review-section-content training-approval__review-section-content--textarea"
                      placeholder="Paste script output here"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      required
                    />
                  </div>

                  {/* 6. Review Harvest Result */}
                  {reviewText.trim() && (() => {
                    const traineeUsername = reviewingTask
                      ? extractTwitterHandle(characters.find((c) => c.characterId === reviewingTask.userId)?.twitter || '')
                      : null;
                    const scriptParsed = parseScriptOutput(reviewText, traineeUsername || undefined);

                    if (!scriptParsed) {
                      return (
                        <div className="training-approval__review-section">
                          <div className="training-approval__review-section-header">
                            <span className='training-approval__review-section-number'>6</span>
                            <span className='training-approval__review-section-title'>Review Harvest Result</span>
                          </div>
                          <div className="training-approval__review-section-content">
                            <div className="training-approval__error-message">
                              Invalid script output format. Please paste the correct output from the console.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const charCount = countCharacters(scriptParsed.text);
                    const finalCount = charCount + (reviewingTask.tickets || 0) * 200;

                    return (
                      <div className="training-approval__review-section training-approval__review-section--result">
                        <div className="training-approval__review-section-header">
                          <span className='training-approval__review-section-number'>6</span>
                          <span className='training-approval__review-section-title'>Review Harvest Result</span>
                        </div>
                        <div className="training-approval__review-section-content">

                          {/* Trainee */}
                          <div className="training-approval__trainee">
                            <div className="training-approval__trainee-avatar">
                              {trainee ? (
                                <img src={trainee.image} alt={getCharacterName(trainee.characterId)} referrerPolicy="no-referrer" />
                              ) : (
                                <span>{getCharacterName(reviewingTask.userId)[0]?.toUpperCase() || '?'}</span>
                              )}
                            </div>
                            <span className="training-approval__trainee-name">
                              <b>{lang === LANGUAGE.ENGLISH ? 'Trainee ' : 'ผู้เข้ารับการฝึก '}</b>
                              {lang === LANGUAGE.ENGLISH
                                ? `${trainee?.nameEng} (${trainee?.nicknameEng})`
                                : `${trainee?.nameThai} (${trainee?.nicknameThai})`
                                || getCharacterName(reviewingTask.userId)}
                            </span>
                          </div>

                          {/* Statistics */}
                          <div className="training-approval__stats">
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">{width > 420 ? 'Character Count' : 'Chars'}</span>
                              <span className="training-approval__stat-value">{charCount.toLocaleString()}</span>
                            </div>
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">{width > 420 ? 'Tweet Count' : 'Tweets'}</span>
                              <span className="training-approval__stat-value">{scriptParsed.tweetCount}</span>
                            </div>
                            <div className="training-approval__stat-item">
                              <span className="training-approval__stat-label">Tickets</span>
                              <span className="training-approval__stat-value">{reviewingTask.tickets || 0}</span>
                            </div>
                          </div>

                          <div className="training-approval__reward-calc__wrapper">
                            {/* Character Count Calculation */}
                            <div className="training-approval__reward-calc">
                              <div className="training-approval__reward-row">
                                <span className="training-approval__reward-label">Character Count</span>
                                <span className="training-approval__reward-value">
                                  {charCount} chars
                                </span>
                              </div>
                              <div className="training-approval__reward-row training-approval__reward-row--bonus">
                                <span className="training-approval__reward-label">Ticket Bonus</span>
                                <span className="training-approval__reward-value">
                                  {reviewingTask.tickets > 0 ? (
                                    `${reviewingTask.tickets} ticket${reviewingTask.tickets > 1 ? 's' : ''} (+${reviewingTask.tickets * 200} chars)`
                                  ) : '0 tickets'}
                                </span>
                              </div>
                              <div className="training-approval__reward-row training-approval__reward-row--total">
                                <span className="training-approval__reward-label">Total Characters</span>
                                <span className="training-approval__reward-value">
                                  {finalCount}
                                </span>
                              </div>
                            </div>

                            {/* Training Pass/Fail Status */}
                            <div className="training-approval__result">
                              <div className="training-approval__result-title">
                                Training Status
                              </div>
                              {(() => {
                                const trainingCheck = checkTrainingPass(charCount, reviewingTask.tickets || 0);
                                return (
                                  <div className={`training-approval__result-status ${trainingCheck.passes ? 'training-approval__result-status--pass' : 'training-approval__result-status--fail'}`}>
                                    {trainingCheck.passes ? (
                                      <>
                                        <span className="training-approval__result-status-head">✓ PASSED</span>
                                        <small style={{ opacity: 0.8, fontWeight: 500 }}>
                                          Total: {trainingCheck.totalChars} characters
                                        </small>
                                      </>
                                    ) : (
                                      <>
                                        <span className="training-approval__result-status-head">✗ FAILED</span>
                                        <small style={{ opacity: 0.8, fontWeight: 500 }}>
                                          Need {trainingCheck.charsNeeded} more characters to pass
                                        </small>
                                      </>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          {/* If trainee had full Fortune */}
                          {reviewingTask.withFullLevelFortune && (
                            <div
                              className="training-approval__fortune-blessing"
                              style={{
                                '--fortune-primary-color': PRACTICE_STATES_DETAIL[5].color,
                                '--fortune-primary-color-rgb': hexToRgb(PRACTICE_STATES_DETAIL[5].color),
                                '--fortune-dark-color': rgbToHex(darken(PRACTICE_STATES_DETAIL[5].color, 0.5)),
                                '--fortune-dark-color-rgb': hexToRgb(darken(PRACTICE_STATES_DETAIL[5].color, 0.5))
                              } as CSSProperties}
                            >
                              <div className="training-approval__fortune-blessing-header">
                                <div className="training-approval__fortune-blessing-icon">
                                  <Crown />
                                </div>
                                <span>This trainee had max Fortune (level 5) on the training day!</span>
                              </div>
                              <div className="training-approval__fortune-blessing-content">
                                Full Fortune grants an extra training point for this submission.
                              </div>
                            </div>
                          )}

                          {/* If trainee have blessed by Athena */}
                          {isTraineeBlessedByAthena && (
                            <div
                              className="training-approval__athena-blessing"
                              style={{
                                '--athena-primary-color': DEITY_THEMES[DEITY.ATHENA.toLowerCase()][0],
                                '--athena-primary-color-rgb': hexToRgb(DEITY_THEMES[DEITY.ATHENA.toLowerCase()][0]),
                                '--athena-dark-color': DEITY_THEMES[DEITY.ATHENA.toLowerCase()][1],
                                '--athena-dark-color-rgb': hexToRgb(DEITY_THEMES[DEITY.ATHENA.toLowerCase()][1]),
                              } as CSSProperties}
                            >

                              <div className="training-approval__athena-blessing-header">
                                <div className="training-approval__athena-blessing-icon">
                                  <Athena />
                                </div>
                                <span>Goddess Athena has blessed this trainee on the training day!</span>
                              </div>
                              <div className="training-approval__athena-blessing-content">
                                As a blessing from Athena, this trainee's will receive 2 training point reward for this submission.
                              </div>
                            </div>
                          )}

                          {/* Actions */}
                          {reviewingTask && (
                            <div className="training-approval__actions">
                              <button
                                className="training-approval__action-btn training-approval__action-btn--approve"
                                onClick={handleApproveClick}
                                disabled={!checkTrainingPass(charCount, reviewingTask.tickets || 0).passes}
                              >
                                Approve
                              </button>
                              <button
                                className="training-approval__action-btn training-approval__action-btn--reject"
                                onClick={handleRejectClick}
                                disabled={checkTrainingPass(charCount, reviewingTask.tickets || 0).passes}
                              >
                                Reject Submission
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              );
              })()
            ) : (
              <div className="training-approval__empty-state">
                <div className="training-approval__empty-state-icon">✓</div>
                <div className="training-approval__empty-state-title">All caught up!</div>
                <div className="training-approval__empty-state-message">
                  {trainingTasks.filter(t => t.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && ((t.roleplay && t.roleplay.trim() !== '') || (t.tickets || 0) >= 5 || t.mode === PRACTICE_MODE.PVP)).length === 0
                    ? "No pending submissions to review."
                    : "Select a submission from the sidebar to review."}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`training-approval__sidebar ${sidebarOpen ? 'training-approval__sidebar--open' : ''}`}>
          <div className="training-approval__sidebar__head">
            <div className="training-approval__sidebar__head-tabs">
              {Object.values(TRAINING_POINT_REQUEST_STATUS).map((status) => (
                <button
                  key={status}
                  className={`training-approval__sidebar__tab training-approval__sidebar__tab--${status.toLowerCase()}${sidebarView === status ? '--active' : ''}`}
                  onClick={() => setSidebarView(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <button className="training-approval__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>

          {sidebarView === TRAINING_POINT_REQUEST_STATUS.PENDING && trainingTasks.filter((t) => t.verified === TRAINING_POINT_REQUEST_STATUS.PENDING && ((t.roleplay && t.roleplay.trim() !== '') || (t.tickets || 0) >= 5 || t.mode === PRACTICE_MODE.PVP)).length > 0 && (
            <div className="training-approval__sidebar__note">
              <InfoCircle />
              Click on a submission to review.
            </div>
          )}

          <div className="training-approval__sidebar__content">
            {loading ? (
              <div className="training-approval__sidebar__content--loading">Loading...</div>
            ) : loadError ? (
              <div className="training-approval__sidebar__content--error">Something went wrong</div>
            ) : trainingTasks.filter((s) => s.verified === sidebarView).length === 0 ? (
              <div className="training-approval__sidebar__content--empty">No submissions found</div>
            ) : (
              trainingTasks
                .filter((s) => s.verified === sidebarView)
                .map((task) => {
                  const readyForReview = (task.roleplay && task.roleplay.trim() !== '') || (task.tickets || 0) >= 5 || task.mode === PRACTICE_MODE.PVP;
                  return (
                    <SubmissionCard
                      key={task.id}
                      task={task}
                      focused={reviewingTask?.id === task.id}
                      onClick={sidebarView === TRAINING_POINT_REQUEST_STATUS.PENDING ? () => {
                        setReviewingTask(task);
                        setReviewText('');

                        if (width < 900) setSidebarOpen(false);
                      } : undefined}
                      disabled={!readyForReview}
                      forcedCompact
                    />
                  );
                })
            )}
          </div>
        </aside>
      </div>

      <ApproveModal
        show={showApproveModal && !!approveData && !!reviewingTask}
        approveData={approveData}
        onClose={() => setShowApproveModal(false)}
        onConfirm={() => reviewingTask && handleApprove(reviewingTask.id)}
        approving={approving}
      />

      <RejectModal
        show={showRejectModal && !!reviewingTask}
        onClose={() => setShowRejectModal(false)}
        onConfirm={() => reviewingTask && handleReject(reviewingTask.id)}
      />

      <SuccessModal
        show={showSuccessModal}
        message={successMessage}
      />
    </div>
  );
}

export default TrainingApproval;
