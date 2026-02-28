import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchPowers } from '../../data/characters';
import {
  onRoomChange,
  joinRoom,
  joinAsViewer,
  leaveViewer,
  deleteRoom,
  toFighterState,
} from '../../services/battleRoom';
import type { BattleRoom } from '../../types/battle';
import { applyTheme } from '../../App';
import FighterCard from './components/FighterCard/FighterCard';
import ChevronLeft from '../../icons/ChevronLeft';
import './Arena.scss';

type Role = 'teamA' | 'teamB' | 'viewer';

/* ── Atmospheric background ── */
const ATMOS = (
  <>
    <div className="arena__stars" />
    <div className="arena__stars arena__stars--mid" />
    <div className="arena__embers">
      {Array.from({ length: 8 }).map((_, i) => (
        <span key={i} className="arena__ember" />
      ))}
    </div>
    <div className="arena__mist" />
    <div className="arena__mist arena__mist--reverse" />
  </>
);

/* ── Inline copy / link SVG icons ── */
const CopyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const LinkIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

function Arena() {
  const { arenaId } = useParams<{ arenaId: string }>();
  const [searchParams] = useSearchParams();
  const watchOnly = searchParams.get('watch') === 'true';
  const { user } = useAuth();
  const navigate = useNavigate();

  const [room, setRoom] = useState<BattleRoom | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);

  /* ── Subscribe to room changes ──────────────── */
  useEffect(() => {
    if (!arenaId) return;
    const unsub = onRoomChange(arenaId, (r) => {
      if (!r) {
        setError('Room has been closed.');
        setRoom(null);
        return;
      }
      setRoom(r);
    });
    return unsub;
  }, [arenaId]);

  /* ── Determine role & join ──────────────────── */
  const join = useCallback(async () => {
    if (!room || !user || !arenaId || joined) return;

    const myId = user.characterId;
    const teamAMembers = room.teamA?.members || [];
    const teamBMembers = room.teamB?.members || [];

    // Already in team A
    if (teamAMembers.some(m => m.characterId === myId)) {
      setRole('teamA');
      setJoined(true);
      return;
    }

    // Already in team B
    if (teamBMembers.some(m => m.characterId === myId)) {
      setRole('teamB');
      setJoined(true);
      return;
    }

    // Room is waiting & not watch-only — join team B
    const teamBFull = teamBMembers.length >= (room.teamB?.maxSize ?? 1);
    if (!watchOnly && room.status === 'waiting' && !teamBFull) {
      try {
        const powers = await fetchPowers(user.deityBlood);
        const fighter = toFighterState(user, powers);
        const result = await joinRoom(arenaId, fighter);
        if (result) {
          setRole('teamB');
          setJoined(true);
        } else {
          // slot taken, become viewer
          await joinAsViewer(arenaId, { characterId: myId, nicknameEng: user.nicknameEng });
          setRole('viewer');
          setJoined(true);
        }
      } catch {
        setError('Failed to join as fighter.');
      }
      return;
    }

    // Watch-only or teams full — join as viewer
    await joinAsViewer(arenaId, { characterId: myId, nicknameEng: user.nicknameEng });
    setRole('viewer');
    setJoined(true);
  }, [room, user, arenaId, joined, watchOnly]);

  useEffect(() => {
    join();
  }, [join]);

  /* ── Leave viewer on unmount ────────────────── */
  useEffect(() => {
    return () => {
      if (role === 'viewer' && arenaId && user) {
        leaveViewer(arenaId, user.characterId);
      }
    };
  }, [role, arenaId, user]);

  /* ── Copy helpers ────────────────────────────── */
  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const handleCopy = async (type: 'code' | 'link') => {
    const text = type === 'code' ? (arenaId || '') : viewerLink;
    await navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  /* ── Close room (teamA creator only) ────────── */
  const handleClose = async () => {
    if (arenaId) {
      await deleteRoom(arenaId);
      navigate('/arena');
    }
  };

  /* ── Loading / Error states ─────────────────── */
  if (error) {
    return (
      <div className="arena">
        {ATMOS}
        <div className="arena__state">
          <p className="arena__state-msg">{error}</p>
          <Link to="/arena" className="arena__action-btn arena__action-btn--secondary">Back to Lobby</Link>
        </div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="arena">
        {ATMOS}
        <div className="arena__state">
          <div className="arena__state-loader"><div className="app-loader__ring" /></div>
        </div>
      </div>
    );
  }

  const viewerCount = room.viewers ? Object.keys(room.viewers).length : 0;
  const teamAMembers = room.teamA?.members || [];
  const teamBMembers = room.teamB?.members || [];
  const teamBFull = teamBMembers.length >= (room.teamB?.maxSize ?? 1);
  const isCreator = teamAMembers[0]?.characterId === user?.characterId;

  return (
    <div className="arena">
      {ATMOS}

      {/* ── Top bar ── */}
      <header className="arena__bar">
        <Link to="/arena" className="arena__bar-back">
          <ChevronLeft width={15} height={15} />
          Lobby
        </Link>

        <div className="arena__bar-title">
          <span className="arena__bar-name">{room.roomName}</span>
          <span className="arena__bar-code">{room.arenaId}</span>
        </div>

        <span className={`arena__bar-status arena__bar-status--${room.status}`}>
          {room.status}
        </span>

        <span className="arena__bar-spacer" />

        <div className="arena__bar-meta">
          {room.teamSize > 1 && (
            <span className="arena__bar-badge">{room.teamSize}v{room.teamSize}</span>
          )}
          {role === 'viewer' && (
            <span className="arena__bar-badge arena__bar-badge--spectator">Spectating</span>
          )}
          {viewerCount > 0 && (
            <span className="arena__bar-viewers">{viewerCount} watching</span>
          )}
        </div>

        <div className="arena__bar-share">
          <button
            className={`arena__share-btn ${copied === 'code' ? 'arena__share-btn--copied' : ''}`}
            onClick={() => handleCopy('code')}
            title="Copy room code"
          >
            {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
          </button>
          <button
            className={`arena__share-btn ${copied === 'link' ? 'arena__share-btn--copied' : ''}`}
            onClick={() => handleCopy('link')}
            title="Copy viewer link"
          >
            {copied === 'link' ? <CheckIcon /> : <LinkIcon />}
          </button>
        </div>

        {room.status === 'waiting' && isCreator && (
          <span className="arena__bar-hint">Awaiting challenger…</span>
        )}
      </header>

      {/* ── Battle field ── */}
      <div className="arena__field">
        {/* Team A */}
        <div
          className="arena__half arena__half--left"
          style={teamAMembers[0] ? applyTheme(teamAMembers[0].theme) : undefined}
        >
          {teamAMembers.map((f) => (
            <FighterCard key={f.characterId} fighter={f} side="left" />
          ))}
        </div>

        <div className="arena__divider">
          <div className="arena__vs-ring">
            <span className="arena__vs">VS</span>
          </div>
        </div>

        {/* Team B */}
        <div
          className={`arena__half arena__half--right ${!teamBFull ? 'arena__half--empty' : ''}`}
          style={teamBMembers[0] ? applyTheme(teamBMembers[0].theme) : undefined}
        >
          {teamBMembers.length > 0 ? (
            teamBMembers.map((f) => (
              <FighterCard key={f.characterId} fighter={f} side="right" />
            ))
          ) : (
            <div className="arena__empty-slot">
              <span>Awaiting Challenger…</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Footer actions ── */}
      <div className="arena__actions">
        {isCreator && room.status === 'waiting' && (
          <button className="arena__action-btn arena__action-btn--danger" onClick={handleClose}>
            Close Room
          </button>
        )}
        <Link to="/arena" className="arena__action-btn arena__action-btn--secondary">
          Leave Arena
        </Link>
      </div>
    </div>
  );
}

export default Arena;
