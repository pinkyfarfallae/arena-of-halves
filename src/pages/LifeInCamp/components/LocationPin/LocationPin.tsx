import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampLocation } from '../../../../data/campLocations';
import { getCampLocationName, getCampLocationDescription } from '../../../../constants/campLocationTranslations';
import { useLanguage } from '../../../../contexts/LanguageContext';
import LocationIcon from '../LocationIcon/LocationIcon';
import ActionIcon from '../ActionIcon/ActionIcon';
import './LocationPin.scss';
import { useAuth } from '../../../../hooks/useAuth';
import { ROLE } from '../../../../constants/role';

function LocationPin({ location, dimmed, adminOnly = false }: { location: CampLocation; dimmed?: boolean; adminOnly?: boolean }) {
  const [open, setOpen] = useState(false);
  const { role } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();
  const pinRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (pinRef.current && !pinRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  let edge = '';
  if (location.panelPlacement) {
    switch (location.panelPlacement) {
      case 'left':
        edge = 'life__pin--left';
        break;
      case 'right':
        edge = 'life__pin--right';
        break;
      case 'above':
        edge = 'life__pin--above';
        break;
      case 'below':
        edge = 'life__pin--below';
        break;
    }
  } else {
    edge = [
      location.y < 15 ? 'life__pin--below' : '',
      location.x > 65 ? 'life__pin--left' : '',
      location.x < 15 ? 'life__pin--right' : '',
      location.y > 70 ? 'life__pin--above' : '',
    ].filter(Boolean).join(' ');
  }

  return (
    <div
      ref={pinRef}
      className={`life__pin life__pin--${location.size || 'md'} ${edge} ${dimmed ? 'life__pin--dimmed' : ''}`}
      style={{ left: `${location.x}%`, top: `${location.y}%`, '--pin-color': location.color } as React.CSSProperties}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="life__marker" onClick={() => setOpen(o => !o)}>
        <LocationIcon type={location.icon} />
      </button>
      <span className="life__pin-label">{getCampLocationName(location.id, language)}</span>
      <div className={`life__card ${open ? 'life__card--open' : ''}`}>
        {/* Card header */}
        <div className="life__card-header">
          <span className="life__card-icon">
            <LocationIcon type={location.icon} />
          </span>
          <span className="life__card-name">{getCampLocationName(location.id, language)}</span>
        </div>

        {/* Card body */}
        <div className="life__card-body">
          <p className="life__card-desc">{getCampLocationDescription(location.id, language)}</p>
          {location.tags && (
            <div className="life__card-tags">
              {location.tags.map(tag => (
                <span key={tag} className="life__tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {(!adminOnly || (adminOnly && (role === ROLE.ADMIN || role === ROLE.DEVELOPER))) && location.actionLabels?.map((label, i) => (
            <button
              key={label}
              className="life__card-action"
              onClick={() => location.actionPaths?.[i] && navigate(location.actionPaths[i])}
            >
              <ActionIcon type={location.actionIcons?.[i] || 'default'} />
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default LocationPin;
