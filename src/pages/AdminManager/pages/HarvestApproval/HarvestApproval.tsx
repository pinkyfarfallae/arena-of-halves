import { useState, useEffect } from 'react';
import { fetchAllCharacters } from '../../../../data/characters';
import { Character } from '../../../../types/character';
import Drachma from '../../../../icons/Drachma';
import { fetchHarvests, approveHarvest, rejectHarvest, } from '../../../../services/harvest/fetchHarvest';
import { type HarvestSubmission, HarvestScriptCopyStatus, HarvestSubmissionStatus, } from '../../../../types/harvest';
import { COPY_RESULT_SCRIPT, THREAD_EXTRACTOR_SCRIPT } from '../../../../constants/threadExtractor';
import { useAuth } from '../../../../hooks/useAuth';
import { HARVEST_SCRIPT_COPY_STATUS, HARVEST_SUBMISSION_STATUS, } from '../../../../constants/harvest';
import { parseScriptOutput, extractTwitterHandle } from '../../../../services/harvest/harvestApproval';
import Close from '../../../../icons/Close';
import ChevronLeft from '../../../../icons/ChevronLeft';
import SubmissionCard from '../../../StrawberryFields/components/SubmissionCard/SubmissionCard';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import InfoCircle from '../../../Shop/icons/InfoCircle';
import OpenLink from '../../../StrawberryFields/components/SubmissionCard/icons/OpenLink';
import CopyIcon from '../../../Arena/icons/Copy';
import ApproveModal from './components/ApproveModal/ApproveModal';
import RejectModal from './components/RejectModal/RejectModal';
import SuccessModal from './components/SuccessModal/SuccessModal';
import { fetchIrisWishesByDate } from '../../../../data/wishes';
import { DEITY } from '../../../../constants/deities';
import './HarvestApproval.scss';

