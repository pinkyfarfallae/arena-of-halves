import { useEffect, useRef, useState } from 'react';
import { CAMP_LOCATIONS } from '../../data/campLocations';
import LocationPin from './components/LocationPin/LocationPin';
import MapDecorations from './components/MapDecorations/MapDecorations';
import SearchIcon from '../../icons/Search';
import CloseIcon from '../../icons/Close';
import './LifeInCamp.scss';

/* ── Main Page ── */
function LifeInCamp() {
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const q = search.toLowerCase();

  useEffect(() => {
    if (!q || !scrollRef.current) return;
    const match = CAMP_LOCATIONS.find(loc => loc.name.toLowerCase().startsWith(q));
    if (!match) return;
    const container = scrollRef.current;
    const map = container.querySelector('.life__map') as HTMLElement;
    if (!map) return;
    const targetX = (match.x / 100) * map.scrollWidth - container.clientWidth / 2;
    const targetY = (match.y / 100) * map.scrollHeight - container.clientHeight / 2;
    container.scrollTo({ left: Math.max(0, targetX), top: Math.max(0, targetY), behavior: 'smooth' });
  }, [q]);

  return (
    <div className="life" ref={scrollRef}>
      <div className="life__map">
        <div
          className={`life__search-box ${search ? 'life__search-box--active' : ''}`}
          onClick={() => searchRef.current?.focus()}
        >
          <SearchIcon className="life__search-icon" />
          <input
            ref={searchRef}
            className="life__search"
            type="text"
            placeholder="Search locations"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button className="life__search-clear" onClick={() => setSearch('')}>
              <CloseIcon />
            </button>
          )}
        </div>
        <MapDecorations />
        {CAMP_LOCATIONS.map(loc => {
          const match = !q || loc.name.toLowerCase().startsWith(q);
          return (
            <LocationPin key={loc.id} location={loc} dimmed={!match} />
          );
        })}
      </div>
    </div>
  );
}

export default LifeInCamp;
