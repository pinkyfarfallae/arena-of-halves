import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import Book from '../../icons/Book';
import Trophy from '../../icons/Trophy';
import QuestionMark from '../../icons/QuestionMark';
import Drachma from '../../icons/Drachma';
import Strawberry from '../LifeInCamp/components/LocationIcon/icons/Strawberry';
import HarvestRulesModal from './components/HarvestRulesModal';
import './StrawberryFields.scss';

function StrawberryFields() {
  const { t } = useTranslation();
  const [harvests, setHarvests] = useState<any[]>([]);
  const [sidebarView, setSidebarView] = useState<'records' | 'top'>('records');
  const [showRulesModal, setShowRulesModal] = useState(false);
  const [isAppraising, setIsAppraising] = useState(false);
  const [harvestLink, setHarvestLink] = useState('');

  const handleAppraise = () => {
    if (!harvestLink.trim()) return;
    setIsAppraising(true);
    // Simulate API call
    setTimeout(() => {
      setIsAppraising(false);
    }, 2000);
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
                  placeholder="Paste your harvest link here"
                  value={harvestLink}
                  onChange={(e) => setHarvestLink(e.target.value)}
                />
                <button 
                  className={`strawberry-fields__form-button ${isAppraising ? 'strawberry-fields__form-button--loading' : ''}`}
                  onClick={handleAppraise}
                  disabled={isAppraising || !harvestLink.trim()}
                  data-tooltip="Calculate harvest rewards"
                  data-tooltip-pos="top"
                >
                  <Drachma className="strawberry-fields__form-button-icon" />
                  <span>{isAppraising ? 'Appraising...' : 'Appraise'}</span>
                </button>
              </div>
              <div className="strawberry-fields__form-note">
                การประเมินค่าตอบแทนนั้นนับตามจำนวนตัวอักษรโดยไม่นับการเว้นวรรคของเนื้อหาโรลเพลย์โดยอัตราค่าตอบแทนจะอยู่ที่ 10 ดรัคมา ต่อ 200 ตัวอักษร
              </div>
            </div>
          </div>

          <div className="strawberry-fields__results">
            {harvests.length === 0 ? (
              <p className="strawberry-fields__empty">{t(T.NO_HARVESTS_YET)}</p>
            ) : (
              <ul>
                {harvests.map((harvest, index) => (
                  <li key={index}>{harvest.name}</li>
                ))}
              </ul>
            )}
          </div>
        </main>

        {/* Sidebar (right) */}
        <aside className="strawberry-fields__sidebar">
          <div className="strawberry-fields__sidebar__head">
            <div className="strawberry-fields__sidebar__head-tabs">
              <button
                className={`strawberry-fields__sidebar__tab ${sidebarView === 'records' ? 'strawberry-fields__sidebar__tab--active' : ''}`}
                onClick={() => setSidebarView('records')}
              >
                <Book />
                <span>{t(T.HARVEST_RECORD_BOOK)}</span>
              </button>
              <button
                className={`strawberry-fields__sidebar__tab ${sidebarView === 'top' ? 'strawberry-fields__sidebar__tab--active' : ''}`}
                onClick={() => setSidebarView('top')}
              >
                <Trophy />
                <span>{t(T.TOP_HARVESTOR)}</span>
              </button>
            </div>
          </div>

          <div className="strawberry-fields__sidebar__content">
            {sidebarView === 'records' ? (
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
