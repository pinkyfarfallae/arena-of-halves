import React, { useState, useEffect } from 'react';
import {
  getTodayTarget,
  getTodayDate,
  getDraftTargets,
  saveDraftTargets,
  confirmTargets
} from '../../../../services/training/dailyTrainingDice';
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

      // Admin can see draft (unconfirmed) targets
      const draft = await getDraftTargets();

      if (draft && draft.targets.length > 0) {
        // Load the targets into papers
        const newPapers: PaperTarget[] = [
          { value: null, rolled: false },
          { value: null, rolled: false },
          { value: null, rolled: false },
          { value: null, rolled: false },
          { value: null, rolled: false },
        ];

        draft.targets.forEach((value, index) => {
          if (index < 5) {
            newPapers[index] = { value, rolled: true };
          }
        });

        setPapers(newPapers);
        setConfirmed(draft.confirmed);

        // Set active to first unrolled paper
        const firstUnrolled = newPapers.findIndex(p => !p.rolled);
        if (firstUnrolled !== -1) {
          setActivePaperIndex(firstUnrolled);
        }
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

  const handleRollResult = async (result: number) => {
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

    // Auto-save to Firestore immediately
    try {
      const targets = newPapers.map(p => p.value);
      await saveDraftTargets(targets);
    } catch (err: any) {
      console.error('Failed to auto-save:', err);
      setMessage({ type: 'error', text: 'Failed to save roll. Try again.' });
    }

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

  const handleClear = async () => {
    if (confirmed) return;

    const resetPapers = [
      { value: null, rolled: false },
      { value: null, rolled: false },
      { value: null, rolled: false },
      { value: null, rolled: false },
      { value: null, rolled: false },
    ];

    setPapers(resetPapers);
    setActivePaperIndex(0);
    setMessage(null);

    // Clear from Firestore too
    try {
      await saveDraftTargets([]);
    } catch (err: any) {
      console.error('Failed to clear:', err);
    }
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

      // Confirm all 5 targets
      const targets = papers.map(p => p.value!);
      await confirmTargets(targets);

      setConfirmed(true);
      setMessage({ type: 'success', text: 'Successfully confirmed! Players can now use these targets.' });
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
    return null;
  }

  return (
    <div className="daily-training-config">
      <div className={`daily-training-config__papers ${confirmed ? 'success' : 'error'}`} >
        {papers.map((paper, index) => (
          <div
            key={index}
            className={`daily-training-config__paper ${(activePaperIndex === index && !confirmed) ? 'active' : ''
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

      <DiceRoller
        className="daily-training-config-dice-roller"
        lockedDie={12}
        onRollResult={handleRollResult}
        hidePrompt
        fixedResult={papers[4].value || undefined}
        disabled={confirmed}
      />

      {!confirmed && (
        <div
          className="daily-training-config__actions"
          style={{
            '--primary-color': user?.theme[0] || '#000',
            '--primary-color-rgb': hexToRgb(user?.theme[0] || '#000'),
            '--dark-color': user?.theme[1] || '#333',
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
            {confirmed ? 'Confirmed' : 'Confirm'}
          </button>
        </div>
      )}

      {saving && (
        <div className="daily-training-config__saving-message">
          <div className="daily-training-config__saving-message__loader-ring" />
          Saving...
        </div>
      )}
    </div>
  );
}
