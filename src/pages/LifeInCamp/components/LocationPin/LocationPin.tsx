import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampLocation } from '../../../../data/campLocations';
import LocationIcon from '../LocationIcon/LocationIcon';
import ActionIcon from '../ActionIcon/ActionIcon';
import './LocationPin.scss';

function LocationPin({ location, dimmed }: { location: CampLocation; dimmed?: boolean }) {
  const [open, setOpen] = useState(false);
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

  const edge = [
    location.y < 15 ? 'life__pin--below' : '',
    location.x > 75 ? 'life__pin--left' : '',
    location.x < 15 ? 'life__pin--right' : '',
    location.y > 70 ? 'life__pin--above' : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={pinRef}
      className={`life__pin life__pin--${location.size || 'md'} ${edge} ${dimmed ? 'life__pin--dimmed' : ''}`}
      style={{ left: `${location.x}%`, top: `${location.y}%`, '--pin-color': location.color } as React.CSSProperties}
      onMouseLeave={() => setOpen(false)}
    >
      <button className="life__marker" onClick={() => {
        if (location.actionPaths?.[0]) {
          navigate(location.actionPaths[0]);
        } else {
          setOpen(o => !o);
        }
      }}>
        <LocationIcon type={location.icon} />
      </button>
      <span className="life__pin-label">{location.name}</span>
      <div className={`life__card ${open ? 'life__card--open' : ''}`}>
        {/* Card header */}
        <div className="life__card-header">
          <span className="life__card-icon">
            <LocationIcon type={location.icon} />
          </span>
          <span className="life__card-name">{location.name}</span>
        </div>

        {/* Card body */}
        <div className="life__card-body">
          <p className="life__card-desc">{location.description}</p>
          {location.tags && (
            <div className="life__card-tags">
              {location.tags.map(tag => (
                <span key={tag} className="life__tag">{tag}</span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          {location.actionLabels?.map((label, i) => (
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
