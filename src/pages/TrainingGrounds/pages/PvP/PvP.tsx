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
  getTodayTargets,
  UserDailyProgress,
} from '../../../../services/training/dailyTrainingDice';
import { TRAINING_POINT_REQUEST_STATUS } from '../../../../constants/practiceStates';
import { BG_ELEMENTS } from '../../components/Background/Background';
import Arena from '../../../Arena/Arena';
import './PvP.scss';

export default function PvP() {
  const { arenaId } = useParams<{ arenaId: string }>();
  const { user } = useAuth();
  const [targets, setTargets] = useState<number[] | null>(null);
  const [sheetTask, setSheetTask] = useState<UserDailyProgress | null>(null);
  const [livePractice, setLivePractice] = useState<UserDailyProgress | null>(null);
  const [quotaUsed, setQuotaUsed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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
        const [targetData, quotaSnapshot, trainings, todayProgress] = await Promise.all([
          getTodayTargets().catch(() => null),
          get(ref(db, quotaPath)).catch(() => null),
          fetchTrainings(user.characterId).catch(() => [] as UserDailyProgress[]),
          getTodayProgress(user.characterId).catch(() => null),
        ]);

        if (!mounted) return;

        setTargets(targetData);
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
  const hasLiveNormalTraining = livePractice?.practiceMode === 'admin' && livePractice.practiceState === 'live';
  const isFinishedNormalTraining = livePractice?.practiceMode === 'admin' && livePractice.practiceState === 'finished';
  const hasLivePvp = livePractice?.practiceMode === 'pvp' && livePractice.practiceState === 'live';
  const isFinishedPvpTask = sheetTask?.practiceMode === 'pvp' && sheetTask.practiceState === 'finished';
  if (loading) {
    return (
      <div className="train-with-admin train-with-admin__loading" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__loading-spinner" aria-label="Loading" role="status" />
      </div>
    );
  }

  if (targets === null || targets.length !== 5) {
    return (
      <div className="train-with-admin" style={colorStyle}>
        {BG_ELEMENTS}
        <div className="train-with-admin__error">
          <h2>No PvP Training Available</h2>
          <p>The admin hasn't set today's training targets yet. <br /> Please check back later.</p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
            Back to Camp
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
          <h2>PvP practice in progress</h2>
          <p>Your PvP room is still live. <br /> Rejoin the room and finish the battle first.</p>
          {livePractice?.practiceArenaId && (
            <Link
              to={`/training-grounds/pvp/${livePractice.practiceArenaId}`}
              className="train-with-admin__error-back-button"
            >
              Return to PvP
            </Link>
          )}
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
          <p>Your battle has ended. <br /> The task is ready, so submit the roleplay to complete it.</p>
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
          <h2>Normal Training is live</h2>
          <p>Please finish the normal training session first, then come back to PvP.</p>
          <Link to="/training-grounds" className="train-with-admin__error-back-button">
            Back to Camp
          </Link>
        </div>
      </div>
    );
  }

  if (quotaUsed && !hasPendingSheetTask) {
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

  if (arenaId) {
    return <Arena />;
  }

  return null;
}
