import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import Drachma from '../../icons/Drachma';
import BigHouseIcon from '../LifeInCamp/components/LocationIcon/icons/BigHouse';
import { LANGUAGE } from '../../constants/language';
import { Character } from '../../data/characters';
import InfoCircle from '../Shop/icons/InfoCircle';
import { useScreenSize } from '../../hooks/useScreenSize';
import Background from './images/background.jpg'
import Close from '../../icons/Close';
import { fetchBigHouseRoleplays, submitBigHouseRoleplay } from '../../services/bigHouse/fetchBigHouseRoleplay';
import { BigHouseSubmission } from '../../types/bigHouse';
import { isValidTwitterUrl } from '../../utils/twitterUrlValidation';
import SubmissionCard from './components/SubmissionCard/SubmissionCard';
import './BigHouse.scss';

function BigHouse() {
  const { user } = useAuth();
  const { width } = useScreenSize();
  const { t, lang } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  const [submissions, setSubmissions] = useState<BigHouseSubmission[]>([]);
  const [isLoadingSubmissions, setIsLoadingSubmissions] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [firstTweetUrl, setFirstTweetUrl] = useState('');
  const [allCampData, setAllCampData] = useState<Character[]>([]);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [error, setError] = useState('');
  const [hasDemeterBonus, setHasDemeterBonus] = useState(false);

  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    if (!user) return;

    const loadSubmissions = async () => {
      setIsLoadingSubmissions(true);
      try {
        const data = await fetchBigHouseRoleplays(user.characterId);
        if (mounted) {
          setSubmissions(data.submissions);
        }
      } catch (error) {
        console.error('Failed to load submissions', error);
      } finally {
        if (mounted) {
          setIsLoadingSubmissions(false);
        }
      }
    };

    loadSubmissions();

    return () => {
      mounted = false;
    };
  }, [user?.characterId]);

  const _isValidTwitterUrl = useMemo(() => isValidTwitterUrl(firstTweetUrl), [firstTweetUrl]);

  const handleSubmit = async () => {
    if (!firstTweetUrl.trim()) {
      setError('Please paste the thread URL');
      return;
    }

    if (!user?.characterId) {
      setError('You must be logged in');
      return;
    }

    if (!_isValidTwitterUrl) {
      setError('Invalid Twitter/X URL');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setSubmitSuccess(false);

    try {
      const result = await submitBigHouseRoleplay(
        user.characterId,
        firstTweetUrl.trim(),
      );

      if (!result.success) {
        throw new Error(result.error);
      }

      const submittedAt = new Date().toISOString();
      setSubmissions((prev) => [
        {
          id: result.id || submittedAt,
          characterId: user.characterId,
          roleplayUrl: firstTweetUrl.trim(),
          status: 'pending',
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
                  style={!_isValidTwitterUrl && firstTweetUrl.trim() !== '' ? { paddingRight: "40px" } : {}}
                  value={firstTweetUrl}
                  onChange={(e) => setFirstTweetUrl(e.target.value)}
                />
                {!_isValidTwitterUrl && firstTweetUrl.trim() !== '' && (
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
                  disabled={isSubmitting || !firstTweetUrl.trim() || !_isValidTwitterUrl}
                  data-tooltip={t(T.SUBMIT)}
                  data-tooltip-pos="top"
                >
                  <Drachma className="big-house__form-button-icon" />
                  <span>{isSubmitting ? t(T.SUBMITTING) : t(T.SUBMIT)}</span>
                </button>
              </div>
              <div className="big-house__form-footer">
                <div className="big-house__form-footer-content">
                  <h3>{t(T.BIG_HOUSE_FOOTER_TITLE)}</h3>
                  <div className="big-house__form-footer-list">
                    <span>
                      <b>ณ ที่แห่งนี้</b> เปิดโอกาสให้เหล่าสมาชิกสามารถนำผลงานการเขียนของตนมาขึ้นทะเบียนเพื่อแลกเปลี่ยนเป็นรายได้
                      ยิ่งสร้างสรรค์และมีจำนวนมากเท่าใด ผลตอบแทนก็ยิ่งเพิ่มพูนตามไปด้วย
                    </span>

                    <ul className="big-house__form-footer-bullets">
                      <li className="big-house__form-footer-bullets-item">
                        โรลเพลย์ที่จะนำมาขึ้นจำนำจะเป็นการโรลเพลย์ประเภทไหนก็ได้ ทั้งโรลเพลย์อิสระ โรลเพลย์ในเนื้อเรื่องอีเวนท์หลัก
                        โรลเพลย์การฝึกฝนประจำวัน เควสบอร์ด หรืออื่น ๆ ก็สามารถนำมาประเมินราคาได้ทั้งหมด
                      </li>
                      <li className="big-house__form-footer-bullets-item big-house__form-footer-bullets-item--strawberry">
                        โรลเพลย์ในระบบ <b>ไร่สตรอเบอร์รี่</b> จะ<b>ไม่</b>สามารถนำมาประเมินราคาที่บ้านใหญ่ได้
                      </li>
                      <li className="big-house__form-footer-bullets-item">
                        หากเป็นโรลเพลย์ที่มีผู้เขียนมากกว่า 1 คนการประเมินราคาจะนับจำนวนอักษรและคำนวณราคาแยกกันตามแต่ละบุคคลเสมอ
                      </li>
                      <li className="big-house__form-footer-bullets-item">
                        หากเป็นโรลเพลย์ที่มีผู้เขียนมากกว่า 1 คน สามารถให้ตัวแทนหนึ่งคนส่งเพื่อประเมินราคาได้ ผู้ร่วมเขียนทุกคนจะได้รับรายได้ตามสัดส่วนที่ตกลงกันไว้
                      </li>
                    </ul>
                  </div>

                  <div className="big-house__form-footer-divider" />

                  <h3>{t(T.BIG_HOUSE_FOOTER_RATE)}</h3>
                  <div className="big-house__form-footer-rate">
                    <ul className="big-house__form-footer-list">
                      <li className="big-house__form-footer-rate-list-item">
                        <b>อัตราพื้นฐาน</b> <span>200 อักษรต่อ <b>7</b> <Drachma /></span>
                      </li>
                      <li className="big-house__form-footer-rate-list-item big-house__form-footer-rate-list-item--highlight">
                        <b>อัตราพิเศษ</b> <span>ถ้ามีความยาวตั้งแต่ 1,000 อักษรขึ้นไปแต่ไม่เกิน 2,400 อักษร — ได้รับเพิ่มเติมจากอัตราปกติ <b>35</b> <Drachma /></span>
                      </li>
                      <li className="big-house__form-footer-rate-list-item big-house__form-footer-rate-list-item--bonus">
                        <b>โบนัส</b> <span>ถ้ามีความยาวตั้งแต่ 2,400 อักษรขึ้นไป — ได้รับเพิ่มเติมจากอัตราปกติเป็น <b>2</b> เท่า</span>
                      </li>
                    </ul>
                  </div>
                </div>
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
            {isLoadingSubmissions ? (
              <div className="big-house__sidebar-loading">{t(T.LOADING)}...</div>
            ) : submissions.length === 0 ? (
              <div className="big-house__sidebar-empty">{t(T.BIG_HOUSE_NO_SUBMISSIONS)}</div>
            ) : (
              submissions.map((submission) => (
                <SubmissionCard
                  key={submission.id}
                  submission={submission}
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

export default BigHouse;
