import { Link } from 'react-router-dom';
import './Shop.scss';

function Shop() {
  return (
    <div className="shop">
      <Link to="/life" className="shop__back">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Back to Camp
      </Link>
      <div className="shop__container">
        <div className="shop__icon">
          <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 18h36v24H6z" opacity="0.1" fill="currentColor" />
            <path d="M6 18h36v24H6z" />
            <path d="M2 8h44l-4 10H6L2 8z" fill="currentColor" opacity="0.15" />
            <path d="M2 8h44l-4 10H6L2 8z" />
            <path d="M18 30h12v12H18z" opacity="0.08" fill="currentColor" />
            <path d="M18 30h12v12H18z" />
            <path d="M14 18v-2a10 10 0 0120 0v2" opacity="0.4" />
          </svg>
        </div>
        <h1 className="shop__title">Camp Store</h1>
        <p className="shop__subtitle">Camp Half-Blood tees, nectar gummies, drachma pouches, and quest essentials. Run by the Hermes cabin.</p>
        <p className="shop__coming-soon">Coming soon</p>
      </div>
    </div>
  );
}

export default Shop;
