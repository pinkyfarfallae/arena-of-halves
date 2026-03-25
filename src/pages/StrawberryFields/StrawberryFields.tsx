import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import Book from '../../icons/Book';
import Trophy from '../../icons/Trophy';
import QuestionMark from '../../icons/QuestionMark';
import Drachma from '../../icons/Drachma';
import { HarvestSubmission, SidebarView, submitHarvest } from '../../types/harvest';
import Strawberry from '../LifeInCamp/components/LocationIcon/icons/Strawberry';
import HarvestRulesModal from './components/HarvestRulesModal/HarvestRulesModal';
import './StrawberryFields.scss';
import { HARVEST_SUBMISSION_STATUS, SIDEBAR_VIEW } from '../../constants/harvest';

function StrawberryFields() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [submissions, setSubmissions] = useState<HarvestSubmission[]>([]);
  const [sidebarView, setSidebarView] = useState<SidebarView>(SIDEBAR_VIEW.RECORD);
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState<string>('');

  const handleSubmit = async () => {
    if (!firstTweetUrl.trim()) {
      setError('Please paste the thread URL');
      return;
    }

    if (!user?.characterId) {
      setError('You must be logged in to submit a harvest');
      return;
    }

    // Validate URL format
    const urlPattern = /(?:twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/i;
    if (!urlPattern.test(firstTweetUrl)) {
      setError('Invalid Twitter/X URL format');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSubmitSuccess(false);

    try {
      const submittedAt = new Date().toISOString();
      const submission: HarvestSubmission = {
        id: Date.now().toString(),
        characterId: user.characterId,
        firstTweetUrl,
        status: HARVEST_SUBMISSION_STATUS.PENDING,
        submittedAt,
      };

      const result = await submitHarvest(
        user.characterId,
        firstTweetUrl.trim()
      );

      if (!result.success) {
        throw new Error(result.error || 'Failed to submit harvest');
      }

      // Add to local state
      setSubmissions(prev => [
        {
          ...submission,
          id: result.id || submission.id,
        },
        ...prev,
      ]);

      setSubmitSuccess(true);
      setFirstTweetUrl('');

      // Hide success message after 3 seconds
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err: any) {
      setError('Failed to submit. Please try again.');
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
              <h2>{t(T.REPORT_HARVEST)}</h2>
              <div className="strawberry-fields__form-content">
                <input
                  type="text"
                  className="strawberry-fields__form-input"
                  placeholder="Paste thread URL (first tweet)"
                  value={firstTweetUrl}
                  onChange={(e) => setFirstTweetUrl(e.target.value)}
                />
                <button
                  className={`strawberry-fields__form-button ${isSubmitting ? 'strawberry-fields__form-button--loading' : ''}`}
                  onClick={handleSubmit}
                  disabled={isSubmitting || !firstTweetUrl.trim()}
                  data-tooltip="Submit for admin review"
                  data-tooltip-pos="top"
                >
                  <Drachma className="strawberry-fields__form-button-icon" />
                  <span>{isSubmitting ? 'Submitting...' : 'Submit'}</span>
                </button>
              </div>
              <div className="strawberry-fields__form-note">
                เมื่อส่งเอกสารประเมินราคาแล้ว กรุณารอการตรวจสอบจากแพนก่อนที่จะได้รับผลตอบแทนดังกล่าว
              </div>
            </div>
          </div>

          <div className="strawberry-fields__results">
            {error && (
              <div className="strawberry-fields__error">
                <p>{error}</p>
              </div>
            )}

            {submitSuccess && (
              <div className="strawberry-fields__success">
                <h3>Submission Received!</h3>
                <p>Your harvest has been submitted for admin review.<br />
                  You'll receive drachma once it's approved.</p>
              </div>
            )}


            {submissions.length === 0 ? (
              <p className="strawberry-fields__empty">No submissions yet. Submit your first harvest above!</p>
            ) : (
              <div className="strawberry-fields__submissions-list">
                {submissions.map((submission) => (
                  <div key={submission.id} className={`strawberry-fields__submission-card strawberry-fields__submission-card--${submission.status}`}>
                    <div className="strawberry-fields__submission-header">
                      <span className="strawberry-fields__submission-date">
                        {new Date(submission.submittedAt).toLocaleDateString('th-TH', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <div className="strawberry-fields__submission-link">
                      <div>{submission.firstTweetUrl.length > 50 ? submission.firstTweetUrl.substring(0, 50) + '...' : submission.firstTweetUrl}</div>
                    </div>
                    {submission.status === 'approved' && (
                      <div className="strawberry-fields__submission-reward">
                        <Drachma /> {submission.drachmaReward} drachma ({submission.charCount} chars)
                      </div>
                    )}
                    {submission.status === 'rejected' && submission.rejectReason && (
                      <div className="strawberry-fields__submission-reject">
                        Reason: {submission.rejectReason}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className="strawberry-fields__sidebar">
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
          </div>

          <div className="strawberry-fields__sidebar__content">
            {sidebarView === SIDEBAR_VIEW.RECORD ? (
              <div className="strawberry-fields__sidebar__records">
                <p className="strawberry-fields__sidebar__empty">{t(T.NO_HARVESTS_YET)}</p>
              </div>
            ) : (
              <div className="strawberry-fields__sidebar__top">
                <p className="strawberry-fields__sidebar__empty">No data yet</p>
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
