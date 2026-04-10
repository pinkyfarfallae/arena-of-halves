import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import Book from '../../icons/Book';
import Trophy from '../../icons/Trophy';
import QuestionMark from '../../icons/QuestionMark';
import Drachma from '../../icons/Drachma';
import { submitHarvest, fetchHarvests, fetchTopHarvesters } from '../../services/harvest/fetchHarvest';
import { HarvestSubmission, HarvestSubmissionStatus, SidebarView, TopHarvester } from '../../types/harvest';
import Strawberry from '../LifeInCamp/components/LocationIcon/icons/Strawberry';
import HarvestRulesModal from './components/HarvestRulesModal/HarvestRulesModal';
import { HARVEST_SUBMISSION_STATUS, SIDEBAR_VIEW } from '../../constants/harvest';
import SubmissionSuccessCard from './components/SubmissionSuccessCard/SubmissionSuccessCard';
import SubmissionCard from './components/SubmissionCard/SubmissionCard';
import { LANGUAGE } from '../../constants/language';
import Close from '../../icons/Close';
import HarvestRecordCard from './components/HarvestRecordCard/HarvestRecordCard';
import { Character, fetchAllCharacters } from '../../data/characters';
import HarvestorChip from './components/HarvestRecordCard/components/HarvestorChip/HarvestorChip';
import Crown from '../../icons/Crown';
import { hexToRgb } from '../../utils/color';
import InfoCircle from '../Shop/icons/InfoCircle';
import { useScreenSize } from '../../hooks/useScreenSize';
import { fetchTodayIrisWish } from '../../data/wishes';
import { DEITY } from '../../constants/deities';
import './StrawberryFields.scss';

