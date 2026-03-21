/* eslint-disable react-hooks/exhaustive-deps */
import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { fetchNPCs } from '../../../../../data/npcs';
import Dice from './icons/Dice';
import { CHARACTER } from '../../../../../constants/characters';
import { DEITY } from '../../../../../constants/deities';
import type { FighterState } from '../../../../../types/battle';
import './NPCTeamSelection.scss';

function deityBloodLabel(f: FighterState): string {
  return f.characterId.toLowerCase() === CHARACTER.ROSABELLA ? DEITY.PERSEPHONE : f.deityBlood;
}

function mergeFighterLists(a: FighterState[], b: FighterState[]): FighterState[] {
  const m = new Map<string, FighterState>();
  a.forEach((f) => m.set(f.characterId.toLowerCase(), f));
  b.forEach((f) => {
    const k = f.characterId.toLowerCase();
    if (!m.has(k)) m.set(k, f);
  });
  return Array.from(m.values());
}

interface Props {
  teamSize: number;
  onSelect: (fighters: FighterState[]) => void;
  triggerSubmit?: boolean;
  excludedIds?: Set<string>;
  /** Camp / demigod roster — when set with `npcs`, UI shows separate Camp vs NPC zones */
  players?: FighterState[];
  /** NPC roster; if `players` is omitted, treated as the full pool (legacy / standalone fetch) */
  npcs?: FighterState[];
  /** Character ids to show as selected (e.g. roster slot restore) */
  initialSelection?: string[];
}

