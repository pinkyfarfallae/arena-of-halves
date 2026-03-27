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
import Eye from '../../../Login/icons/Eye';
import ChevronLeft from '../../../../icons/ChevronLeft';
import SubmissionCard from '../../../StrawberryFields/components/SubmissionCard/SubmissionCard';
import { useScreenSize } from '../../../../hooks/useScreenSize';
import './HarvestApproval.scss';
import InfoCircle from '../../../Shop/icons/InfoCircle';

function HarvestApproval() {
  const { user } = useAuth();
  const { width } = useScreenSize();

  const [characters, setCharacters] = useState<Character[]>([]);
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [activeSubmission, setActiveSubmission] = useState<string | null>(null);
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

  const pendingSubmissions = submissions.filter(
    (s) => s.status === HARVEST_SUBMISSION_STATUS.PENDING
  );

  const reviewedSubmissions = submissions.filter(
    (s) => s.status !== HARVEST_SUBMISSION_STATUS.PENDING
  );

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

    setActiveSubmission(null);
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

    setActiveSubmission(null);
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
            <div className="harvest-approval__review-sheet"></div>
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
                      setActiveSubmission(submission.id);
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
