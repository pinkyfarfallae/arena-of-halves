import { useState, useEffect, useRef } from 'react';
import { ref, update } from 'firebase/database';
import { db } from '../../../../firebase';
import { deleteRoom } from '../../../../services/battleRoom';
import { fetchNPCs } from '../../../../data/npcs';
import type { FighterState } from '../../../../types/battle';
import Close from '../../../../icons/Close';
import Swords from '../../../../icons/Swords';
import ChevronDown from '../../../../icons/ChevronDown';
import AresHelmet from '../../icons/AresHelmet';
import './ConfigArenaModal.scss';

interface Props {
  arenaId: string;
  isDev?: boolean;
  onClose: () => void;
  onEnter: (arenaId: string) => void;
}

type GameMode = 'invite' | 'npc';

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

export default function ConfigArenaModal({ arenaId, isDev, onClose, onEnter }: Props) {
  const [teamSize, setTeamSize] = useState(1);
  const [gameMode, setGameMode] = useState<GameMode | null>(null);
  const [copied, setCopied] = useState<'code' | 'link' | null>(null);
  const [npcs, setNpcs] = useState<FighterState[]>([]);
  const [selectedNpc, setSelectedNpc] = useState<FighterState | null>(null);
  const [npcDropdownOpen, setNpcDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNPCs().then(setNpcs);
  }, []);

  useEffect(() => {
    if (!npcDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setNpcDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [npcDropdownOpen]);

  const viewerLink = `${window.location.origin}${window.location.pathname}#/arena/${arenaId}?watch=true`;

  const handleCopy = async (type: 'code' | 'link') => {
    const text = type === 'code' ? arenaId : viewerLink;
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
    const updates: Record<string, unknown> = { status: 'waiting' };
    if (gameMode === 'npc' && selectedNpc) {
      updates.npcId = selectedNpc.characterId;
    }
    await update(ref(db, `arenas/${arenaId}`), updates);
    onEnter(arenaId);
  };

  const handleGameMode = async (mode: GameMode) => {
    setGameMode(mode);
    if (mode === 'npc') {
      // Auto-select first NPC if none selected
      if (!selectedNpc && npcs.length > 0) setSelectedNpc(npcs[0]);
    }
    await update(ref(db, `arenas/${arenaId}`), {
      testMode: mode === 'npc' ? true : null,
    });
  };

  const handleSelectNpc = (npc: FighterState) => {
    setSelectedNpc(npc);
    setNpcDropdownOpen(false);
  };

  const handleTeamSize = async (size: number) => {
    setTeamSize(size);
    await update(ref(db, `arenas/${arenaId}`), {
      teamSize: size,
      'teamA/maxSize': size,
      'teamB/maxSize': size,
    });
  };

  return (
    <div className="cam__overlay">
      <div className="cam" onClick={(e) => e.stopPropagation()}>
        <button className="cam__close" onClick={handleClose}>
          <Close width={16} height={16} />
        </button>

        <h2 className="cam__title">
          <AresHelmet width={20} height={20} /> Room Created
        </h2>

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
            className={`cam__mode ${gameMode === 'invite' ? 'cam__mode--active' : ''}`}
            onClick={() => handleGameMode('invite')}
          >
            <Swords width={22} height={22} />
            <span className="cam__mode-title">Invite Player</span>
            <span className="cam__mode-desc">Share code with a friend</span>
          </button>
          <button
            className={`cam__mode ${gameMode === 'npc' ? 'cam__mode--active' : ''}`}
            onClick={() => handleGameMode('npc')}
          >
            <AresHelmet width={22} height={22} />
            <span className="cam__mode-title">Play vs NPC</span>
            <span className="cam__mode-desc">Battle a random champion</span>
          </button>
        </div>

        {gameMode === 'npc' && (
          <>
            <label className="cam__label">Select Opponent</label>
            <div className="cam__npc-select" ref={dropdownRef}>
              <button
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

              {npcDropdownOpen && (
                <div className="cam__npc-dropdown">
                  {npcs.map((npc) => (
                    <button
                      key={npc.characterId}
                      className={`cam__npc-option ${selectedNpc?.characterId === npc.characterId ? 'cam__npc-option--active' : ''}`}
                      onClick={() => handleSelectNpc(npc)}
                    >
                      <NpcOption npc={npc} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {gameMode === 'invite' && (
          <>
            <label className="cam__label">Room Code</label>
            <div className="cam__copy-row">
              <span className="cam__code">{arenaId}</span>
              <button
                className={`cam__copy ${copied === 'code' ? 'cam__copy--done' : ''}`}
                onClick={() => handleCopy('code')}
              >
                {copied === 'code' ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <label className="cam__label">Viewer Link</label>
            <div className="cam__copy-row">
              <span className="cam__link">{viewerLink}</span>
              <button
                className={`cam__copy ${copied === 'link' ? 'cam__copy--done' : ''}`}
                onClick={() => handleCopy('link')}
              >
                {copied === 'link' ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </>
        )}

        <button
          className="cam__btn cam__btn--enter"
          onClick={handleEnter}
          disabled={!gameMode || (gameMode === 'npc' && !selectedNpc)}
        >
          Enter the Field
        </button>
      </div>
    </div>
  );
}
