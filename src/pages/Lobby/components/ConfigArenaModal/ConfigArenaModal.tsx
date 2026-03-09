import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ref, update } from 'firebase/database';
import { db } from '../../../../firebase';
import { deleteRoom } from '../../../../services/battleRoom';
import { fetchNPCs } from '../../../../data/npcs';
import type { FighterState } from '../../../../types/battle';
import Close from '../../../../icons/Close';
import Swords from '../../../../icons/Swords';
import ChevronDown from '../../../../icons/ChevronDown';
import AresHelmet from '../../icons/AresHelmet';
import NPCTeamSelection from './NPCTeamSelection/NPCTeamSelection';
import './ConfigArenaModal.scss';
import { GAME_MODE, COPY_TYPE, type GameMode, type CopyType } from '../../../../constants/lobby';
import { ARENA_PATH, BATTLE_TEAM, ROOM_STATUS, teamPath } from '../../../../constants/battle';
import { CHARACTER } from '../../../../constants/characters';
import { DEITY } from '../../../../constants/deities';

interface Props {
  arenaId: string;
  isDev?: boolean;
  player?: FighterState;
  onClose: () => void;
  onEnter: (arenaId: string) => void;
}

function NpcOption({ npc }: { npc: FighterState }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="cam__npc-card">
      {npc.image && !imgErr ? (
        <img className="cam__npc-avatar" src={npc.image} alt="" referrerPolicy="no-referrer" onError={() => setImgErr(true)} />
      ) : (
        <div className="cam__npc-avatar cam__npc-avatar--placeholder" style={{ background: npc.theme[0], color: npc.theme[9] }}>
          {npc.nicknameEng.charAt(0)}
        </div>
      )}
      <div className="cam__npc-info">
        <span className="cam__npc-name">{npc.nicknameEng}</span>
        <span className="cam__npc-deity">{npc.deityBlood}</span>
      </div>
      <div className="cam__npc-stats">
        <span className="cam__npc-stat cam__npc-stat--hp">
          <span className="cam__npc-stat-lbl">HP</span>
          <span className="cam__npc-stat-val">{npc.maxHp}</span>
        </span>
        <span className="cam__npc-stat cam__npc-stat--dmg">
          <span className="cam__npc-stat-lbl">DMG</span>
          <span className="cam__npc-stat-val">{npc.damage}</span>
        </span>
        <span className="cam__npc-stat cam__npc-stat--spd">
          <span className="cam__npc-stat-lbl">SPD</span>
          <span className="cam__npc-stat-val">{npc.speed}</span>
        </span>
      </div>
    </div>
  );
}

