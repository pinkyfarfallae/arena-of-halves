import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import QuestionMark from '../../icons/QuestionMark';
import Drachma from '../../icons/Drachma';
import { submitHarvest, fetchHarvests } from '../../services/harvest/fetchHarvest';
import { HarvestSubmission, HarvestSubmissionStatus } from '../../types/harvest';
import BigHouseIcon from '../LifeInCamp/components/LocationIcon/icons/BigHouse';
import Strawberry from '../LifeInCamp/components/LocationIcon/icons/Strawberry';
import HarvestRulesModal from '../StrawberryFields/components/HarvestRulesModal/HarvestRulesModal';
import { HARVEST_SUBMISSION_STATUS } from '../../constants/harvest';
import SubmissionSuccessCard from '../StrawberryFields/components/SubmissionSuccessCard/SubmissionSuccessCard';
import SubmissionCard from '../StrawberryFields/components/SubmissionCard/SubmissionCard';
import { LANGUAGE } from '../../constants/language';
import { Character, fetchAllCharacters } from '../../data/characters';
import InfoCircle from '../Shop/icons/InfoCircle';
import { useScreenSize } from '../../hooks/useScreenSize';
import { fetchActiveTodayIrisWish } from '../../data/wishes';
import { DEITY } from '../../constants/deities';
import Background from './images/background.jpg'
import './BigHouse.scss';
import Close from '../../icons/Close';

function BigHouse() {
  const { user } = useAuth();
  const { width } = useScreenSize();
  const { t, lang } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [allCampData, setAllCampData] = useState<Character[]>([]);
  const [filterStatus, setFilterStatus] = useState<HarvestSubmissionStatus | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasDemeterBonus, setHasDemeterBonus] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

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
  }, [user?.characterId]);

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

    fetchActiveTodayIrisWish(user?.characterId || '').then(wish => {
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
    <div className="big-house" style={{ backgroundImage: `url(${Background})` }}>
      {/* Compact header */}
      <header className="big-house__bar">
        <Link to="/life" className="big-house__bar-back">
          <ChevronLeft />
          {t(T.CAMP)}
        </Link>

        <div className="big-house__bar-title">
          <span className="big-house__bar-icon">
            <BigHouseIcon />
          </span>
          {t(T.BIG_HOUSE)}
        </div>

        {/* Mobile toggle */}
        <button className="big-house__bar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
          <ChevronLeft />
        </button>
      </header>

      {/* Body with split layout */}
      <div className="big-house__container">
        {/* Main area (left - bigger) */}
        <main className="big-house__main">
          <div className="big-house__form-wrapper">
            <div className="big-house__form">
              <h2 style={lang === LANGUAGE.ENGLISH ? { letterSpacing: '0.03em' } : {}}>
                {t(T.BIG_HOUSE_TITLE)}
              </h2>
              <div className="big-house__form-content">
                <input
                  type="text"
                  ref={inputRef}
                  className="big-house__form-input"
                  placeholder="Paste thread URL (first tweet)"
                  style={!isValidTwitterUrl && firstTweetUrl.trim() !== '' ? { paddingRight: "40px" } : {}}
                  value={firstTweetUrl}
                  onChange={(e) => setFirstTweetUrl(e.target.value)}
                />
                {!isValidTwitterUrl && firstTweetUrl.trim() !== '' && (
                  <div
                    className="big-house__form-error-icon"
                    data-tooltip={t(T.INVALID_TWITTER_URL)}
                    data-tooltip-pos={width < 480 ? "left" : "top"}
                  >
                    <InfoCircle />
                  </div>
                )}
                <button
                  className={`big-house__form-button ${isSubmitting ? 'big-house__form-button--loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !firstTweetUrl.trim() || !isValidTwitterUrl}
                  data-tooltip={t(T.SUBMIT)}
                  data-tooltip-pos="top"
                >
                  <Drachma className="big-house__form-button-icon" />
                  <span>{isSubmitting ? t(T.SUBMITTING) : t(T.SUBMIT)}</span>
                </button>
              </div>
              <div className="big-house__form-footer">
                <h3>{t(T.BIG_HOUSE_FOOTER_TITLE)}</h3>
              </div>
            </div>
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className={`big-house__sidebar ${sidebarOpen ? 'big-house__sidebar--open' : ''}`}>
          <div className="big-house__sidebar__head">
            <div className="big-house__sidebar__head-title">
              {t(T.BIG_HOUSE_SIDEBAR_TITLE)}
            </div>
            <button className="big-house__sidebar__close" onClick={() => setSidebarOpen(false)}>
              <Close />
            </button>
          </div>
          <div className="big-house__sidebar__content">

          </div>
        </aside>
      </div>
    </div>
  );
}

export default BigHouse;
