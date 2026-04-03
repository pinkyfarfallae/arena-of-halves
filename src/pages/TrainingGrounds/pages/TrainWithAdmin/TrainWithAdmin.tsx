import React, { useState, useEffect, useMemo, useCallback } from 'react';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import './TrainWithAdmin.scss';
import { useAuth } from '../../../../hooks/useAuth';
import { Link } from 'react-router-dom';
import DoorExit from '../../../IrisMessage/icons/DoorExit';
import { hexToRgb } from '../../../../utils/color';
import { db } from '../../../../firebase';
import { get, ref } from 'firebase/database';
import {
  getTodayTargets,
  savePartialProgress,
  completeTraining,
  getTodayDate,
  getTodayProgress,
  UserDailyProgress,
  checkSuccess,
  checkSuccessWithTargets,
  fetchTrainings,
} from '../../../../services/training/dailyTrainingDice';
import { BG_ELEMENTS } from '../../components/Background/Background';
import EarlyFailModal from './components/EarlyFailModal/EarlyFailModal';
import EarlyWinModal from './components/EarlyWinModal/EarlyWinModal';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import { PRACTICE_MODE, PRACTICE_STATES } from '../../../../constants/practice';

interface PaperRoll {
  target: number;
  roll: number | null;
  rolled: boolean;
}