export default function ConfigArenaModal({ arenaId, isDev, player, onClose, onEnter }: Props) {
  const [teamSize, setTeamSize] = useState(1);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [copied, setCopied] = useState<CopyType | null>(null);
  const [npcs, setNpcs] = useState<FighterState[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<FighterState | null>(null);
  const [npcDropdownOpen, setNpcDropdownOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });

  // Team selection state
  const [playerTeam, setPlayerTeam] = useState<FighterState[]>([]);
  const [npcTeam, setNpcTeam] = useState<FighterState[]>([]);
  const [submitTeams, setSubmitTeams] = useState(false);

  useEffect(() => {
    fetchNPCs().then(setNpcs);
  }, []);

  const updateDropdownPos = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (rect) setDropdownPos({ top: rect.bottom, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (!npcDropdownOpen) return;
    updateDropdownPos();
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setNpcDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [npcDropdownOpen, updateDropdownPos]);

  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const handleCopy = async (type: CopyType) => {
    const text = type === COPY_TYPE.CODE ? arenaId : viewerLink;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for when document isn't focused (e.g. inside modal overlay)
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleClose = async () => {
    await deleteRoom(arenaId);
    onClose();
  };

  const handleEnter = async () => {
    // For team modes, trigger team submission
    if (gameMode === GAME_MODE.NPC && teamSize > 1) {
      setSubmitTeams(true);
      return;
    }

    const updates: Record<string, unknown> = { [ARENA_PATH.STATUS]: ROOM_STATUS.WAITING };

    if (gameMode === GAME_MODE.NPC) {
      // For NPC mode with team selection
      if (playerTeam.length > 0 && npcTeam.length > 0 && player) {
        // Update teamA with player + selected teammates
        updates[teamPath(BATTLE_TEAM.A, 'members')] = [player, ...playerTeam];
        // Store NPC team for Arena to assign to teamB
        updates.npcTeam = npcTeam;
        updates.npcMode = 'team';
      } else if (selectedNpc) {
        // Fallback to single NPC if no team selected
        updates.npcId = selectedNpc.characterId;
      }
    }

    await update(ref(db, `arenas/${arenaId}`), updates);
    onEnter(arenaId);
  };

  // Handle team submission after teams are selected
  useEffect(() => {
    if (!submitTeams || playerTeam.length !== teamSize - 1 || npcTeam.length !== teamSize || !player) return;

    const performEnter = async () => {
      const updates: Record<string, unknown> = {
        [ARENA_PATH.STATUS]: ROOM_STATUS.WAITING,
        [teamPath(BATTLE_TEAM.A, 'members')]: [player, ...playerTeam],
        npcTeam,
        npcMode: 'team',
      };
      await update(ref(db, `arenas/${arenaId}`), updates);
      onEnter(arenaId);
    };

    performEnter();
    setSubmitTeams(false);
  }, [submitTeams, playerTeam, npcTeam, teamSize, arenaId, onEnter, player]);

  const handleGameMode = async (mode: GameMode) => {
    setGameMode(mode);
    if (mode === GAME_MODE.NPC) {
      // For 1v1, auto-select first NPC
      if (teamSize === 1 && !selectedNpc && npcs.length > 0) {
        setSelectedNpc(npcs[0]);
      }
      // For 2v2/3v3, reset team selections for new game mode
      setPlayerTeam([]);
      setNpcTeam([]);
    }
    await update(ref(db, `arenas/${arenaId}`), {
      testMode: mode === GAME_MODE.NPC ? true : null,
    });
  };

  const handleSelectNpc = (npc: FighterState) => {
    setSelectedNpc(npc);
    setNpcDropdownOpen(false);
  };

  const handleNpcTeamSelect = (team: FighterState[]) => {
    setNpcTeam(team);
  };

  const handlePlayerTeamSelect = (team: FighterState[]) => {
    setPlayerTeam(team);
  };

  const handleTeamSize = async (size: number) => {
    setTeamSize(size);
    setPlayerTeam([]);
    setNpcTeam([]);
    setGameMode(null);
    await update(ref(db, `arenas/${arenaId}`), {
      teamSize: size,
      [teamPath(BATTLE_TEAM.A, 'maxSize')]: size,
      [teamPath(BATTLE_TEAM.B, 'maxSize')]: size,
    });
  };

  return (
    <div className="cam__overlay">
      <div className="cam" onClick={(e) => e.stopPropagation()}>
        <header className="cam__header">
          <h2 className="cam__title">
            <AresHelmet width={20} height={20} /> Room Created
          </h2>
          <button className="cam__close" onClick={handleClose}>
            <Close width={16} height={16} />
          </button>
        </header>

        <div className="cam__content">
          <label className="cam__label">Team Size</label>
          <div className="cam__sizes">
            {[1, 2, 3].map((n) => {
              const locked = n > 1 && !isDev;
              return (
                <button
                  key={n}
                  className={`cam__size ${teamSize === n ? 'cam__size--active' : ''} ${locked ? 'cam__size--locked' : ''}`}
                  onClick={() => !locked && handleTeamSize(n)}
                  disabled={locked}
                >
                  {n}v{n}
                  {locked && <span className="cam__size-soon">Soon</span>}
                </button>
              );
            })}
          </div>

          <label className="cam__label">Choose Your Opponent</label>
          <div className="cam__modes">
            <button
              className={`cam__mode ${gameMode === GAME_MODE.INVITE ? 'cam__mode--active' : ''}`}
              onClick={() => handleGameMode(GAME_MODE.INVITE)}
            >
              <Swords width={22} height={22} />
              <span className="cam__mode-title">Invite Player</span>
              <span className="cam__mode-desc">Share code with a friend</span>
            </button>
            <button
              className={`cam__mode ${gameMode === GAME_MODE.NPC ? 'cam__mode--active' : ''}`}
              onClick={() => handleGameMode(GAME_MODE.NPC)}
            >
              <AresHelmet width={22} height={22} />
              <span className="cam__mode-title">Play vs NPC</span>
              <span className="cam__mode-desc">Battle a random champion</span>
            </button>
          </div>

          {/* NPC Mode - 1v1 selection */}
          {gameMode === GAME_MODE.NPC && teamSize === 1 && (
            <>
              <label className="cam__label">Select Opponent</label>
              <div className="cam__npc-select">
                <button
                  ref={triggerRef}
                  className="cam__npc-trigger"
                  onClick={() => setNpcDropdownOpen(!npcDropdownOpen)}
                >
                  {selectedNpc ? (
                    <NpcOption npc={selectedNpc} />
                  ) : (
                    <span className="cam__npc-placeholder">Choose an NPC</span>
                  )}
                  <ChevronDown width={14} height={14} className={`cam__npc-chevron ${npcDropdownOpen ? 'cam__npc-chevron--open' : ''}`} />
                </button>

                {npcDropdownOpen && createPortal(
                  <div
                    ref={dropdownRef}
                    className="cam__npc-dropdown"
                    style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
                  >
                    {npcs.map((npc) => (
                      <button
                        key={npc.characterId}
                        className={`cam__npc-option ${selectedNpc?.characterId === npc.characterId ? 'cam__npc-option--active' : ''}`}
                        onClick={() => handleSelectNpc(npc)}
                      >
                        <NpcOption npc={npc} />
                      </button>
                    ))}
                  </div>,
                  document.body,
                )}
              </div>
            </>
          )}

          {/* NPC Mode - Team selection (2v2, 3v3) - Both visible */}
          {gameMode === GAME_MODE.NPC && teamSize > 1 && (
            <div className="cam__team-split">
              <div className="cam__team-col">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="cam__label">Opponent Team</label>
                  <span style={{ fontSize: '0.75rem', color: '#6b5d4a', fontWeight: 600 }}>{npcTeam.length} / {teamSize}</span>
                </div>
                <NPCTeamSelection teamSize={teamSize} onSelect={handleNpcTeamSelect} triggerSubmit={submitTeams} excludedIds={new Set(playerTeam.map(n => n.characterId))} />
              </div>

              <div className="cam__team-col">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="cam__label">Your Team</label>
                  <span style={{ fontSize: '0.75rem', color: '#6b5d4a', fontWeight: 600 }}>{playerTeam.length + 1} / {teamSize}</span>
                </div>
                {player && (
                  <div className="cam__player-chip">
                    {player.image ? (
                      <img className="cam__player-avatar" src={player.image} alt={player.nicknameEng} referrerPolicy="no-referrer" />
                    ) : (
                      <div className="cam__player-avatar cam__player-avatar--placeholder" style={{ background: player.theme[0] }}>
                        {player.nicknameEng.charAt(0)}
                      </div>
                    )}
                    <div className="cam__player-info">
                      <span className="cam__player-name">{player.nicknameEng}</span>
                      <span className="cam__player-deity">{player.characterId === CHARACTER.ROSABELLA ? DEITY.PERSEPHONE : player.deityBlood}</span>
                    </div>
                  </div>
                )}
                <NPCTeamSelection teamSize={teamSize - 1} onSelect={handlePlayerTeamSelect} triggerSubmit={submitTeams} excludedIds={new Set(npcTeam.map(n => n.characterId))} />
              </div>
            </div>
          )}

          {/* Invite mode */}
          {gameMode === GAME_MODE.INVITE && (
            <>
              <label className="cam__label">Room Code</label>
              <div className="cam__copy-row">
                <span className="cam__code">{arenaId}</span>
                <button
                  className={`cam__copy ${copied === COPY_TYPE.CODE ? 'cam__copy--done' : ''}`}
                  onClick={() => handleCopy(COPY_TYPE.CODE)}
                >
                  {copied === COPY_TYPE.CODE ? 'Copied!' : 'Copy'}
                </button>
              </div>

              <label className="cam__label">Viewer Link</label>
              <div className="cam__copy-row">
                <span className="cam__link">{viewerLink}</span>
                <button
                  className={`cam__copy ${copied === COPY_TYPE.LINK ? 'cam__copy--done' : ''}`}
                  onClick={() => handleCopy(COPY_TYPE.LINK)}
                >
                  {copied === COPY_TYPE.LINK ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </>
          )}
        </div>

        <div className="cam__footer">
          <button
            className="cam__btn cam__btn--enter"
            onClick={handleEnter}
            disabled={!gameMode || (gameMode === GAME_MODE.NPC && teamSize === 1 && !selectedNpc) || (gameMode === GAME_MODE.NPC && teamSize > 1 && (playerTeam.length !== teamSize - 1 || npcTeam.length !== teamSize))}
          >
            Enter the Field
          </button>
        </div>
      </div>
    </div>
  );
}
