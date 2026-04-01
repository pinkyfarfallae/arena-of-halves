import React, { useState, useEffect } from 'react';
import { getTodayTarget, setDailyTarget, getTodayDate } from '../../../../services/training/dailyTrainingDice';
import './DailyTrainingConfig.scss';
import DiceRoller from '../../../../components/DiceRoller/DiceRoller';
import { useAuth } from '../../../../hooks/useAuth';
import { hexToRgb } from '../../../../utils/color';

interface PaperTarget {
  value: number | null;
  rolled: boolean;
}

export default function DailyTrainingConfig() {
  const { user } = useAuth();
  const [papers, setPapers] = useState<PaperTarget[]>([
    { value: null, rolled: false },
    { value: null, rolled: false },
    { value: null, rolled: false },
    { value: null, rolled: false },
    { value: null, rolled: false },
  ]);
  const [activePaperIndex, setActivePaperIndex] = useState<number>(0);
  const [confirmed, setConfirmed] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadCurrentTarget();
  }, []);

  const loadCurrentTarget = async () => {
    try {
      setLoading(true);
      const todayTarget = await getTodayTarget();
      // For now, just load into first paper if exists
      if (todayTarget !== null) {
        setPapers([
          { value: todayTarget, rolled: true },
          { value: null, rolled: false },
          { value: null, rolled: false },
          { value: null, rolled: false },
          { value: null, rolled: false },
        ]);
        setConfirmed(true); // If target exists, assume it's confirmed
      }
    } catch (err: any) {
      console.error('Failed to load current target:', err);
      if (err.code === 'unavailable' || err.message?.includes('offline')) {
        setMessage({
          type: 'error',
          text: 'Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md for instructions.'
        });
      } else {
        setMessage({ type: 'error', text: `Failed to load current target: ${err.message}` });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRollResult = (result: number) => {
    if (confirmed) return;

    // result is just a number from the DiceRoller
    const diceValue = result;

    // Update the active paper
    const newPapers = [...papers];
    newPapers[activePaperIndex] = {
      value: diceValue,
      rolled: true,
    };
    setPapers(newPapers);

    // Move to next unrolled paper
    const nextIndex = newPapers.findIndex((p, i) => i > activePaperIndex && !p.rolled);
    if (nextIndex !== -1) {
      setActivePaperIndex(nextIndex);
    }
  };

  const handlePaperClick = (index: number) => {
    if (confirmed) return;
    setActivePaperIndex(index);
  };

  const handleClear = () => {
    if (confirmed) return;
    setPapers([
      { value: null, rolled: false },
      { value: null, rolled: false },
      { value: null, rolled: false },
      { value: null, rolled: false },
      { value: null, rolled: false },
    ]);
    setActivePaperIndex(0);
    setMessage(null);
  };

  const handleConfirm = async () => {
    // Check if all papers are rolled
    const allRolled = papers.every(p => p.rolled);
    if (!allRolled) {
      setMessage({ type: 'error', text: 'Please roll all 5 papers before confirming' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      // For now, save the first paper's value as the daily target
      // TODO: Update backend to store all 5 targets
      const firstValue = papers[0].value!;
      await setDailyTarget(firstValue);

      setConfirmed(true);
      setMessage({ type: 'success', text: 'Successfully confirmed all targets!' });
    } catch (err: any) {
      console.error('Failed to confirm targets:', err);
      if (err.code === 'unavailable' || err.message?.includes('offline')) {
        setMessage({
          type: 'error',
          text: 'Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md'
        });
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to confirm targets' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="daily-training-config">
        <div className="daily-training-config__loading">Loading...</div>
      </div>
    );
  }

  return (
    <div className="daily-training-config">
      <div className="daily-training-config__papers">
        {papers.map((paper, index) => (
          <div
            key={index}
            className={`daily-training-config__paper ${activePaperIndex === index ? 'active' : ''
              } ${paper.rolled ? 'rolled' : ''} ${confirmed ? 'confirmed' : ''}`}
            style={{
              '--primary-color': user?.theme[0] || '#000',
              '--primary-color-rgb': hexToRgb(user?.theme[0] || '#000'),
              '--primary-hover-color': user?.theme[0] || '#000',
              '--foreground-color': user?.theme[5] || '#fff',
              '--background-color': user?.theme[1] || '#f0f0f0',
            } as React.CSSProperties}
            onClick={() => handlePaperClick(index)}
          >
            <div className="daily-training-config__paper-number">#{index + 1}</div>
            <div className="daily-training-config__paper-value">
              {paper.value !== null ? paper.value : '?'}
            </div>
          </div>
        ))}
      </div>

      {!confirmed && (
        <DiceRoller
          className="daily-training-config-dice-roller"
          lockedDie={12}
          onRollResult={handleRollResult}
          hidePrompt
        />
      )}

      <div
        className="daily-training-config__actions"
        style={{
          '--primary-color': user?.theme[0] || '#000',
          '--primary-color-rgb': hexToRgb(user?.theme[0] || '#000'),
        } as React.CSSProperties}
      >
        <button
          className="daily-training-config__clear-btn"
          onClick={handleClear}
          disabled={confirmed || saving || papers.every(p => !p.rolled)}
        >
          Clear All
        </button>
        <button
          className="daily-training-config__confirm-btn"
          onClick={handleConfirm}
          disabled={confirmed || saving || !papers.every(p => p.rolled)}
        >
          {saving ? 'Confirming...' : confirmed ? 'Confirmed' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
