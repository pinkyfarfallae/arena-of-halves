import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import Omega from './icons/Omega';
import Lightning from '../../icons/Lightning';
import Warning from './icons/Warning';
import Swords from '../../icons/Swords';
import './Login.scss';

const BG_ELEMENTS = (
  <>
    {/* Starfield */}
    <div className="login__stars" />
    <div className="login__stars login__stars--mid" />
    <div className="login__stars login__stars--slow" />

    {/* Campfire embers */}
    <div className="login__embers">
      {Array.from({ length: 12 }).map((_, i) => (
        <span key={i} className="login__ember" />
      ))}
    </div>

    {/* Campfire glow */}
    <div className="login__campfire" />

    {/* Greek column silhouettes */}
    <div className="login__column login__column--left" />
    <div className="login__column login__column--right" />

    {/* Mist layer */}
    <div className="login__mist" />
    <div className="login__mist login__mist--reverse" />
  </>
);

function Login() {
  const navigate = useNavigate();
  const { login, isLoggedIn, user, logout } = useAuth();
  const [characterId, setCharacterId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await login(characterId, password);
    if (success) {
      setError('');
      navigate('/');
    } else {
      setError('Access denied. The Oracle does not recognize you.');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  if (isLoggedIn) {
    return (
      <div className="login">
        {BG_ELEMENTS}
        <div className="login__card">
          <div className="login__omega"><Omega width={28} height={28} /></div>
          <h1 className="login__title">Welcome, Half-Blood</h1>
          <p className="login__subtitle">Signed in as <strong>{user?.characterId}</strong></p>

          <button className="login__btn" onClick={logout}>
            Leave Camp
          </button>

          <p className="login__footer"><Lightning width={12} height={12} /> Safe travels, demigod <Lightning width={12} height={12} /></p>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      {BG_ELEMENTS}

      <div className={`login__card ${shake ? 'login__card--shake' : ''}`}>
        <div className="login__omega"><Omega width={28} height={28} /></div>

        <h1 className="login__title">Camp Half-Blood</h1>
        <p className="login__subtitle">Identify yourself, demigod</p>

        <form className="login__form" onSubmit={handleSubmit}>
          <div className="login__field">
            <label className="login__label" htmlFor="characterId">Demigod ID</label>
            <input
              id="characterId"
              className="login__input"
              type="text"
              placeholder="Your name, hero"
              value={characterId}
              onChange={(e) => setCharacterId(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="login__field">
            <label className="login__label" htmlFor="password">Passphrase</label>
            <input
              id="password"
              className="login__input"
              type="password"
              placeholder="Speak the words"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && <p className="login__error"><Warning width={14} height={14} /> {error}</p>}

          <button type="submit" className="login__btn">
            Enter Camp <Swords width={14} height={14} />
          </button>
        </form>

        <p className="login__footer"><Lightning width={12} height={12} /> Arena of Halves <Lightning width={12} height={12} /></p>
      </div>
    </div>
  );
}

export default Login;
