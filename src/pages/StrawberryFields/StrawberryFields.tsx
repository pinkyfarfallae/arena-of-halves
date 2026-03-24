import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import Book from '../../icons/Book';
import Trophy from '../../icons/Trophy';
import QuestionMark from '../../icons/QuestionMark';
import Strawberry from '../LifeInCamp/components/LocationIcon/icons/Strawberry';
import HarvestRulesModal from './components/HarvestRulesModal';
import './StrawberryFields.scss';

function StrawberryFields() {
  const { t } = useTranslation();
  const [harvests, setHarvests] = useState<any[]>([]);
  const [sidebarView, setSidebarView] = useState<'records' | 'top'>('records');
  const [showRulesModal, setShowRulesModal] = useState(false);

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
          <div className="strawberry-fields__intro">
            <p>{t(T.STRAWBERRY_FIELDS_DESCRIPTION)}</p>
          </div>

          <div className="strawberry-fields__form">
            <h2>{t(T.REPORT_HARVEST)}</h2>
            {/* Form content will go here */}
          </div>

          <div className="strawberry-fields__results">
            <h2>{t(T.RECENT_HARVESTS)}</h2>
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