function StrawberryFields() {
  const { user } = useAuth();
  const { width } = useScreenSize();
  const { t, lang } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [submissionsRecord, setSubmissionsRecord] = useState<HarvestSubmission[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>(SIDEBAR_VIEW.RECORD);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [isLoadingSubmissionsRecord, setIsLoadingSubmissionsRecord] = useState(false);
  const [topHarvestors, setTopHarvestors] = useState<TopHarvester[]>([]);
  const [isLoadingTopHarvestors, setIsLoadingTopHarvestors] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [allCampData, setAllCampData] = useState<Character[]>([]);
  const [filterStatus, setFilterStatus] = useState<HarvestSubmissionStatus | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasDemeterBonus, setHasDemeterBonus] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!user) return;

    fetchAllCharacters(user)
      .then((data) => {
        if (mounted) setAllCampData(data || []);
      })
      .catch(() => { });

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    let mounted = true;

    if (!user) return;

    fetchAllCharacters(user)
      .then((data) => {
        if (mounted) setAllCampData(data || []);
      })
      .catch(() => { });

    return () => {
      mounted = false;
    };
  }, [user]);

  useEffect(() => {
    if (!user?.characterId) return;

    let mounted = true;

    const loadSubmissions = async () => {
      setIsLoadingSubmissions(true);

      try {
        const result = await fetchHarvests(user.characterId);

        if (!mounted) return;

        if (result.error) {
          return;
        }

        const sorted = [...result.harvests].sort(
          (a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)
        );

        setSubmissions(sorted);
      } catch (err) {
      } finally {
        if (mounted) setIsLoadingSubmissions(false);
      }
    };

    fetchTodayIrisWish(user?.characterId || '').then(wish => {
      if (!mounted) return;
      setHasDemeterBonus(wish?.deity === DEITY.DEMETER);
    }).catch(() => {
      if (!mounted) return;
      setHasDemeterBonus(false);
    });

    loadSubmissions();

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  useEffect(() => {
    if (!user?.characterId) return;

    let mounted = true;

    const loadSubmissionsRecord = async () => {
      setIsLoadingSubmissionsRecord(true);

      try {
        const result = await fetchHarvests();

        if (!mounted) return;

        if (result.error) {
          return;
        }

        const sorted = [...result.harvests].sort(
          (a, b) => +new Date(b.submittedAt) - +new Date(a.submittedAt)
        );

        setSubmissionsRecord(sorted);
      } catch (err) {
      } finally {
        if (mounted) setIsLoadingSubmissionsRecord(false);
      }
    };

    loadSubmissionsRecord();

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  useEffect(() => {
    if (!user?.characterId) return;

    let mounted = true;

    const loadTopHarvestors = async () => {
      setIsLoadingTopHarvestors(true);

      try {
        const result = await fetchTopHarvesters();

        if (!mounted) return;

        if (result.error) {
          return;
        }

        setTopHarvestors(result.topHarvesters);
      } catch (err) {
      } finally {
        if (mounted) setIsLoadingTopHarvestors(false);
      }
    };

    loadTopHarvestors();

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  const characterMap = useMemo(() => {
    const map: Record<string, Character> = {};
    allCampData.forEach((c) => {
      map[c.characterId.toLowerCase()] = c;
    });
    return map;
  }, [allCampData]);

  const isValidTwitterUrl = useMemo(() => {
    const twitterRegex = /^https?:\/\/(www\.)?twitter\.com\/[^\/]+\/status\/\d+/i;
    const xRegex = /^https?:\/\/(www\.)?x\.com\/[^\/]+\/status\/\d+/i;
    return twitterRegex.test(firstTweetUrl.trim()) || xRegex.test(firstTweetUrl.trim());
  }, [firstTweetUrl]);

  const handleSubmit = async () => {
    if (!firstTweetUrl.trim()) {
      setError('Please paste the thread URL');
      return;
    }

    if (!user?.characterId) {
      setError('You must be logged in');
      return;
    }

    if (!isValidTwitterUrl) {
      setError('Invalid Twitter/X URL');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSubmitSuccess(false);

    try {
      const submittedAt = new Date().toISOString();

      const result = await submitHarvest(
        user.characterId,
        firstTweetUrl.trim(),
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      setSubmissions((prev) => [
        {
          id: result.id || Date.now().toString(),
          characterId: user.characterId,
          firstTweetUrl,
          status: HARVEST_SUBMISSION_STATUS.PENDING,
          submittedAt,
        },
        ...prev,
      ]);

      setSubmissionsRecord((prev) => [
        {
          id: result.id || Date.now().toString(),
          characterId: user.characterId,
          firstTweetUrl,
          status: HARVEST_SUBMISSION_STATUS.PENDING,
          submittedAt,
        },
        ...prev,
      ]);

      setSubmitSuccess(true);
      setFirstTweetUrl('');

      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch {
      setError('Failed to submit');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="strawberry-fields">
      {/* Compact header */}
      <header className="strawberry-fields__bar">
        <Link to="/life" className="strawberry-fields__bar-back">
          <ChevronLeft />
          {t(T.CAMP)}
        </Link>

        <div className="strawberry-fields__bar-title">
          <span className="strawberry-fields__bar-icon">
            <Strawberry />
          </span>
          {t(T.STRAWBERRY_FIELDS)}
        </div>

        <button
          className="strawberry-fields__bar-help"
          onClick={() => setShowRulesModal(true)}
          data-tooltip={t(T.HARVEST_RULES)}
          data-tooltip-pos="left"
        >
          <QuestionMark />
        </button>

        {/* Mobile toggle */}
        <button className="strawberry-fields__bar-book" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <Book />
        </button>
      </header>

      {/* Body with split layout */}
      <div className="strawberry-fields__container">
        {/* Main area (left - bigger) */}
        <main className="strawberry-fields__main">
          <div className="strawberry-fields__form-wrapper">
            {/* Top horizontal rack decorations */}
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--top-left">
              <Strawberry />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--top-center-left">
              <span className="strawberry-fields__rack-decor-leaf" />
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--top-center">
              <span className="strawberry-fields__rack-decor-flower" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--top-center-right">
              <span className="strawberry-fields__rack-decor-leaf" />
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--top-right">
              <Strawberry />
            </span>

            {/* Bottom horizontal rack decorations */}
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--bottom-left">
              <span className="strawberry-fields__rack-decor-leaf" />
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--bottom-center-left">
              <Strawberry />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--bottom-center">
              <span className="strawberry-fields__rack-decor-leaf" />
              <span className="strawberry-fields__rack-decor-leaf" />
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--bottom-center-right">
              <Strawberry />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--bottom-right">
              <span className="strawberry-fields__rack-decor-leaf" />
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>

            {/* Left vertical rack decorations */}
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--left-top">
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--left-middle">
              <Strawberry />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--left-bottom">
              <span className="strawberry-fields__rack-decor-flower" />
            </span>

            {/* Right vertical rack decorations */}
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--right-top">
              <span className="strawberry-fields__rack-decor-leaf" />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--right-middle">
              <Strawberry />
            </span>
            <span className="strawberry-fields__rack-decor strawberry-fields__rack-decor--right-bottom">
              <span className="strawberry-fields__rack-decor-flower" />
            </span>

            <div className="strawberry-fields__form">
              <h2 style={lang === LANGUAGE.ENGLISH ? { letterSpacing: '0.03em' } : {}}>
                {t(T.REPORT_HARVEST)}
              </h2>
              <div className="strawberry-fields__form-content">
                <input
                  type="text"
                  ref={inputRef}
                  className="strawberry-fields__form-input"
                  placeholder="Paste thread URL (first tweet)"
                  style={!isValidTwitterUrl && firstTweetUrl.trim() !== '' ? { paddingRight: "40px" } : {}}
                  value={firstTweetUrl}
                  onChange={(e) => setFirstTweetUrl(e.target.value)}
                />
                {!isValidTwitterUrl && firstTweetUrl.trim() !== '' && (
                  <div
                    className="strawberry-fields__form-error-icon"
                    data-tooltip={t(T.INVALID_TWITTER_URL)}
                    data-tooltip-pos={width < 480 ? "left" : "top"}
                  >
                    <InfoCircle />
                  </div>
                )}
                <button
                  className={`strawberry-fields__form-button ${isSubmitting ? 'strawberry-fields__form-button--loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !firstTweetUrl.trim() || !isValidTwitterUrl}
                  data-tooltip={t(T.SUBMIT)}
                  data-tooltip-pos="top"
                >
                  <Drachma className="strawberry-fields__form-button-icon" />
                  <span>{isSubmitting ? t(T.SUBMITTING) : t(T.SUBMIT)}</span>
                </button>
              </div>
              <div className={`strawberry-fields__form-note ${hasDemeterBonus ? 'strawberry-fields__form-note--bonus' : ''}`}>
                {hasDemeterBonus ? t(T.HARVEST_SUBMISSION_NOTE_WITH_DEMETER_BONUS) : t(T.HARVEST_SUBMISSION_NOTE)}
              </div>
            </div>
          </div>

          <div className="strawberry-fields__results-section">
            <div className="strawberry-fields__results-header">
              <button
                key="all"
                className={`strawberry-fields__filter-btn ${filterStatus === null ? 'strawberry-fields__filter-btn--active' : ''
                  }`}
                onClick={() => setFilterStatus(null)}
              >
                all
              </button>
              {Object.values(HARVEST_SUBMISSION_STATUS).map((status) => {
                return (
                  <button
                    key={status}
                    className={`strawberry-fields__filter-btn ${filterStatus === status ? 'strawberry-fields__filter-btn--active' : ''
                      }`}
                    onClick={() => setFilterStatus(status)}
                  >
                    {status}
                  </button>
                );
              })}
            </div>
            <div className="strawberry-fields__results">
              {submitSuccess && <SubmissionSuccessCard />}

              {!!error && submissions.length === 0 ? (
                <div className="strawberry-fields__error">
                  {error}
                </div>
              ) : isLoadingSubmissions ? (
                <p className="strawberry-fields__empty">{t(T.LOADING)}</p>
              ) : submissions.length === 0 ? (
                <p className="strawberry-fields__empty">{t(T.PERSONAL_NO_HARVESTS)}</p>
              ) : (
                <div className="strawberry-fields__submissions-list">
                  {submissions
                    .filter((submission) => (!filterStatus || submission.status === filterStatus) && submission.characterId === user?.characterId)
                    .map((submission) => <SubmissionCard key={submission.id} submission={submission} />)}
                </div>
              )}
            </div>
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`strawberry-fields__sidebar ${sidebarOpen ? 'strawberry-fields__sidebar--open' : ''}`}>
          <div className="strawberry-fields__sidebar__head">
            <div className="strawberry-fields__sidebar__head-tabs">
              <button
                className={`strawberry-fields__sidebar__tab ${sidebarView === SIDEBAR_VIEW.RECORD ? 'strawberry-fields__sidebar__tab--active' : ''}`}
                onClick={() => setSidebarView(SIDEBAR_VIEW.RECORD)}
              >
                <Book />
                <span>{t(T.HARVEST_RECORD_BOOK)}</span>
              </button>
              <button
                className={`strawberry-fields__sidebar__tab ${sidebarView === SIDEBAR_VIEW.TOP ? 'strawberry-fields__sidebar__tab--active' : ''}`}
                onClick={() => setSidebarView(SIDEBAR_VIEW.TOP)}
              >
                <Trophy />
                <span>{t(T.TOP_HARVESTOR)}</span>
              </button>
            </div>
            <button className="strawberry-fields__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>

          <div className="strawberry-fields__sidebar__content">
            {sidebarView === SIDEBAR_VIEW.RECORD ? (
              <div className="strawberry-fields__sidebar__records">
                {isLoadingSubmissionsRecord ? (
                  <p className="strawberry-fields__sidebar__empty">{t(T.LOADING)}</p>
                ) : !error &&
                  submissionsRecord.length === 0 ? (
                  <p className="strawberry-fields__sidebar__empty">{t(T.NO_HARVESTS_YET)}</p>
                ) : (
                  submissionsRecord.map((submission) => (
                    <HarvestRecordCard key={submission.id} submission={submission} characterMap={characterMap} />
                  ))
                )}
              </div>
            ) : (
              <div className="strawberry-fields__sidebar__top-harvestors">
                {isLoadingTopHarvestors ? (
                  <p className="strawberry-fields__sidebar__empty">{t(T.LOADING)}</p>
                ) : !error &&
                  topHarvestors.length === 0 ? (
                  <p className="strawberry-fields__sidebar__empty">{t(T.NO_HARVESTS_YET)}</p>
                ) : (
                  topHarvestors.map((harvester, index) => (
                    <div
                      key={harvester.characterId}
                      className="strawberry-fields__top-harvestor"
                      style={{
                        '--primary-color': characterMap[harvester.characterId.toLowerCase()] ? hexToRgb(characterMap[harvester.characterId.toLowerCase()].theme[0]) : 'rgb(255, 255, 255)',
                      } as React.CSSProperties}
                    >
                      {index === 0 && (
                        <span className="strawberry-fields__top-harvestor-crown">
                          <Crown />
                        </span>
                      )}
                      <HarvestorChip character={characterMap[harvester.characterId.toLowerCase()]} />
                      <span className="strawberry-fields__top-harvestor-rank">#{index + 1}</span>
                      <span className="strawberry-fields__top-harvestor-name">{harvester.nicknameEng}</span>
                      <span className="strawberry-fields__top-harvestor-count">
                        {harvester.totalDrachma}
                        <Drachma />
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </aside>
      </div>

      {showRulesModal && <HarvestRulesModal onClose={() => setShowRulesModal(false)} />}
    </div>
  );
}

export default StrawberryFields;
