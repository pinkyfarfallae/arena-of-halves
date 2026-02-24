import { Link } from 'react-router-dom';
import './Forge.scss';

function Forge() {
  return (
    <div className="forge">
      <Link to="/life" className="forge__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Camp
      </Link>
      <div className="forge__container">
        <div className="forge__icon">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 38h28v4H10z" opacity="0.15" fill="currentColor" />
            <path d="M10 38h28v4H10z" />
            <path d="M20 24h8v14h-8z" opacity="0.1" fill="currentColor" />
            <path d="M20 24h8v14h-8z" />
            <path d="M14 24h20" />
            <path d="M6 12l6 12M42 12l-6 12" opacity="0.4" />
            <path d="M16 6a8 8 0 0116 0" opacity="0.3" />
            <circle cx="24" cy="16" r="4" fill="currentColor" opacity="0.2" />
            <path d="M24 12v-6M20 8h8" strokeWidth="2" />
          </svg>
        </div>
        <h1 className="forge__title">The Forge</h1>
        <p className="forge__subtitle">Craft celestial bronze weapons and magical items in Hephaestus cabin's eternal flames. Bring your blueprints and materials.</p>
        <p className="forge__coming-soon">Coming soon</p>
      </div>
    </div>
  );
}

export default Forge;
