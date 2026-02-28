import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { ROLE } from '../../constants/role';
import { fetchPowers } from '../../data/characters';
import { createRoom, getRoom, onRoomsList, toFighterState } from '../../services/battleRoom';
import type { BattleRoom } from '../../types/battle';
import Swords from '../../icons/Swords';
import ChevronLeft from '../../icons/ChevronLeft';
import ArrowRight from './icons/ArrowRight';
import AresHelmet from './icons/AresHelmet';
import Colosseum from './icons/Colosseum';
import ConfigArenaModal from './components/ConfigArenaModal/ConfigArenaModal';
import './Lobby.scss';

/* ── Decorative elements ── */
const DECOR = (
  <>
    {/* Corner L-marks */}
    <div className="lobby__corner lobby__corner--tl" />
    <div className="lobby__corner lobby__corner--tr" />
    <div className="lobby__corner lobby__corner--bl" />
    <div className="lobby__corner lobby__corner--br" />
    {/* Diamond accents */}
    <div className="lobby__diamond lobby__diamond--tl" />
    <div className="lobby__diamond lobby__diamond--bl" />
    <div className="lobby__diamond lobby__diamond--ml" />
    <div className="lobby__diamond lobby__diamond--mr" />
  </>
);

function Lobby() {
  const { user, role } = useAuth();
  const navigate = useNavigate();

  const [roomName, setRoomName] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [loading, setLoading] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState('');
  const [activeRooms, setActiveRooms] = useState<BattleRoom[]>([]);
  const [createdArenaId, setCreatedArenaId] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onRoomsList(setActiveRooms);
    return unsub;
  }, []);

  const handleCreate = async () => {
    if (!user) return;
    setLoading('create');
    setError('');
    try {
      const powers = await fetchPowers(user.deityBlood);
      const fighter = toFighterState(user, powers);
      const arenaId = await createRoom(fighter, roomName || undefined);
      setCreatedArenaId(arenaId);
    } catch {
      setError('Failed to create room. Try again.');
    } finally {
      setLoading(null);
    }
  };

  const handleJoin = async () => {
    if (!joinCode.trim()) {
      setError('Enter a room code.');
      return;
    }
    setLoading('join');
    setError('');
    try {
      const code = joinCode.trim().toUpperCase();
      const room = await getRoom(code);
      if (!room) {
        setError('Room not found. Check the code.');
        return;
      }
      navigate(code);
    } catch {
      setError('Failed to join room. Try again.');
    } finally {
      setLoading(null);
    }
  };

  const statusLabel = (s: string) => {
    switch (s) {
      case 'waiting': return 'Waiting';
      case 'ready': return 'Ready';
      case 'battling': return 'Live';
      case 'finished': return 'Ended';
      default: return s;
    }
  };

  return (
    <div className="lobby">
      <div className="lobby__column lobby__column--left" />
      <div className="lobby__column lobby__column--right" />
      <div className="lobby__body">
        {DECOR}

        <div className="lobby__content">
          <Link to="/life" className="lobby__back">
            <ChevronLeft width={14} height={14} />
            Back to Camp
          </Link>

          {/* Title — flanked by colosseum arches */}
          <div className="lobby__title">
            <div className="lobby__arches lobby__arches--left">
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
            </div>
            <div className="lobby__title-text">
              <h1>The<span></span>Arena</h1>
              <p>Choose your fate, demigod</p>
            </div>
            <div className="lobby__arches lobby__arches--right">
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
              <div className="lobby__arch-win"><AresHelmet className="lobby__arch-icon" /></div>
            </div>
          </div>

          {/* Greek key border */}
          <div className="lobby__meander" />

          {/* Scrollable area — panels, rooms, empty */}
          <div className="lobby__scroll">
            {/* Create / VS / Join panels */}
            <div className="lobby__panels">
              {/* Create Room */}
              <div className="lobby__panel">
                <div className="lobby__panel-head">
                  <div className="lobby__panel-icon lobby__panel-icon--create"><Swords width={17} height={17} /></div>
                  <div className="lobby__panel-text">
                    <h2>Create Room</h2>
                    <p>Start a new battle arena</p>
                  </div>
                </div>
                <div className="lobby__panel-line" />
                <div className="lobby__panel-body">
                  <input
                    className="lobby__input lobby__input--name"
                    type="text"
                    placeholder="Room name (optional)"
                    maxLength={40}
                    value={roomName}
                    onChange={(e) => setRoomName(e.target.value)}
                    disabled={!!loading}
                  />
                </div>
                <button
                  className="lobby__btn lobby__btn--create"
                  onClick={handleCreate}
                  disabled={!!loading}
                >
                  {loading === 'create' ? 'Creating...' : 'Create Room'}
                </button>
              </div>

              {/* Flag Divider */}
              <div className="lobby__panels-flag">
                <AresHelmet className="lobby__flag-icon" />
              </div>

              {/* Join Room */}
              <div className="lobby__panel">
                <div className="lobby__panel-head">
                  <div className="lobby__panel-icon lobby__panel-icon--join"><ArrowRight width={17} height={17} /></div>
                  <div className="lobby__panel-text">
                    <h2>Join Room</h2>
                    <p>Enter your opponent's code</p>
                  </div>
                </div>
                <div className="lobby__panel-line" />
                <div className="lobby__panel-body">
                  <input
                    className="lobby__input"
                    type="text"
                    placeholder="e.g. AH7X2K"
                    maxLength={6}
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                    disabled={!!loading}
                  />
                </div>
                <button
                  className="lobby__btn lobby__btn--join"
                  onClick={handleJoin}
                  disabled={!!loading || !joinCode.trim()}
                >
                  {loading === 'join' ? 'Joining...' : 'Join Room'}
                </button>
              </div>
            </div>

            {error && <p className="lobby__error">{error}</p>}

            {/* Active Rooms */}
            {activeRooms.length > 0 && (
              <div className="lobby__rooms-section">
                <div className="lobby__rooms-head">
                  <div className="lobby__banner lobby__banner--l1" />
                  <div className="lobby__banner lobby__banner--l2" />
                  <span className="lobby__rooms-line" />
                  <h2>Active<span></span>Room{activeRooms.length > 1 ? 's' : ''}</h2>
                  <span className="lobby__rooms-line" />
                  <div className="lobby__banner lobby__banner--r2" />
                  <div className="lobby__banner lobby__banner--r1" />
                </div>
                <div className="lobby__rooms-list">
                  {activeRooms.map((room) => (
                    <button
                      key={room.arenaId}
                      className="lobby__room"
                      onClick={() => navigate(`${room.arenaId}?watch=true`)}
                    >
                      <span className="lobby__room-name">{room.roomName}</span>
                      {room.teamSize > 1 && (
                        <span className="lobby__room-mode">{room.teamSize}v{room.teamSize}</span>
                      )}
                      <span className={`lobby__room-status lobby__room-status--${room.status}`}>
                        {statusLabel(room.status)}
                      </span>
                      <span className="lobby__room-code">{room.arenaId}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeRooms.length === 0 && (
              <div className="lobby__empty">
                <Colosseum className="lobby__empty-icon" width={64} height={64} />
                <p>No active battles. Create one to begin.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {createdArenaId && (
        <ConfigArenaModal
          arenaId={createdArenaId}
          isDev={role === ROLE.DEVELOPER}
          onClose={() => setCreatedArenaId(null)}
          onEnter={(id) => navigate(id)}
        />
      )}
    </div>
  );
}

export default Lobby;
