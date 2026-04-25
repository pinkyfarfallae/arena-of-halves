import { useState, useEffect } from 'react';
import { fetchAllCharacters } from '../../../../data/characters';
import { Character } from '../../../../types/character';
import Drachma from '../../../../icons/Drachma';
import { fetchBigHouseRoleplays, approveBigHouseRoleplay, rejectBigHouseRoleplay } from '../../../../services/bigHouse/fetchBigHouseRoleplay';
import { type HarvestSubmission, HarvestScriptCopyStatus, HarvestSubmissionStatus, } from '../../../../types/harvest';
import { COPY_RESULT_SCRIPT, THREAD_EXTRACTOR_SCRIPT } from '../../../../constants/threadExtractor';
import { useAuth } from '../../../../hooks/useAuth';
import { HARVEST_SCRIPT_COPY_STATUS, HARVEST_SUBMISSION_STATUS, } from '../../../../constants/harvest';
import { parseScriptOutput, extractTwitterHandle } from '../../../../services/harvest/harvestApproval';
import Close from '../../../../icons/Close';
import ChevronLeft from '../../../../icons/ChevronLeft';
import SubmissionCard from '../../../BigHouse/components/SubmissionCard/SubmissionCard';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import InfoCircle from '../../../Shop/icons/InfoCircle';
import OpenLink from '../../../StrawberryFields/components/SubmissionCard/icons/OpenLink';
import CopyIcon from '../../../Arena/icons/Copy';
import ApproveModal from './components/ApproveModal/ApproveModal';
import RejectModal from './components/RejectModal/RejectModal';
import SuccessModal from './components/SuccessModal/SuccessModal';
import { fetchIrisWishesByDate } from '../../../../data/wishes';
import { getItemAmount } from '../../../../services/bag/bagService';
import { ITEMS } from '../../../../constants/items';
import { updateCharacterDrachma } from '../../../../services/character/currencyService';
import { logActivity } from '../../../../services/activityLog/activityLogService';
import Background from '../../../BigHouse/images/background.jpg';
import { BigHouseSubmission } from '../../../../types/bigHouse';
import { BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS, BigHouseSubmissionStatus } from '../../../../constants/bigHouse';
import './BigHouseSubmissionApproval.scss';

type ApproveParticipantReward = {
  characterId: string;
  name: string;
  charCount: number;
  reward: number;
  bonuses: {
    hasGardeningSet: boolean;
    hasDemeterWish: boolean;
    isSolo: boolean;
  };
};

