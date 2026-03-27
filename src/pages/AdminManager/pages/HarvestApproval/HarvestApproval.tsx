import { useState, useEffect } from 'react';
import { fetchAllCharacters } from '../../../../data/characters';
import { Character } from '../../../../types/character';
import Drachma from '../../../../icons/Drachma';
import { fetchHarvests, approveHarvest, rejectHarvest, } from '../../../../services/harvest/fetchHarvest';
import { type HarvestSubmission, HarvestScriptCopyStatus, HarvestSubmissionStatus, } from '../../../../types/harvest';
import { THREAD_EXTRACTOR_SCRIPT } from '../../../../constants/threadExtractor';
import { useAuth } from '../../../../hooks/useAuth';
import { HARVEST_SCRIPT_COPY_STATUS, HARVEST_SUBMISSION_STATUS, } from '../../../../constants/harvest';
import { parseScriptOutput, extractTwitterHandle } from '../../../../services/harvest/harvestApproval';
import Close from '../../../../icons/Close';
import ChevronLeft from '../../../../icons/ChevronLeft';
import SubmissionCard from '../../../StrawberryFields/components/SubmissionCard/SubmissionCard';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import InfoCircle from '../../../Shop/icons/InfoCircle';
import OpenLink from '../../../StrawberryFields/components/SubmissionCard/icons/OpenLink';
import CopyIcon from '../../../Arena/icons/CopyIcon';
import './HarvestApproval.scss';

