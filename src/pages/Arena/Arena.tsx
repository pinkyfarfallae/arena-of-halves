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
  startBattle,
  selectTarget,
  submitAttackRoll,
  submitDefendRoll,
  resolveTurn,
} from '../../services/battleRoom';
import type { BattleRoom, FighterState } from '../../types/battle';
import type { Theme25 } from '../../types/character';
import BattleHUD from './components/BattleHUD/BattleHUD';
import TeamPanel from './components/TeamPanel/TeamPanel';
import ChevronLeft from '../../icons/ChevronLeft';
import CopyIcon from './icons/CopyIcon';
import LinkIcon from './icons/LinkIcon';
import CheckIcon from './icons/CheckIcon';
import './Arena.scss';

type Role = 'teamA' | 'teamB' | 'viewer';

/* ── Build gradient background from all members' theme colors ── */
function buildHalfStyle(
  members: FighterState[],
  otherMembers: FighterState[],
  side: 'left' | 'right',
): React.CSSProperties {
  const primaries = members.map((m) => m.theme[0]);
  const otherPrimaries = otherMembers.map((m) => m.theme[0]);

  // Same-theme detection: all primaries match across both sides
  const allSame =
    primaries.length > 0 &&
    otherPrimaries.length > 0 &&
    primaries.every((c) => otherPrimaries.includes(c)) &&
    otherPrimaries.every((c) => primaries.includes(c));

  const opacity = allSame ? (side === 'left' ? 18 : 8) : 14;

  const stops = primaries.map(
    (c) => `color-mix(in srgb, ${c} ${opacity}%, transparent)`,
  );

  const bg =
    stops.length === 1
      ? stops[0]
      : `linear-gradient(to bottom, ${stops.join(', ')})`;

  return { background: bg } as React.CSSProperties;
}

