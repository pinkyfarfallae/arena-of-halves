import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from '../../hooks/useTranslation';
import ChevronLeft from '../../icons/ChevronLeft';
import './StrawberryFields.scss';

function StrawberryFields() {
  const { t } = useTranslation();
  const [harvests, setHarvests] = useState<any[]>([]);

  return (
    <div className="strawberry-fields">
      <div className="strawberry-fields__header">
        <Link to="/life" className="strawberry-fields__back">
          <ChevronLeft width={20} height={20} />
          <span>{t('BACK_TO_CAMP')}</span>
        </Link>
        <h1 className="strawberry-fields__title">{t('STRAWBERRY_FIELDS')}</h1>
      </div>

      <div className="strawberry-fields__content">
        <div className="strawberry-fields__intro">
          <p>{t('STRAWBERRY_FIELDS_DESCRIPTION')}</p>
        </div>

        <div className="strawberry-fields__form">
          <h2>{t('REPORT_HARVEST')}</h2>
          {/* Form content will go here */}
        </div>

        <div className="strawberry-fields__list">
          <h2>{t('RECENT_HARVESTS')}</h2>
          {harvests.length === 0 ? (
            <p className="strawberry-fields__empty">{t('NO_HARVESTS_YET')}</p>
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