function HarvestApproval() {
  const { user } = useAuth();
  const { width } = useScreenSize();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [reviewText, setReviewText] = useState('');

  const [matchedCharacters, setMatchedCharacters] = useState<Character[]>([]);
  const [selectedRoleplayers, setSelectedRoleplayers] = useState<string[]>([]);

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<HarvestSubmissionStatus>(HARVEST_SUBMISSION_STATUS.PENDING);

  const [reviewingSubmission, setReviewingSubmission] = useState<HarvestSubmission | null>(submissions[0] || null);

  const [scriptCopyStatus, setScriptCopyStatus] =
    useState<HarvestScriptCopyStatus>(
      HARVEST_SCRIPT_COPY_STATUS.IDLE
    );

  const [scriptResultCopyStatus, setScriptResultCopyStatus] =
    useState<HarvestScriptCopyStatus>(
      HARVEST_SCRIPT_COPY_STATUS.IDLE
    )

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [tempRejectReason, setTempRejectReason] = useState('');
  const [approveData, setApproveData] = useState<{
    charCount: number;
    tweetCount: number;
    reward: number;
    roleplayers: string[];
    isSolo: boolean;
  } | null>(null);

  const [reviewingTaskDateWishes, setReviewingTaskDateWishes] = useState<any[]>([]);

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
    if (!reviewingSubmission) {
      setReviewingTaskDateWishes([]);
      return;
    }

    const formattedDate = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Bangkok'
    }).format(new Date(reviewingSubmission.submittedAt));

    fetchIrisWishesByDate(formattedDate)
      .then((wishes) => {
        setReviewingTaskDateWishes(wishes);
      })
      .catch((error) => {
        setReviewingTaskDateWishes([]);
      });
  }, [reviewingSubmission]);

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

  const navigateToNextPending = () => {
    const pending = submissions.filter(
      (s) => {
        const isCurrent = reviewingSubmission ? s.id === reviewingSubmission.id : false;
        return s.status === HARVEST_SUBMISSION_STATUS.PENDING && s.firstTweetUrl && s.firstTweetUrl.trim() !== '' && !isCurrent;
      }
    );

    if (pending.length > 0) {
      setReviewingSubmission(pending[0]);
      setReviewText('');
      setSelectedRoleplayers([]);
      setMatchedCharacters([]);
    } else {
      setReviewingSubmission(null);
      setReviewText('');
      setSelectedRoleplayers([]);
      setMatchedCharacters([]);
    }
  };

  const handleApproveClick = () => {
    const scriptParsed = parseScriptOutput(reviewText);

    if (!scriptParsed) {
      return;
    }

    if (selectedRoleplayers.length === 0) {
      return;
    }

    const charCount = countCharacters(scriptParsed.text);
    const mentionCount = scriptParsed.tweetCount;
    const isSolo = selectedRoleplayers.length === 1;
    const reward = calculateRewards(charCount, isSolo);

    setApproveData({
      charCount,
      tweetCount: mentionCount,
      reward,
      roleplayers: selectedRoleplayers,
      isSolo,
    });
    setShowApproveModal(true);
  };

  const handleApprove = async (submissionId: string) => {
    if (!approveData) return;

    // Collect character IDs that have Demeter blessing for this date
    const demeterBonusIds = reviewingTaskDateWishes
      .filter((w) => w.deity === DEITY.DEMETER)
      .map((w) => w.userId);

    const result = await approveHarvest(
      submissionId,
      user?.characterId || 'admin',
      approveData.charCount,
      approveData.tweetCount,
      approveData.reward,
      approveData.roleplayers,
      demeterBonusIds
    );

    if (!result.success) {
      return;
    }

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
            ...s,
            status: HARVEST_SUBMISSION_STATUS.APPROVED,
            reviewedAt: new Date().toISOString(),
            drachmaReward: approveData.reward,
            charCount: approveData.charCount,
            tweetCount: approveData.tweetCount,
            roleplayers: approveData.roleplayers.join(','),
          }
          : s
      )
    );

    setShowApproveModal(false);
    setApproveData(null);

    const pendingCount = submissions.filter(
      (s) => {
        const isCurrent = reviewingSubmission ? s.id === reviewingSubmission.id : false;
        return s.status === HARVEST_SUBMISSION_STATUS.PENDING && s.firstTweetUrl && s.firstTweetUrl.trim() !== '' && !isCurrent;
      }
    ).length;

    if (pendingCount > 0) {
      setSuccessMessage(`Approved successfully!\nMoving to next pending submission...`);
    } else {
      setSuccessMessage('Approved successfully!\nNo more pending submissions.');
    }
    setShowSuccessModal(true);

    setTimeout(() => {
      setShowSuccessModal(false);
      navigateToNextPending();
    }, 2000);
  };

  const handleRejectClick = () => {
    setTempRejectReason('');
    setShowRejectModal(true);
  };

  const handleReject = async (submissionId: string) => {
    if (!tempRejectReason.trim()) return;

    const result = await rejectHarvest(
      submissionId,
      user?.characterId || 'admin',
      tempRejectReason
    );

    if (!result.success) {
      return;
    }

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
            ...s,
            status: HARVEST_SUBMISSION_STATUS.REJECTED,
            rejectReason: tempRejectReason,
          }
          : s
      )
    );

    setShowRejectModal(false);
    setTempRejectReason('');

    const pendingCount = submissions.filter(
      (s) => s.status === HARVEST_SUBMISSION_STATUS.PENDING && s.id !== submissionId
    ).length;

    if (pendingCount > 0) {
      setSuccessMessage('Rejected successfully!\nMoving to next pending submission...');
    } else {
      setSuccessMessage('Rejected successfully!\nNo more pending submissions.');
    }
    setShowSuccessModal(true);

    setTimeout(() => {
      setShowSuccessModal(false);
      navigateToNextPending();
    }, 2000);
  };

  const handleCopyExtractorScript = async () => {
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

  const handleCopyResultScript = async () => {
    try {
      await navigator.clipboard.writeText(COPY_RESULT_SCRIPT);
      setScriptResultCopyStatus(HARVEST_SCRIPT_COPY_STATUS.SUCCESS);
    } catch {
      setScriptResultCopyStatus(HARVEST_SCRIPT_COPY_STATUS.ERROR);
    }

    setTimeout(
      () => setScriptResultCopyStatus(HARVEST_SCRIPT_COPY_STATUS.IDLE),
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

                  {/* Quick Reject Option */}
                  {reviewingSubmission && (
                    <div className="harvest-approval__quick-reject">
                      <div className="harvest-approval__quick-reject-content">
                        <span className="harvest-approval__quick-reject-label">
                          Need to reject this submission?
                        </span>
                        <button
                          className="harvest-approval__quick-reject-btn"
                          onClick={handleRejectClick}
                        >
                          Reject Submission
                        </button>
                      </div>
                    </div>
                  )}

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

                  {/* 3. Copy Thread Extractor Script */}
                  <div className="harvest-approval__review-section">
                    <div className="harvest-approval__review-section-header">
                      <span className='harvest-approval__review-section-number'>3</span>
                      <span className='harvest-approval__review-section-title'>Thread Extractor</span>
                      <button
                        className={`harvest-approval__copy-btn harvest-approval__copy-btn--${scriptCopyStatus.toLowerCase()}`}
                        onClick={handleCopyExtractorScript}
                      >
                        <CopyIcon />
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                      </button>
                    </div>
                    <div className="harvest-approval__review-section-content">
                      Click <strong>Copy Script</strong> and paste it into the browser console, then press <b>Enter</b>.
                      Wait for the script to scan through the entire thread and extract all tweets.
                    </div>
                  </div>

                  {/* 4. Copy Result Script */}
                  <div className="harvest-approval__review-section">
                    <div className="harvest-approval__review-section-header">
                      <span className='harvest-approval__review-section-number'>4</span>
                      <span className='harvest-approval__review-section-title'>Result Copy</span>
                      <button
                        className={`harvest-approval__copy-btn harvest-approval__copy-btn--${scriptResultCopyStatus.toLowerCase()}`}
                        onClick={handleCopyResultScript}
                      >
                        <CopyIcon />
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                      </button>
                    </div>
                    <div className="harvest-approval__review-section-content">
                      After the thread extractor finishes, click <strong>Copy Script</strong> and paste it into the console, then press <b>Enter</b>.
                      This will copy the extracted thread content to your clipboard.
                    </div>
                  </div>

                  {/* 5. Paste script output */}
                  <div className="harvest-approval__review-section">
                    <div className="harvest-approval__review-section-header">
                      <span className='harvest-approval__review-section-number'>5</span>
                      <span className='harvest-approval__review-section-title'>Paste Script Output</span>
                    </div>
                    <div className="harvest-approval__review-section-content">
                      Paste the extracted thread content into the textarea below.
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

                  {/* 6. Review Harvest Result */}
                  {reviewText.trim() && (() => {
                    const scriptParsed = parseScriptOutput(reviewText);

                    if (!scriptParsed) {
                      return (
                        <div className="harvest-approval__review-section">
                          <div className="harvest-approval__review-section-header">
                            <span className='harvest-approval__review-section-number'>6</span>
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
                          <span className='harvest-approval__review-section-number'>6</span>
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
                                <span className="harvest-approval__reward-label">Base Reward</span>
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
                                <span className="harvest-approval__reward-label">Final Reward</span>
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
                                  {(() => {
                                    return null;
                                  })()}
                                  {matchedCharacters.map((char) => {
                                    const hasDemeterWish = reviewingTaskDateWishes.some((w) => {
                                      const matches = w.userId === char.characterId && w.deity === DEITY.DEMETER;
                                      return matches;
                                    });
                                    
                                    return (
                                      <label
                                        key={char.characterId}
                                        className="harvest-approval__roleplayer-item"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={selectedRoleplayers.includes(char.characterId)}
                                          onChange={() => toggleRoleplayer(char.characterId)}
                                        />
                                        <span style={{ position: 'relative' }}>
                                          <div className="harvest-approval__roleplayer-avatar">
                                            {char.image ? (
                                              <img src={char.image} alt={char.nicknameEng} referrerPolicy="no-referrer" />
                                            ) : (
                                              <span>{(char.nicknameEng || char.characterId)[0]?.toUpperCase() || '?'}</span>
                                            )}
                                          </div>
                                          {hasDemeterWish && (
                                            <div className="harvest-approval__roleplayer-wish">
                                              x2
                                            </div>
                                          )}
                                        </span>
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
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Actions */}
                          {selectedRoleplayers.length > 0 && reviewingSubmission && (
                            <div className="harvest-approval__actions">
                              <button
                                className="harvest-approval__action-btn harvest-approval__action-btn--approve"
                                onClick={handleApproveClick}
                              >
                                Approve & Reward
                              </button>
                              <button
                                className="harvest-approval__action-btn harvest-approval__action-btn--reject"
                                onClick={handleRejectClick}
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
            ) : (
              <div className="harvest-approval__empty-state">
                <div className="harvest-approval__empty-state-icon">✓</div>
                <div className="harvest-approval__empty-state-title">All caught up!</div>
                <div className="harvest-approval__empty-state-message">
                  {submissions.filter(s => s.status === HARVEST_SUBMISSION_STATUS.PENDING).length === 0
                    ? "No pending submissions to review."
                    : "Select a submission from the sidebar to review."}
                </div>
              </div>
            )}
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

          {sidebarView === HARVEST_SUBMISSION_STATUS.PENDING && submissions.filter((s) => s.status === HARVEST_SUBMISSION_STATUS.PENDING).length > 0 && (
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
            ) : submissions.filter((s) => s.status === sidebarView).length === 0 ? (
              <div className="harvest-approval__sidebar__content--empty">No submissions found</div>
            ) : (
              submissions
                .filter((s) => s.status === sidebarView)
                .map((submission) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    focused={reviewingSubmission?.id === submission.id}
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

      <ApproveModal
        show={showApproveModal && !!approveData && !!reviewingSubmission}
        approveData={approveData}
        onClose={() => setShowApproveModal(false)}
        onConfirm={() => reviewingSubmission && handleApprove(reviewingSubmission.id)}
      />

      <RejectModal
        show={showRejectModal && !!reviewingSubmission}
        reason={tempRejectReason}
        onReasonChange={setTempRejectReason}
        onClose={() => setShowRejectModal(false)}
        onConfirm={() => reviewingSubmission && handleReject(reviewingSubmission.id)}
      />

      <SuccessModal
        show={showSuccessModal}
        message={successMessage}
      />
    </div>
  );
}

export default HarvestApproval;
