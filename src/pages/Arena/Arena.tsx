import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { fetchPowers } from '../../data/characters';
import { fetchNPCs, pickRandomNPC } from '../../data/npcs';
import { POWER_OVERRIDES } from '../CharacterInfo/constants/overrides';
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
import BattleHUD from './components/BattleHUD/BattleHUD';
import TeamPanel from './components/TeamPanel/TeamPanel';
import ChevronLeft from '../../icons/ChevronLeft';
import BattleLogModal from '../Lobby/components/BattleLogModal/BattleLogModal';
import CopyIcon from './icons/CopyIcon';
import LinkIcon from './icons/LinkIcon';
import CheckIcon from './icons/CheckIcon';
import Eye from '../../icons/Eye';
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
  const [showLog, setShowLog] = useState(false);
  const [npcEnemy, setNpcEnemy] = useState<FighterState | null>(null);

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
        const powerDeity = POWER_OVERRIDES[user.characterId?.toLowerCase()] ?? user.deityBlood;
        const powers = await fetchPowers(powerDeity);
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

  /* ── Test mode: fetch selected NPC and auto-join to teamB ── */
  useEffect(() => {
    if (!room || !arenaId || !room.testMode) return;
    if (room.status !== 'waiting') return;
    const teamBMembers = room.teamB?.members || [];
    if (teamBMembers.length > 0) return;

    let cancelled = false;
    fetchNPCs().then((npcs) => {
      if (cancelled) return;
      // Use the NPC selected in config, or fall back to random
      const npcId = room.npcId;
      const npc = (npcId && npcs.find((n) => n.characterId === npcId)) || pickRandomNPC(npcs);
      if (!npc) return;
      setNpcEnemy(npc);
      joinRoom(arenaId, npc);
    });
    return () => { cancelled = true; };
  }, [room, arenaId]);

  /* ── Test mode: auto-play for NPC enemy ────── */
  useEffect(() => {
    if (!room || !arenaId || !room.testMode || !npcEnemy) return;
    if (room.status !== 'battling' || !room.battle?.turn) return;

    const turn = room.battle.turn;
    const npcId = npcEnemy.characterId;

    // NPC's turn to select target → pick random alive opponent
    if (turn.phase === 'select-target' && turn.attackerId === npcId) {
      const teamAAlive = (room.teamA?.members || []).filter(m => m.currentHp > 0);
      if (teamAAlive.length > 0) {
        const target = teamAAlive[Math.floor(Math.random() * teamAAlive.length)];
        const timer = setTimeout(() => selectTarget(arenaId, target.characterId), 600);
        return () => clearTimeout(timer);
      }
    }

    // NPC needs to roll attack dice (D12)
    if (turn.phase === 'rolling-attack' && turn.attackerId === npcId) {
      const roll = Math.floor(Math.random() * 12) + 1;
      const timer = setTimeout(() => submitAttackRoll(arenaId, roll), 1800);
      return () => clearTimeout(timer);
    }

    // NPC needs to roll defend dice (D12)
    if (turn.phase === 'rolling-defend' && turn.defenderId === npcId) {
      const roll = Math.floor(Math.random() * 12) + 1;
      const timer = setTimeout(() => submitDefendRoll(arenaId, roll), 4500);
      return () => clearTimeout(timer);
    }

  }, [room, arenaId, npcEnemy]);

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
          <div className="arena__state-loader">
            <div className="app-loader__ring" />
          </div>
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

        {room.status === 'finished' ? (
          <div className="arena__bar-share">
            <button
              className="arena__share-btn"
              onClick={() => setShowLog(true)}
              data-tooltip="Log"
              data-tooltip-pos="bottom"
            >
              <Eye width={14} height={14} />
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
        ) : (
          <div className="arena__bar-share">
            {room.status === 'waiting' && (
              <button
                className={`arena__share-btn ${copied === 'code' ? 'arena__share-btn--copied' : ''}`}
                onClick={() => handleCopy('code')}
                data-tooltip={copied === 'code' ? 'Copied!' : 'Copy room code'}
                data-tooltip-pos="bottom"
              >
                {copied === 'code' ? <CheckIcon /> : <CopyIcon />}
              </button>
            )}
            <button
              className={`arena__share-btn ${copied === 'link' ? 'arena__share-btn--copied' : ''}`}
              onClick={() => handleCopy('link')}
              data-tooltip={copied === 'link' ? 'Copied!' : 'Copy viewer link'}
              data-tooltip-pos="bottom"
            >
              {copied === 'link' ? <CheckIcon /> : <LinkIcon />}
            </button>
          </div>
        )}
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

      {showLog && room && (
        <BattleLogModal room={room} onClose={() => setShowLog(false)} />
      )}
    </div>
  );
}

export default Arena;
