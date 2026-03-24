import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import { T } from '../../constants/translationKeys';
import ChevronLeft from '../../icons/ChevronLeft';
import Strawberry from '../LifeInCamp/components/LocationIcon/icons/Strawberry';
import './StrawberryFields.scss';

function StrawberryFields() {
  const { t } = useTranslation();
  const [harvests, setHarvests] = useState<any[]>([]);

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
      </header>

      {/* Main content */}
      <div className="strawberry-fields__body">
        <div className="strawberry-fields__intro">
          <p>{t(T.STRAWBERRY_FIELDS_DESCRIPTION)}</p>
        </div>

        <div className="strawberry-fields__form">
          <h2>{t(T.REPORT_HARVEST)}</h2>
          {/* Form content will go here */}
        </div>

        <div className="strawberry-fields__list">
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
      </div>
    </div>
  );
}

export default StrawberryFields;