export default function NPCTeamSelection({
  teamSize,
  onSelect,
  triggerSubmit,
  excludedIds,
  players: playersProp,
  npcs: npcsProp,
  initialSelection,
}: Props) {
  const splitMode = playersProp !== undefined;

  const [legacyPool, setLegacyPool] = useState<FighterState[]>(() =>
    !splitMode && npcsProp && npcsProp.length > 0 ? npcsProp : [],
  );
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelection ?? []));
  const [loading, setLoading] = useState(() => {
    if (splitMode) return false;
    return !(npcsProp && npcsProp.length > 0);
  });
  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const pool = useMemo(() => {
    if (splitMode) return mergeFighterLists(playersProp ?? [], npcsProp ?? []);
    return legacyPool;
  }, [splitMode, playersProp, npcsProp, legacyPool]);

  useEffect(() => {
    if (splitMode) {
      setLoading(false);
      return;
    }
    if (npcsProp !== undefined) {
      if (npcsProp.length > 0) {
        setLegacyPool(npcsProp);
        setLoading(false);
        return;
      }
      fetchNPCs().then(setLegacyPool).finally(() => setLoading(false));
      return;
    }
    fetchNPCs().then(setLegacyPool).finally(() => setLoading(false));
  }, [splitMode, npcsProp]);

  useEffect(() => {
    const ids = initialSelection?.filter(Boolean) ?? [];
    setSelected(new Set(ids));
  }, [initialSelection?.join('|')]);

  // Submit when parent requests it
  useEffect(() => {
    if (triggerSubmit && selected.size > 0) {
      const selectedFighters = pool.filter((n) => selected.has(n.characterId));
      onSelect(selectedFighters);
    }
  }, [triggerSubmit, selected, pool, onSelect]);

  const handleToggle = (characterId: string) => {
    if (!picksAllowed) return;
    // Prevent selecting NPCs that are in other team
    if (excludedIds?.has(characterId)) return;
    
    const newSelected = new Set(selected);

    if (newSelected.has(characterId)) {
      newSelected.delete(characterId);
    } else if (newSelected.size < teamSize) {
      newSelected.add(characterId);
    }

    setSelected(newSelected);
    
    // Call onSelect immediately when selection changes
    const selectedFighters = pool.filter((n) => newSelected.has(n.characterId));
    onSelect(selectedFighters);
  };

  const handleRandom = () => {
    if (!picksAllowed) return;
    // Filter out excluded fighters
    const availableIndices = Array.from({ length: pool.length }, (_, i) => i)
      .filter((i) => !excludedIds?.has(pool[i].characterId));
    
    // Shuffle available indices
    for (let i = availableIndices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [availableIndices[i], availableIndices[j]] = [availableIndices[j], availableIndices[i]];
    }

    const randomSelected = new Set<string>();
    for (let i = 0; i < Math.min(teamSize, availableIndices.length); i++) {
      randomSelected.add(pool[availableIndices[i]].characterId);
    }
    setSelected(randomSelected);

    const selectedFighters = pool.filter((n) => randomSelected.has(n.characterId));
    onSelect(selectedFighters);
  };

  const picksAllowed = teamSize > 0;

  const renderFighterCard = (npc: FighterState) => (
    <button
      key={npc.characterId}
      type="button"
      ref={(el) => {
        if (el) cardRefs.current?.set(npc.characterId, el);
      }}
      className={`nts__card ${selected.has(npc.characterId) ? 'nts__card--selected' : ''} ${excludedIds?.has(npc.characterId) ? 'nts__card--excluded' : ''} ${!picksAllowed ? 'nts__card--preview' : ''}`}
      onClick={() => handleToggle(npc.characterId)}
      disabled={!picksAllowed || excludedIds?.has(npc.characterId)}
      style={{ '--accent': npc.theme[0] } as React.CSSProperties}
    >
      {npc.image ? (
        <img className="nts__avatar" src={npc.image} alt={npc.nicknameEng} />
      ) : (
        <div className="nts__avatar nts__avatar--placeholder" style={{ background: npc.theme[0] }}>
          {npc.nicknameEng.charAt(0)}
        </div>
      )}
      <span className="nts__name">{npc.nicknameEng}</span>
      <span className="nts__stats">{deityBloodLabel(npc)}</span>
      {selected.has(npc.characterId) &&
        cardRefs.current?.get(npc.characterId) &&
        createPortal(<span className="nts__check">✓</span>, cardRefs.current.get(npc.characterId)!)}
    </button>
  );

  if (loading) {
    const skeletonCells = (prefix: string, count: number) =>
      Array.from({ length: count }).map((_, i) => (
        <div key={`${prefix}-${i}`} className="nts__card nts__card--loading">
          <div className="nts__skeleton nts__skeleton--avatar" />
          <div className="nts__skeleton nts__skeleton--text nts__skeleton--name" />
          <div className="nts__skeleton nts__skeleton--text nts__skeleton--stats" />
        </div>
      ));
    return (
      <div className={`nts ${splitMode ? 'nts--grouped' : ''}`}>
        <button className="nts__random" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
          <Dice width={16} height={16} />
          {teamSize > 1 ? 'Random Team' : 'Random'}
        </button>
        {splitMode ? (
          <div className="nts__grid nts__grid--grouped">
            <div className="nts__zone-label">Camp</div>
            {skeletonCells('c', 6)}
            <div className="nts__zone-label">NPCs</div>
            {skeletonCells('n', 6)}
          </div>
        ) : (
          <div className="nts__grid">{skeletonCells('all', 9)}</div>
        )}
      </div>
    );
  }

  const campList = playersProp ?? [];
  const npcList = npcsProp ?? [];

  return (
    <div className={`nts ${splitMode ? 'nts--grouped' : ''}`}>
      <button
        type="button"
        className="nts__random"
        onClick={handleRandom}
        disabled={!picksAllowed}
      >
        <Dice width={16} height={16} />
        {teamSize > 1 ? 'Random Team' : 'Random'}
      </button>

      {splitMode ? (
        <div className="nts__grid nts__grid--grouped">
          <div className="nts__zone-label">Camp</div>
          {campList.length === 0 ? (
            <p className="nts__zone-empty">No demigods in camp</p>
          ) : (
            campList.map((npc) => renderFighterCard(npc))
          )}
          <div className="nts__zone-label">NPCs</div>
          {npcList.length === 0 ? (
            <p className="nts__zone-empty">No NPCs</p>
          ) : (
            npcList.map((npc) => renderFighterCard(npc))
          )}
        </div>
      ) : (
        <div className="nts__grid">{pool.map((npc) => renderFighterCard(npc))}</div>
      )}
    </div>
  );
}
