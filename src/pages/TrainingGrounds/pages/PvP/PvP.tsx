import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { hexToRgb } from '../../../../utils/color';
import { db } from '../../../../firebase';
import { get, ref } from 'firebase/database';
import {
  fetchTrainings,
  getTodayDate,
  getTodayProgress,
  UserDailyProgress,
} from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import { BG_ELEMENTS } from '../../components/Background/Background';
import Arena from '../../../Arena/Arena';
import './PvP.scss';
import { PRACTICE_MODE, PRACTICE_STATES } from '../../../../constants/practice';

export default function PvP() {
  const { arenaId } = useParams<{ arenaId: string }>();
  const { user } = useAuth();
  const [sheetTask, setSheetTask] = useState<UserDailyProgress | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [quotaUsed, setQuotaUsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Skip validation loading when entering an arena directly - let Arena component handle it
    if (arenaId) {
      setLoading(false);
      return;
    }

    let mounted = true;
    void (async () => {
      if (!user?.characterId) {
        if (mounted) setLoading(false);
        return;
      }

      try {
        const todayDate = getTodayDate();
        const quotaPath = `trainingQuotas/${user.characterId}/${todayDate}`;
        const [quotaSnapshot, trainings, todayProgress] = await Promise.all([
          get(ref(db, quotaPath)).catch(() => null),
          fetchTrainings(user.characterId).catch(() => [] as UserDailyProgress[]),
          getTodayProgress(user.characterId).catch(() => null),
        ]);

        if (!mounted) return;

        setLivePractice(todayProgress);
        setQuotaUsed(!!quotaSnapshot?.exists());
        setSheetTask([...trainings].reverse().find((training) => training.date === todayDate) || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [arenaId, user?.characterId]);

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
    } as React.CSSProperties;
  }, [user]);

  const hasPendingSheetTask = !!sheetTask && sheetTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;
  const hasLiveNormalTraining = livePractice?.practiceMode === PRACTICE_MODE.NORMAL && livePractice.practiceState === PRACTICE_STATES.LIVE;
  const isFinishedNormalTraining = livePractice?.practiceMode === PRACTICE_MODE.NORMAL && livePractice.practiceState === PRACTICE_STATES.FINISHED;
  // PvP is considered "in progress" if it's in waiting, live, or configuring state (not current arena)
  const hasLivePvp = livePractice?.practiceMode === PRACTICE_MODE.PVP && 
    (livePractice.practiceState === PRACTICE_STATES.LIVE || livePractice.practiceState === PRACTICE_STATES.WAITING) && 
    livePractice.practiceArenaId !== arenaId;
  const isFinishedPvpTask = sheetTask?.practiceMode === PRACTICE_MODE.PVP && sheetTask.practiceState === PRACTICE_STATES.FINISHED;

  // If entering an arena directly, wait for user then render Arena
  if (arenaId) {
    if (!user) {
      return (
        <div className="train-with-admin train-with-admin__loading" style={colorStyle}>
          {BG_ELEMENTS}
          <div className="train-with-admin__loading-spinner" aria-label="Loading" role="status" />
        </div>
      );
    }
    return <Arena />;
  }

  if (loading) {
    return (
      <div className="train-with-admin train-with-admin__loading" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__loading-spinner" aria-label="Loading" role="status" />
      </div>
    );
  }

  if (isFinishedPvpTask) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>PvP task ready</h2>
          <p>Your battle has ended. <br /> The task is ready, so submit the roleplay to complete it.</p>
          <Link to="/training-grounds/tasks" className="train-with-admin__error-back-button">
            Go to Tasks
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
          <p>Please complete your current task before starting PvP. <br />
          Submit the roleplay and wait for approval.</p>
          <Link to="/training-grounds/tasks" className="train-with-admin__error-back-button">
            Go to Tasks
          </Link>
        </div>
      </div>
    );
  }

  if (hasLiveNormalTraining || isFinishedNormalTraining) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Normal Training is {hasLiveNormalTraining ? 'in progress' : 'finished'}</h2>
          <p>
            Please complete the normal training session first, <br />
            then come back to PvP tomorrow. We will wait for you!
            </p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
            Back to Camp
          </Link>
        </div>
      </div>
    );
  }

  // Allow continuing in-progress PvP practice (waiting or live state)
  const hasInProgressPvp = livePractice?.practiceMode === PRACTICE_MODE.PVP && 
    (livePractice.practiceState === PRACTICE_STATES.WAITING || livePractice.practiceState === PRACTICE_STATES.LIVE);
  
  if (quotaUsed && !hasInProgressPvp) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Training quota already used</h2>
          <p>You already started training for today. Please finish the current task before starting a new one.</p>
          <Link to="/training-grounds/tasks" className="train-with-admin__error-back-button">
            Go to Tasks
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
          <h2>You have pending training tasks</h2>
          <p>Please complete the task before starting new PvP.</p>
          <Link to="/training-grounds/pvp" className="train-with-admin__error-back-button">
            Back to PvP
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="train-with-admin" style={colorStyle}>
      {BG_ELEMENTS}
      <div className="train-with-admin__error">
        <h2>PvP Training</h2>
        <p>Open or join a practice room from Camp when you are ready.</p>
        <Link to="/training-grounds" className="train-with-admin__error-back-button">
          Back to Camp
        </Link>
      </div>
    </div>
  );
}
