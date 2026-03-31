import React, { useState, useEffect } from 'react';
import { getTodayTarget, setDailyTarget, getTodayDate } from '../../../../services/training/dailyTrainingDice';
import './DailyTrainingConfig.scss';

export default function DailyTrainingConfig() {
  const [target, setTarget] = useState<number>(4);
  const [currentTarget, setCurrentTarget] = useState<number | null>(null);
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
      setCurrentTarget(todayTarget);
      if (todayTarget !== null) {
        setTarget(todayTarget);
      }
    } catch (err: any) {
      console.error('Failed to load current target:', err);
      
      // Check if it's a Firestore offline error
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

  const handleSave = async () => {
    try {
      setSaving(true);
      setMessage(null);

      await setDailyTarget(target);
      setCurrentTarget(target);
      setMessage({ type: 'success', text: `Successfully set today's target to ${target}` });
    } catch (err: any) {
      console.error('Failed to save target:', err);
      
      // Check if it's a Firestore offline error
      if (err.code === 'unavailable' || err.message?.includes('offline')) {
        setMessage({ 
          type: 'error', 
          text: 'Firestore is not enabled. Please enable Firestore in Firebase Console. See FIRESTORE_SETUP.md' 
        });
      } else {
        setMessage({ type: 'error', text: err.message || 'Failed to save target' });
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
      <div className="daily-training-config__header">
        <h2>Daily Training Configuration</h2>
        <p className="daily-training-config__date">
          Date: {getTodayDate()}
        </p>
      </div>

      <div className="daily-training-config__content">
        <div className="daily-training-config__current">
          <h3>Current Target</h3>
          {currentTarget !== null ? (
            <div className="daily-training-config__current-value">
              {currentTarget}
            </div>
          ) : (
            <div className="daily-training-config__no-target">
              No target set for today
            </div>
          )}
        </div>

        <div className="daily-training-config__form">
          <h3>Set New Target</h3>
          <p className="daily-training-config__description">
            Players need at least 3 dice rolls ≥ target to succeed
          </p>

          <div className="daily-training-config__target-selector">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((num) => (
              <button
                key={num}
                className={`daily-training-config__target-button ${target === num ? 'active' : ''}`}
                onClick={() => setTarget(num)}
                disabled={saving}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            className="daily-training-config__save-button"
            onClick={handleSave}
            disabled={saving || target === currentTarget}
          >
            {saving ? 'Saving...' : 'Set Target'}
          </button>

          {message && (
            <div className={`daily-training-config__message daily-training-config__message--${message.type}`}>
              {message.text}
            </div>
          )}
        </div>

        <div className="daily-training-config__info">
          <h3>How It Works</h3>
          <ul>
            <li>Each player can train once per day</li>
            <li>They roll 5 twelve-sided dice (d12, values 1-12)</li>
            <li>Need at least 3 rolls ≥ target to succeed</li>
            <li>Results are saved to Firestore</li>
            <li>Results are appended to Google Sheets</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
