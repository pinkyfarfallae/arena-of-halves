import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import './TrainWithAdmin.scss';
import { useAuth } from '../../../../hooks/useAuth';
import { Link, useNavigate } from 'react-router-dom';
import DoorExit from '../../../IrisMessage/icons/DoorExit';
import { hexToRgb, isNearWhite, contrastText } from '../../../../utils/color';
import { DEITY_THEMES } from '../../../../data/characters';
import { db } from '../../../../firebase';
import { get, ref } from 'firebase/database';
import {
  getTodayTargets,
  savePartialProgress,
  completeTraining,
  getTodayProgress,
  UserDailyProgress,
  TrainingTask,
  checkSuccessWithTargets,
  fetchUserTrainingTasks,
  canUserTrain,
  TrainingValidation,
} from '../../../../services/training/dailyTrainingDice';
import { BG_ELEMENTS } from '../../components/Background/Background';
import EarlyFailModal from './components/EarlyFailModal/EarlyFailModal';
import EarlyWinModal from './components/EarlyWinModal/EarlyWinModal';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import { PRACTICE_MODE, PRACTICE_STATES } from '../../../../constants/practice';
import { getTodayDate } from '../../../../utils/date';
import { useDailyTrigger } from '../../../../hooks/useDailyTrigger';
import BeyondTodayPracticeModal from '../../../Arena/components/BeyondTodayPracticeModal/BeyondTodayPracticeModal';
import { DieNoticeModal } from './components/DieNoticeModal/DieNoticeModal';
import { fetchActiveTodayIrisWish } from '../../../../data/wishes';
import { DEITY } from '../../../../constants/deities';
import { useBag } from '../../../../hooks/useBag';
import { ITEMS } from '../../../../constants/items';
import Shirt from '../../../../icons/Shirt';
import { ZeusOrPoseidonNoticeModal } from './components/ZeusOrPoseidonNoticeModal/ZeusOrPoseidonNoticeModal';
import { tycheAdvantageRoll } from '../../../../utils/getDiceSize';
import Zeus from '../../../../data/icons/deities/Zeus';
import Poseidon from '../../../../data/icons/deities/Poseidon';
interface PaperRoll {
  target: number;
  roll: number | null;
  rolled: boolean;

}