function BigHouseSubmissionApproval() {
  const { user } = useAuth();
  const { width } = useScreenSize();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [submissions, setSubmissions] = useState<BigHouseSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [reviewText, setReviewText] = useState('');

  const [matchedCharacters, setMatchedCharacters] = useState<Character[]>([]);
  const [selectedRoleplayers, setSelectedRoleplayers] = useState<string[]>([]);
  const [characterBagData, setCharacterBagData] = useState<Record<string, { hasGardeningSet: boolean }>>({});

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarView, setSidebarView] = useState<BigHouseSubmissionStatus>(BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING);

  const [reviewingSubmission, setReviewingSubmission] = useState<BigHouseSubmission | null>(submissions[0] || null);

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
  const [isApproving, setIsApproving] = useState(false);
  const [approveData, setApproveData] = useState<{
    charCount: number;
    tweetCount: number;
    reward: number;
    roleplayers: string[];
    isSolo: boolean;
    participantRewards: ApproveParticipantReward[];
  } | null>(null);

  const [reviewingTaskDateWishes, setReviewingTaskDateWishes] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    fetchAllCharacters(user).then(setCharacters);
  }, [user?.characterId]);

  useEffect(() => {
    const loadSubmissions = async () => {
      setLoading(true);
      const result = await fetchBigHouseRoleplays();

      if (result.error) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      setLoadError('');
      setSubmissions(result.submissions);
      setLoading(false);

      const firstPending = result.submissions.find((s) => s.status === HARVEST_SUBMISSION_STATUS.PENDING);
      setReviewingSubmission(firstPending || null);
    };

    loadSubmissions();
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

  // Fetch bag data for matched characters
  useEffect(() => {
    if (matchedCharacters.length === 0) {
      setCharacterBagData({});
      return;
    }

    const fetchBagData = async () => {
      const bagDataMap: Record<string, { hasGardeningSet: boolean }> = {};

      await Promise.all(
        matchedCharacters.map(async (char) => {
          const gardeningSetAmount = await getItemAmount(char.characterId, ITEMS.DEMETER_S_GARDENING_SET);
          bagDataMap[char.characterId] = {
            hasGardeningSet: gardeningSetAmount > 0
          };
        })
      );

      setCharacterBagData(bagDataMap);
    };

    fetchBagData();
  }, [matchedCharacters]);

  const countCharacters = (text: string) =>
    text.replace(/\s+/g, '').length;

  const calculateBigHouseReward = (charCount: number): number => {
    const base = Math.round((charCount / 200) * 7);
    if (charCount > 2400) return base * 2;
    if (charCount > 1000) return base + 35;
    return base;
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
        return s.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING && s.roleplayUrl && s.roleplayUrl.trim() !== '' && !isCurrent;
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

    if (!scriptParsed) return;
    if (selectedRoleplayers.length === 0) return;

    const totalCharCount = countCharacters(scriptParsed.text);

    const participantRewards = selectedRoleplayers.map((charId) => {
      const char = matchedCharacters.find(c => c.characterId === charId);
      const handle = char?.twitter ? extractTwitterHandle(char.twitter) : null;
      const authorParsed = handle ? parseScriptOutput(reviewText, handle) : null;
      const authorCharCount = authorParsed ? countCharacters(authorParsed.text) : 0;
      const reward = calculateBigHouseReward(authorCharCount);

      return {
        characterId: charId,
        name: getCharacterName(charId),
        charCount: authorCharCount,
        reward,
        bonuses: {
          hasGardeningSet: false,
          hasDemeterWish: false,
          isSolo: false,
        },
      };
    });

    setApproveData({
      charCount: totalCharCount,
      tweetCount: scriptParsed.tweetCount,
      reward: participantRewards.reduce((sum, p) => sum + p.reward, 0),
      roleplayers: selectedRoleplayers,
      isSolo: selectedRoleplayers.length === 1,
      participantRewards,
    });
    setShowApproveModal(true);
  };

  const handleApprove = async (submissionId: string) => {
    if (!approveData) return;

    setIsApproving(true);

    // Award drachma to each participant based on their individual calculated rewards
    const rewardPromises = approveData.participantRewards.map((participant) =>
      updateCharacterDrachma(participant.characterId, participant.reward, {
        performedBy: user?.characterId || 'admin',
        source: 'big_house_approval',
      })
    );

    try {
      await Promise.all(rewardPromises);
    } catch (error) {
      setIsApproving(false);
      return;
    }

    // Build reward map: { characterId: individualReward }
    const rewardMap = approveData.participantRewards.reduce<Record<string, number>>(
      (map, participant) => {
        map[participant.characterId] = participant.reward;
        return map;
      },
      {}
    );

    // Calculate total for display
    const totalDrachmaAwarded = approveData.participantRewards.reduce(
      (sum, participant) => sum + participant.reward,
      0
    );

    // Record the Big House roleplay approval in backend
    const result = await approveBigHouseRoleplay(
      submissionId,
      user?.characterId || 'admin',
      approveData.charCount,
      approveData.tweetCount,
      JSON.stringify(rewardMap),
      approveData.roleplayers,
    );

    if (!result.success) {
      setIsApproving(false);
      return;
    }

    // Log overall approval action
    logActivity({
      category: 'action',
      action: 'approve_big_house',
      characterId: reviewingSubmission?.characterId || submissionId,
      performedBy: user?.characterId || 'admin',
      metadata: {
        submissionId,
        totalDrachma: totalDrachmaAwarded,
        roleplayers: approveData.roleplayers,
      },
    });

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
            ...s,
            status: BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.APPROVED,
            reviewedAt: new Date().toISOString(),
            charCount: approveData.charCount,
            mentionCount: approveData.tweetCount,
            drachmaReward: JSON.stringify(rewardMap),
            roleplayers: approveData.roleplayers.join(','),
          }
          : s
      )
    );

    setShowApproveModal(false);
    setApproveData(null);
    setIsApproving(false);

    const pendingCount = submissions.filter(
      (s) => {
        const isCurrent = reviewingSubmission ? s.id === reviewingSubmission.id : false;
        return s.status === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING && s.roleplayUrl && s.roleplayUrl.trim() !== '' && !isCurrent;
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

    const result = await rejectBigHouseRoleplay(
      submissionId,
      user?.characterId || 'admin',
      tempRejectReason
    );

    if (!result.success) {
      return;
    }

    // Log rejection action
    logActivity({
      category: 'action',
      action: 'reject_big_house',
      characterId: reviewingSubmission?.characterId || submissionId,
      performedBy: user?.characterId || 'admin',
      note: tempRejectReason,
      metadata: { submissionId },
    });

    setSubmissions((prev) =>
      prev.map((s) =>
        s.id === submissionId
          ? {
            ...s,
            status: BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.REJECTED,
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
    <div className="big-house-submission-approval" style={{ backgroundImage: `url(${Background})` }}>
      {/* Layout */}
      <div className={`big-house-submission-approval__container ${sidebarOpen ? 'big-house-submission-approval__container--sidebar-open' : ''}`}>
        {/* Main */}
        <main className="big-house-submission-approval__main">
          {/* Top bar */}
          <header className="big-house-submission-approval__bar">
            <div className="big-house-submission-approval__bar-title">
              {reviewingSubmission?.id
                ? `${getCharacterName(reviewingSubmission.characterId)}'s harvest on ${new Date(reviewingSubmission.submittedAt).toLocaleDateString()}`
                : 'Harvest Submissions'}
            </div>

            {/* Mobile toggle */}
            <button className={`big-house-submission-approval__bar-chevron ${sidebarOpen ? 'big-house-submission-approval__bar-chevron--open' : ''}`} onClick={() => setSidebarOpen(true)}>
              <ChevronLeft />
            </button>
          </header>

          {/* Review area */}
          <div className="big-house-submission-approval__review-area">
            {loading ? (
              <div className="big-house-submission-approval__review-loading">Loading...</div>
            ) : loadError ? (
              <div className="big-house-submission-approval__review-error">Something went wrong</div>
            ) : reviewingSubmission ? (
              (
                <div className="big-house-submission-approval__review-sheet">
                  {/* 1. Open link of tweet */}
                  <div className="big-house-submission-approval__review-section">
                    <div className="big-house-submission-approval__review-section-header">
                      <span className='big-house-submission-approval__review-section-number'>1</span>
                      <span className='big-house-submission-approval__review-section-title'>Open link of tweet</span>
                      <button
                        className="big-house-submission-approval__open-link-btn"
                        onClick={() => {
                          if (reviewingSubmission?.roleplayUrl) {
                            window.open(reviewingSubmission.roleplayUrl, '_blank', 'noopener,noreferrer');
                          }
                        }}
                        data-tooltip={"Open"}
                        data-tooltip-pos="left"
                      >
                        <OpenLink />
                      </button>
                    </div>
                    <div className="big-house-submission-approval__review-section-content">
                      Open the submitted thread link in a new tab. Make sure the thread is accessible, complete, and not deleted or restricted.
                      Review the overall conversation flow to ensure it is a valid roleplay interaction and not spam, duplicate content, or unrelated posts.
                    </div>
                  </div>

                  {/* Quick Reject Option */}
                  {reviewingSubmission && (
                    <div className="big-house-submission-approval__quick-reject">
                      <div className="big-house-submission-approval__quick-reject-content">
                        <span className="big-house-submission-approval__quick-reject-label">
                          Need to reject this submission?
                        </span>
                        <button
                          className="big-house-submission-approval__quick-reject-btn"
                          onClick={handleRejectClick}
                        >
                          Reject Submission
                        </button>
                      </div>
                    </div>
                  )}

                  {/* 2. Open console */}
                  <div className="big-house-submission-approval__review-section">
                    <div className="big-house-submission-approval__review-section-header">
                      <span className='big-house-submission-approval__review-section-number'>2</span>
                      <span className='big-house-submission-approval__review-section-title'>Open console</span>
                    </div>
                    <div className="big-house-submission-approval__review-section-content">
                      Open your browser's developer console using any of these methods:
                      <br />
                      <div className="big-house-submission-approval__console-options">
                        <div className="big-house-submission-approval__option-box">
                          <span className="big-house-submission-approval__option-box-title">Option 1: Right-click</span>
                          <div className="big-house-submission-approval__option-box-steps">
                            • Right-click anywhere on the page
                            <br />• Click <strong>"Inspect"</strong>
                            <br />• Go to the <strong>Console</strong> tab
                          </div>
                        </div>

                        <div className="big-house-submission-approval__option-box">
                          <span className="big-house-submission-approval__option-box-title">Option 2: Menu</span>
                          <div className="big-house-submission-approval__option-box-steps">
                            • Click the <strong>⋮ (three-dot menu)</strong>
                            <br />• Go to <strong>More tools → Developer tools</strong>
                            <br />• Switch to the <strong>Console</strong> tab
                          </div>
                        </div>

                        <div className="big-house-submission-approval__option-box">
                          <span className="big-house-submission-approval__option-box-title">Option 3: Shortcut</span>
                          <div className="big-house-submission-approval__option-box-steps">
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
                  <div className="big-house-submission-approval__review-section">
                    <div className="big-house-submission-approval__review-section-header">
                      <span className='big-house-submission-approval__review-section-number'>3</span>
                      <span className='big-house-submission-approval__review-section-title'>Thread Extractor</span>
                      <button
                        className={`big-house-submission-approval__copy-btn big-house-submission-approval__copy-btn--${scriptCopyStatus.toLowerCase()}`}
                        onClick={handleCopyExtractorScript}
                      >
                        <CopyIcon />
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                        {scriptCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                      </button>
                    </div>
                    <div className="big-house-submission-approval__review-section-content">
                      Click <strong>Copy Script</strong> and paste it into the browser console, then press <b>Enter</b>.
                      Wait for the script to scan through the entire thread and extract all tweets.
                    </div>
                  </div>

                  {/* 4. Copy Result Script */}
                  <div className="big-house-submission-approval__review-section">
                    <div className="big-house-submission-approval__review-section-header">
                      <span className='big-house-submission-approval__review-section-number'>4</span>
                      <span className='big-house-submission-approval__review-section-title'>Result Copy</span>
                      <button
                        className={`big-house-submission-approval__copy-btn big-house-submission-approval__copy-btn--${scriptResultCopyStatus.toLowerCase()}`}
                        onClick={handleCopyResultScript}
                      >
                        <CopyIcon />
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.IDLE && 'Copy Script'}
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.SUCCESS && 'Copied!'}
                        {scriptResultCopyStatus === HARVEST_SCRIPT_COPY_STATUS.ERROR && 'Error'}
                      </button>
                    </div>
                    <div className="big-house-submission-approval__review-section-content">
                      After the thread extractor finishes, click <strong>Copy Script</strong> and paste it into the console, then press <b>Enter</b>.
                      This will copy the extracted thread content to your clipboard.
                    </div>
                  </div>

                  {/* 5. Paste script output */}
                  <div className="big-house-submission-approval__review-section">
                    <div className="big-house-submission-approval__review-section-header">
                      <span className='big-house-submission-approval__review-section-number'>5</span>
                      <span className='big-house-submission-approval__review-section-title'>Paste Script Output</span>
                    </div>
                    <div className="big-house-submission-approval__review-section-content">
                      Paste the extracted thread content into the textarea below.
                      This data will be used to calculate character count, detect participants, and determine reward distribution.
                    </div>
                    <textarea
                      className="big-house-submission-approval__review-section-content big-house-submission-approval__review-section-content--textarea"
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
                        <div className="big-house-submission-approval__review-section">
                          <div className="big-house-submission-approval__review-section-header">
                            <span className='big-house-submission-approval__review-section-number'>6</span>
                            <span className='big-house-submission-approval__review-section-title'>Review Harvest Result</span>
                          </div>
                          <div className="big-house-submission-approval__review-section-content">
                            <div className="big-house-submission-approval__error-message">
                              Invalid script output format. Please paste the correct output from the console.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    const charCount = countCharacters(scriptParsed.text);

                    return (
                      <div className="big-house-submission-approval__review-section big-house-submission-approval__review-section--result">
                        <div className="big-house-submission-approval__review-section-header">
                          <span className='big-house-submission-approval__review-section-number'>6</span>
                          <span className='big-house-submission-approval__review-section-title'>Review Harvest Result</span>
                        </div>
                        <div className="big-house-submission-approval__review-section-content">
                          {/* Statistics */}
                          <div className="big-house-submission-approval__stats">
                            <div className="big-house-submission-approval__stat-item">
                              <span className="big-house-submission-approval__stat-label">{width > 420 ? 'Character Count' : 'Chars'}</span>
                              <span className="big-house-submission-approval__stat-value">{charCount.toLocaleString()}</span>
                            </div>
                            <div className="big-house-submission-approval__stat-item">
                              <span className="big-house-submission-approval__stat-label">{width > 420 ? 'Tweet Count' : 'Tweets'}</span>
                              <span className="big-house-submission-approval__stat-value">{scriptParsed.tweetCount}</span>
                            </div>
                            <div className="big-house-submission-approval__stat-item">
                              <span className="big-house-submission-approval__stat-label">{width > 420 ? 'Participants' : 'Players'}</span>
                              <span className="big-house-submission-approval__stat-value">{selectedRoleplayers.length}</span>
                            </div>
                          </div>

                          <div className="big-house-submission-approval__reward-calc__wrapper">
                            {/* Roleplayer Selection */}
                            <div className="big-house-submission-approval__roleplayers">
                              <div className="big-house-submission-approval__roleplayers-title">
                                Detected Roleplayers ({matchedCharacters.length})
                              </div>
                              {matchedCharacters.length === 0 ? (
                                <div className="big-house-submission-approval__no-match">
                                  No characters matched. Make sure the participants have their Twitter handles registered.
                                </div>
                              ) : (
                                <div className="big-house-submission-approval__roleplayer-list">
                                  {(() => {
                                    return null;
                                  })()}
                                  {matchedCharacters.map((char) => {
                                    const handle = char.twitter ? extractTwitterHandle(char.twitter) : null;
                                    const isSelected = selectedRoleplayers.includes(char.characterId);
                                    const authorParsed = isSelected && handle ? parseScriptOutput(reviewText, handle) : null;
                                    const authorCharCount = authorParsed ? countCharacters(authorParsed.text) : 0;
                                    const authorReward = isSelected ? calculateBigHouseReward(authorCharCount) : 0;

                                    return (
                                      <label
                                        key={char.characterId}
                                        className="big-house-submission-approval__roleplayer-item"
                                      >
                                        <input
                                          type="checkbox"
                                          checked={isSelected}
                                          onChange={() => toggleRoleplayer(char.characterId)}
                                        />
                                        <div className="big-house-submission-approval__roleplayer-avatar">
                                          {char.image ? (
                                            <img src={char.image} alt={char.nicknameEng} referrerPolicy="no-referrer" />
                                          ) : (
                                            <span>{(char.nicknameEng || char.characterId)[0]?.toUpperCase() || '?'}</span>
                                          )}
                                        </div>
                                        <div className="big-house-submission-approval__roleplayer-info">
                                          <span className="big-house-submission-approval__roleplayer-name">
                                            {char.nicknameEng || char.characterId}
                                            {handle && (
                                              <span className="big-house-submission-approval__roleplayer-handle">
                                                @{handle}
                                              </span>
                                            )}
                                          </span>
                                          {isSelected && (
                                            <span className="big-house-submission-approval__roleplayer-reward">
                                              {width > 350 && `${authorCharCount.toLocaleString()} chars → `}<Drachma className="big-house-submission-approval__roleplayer-reward-icon" /> {authorReward}
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
                            <div className="big-house-submission-approval__actions">
                              <button
                                className="big-house-submission-approval__action-btn big-house-submission-approval__action-btn--approve"
                                onClick={handleApproveClick}
                              >
                                Approve & Reward
                              </button>
                              <button
                                className="big-house-submission-approval__action-btn big-house-submission-approval__action-btn--reject"
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
              <div className="big-house-submission-approval__empty-state">
                <div className="big-house-submission-approval__empty-state-icon">✓</div>
                <div className="big-house-submission-approval__empty-state-title">All caught up!</div>
                <div className="big-house-submission-approval__empty-state-message">
                  {submissions.filter(s => s.status === HARVEST_SUBMISSION_STATUS.PENDING).length === 0
                    ? "No pending submissions to review."
                    : "Select a submission from the sidebar to review."}
                </div>
              </div>
            )}
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`big-house-submission-approval__sidebar ${sidebarOpen ? 'big-house-submission-approval__sidebar--open' : ''}`}>
          <div className="big-house-submission-approval__sidebar__head">
            <div className="big-house-submission-approval__sidebar__head-tabs">
              {Object.values(HARVEST_SUBMISSION_STATUS).map((status) => (
                <button
                  key={status}
                  className={`big-house-submission-approval__sidebar__tab big-house-submission-approval__sidebar__tab--${status.toLowerCase()}${sidebarView === status ? '--active' : ''}`}
                  onClick={() => setSidebarView(status)}
                >
                  {status}
                </button>
              ))}
            </div>
            <button className="big-house-submission-approval__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>

          {sidebarView === HARVEST_SUBMISSION_STATUS.PENDING && submissions.filter((s) => s.status === HARVEST_SUBMISSION_STATUS.PENDING).length > 0 && (
            <div className="big-house-submission-approval__sidebar__note">
              <InfoCircle />
              Click on a submission to review.
            </div>
          )}

          <div className="big-house-submission-approval__sidebar__content">
            {loading ? (
              <div className="big-house-submission-approval__sidebar__content--loading">Loading...</div>
            ) : loadError ? (
              <div className="big-house-submission-approval__sidebar__content--error">Something went wrong</div>
            ) : submissions.filter((s) => s.status === sidebarView).length === 0 ? (
              <div className="big-house-submission-approval__sidebar__content--empty">No submissions found</div>
            ) : (
              submissions
                .filter((s) => s.status === sidebarView)
                .map((submission) => (
                  <SubmissionCard
                    key={submission.id}
                    submission={submission}
                    characters={characters}
                    focused={reviewingSubmission?.id === submission.id}
                    onClick={sidebarView === BIG_HOUSE_ROLEPLAY_SUBMISSION_STATUS.PENDING ? () => {
                      setReviewingSubmission(submission);
                      setReviewText('');
                      setSelectedRoleplayers([]);
                      setMatchedCharacters([]);

                      if (width < 900) setSidebarOpen(false);
                    } : undefined}
                    forcedCompact
                    isAdmin
                  />
                ))
            )}
          </div>
        </aside>
      </div>

      <ApproveModal
        show={showApproveModal && !!approveData && !!reviewingSubmission}
        approveData={approveData}
        isApproving={isApproving}
        onClose={() => !isApproving && setShowApproveModal(false)}
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

export default BigHouseSubmissionApproval;
