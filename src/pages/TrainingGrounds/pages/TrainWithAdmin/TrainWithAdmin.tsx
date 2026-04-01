import React, { useState, useEffect } from 'react';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import './TrainWithAdmin.scss';
import { useAuth } from '../../../../hooks/useAuth';
import { Link } from 'react-router-dom';
import DoorExit from '../../../IrisMessage/icons/DoorExit';
import { hexToRgb } from '../../../../utils/color';
import {
  getTodayTargets,
  hasTrainedToday,
  savePartialProgress,
  completeTraining,
  getTodayProgress,
  UserDailyProgress,
  checkSuccess,
} from '../../../../services/training/dailyTrainingDice';

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
  const [loading, setLoading] = useState<boolean>(true);
  const [finalResult, setFinalResult] = useState<{ success: boolean; rolls: number[] } | null>(null);
  const [showEarlyFailModal, setShowEarlyFailModal] = useState<boolean>(false);
  const [showEarlyWinModal, setShowEarlyWinModal] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadTodayData();
  }, [user]);

  const loadTodayData = async () => {
    if (!user?.characterId) return;

    try {
      setLoading(true);
      setError('');

      // Load all 5 today's targets
      const todayTargets = await getTodayTargets();
      setTargets(todayTargets);

      if (todayTargets && todayTargets.length === 5) {
        // Initialize papers with targets
        const initialPapers: PaperRoll[] = todayTargets.map(target => ({
          target,
          roll: null,
          rolled: false,
        }));
        setPapers(initialPapers);
      }

      // Check if already trained
      const trained = await hasTrainedToday(user.characterId);
      setAlreadyTrained(trained);

      // If already trained, load progress and update papers
      if (trained && todayTargets) {
        const progress = await getTodayProgress(user.characterId);
        if (progress && progress.rolls.length === 5) {
          const completedPapers: PaperRoll[] = todayTargets.map((target, idx) => ({
            target,
            roll: progress.rolls[idx],
            rolled: true,
          }));
          setPapers(completedPapers);
          setCurrentRollIndex(5);
          setFinalResult({ success: progress.success, rolls: progress.rolls });
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
  };

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
        const target = newPapers[0].target;
        const success = checkSuccess(rolls, target);

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

  if (loading) {
    return null;
  }

  if (targets === null || targets.length !== 5) {
    return (
      <div className="train-with-admin">
        <div className="train-with-admin__error">
          <h2>No Training Available</h2>
          <p>The admin hasn't set today's training targets yet.</p>
          <p>Please check back later.</p>
        </div>
        <Link to="/training-grounds" className="train-with-admin__back" data-tooltip="Back to Camp" data-tooltip-pos="left">
          <DoorExit />
        </Link>
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
            style={{
              '--primary-color': user?.theme[0] || '#000',
              '--primary-color-rgb': hexToRgb(user?.theme[0] || '#000'),
              '--foreground-color': user?.theme[5] || '#fff',
            } as React.CSSProperties}
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
      {showEarlyFailModal && (
        <div className="train-with-admin__modal-overlay">
          <div className="train-with-admin__modal train-with-admin__modal--fail">
            <h2 className="train-with-admin__modal-title train-with-admin__modal-title--fail">Training Failed</h2>
            <p className="train-with-admin__modal-message">
              You've failed 3 targets. <br />
              Unfortunately, you cannot continue.
            </p>
            <button
              className="train-with-admin__modal-button train-with-admin__modal-button--fail"
              onClick={handleEarlyFailConfirm}
            >
              Roger that
            </button>
          </div>
        </div>
      )}

      {/* Early Win Modal */}
      {showEarlyWinModal && (
        <div className="train-with-admin__modal-overlay">
          <div className="train-with-admin__modal train-with-admin__modal--win">
            <h2 className="train-with-admin__modal-title train-with-admin__modal-title--win">Training Passed!</h2>
            <p className="train-with-admin__modal-message">
              You've passed 3 targets. <br />
              Congratulations, you've already succeeded!
            </p>
            <button
              className="train-with-admin__modal-button train-with-admin__modal-button--win"
              onClick={handleEarlyWinConfirm}
            >
              Roger that
            </button>
          </div>
        </div>
      )}

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