export default function TrainWithAdmin() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { bagEntries } = useBag(user?.characterId || '');

  const [targets, setTargets] = useState<number[] | null>(null);
  const [papers, setPapers] = useState<PaperRoll[]>([]);
  const [currentRollIndex, setCurrentRollIndex] = useState<number>(0);
  const [alreadyTrained, setAlreadyTrained] = useState<boolean>(false);
  const [sheetTask, setSheetTask] = useState<TrainingTask | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [finalResult, setFinalResult] = useState<{ success: boolean; rolls: number[] } | null>(null);
  const [showEarlyFailModal, setShowEarlyFailModal] = useState<boolean>(false);
  const [showEarlyWinModal, setShowEarlyWinModal] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  // eslint-disable-next-line
  const [_quotaUsed, setQuotaUsed] = useState<boolean>(false);
  const [validation, setValidation] = useState<TrainingValidation | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const [die, setDie] = useState<10 | 12 | 20>(12);
  const [beyondTodayPractice, setBeyondTodayPractice] = useState(false);
  const [showDieNotice, setShowDieNotice] = useState(false);

  const [isZeusDebuff, setIsZeusDebuff] = useState(false);
  const [isPoseidonBuff, setIsPoseidonBuff] = useState(false);
  const [zeusOrPoseidonNotice, setZeusOrPoseidonNotice] = useState(false);

  const hasCampTShirt = (bagEntries.find(entry => entry.itemId === ITEMS.CAMP_TSHIRT)?.amount || 0) > 0;

  useDailyTrigger(() => {
    setBeyondTodayPractice(true);
  });

  const loadTodayData = useCallback(async () => {
    setLoading(true);

    if (!user?.characterId) {
      setLoading(false);
      return;
    }

    try {
      setError('');
      setSheetTask(null);
      setLivePractice(null);
      setFinalResult(null);
      setShowEarlyFailModal(false);
      setShowEarlyWinModal(false);
      setQuotaUsed(false);
      setIsZeusDebuff(false);
      setIsPoseidonBuff(false);
      setZeusOrPoseidonNotice(false);

      // Load all 5 today's targets
      const todayTargets = await getTodayTargets();
      setTargets(todayTargets);

      const [trainings, todayProgress, todayUserIrisWish] = await Promise.all([
        fetchUserTrainingTasks(user.characterId).catch(() => [] as TrainingTask[]),
        getTodayProgress(user.characterId).catch(() => null),
        fetchActiveTodayIrisWish(user?.characterId).catch(() => null),
      ]);

      const deity = todayUserIrisWish?.deity;

      if (deity === DEITY.HYPNOS) {
        setDie(10);
        setShowDieNotice(true);
      } else if (deity === DEITY.TYCHE) {
        setDie(20);
        setShowDieNotice(true);
      } else {
        setDie(12);
      }

      if (deity === DEITY.ZEUS) {
        setIsZeusDebuff(true);
        setZeusOrPoseidonNotice(true);
      } else if (deity === DEITY.POSEIDON) {
        setIsPoseidonBuff(true);
        setZeusOrPoseidonNotice(true);
      }

      setLivePractice(todayProgress);
      const todayDate = getTodayDate();
      const todaySheetTask = [...trainings].reverse().find((training) => training.date === todayDate && training.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED) || null;
      setSheetTask(todaySheetTask);

      const quotaDoc = await get(ref(db, `trainingQuotas/${user.characterId}/${getTodayDate()}`)).catch(() => null);
      setQuotaUsed(!!quotaDoc?.exists());

      // Check comprehensive validation
      const validationResult = await canUserTrain(user.characterId, PRACTICE_MODE.NORMAL);
      setValidation(validationResult);

      if (todayTargets && todayTargets.length === 5) {
        // Initialize papers with targets
        const initialPapers: PaperRoll[] = todayTargets.map(target => ({
          target,
          roll: null,
          rolled: false,
        }));
        setPapers(initialPapers);
      }

      const progress = todayProgress;
      const isCompletedTraining = (progress?.mode === PRACTICE_MODE.NORMAL && progress?.state === PRACTICE_STATES.FINISHED) ||
        (progress?.mode === PRACTICE_MODE.PVP && progress?.state === PRACTICE_STATES.FINISHED);
      setAlreadyTrained(isCompletedTraining);

      // Restore partial progress from Firestore or Sheet
      if (todayTargets && todayTargets.length === 5) {
        let rolledCount = 0;
        let currentRolls: number[] = [];

        // Priority 1: If finished, use Sheet data (final source of truth)
        if (isCompletedTraining && todaySheetTask) {
          currentRolls = todaySheetTask.rolls || [];
          rolledCount = currentRolls.filter((roll: number) => roll > 0).length;
        }
        // Priority 2: If in progress, use Firestore data (has partial rolls)
        else if (progress?.state === PRACTICE_STATES.LIVE && progress.rolls) {
          currentRolls = progress.rolls;
          rolledCount = currentRolls.filter((roll: number) => roll > 0).length;
        }

        // Restore papers with existing rolls
        if (rolledCount > 0) {
          const hydratedPapers: PaperRoll[] = todayTargets.map((target, idx) => ({
            target,
            roll: currentRolls[idx] && currentRolls[idx] > 0 ? currentRolls[idx] : null,
            rolled: idx < rolledCount && currentRolls[idx] > 0,
          }));

          setPapers(hydratedPapers);
          setCurrentRollIndex(isCompletedTraining ? 5 : rolledCount);

          if (isCompletedTraining && todaySheetTask && todaySheetTask.success !== undefined) {
            setFinalResult({ success: todaySheetTask.success, rolls: currentRolls });
          }
        }
      }
    } catch (err: any) {
      // Check if it's a Firestore offline error
      if (err.code === 'unavailable' || err.message?.includes('offline')) {
        setError('Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md');
      } else {
        setError(err.message || 'Failed to load training data');
      }
    } finally {
      setLoading(false);
    }
  }, [user?.characterId]);

  useEffect(() => {
    loadTodayData();
  }, [loadTodayData]);

  const applyDeityRollEffect = useCallback((roll: number) => {
    if (isZeusDebuff) {
      return Math.max(1, roll - 2);
    }

    if (isPoseidonBuff) {
      return Math.max(6, roll);
    }

    if (die === 20) {
      return tycheAdvantageRoll(roll);
    }

    return roll;
  }, [isPoseidonBuff, isZeusDebuff, die]);

  const handleRollResult = async (result: number) => {
    if (alreadyTrained || currentRollIndex >= 5) return;

    const effectiveResult = applyDeityRollEffect(result);

    // Update current paper with roll result
    const newPapers = [...papers];
    newPapers[currentRollIndex] = {
      ...newPapers[currentRollIndex],
      roll: effectiveResult + (hasCampTShirt ? 2 : 0),
      rolled: true,
    };
    setPapers(newPapers);

    // Let the updated paper paint before we advance the focus to the next one.
    await new Promise((resolve) => window.requestAnimationFrame(() => resolve(null)));

    const nextIndex = currentRollIndex + 1;
    setCurrentRollIndex(nextIndex);

    // Save partial progress to Firestore after each roll
    try {
      const currentRolls = newPapers
        .filter(p => p.rolled)
        .map(p => p.roll!);
      const target = newPapers[0].target;

      await savePartialProgress(user!.characterId!, currentRolls, target);
    } catch (err: any) {
      setError(err.message || 'Failed to save progress');
    }

    // Check for early failure (3 or more fails before 5th roll)
    const failedCount = newPapers
      .filter(p => p.rolled && p.roll! < p.target)
      .length;

    // Check for early win (3 or more passes before 5th roll)
    const passedCount = newPapers
      .filter(p => p.rolled && p.roll! >= p.target)
      .length;

    if (failedCount >= 3 && nextIndex < 5) {
      // Early failure detected - show modal
      setShowEarlyFailModal(true);
      return;
    }

    if (passedCount >= 3 && nextIndex < 5) {
      // Early win detected - show modal
      setShowEarlyWinModal(true);
      return;
    }

    // If all 5 rolls complete, save final result
    if (nextIndex === 5) {
      try {
        const rolls = newPapers.map(p => p.roll!);
        const targets = newPapers.map(p => p.target);
        const success = checkSuccessWithTargets(rolls, targets);
        // Use first target for legacy storage
        const target = newPapers[0].target;

        await completeTraining(user!.characterId!, rolls, target, success, false, user?.fortune === 5);

        setAlreadyTrained(true);
        setFinalResult({ success, rolls });
      } catch (err: any) {
        if (err.code === 'unavailable' || err.message?.includes('offline')) {
          setError('Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md');
        } else {
          setError(err.message || 'Failed to save training result');
        }
      }
    }
  };

  const handleEarlyFailConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Fill remaining papers with 0 (unrolled placeholder)
      const completedPapers = [...papers];
      for (let i = currentRollIndex; i < 5; i++) {
        completedPapers[i] = {
          ...completedPapers[i],
          roll: 0, // Placeholder for unrolled dice
          rolled: false,
        };
      }

      const rolls = completedPapers.map(p => p.roll || 0);
      // Use first target for legacy storage
      const target = completedPapers[0].target;

      await completeTraining(user!.characterId!, rolls, target, false, true, user?.fortune === 5);

      setPapers(completedPapers);
      setCurrentRollIndex(5);
      setAlreadyTrained(true);
      setShowEarlyFailModal(false);
      setFinalResult({ success: false, rolls });
    } catch (err: any) {
      setError(err.message || 'Failed to complete training');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEarlyWinConfirm = async () => {
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      // Fill remaining papers with 0 (unrolled placeholder)
      const completedPapers = [...papers];
      for (let i = currentRollIndex; i < 5; i++) {
        completedPapers[i] = {
          ...completedPapers[i],
          roll: 0, // Placeholder for unrolled dice
          rolled: false,
        };
      }

      const rolls = completedPapers.map(p => p.roll || 0);
      // Use first target for legacy storage
      const target = completedPapers[0].target;

      await completeTraining(user!.characterId!, rolls, target, true, false, user?.fortune === 5);

      setPapers(completedPapers);
      setCurrentRollIndex(5);
      setAlreadyTrained(true);
      setShowEarlyWinModal(false);
      setFinalResult({ success: true, rolls });
    } catch (err: any) {
      setError(err.message || 'Failed to complete training');
    } finally {
      setIsProcessing(false);
    }
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
    } as React.CSSProperties
  }, [user?.theme, user?.characterId]);

  const hasPendingSheetTask = !!sheetTask && sheetTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;
  // PvP is considered "in progress" if it's in waiting or live state
  const hasLivePvp = livePractice?.mode === PRACTICE_MODE.PVP &&
    (livePractice.state === PRACTICE_STATES.LIVE || livePractice.state === PRACTICE_STATES.WAITING);
  const isFinishedPvpTask = sheetTask?.mode === PRACTICE_MODE.PVP;

  if (loading) {
    return (
      <div
        className="train-with-admin train-with-admin__loading"
        style={colorStyle}
      >
        {BG_ELEMENTS}
        <div className="train-with-admin__loading-spinner" aria-label="Loading" role="status" />
      </div>
    );
  }

  if (hasPendingSheetTask) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Your last training is not completed yet</h2>
          <p>
            Your training submission is currently pending review by the admin. <br />
            Please check back later for the results.
          </p>
          <Link
            to="/training-grounds"
            className="train-with-admin__error-back-button"
          >
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  if (hasLivePvp) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>PvP Training In Progress</h2>
          <p>
            You have an active PvP training. <br />
            Please come back again tomorrow after it has been reviewed by the admin.
          </p>
          <Link
            to="/training-grounds"
            className="train-with-admin__error-back-button"
          >
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  if (isFinishedPvpTask) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>PvP Training Completed</h2>
          <p>
            Your PvP training has been completed. <br />
            Please finishyour task and come back again tomorrow for the next training.
          </p>
          <Link
            to="/training-grounds"
            className="train-with-admin__error-back-button"
          >
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  if (targets === null || targets.length !== 5) {
    return (
      <div
        className="train-with-admin"
        style={colorStyle}
      >
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>No Training Available</h2>
          <p>The admin hasn't set today's training targets yet. <br /> Please check back later.</p>
          <Link
            to="/training-grounds"
            className="train-with-admin__error-back-button"
          >
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  if (validation && !validation.canTrain) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Training Not Available</h2>
          <p>{validation.reason}</p>
          <Link
            to="/training-grounds"
            className="train-with-admin__error-back-button"
          >
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="train-with-admin">
      {/* Papers showing targets and results */}
      <div className="train-with-admin__papers">
        {papers.map((paper, index) => (
          <div
            key={index}
            className={`train-with-admin__paper ${index === currentRollIndex && !alreadyTrained ? 'active' : ''
              } ${paper.rolled ? 'rolled' : ''} ${paper.rolled && paper.roll! >= paper.target ? 'passed' : ''
              } ${paper.rolled && paper.roll! < paper.target ? 'failed' : ''}`}
            style={colorStyle}
          >
            <div className={`train-with-admin__paper-label ${paper.rolled ? (paper.roll! >= paper.target ? 'passed' : 'failed') : ''}`}>
              {paper.rolled ? (paper.roll! >= paper.target ? 'Passed' : 'Failed') : 'Target'}
            </div>
            <div className={`train-with-admin__paper-target ${paper.rolled ? 'rolled' : ''}`}>{paper.target}</div>
            {paper.rolled && (
              <>
                <div className="train-with-admin__paper-divider"></div>
                <div className="train-with-admin__paper-result" style={hasCampTShirt ? { marginRight: '16px', color: '#ff4005' } : {}}>
                  {paper.roll}
                  {isZeusDebuff && <span className="train-with-admin__paper-bonus train-with-admin__paper-bonus--zeus">-2 <Zeus /></span>}
                  {isPoseidonBuff && <span className="train-with-admin__paper-bonus train-with-admin__paper-bonus--poseidon">min 6 <Poseidon /></span>}
                  {hasCampTShirt && <span className="train-with-admin__paper-bonus">+2 <Shirt /></span>}
                </div>
                <div className={`train-with-admin__paper-status ${paper.roll! >= paper.target ? 'passed' : 'failed'}`}>
                  {paper.roll! >= paper.target ? '✓' : '✗'}
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Dice Roller */}
      <div className="train-with-admin__roller" style={finalResult ? { opacity: 0.5 } : {}}>
        <DiceRoller
          className="train-with-admin-dice-roller"
          lockedDie={die}
          onRollResult={handleRollResult}
          hidePrompt={alreadyTrained || currentRollIndex >= 5}
          disabled={alreadyTrained || currentRollIndex >= 5 || showEarlyFailModal || showEarlyWinModal}
        />
      </div>

      {/* Early Failure Modal */}
      {showEarlyFailModal && (<EarlyFailModal handleEarlyFailConfirm={handleEarlyFailConfirm} disabled={isProcessing} />)}

      {/* Early Win Modal */}
      {showEarlyWinModal && (<EarlyWinModal handleEarlyWinConfirm={handleEarlyWinConfirm} disabled={isProcessing} />)}

      {/* Final Result Overlay */}
      {finalResult && (
        <div className="train-with-admin__overlay">
          <div className="train-with-admin__overlay-content">
            <h1 className={`train-with-admin__overlay-title ${finalResult.success ? 'success' : 'failed'}`}>
              {finalResult.success ? 'PASSED' : 'FAILED'}
            </h1>
            <p className="train-with-admin__overlay-message">
              {finalResult.success
                ? 'Great job! You passed today\'s training!'
                : 'Not your day. Try again tomorrow!'}
            </p>
            <Link
              to="/training-grounds"
              className={`train-with-admin__overlay-button ${finalResult.success ? 'success' : 'failed'}`}
            >
              Back to Camp
            </Link>
          </div>
        </div>
      )}

      {error && (
        <div className="train-with-admin__error-message">
          {error}
        </div>
      )}

      {!finalResult && !showEarlyFailModal && !showEarlyWinModal && (
        <Link to="/training-grounds" className="train-with-admin__back" data-tooltip="Back to Camp" data-tooltip-pos="left">
          <DoorExit />
        </Link>
      )}

      {beyondTodayPractice && (
        <BeyondTodayPracticeModal
          onClose={() => {
            setBeyondTodayPractice(false);
            navigate('/training-grounds');
          }}
        />)}

      {showDieNotice && (
        <DieNoticeModal die={die} onClose={() => setShowDieNotice(false)} />
      )}

      {zeusOrPoseidonNotice && isZeusDebuff && (
        <ZeusOrPoseidonNoticeModal
          deity={DEITY.ZEUS}
          onClose={() => setZeusOrPoseidonNotice(false)}
        />
      )}

      {zeusOrPoseidonNotice && isPoseidonBuff && (
        <ZeusOrPoseidonNoticeModal
          deity={DEITY.POSEIDON}
          onClose={() => setZeusOrPoseidonNotice(false)}
        />
      )}
    </div>
  );
}
