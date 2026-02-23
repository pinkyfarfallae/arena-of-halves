import { Link } from 'react-router-dom';
import './Arena.scss';

function Arena() {
  return (
    <div className="arena">
      <h1 className="arena__title">The Arena</h1>
      <p className="arena__desc">The battle unfolds here.</p>

      <div className="arena__field">
        <div className="arena__half arena__half--left">
          <span>Left Half</span>
        </div>
        <div className="arena__divider" />
        <div className="arena__half arena__half--right">
          <span>Right Half</span>
        </div>
      </div>

      <div className="arena__actions">
        <Link to="/lobby" className="btn btn--secondary">Back to Lobby</Link>
        <Link to="/" className="btn btn--secondary">Home</Link>
      </div>
    </div>
  );
}

export default Arena;