function HarvestApproval() {
  const { user } = useAuth();
  const { width } = useScreenSize();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [reviewText, setReviewText] = useState('');
  const [rejectReason, setRejectReason] = useState('');

  const [matchedCharacters, setMatchedCharacters] = useState<Character[]>([]);
  const [selectedRoleplayers, setSelectedRoleplayers] = useState<string[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<HarvestSubmissionStatus>(HARVEST_SUBMISSION_STATUS.PENDING);

  const [reviewingSubmission, setReviewingSubmission] = useState<HarvestSubmission | null>(submissions[0] || null);

  const [scriptCopyStatus, setScriptCopyStatus] =
    useState<HarvestScriptCopyStatus>(
      HARVEST_SCRIPT_COPY_STATUS.IDLE
    );

  useEffect(() => {
    fetchAllCharacters().then(setCharacters);
  }, []);

  useEffect(() => {
    const loadHarvests = async () => {
      setLoading(true);
      const result = await fetchHarvests();

      if (result.error) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      setLoadError('');
      setSubmissions(result.harvests);
      setLoading(false);

      const firstPending = result.harvests.find((s) => s.status === HARVEST_SUBMISSION_STATUS.PENDING);
      setReviewingSubmission(firstPending || null);
    };

    loadHarvests();
  }, []);

  useEffect(() => {
    if (!reviewText.trim()) {
      setMatchedCharacters([]);
      setSelectedRoleplayers([]);
      return;
    }

    const scriptParsed = parseScriptOutput(reviewText);

    if (!scriptParsed) {
      setMatchedCharacters([]);
      setSelectedRoleplayers([]);
      return;
    }

    const mentions = scriptParsed.authors;

    const matched = characters.filter((char) => {
      if (!char.twitter) return false;

      const charHandle = extractTwitterHandle(char.twitter);
      if (!charHandle) return false;

      return mentions.some((m) => {
        const mentionHandle = extractTwitterHandle(m);
        return mentionHandle && mentionHandle === charHandle;
      });
    });

    setMatchedCharacters(matched);
    setSelectedRoleplayers(matched.map((c) => c.characterId));
  }, [reviewText, characters]);

  const countCharacters = (text: string) =>
    text.replace(/\s+/g, '').length;

  const calculateRewards = (charCount: number, isSolo: boolean) => {
    const base = (charCount / 200) * 10;
    return isSolo ? Math.ceil(base * 1.5) : Math.ceil(base);
  };

  const toggleRoleplayer = (id: string) => {
    setSelectedRoleplayers((prev) =>
      prev.includes(id)
        ? prev.filter((i) => i !== id)
        : [...prev, id]
    );
  };

  const getCharacterName = (id: string) => {
    const c = characters.find((x) => x.characterId === id);
    return c ? c.nicknameEng || id : id;
  };

  const handleApprove = async (submissionId: string) => {
    const scriptParsed = parseScriptOutput(reviewText);

    if (!scriptParsed) {
      alert('Please paste script output');
      return;
    }

    if (selectedRoleplayers.length === 0) {
      alert('No characters selected');
      return;
    }

    const charCount = countCharacters(scriptParsed.text);
    const mentionCount = scriptParsed.tweetCount;
    const isSolo = selectedRoleplayers.length === 1;
    const reward = calculateRewards(charCount, isSolo);

    const result = await approveHarvest(
      submissionId,
      user?.characterId || 'admin',
      charCount,
      mentionCount,
      reward,
      selectedRoleplayers
    );

    if (!result.success) {
      alert('Failed to approve');
      return;
    }

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
            ...s,
            status: HARVEST_SUBMISSION_STATUS.APPROVED,
            reviewedAt: new Date().toISOString(),
            drachmaReward: reward,
            roleplayers: selectedRoleplayers.join(','),
          }
          : s
      )
    );

    setReviewText('');
    setSelectedRoleplayers([]);
    setMatchedCharacters([]);
  };

  const handleReject = async (submissionId: string) => {
    if (!rejectReason.trim()) return;

    const result = await rejectHarvest(
      submissionId,
      user?.characterId || 'admin',
      rejectReason
    );

    if (!result.success) return;

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
            ...s,
            status: HARVEST_SUBMISSION_STATUS.REJECTED,
            rejectReason,
          }
          : s
      )
    );

    setRejectReason('');
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(
        THREAD_EXTRACTOR_SCRIPT
      );
      setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.SUCCESS);
    } catch {
      setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.ERROR);
    }

    setTimeout(
      () => setScriptCopyStatus(HARVEST_SCRIPT_COPY_STATUS.IDLE),
      2000
    );
  };

  return (
    <div className="harvest-approval">

      {/* Layout */}
      <div className={`harvest-approval__container ${sidebarOpen ? 'harvest-approval__container--sidebar-open' : ''}`}>
        {/* Main */}
        <main className="harvest-approval__main">
          {/* Top bar */}
          <header className="harvest-approval__bar">
            <div className="harvest-approval__bar-title">
              {reviewingSubmission?.id
                ? `${getCharacterName(reviewingSubmission.characterId)}'s harvest on ${new Date(reviewingSubmission.submittedAt).toLocaleDateString()}`
                : 'Harvest Submissions'}
            </div>

            {/* Mobile toggle */}
            <button className={`harvest-approval__bar-chevron ${sidebarOpen ? 'harvest-approval__bar-chevron--open' : ''}`} onClick={() => setSidebarOpen(true)}>
              <ChevronLeft />
            </button>
          </header>

          {/* Review area */}
          <div className="harvest-approval__review-area">
            {loading ? (
              <div className="harvest-approval__review-loading">Loading...</div>
            ) : loadError ? (
              <div className="harvest-approval__review-error">Something went wrong</div>
            ) : reviewingSubmission ? (
              (
                <div className="harvest-approval__review-sheet">
                  {/* 1. Open link of tweet */}
                  <div className="harvest-approval__review-section">
                    <div className="harvest-approval__review-section-header">
                      <span className='harvest-approval__review-section-number'>1</span>
                      <span className='harvest-approval__review-section-title'>Open link of tweet</span>
                      <button
                        className="harvest-approval__open-link-btn"
                        onClick={() => {
                          if (reviewingSubmission?.firstTweetUrl) {
                            window.open(reviewingSubmission.firstTweetUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        data-tooltip={"Open"}
                        data-tooltip-pos="left"
                      >
                        <OpenLink />
                      </button>
                    </div>
                    <div className="harvest-approval__review-section-content">
                      Open the submitted thread link in a new tab. Make sure the thread is accessible, complete, and not deleted or restricted.
                      Review the overall conversation flow to ensure it is a valid roleplay interaction and not spam, duplicate content, or unrelated posts.
                    </div>
                  </div>

                  {/* 2. Open console */}
                  <div className="harvest-approval__review-section">
                    <div className="harvest-approval__review-section-header">
                      <span className='harvest-approval__review-section-number'>2</span>
                      <span className='harvest-approval__review-section-title'>Open console</span>
                    </div>
                    <div className="harvest-approval__review-section-content">
                      Open your browser's developer console using any of these methods:
                      <br />
                      <div className="harvest-approval__console-options">
                        <div className="harvest-approval__option-box">
                          <span className="harvest-approval__option-box-title">Option 1: Right-click</span>
                          <div className="harvest-approval__option-box-steps">
                            • Right-click anywhere on the page
                            <br />• Click <strong>"Inspect"</strong>
                            <br />• Go to the <strong>Console</strong> tab
                          </div>
                        </div>

                        <div className="harvest-approval__option-box">
                          <span className="harvest-approval__option-box-title">Option 2: Menu</span>
                          <div className="harvest-approval__option-box-steps">
                            • Click the <strong>⋮ (three-dot menu)</strong>
                            <br />• Go to <strong>More tools → Developer tools</strong>
                            <br />• Switch to the <strong>Console</strong> tab
                          </div>
                        </div>

                        <div className="harvest-approval__option-box">
                          <span className="harvest-approval__option-box-title">Option 3: Shortcut</span>
                          <div className="harvest-approval__option-box-steps">
                            • Windows: <strong>F12</strong> or <strong>Ctrl + Shift + I</strong>
                            <br />• Mac: <strong>Cmd + Option + I</strong>
                          </div>
                        </div>
                      </div>
                      <br />
                      Make sure you are on the <strong>Console</strong> tab before running the script.
                    </div>
                  </div>

                  {/* 3. Paste script output */}
                  <div className="harvest-approval__review-section">
                    <div className="harvest-approval__review-section-header">
                      <span className='harvest-approval__review-section-number'>3</span>
                      <span className='harvest-approval__review-section-title'>Get Roleplay Content</span>
                      {width > 420 ? (
                        <button
                          className={`harvest-approval__copy-btn harvest-approval__copy-btn--${scriptCopyStatus.toLowerCase()}`}
                          onClick={handleCopyScript}
                        >
                          {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                          {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                          {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                        </button>
                      ) : (
                        <button
                          className={`harvest-approval__copy-btn harvest-approval__copy-btn--${scriptCopyStatus.toLowerCase()}`}
                          onClick={handleCopyScript}
                          data-tooltip={scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE ? "Copy Script" : scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS ? "Copied!" : "Error"}
                        >
                          <CopyIcon />
                        </button>
                      )}
                    </div>
                    <div className="harvest-approval__review-section-content">
                      Click <strong>Copy Script</strong> and paste it into the browser console, then press <b>Enter</b>.
                      Wait for the script to complete. Once completed, copy the generated output and paste it into the textarea below.
                      This data will be used to calculate character count, detect participants, and determine reward distribution.
                    </div>
                    <textarea
                      className="harvest-approval__review-section-content harvest-approval__review-section-content--textarea"
                      placeholder="Paste script output here"
                      value={reviewText}
                      onChange={(e) => setReviewText(e.target.value)}
                      required
                    />
                  </div>

                  {/* 4. Review Harvest Result */}
                  {reviewText.trim() && (() => {
                    const scriptParsed = parseScriptOutput(reviewText);

                    if (!scriptParsed) {
                      return (
                        <div className="harvest-approval__review-section">
                          <div className="harvest-approval__review-section-header">
                            <span className='harvest-approval__review-section-number'>4</span>
                            <span className='harvest-approval__review-section-title'>Review Harvest Result</span>
                          </div>
                          <div className="harvest-approval__review-section-content">
                            <div className="harvest-approval__error-message">
                              Invalid script output format. Please paste the correct output from the console.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const charCount = countCharacters(scriptParsed.text);
                    const isSolo = selectedRoleplayers.length === 1;
                    const baseReward = Math.ceil((charCount / 200) * 10);
                    const finalReward = isSolo ? Math.ceil(baseReward * 1.5) : baseReward;

                    return (
                      <div className="harvest-approval__review-section harvest-approval__review-section--result">
                        <div className="harvest-approval__review-section-header">
                          <span className='harvest-approval__review-section-number'>4</span>
                          <span className='harvest-approval__review-section-title'>Review Harvest Result</span>
                        </div>
                        <div className="harvest-approval__review-section-content">
                          {/* Statistics */}
                          <div className="harvest-approval__stats">
                            <div className="harvest-approval__stat-item">
                              <span className="harvest-approval__stat-label">{width > 420 ? 'Character Count' : 'Chars'}</span>
                              <span className="harvest-approval__stat-value">{charCount.toLocaleString()}</span>
                            </div>
                            <div className="harvest-approval__stat-item">
                              <span className="harvest-approval__stat-label">{width > 420 ? 'Tweet Count' : 'Tweets'}</span>
                              <span className="harvest-approval__stat-value">{scriptParsed.tweetCount}</span>
                            </div>
                            <div className="harvest-approval__stat-item">
                              <span className="harvest-approval__stat-label">{width > 420 ? 'Participants' : 'Players'}</span>
                              <span className="harvest-approval__stat-value">{selectedRoleplayers.length}</span>
                            </div>
                          </div>

                          <div className="harvest-approval__reward-calc__wrapper">
                            {/* Reward Calculation */}
                            <div className="harvest-approval__reward-calc">
                              <div className="harvest-approval__reward-row">
                                <span className="harvest-approval__reward-label">Base Reward:</span>
                                <span className="harvest-approval__reward-value">
                                  <Drachma /> {baseReward}
                                </span>
                              </div>
                              <div className="harvest-approval__reward-row harvest-approval__reward-row--bonus">
                                <span className="harvest-approval__reward-label">Solo Bonus (50%)</span>
                                <span className="harvest-approval__reward-value">
                                  {isSolo ? (
                                    <>
                                      <Drachma /> {Math.ceil(baseReward * 0.5)}
                                    </>
                                  ) : (
                                    0
                                  )}
                                </span>
                              </div>
                              <div className="harvest-approval__reward-row harvest-approval__reward-row--total">
                                <span className="harvest-approval__reward-label">Final Reward:</span>
                                <span className="harvest-approval__reward-value">
                                  <Drachma /> {finalReward}
                                </span>
                              </div>
                            </div>

                            {/* Roleplayer Selection */}
                            <div className="harvest-approval__roleplayers">
                              <div className="harvest-approval__roleplayers-title">
                                Detected Roleplayers ({matchedCharacters.length})
                              </div>
                              {matchedCharacters.length === 0 ? (
                                <div className="harvest-approval__no-match">
                                  No characters matched. Make sure the participants have their Twitter handles registered.
                                </div>
                              ) : (
                                <div className="harvest-approval__roleplayer-list">
                                  {matchedCharacters.map((char) => (
                                    <label
                                      key={char.characterId}
                                      className="harvest-approval__roleplayer-item"
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selectedRoleplayers.includes(char.characterId)}
                                        onChange={() => toggleRoleplayer(char.characterId)}
                                      />
                                      <div className="harvest-approval__roleplayer-avatar">
                                        {char.image ? (
                                          <img src={char.image} alt={char.nicknameEng} referrerPolicy="no-referrer" />
                                        ) : (
                                          <span>{(char.nicknameEng || char.characterId)[0]?.toUpperCase() || '?'}</span>
                                        )}
                                      </div>
                                      <div className="harvest-approval__roleplayer-info">
                                        <span className="harvest-approval__roleplayer-name">
                                          {char.nicknameEng || char.characterId}
                                        </span>
                                        {char.twitter && (
                                          <span className="harvest-approval__roleplayer-handle">
                                            @{extractTwitterHandle(char.twitter)}
                                          </span>
                                        )}
                                      </div>
                                    </label>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {selectedRoleplayers.length > 0 && reviewingSubmission && (
                            <div className="harvest-approval__actions">
                              <button
                                className="harvest-approval__action-btn harvest-approval__action-btn--approve"
                                onClick={() => handleApprove(reviewingSubmission.id)}
                              >
                                Approve & Reward
                              </button>
                              <button
                                className="harvest-approval__action-btn harvest-approval__action-btn--reject"
                                onClick={() => {
                                  const reason = prompt('Enter rejection reason:');
                                  if (reason) {
                                    setRejectReason(reason);
                                    handleReject(reviewingSubmission.id);
                                  }
                                }}
                              >
                                Reject Submission
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            ) : null}
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`harvest-approval__sidebar ${sidebarOpen ? 'harvest-approval__sidebar--open' : ''}`}>
          <div className="harvest-approval__sidebar__head">
            <div className="harvest-approval__sidebar__head-tabs">
              {Object.values(HARVEST_SUBMISSION_STATUS).map((status) => (
                <button
                  key={status}
                  className={`harvest-approval__sidebar__tab harvest-approval__sidebar__tab--${status.toLowerCase()}${sidebarView === status ? '--active' : ''}`}
                  onClick={() => setSidebarView(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <button className="harvest-approval__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>

          {sidebarView === HARVEST_SUBMISSION_STATUS.PENDING && (
            <div className="harvest-approval__sidebar__note">
              <InfoCircle />
              Click on a submission to review.
            </div>
          )}

          <div className="harvest-approval__sidebar__content">
            {loading ? (
              <div className="harvest-approval__sidebar__content--loading">Loading...</div>
            ) : loadError ? (
              <div className="harvest-approval__sidebar__content--error">Something went wrong</div>
            ) : (
              submissions
                .filter((s) => s.status === sidebarView)
                .map((submission) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    onClick={sidebarView === HARVEST_SUBMISSION_STATUS.PENDING ? () => {
                      setReviewingSubmission(submission);
                      setReviewText('');
                      setSelectedRoleplayers([]);
                      setMatchedCharacters([]);

                      if (width < 900) setSidebarOpen(false);
                    } : undefined}
                    forcedCompact
                  />
                ))
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}

export default HarvestApproval;
