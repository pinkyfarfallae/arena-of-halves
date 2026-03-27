import { useState, useEffect } from 'react';
import { fetchAllCharacters } from '../../../../data/characters';
import { Character } from '../../../../types/character';
import Drachma from '../../../../icons/Drachma';
import { fetchHarvests, approveHarvest, rejectHarvest } from '../../../../services/harvest/fetchHarvest';
import { type HarvestSubmission, HarvestScriptCopyStatus } from '../../../../types/harvest';
import { THREAD_EXTRACTOR_SCRIPT } from '../../../../constants/threadExtractor';
import { useAuth } from '../../../../hooks/useAuth';
import { HARVEST_SCRIPT_COPY_STATUS, HARVEST_SUBMISSION_STATUS } from '../../../../constants/harvest';
import { parseScriptOutput, extractTwitterHandle } from '../../../../services/harvest/harvestApproval';
import './HarvestApproval.scss';

function HarvestApproval() {
  const { user } = useAuth();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [loadError, setLoadError] = useState('');
  const [activeSubmission, setActiveSubmission] = useState<string | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [matchedCharacters, setMatchedCharacters] = useState<Character[]>([]);
  const [selectedRoleplayers, setSelectedRoleplayers] = useState<string[]>([]);
  const [scriptCopyStatus, setScriptCopyStatus] = useState<HarvestScriptCopyStatus>(HARVEST_SCRIPT_COPY_STATUS.IDLE);

  // Load characters
  useEffect(() => {
    fetchAllCharacters().then(setCharacters);
  }, []);

  useEffect(() => {
    const loadHarvests = async () => {
      const result = await fetchHarvests();
      if (result.error) {
        setLoadError(result.error);
        return;
      }

      setLoadError('');
      setSubmissions(result.harvests);
    };

    loadHarvests();
  }, []);

  // Auto-match characters when review text changes
  useEffect(() => {
    const scriptParsed = parseScriptOutput(reviewText);
    if (!scriptParsed) {
      setMatchedCharacters([]);
      setSelectedRoleplayers([]);
      return;
    }

    const mentions = scriptParsed.authors;
    const matched = characters.filter(char => {
      if (!char.twitter) return false;
      const charHandle = extractTwitterHandle(char.twitter);
      if (!charHandle) return false;
      return mentions.some(m => {
        const mentionHandle = extractTwitterHandle(m);
        return mentionHandle && mentionHandle === charHandle;
      });
    });

    setMatchedCharacters(matched);
    setSelectedRoleplayers(matched.map(c => c.characterId));
  }, [reviewText, characters]);

  // Count characters excluding whitespace
  const countCharacters = (text: string): number => {
    return text.replace(/\s+/g, '').length;
  };

  // Calculate rewards: 10 drachma per 200 characters (1.5x for solo roleplay)
  const calculateRewards = (charCount: number, isSolo: boolean): number => {
    const baseReward = (charCount / 200) * 10;
    return isSolo ? Math.ceil(baseReward * 1.5) : Math.ceil(baseReward);
  };

  // Toggle roleplayer selection
  const toggleRoleplayer = (characterId: string) => {
    setSelectedRoleplayers(prev =>
      prev.includes(characterId)
        ? prev.filter(id => id !== characterId)
        : [...prev, characterId]
    );
  };

  const handleApprove = async (submissionId: string) => {
    const scriptParsed = parseScriptOutput(reviewText);

    if (!scriptParsed) {
      alert('Please paste script output (use "Copy Script" button above)');
      return;
    }

    if (selectedRoleplayers.length === 0) {
      alert('No characters matched. Please add participants manually.');
      return;
    }

    const charCount = countCharacters(scriptParsed.text);
    const mentionCount = scriptParsed.tweetCount;
    const isSolo = selectedRoleplayers.length === 1;
    const drachmaReward = calculateRewards(charCount, isSolo);

    // Call API to approve and award drachma
    const result = await approveHarvest(
      submissionId,
      user?.characterId || 'admin-character-id',
      charCount,
      mentionCount,
      drachmaReward,
      selectedRoleplayers
    );

    if (result.success) {
      // Update local state on success
      setSubmissions(prev =>
        prev.map(sub =>
          sub.id === submissionId
            ? {
              ...sub,
              status: HARVEST_SUBMISSION_STATUS.APPROVED,
              reviewedAt: new Date().toISOString(),
              reviewedBy: user?.characterId || 'admin-character-id',
              charCount,
              mentionCount,
              drachmaReward,
              roleplayers: selectedRoleplayers.join(','),
            }
            : sub
        )
      );

      // Reset
      setActiveSubmission(null);
      setReviewText('');
      setMatchedCharacters([]);
      setSelectedRoleplayers([]);

      const bonusText = isSolo ? ' (Solo Bonus: +50%)' : '';
      alert(`Approved! ${drachmaReward} drachma${bonusText} awarded to ${selectedRoleplayers.length} character(s)\n${result.awarded?.join('\n') || ''}`);
    } else {
      alert(`Failed to approve: ${result.error || 'Unknown error'}`);
    }
  };

  const handleReject = async (submissionId: string) => {
    if (!rejectReason.trim()) {
      alert('Please provide a reject reason');
      return;
    }

    // Call API to reject
    const result = await rejectHarvest(
      submissionId,
      user?.characterId || 'admin-character-id',
      rejectReason
    );

    if (result.success) {
      // Update local state on success
      setSubmissions(prev =>
        prev.map(sub =>
          sub.id === submissionId
            ? {
              ...sub,
              status: HARVEST_SUBMISSION_STATUS.REJECTED,
              reviewedAt: new Date().toISOString(),
              reviewedBy: user?.characterId || 'admin-character-id',
              rejectReason,
            }
            : sub
        )
      );

      // Reset
      setActiveSubmission(null);
      setRejectReason('');
      alert('Submission rejected');
    } else {
      alert(`Failed to reject: ${result.error || 'Unknown error'}`);
    }
  };

  const getCharacterName = (characterId: string): string => {
    const char = characters.find(c => c.characterId === characterId);
    return char ? char.nicknameEng || char.characterId : characterId;
  };

  const pendingSubmissions = submissions.filter(s => s.status === HARVEST_SUBMISSION_STATUS.PENDING);
  const reviewedSubmissions = submissions.filter(s => s.status !== HARVEST_SUBMISSION_STATUS.PENDING);

  const handleCopyExtractorScript = async () => {
    try {
      await navigator.clipboard.writeText(THREAD_EXTRACTOR_SCRIPT);
      setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.SUCCESS);
      window.setTimeout(() => setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.IDLE), 2500);
    } catch (err) {
      setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.ERROR);
      window.setTimeout(() => setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.IDLE), 2500);
    }
  };

  return (
    <div className="harvest-approval">
      <div className="harvest-approval__header">
        <h2 className="harvest-approval__title">Harvest Submission Approval</h2>
        <button
          type="button"
          className={`harvest-approval__script-copy ${scriptCopyStatus !== HARVEST_SCRIPT_COPY_STATUS.IDLE ? 'harvest-approval__script-copy--' + scriptCopyStatus : ''}`}
          onClick={handleCopyExtractorScript}
          data-tooltip="Copy thread extractor script"
          data-tooltip-pos="left"
        >
          {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS
            ? '✓ Copied!'
            : scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR
              ? '✗ Failed'
              : '📋 Copy Script'}
        </button>
      </div>

      {loadError && <p className="harvest-approval__empty">{loadError}</p>}

      {/* Pending Section */}
      <section className="harvest-approval__section">
        <h3 className="harvest-approval__section-title">
          Pending ({pendingSubmissions.length})
        </h3>

        {pendingSubmissions.length === 0 ? (
          <p className="harvest-approval__empty">No pending submissions</p>
        ) : (
          <div className="harvest-approval__list">
            {pendingSubmissions.map(submission => (
              <div key={submission.id} className="harvest-approval__card">
                <div className="harvest-approval__card-header">
                  <div>
                    <strong>Submitted by: {getCharacterName(submission.characterId)}</strong>
                    <span className="harvest-approval__card-time">
                      {new Date(submission.submittedAt).toLocaleString('th-TH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                <div className="harvest-approval__card-link">
                  <div>
                    <strong>Thread:</strong>{' '}
                    <a href={submission.firstTweetUrl} target="_blank" rel="noopener noreferrer">
                      {submission.firstTweetUrl}
                    </a>
                  </div>
                </div>

                {activeSubmission === submission.id ? (
                  <div className="harvest-approval__review-form">
                    <textarea
                      className="harvest-approval__textarea"
                      placeholder="Paste script output here (click 'Copy Script' button above)"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      rows={10}
                    />

                    {matchedCharacters.length > 0 && (
                      <div className="harvest-approval__matched-characters">
                        <strong>Matched Characters ({matchedCharacters.length}):</strong>
                        <div className="harvest-approval__character-list">
                          {matchedCharacters.map(char => (
                            <label key={char.characterId} className="harvest-approval__character-item">
                              <input
                                type="checkbox"
                                checked={selectedRoleplayers.includes(char.characterId)}
                                onChange={() => toggleRoleplayer(char.characterId)}
                              />
                              <span>
                                {char.nicknameEng} (@{char.twitter})
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="harvest-approval__preview">
                      {reviewText && (() => {
                        const scriptParsed = parseScriptOutput(reviewText);

                        if (!scriptParsed) {
                          return (
                            <div style={{ color: '#e8385d' }}>
                              ⚠️ Please paste script output format (use "Copy Script" button)
                            </div>
                          );
                        }

                        const charCount = countCharacters(scriptParsed.text);
                        const isSolo = selectedRoleplayers.length === 1;
                        const reward = calculateRewards(charCount, isSolo);

                        return (
                          <>
                            <strong>🎯 Script Format Detected</strong>
                            <br />
                            <strong>Tweets extracted:</strong> {scriptParsed.tweetCount}
                            <br />
                            <strong>Characters (no spaces):</strong> {charCount}
                            <br />
                            <strong>Unique authors:</strong> {scriptParsed.authors.length}
                            <br />
                            <strong>Matched participants:</strong> {selectedRoleplayers.length}
                            <br />
                            <strong>Reward per character:</strong> <Drachma /> {reward} drachma
                            {isSolo && (
                              <>
                                <br />
                                <strong style={{ color: '#72e990' }}>✨ Solo Bonus: +50%</strong>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>

                    <div className="harvest-approval__actions">
                      <button
                        className="harvest-approval__btn harvest-approval__btn--approve"
                        onClick={() => handleApprove(submission.id)}
                        disabled={!reviewText.trim() || selectedRoleplayers.length === 0}
                      >
                        Approve & Award
                      </button>
                      <button
                        className="harvest-approval__btn harvest-approval__btn--cancel"
                        onClick={() => {
                          setActiveSubmission(null);
                          setReviewText('');
                          setMatchedCharacters([]);
                          setSelectedRoleplayers([]);
                        }}
                      >
                        Cancel
                      </button>
                    </div>

                    <div className="harvest-approval__reject-section">
                      <input
                        type="text"
                        className="harvest-approval__reject-input"
                        placeholder="Or type reject reason..."
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                      />
                      <button
                        className="harvest-approval__btn harvest-approval__btn--reject"
                        onClick={() => handleReject(submission.id)}
                        disabled={!rejectReason.trim()}
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="harvest-approval__btn harvest-approval__btn--review"
                    onClick={() => setActiveSubmission(submission.id)}
                  >
                    Review
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Reviewed Section */}
      <section className="harvest-approval__section">
        <h3 className="harvest-approval__section-title">
          Recently Reviewed ({reviewedSubmissions.length})
        </h3>

        {reviewedSubmissions.length === 0 ? (
          <p className="harvest-approval__empty">No reviewed submissions yet</p>
        ) : (
          <div className="harvest-approval__list">
            {reviewedSubmissions.map(submission => (
              <div
                key={submission.id}
                className={`harvest-approval__card harvest-approval__card--${submission.status}`}
              >
                <div className="harvest-approval__card-header">
                  <div>
                    <strong>{getCharacterName(submission.characterId)}</strong>
                    <span className={`harvest-approval__status harvest-approval__status--${submission.status}`}>
                      {submission.status === HARVEST_SUBMISSION_STATUS.APPROVED ? 'Approved' : 'Rejected'}
                    </span>
                  </div>
                  <span className="harvest-approval__card-time">
                    {submission.reviewedAt &&
                      new Date(submission.reviewedAt).toLocaleString('th-TH', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </span>
                </div>

                <div className="harvest-approval__card-link">
                  <div>
                    <a href={submission.firstTweetUrl} target="_blank" rel="noopener noreferrer">
                      Thread
                    </a>
                  </div>
                </div>

                {submission.status === HARVEST_SUBMISSION_STATUS.APPROVED && (
                  <div className="harvest-approval__reward">
                    <Drachma /> {submission.drachmaReward} drachma × {submission.roleplayers ? submission.roleplayers.split(',').filter(Boolean).length : 0} characters
                    {submission.roleplayers && submission.roleplayers.split(',').filter(Boolean).length === 1 && (
                      <span style={{ color: '#72e990', marginLeft: '0.5rem' }}>✨ +50% Solo</span>
                    )}
                    <div className="harvest-approval__details">
                      ({submission.charCount} chars, {submission.mentionCount} tweets)
                    </div>
                    {submission.roleplayers && submission.roleplayers.length > 0 && (
                      <div className="harvest-approval__roleplayers">
                        {submission.roleplayers.split(',').map((id: string) => getCharacterName(id.trim())).join(', ')}
                      </div>
                    )}
                  </div>
                )}

                {submission.status === HARVEST_SUBMISSION_STATUS.REJECTED && submission.rejectReason && (
                  <div className="harvest-approval__reject-note">
                    Reason: {submission.rejectReason}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default HarvestApproval;