/* ── MOCK ENEMY — remove after testing ── */
const MOCK_THEME: Theme25 = [
  '#8B0000','#5C0000','#C04040','#FF4444','#1a1210','#f5ede4',
  '#2a2018','#9a8b76','#3d3228','#a01010','#ff666640','#352a20',
  '#221a14','#00000033','#ff444420','#00000060','#9a8b76','#f5ede4',
  '#6B0000','#CC3333','#5C0000','#8B0000','#CC3333','#FF4444','#FF4444',
];
const MOCK_ENEMY: FighterState = {
  characterId: 'mock-enemy-001',
  nicknameEng: 'Shadowbane',
  nicknameThai: 'เงาทมิฬ',
  sex: 'Male',
  deityBlood: 'Ares',
  theme: MOCK_THEME,
  maxHp: 60,
  currentHp: 60,
  damage: 1,
  attackDiceUp: 2,
  defendDiceUp: 1,
  speed: 14,
  rerollsLeft: 1,
  passiveSkillPoint: 'unlock',
  skillPoint: 'lock',
  ultimateSkillPoint: 'lock',
  powers: [
    { deity: 'Ares', type: 'Passive', name: 'Battle Fury', description: '', status: 'Passive', available: true },
    { deity: 'Ares', type: 'Skill', name: 'War Cry', description: '', status: '1st Skill', available: true },
    { deity: 'Ares', type: 'Skill', name: 'Blood Rush', description: '', status: '2nd Skill', available: false },
    { deity: 'Ares', type: 'Skill', name: 'Godslayer', description: '', status: 'Ultimate', available: false },
  ],
};
/* ── END MOCK ── */

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
  const [toast, setToast] = useState<string | null>(null);

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

  /* ── Test mode: auto-join mock enemy to teamB ── */
  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.status !== 'waiting') return;
    const teamBMembers = room.teamB?.members || [];
    if (teamBMembers.length > 0) return;

    joinRoom(arenaId, MOCK_ENEMY);
  }, [room, arenaId]);

  /* ── Test mode: auto-play for mock enemy ────── */
  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.status !== 'battling' || !room.battle?.turn) return;

    const turn = room.battle.turn;
    const mockId = MOCK_ENEMY.characterId;

    // Mock enemy's turn to select target → pick random alive opponent
    if (turn.phase === 'select-target' && turn.attackerId === mockId) {
      const teamAAlive = (room.teamA?.members || []).filter(m => m.currentHp > 0);
      if (teamAAlive.length > 0) {
        const target = teamAAlive[Math.floor(Math.random() * teamAAlive.length)];
        const timer = setTimeout(() => selectTarget(arenaId, target.characterId), 600);
        return () => clearTimeout(timer);
      }
    }

    // Mock enemy needs to roll attack dice (D12)
    // Delay enough for the waiting spinner to show briefly
    if (turn.phase === 'rolling-attack' && turn.attackerId === mockId) {
      const roll = Math.floor(Math.random() * 12) + 1;
      const timer = setTimeout(() => submitAttackRoll(arenaId, roll), 1800);
      return () => clearTimeout(timer);
    }

    // Mock enemy needs to roll defend dice (D12)
    // Must wait longer than defendReady (2800ms) so the attack result
    // dice animation plays, defend UI appears, then mock submits
    if (turn.phase === 'rolling-defend' && turn.defenderId === mockId) {
      const roll = Math.floor(Math.random() * 12) + 1;
      const timer = setTimeout(() => submitDefendRoll(arenaId, roll), 4500);
      return () => clearTimeout(timer);
    }

  }, [room, arenaId, user?.characterId]);

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
    setToast(type === 'code' ? 'Room code copied!' : 'Viewer link copied!');
    setTimeout(() => { setCopied(null); setToast(null); }, 2000);
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
  const battle = room.battle;
  const isBattling = room.status === 'battling' || room.status === 'finished';

  const handleStartBattle = async () => {
    if (arenaId) await startBattle(arenaId);
  };

  const handleSelectTarget = async (defenderId: string) => {
    if (arenaId) await selectTarget(arenaId, defenderId);
  };

  const handleSubmitAttackRoll = async (roll: number) => {
    if (arenaId) await submitAttackRoll(arenaId, roll);
  };

  const handleSubmitDefendRoll = async (roll: number) => {
    if (arenaId) await submitDefendRoll(arenaId, roll);
  };

  const handleResolveTurn = async () => {
    if (arenaId) await resolveTurn(arenaId);
  };

  return (
    <div className="arena">
      {/* ── Toast notification ── */}
      {toast && (
        <div className="arena__toast" key={toast}>
          <CheckIcon /> {toast}
        </div>
      )}

      {/* ── Top bar ── */}
      <header className="arena__bar">
        <Link to="/arena" className="arena__bar-back">
          <ChevronLeft width={15} height={15} />
          Leave Arena
        </Link>

        <div className="arena__bar-title">
          <span className="arena__bar-name">{room.roomName}</span>
        </div>

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
            data-tooltip={copied === 'code' ? 'Copied!' : 'Copy room code'}
            data-tooltip-pos="bottom"
          >
            {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
          </button>
          <button
            className={`arena__share-btn ${copied === 'link' ? 'arena__share-btn--copied' : ''}`}
            onClick={() => handleCopy('link')}
            data-tooltip={copied === 'link' ? 'Copied!' : 'Copy viewer link'}
            data-tooltip-pos="bottom"
          >
            {copied === 'link' ? <CheckIcon /> : <LinkIcon />}
          </button>
        </div>
      </header>

      {/* ── Battle field ── */}
      <div className="arena__field">
        {/* Team A */}
        <div
          className="arena__half arena__half--left"
          style={teamAMembers.length ? buildHalfStyle(teamAMembers, teamBMembers, 'left') : undefined}
        >
          <TeamPanel
            members={teamAMembers}
            side="left"
            battle={battle}
            myId={user?.characterId}
            onSelectTarget={handleSelectTarget}
          />
        </div>

        <div className="arena__divider">
          <div className="arena__vs-ring">
            <span className="arena__vs">{battle?.roundNumber ? `R${battle.roundNumber}` : 'VS'}</span>
          </div>
        </div>

        {/* Team B */}
        <div
          className={`arena__half arena__half--right ${!teamBFull ? 'arena__half--empty' : ''}`}
          style={teamBMembers.length ? buildHalfStyle(teamBMembers, teamAMembers, 'right') : undefined}
        >
          {teamBMembers.length > 0 ? (
            <TeamPanel
              members={teamBMembers}
              side="right"
              battle={battle}
              myId={user?.characterId}
              onSelectTarget={handleSelectTarget}
            />
          ) : (
            <div className="arena__empty-slot">
              <span>Awaiting Challenger…</span>
            </div>
          )}
        </div>

        {/* Battle HUD overlay */}
        {isBattling && battle && (
          <BattleHUD
            battle={battle}
            teamA={teamAMembers}
            teamB={teamBMembers}
            myId={user?.characterId}
            onSelectTarget={handleSelectTarget}
            onSubmitAttackRoll={handleSubmitAttackRoll}
            onSubmitDefendRoll={handleSubmitDefendRoll}
            onResolve={handleResolveTurn}
          />
        )}
      </div>

      {/* ── Footer actions ── */}
      <div className="arena__actions">
        {isCreator && room.status === 'ready' && (
          <button className="arena__action-btn arena__action-btn--primary" onClick={handleStartBattle}>
            Start Battle
          </button>
        )}
        {isCreator && room.status === 'waiting' && (
          <button className="arena__action-btn arena__action-btn--danger" onClick={handleClose}>
            Close Room
          </button>
        )}
      </div>
    </div>
  );
}

export default Arena;
