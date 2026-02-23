import { Link } from 'react-router-dom';
import './Lobby.scss';

function Lobby() {
  return (
    <div className="lobby">
      <h1 className="lobby__title">Lobby</h1>
      <p className="lobby__desc">Prepare for battle. Choose your side and ready up.</p>

      <div className="lobby__grid">
        <div className="lobby__card lobby__card--left">
          <h2>Left Half</h2>
          <p>Strategy &amp; precision</p>
        </div>
        <div className="lobby__card lobby__card--right">
          <h2>Right Half</h2>
          <p>Speed &amp; power</p>
        </div>
      </div>

      <div className="lobby__actions">
        <Link to="/arena" className="btn btn--primary">Start Match</Link>
        <Link to="/" className="btn btn--secondary">Back Home</Link>
      </div>
    </div>
  );
}

export default Lobby;
