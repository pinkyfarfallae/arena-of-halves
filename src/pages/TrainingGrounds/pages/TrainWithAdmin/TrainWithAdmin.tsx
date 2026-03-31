import React, { useState, useEffect } from 'react';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import './TrainWithAdmin.scss';
import { useAuth } from '../../../../hooks/useAuth';
import { Link } from 'react-router-dom';
import DoorExit from '../../../IrisMessage/icons/DoorExit';
import {
  getTodayTarget,
  hasTrainedToday,
  performDailyTraining,
  getTodayProgress,
  UserDailyProgress,
} from '../../../../services/training/dailyTrainingDice';

export default function TrainWithAdmin() {
  const { user } = useAuth();
  const [target, setTarget] = useState<number | null>(null);
  const [alreadyTrained, setAlreadyTrained] = useState<boolean>(false);
  const [todayProgress, setTodayProgress] = useState<UserDailyProgress | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [rolling, setRolling] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadTodayData();
  }, [user]);

  const loadTodayData = async () => {
    if (!user?.characterId) return;

    try {
      setLoading(true);
      setError('');

      // Load today's target
      const todayTarget = await getTodayTarget();
      setTarget(todayTarget);

      // Check if already trained
      const trained = await hasTrainedToday(user.characterId);
      setAlreadyTrained(trained);

      // If already trained, load progress
      if (trained) {
        const progress = await getTodayProgress(user.characterId);
        setTodayProgress(progress);
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

  const handleRoll = async (rolls: number[]) => {
    if (!user?.characterId) return;

    try {
      setRolling(true);
      setError('');

      const result = await performDailyTraining(user.characterId);
      
      // Update UI
      setAlreadyTrained(true);
      setTodayProgress({
        userId: user.characterId,
        date: new Date().toISOString().split('T')[0],
        rolls: result.rolls,
        target: result.target,
        success: result.success,
        roleplay: null,
        verified: false,
        createdAt: null as any,
      });
    } catch (err: any) {
      console.error('Training failed:', err);
      
      // Check if it's a Firestore offline error
      if (err.code === 'unavailable' || err.message?.includes('offline')) {
        setError('Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md');
      } else {
        setError(err.message || 'Training failed');
      }
    } finally {
      setRolling(false);
    }
  };

  if (loading) {
    return (
      <div className="train-with-admin">
        <div className="train-with-admin__loading">Loading...</div>
        <Link to="/training-grounds" className="train-with-admin__back" data-tooltip="Back to Camp" data-tooltip-pos="left">
          <DoorExit />
        </Link>
      </div>
    );
  }

  if (target === null) {
    return (
      <div className="train-with-admin">
        <div className="train-with-admin__error">
          <h2>No Training Available</h2>
          <p>The admin hasn't set today's training target yet.</p>
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
      <div className="train-with-admin__header">
        <h2>Daily Training</h2>
        <div className="train-with-admin__target">
          Today's Target: <span className="train-with-admin__target-number">{target}</span>
        </div>
        <p className="train-with-admin__rules">
          Roll 5 twelve-sided dice (d12). Get at least 3 rolls ≥ {target} to succeed!
        </p>
      </div>

      {error && (
        <div className="train-with-admin__error-message">
          {error}
        </div>
      )}

      {alreadyTrained && todayProgress ? (
        <div className="train-with-admin__results">
          <h3>{todayProgress.success ? '✓ Success!' : '✗ Failed'}</h3>
          <div className="train-with-admin__dice-results">
            {todayProgress.rolls.map((roll, index) => (
              <div
                key={index}
                className={`train-with-admin__die ${roll >= todayProgress.target ? 'success' : 'fail'}`}
              >
                {roll}
              </div>
            ))}
          </div>
          <p className="train-with-admin__status">
            You've already trained today. Come back tomorrow for another attempt!
          </p>
        </div>
      ) : (
        <div className="train-with-admin__roller">
          <DiceRoller
            className="train-with-admin-dice-roller"
            lockedDie={12}
            onRollResult={(result) => {
              // Extract the 5 dice rolls from result
              const rolls = Array.isArray(result) ? result.slice(0, 5) : [];
              if (!rolling && !alreadyTrained) {
                handleRoll(rolls);
              }
            }}
          />
          {!alreadyTrained && (
            <button
              className="train-with-admin__roll-button"
              onClick={() => {
                // Trigger dice roller
                const rollButton = document.querySelector('.dice-roller__roll-button') as HTMLButtonElement;
                rollButton?.click();
              }}
              disabled={rolling}
            >
              {rolling ? 'Rolling...' : 'Roll Dice'}
            </button>
          )}
        </div>
      )}

      <Link to="/training-grounds" className="train-with-admin__back" data-tooltip="Back to Camp" data-tooltip-pos="left">
        <DoorExit />
      </Link>
    </div>
  );
}