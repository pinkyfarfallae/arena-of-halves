import { NavLink } from 'react-router-dom';
import './Navbar.scss';

function Navbar() {
  return (
    <nav className="navbar">
      <NavLink to="/" className="navbar__brand">Arena of Halves</NavLink>
      <div className="navbar__links">
        <NavLink to="/" end className={({ isActive }) => isActive ? 'navbar__link navbar__link--active' : 'navbar__link'}>Home</NavLink>
        <NavLink to="/lobby" className={({ isActive }) => isActive ? 'navbar__link navbar__link--active' : 'navbar__link'}>Lobby</NavLink>
        <NavLink to="/arena" className={({ isActive }) => isActive ? 'navbar__link navbar__link--active' : 'navbar__link'}>Arena</NavLink>
      </div>
    </nav>
  );
}

export default Navbar;
