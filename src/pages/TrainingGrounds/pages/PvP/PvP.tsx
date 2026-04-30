import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../../hooks/useAuth';
import { hexToRgb } from '../../../../utils/color';
import { db } from '../../../../firebase';
import { get, ref } from 'firebase/database';
import {
  fetchUserTrainingTasks,
  getTodayProgress,
  UserDailyProgress,
  TrainingTask,
  canUserTrain,
  TrainingValidation,
} from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/trainingPointRequestStatus';
import { BG_ELEMENTS } from '../../components/Background/Background';
import Arena from '../../../Arena/Arena';
import { PRACTICE_MODE, PRACTICE_STATES } from '../../../../constants/practice';
import { getTodayDate } from '../../../../utils/date';
import './PvP.scss';

export default function PvP() {
  const { arenaId } = useParams<{ arenaId: string }>();
  const { user } = useAuth();
  const [sheetTask, setSheetTask] = useState<TrainingTask | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [, setQuotaUsed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [validation, setValidation] = useState<TrainingValidation | null>(null);

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
          fetchUserTrainingTasks(user.characterId).catch(() => [] as TrainingTask[]),
          getTodayProgress(user.characterId).catch(() => null),
        ]);

        if (!mounted) return;

        setLivePractice(todayProgress);
        setQuotaUsed(!!quotaSnapshot?.exists());
        setSheetTask([...trainings].reverse().find((training) => training.date === todayDate && training.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED) || null);

        // Check comprehensive validation
        const validationResult = await canUserTrain(user.characterId, PRACTICE_MODE.PVP);
        setValidation(validationResult);
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
  }, [user?.theme, user?.characterId]);

  const hasPendingSheetTask = !!sheetTask && sheetTask.verified !== TRAINING_POINT_REQUEST_STATUS.APPROVED;
  const hasLiveNormalTraining = livePractice?.mode === PRACTICE_MODE.NORMAL && livePractice.state === PRACTICE_STATES.LIVE;
  const isFinishedNormalTraining = livePractice?.mode === PRACTICE_MODE.NORMAL && livePractice.state === PRACTICE_STATES.FINISHED;
  // PvP is considered "in progress" if it's in waiting, live, or configuring state (not current arena)
  const isFinishedPvpTask = sheetTask?.mode === PRACTICE_MODE.PVP;

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
    return <Arena isPractice />;
  }

  if (loading) {
    return (
      <div className="train-with-admin train-with-admin__loading" style={colorStyle}>
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
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  if (hasLiveNormalTraining) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Your normal training is still in progress</h2>
          <p>
            You have an ongoing normal training session. <br />
            Please finish it before starting PvP training.
          </p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
            Back to Grounds
          </Link>
        </div>
      </div>
    );
  }

  if (isFinishedNormalTraining) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>Your normal training just finished</h2>
          <p>
            Your normal training session has just finished. <br />
            Please wait a moment for the results to be processed before starting PvP training.
          </p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
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
          <h2>Your PvP training just finished</h2>
          <p>
            Your PvP training session has just finished. <br />
            Please wait a moment for the results to be processed before starting another PvP training.
          </p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
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
          <h2>PvP Training Not Available</h2>
          <p>{validation.reason}</p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
            Back to Grounds
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
          Back to Grounds
        </Link>
      </div>
    </div>
  );
}