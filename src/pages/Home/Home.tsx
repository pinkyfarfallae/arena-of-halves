import { Link } from 'react-router-dom';
import './Home.scss';

function Home() {
  return (
    <div className="home">
      <div className="home__hero">
        <h1 className="home__title">Arena of Halves</h1>
        <p className="home__subtitle">Choose your half. Claim the arena.</p>
        <div className="home__actions">
          <Link to="/lobby" className="btn btn--primary">Enter Lobby</Link>
          <Link to="/arena" className="btn btn--secondary">Jump to Arena</Link>
        </div>
      </div>
    </div>
  );
}

export default Home;