export default function TrainWithAdmin() {
  const { user } = useAuth();
  const [targets, setTargets] = useState<number[] | null>(null);
  const [papers, setPapers] = useState<PaperRoll[]>([]);
  const [currentRollIndex, setCurrentRollIndex] = useState<number>(0);
  const [alreadyTrained, setAlreadyTrained] = useState<boolean>(false);
  const [sheetTask, setSheetTask] = useState<UserDailyProgress | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [finalResult, setFinalResult] = useState<{ success: boolean; rolls: number[] } | null>(null);
  const [showEarlyFailModal, setShowEarlyFailModal] = useState<boolean>(false);
  const [showEarlyWinModal, setShowEarlyWinModal] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [quotaUsed, setQuotaUsed] = useState<boolean>(false);

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

      // Load all 5 today's targets
      const todayTargets = await getTodayTargets();
      setTargets(todayTargets);

      const [trainings, todayProgress] = await Promise.all([
        fetchTrainings(user.characterId).catch(() => [] as UserDailyProgress[]),
        getTodayProgress(user.characterId).catch(() => null),
      ]);
      setLivePractice(todayProgress);
      const todaySheetTask = [...trainings].reverse().find((training) => training.date === getTodayDate()) || null;
      setSheetTask(todaySheetTask);

      const quotaDoc = await get(ref(db, `trainingQuotas/${user.characterId}/${getTodayDate()}`)).catch(() => null);
      setQuotaUsed(!!quotaDoc?.exists());

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
      const isCompletedTraining = !!progress?.completed || (progress?.practiceMode === PRACTICE_MODE.NORMAL && progress?.practiceState === PRACTICE_STATES.FINISHED) || (progress?.practiceMode === PRACTICE_MODE.PVP && progress?.practiceState === PRACTICE_STATES.FINISHED);
      setAlreadyTrained(isCompletedTraining);

      if (progress && todayTargets) {
        const currentRolls = progress.rolls || [];
        const rolledCount = currentRolls.filter((roll) => roll > 0).length;
        const hydratedPapers: PaperRoll[] = todayTargets.map((target, idx) => ({
          target,
          roll: currentRolls[idx] && currentRolls[idx] > 0 ? currentRolls[idx] : null,
          rolled: idx < rolledCount && currentRolls[idx] > 0,
        }));

        setPapers(hydratedPapers);
        setCurrentRollIndex(isCompletedTraining ? 5 : rolledCount);

        if (isCompletedTraining) {
          setFinalResult({ success: progress.success, rolls: currentRolls });
        }
      }
    } catch (err: any) {
      console.error('Failed to load training data:', err);

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

  const handleRollResult = async (result: number) => {
    if (alreadyTrained || currentRollIndex >= 5) return;

    // Update current paper with roll result
    const newPapers = [...papers];
    newPapers[currentRollIndex] = {
      ...newPapers[currentRollIndex],
      roll: result,
      rolled: true,
    };
    setPapers(newPapers);

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
      console.error('Failed to save partial progress:', err);
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

        await completeTraining(user!.characterId!, rolls, target, success, false);

        setAlreadyTrained(true);
        setFinalResult({ success, rolls });
      } catch (err: any) {
        console.error('Failed to save training result:', err);

        if (err.code === 'unavailable' || err.message?.includes('offline')) {
          setError('Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md');
        } else {
          setError(err.message || 'Failed to save training result');
        }
      }
    }
  };

  const handleEarlyFailConfirm = async () => {
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
    const targets = completedPapers.map(p => p.target);
    // Use first target for legacy storage
    const target = completedPapers[0].target;

    try {
      await completeTraining(user!.characterId!, rolls, target, false, true);

      setPapers(completedPapers);
      setCurrentRollIndex(5);
      setAlreadyTrained(true);
      setShowEarlyFailModal(false);
      setFinalResult({ success: false, rolls });
    } catch (err: any) {
      console.error('Failed to complete training:', err);
      setError(err.message || 'Failed to complete training');
    }
  };

  const handleEarlyWinConfirm = async () => {
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
    const targets = completedPapers.map(p => p.target);
    // Use first target for legacy storage
    const target = completedPapers[0].target;

    try {
      await completeTraining(user!.characterId!, rolls, target, true, false);

      setPapers(completedPapers);
      setCurrentRollIndex(5);
      setAlreadyTrained(true);
      setShowEarlyWinModal(false);
      setFinalResult({ success: true, rolls });
    } catch (err: any) {
      console.error('Failed to complete training:', err);
      setError(err.message || 'Failed to complete training');
    }
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
    } as React.CSSProperties
  }, [user]);

  const hasPendingSheetTask = !!sheetTask && sheetTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;
  // PvP is considered \"in progress\" if it's in waiting or live state
  const hasLivePvp = livePractice?.practiceMode === PRACTICE_MODE.PVP && 
    (livePractice.practiceState === PRACTICE_STATES.LIVE || livePractice.practiceState === PRACTICE_STATES.WAITING);
  const hasWaitingPvpTask = sheetTask?.practiceMode === PRACTICE_MODE.PVP && sheetTask.practiceState === PRACTICE_STATES.WAITING;
  const isFinishedPvpTask = sheetTask?.practiceMode === PRACTICE_MODE.PVP && sheetTask.practiceState === PRACTICE_STATES.FINISHED;
  const isFinishedNormalTraining = livePractice?.practiceMode === PRACTICE_MODE.NORMAL && livePractice.practiceState === PRACTICE_STATES.FINISHED;
  const hasInProgressNormalTraining = livePractice?.practiceMode === PRACTICE_MODE.NORMAL && livePractice.practiceState === PRACTICE_STATES.LIVE && !livePractice.completed;

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
            Back to Camp
          </Link>
        </div>
      </div>
    );
  }

  if (hasPendingSheetTask) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>You have a pending task</h2>
          <p>Please complete your current task before starting new training. <br />
          Submit the roleplay and wait for approval.</p>
          <Link
            to="/training-grounds/tasks"
            className="train-with-admin__error-back-button"
          >
            Go to Tasks
          </Link>
        </div>
      </div>
    );
  }

  if (hasLivePvp || hasWaitingPvpTask) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>PvP practice in progress</h2>
          <p>Your PvP room is still live. <br />
            Rejoin the room and finish the battle first. The task will appear after the match ends.</p>
          <Link
            to={livePractice?.practiceArenaId ? `/training-grounds/pvp/${livePractice.practiceArenaId}` : '/training-grounds'}
            className="train-with-admin__error-back-button"
          >
            Return to PvP
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
          <h2>PvP task ready</h2>
          <p>Your battle has ended. <br />
          The task is ready, so submit the roleplay to complete it.</p>
          <Link
            to="/training-grounds/tasks"
            className="train-with-admin__error-back-button"
          >
            Go to Tasks
          </Link>
        </div>
      </div>
    );
  }

  if (quotaUsed && !hasInProgressNormalTraining && !isFinishedNormalTraining) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Training quota already used</h2>
          <p>You already started training for today. Please finish the current task before starting a new one.</p>
          <Link
            to="/training-grounds/tasks"
            className="train-with-admin__error-back-button"
          >
            Go to Tasks
          </Link>
        </div>
      </div>
    );
  }

  if (hasPendingSheetTask) {
    return (
      <div
        className="train-with-admin"
        style={colorStyle}
      >
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>You have pending training tasks</h2>
          <p>Please complete the task before starting new training.</p>
          <Link
            to="/training-grounds"
            className="train-with-admin__error-back-button"
          >
            Back to Camp
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
                <div className="train-with-admin__paper-result">{paper.roll}</div>
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
          lockedDie={12}
          onRollResult={handleRollResult}
          hidePrompt={alreadyTrained || currentRollIndex >= 5}
          disabled={alreadyTrained || currentRollIndex >= 5 || showEarlyFailModal || showEarlyWinModal}
        />
      </div>

      {/* Early Failure Modal */}
      {showEarlyFailModal && (<EarlyFailModal handleEarlyFailConfirm={handleEarlyFailConfirm} />)}

      {/* Early Win Modal */}
      {showEarlyWinModal && (<EarlyWinModal handleEarlyWinConfirm={handleEarlyWinConfirm} />)}

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
    </div>
  );
}
